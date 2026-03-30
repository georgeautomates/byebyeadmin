#!/usr/bin/env python3
"""BBA Blog Writer — on-demand via Slack.

Two-stage process:
  --mode outline --topic "..."   Research + generate outline, post to Slack for review.
                                  Saves pending state to Sheets "Blog Queue" tab.
  --mode full                    Reads latest pending row from Sheets, writes full 1,000-word
                                  post, creates Google Doc, publishes MDX to repo, triggers Copywriter.

Usage:
  python3 bba-blog-writer.py --mode outline --topic "UK haulage fuel cost management"
  python3 bba-blog-writer.py --mode full
"""

import os, json, sys, datetime, argparse, re, subprocess
import urllib.request, urllib.parse
from bba_llm import call_llm

def load_env():
    path = '/home/openclaw/byebyeadmin/ops/.env'
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, val = line.partition('=')
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

load_env()

# ── args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser()
parser.add_argument('--mode', required=True, choices=['outline', 'full'])
parser.add_argument('--topic', default='', help='Blog topic (required for outline mode)')
args = parser.parse_args()

if args.mode == 'outline' and not args.topic:
    print('--topic required for outline mode', file=sys.stderr)
    sys.exit(1)

GEORGE          = 'U0AETR5UK4Y'
ANTHROPIC_KEY   = os.environ.get('ANTHROPIC_API_KEY', '')
PERPLEXITY_KEY  = os.environ.get('PERPLEXITY_API_KEY', '')
SLACK_TOKEN     = os.environ['SLACK_BOT_TOKEN']
GCP_CLIENT_ID   = os.environ.get('GOOGLE_DRIVE_CLIENT_ID', '')  # gmail.com — owns Sheets, Docs, Drive
GCP_SECRET      = os.environ.get('GOOGLE_DRIVE_CLIENT_SECRET', '')
GCP_REFRESH     = os.environ.get('GOOGLE_DRIVE_REFRESH_TOKEN', '')
SHEET_ID        = os.environ.get('GOOGLE_CONTENT_SHEET_ID', '')
VERCEL_DEPLOY_HOOK = os.environ.get('VERCEL_DEPLOY_HOOK', '')
REPO_PATH       = '/home/openclaw/byebyeadmin'

today = datetime.datetime.utcnow().strftime('%Y-%m-%d')

# ── helpers ───────────────────────────────────────────────────────────────────

def post_json(url, data, headers=None):
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body,
            headers={'Content-Type': 'application/json', **(headers or {})})
        return json.loads(urllib.request.urlopen(req, timeout=60).read())
    except Exception as e:
        print(f'  POST {url[:70]}... failed: {e}', file=sys.stderr)
        return {}

def post_form(url, data):
    try:
        body = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(url, data=body,
            headers={'Content-Type': 'application/x-www-form-urlencoded'})
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception as e:
        print(f'  POST form failed: {e}', file=sys.stderr)
        return {}

def get_gcp_token():
    if not GCP_REFRESH:
        return ''
    resp = post_form('https://oauth2.googleapis.com/token', {
        'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
        'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
    })
    return resp.get('access_token', '')

def slack_dm(text):
    return post_json(
        'https://slack.com/api/chat.postMessage',
        {'channel': GEORGE, 'text': text},
        {'Authorization': f'Bearer {SLACK_TOKEN}'}
    )

def topic_to_slug(topic):
    """Convert topic to URL-safe slug."""
    slug = re.sub(r'[^a-z0-9]+', '-', topic.lower().strip())
    return slug[:50].strip('-')

# ═══════════════════════════════════════════════════════════════════
# MODE: OUTLINE
# ═══════════════════════════════════════════════════════════════════

