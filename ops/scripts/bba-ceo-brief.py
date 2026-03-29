#!/usr/bin/env python3
"""BBA CEO Weekly Brief — runs Sun 11am UTC.
Bullet-format synthesis: Instantly + YouTube + GA4 + Buffer + Sheets + Paperclip.
Perplexity competitor/industry watch. Decision log continuity. Agent health.
Hot leads count from Sheets. Monthly burn from Paperclip. Momentum score 1-10.
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
PERPLEXITY_KEY         = os.environ.get('PERPLEXITY_API_KEY', '')
SLACK_TOKEN            = os.environ['SLACK_BOT_TOKEN']
INSTANTLY_KEY          = os.environ['INSTANTLY_API_KEY']
INSTANTLY_PROXY_URL    = os.environ.get('INSTANTLY_PROXY_URL', '')
INSTANTLY_PROXY_SECRET = os.environ.get('INSTANTLY_PROXY_SECRET', '')
YT_KEY                 = os.environ['YOUTUBE_API_KEY']
YT_CHANNEL             = os.environ['YOUTUBE_CHANNEL_ID']
GA4_PROP               = os.environ['GA4_PROPERTY_ID']
GCP_CLIENT_ID          = os.environ.get('GOOGLE_DRIVE_CLIENT_ID', '')  # gmail.com — owns ops Sheets
GCP_SECRET             = os.environ.get('GOOGLE_DRIVE_CLIENT_SECRET', '')
GCP_REFRESH            = os.environ.get('GOOGLE_DRIVE_REFRESH_TOKEN', '')
SHEET_ID               = os.environ.get('GOOGLE_CONTENT_SHEET_ID', '')
BUFFER_TOKEN           = os.environ['BUFFER_TOKEN']
BUFFER_ORG_ID          = '69b7dc8e9ab93fdee82b1f6e'
BUFFER_YT_ID           = '69b7df3d7be9f8b1715f313c'
PAPERCLIP_URL          = os.environ.get('PAPERCLIP_API_URL', 'http://127.0.0.1:3100')
PAPERCLIP_COMPANY_ID   = os.environ.get('PAPERCLIP_COMPANY_ID', '4290ad8d-1323-4039-af22-68ec03431707')

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
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
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

def call_llm(prompt, max_tokens=800):
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
d7_future = (now + datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
now_str   = now.strftime('%Y-%m-%dT%H:%M:%SZ')
cutoff_7d = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
week_label = (now - datetime.timedelta(days=now.weekday() + 1)).strftime('%-d %b %Y')

# ── GCP token ─────────────────────────────────────────────────────────────────

print('Getting GCP token...')
token_resp = post_form('https://oauth2.googleapis.com/token', {
    'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
    'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
})
gcp_token = token_resp.get('access_token', '')

# ── 1. Perplexity competitor/industry watch ───────────────────────────────────

competitor_bullets = []
if PERPLEXITY_KEY:
    print('Running Perplexity competitor/industry watch...')
    resp = post_json(
        'https://api.perplexity.ai/chat/completions',
        {
            'model': 'sonar-pro',
            'max_tokens': 400,
            'messages': [{'role': 'user', 'content':
                'What happened in UK haulage, logistics fleet management, and transport AI automation this week? '
                'Give exactly 2 specific bullet points — industry news, regulations, technology, or market movements. '
                'No competitor names. Be specific with numbers or quotes where available. '
                'Format: • [bullet 1]\n• [bullet 2]'}],
        },
        {'Authorization': f'Bearer {PERPLEXITY_KEY}'}
    )
    text = resp.get('choices', [{}])[0].get('message', {}).get('content', '')
    if text:
        competitor_bullets = [l.strip().lstrip('•').strip() for l in text.splitlines() if l.strip().startswith('•')][:2]
        print(f'  Got {len(competitor_bullets)} industry bullets.')
else:
    print('  No PERPLEXITY_API_KEY — skipping competitor watch.')

# ── 2. Decision log: read last CEO brief from Sheets ─────────────────────────

last_decision = ''
if gcp_token and SHEET_ID:
    try:
        url = (f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
               f'/values/CEO%20Briefs!A:G')
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {gcp_token}'})
        resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
        rows = resp.get('values', [])
        if len(rows) > 1:
            last_row = rows[-1]
            last_decision = last_row[5] if len(last_row) > 5 else ''
            print(f'  Last week\'s decision: "{last_decision[:80]}"')
    except Exception as e:
        print(f'  Could not read CEO Briefs sheet: {e}', file=sys.stderr)

# ── 3. Agent health from Paperclip ────────────────────────────────────────────

agent_health = {}
print('Checking Paperclip agent health...')
try:
    issues_resp = get(f'{PAPERCLIP_URL}/api/companies/{PAPERCLIP_COMPANY_ID}/issues?status=cancelled&limit=50')
    if issues_resp and isinstance(issues_resp, list):
        issues = issues_resp
    elif issues_resp and isinstance(issues_resp, dict):
        issues = issues_resp.get('items', issues_resp.get('data', []))
    else:
        issues = []
    # Count failures per agent in last 7 days (use createdAt if available)
    for issue in issues:
        agent_id = issue.get('assigneeAgentId', issue.get('agentId', ''))
        agent_name = issue.get('assigneeAgent', {}).get('name', '') if isinstance(issue.get('assigneeAgent'), dict) else agent_id[:8]
        if agent_name:
            agent_health[agent_name] = agent_health.get(agent_name, 0) + 1
    print(f'  Agent health: {agent_health}')
except Exception as e:
    print(f'  Paperclip health check failed: {e}', file=sys.stderr)

# Budget burn from Paperclip
budget_burn_pence = 0
try:
    agents_resp = get(f'{PAPERCLIP_URL}/api/companies/{PAPERCLIP_COMPANY_ID}/agents')
    agents_list = agents_resp if isinstance(agents_resp, list) else agents_resp.get('items', agents_resp.get('data', []))
    for agent in (agents_list or []):
        budget_burn_pence += agent.get('budgetSpentMonthlyCents', 0)
    print(f'  Monthly burn: {budget_burn_pence/100:.2f} GBP')
except Exception as e:
    print(f'  Paperclip budget fetch failed: {e}', file=sys.stderr)

# ── 4. Hot leads count from Sheets (last 7 days) ─────────────────────────────

hot_lead_count = 0
if gcp_token and SHEET_ID:
    try:
        url = (f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
               f'/values/Hot%20Leads!A:I')
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {gcp_token}'})
        resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
        rows = resp.get('values', [])
        cutoff_date = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
        for row in rows[1:]:
            row_date = row[0][:10] if row and row[0] else ''
            if row_date >= cutoff_date:
                hot_lead_count += 1
        print(f'  Hot leads this week: {hot_lead_count}')
    except Exception as e:
        print(f'  Could not count hot leads: {e}', file=sys.stderr)

# ── 5. Instantly 7d stats ─────────────────────────────────────────────────────

print('Fetching Instantly 7d stats...')
auth   = {'Authorization': f'Bearer {INSTANTLY_KEY}'}
counts = {1: 0, 2: 0, 3: 0}

for ue_type in (1, 2, 3):
    starting_after = None
    while True:
        qs = f'limit=100&ue_type={ue_type}&timestamp_after={urllib.parse.quote(cutoff_7d)}'
        if starting_after:
            qs += f'&starting_after={urllib.parse.quote(starting_after)}'
        page = get(f'https://api.instantly.ai/api/v2/emails?{qs}', auth)
        if not page:
            break
        items = page.get('items', [])
        counts[ue_type] += len(items)
        if not items or not page.get('next_starting_after'):
            break
        starting_after = page['next_starting_after']
        if counts[ue_type] >= 2000:
            break

sent_7d  = counts[1]
opens_7d = counts[2]
reply_7d = counts[3]
open_rate  = round(opens_7d / sent_7d * 100, 1) if sent_7d else 0
reply_rate = round(reply_7d / sent_7d * 100, 1) if sent_7d else 0
print(f'  Instantly: {sent_7d} sent, {opens_7d} opens ({open_rate}%), {reply_7d} replies ({reply_rate}%)')

# ── 6. YouTube current stats ───────────────────────────────────────────────────

print('Fetching YouTube stats...')
yt_channel_resp = get(
    f'https://www.googleapis.com/youtube/v3/channels'
    f'?part=statistics,snippet&id={YT_CHANNEL}&key={YT_KEY}'
)
channel_data = (yt_channel_resp.get('items') or [{}])[0]
yt_subs = int(channel_data.get('statistics', {}).get('subscriberCount', 0))
yt_views_total = int(channel_data.get('statistics', {}).get('viewCount', 0))

# Last video views
yt_last_views = 0
yt_last_title = ''
search = get(
    f'https://www.googleapis.com/youtube/v3/search'
    f'?part=snippet&channelId={YT_CHANNEL}&type=video&order=date&maxResults=1&key={YT_KEY}'
)
last_video_id = ''
for item in (search.get('items') or []):
    last_video_id = item.get('id', {}).get('videoId', '')
    yt_last_title = item.get('snippet', {}).get('title', '')[:50]
if last_video_id:
    vstats = get(f'https://www.googleapis.com/youtube/v3/videos?part=statistics&id={last_video_id}&key={YT_KEY}')
    for item in (vstats.get('items') or []):
        yt_last_views = int(item.get('statistics', {}).get('viewCount', 0))
print(f'  YouTube: {yt_subs:,} subs, last video {yt_last_views:,} views')

# ── 7. GA4: sessions + assessment completions ────────────────────────────────

print('Fetching GA4 data...')
ga4_sessions_7d = 0
ga4_sessions_prev = 0
assess_completions = 0
assess_views = 0

if gcp_token:
    # Sessions WoW
    sessions_resp = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [{'startDate': d7_ago, 'endDate': today, 'name': 'this_week'},
                        {'startDate': d14_ago, 'endDate': d8_ago, 'name': 'last_week'}],
         'metrics': [{'name': 'sessions'}]},
        {'Authorization': f'Bearer {gcp_token}'}
    )
    for row in (sessions_resp.get('rows') or []):
        dim = row.get('dimensionValues', [{}])[0].get('value', '')
        val = int(row.get('metricValues', [{'value': '0'}])[0].get('value', 0))
        if dim == 'this_week' or dim == 'date_range_0':
            ga4_sessions_7d = val
        elif dim == 'last_week' or dim == 'date_range_1':
            ga4_sessions_prev = val

    # Assessment views + completions
    assess_resp = post_json(
        f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}:runReport',
        {'dateRanges': [{'startDate': d7_ago, 'endDate': today, 'name': 'this_week'},
                        {'startDate': d14_ago, 'endDate': d8_ago, 'name': 'last_week'}],
         'metrics': [{'name': 'screenPageViews'}, {'name': 'eventCount'}],
         'dimensionFilter': {'filter': {'fieldName': 'pagePath',
             'stringFilter': {'matchType': 'BEGINS_WITH', 'value': '/assessment'}}}},
        {'Authorization': f'Bearer {gcp_token}'}
    )
    for row in (assess_resp.get('rows') or []):
        dim = row.get('dimensionValues', [{}])[0].get('value', '')
        if dim in ('this_week', 'date_range_0'):
            assess_views        = int(row.get('metricValues', [{'value': '0'}, {'value': '0'}])[0].get('value', 0))
            assess_completions  = int(row.get('metricValues', [{'value': '0'}, {'value': '0'}])[1].get('value', 0))

sessions_delta = round((ga4_sessions_7d - ga4_sessions_prev) / ga4_sessions_prev * 100, 1) if ga4_sessions_prev else 0
print(f'  GA4: {ga4_sessions_7d} sessions ({sessions_delta:+.0f}% WoW), {assess_completions} completions')

# ── 8. Buffer queue count ─────────────────────────────────────────────────────

print('Fetching Buffer queue...')
buf_data = graphql('''
query($input: PostsInput!, $first: Int) {
  posts(input: $input, first: $first) { edges { node { id } } }
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
queue_count = len(buf_data.get('posts', {}).get('edges') or [])

# ── 9. Last row from Analytics State sheet ────────────────────────────────────

analytics_prev = {}
if gcp_token and SHEET_ID:
    try:
        url = (f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
               f'/values/Analytics%20State!A:J')
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {gcp_token}'})
        resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
        rows = resp.get('values', [])
        if len(rows) > 1:
            headers_row = rows[0]
            last_row    = rows[-1]
            analytics_prev = dict(zip(headers_row, last_row))
    except Exception as e:
        print(f'  Could not read Analytics State: {e}', file=sys.stderr)

# ── 10. Generate CEO brief via LLM ───────────────────────────────────────────

print('Calling LLM for CEO brief...')

health_str = ''
if agent_health:
    health_str = 'Agent failures this week:\n' + '\n'.join(f'  - {k}: {v} failures' for k, v in agent_health.items())
else:
    health_str = 'No agent failures recorded this week.'

competitor_str = ''
if competitor_bullets:
    competitor_str = 'Industry this week:\n' + '\n'.join(f'  - {b}' for b in competitor_bullets)
else:
    competitor_str = 'No Perplexity data available.'

burn_str = f'£{budget_burn_pence/100:.2f}/mo' if budget_burn_pence else 'data unavailable'

prompt = f"""You are writing a weekly CEO brief for George Spain-Warner, founder of ByeByeAdmin.
ByeByeAdmin sells AI automation to UK haulage fleet operators (3-100 vehicles).
North star metric: assessment completions.

