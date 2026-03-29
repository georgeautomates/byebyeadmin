#!/usr/bin/env python3
"""BBA Content Strategist — runs Mon 7am UTC.
Fetches YouTube performance + Buffer queue + GA4 assessment data.
Generates 5 video ideas with hooks and key points. Posts to Slack.
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

GEORGE        = 'U0AETR5UK4Y'
ANTHROPIC_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
SLACK_TOKEN   = os.environ['SLACK_BOT_TOKEN']
YT_KEY        = os.environ['YOUTUBE_API_KEY']
YT_CHANNEL    = os.environ['YOUTUBE_CHANNEL_ID']
BUFFER_TOKEN  = os.environ['BUFFER_TOKEN']
BUFFER_ORG_ID = '69b7dc8e9ab93fdee82b1f6e'
BUFFER_YT_ID  = '69b7df3d7be9f8b1715f313c'
GA4_PROP      = os.environ['GA4_PROPERTY_ID']
GCP_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', os.environ.get('GMAIL_CLIENT_ID', ''))
GCP_SECRET    = os.environ.get('GOOGLE_CLIENT_SECRET', os.environ.get('GMAIL_CLIENT_SECRET', ''))
GCP_REFRESH   = os.environ['GOOGLE_REFRESH_TOKEN']

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
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
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

def call_llm(prompt, max_tokens=1200):
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
    body = json.dumps({'model': 'gpt-4o-mini', 'max_tokens': max_tokens,
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

now      = datetime.datetime.utcnow()
today    = now.strftime('%Y-%m-%d')
d7_ago   = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
d14_ago  = (now - datetime.timedelta(days=14)).strftime('%Y-%m-%d')
d8_ago   = (now - datetime.timedelta(days=8)).strftime('%Y-%m-%d')
wc_label = now.strftime('w/c %-d %b %Y')
d7_future = (now + datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
now_str  = now.strftime('%Y-%m-%dT%H:%M:%SZ')

# ── 1. YouTube: last 10 videos + stats ────────────────────────────────────────

print('Fetching YouTube recent videos...')
search = get(
    f'https://www.googleapis.com/youtube/v3/search'
    f'?part=snippet&channelId={YT_CHANNEL}&type=video&order=date&maxResults=10&key={YT_KEY}'
)
video_ids = ','.join(
    item['id']['videoId'] for item in (search.get('items') or [])
    if item.get('id', {}).get('videoId')
)

yt_stats = {}
if video_ids:
    stats_resp = get(
        f'https://www.googleapis.com/youtube/v3/videos'
        f'?part=statistics,snippet&id={video_ids}&key={YT_KEY}'
    )
    yt_stats = stats_resp

# ── 2. Buffer YouTube queue ────────────────────────────────────────────────────

print('Fetching Buffer queue...')
buf_data = graphql('''
query($input: PostsInput!, $first: Int) {
  posts(input: $input, first: $first) {
    edges { node { id status dueAt text } }
    pageInfo { hasNextPage }
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

# ── 3. GA4: assessment page sessions 7d ───────────────────────────────────────

print('Getting GCP token...')
token_resp = post_form('https://oauth2.googleapis.com/token', {
    'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
    'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
})
gcp_token = token_resp.get('access_token', '')

ga4_assess = {}
if gcp_token:
    print('Fetching GA4 assessment data...')
    ga4_assess = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [{'startDate': d7_ago, 'endDate': today, 'name': 'this_week'},
                        {'startDate': d14_ago, 'endDate': d8_ago, 'name': 'last_week'}],
         'metrics': [{'name': 'screenPageViews'}, {'name': 'eventCount'}],
         'dimensionFilter': {'filter': {'fieldName': 'pagePath',
             'stringFilter': {'matchType': 'BEGINS_WITH', 'value': '/assessment'}}}},
        {'Authorization': f'Bearer {gcp_token}'}
    )

# ── 4. Generate ideas via LLM ─────────────────────────────────────────────────

print('Calling LLM for content ideas...')

# Summarise top performing videos
top_videos = []
for item in (yt_stats.get('items') or [])[:5]:
    title = item.get('snippet', {}).get('title', '')
    views = item.get('statistics', {}).get('viewCount', '0')
    likes = item.get('statistics', {}).get('likeCount', '0')
    top_videos.append(f'{title} ({views} views, {likes} likes)')

prompt = f"""You are a YouTube content strategist for ByeByeAdmin — AI automation for UK haulage fleets (3-100 vehicles). Target audience: fleet managers, transport directors, owner-operators.

Generate 5 video ideas for the coming week. Use the performance data to identify what resonates.

Rules:
- Titles under 60 characters
- Practical and specific (not generic "how AI helps business")
- No em dashes
- Focus on haulage pain points: driver shortages, admin overload, compliance, fuel costs, customer comms
- Each idea: title, hook (what to say in first 5 seconds), 3 bullet points, call-to-action

Format each idea as:
{'{'}n{'}'}. *{{title}}*
Hook: {{hook}}
Points: {{p1}} / {{p2}} / {{p3}}
CTA: {{cta}}

DATA:
top_performing_videos={json.dumps(top_videos)}
queue_already_scheduled={json.dumps(queue_titles)}
assessment_views_7d={json.dumps(ga4_assess)}
queue_count={queue_count}
week={wc_label}"""

ideas = call_llm(prompt, max_tokens=1200)
if not ideas:
    ideas = ':warning: Content ideas generation failed — check cron.log'

# ── 5. Post to Slack ──────────────────────────────────────────────────────────

next_scheduled = queue_titles[0] if queue_titles else 'none'
header = (
    f':clapper: *Content Plan — {wc_label}*\n'
    f'Queue: {queue_count} video{"s" if queue_count != 1 else ""} scheduled'
    + (f' (next: _{next_scheduled}_)' if next_scheduled != 'none' else '')
    + '\n\n'
)

msg = header + ideas
if len(msg) > 3800:
    msg = msg[:3750] + '\n_[truncated]_'

print('Posting to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': msg},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print('Content strategist brief sent.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