if args.mode == 'outline':
    topic = args.topic.strip()
    print(f'OUTLINE mode for topic: "{topic}"')

    # 1. Perplexity research
    research = ''
    keywords = []
    if PERPLEXITY_KEY:
        print('Researching via Perplexity...')
        resp = post_json(
            'https://api.perplexity.ai/chat/completions',
            {
                'model': 'sonar-pro',
                'max_tokens': 800,
                'messages': [{'role': 'user', 'content':
                    f'Research this topic for a UK haulage blog post: "{topic}"\n\n'
                    f'Provide:\n'
                    f'1. 3-5 specific statistics or data points (UK-focused where possible)\n'
                    f'2. 3 strong angles or sub-topics to cover\n'
                    f'3. 5 keyword phrases people search for (format: KEYWORDS: kw1, kw2, kw3, kw4, kw5)\n'
                    f'4. Any relevant UK regulations or industry context\n'
                    f'Be specific. No generic claims.'}],
            },
            {'Authorization': f'Bearer {PERPLEXITY_KEY}'}
        )
        research = resp.get('choices', [{}])[0].get('message', {}).get('content', '')
        # Extract keywords
        kw_match = re.search(r'KEYWORDS?:\s*(.+)', research, re.IGNORECASE)
        if kw_match:
            keywords = [k.strip() for k in kw_match.group(1).split(',')][:5]
        print(f'  Research gathered ({len(research)} chars). Keywords: {keywords}')
    else:
        research = 'No Perplexity research available.'

    # 2. Read brand voice
    voice_text = ''
    try:
        with open('/home/openclaw/byebyeadmin/ops/brand-context/voice.md') as f:
            voice_text = f.read()[:1000]
    except Exception:
        pass

    # 3. Generate outline
    print('Generating outline...')
    outline_prompt = f"""Create a concise blog post outline for: "{topic}"
Target audience: UK haulage fleet managers (3-100 vehicles)
Today: {today}

Research gathered:
{research[:1500]}

Brand voice notes:
{voice_text or 'Direct, conversational. Short sentences. No buzzwords. UK English.'}

Output EXACTLY this format:
H1: [compelling title, under 65 chars, includes main keyword]
META: [150-160 char meta description with keyword]
KEYWORDS: [primary], [kw2], [kw3], [kw4], [kw5]
INTRO_HOOK: [2-sentence hook — start with a stat or bold claim]
H2_1: [section heading]
H2_2: [section heading]
H2_3: [section heading]
H2_4: [section heading]
H2_5: [section heading (optional FAQ section)]
ANGLE: [1 sentence — the unique angle this post takes]"""

    outline = call_llm(outline_prompt, max_tokens=500)
    if not outline:
        slack_dm(f':warning: Blog outline failed for "{topic}" — LLM returned no content.')
        sys.exit(1)

    print(f'Outline generated.')

    # 4. Save to Sheets Blog Queue as pending
    gcp_token = get_gcp_token()
    if gcp_token and SHEET_ID:
        print('Saving to Blog Queue sheet (pending)...')
        post_json(
            f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
            f'/values/Blog%20Queue!A:G:append?valueInputOption=USER_ENTERED',
            {'values': [[today, topic, outline[:2000], 'pending', '', topic_to_slug(topic), ','.join(keywords[:5])]]},
            {'Authorization': f'Bearer {gcp_token}'}
        )

    # 5. Post outline to Slack
    kw_line = ', '.join(f'`{k}`' for k in keywords[:5]) if keywords else 'see research below'
    msg = (
        f':memo: *Blog outline: {topic}*\n\n'
        f'*Keywords:* {kw_line}\n\n'
        f'```{outline[:1200]}```\n\n'
        f'Reply `blog ok` to write the full post and publish it.'
    )
    result = slack_dm(msg)
    if result.get('ok'):
        print('Outline posted to Slack. Waiting for blog ok.')
    else:
        print(f'Slack error: {result}', file=sys.stderr)
        sys.exit(1)
    sys.exit(0)

# ═══════════════════════════════════════════════════════════════════
# MODE: FULL
# ═══════════════════════════════════════════════════════════════════

print('FULL mode — reading pending outline from Sheets...')

gcp_token = get_gcp_token()
topic = ''
outline = ''
keywords_str = ''
slug = ''
sheet_row_idx = None