Write a bullet-format brief. NO narrative paragraphs. ALL output must be bullet points.
Be direct and specific. No buzzwords. No em dashes.

Output this EXACT structure (use the emoji headers exactly as shown):

:briefcase: *BBA CEO Brief — week ending {week_label}*
Momentum: *{{n}}/10* — {{1-line reason}}

:dart: *North Star (assessment completions)*
• This week: {{completions}} completions
• WoW: {{delta}} (prev week context if available)

:email: *Outreach*
• Sent: {{sent}} · Open rate: {{open_rate}}% · Reply rate: {{reply_rate}}%
• Hot leads: {{hot_count}} this week

:chart_with_upwards_trend: *Site*
• Sessions: {{sessions}} ({sessions_delta:+.0f}% WoW)
• Assessment views: {{assess_views}}

:clapper: *Content*
• YouTube: {{yt_subs}} subs · Last video: {{last_views}} views
• Buffer queue: {{queue}} scheduled

:eyes: *Industry this week*
• {{perplexity_bullet_1}}
• {{perplexity_bullet_2}}

:robot_face: *Agent health*
• {{health_line}}

:moneybag: *Burn*
• Paperclip AI: {{burn}}

:white_check_mark: *Last week's decision*
"{{last_decision}}"

:memo: *This week's decision*
• {{1 concrete thing George should decide or act on this week, specific to the data above}}

