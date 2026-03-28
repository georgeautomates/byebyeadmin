#!/usr/bin/env python3
"""BBA Weekly Analytics — runs on VPS at 8:30am UTC Monday.
7-day Instantly + GA4 + YouTube delta. Reads/writes Analytics State sheet.
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
ANTHROPIC_KEY   = os.environ['ANTHROPIC_API_KEY']
SLACK_TOKEN     = os.environ['SLACK_BOT_TOKEN']
INSTANTLY_KEY          = os.environ['INSTANTLY_API_KEY']
INSTANTLY_PROXY_URL    = os.environ.get('INSTANTLY_PROXY_URL', '')
INSTANTLY_PROXY_SECRET = os.environ.get('INSTANTLY_PROXY_SECRET', '')
YT_KEY          = os.environ['YOUTUBE_API_KEY']
YT_CHANNEL      = os.environ['YOUTUBE_CHANNEL_ID']
GA4_PROP        = os.environ['GA4_PROPERTY_ID']
GCP_CLIENT_ID   = os.environ.get('GOOGLE_CLIENT_ID', os.environ.get('GMAIL_CLIENT_ID', ''))
GCP_SECRET      = os.environ.get('GOOGLE_CLIENT_SECRET', os.environ.get('GMAIL_CLIENT_SECRET', ''))
GCP_REFRESH     = os.environ['GOOGLE_REFRESH_TOKEN']
SHEET_ID        = os.environ['GOOGLE_CONTENT_SHEET_ID']

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
            h.setdefault('User-Agent', 'curl/7.88.1')  # Cloudflare blocks Python-urllib UA
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

def call_llm(prompt, max_tokens=700):
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

def fetch_instantly_stats(days=7):
    """Compute sent/open/reply counts from /emails endpoint (analytics endpoint is plan-gated)."""
    cutoff_str = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
    auth = {'Authorization': f'Bearer {INSTANTLY_KEY}'}
    counts = {1: 0, 2: 0, 3: 0}
    for ue_type in (1, 2, 3):
        starting_after = None
        while True:
            qs = f'limit=100&ue_type={ue_type}&timestamp_after={cutoff_str}'
            if starting_after:
                qs += f'&starting_after={urllib.parse.quote(starting_after)}'
            page = get(f'https://api.instantly.ai/api/v2/emails?{qs}', auth)
            items = page.get('items', [])
            counts[ue_type] += len(items)
            if not items or not page.get('next_starting_after'):
                break
            starting_after = page['next_starting_after']
            if counts[ue_type] >= 2000:
                break
    sent, opened, replied = counts[1], counts[2], counts[3]
    return {
        'sent': sent, 'opened': opened, 'replied': replied,
        'open_rate': round(opened / sent * 100, 1) if sent else 0,
        'reply_rate': round(replied / sent * 100, 1) if sent else 0,
    }

def post_form(url, data):
    try:
        body = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(url, data=body,
            headers={'Content-Type': 'application/x-www-form-urlencoded'})
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception as e:
        print(f'  POST form failed: {e}', file=sys.stderr)
        return {}

# ── dates ─────────────────────────────────────────────────────────────────────

now      = datetime.datetime.utcnow()
today    = now.strftime('%Y-%m-%d')
d7_ago   = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
d14_ago  = (now - datetime.timedelta(days=14)).strftime('%Y-%m-%d')
d8_ago   = (now - datetime.timedelta(days=8)).strftime('%Y-%m-%d')

# ── GA4 token ────────────────────────────────────────────────────────────────

print('Getting GA4 + Sheets token...')
token_resp = post_form('https://oauth2.googleapis.com/token', {
    'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
    'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
})
gcp_token = token_resp.get('access_token', '')
if not gcp_token:
    print('GCP token failed', file=sys.stderr)

# ── 1. Instantly 7-day ───────────────────────────────────────────────────────

print('Fetching Instantly 7d...')
instantly = fetch_instantly_stats(days=7)

# ── 2. YouTube current subs ───────────────────────────────────────────────────

print('Fetching YouTube...')
yt = get(
    f'https://www.googleapis.com/youtube/v3/channels'
    f'?part=statistics&id={YT_CHANNEL}&key={YT_KEY}'
)
current_subs = 0
try:
    current_subs = int(yt['items'][0]['statistics']['subscriberCount'])
except Exception:
    pass

# ── 3. GA4 7-day sessions + assessment ───────────────────────────────────────

ga4_sessions = {}
ga4_assess   = {}
if gcp_token:
    print('Fetching GA4 7d...')
    ga4_sessions = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [
            {'startDate': d7_ago, 'endDate': today, 'name': 'this_week'},
            {'startDate': d14_ago, 'endDate': d8_ago, 'name': 'last_week'},
         ],
         'metrics': [{'name': 'sessions'}, {'name': 'screenPageViews'}],
         'dimensions': [{'name': 'sessionDefaultChannelGroup'}]},
        {'Authorization': f'Bearer {gcp_token}'}
    )
    ga4_assess = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [
            {'startDate': d7_ago, 'endDate': today, 'name': 'this_week'},
            {'startDate': d14_ago, 'endDate': d8_ago, 'name': 'last_week'},
         ],
         'metrics': [{'name': 'screenPageViews'}, {'name': 'eventCount'}],
         'dimensionFilter': {'filter': {'fieldName': 'pagePath',
             'stringFilter': {'matchType': 'BEGINS_WITH', 'value': '/assessment'}}}},
        {'Authorization': f'Bearer {gcp_token}'}
    )

# ── 4. Read Analytics State sheet ─────────────────────────────────────────────

prev_subs = 0
sheet_rows = []
if gcp_token:
    print('Reading Analytics State sheet...')
    sheet = get(
        f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
        f'/values/Analytics%20State!A:E',
        {'Authorization': f'Bearer {gcp_token}'}
    )
    sheet_rows = sheet.get('values', [])
    if len(sheet_rows) > 1:
        last_row = sheet_rows[-1]
        try:
            prev_subs = int(last_row[1]) if len(last_row) > 1 else 0
        except Exception:
            pass

sub_delta = current_subs - prev_subs if prev_subs else 0

# ── 5. Append new row to Analytics State ─────────────────────────────────────

if gcp_token and current_subs:
    print('Writing Analytics State row...')
    # Sum sessions from GA4 this week
    sessions_7d = 0
    try:
        for row in ga4_sessions.get('rows', []):
            if row.get('dimensionValues', [{}])[0].get('value') != 'date_range_1':  # this_week
                pass
            sessions_7d += int(row.get('metricValues', [{'value': '0'}])[0].get('value', 0))
    except Exception:
        pass

    assess_7d = 0
    try:
        for r in ga4_assess.get('rows', []):
            dim = r.get('dimensionValues', [{}])[0].get('value', '')
            # With named dateRanges and no explicit dimensions, GA4 returns the range
            # name as the sole dimension ('this_week' / 'last_week'), not a page path
            if dim in ('this_week', 'date_range_0'):
                assess_7d += int(r.get('metricValues', [{'value': '0'}])[0].get('value', 0))
    except Exception:
        pass

    post_json(
        f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
        f'/values/Analytics%20State!A:E:append?valueInputOption=USER_ENTERED',
        {'values': [[today, str(current_subs), '', str(sessions_7d), str(assess_7d)]]},
        {'Authorization': f'Bearer {gcp_token}'}
    )

# ── 6. Claude format ──────────────────────────────────────────────────────────

print('Calling Claude...')
delta_str = f'+{sub_delta}' if sub_delta > 0 else str(sub_delta)
prompt = f"""Format a BBA weekly analytics Slack message from this raw data.

