#!/usr/bin/env python3
"""BBA Script Writer — generates talk-to-camera scripts from Content Strategist ideas.
Reads the latest Content Ideas from Sheets, pulls George's scripting style guide
and top-performing transcripts, then writes full scripts and posts to Slack for review.

Triggered: Monday (after Content Strategist) or on-demand via Slack.
"""

import os, json, sys, datetime, re
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

GEORGE          = 'U0AETR5UK4Y'
SLACK_TOKEN     = os.environ['SLACK_BOT_TOKEN']
YT_KEY          = os.environ['YOUTUBE_API_KEY']
YT_CHANNEL      = os.environ['YOUTUBE_CHANNEL_ID']
SHEETS_CLIENT   = os.environ.get('GOOGLE_CLIENT_ID', '')
SHEETS_SECRET   = os.environ.get('GOOGLE_CLIENT_SECRET', '')
SHEETS_REFRESH  = os.environ.get('GOOGLE_REFRESH_TOKEN', '')
SHEET_ID        = os.environ.get('GOOGLE_CONTENT_SHEET_ID', '')

REPO_DIR        = '/home/openclaw/byebyeadmin'
STYLE_GUIDE     = os.path.join(REPO_DIR, 'ops/brand-context/scripting-style.md')
VOICE_GUIDE     = os.path.join(REPO_DIR, 'ops/brand-context/voice.md')

# ── helpers ───────────────────────────────────────────────────────────────────

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
        return json.loads(urllib.request.urlopen(req, timeout=90).read())
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

def read_file(path):
    try:
        with open(path, 'r') as f:
            return f.read()
    except Exception as e:
        print(f'  Failed to read {path}: {e}', file=sys.stderr)
        return ''

now   = datetime.datetime.utcnow()
today = now.strftime('%Y-%m-%d')

# ── 1. Read style guide + voice guide ─────────────────────────────────────────

print('Loading scripting style guide...')
style_guide = read_file(STYLE_GUIDE)
if not style_guide:
    print('FATAL: No scripting style guide found.', file=sys.stderr)
    sys.exit(1)
print(f'  Loaded style guide ({len(style_guide)} chars).')

voice_guide = read_file(VOICE_GUIDE)
print(f'  Loaded voice guide ({len(voice_guide)} chars).')

# ── 2. Get Sheets token ──────────────────────────────────────────────────────

print('Getting Sheets token...')
gcp_token = post_form('https://oauth2.googleapis.com/token', {
    'client_id': SHEETS_CLIENT, 'client_secret': SHEETS_SECRET,
    'refresh_token': SHEETS_REFRESH, 'grant_type': 'refresh_token',
}).get('access_token', '')

if not gcp_token:
    print('FATAL: No Sheets token.', file=sys.stderr)
    sys.exit(1)

# ── 3. Fetch latest Content Ideas (this week's strategist output) ─────────────

print('Fetching Content Ideas...')
ideas_sheet = get(
    f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
    f'/values/Content%20Ideas!A:H',
    {'Authorization': f'Bearer {gcp_token}'}
)
ideas_rows = (ideas_sheet or {}).get('values', [])

# Get ideas from the last 7 days
recent_ideas = []
cutoff = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
for row in ideas_rows[1:]:  # skip header
    if len(row) >= 4 and row[0] >= cutoff:
        recent_ideas.append({
            'date': row[0],
            'title': row[1] if len(row) > 1 else '',
            'format': row[2] if len(row) > 2 else '',
            'hook': row[3] if len(row) > 3 else '',
            'confidence': row[4] if len(row) > 4 else '',
            'ig_hook': row[5] if len(row) > 5 else '',
        })

if not recent_ideas:
    print('No recent content ideas found (last 7 days). Exiting.')
    sys.exit(0)

print(f'  Found {len(recent_ideas)} recent ideas.')

# ── 4. Fetch top-performing transcripts as style examples ─────────────────────

print('Fetching transcripts for style reference...')
transcripts_sheet = get(
    f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
    f'/values/Raw%20Transcripts!A:D',
    {'Authorization': f'Bearer {gcp_token}'}
)
transcript_rows = (transcripts_sheet or {}).get('values', [])

# Get YouTube stats to identify top performers
print('Fetching YouTube stats...')
search = get(
    f'https://www.googleapis.com/youtube/v3/search'
    f'?part=snippet&channelId={YT_CHANNEL}&type=video&order=date&maxResults=50&key={YT_KEY}'
)
video_ids = ','.join(
    item['id']['videoId'] for item in (search.get('items') or [])
    if item.get('id', {}).get('videoId')
)

video_stats = {}
if video_ids:
    stats_resp = get(
        f'https://www.googleapis.com/youtube/v3/videos'
        f'?part=statistics,snippet,contentDetails&id={video_ids}&key={YT_KEY}'
    )
    for item in (stats_resp.get('items') or []):
        title = item.get('snippet', {}).get('title', '')
        views = int(item.get('statistics', {}).get('viewCount', 0))
        duration = item.get('contentDetails', {}).get('duration', '')
        is_short = bool(re.match(r'PT\d{1,2}S$|PT1M\d{0,2}S?$', duration))
        video_stats[title.lower().strip()] = {'views': views, 'is_short': is_short}