DATA:
sent_7d={sent_7d}
open_rate={open_rate}%
reply_rate={reply_rate}%
assessment_completions_7d={assess_completions}
assessment_views_7d={assess_views}
ga4_sessions_7d={ga4_sessions_7d}
sessions_wow={sessions_delta:+.1f}%
yt_subs={yt_subs:,}
yt_last_video_views={yt_last_views:,}
yt_last_video="{yt_last_title}"
buffer_queue={queue_count}
hot_leads_7d={hot_lead_count}
paperclip_burn={burn_str}
last_decision="{last_decision or 'none recorded'}"
{competitor_str}
{health_str}
prev_analytics={json.dumps(analytics_prev)}"""

brief = call_llm(prompt, max_tokens=800)
if not brief:
    brief = (
        f':briefcase: *BBA CEO Brief — week ending {week_label}*\n'
        f'LLM failed — raw data:\n'
        f'Outreach: {sent_7d} sent · {reply_rate}% reply\n'
        f'Site: {ga4_sessions_7d} sessions · {assess_completions} completions\n'
        f'YouTube: {yt_subs:,} subs\n'
        f'Hot leads: {hot_lead_count}'
    )

# ── 11. Archive to CEO Briefs sheet ──────────────────────────────────────────

if gcp_token and SHEET_ID:
    try:
        # Extract momentum score and decision from brief
        momentum_line = next((l for l in brief.splitlines() if 'Momentum:' in l), '')
        momentum_score = ''
        import re
        score_match = re.search(r'\*(\d+)/10\*', momentum_line)
        if score_match:
            momentum_score = score_match.group(1)

        decision_line = ''
        lines = brief.splitlines()
        for i, line in enumerate(lines):
            if 'This week\'s decision' in line and i + 1 < len(lines):
                decision_line = lines[i + 1].lstrip('• ').strip()[:200]
                break

        post_json(
            f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
            f'/values/CEO%20Briefs!A:G:append?valueInputOption=USER_ENTERED',
            {'values': [[today, momentum_score, hot_lead_count, assess_completions, reply_rate, decision_line, competitor_str[:200]]]},
            {'Authorization': f'Bearer {gcp_token}'}
        )
        print('  Archived to CEO Briefs sheet.')
    except Exception as e:
        print(f'  Sheets archive failed: {e}', file=sys.stderr)

# ── 12. Post to Slack ─────────────────────────────────────────────────────────

msg = brief
if len(msg) > 3800:
    msg = msg[:3750] + '\n_[truncated]_'

print('Posting CEO brief to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': msg},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print('CEO brief sent.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