Rules:
- No em dashes
- Use "unavailable" where data is missing
- Include week-over-week deltas where possible (this_week vs last_week in GA4)
- YouTube delta: current {current_subs} subs, previous week {prev_subs} ({delta_str})
- Be concise — Slack DM, not a report

Format:
:bar_chart: *BBA Weekly Analytics — w/e {today}*

:email: Outreach (7d) — [sent] sent · [open_rate]% open · [reply_rate]% reply (instantly keys: sent, opened, replied, open_rate, reply_rate)
:globe_with_meridians: Site (7d) — X sessions ([+/-]% wow) · {assess_7d} /assessment views
:iphone: YouTube — {current_subs} subs ({delta_str} this week)
:dart: Assessment completions (7d): X (use eventCount from this_week row of ga4_assessment_wow)

RAW DATA:
instantly_7d={json.dumps(instantly)}
youtube_current_subs={current_subs}
yt_prev_subs={prev_subs}
assess_views_7d={assess_7d}
ga4_sessions_wow={json.dumps(ga4_sessions)}
ga4_assessment_wow={json.dumps(ga4_assess)}"""

print('Calling LLM...')
text = call_llm(prompt, max_tokens=700)
if not text:
    text = ':warning: Weekly analytics failed — check cron.log'

# ── 7. Post to Slack ─────────────────────────────────────────────────────────

print('Posting to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': text},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print('Weekly analytics sent.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
