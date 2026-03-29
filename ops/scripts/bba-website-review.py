#!/usr/bin/env python3
"""BBA Weekly Website Review — runs on VPS at 8am UTC Sunday.
Fetches GA4 (3 reports) + Clarity. Claude Sonnet writes 6-section report. Posts to Slack.
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
GA4_PROP        = os.environ['GA4_PROPERTY_ID']
GCP_CLIENT_ID   = os.environ.get('GOOGLE_CLIENT_ID', os.environ.get('GMAIL_CLIENT_ID', ''))
GCP_SECRET      = os.environ.get('GOOGLE_CLIENT_SECRET', os.environ.get('GMAIL_CLIENT_SECRET', ''))
GCP_REFRESH     = os.environ['GOOGLE_REFRESH_TOKEN']
CLARITY_TOKEN   = os.environ['CLARITY_API_TOKEN']
CLARITY_PROJECT = os.environ.get('CLARITY_PROJECT_ID', 'r4uxcnbez8')
SHEET_ID        = os.environ.get('GOOGLE_CONTENT_SHEET_ID', '')

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

def call_llm(prompt, max_tokens=2000):
    """Try Anthropic Sonnet, fall back to Gemini if rate-limited."""
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

now     = datetime.datetime.utcnow()
today   = now.strftime('%Y-%m-%d')
d7_ago  = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
d8_ago  = (now - datetime.timedelta(days=8)).strftime('%Y-%m-%d')
d14_ago = (now - datetime.timedelta(days=14)).strftime('%Y-%m-%d')
d9_ago  = (now - datetime.timedelta(days=9)).strftime('%Y-%m-%d')

# ── GCP token ────────────────────────────────────────────────────────────────

print('Getting GCP token...')
token_resp = post_form('https://oauth2.googleapis.com/token', {
    'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
    'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
})
gcp_token = token_resp.get('access_token', '')
if not gcp_token:
    print('GCP token failed', file=sys.stderr)

# ── GA4 Report A: traffic by channel ─────────────────────────────────────────

traffic = {}
landing = {}
funnel  = {}
assess  = {}

if gcp_token:
    print('Fetching GA4 traffic report...')
    traffic = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [
            {'startDate': d7_ago, 'endDate': 'yesterday', 'name': 'this_week'},
            {'startDate': d14_ago, 'endDate': d8_ago, 'name': 'last_week'},
         ],
         'dimensions': [{'name': 'sessionDefaultChannelGroup'}],
         'metrics': [{'name': 'sessions'}, {'name': 'newUsers'}, {'name': 'engagementRate'}],
         'limit': 10},
        {'Authorization': f'Bearer {gcp_token}'}
    )

    print('Fetching GA4 landing pages...')
    landing = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [{'startDate': d7_ago, 'endDate': 'yesterday'}],
         'dimensions': [{'name': 'landingPage'}],
         'metrics': [{'name': 'sessions'}, {'name': 'bounceRate'}, {'name': 'averageSessionDuration'}],
         'orderBys': [{'metric': {'metricName': 'sessions'}, 'desc': True}],
         'limit': 8},
        {'Authorization': f'Bearer {gcp_token}'}
    )

    print('Fetching GA4 assessment funnel...')
    funnel = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [{'startDate': d7_ago, 'endDate': 'yesterday'}],
         'dimensions': [{'name': 'eventName'}],
         'metrics': [{'name': 'eventCount'}],
         'dimensionFilter': {'orGroup': {'expressions': [
             {'filter': {'fieldName': 'eventName', 'stringFilter': {'value': 'page_view'}}},
             {'filter': {'fieldName': 'eventName', 'stringFilter': {'value': 'generate_lead'}}},
             {'filter': {'fieldName': 'eventName', 'stringFilter': {'matchType': 'BEGINS_WITH', 'value': 'assessment_'}}},
         ]}},
         'limit': 20},
        {'Authorization': f'Bearer {gcp_token}'}
    )

    print('Fetching GA4 /assessment pages...')
    assess = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [
            {'startDate': d7_ago, 'endDate': 'yesterday', 'name': 'this_week'},
            {'startDate': d14_ago, 'endDate': d8_ago, 'name': 'last_week'},
         ],
         'dimensions': [{'name': 'pagePath'}, {'name': 'deviceCategory'}],
         'metrics': [{'name': 'sessions'}, {'name': 'newUsers'}],
         'dimensionFilter': {'filter': {'fieldName': 'pagePath',
             'stringFilter': {'matchType': 'BEGINS_WITH', 'value': '/assessment'}}},
         'limit': 20},
        {'Authorization': f'Bearer {gcp_token}'}
    )

# ── Clarity (max 2 calls) ─────────────────────────────────────────────────────

print('Fetching Clarity (3-day metrics)...')
clarity_dash = get(
    'https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3',
    {'Authorization': f'Bearer {CLARITY_TOKEN}'}
)
clarity_assess = {}  # page-level filtering not supported in export API

# ── Claude: 6-section report ──────────────────────────────────────────────────

print('Calling Claude Sonnet for report...')
prompt = f"""Write a BBA weekly website review for George Spain-Warner (ByeByeAdmin, UK haulage AI automation).

