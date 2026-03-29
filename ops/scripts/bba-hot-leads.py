#!/usr/bin/env python3
"""BBA Hot Lead Monitor — runs every 2h on VPS.
Checks Instantly for new replies in last 2h. Classifies each as HOT/WARM/COLD via Claude Haiku.
Alerts George on Slack if any hot leads found. Logs all to Google Sheets.
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
GCP_CLIENT_ID          = os.environ.get('GOOGLE_CLIENT_ID', os.environ.get('GMAIL_CLIENT_ID', ''))
GCP_SECRET             = os.environ.get('GOOGLE_CLIENT_SECRET', os.environ.get('GMAIL_CLIENT_SECRET', ''))
GCP_REFRESH            = os.environ.get('GOOGLE_REFRESH_TOKEN', '')
SHEET_ID               = os.environ.get('GOOGLE_CONTENT_SHEET_ID', '')

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
        return None

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

def call_llm(prompt, max_tokens=400):
    """Anthropic → Gemini → OpenAI cascade."""
    if ANTHROPIC_KEY:
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

# ── 1. Fetch replies from last 2h ─────────────────────────────────────────────

now      = datetime.datetime.utcnow()
two_h_ago = (now - datetime.timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%SZ')
today_str = now.strftime('%Y-%m-%d %H:%M')

print(f'Fetching Instantly replies since {two_h_ago}...')
auth = {'Authorization': f'Bearer {INSTANTLY_KEY}'}
replies = []
starting_after = None

while len(replies) < 50:
    qs = f'limit=100&ue_type=3&timestamp_after={urllib.parse.quote(two_h_ago)}'
    if starting_after:
        qs += f'&starting_after={urllib.parse.quote(starting_after)}'
    page = get(f'https://api.instantly.ai/api/v2/emails?{qs}', auth)
    if page is None:
        print('Instantly API unavailable — skipping.', file=sys.stderr)
        sys.exit(0)
    items = page.get('items', [])
    replies.extend(items)
    if not items or not page.get('next_starting_after'):
        break
    starting_after = page['next_starting_after']

print(f'Found {len(replies)} replies in last 2h.')

if not replies:
    print('No new replies — nothing to do.')
    sys.exit(0)

# ── 2. Classify replies ────────────────────────────────────────────────────────

def build_classify_prompt(batch):
    lines = []
    for i, r in enumerate(batch):
        name    = r.get('to_address', {}).get('name', '') or r.get('to_address', '') or 'Unknown'
        email   = r.get('to_address', {}).get('email', '') or ''
        company = r.get('to_address', {}).get('company', '') or ''
        body    = (r.get('body', '') or r.get('text', '') or '')[:300]
        lines.append(f'Reply {i+1}: From: {name} ({company}) <{email}>\nBody: {body}')
    prompt = (
        'You are classifying cold email replies for ByeByeAdmin (AI automation for UK haulage fleets).\n\n'
        'HOT = interested, asking questions, wants a demo/call/price, positive intent\n'
        'WARM = not now, maybe later, or ambiguous\n'
        'COLD = unsubscribe, not interested, negative, out of office\n\n'
        'For each reply output ONE line (no extra text):\n'
        'REPLY_N | CLASSIFICATION | REASON (max 10 words) | SUGGESTED_REPLY (max 15 words)\n\n'
        'Replies:\n' + '\n\n'.join(lines)
    )
    return prompt

BATCH_SIZE = 5
classified = []

for i in range(0, len(replies), BATCH_SIZE):
    batch = replies[i:i + BATCH_SIZE]
    prompt = build_classify_prompt(batch)
    result = call_llm(prompt, max_tokens=500)
    if not result:
        for r in batch:
            classified.append({**r, 'classification': 'UNKNOWN', 'reason': '', 'suggested': ''})
        continue
    lines = [l.strip() for l in result.strip().splitlines() if '|' in l]
    for j, r in enumerate(batch):
        match = next((l for l in lines if l.startswith(f'REPLY_{j+1}')), None)
        if match:
            parts = [p.strip() for p in match.split('|')]
            classified.append({
                **r,
                'classification': parts[1] if len(parts) > 1 else 'UNKNOWN',
                'reason':         parts[2] if len(parts) > 2 else '',
                'suggested':      parts[3] if len(parts) > 3 else '',
            })
        else:
            classified.append({**r, 'classification': 'UNKNOWN', 'reason': '', 'suggested': ''})

# ── 3. Log to Google Sheet ─────────────────────────────────────────────────────

gcp_token = ''
if GCP_REFRESH and SHEET_ID:
    print('Getting GCP token...')
    token_resp = post_form('https://oauth2.googleapis.com/token', {
        'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
        'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
    })
    gcp_token = token_resp.get('access_token', '')

if gcp_token and SHEET_ID and classified:
    print(f'Logging {len(classified)} replies to sheet...')
    rows = []
    for r in classified:
        name  = r.get('to_address', {}).get('name', '') if isinstance(r.get('to_address'), dict) else str(r.get('to_address', ''))
        email = r.get('to_address', {}).get('email', '') if isinstance(r.get('to_address'), dict) else ''
        company = r.get('to_address', {}).get('company', '') if isinstance(r.get('to_address'), dict) else ''
        body  = (r.get('body', '') or r.get('text', '') or '')[:200]
        rows.append([today_str, name, email, company, r['classification'], body[:150], r['reason'], r['suggested']])
    post_json(
        f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
        f'/values/Hot%20Leads!A:H:append?valueInputOption=USER_ENTERED',
        {'values': rows},
        {'Authorization': f'Bearer {gcp_token}'}
    )

# ── 4. Alert on hot leads ──────────────────────────────────────────────────────

hot = [r for r in classified if r.get('classification') == 'HOT']
print(f'Hot: {len(hot)} / Warm: {len([r for r in classified if r.get("classification") == "WARM"])} / Cold: {len([r for r in classified if r.get("classification") == "COLD"])}')

if not hot:
    print('No hot leads — no Slack alert needed.')
    sys.exit(0)

lines = [f':fire: *{len(hot)} hot lead{"s" if len(hot) > 1 else ""} — {today_str} UTC*\n']
for r in hot:
    name    = r.get('to_address', {}).get('name', '') if isinstance(r.get('to_address'), dict) else str(r.get('to_address', ''))
    email   = r.get('to_address', {}).get('email', '') if isinstance(r.get('to_address'), dict) else ''
    company = r.get('to_address', {}).get('company', '') if isinstance(r.get('to_address'), dict) else ''
    body    = (r.get('body', '') or r.get('text', '') or '')[:120]
    lines.append(
        f'*{name}* ({company}) <{email}>\n'
        f'_{body.strip()}_\n'
        f'Reply: _{r.get("suggested", "")}_\n'
    )

msg = '\n'.join(lines)
if len(msg) > 3800:
    msg = msg[:3750] + '\n_[truncated]_'

print('Posting hot lead alert to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': msg},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print(f'Hot lead alert sent ({len(hot)} leads).')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
