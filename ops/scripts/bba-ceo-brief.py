#!/usr/bin/env python3
"""BBA CEO Weekly Brief — runs Sun 10am UTC.
Synthesises all week's data: Instantly + YouTube + GA4 + Buffer queue.
Claude Sonnet writes a 300-word strategic brief. Posts to Slack.
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

GEORGE                 = 'U0AETR5UK4Y'
ANTHROPIC_KEY          = os.environ.get('ANTHROPIC_API_KEY', '')
SLACK_TOKEN            = os.environ['SLACK_BOT_TOKEN']
INSTANTLY_KEY          = os.environ['INSTANTLY_API_KEY']
INSTANTLY_PROXY_URL    = os.environ.get('INSTANTLY_PROXY_URL', '')
INSTANTLY_PROXY_SECRET = os.environ.get('INSTANTLY_PROXY_SECRET', '')
YT_KEY                 = os.environ['YOUTUBE_API_KEY']
YT_CHANNEL             = os.environ['YOUTUBE_CHANNEL_ID']
GA4_PROP               = os.environ['GA4_PROPERTY_ID']
GCP_CLIENT_ID          = os.environ.get('GOOGLE_CLIENT_ID', os.environ.get('GMAIL_CLIENT_ID', ''))
GCP_SECRET             = os.environ.get('GOOGLE_CLIENT_SECRET', os.environ.get('GMAIL_CLIENT_SECRET', ''))
GCP_REFRESH            = os.environ['GOOGLE_REFRESH_TOKEN']
SHEET_ID               = os.environ.get('GOOGLE_CONTENT_SHEET_ID', '')
BUFFER_TOKEN           = os.environ['BUFFER_TOKEN']
BUFFER_ORG_ID          = '69b7dc8e9ab93fdee82b1f6e'
BUFFER_YT_ID           = '69b7df3d7be9f8b1715f313c'

# ── helpers ───────────────────────────────────────────────────────────────────

def _maybe_proxy(url):
    if INSTANTLY_PROXY_URL and 'api.instantly.ai' in url:
        return url.replace('https://api.instantly.ai', INSTANTLY_PROXY_URL.rstrip('/'))
    return url

def get(url, headers=None):
    try:
        proxied = _maybe_proxy(url)
        h = dict(headers or {})
        if proxied != url and INSTANTLY_PROXY_SECRET:
            h['X-Proxy-Secret'] = INSTANTLY_PROXY_SECRET
            h.setdefault('User-Agent', 'curl/7.88.1')
        req = urllib.request.Request(proxied, headers=h)
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
        return resp.get('data', {})
    except Exception as e:
        print(f'  GraphQL failed: {e}', file=sys.stderr)
        return {}

def call_llm(prompt, max_tokens=700):
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
d7_future = (now + datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
now_str  = now.strftime('%Y-%m-%dT%H:%M:%SZ')

# ── 1. Instantly 7d stats ─────────────────────────────────────────────────────

print('Fetching Instantly 7d stats...')
auth   = {'Authorization': f'Bearer {INSTANTLY_KEY}'}
counts = {1: 0, 2: 0, 3: 0}
failed = set()
cutoff = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')

for ue_type in (1, 2, 3):
    starting_after = None
    while True:
        qs = f'limit=100&ue_type={ue_type}&timestamp_after={urllib.parse.quote(cutoff)}'
        if starting_after:
            qs += f'&starting_after={urllib.parse.quote(starting_after)}'
        page = get(f'https://api.instantly.ai/api/v2/emails?{qs}', auth)
        if not page:
            failed.add(ue_type)
            break
        items = page.get('items', [])
        counts[ue_type] += len(items)
        if not items or not page.get('next_starting_after'):
            break
        starting_after = page['next_starting_after']
        if counts[ue_type] >= 2000:
            break

sent    = counts[1] if 1 not in failed else None
opened  = counts[2] if 2 not in failed else None
replied = counts[3] if 3 not in failed else None
reply_rate = round(replied / sent * 100, 1) if (sent and replied is not None) else None
open_rate  = round(opened / sent * 100, 1) if (sent and opened is not None) else None

# ── 2. YouTube ────────────────────────────────────────────────────────────────

print('Fetching YouTube...')
yt = get(f'https://www.googleapis.com/youtube/v3/channels?part=statistics&id={YT_CHANNEL}&key={YT_KEY}')
current_subs = 0
try:
    current_subs = int((yt or {}).get('items', [{}])[0].get('statistics', {}).get('subscriberCount', 0))
except Exception:
    pass

# ── 3. GCP token + GA4 ────────────────────────────────────────────────────────

print('Getting GCP token...')
token_resp = post_form('https://oauth2.googleapis.com/token', {
    'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
    'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
})
gcp_token = token_resp.get('access_token', '')

ga4_sessions   = {}
ga4_completions = 0
prev_subs       = 0

if gcp_token:
    print('Fetching GA4 sessions...')
    ga4_sessions = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [{'startDate': d7_ago, 'endDate': today, 'name': 'this_week'},
                        {'startDate': d14_ago, 'endDate': d8_ago, 'name': 'last_week'}],
         'metrics': [{'name': 'sessions'}],
         'dimensions': [{'name': 'sessionDefaultChannelGroup'}]},
        {'Authorization': f'Bearer {gcp_token}'}
    )

    print('Fetching GA4 assessment completions...')
    completions_resp = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [{'startDate': d7_ago, 'endDate': today}],
         'metrics': [{'name': 'eventCount'}],
         'dimensionFilter': {'filter': {'fieldName': 'eventName',
             'stringFilter': {'value': 'generate_lead'}}}},
        {'Authorization': f'Bearer {gcp_token}'}
    )
    try:
        ga4_completions = sum(
            int(r['metricValues'][0]['value'])
            for r in completions_resp.get('rows', [])
        )
    except Exception:
        pass

    # Read Analytics State for prev subs
    if SHEET_ID:
        sheet = get(
            f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/Analytics%20State!A:B',
            {'Authorization': f'Bearer {gcp_token}'}
        )
        rows = (sheet or {}).get('values', [])
        if len(rows) > 1:
            try:
                prev_subs = int(rows[-1][1])
            except Exception:
                pass

# Tally sessions
sessions_7d = 0
sessions_prev_7d = 0
try:
    for row in ga4_sessions.get('rows', []):
        dim = row.get('dimensionValues', [{}])[0].get('value', '')
        val = int(row.get('metricValues', [{'value': '0'}])[0].get('value', 0))
        if dim != 'date_range_1':
            sessions_7d += val
        else:
            sessions_prev_7d += val
except Exception:
    pass

sessions_wow = ''
if sessions_prev_7d:
    pct = round((sessions_7d - sessions_prev_7d) / sessions_prev_7d * 100)
    sessions_wow = f' ({("+" if pct >= 0 else "")}{pct}% wow)'

sub_delta = current_subs - prev_subs if prev_subs else 0

# ── 4. Buffer queue count ─────────────────────────────────────────────────────

print('Fetching Buffer queue...')
buf_data = graphql('''
query($input: PostsInput!, $first: Int) {
  posts(input: $input, first: $first) {
    edges { node { id } }
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
queue_count = len((buf_data.get('posts', {}).get('edges') or []))

# ── 5. Format brief via LLM ───────────────────────────────────────────────────

print('Calling LLM for CEO brief...')

sub_delta_str = f'+{sub_delta}' if sub_delta > 0 else str(sub_delta)

prompt = f"""Write a BBA CEO Weekly Brief for George Spain-Warner (ByeByeAdmin, AI automation for UK haulage fleets).

