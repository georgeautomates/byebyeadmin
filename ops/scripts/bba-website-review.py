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

print('Fetching Clarity dashboard...')
clarity_dash = get(
    f'https://www.clarity.ms/api/v1/projects/{CLARITY_PROJECT}/metrics'
    f'?startDate={d7_ago}&endDate=yesterday',
    {'Authorization': f'Bearer {CLARITY_TOKEN}'}
)

print('Fetching Clarity /assessment page...')
clarity_assess = get(
    f'https://www.clarity.ms/api/v1/projects/{CLARITY_PROJECT}/pages'
    f'?startDate={d7_ago}&endDate=yesterday&pageUrl=/assessment',
    {'Authorization': f'Bearer {CLARITY_TOKEN}'}
)

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

claude = post_json(
    'https://api.anthropic.com/v1/messages',
    {'model': 'claude-sonnet-4-6', 'max_tokens': 2000,
     'messages': [{'role': 'user', 'content': prompt}]},
    {'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01'}
)
text = claude.get('content', [{}])[0].get('text', '')
if not text:
    text = ':warning: Weekly website review failed — check cron.log'

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
