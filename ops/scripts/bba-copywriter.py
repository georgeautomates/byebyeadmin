#!/usr/bin/env python3
"""BBA Copywriter — brand voice auditor.
Triggered after pipeline approvals or blog publishes.
Reads approved content from Sheets, audits against voice.md.
DMs George only if issues found. Logs all audits to "Brand Voice Log" sheet.

Usage:
  python3 bba-copywriter.py --source pipeline [--content_id ROW_ID]
  python3 bba-copywriter.py --source blog [--content_id ROW_ID]
"""

import os, json, sys, datetime, argparse, re
import urllib.request, urllib.parse
from bba_llm import call_llm

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
parser.add_argument('--source', required=True, choices=['pipeline', 'blog'], help='Content source type')
parser.add_argument('--content_id', default='', help='Sheets row identifier (optional — uses latest pending)')
args = parser.parse_args()

GEORGE          = 'U0AETR5UK4Y'
ANTHROPIC_KEY   = os.environ.get('ANTHROPIC_API_KEY', '')
SLACK_TOKEN     = os.environ['SLACK_BOT_TOKEN']
GCP_CLIENT_ID   = os.environ.get('GOOGLE_DRIVE_CLIENT_ID', '')  # gmail.com — owns ops Sheets
GCP_SECRET      = os.environ.get('GOOGLE_DRIVE_CLIENT_SECRET', '')
GCP_REFRESH     = os.environ.get('GOOGLE_DRIVE_REFRESH_TOKEN', '')
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

def get_gcp_token():
    if not GCP_REFRESH:
        return ''
    resp = post_form('https://oauth2.googleapis.com/token', {
        'client_id': GCP_CLIENT_ID, 'client_secret': GCP_SECRET,
        'refresh_token': GCP_REFRESH, 'grant_type': 'refresh_token',
    })
    return resp.get('access_token', '')

today = datetime.datetime.utcnow().strftime('%Y-%m-%d')

# ── 1. Read voice.md ──────────────────────────────────────────────────────────

voice_path = '/home/openclaw/byebyeadmin/ops/brand-context/voice.md'
voice_text = ''
try:
    with open(voice_path) as f:
        voice_text = f.read()[:2000]
    print('Read voice.md.')
except Exception:
    print('Could not read voice.md — proceeding with built-in rules.', file=sys.stderr)

# ── 2. Fetch content to audit ─────────────────────────────────────────────────

gcp_token = get_gcp_token()
content_to_audit = ''
content_label = ''

if args.source == 'pipeline' and SHEET_ID and gcp_token:
    print('Fetching latest approved pipeline content from Sheets...')
    # Read "Pending Approvals" tab — last row with status=processed
    try:
        url = (f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
               f'/values/Pending%20Approvals!A:M')
        req = urllib.request.Request(url,
            headers={'Authorization': f'Bearer {gcp_token}'})
        resp = json.loads(urllib.request.urlopen(req, timeout=20).read())
        rows = resp.get('values', [])
        if len(rows) > 1:
            headers_row = rows[0]
            # Find latest processed row
            target_row = None
            if args.content_id:
                for row in reversed(rows[1:]):
                    if len(row) > 0 and row[0] == args.content_id:
                        target_row = row
                        break
            else:
                for row in reversed(rows[1:]):
                    if len(row) >= 13 and row[12].lower() == 'processed':
                        target_row = row
                        break
            if target_row:
                # Columns: run_id | filename | drive_file_id | schedule_date | title_1 | title_2 | title_3 | ig_1 | ig_2 | linkedin | yt_description | transcript | status
                ig_1 = target_row[7] if len(target_row) > 7 else ''
                ig_2 = target_row[8] if len(target_row) > 8 else ''
                linkedin = target_row[9] if len(target_row) > 9 else ''
                yt_desc = target_row[10] if len(target_row) > 10 else ''
                title = target_row[4] if len(target_row) > 4 else ''
                content_to_audit = f"Title: {title}\n\nIG caption 1:\n{ig_1}\n\nIG caption 2:\n{ig_2}\n\nLinkedIn post:\n{linkedin}\n\nYouTube description:\n{yt_desc}"
                content_label = f"pipeline — {target_row[1] if len(target_row) > 1 else 'unknown'}"
                print(f'  Found pipeline content: {content_label}')
            else:
                print('  No processed pipeline content found.', file=sys.stderr)
    except Exception as e:
        print(f'  Could not fetch pipeline content: {e}', file=sys.stderr)