# Match transcripts to their view counts and pick top 5
scored_transcripts = []
for row in transcript_rows[1:]:
    if len(row) < 3:
        continue
    fname = row[1] if len(row) > 1 else ''
    transcript = row[2] if len(row) > 2 else ''
    if not transcript or len(transcript) < 50:
        continue
    # Fuzzy match filename to video title
    fname_words = set(re.findall(r'\w{4,}', fname.lower()))
    best_views = 0
    for title_lower, stats in video_stats.items():
        title_words = set(re.findall(r'\w{4,}', title_lower))
        if len(fname_words & title_words) >= 2:
            best_views = max(best_views, stats['views'])
    scored_transcripts.append({
        'filename': fname,
        'transcript': transcript,
        'views': best_views,
    })

# Sort by views, take top 5 as style examples
scored_transcripts.sort(key=lambda x: x['views'], reverse=True)
top_transcripts = scored_transcripts[:5]
print(f'  Top transcript examples: {[t["filename"][:40] + "..." for t in top_transcripts]}')

# ── 5. Generate scripts for each idea ─────────────────────────────────────────

# Build transcript examples string
examples_str = ''
for t in top_transcripts[:3]:  # Use top 3 to fit in context
    examples_str += f'\n--- EXAMPLE ({t["views"]:,} views): {t["filename"][:60]} ---\n{t["transcript"][:600]}\n'

scripts = []

for idea in recent_ideas[:5]:  # Script up to 5 ideas
    is_short = idea['format'].upper() in ('SHORT', 'SHORTS')
    target_words = '100-150' if is_short else '800-1200'
    target_duration = '30-60 seconds' if is_short else '5-12 minutes'

    print(f'  Writing script: {idea["title"][:50]}...')

    prompt = f"""You are writing a talk-to-camera script for George from ByeByeAdmin.
George records himself talking directly to camera about AI automation for UK haulage operators.

CRITICAL: This script must sound EXACTLY like George talks. Study the style guide and transcript examples below carefully. Match his sentence length, his transition phrases, his rhythm, and his way of explaining technical concepts.

SCRIPTING STYLE GUIDE:
{style_guide[:3000]}

BRAND VOICE:
{voice_guide[:800]}

TRANSCRIPT EXAMPLES FROM TOP-PERFORMING VIDEOS:
{examples_str}

NOW WRITE A SCRIPT FOR THIS IDEA:

Title: {idea['title']}
Format: {'YouTube Short (30-60 seconds)' if is_short else 'YouTube Long-form (5-12 minutes)'}
Hook suggestion: {idea['hook']}
Target word count: {target_words} words

Rules:
- Write in first person as George
- Match George's exact speaking patterns from the examples above
- Use his transition phrases: "So here's what happened...", "Let's find out", "But here's the really clever bit"
- Short sentences. Active voice. No corporate language.
- No em dashes anywhere
- Include [pause], [cut], and [B-roll: ...] markers for editing
- For Shorts: one idea, one demo/point, punchy CTA
- For Long-form: open loop first, intro after hook, step-by-step walkthrough, case study numbers, summary + next video CTA
- End with a follow/comment CTA that teases the next video
- Use specific haulage terms naturally: TMS, PODs, job sheets, tachograph, O-licence
- Include at least one specific number or stat
- Do NOT start with "Hey guys" or any greeting

Output format:
TITLE: [working title]
FORMAT: [Short/Long-form]
DURATION: [target]

---
SCRIPT:

[Full script with [pause], [cut], [B-roll] markers]

---
NOTES: [Production notes: what to show on screen, any props needed]"""

    script = call_llm(prompt, max_tokens=1800 if not is_short else 600)
    if script:
        scripts.append({
            'title': idea['title'],
            'format': idea['format'],
            'script': script,
        })
    else:
        print(f'    LLM failed for: {idea["title"]}', file=sys.stderr)

print(f'Generated {len(scripts)} scripts.')

if not scripts:
    print('No scripts generated. Exiting.', file=sys.stderr)
    sys.exit(1)

# ── 6. Log scripts to Sheets ─────────────────────────────────────────────────

print('Logging scripts to Scripts sheet...')
rows = []
for s in scripts:
    rows.append([today, s['title'][:80], s['format'], s['script'][:2000], 'draft'])

post_json(
    f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
    f'/values/Scripts!A:E:append?valueInputOption=USER_ENTERED',
    {'values': rows},
    {'Authorization': f'Bearer {gcp_token}'}
)

# ── 7. Post scripts to Slack ─────────────────────────────────────────────────

print('Posting scripts to Slack...')

header = f':clapper: *Recording Scripts: {now.strftime("w/c %-d %b %Y")}*\n{len(scripts)} scripts ready for you to record.\n\n'

for i, s in enumerate(scripts, 1):
    fmt_emoji = ':zap:' if s['format'].upper() in ('SHORT', 'SHORTS') else ':movie_camera:'
    msg = f'{fmt_emoji} *Script {i}: {s["title"]}* [{s["format"]}]\n\n{s["script"]}'

    if len(msg) > 3800:
        msg = msg[:3750] + '\n_[truncated: full script in Scripts sheet]_'

    # Post each script as a separate message for readability
    if i == 1:
        msg = header + msg

    result = post_json(
        'https://slack.com/api/chat.postMessage',
        {'channel': GEORGE, 'text': msg},
        {'Authorization': f'Bearer {SLACK_TOKEN}'}
    )
    if not result.get('ok'):
        print(f'  Slack error for script {i}: {result}', file=sys.stderr)

print('Script Writer complete.')
