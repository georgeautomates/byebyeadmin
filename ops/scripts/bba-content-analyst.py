#!/usr/bin/env python3
"""BBA Content Performance Analyst — runs Mon 8am UTC (before Content Strategist).
Fetches all YouTube videos, cross-references transcripts from Sheets, analyses
what's working (titles, hooks, subject areas, formats) and posts a performance
report to Slack #content-team + logs to Content Performance sheet.
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
SHEETS_CLIENT_ID   = os.environ.get('GOOGLE_CLIENT_ID', '')
SHEETS_SECRET      = os.environ.get('GOOGLE_CLIENT_SECRET', '')
SHEETS_REFRESH     = os.environ.get('GOOGLE_REFRESH_TOKEN', '')
SHEET_ID           = os.environ.get('GOOGLE_CONTENT_SHEET_ID', '')

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

def parse_duration(iso):
    """PT1M30S -> 90 seconds."""
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso or '')
    if not m:
        return 0
    h, mins, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mins * 60 + s

now     = datetime.datetime.utcnow()
today   = now.strftime('%Y-%m-%d')
wc      = now.strftime('w/c %-d %b %Y')
d7_ago  = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%dT00:00:00Z')

# ── 1. Fetch all YouTube videos (up to 50) ───────────────────────────────────

print('Fetching YouTube video catalog...')
all_videos = []
page_token = None

for _ in range(2):  # up to 100 videos (2 pages of 50)
    url = (
        f'https://www.googleapis.com/youtube/v3/search'
        f'?part=snippet&channelId={YT_CHANNEL}&type=video&order=date&maxResults=50&key={YT_KEY}'
    )
    if page_token:
        url += f'&pageToken={page_token}'
    search = get(url)
    items = search.get('items') or []
    if not items:
        break
    video_ids = ','.join(i['id']['videoId'] for i in items if i.get('id', {}).get('videoId'))
    if video_ids:
        stats = get(
            f'https://www.googleapis.com/youtube/v3/videos'
            f'?part=statistics,contentDetails,snippet&id={video_ids}&key={YT_KEY}'
        )
        for item in (stats.get('items') or []):
            s = item.get('statistics', {})
            sn = item.get('snippet', {})
            cd = item.get('contentDetails', {})
            duration_s = parse_duration(cd.get('duration', ''))
            published = sn.get('publishedAt', '')[:10]
            views = int(s.get('viewCount', 0))
            likes = int(s.get('likeCount', 0))
            comments = int(s.get('commentCount', 0))
            is_short = duration_s <= 90
            days_live = max(1, (now - datetime.datetime.strptime(published, '%Y-%m-%d')).days)
            all_videos.append({
                'id': item['id'],
                'title': sn.get('title', ''),
                'published': published,
                'duration_s': duration_s,
                'views': views,
                'likes': likes,
                'comments': comments,
                'format': 'SHORT' if is_short else 'LONG',
                'days_live': days_live,
                'views_per_day': round(views / days_live, 1),
                'engagement': likes + comments,
            })
    page_token = search.get('nextPageToken')
    if not page_token:
        break

print(f'  Fetched {len(all_videos)} videos total.')

if not all_videos:
    print('No videos found. Exiting.', file=sys.stderr)
    sys.exit(1)

# ── 2. Get GCP token + fetch transcripts from Sheets ─────────────────────────

print('Getting Sheets token...')
gcp_token = post_form('https://oauth2.googleapis.com/token', {
    'client_id': SHEETS_CLIENT_ID, 'client_secret': SHEETS_SECRET,
    'refresh_token': SHEETS_REFRESH, 'grant_type': 'refresh_token',
}).get('access_token', '')

transcripts = {}  # title -> transcript text
if gcp_token and SHEET_ID:
    print('Fetching transcripts from Raw Transcripts sheet...')
    sheet = get(
        f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
        f'/values/Raw%20Transcripts!A:D',
        {'Authorization': f'Bearer {gcp_token}'}
    )
    rows = (sheet or {}).get('values', [])
    for row in rows[1:]:  # skip header
        if len(row) >= 3:
            fname = row[1] if len(row) > 1 else ''
            transcript = row[2] if len(row) > 2 else ''
            if fname and transcript:
                transcripts[fname.lower().strip()] = transcript
    print(f'  Found {len(transcripts)} transcripts.')

# ── 3. Compute performance metrics ───────────────────────────────────────────

# Split by format
shorts = [v for v in all_videos if v['format'] == 'SHORT']
longs  = [v for v in all_videos if v['format'] == 'LONG']

# Top 5 by views per day (normalised for age)
top_by_vpd = sorted(all_videos, key=lambda v: v['views_per_day'], reverse=True)[:5]

# Top 5 by raw views
top_by_views = sorted(all_videos, key=lambda v: v['views'], reverse=True)[:5]

# Top 5 by engagement (likes + comments)
top_by_engagement = sorted(all_videos, key=lambda v: v['engagement'], reverse=True)[:5]

# This week's uploads
this_week = [v for v in all_videos if v['published'] >= d7_ago[:10]]

# Average views per day: shorts vs longs
avg_vpd_shorts = round(sum(v['views_per_day'] for v in shorts) / max(1, len(shorts)), 1) if shorts else 0
avg_vpd_longs  = round(sum(v['views_per_day'] for v in longs) / max(1, len(longs)), 1) if longs else 0

# Average total views
avg_views_shorts = round(sum(v['views'] for v in shorts) / max(1, len(shorts)))
avg_views_longs  = round(sum(v['views'] for v in longs) / max(1, len(longs)))

# ── 4. Build transcript snippets for top performers ──────────────────────────

def find_transcript(title):
    """Fuzzy match a video title to a transcript filename."""
    title_lower = title.lower()
    for fname, text in transcripts.items():
        # Match on significant words from title
        title_words = set(re.findall(r'\w{4,}', title_lower))
        fname_words = set(re.findall(r'\w{4,}', fname))
        if len(title_words & fname_words) >= 2:
            return text[:500]
    return ''

transcript_context = ''
for v in top_by_vpd[:5]:
    t = find_transcript(v['title'])
    if t:
        transcript_context += f"\n--- {v['title']} ({v['views']:,} views, {v['views_per_day']} vpd) ---\nHook (first ~100 words): {t[:400]}\n"

# ── 5. LLM analysis ──────────────────────────────────────────────────────────

print('Generating performance analysis...')

video_table = '\n'.join(
    f"- {v['title']} | {v['format']} | {v['published']} | {v['views']:,} views | "
    f"{v['views_per_day']} vpd | {v['likes']} likes | {v['comments']} comments"
    for v in sorted(all_videos, key=lambda v: v['views_per_day'], reverse=True)[:25]
)

prompt = f"""You are a YouTube content performance analyst for ByeByeAdmin, a UK haulage AI automation channel.
Analyse this video data and give George a clear, actionable weekly performance report.

