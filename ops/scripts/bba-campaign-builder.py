#!/usr/bin/env python3
"""BBA Campaign Builder — on-demand via Slack (`campaign: [segment]`).

Two modes:
  --segment "description"   Generate sequence + log to Sheets + post to Slack for review
  --approve "segment name"  Create draft campaign in Instantly from approved Sheets row

Usage:
  python3 bba-campaign-builder.py --segment "cold owner-operators 1-5 vehicles"
  python3 bba-campaign-builder.py --approve "cold owner-operators 1-5 vehicles"

Email count: detect from segment name — warm=3, cold=5, hyper/targeted=7 (default 5).
Spintax on subjects only (light). {{firstName}} and {{company}} tokens only.
Campaign naming: BBA-{segment-slug}-{YYYY-MM-DD}.
Writes to Sheets first, then Slack. Status: draft → approved → created_in_instantly.
"""

import os, json, sys, datetime, argparse, re
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

# ── args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser()
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument('--segment', help='Generate campaign for this segment description')
group.add_argument('--approve', help='Create approved campaign in Instantly (segment name)')
args = parser.parse_args()

GEORGE          = 'U0AETR5UK4Y'
ANTHROPIC_KEY   = os.environ.get('ANTHROPIC_API_KEY', '')
SLACK_TOKEN     = os.environ['SLACK_BOT_TOKEN']
INSTANTLY_KEY   = os.environ['INSTANTLY_API_KEY']
INSTANTLY_PROXY_URL    = os.environ.get('INSTANTLY_PROXY_URL', '')
INSTANTLY_PROXY_SECRET = os.environ.get('INSTANTLY_PROXY_SECRET', '')
GCP_CLIENT_ID   = os.environ.get('GOOGLE_CLIENT_ID', os.environ.get('GMAIL_CLIENT_ID', ''))
GCP_SECRET      = os.environ.get('GOOGLE_CLIENT_SECRET', os.environ.get('GMAIL_CLIENT_SECRET', ''))
GCP_REFRESH     = os.environ.get('GOOGLE_REFRESH_TOKEN', '')
SHEET_ID        = os.environ.get('GOOGLE_CONTENT_SHEET_ID', '')

today = datetime.datetime.utcnow().strftime('%Y-%m-%d')

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

