#!/usr/bin/env python3
"""BBA Content Strategist — runs Mon 9am UTC.
Researches UK haulage trends via Perplexity, fetches YouTube performance + Buffer queue.
Generates 5 video ideas: 2 Shorts + 3 long-form, with confidence scores + IG hooks.
Checks last 10 videos to avoid repeats. Logs all ideas to Sheets. Posts plan to Slack.
"""

import os, json, sys, datetime
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

GEORGE          = 'U0AETR5UK4Y'
ANTHROPIC_KEY   = os.environ.get('ANTHROPIC_API_KEY', '')
PERPLEXITY_KEY  = os.environ.get('PERPLEXITY_API_KEY', '')
SLACK_TOKEN     = os.environ['SLACK_BOT_TOKEN']
YT_KEY          = os.environ['YOUTUBE_API_KEY']
YT_CHANNEL      = os.environ['YOUTUBE_CHANNEL_ID']
BUFFER_TOKEN    = os.environ['BUFFER_TOKEN']
BUFFER_ORG_ID   = '69b7dc8e9ab93fdee82b1f6e'
BUFFER_YT_ID    = '69b7df3d7be9f8b1715f313c'
GCP_CLIENT_ID   = os.environ.get('GOOGLE_DRIVE_CLIENT_ID', '')  # gmail.com — owns ops Sheets
GCP_SECRET      = os.environ.get('GOOGLE_DRIVE_CLIENT_SECRET', '')
GCP_REFRESH     = os.environ.get('GOOGLE_DRIVE_REFRESH_TOKEN', '')
SHEET_ID        = os.environ.get('GOOGLE_CONTENT_SHEET_ID', '')

# ── helpers ───────────────────────────────────────────────────────────────────

def get(url, headers=None):
    try:
        req = urllib.request.Request(url, headers=headers or {})
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception as e:
        print(f'  GET {url[:70]}... failed: {e}', file=sys.stderr)
        return {}

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

def graphql(query, variables=None):
    try:
        body = json.dumps({'query': query, 'variables': variables or {}}).encode()
        req = urllib.request.Request('https://graph.bufferapp.com/graphql', data=body,
            headers={'Authorization': f'Bearer {BUFFER_TOKEN}',
                     'Content-Type': 'application/json'})
        resp = json.loads(urllib.request.urlopen(req, timeout=20).read())
        if 'errors' in resp:
            print(f'  GraphQL error: {resp["errors"]}', file=sys.stderr)
        return resp.get('data', {})
    except Exception as e:
        print(f'  GraphQL request failed: {e}', file=sys.stderr)
        return {}

