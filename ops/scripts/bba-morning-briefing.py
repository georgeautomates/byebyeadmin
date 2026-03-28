#!/usr/bin/env python3
"""BBA Morning Briefing — runs on VPS at 8am UTC Mon-Fri.
Fetches Instantly + YouTube + GA4 + Clarity, calls Claude to format, posts to Slack.
"""

import os, json, sys, datetime
import urllib.request, urllib.parse, urllib.error

# ── env ──────────────────────────────────────────────────────────────────────

def load_env():
    path = '/home/openclaw/byebyeadmin/ops/.env'
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, val = line.partition('=')
                val = val.strip().strip('"').strip("'")
                os.environ.setdefault(key.strip(), val)

load_env()

GEORGE          = 'U0AETR5UK4Y'
ANTHROPIC_KEY   = os.environ['ANTHROPIC_API_KEY']
SLACK_TOKEN     = os.environ['SLACK_BOT_TOKEN']
INSTANTLY_KEY   = os.environ['INSTANTLY_API_KEY']
YT_KEY          = os.environ['YOUTUBE_API_KEY']
YT_CHANNEL      = os.environ['YOUTUBE_CHANNEL_ID']
GA4_PROP        = os.environ['GA4_PROPERTY_ID']
GCP_CLIENT_ID   = os.environ.get('GOOGLE_CLIENT_ID', os.environ.get('GMAIL_CLIENT_ID', ''))
GCP_SECRET      = os.environ.get('GOOGLE_CLIENT_SECRET', os.environ.get('GMAIL_CLIENT_SECRET', ''))
GCP_REFRESH     = os.environ['GOOGLE_REFRESH_TOKEN']
CLARITY_TOKEN   = os.environ['CLARITY_API_TOKEN']
CLARITY_PROJECT = os.environ.get('CLARITY_PROJECT_ID', 'r4uxcnbez8')

# ── http helpers ──────────────────────────────────────────────────────────────

def get(url, headers=None):
    try:
        req = urllib.request.Request(url, headers=headers or {})
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception as e:
        print(f'  GET {url[:60]}... failed: {e}', file=sys.stderr)
        return {}

def post_json(url, data, headers=None):
    try:
        body = json.dumps(data).encode()
        h = {'Content-Type': 'application/json', **(headers or {})}
        req = urllib.request.Request(url, data=body, headers=h)
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception as e:
        print(f'  POST {url[:60]}... failed: {e}', file=sys.stderr)
        return {}

def call_llm(prompt, max_tokens=600):
    """Try Anthropic, fall back to Gemini if rate-limited."""
    body = json.dumps({'model': 'claude-haiku-4-5-20251001', 'max_tokens': max_tokens,
        'messages': [{'role': 'user', 'content': prompt}]}).encode()
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body,
        headers={'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01',
                 'Content-Type': 'application/json'})
    try:
        resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
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
            resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
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
        resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
        return resp['choices'][0]['message']['content']
    except Exception as e:
        print(f'  OpenAI failed: {e}', file=sys.stderr)
        return ''

def post_form(url, data):
    try:
        body = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(url, data=body,
            headers={'Content-Type': 'application/x-www-form-urlencoded'})
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception as e:
        print(f'  POST form {url[:60]}... failed: {e}', file=sys.stderr)
        return {}

# ── dates ─────────────────────────────────────────────────────────────────────

now       = datetime.datetime.utcnow()
yesterday = now - datetime.timedelta(days=1)
start8    = now - datetime.timedelta(days=8)
today_str     = now.strftime('%Y-%m-%d')
yesterday_str = yesterday.strftime('%Y-%m-%d')
start8_str    = start8.strftime('%Y-%m-%d')
today_display = now.strftime('%a, %d %b %Y')

# ── 1. Instantly ──────────────────────────────────────────────────────────────

print('Fetching Instantly...')
instantly = get(
    f'https://api.instantly.ai/api/v2/analytics/campaign/summary'
    f'?start_date={yesterday_str}&end_date={today_str}&limit=10',
    {'Authorization': f'Bearer {INSTANTLY_KEY}'}
)

# ── 2. YouTube ────────────────────────────────────────────────────────────────

print('Fetching YouTube...')
yt = get(
    f'https://www.googleapis.com/youtube/v3/channels'
    f'?part=statistics&id={YT_CHANNEL}&key={YT_KEY}'
)

# ── 3. GA4 ────────────────────────────────────────────────────────────────────

print('Fetching GA4...')
ga4_token_resp = post_form('https://oauth2.googleapis.com/token', {
    'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
    'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
})
ga4_token = ga4_token_resp.get('access_token', '')

ga4_sessions = {}
ga4_assess   = {}
if ga4_token:
    ga4_sessions = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [{'startDate': yesterday_str, 'endDate': yesterday_str}],
         'metrics': [{'name': 'sessions'}, {'name': 'screenPageViews'}],
         'dimensions': [{'name': 'sessionDefaultChannelGroup'}]},
        {'Authorization': f'Bearer {ga4_token}'}
    )
    ga4_assess = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [{'startDate': yesterday_str, 'endDate': yesterday_str}],
         'metrics': [{'name': 'screenPageViews'}],
         'dimensionFilter': {'filter': {'fieldName': 'pagePath',
             'stringFilter': {'matchType': 'BEGINS_WITH', 'value': '/assessment'}}}},
        {'Authorization': f'Bearer {ga4_token}'}
    )
else:
    print('  GA4 token failed — skipping GA4', file=sys.stderr)

# ── 4. Clarity ────────────────────────────────────────────────────────────────

print('Fetching Clarity...')
clarity = get(
    f'https://www.clarity.ms/api/v1/projects/{CLARITY_PROJECT}/metrics'
    f'?startDate={start8_str}&endDate={yesterday_str}',
    {'Authorization': f'Bearer {CLARITY_TOKEN}'}
)

# ── 5. Claude format ──────────────────────────────────────────────────────────

print('Calling Claude...')
prompt = f"""Format a BBA morning briefing Slack message from this raw API data.

Rules:
- No em dashes anywhere
- Use "unavailable" for any section where data is missing or empty
- Instantly: sends = new_sent or total_sent, opens/replies from aggregated stats
- GA4 sessions: sum all sessions across channel groups from ga4_sessions rows
- Assessment views: from ga4_assessment total screenPageViews
- YouTube: items[0].statistics.subscriberCount
- Clarity tip: 2 short actionable sentences based on the metrics data, or "unavailable"

Output format (use Slack mrkdwn, no markdown headers):
:sunrise: *BBA Morning Briefing — {today_display}*

:email: Outreach — X sent · X opens · X replies · X% open · X% reply
:globe_with_meridians: Site (yesterday) — X sessions · X /assessment views
:iphone: YouTube — X subscribers
:bulb: [Clarity tip or "unavailable"]

RAW DATA:
instantly={json.dumps(instantly)}
youtube={json.dumps(yt)}
ga4_sessions={json.dumps(ga4_sessions)}
ga4_assessment={json.dumps(ga4_assess)}
clarity={json.dumps(clarity)}"""

print('Calling LLM...')
text = call_llm(prompt, max_tokens=600)
if not text:
    text = ':warning: Morning briefing failed — LLM returned no content. Check cron.log.'
    print('LLM returned no content', file=sys.stderr)

# ── 6. Post to Slack ─────────────────────────────────────────────────────────

print('Posting to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': text},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print('Morning briefing sent.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
