#!/usr/bin/env python3
"""BBA Hot Lead Monitor — runs every 4h on VPS.
Checks Instantly for new replies in last 4h. Classifies each as HOT/WARM/COLD via Claude Haiku.
HOT = explicit positive OR implied interest (fleet context, operational questions, pricing curiosity).
Alerts George on Slack only if HOT leads found. Logs only HOT leads to Google Sheets.
Silent midnight-6am UTC. Fat context: checks Sheets history to avoid duplicate alerts.
"""

import os, json, sys, datetime, re
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

# ── silence window ─────────────────────────────────────────────────────────────

now = datetime.datetime.utcnow()
if now.hour < 6:
    print(f'Silence window (UTC {now.hour}:00 — runs 06:00-23:59 UTC). Exiting.')
    sys.exit(0)

GEORGE                 = 'U0AETR5UK4Y'
ANTHROPIC_KEY          = os.environ.get('ANTHROPIC_API_KEY', '')
SLACK_TOKEN            = os.environ['SLACK_BOT_TOKEN']
INSTANTLY_KEY          = os.environ['INSTANTLY_API_KEY']
INSTANTLY_PROXY_URL    = os.environ.get('INSTANTLY_PROXY_URL', '')
INSTANTLY_PROXY_SECRET = os.environ.get('INSTANTLY_PROXY_SECRET', '')
GCP_CLIENT_ID          = os.environ.get('GOOGLE_DRIVE_CLIENT_ID', '')  # gmail.com — owns ops Sheets
GCP_SECRET             = os.environ.get('GOOGLE_DRIVE_CLIENT_SECRET', '')
GCP_REFRESH            = os.environ.get('GOOGLE_DRIVE_REFRESH_TOKEN', '')
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

def call_llm(prompt, max_tokens=500):
    """Anthropic Haiku → Gemini → OpenAI cascade."""
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

today_str = now.strftime('%Y-%m-%d %H:%M')

# ── 1. Get fat context: already-alerted emails from Sheets ───────────────────

gcp_token = ''
already_alerted = set()  # set of email addresses already logged as HOT

if GCP_REFRESH and SHEET_ID:
    print('Getting GCP token...')
    token_resp = post_form('https://oauth2.googleapis.com/token', {
        'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
        'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
    })
    gcp_token = token_resp.get('access_token', '')

if gcp_token and SHEET_ID:
    try:
        url = (f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
               f'/values/Hot%20Leads!A:H')
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {gcp_token}'})
        resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
        rows = resp.get('values', [])
        # Last 5 HOT rows per email — just collect all emailed addresses from last 50 rows
        for row in rows[-50:]:
            if len(row) >= 4:
                already_alerted.add(row[3].lower().strip())  # col D = sender_email
        print(f'  Loaded {len(already_alerted)} previously-alerted emails from Sheets.')
    except Exception as e:
        print(f'  Could not load Sheets history: {e}', file=sys.stderr)

# ── 2. Fetch replies from last 4h ─────────────────────────────────────────────

four_h_ago = (now - datetime.timedelta(hours=4)).strftime('%Y-%m-%dT%H:%M:%SZ')
print(f'Fetching Instantly replies since {four_h_ago}...')

auth = {'Authorization': f'Bearer {INSTANTLY_KEY}'}
replies = []
starting_after = None

while len(replies) < 50:
    qs = f'limit=100&ue_type=3&timestamp_after={urllib.parse.quote(four_h_ago)}'
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

print(f'Found {len(replies)} replies in last 4h.')

if not replies:
    print('No new replies — nothing to do.')
    sys.exit(0)

# ── 3. Classify replies ────────────────────────────────────────────────────────

def extract_addr(to_addr):
    if isinstance(to_addr, dict):
        return (
            to_addr.get('name', '') or '',
            to_addr.get('email', '') or '',
            to_addr.get('company', '') or ''
        )
    s = str(to_addr or '')
    return '', s, ''

def build_batch_prompt(batch):
    lines = []
    for i, r in enumerate(batch):
        name, email, company = extract_addr(r.get('to_address'))
        body = (r.get('body', '') or r.get('text', '') or '')[:300]
        campaign = r.get('campaign_name', r.get('campaign_id', 'unknown'))
        lines.append(
            f'Reply {i+1}:\n'
            f'Sender: {name} ({company}) <{email}>\n'
            f'Campaign: {campaign}\n'
            f'Body: {body}'
        )

    prompt = (
        'Classify these cold email replies for ByeByeAdmin (AI admin automation for UK haulage fleets — reduces paperwork, proof of delivery, compliance docs).\n\n'
        'HOT = any positive or implied interest, including:\n'
        '  - Explicit: "yes", "interested", "how much", "send more info", "book a call", "sounds good"\n'
        '  - Implied: mentions their fleet size/operations, asks how it works, mentions a pain point (admin, paperwork, compliance), asks about timing or implementation\n'
        '  - Context: "we run 12 vehicles", "our drivers spend hours on PODs", "we use X software currently"\n'
        'WARM = not now, maybe later, ambiguous, asking to try again in future\n'
        'COLD = unsubscribe, not interested, wrong person, out of office, negative\n\n'
        'Return a JSON array, one object per reply, in order:\n'
        '[{"idx":1,"classification":"HOT","reason":"asked about pricing","suggested_reply":"Thanks for getting back to me — happy to walk you through exactly how it works for fleets your size. When works for a quick call?"},{"idx":2,...},...]\n\n'
        'suggested_reply: a natural 1-2 sentence reply George can send (only for HOT; empty string for WARM/COLD).\n'
        'Return ONLY the JSON array.\n\n'
        'Replies:\n' + '\n\n'.join(lines)
    )
    return prompt