def call_llm(prompt, max_tokens=1400):
    """Anthropic Sonnet → Gemini → OpenAI cascade."""
    if ANTHROPIC_KEY:
        body = json.dumps({'model': 'claude-sonnet-4-6', 'max_tokens': max_tokens,
            'messages': [{'role': 'user', 'content': prompt}]}).encode()
        req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body,
            headers={'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01',
                     'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
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
            resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
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
        resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
        return resp['choices'][0]['message']['content']
    except Exception as e:
        print(f'  OpenAI failed: {e}', file=sys.stderr)
        return ''

# ── dates ─────────────────────────────────────────────────────────────────────

now       = datetime.datetime.utcnow()
today     = now.strftime('%Y-%m-%d')
d7_ago    = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
d14_ago   = (now - datetime.timedelta(days=14)).strftime('%Y-%m-%d')
d8_ago    = (now - datetime.timedelta(days=8)).strftime('%Y-%m-%d')
wc_label  = now.strftime('w/c %-d %b %Y')
d7_future = (now + datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
now_str   = now.strftime('%Y-%m-%dT%H:%M:%SZ')

# ── 1. Perplexity: UK haulage trends ─────────────────────────────────────────

trends = []
industry_context = ''
if PERPLEXITY_KEY:
    print('Researching UK haulage trends via Perplexity...')
    for query_text in [
        'UK haulage logistics fleet management news last 7 days 2025',
        'UK haulage automation compliance transport technology news last 7 days',
    ]:
        resp = post_json(
            'https://api.perplexity.ai/chat/completions',
            {
                'model': 'sonar-pro',
                'max_tokens': 600,
                'messages': [{'role': 'user', 'content':
                    f'{query_text}. Return 3 bullet points: specific topics, stats, or developments '
                    f'a UK haulage YouTube channel could make a video about. No competitor names. Be specific.'}],
            },
            {'Authorization': f'Bearer {PERPLEXITY_KEY}'}
        )
        text = resp.get('choices', [{}])[0].get('message', {}).get('content', '')
        if text:
            trends.append(text.strip()[:400])
    industry_context = '\n'.join(trends)
    print(f'  Got {len(trends)} trend responses.')
else:
    print('  No PERPLEXITY_API_KEY — skipping trend research.')
    industry_context = 'No live trend data available — use general UK haulage context.'

# ── 2. YouTube: last 10 videos + stats ────────────────────────────────────────

print('Fetching YouTube recent videos...')
search = get(
    f'https://www.googleapis.com/youtube/v3/search'
    f'?part=snippet&channelId={YT_CHANNEL}&type=video&order=date&maxResults=10&key={YT_KEY}'
)
video_ids = ','.join(
    item['id']['videoId'] for item in (search.get('items') or [])
    if item.get('id', {}).get('videoId')
)

video_data = []
if video_ids:
    stats_resp = get(
        f'https://www.googleapis.com/youtube/v3/videos'
        f'?part=statistics,snippet&id={video_ids}&key={YT_KEY}'
    )
    for item in (stats_resp.get('items') or []):
        title  = item.get('snippet', {}).get('title', '')
        views  = item.get('statistics', {}).get('viewCount', '0')
        likes  = item.get('statistics', {}).get('likeCount', '0')
        video_data.append({'title': title, 'views': int(views), 'likes': int(likes)})

existing_titles = [v['title'] for v in video_data]
top_performers  = sorted(video_data, key=lambda x: x['views'], reverse=True)[:3]
print(f'  Found {len(video_data)} recent videos. Top performer: {top_performers[0]["title"] if top_performers else "none"}')

# ── 3. Buffer YouTube queue ────────────────────────────────────────────────────

print('Fetching Buffer queue...')
buf_data = graphql('''
query($input: PostsInput!, $first: Int) {
  posts(input: $input, first: $first) {
    edges { node { id status dueAt text } }
  }
}
''', {
    'input': {
        'organizationId': BUFFER_ORG_ID,
        'filter': {
            'channelIds': [BUFFER_YT_ID],
            'status': ['scheduled'],
            'dueAt': {'start': now_str, 'end': d7_future},
        },
    },
    'first': 20,
})

queued_posts = [e['node'] for e in (buf_data.get('posts', {}).get('edges') or [])]
queue_count  = len(queued_posts)
queue_titles = [p.get('text', '')[:60] for p in queued_posts[:3]]

# ── 4. GCP token + Sheets history ─────────────────────────────────────────────

print('Getting GCP token...')
token_resp = post_form('https://oauth2.googleapis.com/token', {
    'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
    'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
})
gcp_token = token_resp.get('access_token', '')

# ── 5. Generate 5 ideas via LLM ───────────────────────────────────────────────

print('Calling LLM for content ideas...')

top_perf_str = '\n'.join(f'- {v["title"]} ({v["views"]:,} views)' for v in top_performers)
existing_str = '\n'.join(f'- {t}' for t in existing_titles) or 'none'
queue_str    = '\n'.join(f'- {t}' for t in queue_titles) or 'none'

prompt = f"""You are a YouTube content strategist for ByeByeAdmin — AI automation for UK haulage fleets (3-100 vehicles).
Target audience: fleet managers, transport directors, owner-operators.

Generate exactly 5 video ideas for {wc_label}.
Exactly 2 must be [SHORT] (YouTube Shorts format: under 60 seconds, vertical, punchy).
Remaining 3 are [LONG] (8-15 min explainers/guides).

Rules:
- Titles under 60 characters, specific not generic
- No em dashes anywhere
- No competitor names
- Focus on real haulage pain points: admin burden, compliance (DVSA, O-licence, tachographs), driver shortage, fuel costs, proof of delivery, vehicle checks, customer communication
- Each idea must be meaningfully different from existing/queued videos
- Vary CTAs across the 5 ideas (don't all end with "comment below")

Industry trends this week:
{industry_context[:600]}

Top performing videos (learn from these):
{top_perf_str or 'No data'}

Recently uploaded (DO NOT repeat similar topics):
{existing_str}

Already in Buffer queue (avoid these too):
{queue_str}

For EACH of the 5 ideas output this EXACT format (no deviations):
---
[SHORT] or [LONG]: *{{title}}*
Confidence: {{n}}/10 — {{1-line reason}}
Hook: {{what to say/show in first 5 seconds}}
Points: {{p1}} / {{p2}} / {{p3}}
CTA: {{specific call to action}}
IG: {{1-line Instagram caption hook for repurposing}}
---"""

ideas_raw = call_llm(prompt, max_tokens=1400)
if not ideas_raw:
    ideas_raw = ':warning: Content ideas generation failed — check cron.log'
    print('  LLM returned no content.', file=sys.stderr)
else:
    print(f'  Generated ideas ({len(ideas_raw)} chars).')

# ── 6. Log ideas to Sheets ────────────────────────────────────────────────────

if gcp_token and SHEET_ID and ideas_raw and 'failed' not in ideas_raw:
    print('Logging ideas to Content Ideas sheet...')
    # Parse the ideas blocks into rows
    blocks = [b.strip() for b in ideas_raw.split('---') if b.strip() and ('SHORT' in b or 'LONG' in b)]
    rows = []
    for block in blocks[:5]:
        lines = block.splitlines()
        format_tag = '[SHORT]' if '[SHORT]' in block else '[LONG]'
        title      = ''
        confidence = ''
        hook       = ''
        ig_hook    = ''
        trending_topic = trends[0][:60] if trends else ''
        for line in lines:
            line = line.strip()
            if line.startswith('[SHORT]') or line.startswith('[LONG]'):
                title = line.split('*')[1].strip() if '*' in line else line[7:].strip()
            elif line.startswith('Confidence:'):
                confidence = line[11:].strip()[:50]
            elif line.startswith('Hook:'):
                hook = line[5:].strip()[:100]
            elif line.startswith('IG:'):
                ig_hook = line[3:].strip()[:120]
        if title:
            rows.append([today, title[:80], format_tag.strip('[]'), hook[:100], confidence[:50], ig_hook[:120], trending_topic, 'idea'])
    if rows:
        post_json(
            f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
            f'/values/Content%20Ideas!A:H:append?valueInputOption=USER_ENTERED',
            {'values': rows},
            {'Authorization': f'Bearer {gcp_token}'}
        )
        print(f'  Logged {len(rows)} ideas to Content Ideas sheet.')

# ── 7. Post to Slack ──────────────────────────────────────────────────────────

trend_line = ''
if trends:
    # Extract 2 short topic phrases from first trend block
    trend_snippets = [l.strip().lstrip('•-').strip()[:60] for l in trends[0].splitlines() if l.strip().startswith(('•', '-', '*'))][:2]
    if trend_snippets:
        trend_line = 'Trends: ' + ' · '.join(trend_snippets) + '\n'

next_scheduled = queue_titles[0] if queue_titles else 'none'
header = (
    f':clapper: *Content Plan — {wc_label}*\n'
    f'{trend_line}'
    f'Queue: {queue_count} video{"s" if queue_count != 1 else ""} scheduled'
    + (f' (next: _{next_scheduled[:50]}_)' if next_scheduled != 'none' else '')
    + '\n\n'
)

msg = header + ideas_raw
if len(msg) > 3800:
    msg = msg[:3750] + '\n_[truncated — full ideas in Content Ideas sheet]_'

print('Posting to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': msg},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print('Content strategist plan sent.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