if gcp_token and SHEET_ID:
    try:
        url = (f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
               f'/values/Blog%20Queue!A:G')
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {gcp_token}'})
        resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
        rows = resp.get('values', [])
        for i, row in enumerate(reversed(rows[1:]), 1):
            status = row[3] if len(row) > 3 else ''
            if status == 'pending':
                topic        = row[1] if len(row) > 1 else ''
                outline      = row[2] if len(row) > 2 else ''
                slug         = row[5] if len(row) > 5 else topic_to_slug(topic)
                keywords_str = row[6] if len(row) > 6 else ''
                sheet_row_idx = len(rows) - i + 1  # 1-based Sheets row
                print(f'  Found pending blog: "{topic}" (row {sheet_row_idx})')
                break
    except Exception as e:
        print(f'  Could not read Blog Queue: {e}', file=sys.stderr)

if not topic:
    slack_dm(':warning: No pending blog outline found. Use `blog: [topic]` to start one.')
    sys.exit(1)

# 1. Read brand voice
voice_text = ''
try:
    with open('/home/openclaw/byebyeadmin/ops/brand-context/voice.md') as f:
        voice_text = f.read()[:1500]
except Exception:
    pass

# 2. Extract H1 + meta from outline for Perplexity research fallback
h1_title = topic
meta_desc = ''
for line in outline.splitlines():
    if line.startswith('H1:'):
        h1_title = line[3:].strip()[:90]
    elif line.startswith('META:'):
        meta_desc = line[5:].strip()[:160]

# 3. Write full post
print('Writing full blog post...')

keywords_list = [k.strip() for k in keywords_str.split(',') if k.strip()][:5]

write_prompt = f"""Write a 1,000-word SEO blog post for ByeByeAdmin (byebyeadmin.co.uk).

Topic: {topic}
H1 title: {h1_title}
Target audience: UK fleet managers and haulage operators (3-100 vehicles)
Today's date: {today}

Brand voice:
{voice_text or 'Direct, practical, no jargon. Short sentences. No buzzwords. UK English.'}

Outline to follow:
{outline[:2000]}

Target keywords (use naturally throughout): {', '.join(keywords_list) if keywords_list else 'UK haulage fleet management, admin automation'}

Post requirements:
- Exactly 5 H2 sections (the last one must be a FAQ section)
- FAQ: 7-8 Q&As in a Q: / A: format, optimised for featured snippets
- Introduction: start with a stat or bold claim — hook in first 2 sentences
- CTA in final section: link to /assessment for a "free 3-minute fleet assessment"
- Internal link opportunity: mention byebyeadmin.co.uk/assessment at least once
- Write in second person (you/your) throughout
- No em dashes anywhere (no — or &mdash;)
- No buzzwords (no leverage, utilise, game-changer, unlock, streamline)
- UK English spelling
- Short sentences: aim for under 20 words each
- Specific examples and numbers — no generic claims

Output EXACTLY:
META: [meta description 150-160 chars]
---
# [H1 title]

[full post content]"""

post_content = call_llm(write_prompt, max_tokens=3000)
if not post_content:
    slack_dm(f':warning: Blog write failed for "{topic}" — LLM returned no content. Check cron.log.')
    sys.exit(1)

print(f'Post written ({len(post_content)} chars).')

# Extract meta description
meta_line = ''
content_body = post_content
if post_content.startswith('META:'):
    lines = post_content.split('---', 1)
    meta_line = lines[0].replace('META:', '').strip()[:160]
    content_body = lines[1].strip() if len(lines) > 1 else post_content

# 4. Create Google Doc
doc_url = None
if gcp_token:
    print(f'Creating Google Doc: {h1_title[:50]}...')
    doc_resp = post_json(
        'https://docs.googleapis.com/v1/documents',
        {'title': f'Blog: {h1_title[:90]} ({today})'},
        {'Authorization': f'Bearer {gcp_token}'}
    )
    doc_id = doc_resp.get('documentId')
    if doc_id:
        post_json(
            f'https://docs.googleapis.com/v1/documents/{doc_id}:batchUpdate',
            {'requests': [{'insertText': {'location': {'index': 1}, 'text': post_content}}]},
            {'Authorization': f'Bearer {gcp_token}'}
        )
        doc_url = f'https://docs.google.com/document/d/{doc_id}/edit'
        print(f'  Doc created: {doc_url}')