Output a Slack message using mrkdwn. Target under 3400 characters. Truncate recommendations section if needed.

Rules:
- No em dashes anywhere
- Use "unavailable" for missing data
- Recommendations must be specific and actionable (not generic "improve UX")
- Week ending: {today}

Structure:
*Weekly Website Review — week ending {today}*

*1. Executive Summary*
[2-3 sentences: headline number, biggest change vs last week, single top action]

*2. Traffic and Reach*
- Sessions: [n] ([+/-]% vs last week)
- New users: [n] · Returning: [n]
- Top sources: [1st] ([n]), [2nd] ([n]), [3rd] ([n])
- Engagement rate: [%]

*3. Engagement and Pages*
- Top landing pages: [page] ([n] sessions, [%] bounce), ...
- Avg session duration: [time]
- Clarity: [1-2 observations about scroll depth, rage clicks, or dead clicks]

*4. Assessment Funnel*
- /assessment views: [n] ([+/-]% vs last week)
- Completions (generate_lead): [n]
- Conversion: [views to completions %]
- [Drop-off note if identifiable]

*5. Device Split*
- Mobile: [%] · Desktop: [%]

*6. Top 3 Recommendations*
1. *[Action]* — [data point]. Expected impact: [1 sentence]
2. *[Action]* — [data point]. Expected impact: [1 sentence]
3. *[Action]* — [data point]. Expected impact: [1 sentence]

RAW DATA:
ga4_traffic={json.dumps(traffic)}
ga4_landing={json.dumps(landing)}
ga4_funnel={json.dumps(funnel)}
ga4_assessment={json.dumps(assess)}
clarity_dashboard={json.dumps(clarity_dash)}
clarity_assessment={json.dumps(clarity_assess)}"""

print('Calling LLM...')
text = call_llm(prompt, max_tokens=2000)
if not text:
    text = ':warning: Weekly website review failed — check cron.log'

# ── CRO section (second LLM call — Haiku) ─────────────────────────────────────

print('Generating CRO tasks...')
cro_raw = call_llm(
    f'Based on this GA4 and Clarity data for byebyeadmin.co.uk, output EXACTLY 3 CRO tasks.\n\n'
    f'Each task must be on ONE line in this exact pipe-delimited format:\n'
    f'PAGE | ELEMENT | CHANGE | WHY\n\n'
    f'Rules:\n- Specific pages and elements (e.g. "/assessment | CTA button | Change colour to orange | 62% bounce rate")\n'
    f'- No em dashes\n- No markdown\n- Exactly 3 lines, nothing else\n\n'
    f'RAW DATA:\n'
    f'ga4_traffic={json.dumps(traffic)}\n'
    f'ga4_landing={json.dumps(landing)}\n'
    f'ga4_funnel={json.dumps(funnel)}\n'
    f'clarity={json.dumps(clarity_dash)}',
    max_tokens=400
)

cro_tasks = []
cro_slack_lines = []
if cro_raw:
    for line in cro_raw.strip().splitlines():
        line = line.strip()
        if '|' not in line:
            continue
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 4:
            page, element, change, why = parts[0], parts[1], parts[2], parts[3]
            cro_tasks.append([today, page, element, change, why, 'todo'])
            cro_slack_lines.append(f'• *{page}*: {change}')

# Append CRO rows to Google Sheet "CRO Backlog" tab
if cro_tasks and gcp_token and SHEET_ID:
    print(f'Writing {len(cro_tasks)} CRO tasks to sheet...')
    post_json(
        f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
        f'/values/CRO%20Backlog!A:F:append?valueInputOption=USER_ENTERED',
        {'values': cro_tasks},
        {'Authorization': f'Bearer {gcp_token}'}
    )

if cro_slack_lines:
    cro_section = '\n\n*7. CRO Backlog (3 tasks added)*\n' + '\n'.join(cro_slack_lines)
    # Insert before any truncation
    text = text + cro_section

# Truncate to Slack limit
if len(text) > 3800:
    text = text[:3750] + '\n_[truncated]_'

# ── Post to Slack ─────────────────────────────────────────────────────────────

print('Posting to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': text},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print('Website review sent.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