elif args.source == 'blog' and SHEET_ID and gcp_token:
    print('Fetching latest published blog content from Sheets...')
    try:
        url = (f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
               f'/values/Blog%20Queue!A:G')
        req = urllib.request.Request(url,
            headers={'Authorization': f'Bearer {gcp_token}'})
        resp = json.loads(urllib.request.urlopen(req, timeout=20).read())
        rows = resp.get('values', [])
        if len(rows) > 1:
            target_row = None
            if args.content_id:
                for i, row in enumerate(rows[1:], 1):
                    if str(i) == args.content_id or (len(row) > 0 and row[0] == args.content_id):
                        target_row = row
                        break
            else:
                for row in reversed(rows[1:]):
                    if len(row) >= 4 and row[3].lower() == 'published':
                        target_row = row
                        break
            if target_row:
                # Columns: date | topic | outline | status | doc_url | slug | keywords
                topic = target_row[1] if len(target_row) > 1 else ''
                outline = target_row[2] if len(target_row) > 2 else ''
                content_to_audit = f"Blog topic: {topic}\n\nOutline/content:\n{outline[:3000]}"
                content_label = f"blog — {topic[:60]}"
                print(f'  Found blog content: {content_label}')
            else:
                print('  No published blog content found.', file=sys.stderr)
    except Exception as e:
        print(f'  Could not fetch blog content: {e}', file=sys.stderr)

if not content_to_audit:
    print('No content to audit — exiting.', file=sys.stderr)
    sys.exit(0)

# ── 3. Audit via LLM ──────────────────────────────────────────────────────────

print('Running voice audit...')

prompt = f"""You are a brand voice auditor for ByeByeAdmin, a UK haulage AI automation company.

Brand voice guidelines:
{voice_text if voice_text else """
- No em dashes (— or &mdash; or \\u2014) anywhere in user-facing copy
- No buzzwords: leverage, utilise, game-changer, synergy, unlock, seamless, streamline, robust, cutting-edge
- Sentences under 20 words where possible
- Direct, conversational tone — no jargon
- Short sentences. Specific over generic.
- UK English spelling
"""}

Content to audit:
{content_to_audit}

Audit this content and return a JSON object with these fields:
{{
  "tone_score": <integer 1-5, where 5=perfect match to brand voice>,
  "flags": [<list of specific issues found, e.g. "em dash in IG caption 1", "buzzword: leverage">],
  "suggestions": [<1-2 specific rewrite suggestions for the worst issues>],
  "summary": <1 sentence summary of the audit>
}}

Be strict about em dashes and buzzwords (they are never acceptable).
Be practical about sentence length — flag only sentences clearly over 20 words.
If content is clean, set flags to [] and tone_score to 5.
Return ONLY the JSON object, no other text."""

audit_raw = call_llm(prompt, max_tokens=600)

# Parse JSON from LLM response
audit = {}
try:
    # Strip markdown code blocks if present
    clean = re.sub(r'^```(?:json)?\s*|\s*```$', '', audit_raw.strip(), flags=re.MULTILINE)
    audit = json.loads(clean)
except Exception as e:
    print(f'  Could not parse audit JSON: {e}\nRaw: {audit_raw[:200]}', file=sys.stderr)
    # Fallback: treat as clean pass
    audit = {'tone_score': 5, 'flags': [], 'suggestions': [], 'summary': 'Audit parse failed — manual review recommended.'}

tone_score = audit.get('tone_score', 5)
flags = audit.get('flags', [])
suggestions = audit.get('suggestions', [])
summary = audit.get('summary', '')

print(f'  Tone score: {tone_score}/5 | Flags: {len(flags)} | {summary}')

# ── 4. Log to Sheets ──────────────────────────────────────────────────────────

if SHEET_ID and gcp_token:
    try:
        flags_str = ' · '.join(flags) if flags else 'none'
        suggestions_str = ' | '.join(suggestions) if suggestions else 'none'
        post_json(
            f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
            f'/values/Brand%20Voice%20Log!A:F:append?valueInputOption=USER_ENTERED',
            {'values': [[today, args.source, content_label[:80], tone_score, flags_str[:300], suggestions_str[:300]]]},
            {'Authorization': f'Bearer {gcp_token}'}
        )
        print('  Logged to Brand Voice Log sheet.')
    except Exception as e:
        print(f'  Sheets log failed: {e}', file=sys.stderr)

# ── 5. Alert George if issues found ──────────────────────────────────────────

has_issues = len(flags) > 0 or tone_score < 4

if has_issues:
    flags_line = ' · '.join(flags[:4]) if flags else 'tone drift'
    suggestions_block = ''
    if suggestions:
        suggestions_block = '\n' + '\n'.join(f'Suggestion: _{s}_' for s in suggestions[:2])

    msg = (
        f':pencil2: *Voice audit — {content_label}*\n'
        f'Tone: *{tone_score}/5*\n'
        f'Flags: {flags_line}'
        f'{suggestions_block}'
    )

    result = post_json(
        'https://slack.com/api/chat.postMessage',
        {'channel': GEORGE, 'text': msg},
        {'Authorization': f'Bearer {SLACK_TOKEN}'}
    )
    if result.get('ok'):
        print(f'Drift alert sent to Slack (tone={tone_score}, flags={len(flags)}).')
    else:
        print(f'Slack error: {result}', file=sys.stderr)
else:
    print(f'Content clean (tone={tone_score}/5, no flags) — silent pass.')