# 5. Write MDX file to repo
slug_final = slug or topic_to_slug(topic)
mdx_filename = f'{today}-{slug_final}.mdx'
mdx_path = f'{REPO_PATH}/content/blog/{mdx_filename}'

# Build MDX frontmatter
keywords_yaml = json.dumps(keywords_list) if keywords_list else '[]'
mdx_content = f"""---
title: "{h1_title.replace('"', "'")}"
date: "{today}"
description: "{meta_line.replace('"', "'") if meta_line else topic[:150]}"
keywords: {keywords_yaml}
slug: "{slug_final}"
---

{content_body}
"""

try:
    with open(mdx_path, 'w') as f:
        f.write(mdx_content)
    print(f'  MDX written: {mdx_path}')

    # Git commit + push
    git_cmds = [
        ['git', '-C', REPO_PATH, 'add', f'content/blog/{mdx_filename}'],
        ['git', '-C', REPO_PATH, 'commit', '-m', f'Add blog: {h1_title[:60]}'],
        ['git', '-C', REPO_PATH, 'push'],
    ]
    for cmd in git_cmds:
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        if result.returncode != 0:
            print(f'  git cmd failed: {" ".join(cmd)} — {result.stderr.decode()[:200]}', file=sys.stderr)
            break
        else:
            print(f'  {" ".join(cmd[2:])} OK')

    # Trigger Vercel deploy hook if configured
    if VERCEL_DEPLOY_HOOK:
        try:
            req = urllib.request.Request(VERCEL_DEPLOY_HOOK,
                data=b'{}', headers={'Content-Type': 'application/json'})
            urllib.request.urlopen(req, timeout=10)
            print('  Vercel deploy hook triggered.')
        except Exception as e:
            print(f'  Vercel hook failed (non-critical): {e}', file=sys.stderr)

except Exception as e:
    print(f'  MDX write/publish failed: {e}', file=sys.stderr)

# 6. Update Sheets row status to published
if gcp_token and SHEET_ID and sheet_row_idx:
    try:
        post_json(
            f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
            f'/values/Blog%20Queue!D{sheet_row_idx}:F{sheet_row_idx}?valueInputOption=USER_ENTERED',
            {'values': [['published', doc_url or '', slug_final]]},
            {'Authorization': f'Bearer {gcp_token}'}
        )
        print('  Sheets status updated to published.')
    except Exception as e:
        print(f'  Sheets update failed: {e}', file=sys.stderr)

# 7. Trigger Copywriter audit
try:
    copywriter_path = '/home/openclaw/byebyeadmin/ops/scripts/bba-copywriter.py'
    content_id_arg = str(sheet_row_idx) if sheet_row_idx else ''
    subprocess.Popen(
        ['python3', copywriter_path, '--source', 'blog', '--content_id', content_id_arg],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    print('  Copywriter audit triggered.')
except Exception as e:
    print(f'  Could not trigger Copywriter: {e}', file=sys.stderr)

# 8. Post to Slack
blog_url = f'https://byebyeadmin.co.uk/blog/{slug_final}'
if doc_url:
    msg = (
        f':memo: *Blog published: {h1_title[:80]}*\n'
        f'Doc: {doc_url}\n'
        f'Live at: {blog_url} (after Vercel deploy)\n'
        f'MDX pushed to repo.'
    )
else:
    preview = post_content[:2000]
    msg = (
        f':memo: *Blog draft: {topic}*\n'
        f'_(Google Doc not created — content below)_\n\n'
        f'```{preview}```'
    )
    if len(post_content) > 2000:
        msg += '\n_[truncated]_'

print('Posting to Slack...')
result = slack_dm(msg)
if result.get('ok'):
    print('Blog published and link sent to Slack.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
