#!/usr/bin/env python3
"""BBA Campaign Builder — on-demand via Slack (`campaign: [segment]`).
Usage: python3 bba-campaign-builder.py --segment "your segment description"
Reads brand context, writes 5-email cold sequence via Claude Sonnet.
Posts formatted sequence to Slack for approval. Logs draft to Google Sheets.
"""

import os, json, sys, datetime, argparse
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
parser.add_argument('--segment', required=True, help='Target segment description')
args = parser.parse_args()
segment = args.segment.strip()

GEORGE          = 'U0AETR5UK4Y'
ANTHROPIC_KEY   = os.environ.get('ANTHROPIC_API_KEY', '')
SLACK_TOKEN     = os.environ['SLACK_BOT_TOKEN']
GCP_CLIENT_ID   = os.environ.get('GOOGLE_CLIENT_ID', os.environ.get('GMAIL_CLIENT_ID', ''))
GCP_SECRET      = os.environ.get('GOOGLE_CLIENT_SECRET', os.environ.get('GMAIL_CLIENT_SECRET', ''))
GCP_REFRESH     = os.environ.get('GOOGLE_REFRESH_TOKEN', '')
SHEET_ID        = os.environ.get('GOOGLE_CONTENT_SHEET_ID', '')

# ── helpers ───────────────────────────────────────────────────────────────────

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

def call_llm(prompt, max_tokens=2500):
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

today = datetime.datetime.utcnow().strftime('%Y-%m-%d')

# ── 1. Read brand context ─────────────────────────────────────────────────────

base = '/home/openclaw/byebyeadmin/ops/brand-context'
voice_text = positioning_text = icp_text = ''
for fname, var_name in [('voice.md', 'voice_text'), ('positioning.md', 'positioning_text'), ('icp.md', 'icp_text')]:
    try:
        with open(f'{base}/{fname}') as f:
            content = f.read()[:1500]
            if var_name == 'voice_text':
                voice_text = content
            elif var_name == 'positioning_text':
                positioning_text = content
            else:
                icp_text = content
    except Exception:
        print(f'  Could not read {fname}', file=sys.stderr)

# Read first 200 lines of sequences.js for tone reference
sequences_ref = ''
seq_path = '/home/openclaw/byebyeadmin/instantly-campaigns/sequences.js'
try:
    with open(seq_path) as f:
        lines = []
        for i, line in enumerate(f):
            if i >= 200:
                break
            lines.append(line)
        sequences_ref = ''.join(lines)[:3000]
except Exception:
    print(f'  Could not read sequences.js — proceeding without reference.', file=sys.stderr)

# ── 2. Generate campaign ──────────────────────────────────────────────────────

print(f'Building campaign for segment: "{segment}"...')

prompt = f"""Write a 5-email cold outreach sequence for ByeByeAdmin targeting: {segment}

ByeByeAdmin sells AI automation to UK haulage fleet operators (3-100 vehicles).
Founder: George Spain-Warner, based in Kent.

Brand voice:
{voice_text if voice_text else "Direct, conversational, no jargon. Short sentences. Specific over generic."}

Positioning:
{positioning_text if positioning_text else "AI that removes admin burden from fleet operators."}

ICP:
{icp_text if icp_text else "Fleet managers and transport directors in UK road haulage."}

Existing sequence tone reference (first 200 lines):
{sequences_ref[:1500] if sequences_ref else "Not available."}

Sequence requirements:
- Email 1 (Day 0): Cold intro — specific pain point, not a pitch
- Email 2 (Day 3): Add value — share a relevant insight or stat
- Email 3 (Day 7): Social proof or case study angle
- Email 4 (Day 12): Different angle — try a different pain point or format
- Email 5 (Day 18): Soft close / break-up — make it easy to say yes or no

For EACH email output:
*Email [n] — Day [d]*
Subjects: "[s1]" / "[s2]" / "[s3]"
---
[Email body — 3-5 sentences max. Conversational. No buzzwords.]
---
CTA: [single clear ask]

Rules:
- No em dashes anywhere
- No buzzwords (leverage, utilise, game-changer, synergy, etc.)
- UK English spelling
- Bodies under 100 words each
- Subject lines under 50 chars
- Spintax allowed: {{variant1|variant2}} for personalisation

After the 5 emails, output on a new line:
SEGMENT: {segment}"""

sequence = call_llm(prompt, max_tokens=2500)
if not sequence:
    result = post_json(
        'https://slack.com/api/chat.postMessage',
        {'channel': GEORGE, 'text': f':warning: Campaign builder failed for segment: "{segment}"'},
        {'Authorization': f'Bearer {SLACK_TOKEN}'}
    )
    sys.exit(1)

print(f'Sequence generated ({len(sequence)} chars).')

# ── 3. Log to Google Sheets ───────────────────────────────────────────────────

if GCP_REFRESH and SHEET_ID:
    print('Getting GCP token...')
    token_resp = post_form('https://oauth2.googleapis.com/token', {
        'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
        'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
    })
    gcp_token = token_resp.get('access_token', '')
    if gcp_token:
        print('Logging campaign draft to sheets...')
        post_json(
            f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
            f'/values/Campaign%20Drafts!A:C:append?valueInputOption=USER_ENTERED',
            {'values': [[today, segment, sequence[:5000]]]},
            {'Authorization': f'Bearer {gcp_token}'}
        )

# ── 4. Post to Slack ──────────────────────────────────────────────────────────

header = f':email: *Campaign Draft: {segment}*\n\n'
footer = '\n\nReply `approve campaign` to create this in Instantly, or `revise campaign: [notes]` to regenerate.'

msg = header + sequence + footer

# Slack message limit — truncate sequence if needed
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