def call_llm(prompt, max_tokens=2800):
    """Anthropic Sonnet → Gemini → OpenAI cascade."""
    if ANTHROPIC_KEY:
        body = json.dumps({'model': 'claude-sonnet-4-6', 'max_tokens': max_tokens,
            'messages': [{'role': 'user', 'content': prompt}]}).encode()
        req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body,
            headers={'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01',
                     'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=90).read())
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
            resp = json.loads(urllib.request.urlopen(req, timeout=90).read())
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
        resp = json.loads(urllib.request.urlopen(req, timeout=90).read())
        return resp['choices'][0]['message']['content']
    except Exception as e:
        print(f'  OpenAI failed: {e}', file=sys.stderr)
        return ''

def get_gcp_token():
    if not GCP_REFRESH:
        return ''
    resp = post_form('https://oauth2.googleapis.com/token', {
        'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
        'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
    })
    return resp.get('access_token', '')

def segment_to_slug(segment):
    """Convert segment name to URL-safe slug for campaign naming."""
    slug = re.sub(r'[^a-z0-9]+', '-', segment.lower().strip())
    return slug[:30].strip('-')

def detect_email_count(segment):
    """Detect email count from segment name."""
    s = segment.lower()
    if 'warm' in s or 'referral' in s or 'inbound' in s:
        return 3
    if 'hyper' in s or 'targeted' in s or 'vip' in s or 'priority' in s:
        return 7
    return 5  # default: cold

# ── MODE: --approve ───────────────────────────────────────────────────────────

if args.approve:
    segment_name = args.approve.strip()
    print(f'Approve mode: creating campaign in Instantly for "{segment_name}"...')

    gcp_token = get_gcp_token()
    sequence_text = ''
    sheet_row_idx = None

    # Find latest 'draft' row for this segment in Sheets
    if gcp_token and SHEET_ID:
        try:
            url = (f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
                   f'/values/Campaign%20Drafts!A:H')
            req = urllib.request.Request(url, headers={'Authorization': f'Bearer {gcp_token}'})
            resp = json.loads(urllib.request.urlopen(req, timeout=20).read())
            rows = resp.get('values', [])
            for i, row in enumerate(reversed(rows[1:]), 1):
                seg = row[1] if len(row) > 1 else ''
                status = row[6] if len(row) > 6 else ''
                if segment_name.lower() in seg.lower() and status == 'draft':
                    sequence_text = row[4] if len(row) > 4 else ''  # col E = body
                    sheet_row_idx = len(rows) - i  # original 1-based row index
                    print(f'  Found draft in Sheets row {sheet_row_idx}.')
                    break
        except Exception as e:
            print(f'  Could not read Sheets: {e}', file=sys.stderr)

    if not sequence_text:
        # Post error to Slack
        post_json(
            'https://slack.com/api/chat.postMessage',
            {'channel': GEORGE, 'text': f':warning: No draft found for segment "{segment_name}" — try generating it first with `campaign: {segment_name}`'},
            {'Authorization': f'Bearer {SLACK_TOKEN}'}
        )
        sys.exit(1)

    # Create campaign in Instantly
    campaign_name = f'BBA-{segment_to_slug(segment_name)}-{today}'
    auth = {'Authorization': f'Bearer {INSTANTLY_KEY}'}
    print(f'  Creating Instantly campaign: {campaign_name}...')

    create_resp = get(
        f'https://api.instantly.ai/api/v2/campaigns',
        auth
    )
    # Use POST to create
    new_camp = post_json(
        _maybe_proxy('https://api.instantly.ai/api/v2/campaigns'),
        {'name': campaign_name, 'status': 'draft'},
        {**auth, 'User-Agent': 'curl/7.88.1', 'X-Proxy-Secret': INSTANTLY_PROXY_SECRET} if INSTANTLY_PROXY_URL else auth
    )
    campaign_id = new_camp.get('id', '')

    if campaign_id:
        print(f'  Campaign created: {campaign_id}')
        # Update Sheets status
        if gcp_token and SHEET_ID and sheet_row_idx:
            try:
                post_json(
                    f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
                    f'/values/Campaign%20Drafts!G{sheet_row_idx}:H{sheet_row_idx}?valueInputOption=USER_ENTERED',
                    {'values': [['created_in_instantly', campaign_id]]},
                    {'Authorization': f'Bearer {gcp_token}'}
                )
            except Exception as e:
                print(f'  Sheets update failed: {e}', file=sys.stderr)

        msg = (
            f':white_check_mark: *Campaign created in Instantly (draft)*\n'
            f'Name: `{campaign_name}`\n'
            f'ID: `{campaign_id}`\n'
            f'Status: draft — NOT launched. Add email accounts + review before activating.'
        )
    else:
        msg = (
            f':warning: *Instantly campaign creation failed for "{segment_name}"*\n'
            f'Response: {json.dumps(new_camp)[:200]}\n'
            f'Try creating manually: `BBA-{segment_to_slug(segment_name)}-{today}`'
        )

    result = post_json(
        'https://slack.com/api/chat.postMessage',
        {'channel': GEORGE, 'text': msg},
        {'Authorization': f'Bearer {SLACK_TOKEN}'}
    )
    if result.get('ok'):
        print('Slack notification sent.')
    sys.exit(0)

# ── MODE: --segment (generate) ────────────────────────────────────────────────

segment       = args.segment.strip()
email_count   = detect_email_count(segment)
campaign_name = f'BBA-{segment_to_slug(segment)}-{today}'

print(f'Building {email_count}-email campaign for segment: "{segment}"')
print(f'Campaign name will be: {campaign_name}')

# ── 1. Read brand context ─────────────────────────────────────────────────────

base = '/home/openclaw/byebyeadmin/ops/brand-context'
voice_text = positioning_text = icp_text = ''
for fname, varname in [('voice.md', 'voice'), ('positioning.md', 'positioning'), ('icp.md', 'icp')]:
    try:
        with open(f'{base}/{fname}') as f:
            text = f.read()[:1500]
            if varname == 'voice':
                voice_text = text
            elif varname == 'positioning':
                positioning_text = text
            else:
                icp_text = text
    except Exception:
        print(f'  Could not read {fname}', file=sys.stderr)

# ── 2. Fetch Instantly timing data ────────────────────────────────────────────

timing_insight = ''
auth = {'Authorization': f'Bearer {INSTANTLY_KEY}'}
print('Fetching Instantly timing data...')
try:
    timing_resp = get(
        'https://api.instantly.ai/api/v2/analytics/campaigns/summary?limit=10',
        auth
    )
    if timing_resp and timing_resp.get('items'):
        # Summarise top-performing campaigns for timing reference
        items = timing_resp.get('items', [])[:5]
        timing_insight = 'Top campaign open/reply patterns from existing data:\n'
        for item in items:
            name = item.get('campaign_name', '')[:40]
            opens = item.get('open_rate', 0)
            replies = item.get('reply_rate', 0)
            timing_insight += f'  - {name}: {opens:.1f}% open, {replies:.1f}% reply\n'
except Exception as e:
    print(f'  Could not fetch Instantly timing data: {e}', file=sys.stderr)
    timing_insight = 'No Instantly timing data available — use UK business hours best practices (Tue-Thu, 8am-10am).'

# ── 3. Read sequences.js for tone reference ───────────────────────────────────

sequences_ref = ''
seq_path = '/home/openclaw/byebyeadmin/instantly-campaigns/sequences.js'
try:
    with open(seq_path) as f:
        lines = []
        for i, line in enumerate(f):
            if i >= 200:
                break
            lines.append(line)
        sequences_ref = ''.join(lines)[:2500]
except Exception:
    print('  Could not read sequences.js', file=sys.stderr)

# ── 4. Generate campaign ──────────────────────────────────────────────────────

# Day schedule by email count
day_schedules = {
    3: [0, 4, 10],
    5: [0, 3, 7, 12, 18],
    7: [0, 2, 5, 9, 13, 18, 24],
}
days = day_schedules.get(email_count, day_schedules[5])

segment_type = 'warm' if email_count == 3 else ('hyper-targeted' if email_count == 7 else 'cold')
close_instruction = (
    'Final email: soft pivot close — offer a free 15-min admin audit or "I can show you exactly how it would work for your fleet". Not a break-up.'
    if email_count >= 5 else
    'Final email: low-commitment ask — a simple yes/no question about their admin pain.'
)

prompt = f"""Write a {email_count}-email cold outreach sequence for ByeByeAdmin targeting: {segment}
Segment type: {segment_type}

ByeByeAdmin sells AI automation to UK haulage fleet operators (3-100 vehicles).
Founder: George Spain-Warner, based in Kent.
Campaign name: {campaign_name}

Brand voice:
{voice_text or 'Direct, conversational, no jargon. Short sentences. Specific over generic.'}

Positioning:
{positioning_text or 'AI that removes admin burden from fleet operators.'}

ICP:
{icp_text or 'Fleet managers and transport directors in UK road haulage.'}

Timing insight from existing campaigns:
{timing_insight}

Existing sequence tone (for reference):
{sequences_ref[:2000] if sequences_ref else 'Not available.'}

Send schedule:
{json.dumps({f'Email {i+1}': f'Day {d}' for i, d in enumerate(days)})}

{close_instruction}

For EACH email output EXACTLY this format:
*Email {{n}} — Day {{d}}*
Subjects: "{{s1}}" / "{{s2}}" / "{{s3}}"
---
{{Email body — 3-5 sentences max. Conversational. No buzzwords. UK English.}}
---
CTA: {{single clear ask}}

Rules:
- No em dashes anywhere (never — or &mdash;)
- No buzzwords (leverage, utilise, game-changer, synergy, streamline, unlock, robust)
- UK English spelling
- Bodies under 100 words each
- Subject lines under 50 chars
- Spintax on SUBJECTS ONLY using {{{{variant1|variant2}}}} — no spintax in bodies
- Personalisation tokens: {{{{firstName}}}} and {{{{company}}}} only
- Each email must have a different angle (don't repeat the same opening)

After the {email_count} emails, output on a new line:
SEGMENT: {segment}
EMAIL_COUNT: {email_count}"""

print('Calling LLM...')
sequence = call_llm(prompt, max_tokens=2800)
if not sequence:
    post_json(
        'https://slack.com/api/chat.postMessage',
        {'channel': GEORGE, 'text': f':warning: Campaign builder failed for segment: "{segment}"'},
        {'Authorization': f'Bearer {SLACK_TOKEN}'}
    )
    sys.exit(1)

print(f'Sequence generated ({len(sequence)} chars).')

# ── 5. Write to Sheets FIRST ──────────────────────────────────────────────────

gcp_token = get_gcp_token()
if gcp_token and SHEET_ID:
    print('Logging campaign draft to Sheets...')
    post_json(
        f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
        f'/values/Campaign%20Drafts!A:H:append?valueInputOption=USER_ENTERED',
        {'values': [[today, segment, email_count, campaign_name, sequence[:5000], '', 'draft', '']]},
        {'Authorization': f'Bearer {gcp_token}'}
    )
    print('  Logged to Campaign Drafts sheet.')

# ── 6. Post to Slack ──────────────────────────────────────────────────────────

type_label = {'3': 'warm', '5': 'cold', '7': 'hyper-targeted'}.get(str(email_count), 'cold')
header = f':email: *Campaign Draft: {segment}* ({email_count} emails, {type_label})\n\n'
footer = (
    f'\n\n_Campaign name: `{campaign_name}`_\n'
    f'Reply `approve campaign: {segment}` to create in Instantly as draft (not launched).'
)

msg = header + sequence + footer
if len(msg) > 3800:
    available = 3800 - len(header) - len(footer) - 20
    msg = header + sequence[:available] + '\n_[truncated — full draft in Campaign Drafts sheet]_' + footer

print('Posting campaign to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': msg},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print(f'Campaign draft posted to Slack.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