CHANNEL STATS:
- Total videos: {len(all_videos)} ({len(shorts)} Shorts, {len(longs)} long-form)
- Avg views/day (Shorts): {avg_vpd_shorts} | Avg views/day (Long): {avg_vpd_longs}
- Avg total views (Shorts): {avg_views_shorts:,} | Avg total views (Long): {avg_views_longs:,}
- Videos published this week: {len(this_week)}

TOP 25 VIDEOS BY VIEWS PER DAY:
{video_table}

{f'TRANSCRIPT HOOKS FROM TOP PERFORMERS:{transcript_context}' if transcript_context else ''}

Write a Slack report with these EXACT sections:

1. *This Week's Performance* — how did videos published in the last 7 days perform vs channel average?

2. *What's Working* — identify 3-4 specific patterns from the top performers:
   - Title patterns (what words/structures drive clicks?)
   - Subject areas (which topics consistently outperform?)
   - Hooks (if transcripts available, what opening styles grab attention?)
   - Format (Shorts vs Long: which is winning and why?)

3. *What's Underperforming* — identify 2-3 patterns from the bottom performers. What to avoid.

4. *Recommendations* — 3 specific, actionable recommendations for next week's content:
   - "Do more of X because Y"
   - "Try changing Z because the data shows W"
   - One experiment to test

Rules:
- No em dashes anywhere
- Be specific: name actual videos, quote actual numbers
- Keep it under 600 words
- Use Slack formatting (*bold*, _italic_, bullet points)
- Start with a one-line summary verdict (e.g. "Strong week: personal story content is 3x outperforming demos")
"""

analysis = call_llm(prompt, max_tokens=1200)
if not analysis:
    analysis = ':warning: Content performance analysis failed. Check cron.log.'
    print('  LLM returned no content.', file=sys.stderr)
else:
    print(f'  Generated analysis ({len(analysis)} chars).')

# ── 6. Log to Content Performance sheet ──────────────────────────────────────

if gcp_token and SHEET_ID and 'failed' not in analysis:
    print('Logging to Content Performance sheet...')
    top_titles = ' | '.join(v['title'][:40] for v in top_by_vpd[:3])
    row = [
        today,
        str(len(all_videos)),
        str(len(this_week)),
        str(avg_vpd_shorts),
        str(avg_vpd_longs),
        top_titles[:200],
        analysis[:1500],
    ]
    post_json(
        f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}'
        f'/values/Content%20Performance!A:G:append?valueInputOption=USER_ENTERED',
        {'values': [row]},
        {'Authorization': f'Bearer {gcp_token}'}
    )
    print('  Logged performance data.')

# ── 7. Post to Slack ─────────────────────────────────────────────────────────

header = f':bar_chart: *Content Performance Report: {wc}*\n'
msg = header + analysis
if len(msg) > 3800:
    msg = msg[:3750] + '\n_[truncated: full report in Content Performance sheet]_'

print('Posting to Slack...')
result = post_json(
    'https://slack.com/api/chat.postMessage',
    {'channel': GEORGE, 'text': msg},
    {'Authorization': f'Bearer {SLACK_TOKEN}'}
)
if result.get('ok'):
    print('Content performance report sent.')
else:
    print(f'Slack error: {result}', file=sys.stderr)
    sys.exit(1)
