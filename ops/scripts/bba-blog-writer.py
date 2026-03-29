#!/usr/bin/env python3
"""BBA Blog Writer — on-demand via Slack (`blog: [topic]`).
Usage: python3 bba-blog-writer.py --topic "your topic here"
Researches topic via Perplexity, writes 1500-2000 word SEO blog post via Claude Sonnet.
Creates a Google Doc and DMs the link to George on Slack.
"""

import os, json, sys, datetime, argparse
import urllib.request, urllib.parse

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
parser.add_argument('--topic', required=True, help='Blog topic to write about')
args = parser.parse_args()
topic = args.topic.strip()

GEORGE          = 'U0AETR5UK4Y'
ANTHROPIC_KEY   = os.environ.get('ANTHROPIC_API_KEY', '')
PERPLEXITY_KEY  = os.environ.get('PERPLEXITY_API_KEY', '')
SLACK_TOKEN     = os.environ['SLACK_BOT_TOKEN']
GCP_CLIENT_ID   = os.environ.get('GOOGLE_CLIENT_ID', os.environ.get('GMAIL_CLIENT_ID', ''))
GCP_SECRET      = os.environ.get('GOOGLE_CLIENT_SECRET', os.environ.get('GMAIL_CLIENT_SECRET', ''))
GCP_REFRESH     = os.environ.get('GOOGLE_REFRESH_TOKEN', '')

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

def slack_dm(text):
    return post_json(
        'https://slack.com/api/chat.postMessage',
        {'channel': GEORGE, 'text': text},
        {'Authorization': f'Bearer {SLACK_TOKEN}'}
    )