Rules:
- No em dashes
- Concise — this is a Slack DM, not a report
- Be direct and honest about what the data shows
- Use "unavailable" where data is null/missing
- The "Decision This Week" must be specific and actionable, not generic advice

Format exactly:
:briefcase: *BBA CEO Brief — week ending {today}*

*Business Health*
Outreach: [sent] sent · [open_rate]% open · [reply_rate]% reply
Site: [sessions] sessions[wow] · [completions] assessment completions
Content: [subs] YT subs ({sub_delta_str} this week) · [queue] queued

*What's Working*
[2 sentences on the strongest signal this week]

*What Needs Attention*
[2 sentences on the weakest area or an emerging risk]

*Decision This Week*
[One specific thing George should decide or act on in the next 7 days]

RAW DATA:
instantly_7d={json.dumps({'sent': sent, 'opened': opened, 'replied': replied, 'open_rate': open_rate, 'reply_rate': reply_rate})}
ga4_sessions_7d={sessions_7d}
ga4_sessions_wow_pct={sessions_wow}
assessment_completions_7d={ga4_completions}
youtube_subs={current_subs}
yt_sub_delta={sub_delta_str}
buffer_queue_7d={queue_count}"""

text = call_llm(prompt, max_tokens=700)
if not text:
    text = ':warning: CEO brief failed — check cron.log'

if len(text) > 3800:
    text = text[:3750] + '\n_[truncated]_'

# ── 6. Post to Slack ──────────────────────────────────────────────────────────

print('Posting CEO brief to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': text},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print('CEO brief sent.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