BATCH_SIZE = 8
classified = []

for i in range(0, len(replies), BATCH_SIZE):
    batch = replies[i:i + BATCH_SIZE]
    prompt = build_batch_prompt(batch)
    result = call_llm(prompt, max_tokens=600)
    if not result:
        for r in batch:
            classified.append({**r, 'classification': 'UNKNOWN', 'reason': '', 'suggested': ''})
        continue
    # Parse JSON
    try:
        clean = re.sub(r'^```(?:json)?\s*|\s*```$', '', result.strip(), flags=re.MULTILINE)
        parsed = json.loads(clean)
        for j, r in enumerate(batch):
            item = next((p for p in parsed if p.get('idx') == j + 1), None)
            if item:
                classified.append({
                    **r,
                    'classification': item.get('classification', 'UNKNOWN'),
                    'reason':         item.get('reason', ''),
                    'suggested':      item.get('suggested_reply', ''),
                })
            else:
                classified.append({**r, 'classification': 'UNKNOWN', 'reason': '', 'suggested': ''})
    except Exception as e:
        print(f'  JSON parse failed: {e} — marking batch as UNKNOWN', file=sys.stderr)
        for r in batch:
            classified.append({**r, 'classification': 'UNKNOWN', 'reason': '', 'suggested': ''})

hot = [r for r in classified if r.get('classification') == 'HOT']
warm = [r for r in classified if r.get('classification') == 'WARM']
cold = [r for r in classified if r.get('classification') == 'COLD']
print(f'HOT: {len(hot)} / WARM: {len(warm)} / COLD: {len(cold)}')

# ── 4. Deduplicate: filter HOT leads already alerted ─────────────────────────

new_hot = []
for r in hot:
    _, email, _ = extract_addr(r.get('to_address'))
    if email.lower().strip() not in already_alerted:
        new_hot.append(r)

skipped = len(hot) - len(new_hot)
if skipped:
    print(f'  Skipped {skipped} HOT leads already logged in Sheets.')

if not new_hot:
    print('No new HOT leads — no Slack alert needed.')
    sys.exit(0)

# ── 5. Log HOT leads to Sheets ────────────────────────────────────────────────

if gcp_token and SHEET_ID:
    print(f'Logging {len(new_hot)} HOT leads to sheet...')
    rows = []
    for r in new_hot:
        name, email, company = extract_addr(r.get('to_address'))
        campaign = r.get('campaign_name', r.get('campaign_id', ''))
        snippet = (r.get('body', '') or r.get('text', '') or '')[:200]
        rows.append([today_str, campaign, name, email, company, snippet[:150], r['classification'], r.get('suggested', ''), 'TRUE'])
    post_json(
        f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
        f'/values/Hot%20Leads!A:I:append?valueInputOption=USER_ENTERED',
        {'values': rows},
        {'Authorization': f'Bearer {gcp_token}'}
    )
    print('  Logged to Hot Leads sheet.')

# ── 6. Alert George on Slack ──────────────────────────────────────────────────

parts = [f':fire: *{len(new_hot)} HOT lead{"s" if len(new_hot) > 1 else ""} — {today_str} UTC*\n']
for r in new_hot:
    name, email, company = extract_addr(r.get('to_address'))
    campaign = r.get('campaign_name', r.get('campaign_id', ''))
    snippet = (r.get('body', '') or r.get('text', '') or '')[:130].strip()
    suggested = r.get('suggested', '').strip()

    label = f'*{name}*' if name else f'*{email}*'
    if company:
        label += f' ({company})'

    block = (
        f':fire: *HOT lead — {label}*\n'
        f'Campaign: {campaign}\n'
        f'_{snippet}_\n'
    )
    if suggested:
        block += f'Suggested reply: _{suggested}_\n'
    parts.append(block)

msg = '\n'.join(parts)
if len(msg) > 3800:
    msg = msg[:3750] + '\n_[truncated — see Hot Leads sheet]_'

print('Posting hot lead alert to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': msg},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print(f'Alert sent: {len(new_hot)} new HOT leads.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