def call_llm(prompt, max_tokens=3000):
    """Anthropic Sonnet → Gemini → OpenAI cascade."""
    if ANTHROPIC_KEY:
        body = json.dumps({'model': 'claude-sonnet-4-6', 'max_tokens': max_tokens,
            'messages': [{'role': 'user', 'content': prompt}]}).encode()
        req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body,
            headers={'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01',
                     'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=90).read())
            text = resp.get('content', [{}])[0].get('text', '')
            if text:
                return text
        except Exception as e:
            print(f'  Anthropic failed: {e} — trying Gemini', file=sys.stderr)
    gemini_key = os.environ.get('GEMINI_API_KEY', '')
    if gemini_key:
        body = json.dumps({'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'maxOutputTokens': max_tokens}}).encode()
        gurl = (f'https://generativelanguage.googleapis.com/v1beta/models/'
                f'gemini-2.0-flash:generateContent?key={gemini_key}')
        req = urllib.request.Request(gurl, data=body, headers={'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=90).read())
            return resp['candidates'][0]['content']['parts'][0]['text']
        except Exception as e:
            print(f'  Gemini failed: {e} — trying OpenAI', file=sys.stderr)
    openai_key = os.environ.get('OPENAI_API_KEY', '')
    if not openai_key:
        return ''
    body = json.dumps({'model': 'gpt-4o', 'max_tokens': max_tokens,
        'messages': [{'role': 'user', 'content': prompt}]}).encode()
    req = urllib.request.Request('https://api.openai.com/v1/chat/completions', data=body,
        headers={'Authorization': f'Bearer {openai_key}', 'Content-Type': 'application/json'})
    try:
        resp = json.loads(urllib.request.urlopen(req, timeout=90).read())
        return resp['choices'][0]['message']['content']
    except Exception as e:
        print(f'  OpenAI failed: {e}', file=sys.stderr)
        return ''

today = datetime.datetime.utcnow().strftime('%Y-%m-%d')

# ── 1. Research via Perplexity ────────────────────────────────────────────────

research = ''
if PERPLEXITY_KEY:
    print(f'Researching "{topic}" via Perplexity...')
    research_resp = post_json(
        'https://api.perplexity.ai/chat/completions',
        {
            'model': 'sonar-pro',
            'max_tokens': 1500,
            'messages': [{
                'role': 'user',
                'content': (
                    f'Research this topic for a blog post aimed at UK haulage fleet managers: "{topic}"\n\n'
                    f'Provide:\n'
                    f'1. Key statistics and data points (with sources where possible)\n'
                    f'2. Main pain points fleet managers face related to this topic\n'
                    f'3. Current industry context (what is happening in UK haulage right now)\n'
                    f'4. 3-5 specific angles or sub-topics worth covering\n'
                    f'5. Any relevant regulations, legislation, or industry standards (UK-specific)\n\n'
                    f'Be specific and factual. Avoid generic claims.'
                )
            }]
        },
        {'Authorization': f'Bearer {PERPLEXITY_KEY}'}
    )
    research = research_resp.get('choices', [{}])[0].get('message', {}).get('content', '')
    if research:
        print(f'  Research gathered ({len(research)} chars).')
    else:
        print('  Perplexity returned no content — continuing without research.', file=sys.stderr)
else:
    print('  No PERPLEXITY_API_KEY — skipping research phase.', file=sys.stderr)

# ── 2. Read brand voice ───────────────────────────────────────────────────────

voice_context = ''
voice_path = '/home/openclaw/byebyeadmin/ops/brand-context/voice.md'
try:
    with open(voice_path) as f:
        voice_context = f.read()[:2000]
except Exception:
    print(f'  Could not read {voice_path} — proceeding without voice context.', file=sys.stderr)

# ── 3. Write blog post ────────────────────────────────────────────────────────

print('Calling LLM to write blog post...')

prompt = f"""Write a 1,500-2,000 word SEO blog post for ByeByeAdmin (byebyeadmin.co.uk).

Topic: {topic}
Target audience: UK fleet managers and haulage operators (3-100 vehicles)
Today's date: {today}

Brand voice guidelines:
{voice_context if voice_context else "Direct, practical, no jargon. Short sentences. No buzzwords."}

Research gathered:
{research if research else "No research available — use your knowledge of UK haulage industry."}

Requirements:
- H1 title (compelling, under 65 chars, includes main keyword)
- Meta description (150-160 chars, includes keyword, drives click-through)
- Introduction (hook in first 2 sentences — stat or bold claim)
- 4-6 H2 sections with practical content
- Include specific examples, numbers, and UK haulage context
- CTA in final section pointing to the assessment at byebyeadmin.co.uk/assessment
- No em dashes anywhere
- No buzzwords (no "leverage", "utilise", "game-changer", "unlock")
- Write in second person (you/your) throughout
- UK English spelling

Output the full post. Start with:
META: [meta description]
---
[Full post starting with H1]"""

post_content = call_llm(prompt, max_tokens=3000)
if not post_content:
    slack_dm(f':warning: Blog writer failed for topic: "{topic}" — LLM returned no content. Check cron.log.')
    sys.exit(1)

print(f'Blog post written ({len(post_content)} chars).')

# ── 4. Create Google Doc ──────────────────────────────────────────────────────

doc_url = None
if GCP_REFRESH:
    print('Getting GCP token...')
    token_resp = post_form('https://oauth2.googleapis.com/token', {
        'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
        'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
    })
    gcp_token = token_resp.get('access_token', '')

    if gcp_token:
        # Extract title from H1
        title = topic
        for line in post_content.splitlines():
            line = line.strip().lstrip('#').strip()
            if line and not line.startswith('META:') and not line.startswith('---'):
                title = line[:100]
                break

        print(f'Creating Google Doc: {title[:50]}...')
        doc_resp = post_json(
            'https://docs.googleapis.com/v1/documents',
            {'title': f'Blog: {title[:90]} ({today})'},
            {'Authorization': f'Bearer {gcp_token}'}
        )
        doc_id = doc_resp.get('documentId')
        if doc_id:
            # Insert content
            post_json(
                f'https://docs.googleapis.com/v1/documents/{doc_id}:batchUpdate',
                {'requests': [{'insertText': {'location': {'index': 1}, 'text': post_content}}]},
                {'Authorization': f'Bearer {gcp_token}'}
            )
            doc_url = f'https://docs.google.com/document/d/{doc_id}/edit'
            print(f'  Doc created: {doc_url}')
        else:
            print('  Doc creation failed — will post to Slack instead.', file=sys.stderr)

# ── 5. Post to Slack ──────────────────────────────────────────────────────────

if doc_url:
    msg = f':memo: *Blog draft ready:* {title[:80]}\n{doc_url}'
else:
    # Fallback: post truncated content to Slack
    preview = post_content[:2500]
    msg = f':memo: *Blog draft: {topic}*\n_(No Google Doc — content below)_\n\n```{preview}```'
    if len(post_content) > 2500:
        msg += '\n_[truncated — run script again for full content]_'

print('Posting to Slack...')
result = slack_dm(msg)
if result.get('ok'):
    print('Blog draft link sent to Slack.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
