#!/usr/bin/env python3
"""BBA Agent Handbook — creates a Google Doc with employee-handbook-style profiles
for all Paperclip agents.

Run once on demand. Creates a new doc and prints the URL.
"""

import os, json
import urllib.request, urllib.parse

def load_env():
    path = '/home/openclaw/byebyeadmin/ops/.env'
    if not os.path.exists(path):
        path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '..', '.env.local')
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, val = line.partition('=')
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

load_env()

P_CLIENT_ID  = os.environ['GOOGLE_DRIVE_CLIENT_ID']
P_SECRET     = os.environ['GOOGLE_DRIVE_CLIENT_SECRET']
P_REFRESH    = os.environ['GOOGLE_DRIVE_REFRESH_TOKEN']

# ── auth ──────────────────────────────────────────────────────────────────────

def get_token():
    body = urllib.parse.urlencode({
        'client_id': P_CLIENT_ID, 'client_secret': P_SECRET,
        'refresh_token': P_REFRESH, 'grant_type': 'refresh_token',
    }).encode()
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=body,
        headers={'Content-Type': 'application/x-www-form-urlencoded'})
    resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
    if 'access_token' not in resp:
        raise RuntimeError(f'Token exchange failed: {resp}')
    return resp['access_token']

def docs_post(path, data, token):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f'https://docs.googleapis.com/v1{path}', data=body,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

# ── agent profiles ─────────────────────────────────────────────────────────────
# Written inline — accurate as of 2026-03-29

AGENTS = [
    {
        "name": "Johnson",
        "title": "Chief of Staff",
        "role": "CEO / Slack Router",
        "schedule": "Always on — Socket Mode listener",
        "soul": "Johnson is the nerve centre of BBA operations. Every message George sends to Slack flows through Johnson first. He doesn't make decisions — he routes them. Calm, precise, tireless. The agent who keeps everything else moving.",
        "heartbeat": "Johnson wakes the moment George DMs the BBA Slack workspace. He parses the intent, decides which specialist to hand off to, and makes sure the right agent responds. When nothing needs routing, he is silent.",
        "what_they_do": [
            "Listens to all Slack DMs via Socket Mode (never misses a message)",
            "Routes blog requests (blog: [topic]) to Blog Writer",
            "Routes campaign requests (campaign: [segment]) to Campaign Builder",
            "Routes blog approval (blog ok) to trigger the full post write",
            "Routes campaign approval (approve campaign: [segment]) to Instantly",
            "Handles ad-hoc chat and research via bba-chat fallback",
            "Passes unknown queries to LLM for direct response",
        ],
        "produces": "Immediate Slack responses. Agent handoffs. Never posts unprompted.",
        "tools": ["Slack Socket Mode API", "VPS paperclip-webhook.py", "slack-router.js"],
        "reports_to": None,
    },
    {
        "name": "Morning Brief",
        "title": "Daily Intelligence Officer",
        "role": "Data Aggregator",
        "schedule": "8am UTC, Monday to Friday",
        "soul": "Morning Brief is the first voice George hears each weekday. Concise, factual, no fluff. It pulls every number that matters overnight and lays them out cleanly so George can scan in 30 seconds and know whether today needs action or can flow normally.",
        "heartbeat": "Monday to Friday at 8am UTC, Morning Brief wakes, fetches the latest stats from every live system, and posts a single structured summary to George's Slack DM. If any signal is off — reply spike, subscriber drop, unusual traffic — it flags it.",
        "what_they_do": [
            "Fetches Instantly campaign stats: sent, open rate, reply rate, new replies since yesterday",
            "Fetches YouTube subscriber count and 7-day view stats",
            "Fetches GA4 sessions (last 7 days vs prior week) for byebyeadmin.co.uk",
            "Fetches Clarity: bounce rate, session duration, dead clicks",
            "Formats everything into one clean Slack message with deltas",
            "Flags anomalies (reply spike >5, sub loss, traffic drop >20%)",
        ],
        "produces": "One Slack DM every weekday morning. No Sheets logging.",
        "tools": ["Instantly API", "YouTube Data API v3", "GA4 (Google Analytics 4)", "Microsoft Clarity API", "Slack Bot API"],
        "reports_to": "Johnson",
    },
    {
        "name": "Weekly Analytics",
        "title": "KPI Analyst",
        "role": "Performance Tracker",
        "schedule": "8:30am UTC, every Monday",
        "soul": "Weekly Analytics is the honest mirror. It doesn't spin numbers — it compares this week to last week and tells you exactly what moved and why. George relies on it to cut through the noise and see which channels are actually working.",
        "heartbeat": "Every Monday at 8:30am UTC, Weekly Analytics pulls a full 7-day window from all data sources, calculates week-on-week deltas, writes the complete KPI set to Google Sheets for history, then posts the highlights to Slack.",
        "what_they_do": [
            "Pulls 7-day Instantly stats: sent, opens, replies, positive intent, leads booked",
            "Pulls YouTube: new subscribers, total views, top video last 7 days",
            "Pulls GA4: sessions, users, bounce rate, top pages — with WoW delta",
            "Calculates percentage changes and flags significant moves",
            "Writes full row to Analytics State Google Sheet for trend tracking",
            "Posts summary to Slack with section headers and key deltas highlighted",
        ],
        "produces": "Weekly Slack KPI summary. Row written to Analytics State sheet.",
        "tools": ["Instantly API", "YouTube Data API v3", "GA4 (Workspace token)", "Google Sheets (personal token)", "Slack Bot API"],
        "reports_to": "Johnson",
    },
    {
        "name": "Pipeline Engineer",
        "title": "Content Pipeline Operator",
        "role": "Video Processing & Publishing",
        "schedule": "9am and 5pm UTC, every day",
        "soul": "Pipeline Engineer is the engine room. It doesn't create ideas — it takes raw video from Google Drive, transcribes it, generates all the publishing assets, and queues everything in Buffer. Methodical, thorough, no opinion on the content itself.",
        "heartbeat": "Twice daily, Pipeline Engineer scans the Google Drive content folder for new video files. When it finds one, it extracts audio, transcribes via Whisper, generates 3 title options, 3 IG captions, a LinkedIn post, a YouTube description, and posts a Slack approval card. On approval, it schedules the Buffer post and logs to Sheets.",
        "what_they_do": [
            "Scans Google Drive folder for unprocessed video files",
            "Extracts audio via ffmpeg then transcribes via OpenAI Whisper (streaming via curl for large files)",
            "Generates 3 title options, 3 IG hooks, LinkedIn post, YouTube description",
            "Posts Slack approval card with all options",
            "On 'approve [run_id]': schedules to Buffer YouTube queue",
            "Triggers Copywriter for brand voice audit post-approval",
            "Logs run to Pending Approvals Google Sheet",
        ],
        "produces": "Slack approval card. On approval: Buffer queue entry + Sheets log + Copywriter trigger.",
        "tools": ["Google Drive API", "OpenAI Whisper", "Buffer GraphQL API", "Google Sheets", "Slack Bot API"],
        "reports_to": "Johnson",
    },
    {
        "name": "Website Analyst",
        "title": "CRO & UX Investigator",
        "role": "Website Performance Reviewer",
        "schedule": "8am UTC, every Sunday",
        "soul": "Website Analyst thinks like a conversion rate optimiser who's been watching byebyeadmin.co.uk for months. It doesn't just report — it makes specific recommendations backed by data. Every Sunday it tells George what to fix on the site this week.",
        "heartbeat": "Every Sunday at 8am UTC, Website Analyst pulls the full week of GA4 and Clarity data, cross-references traffic with behaviour signals, identifies the 3 highest-leverage CRO actions, writes them to the CRO Backlog Google Sheet, and posts a report to Slack.",
        "what_they_do": [
            "Pulls GA4: page-level traffic, session duration, conversion events, drop-off points",
            "Pulls Clarity: rage clicks, dead clicks, excessive scrolling, bounce patterns",
            "Identifies highest-friction pages vs highest-value pages",
            "Generates 3 specific CRO tasks with priority and rationale",
            "Writes tasks to CRO Backlog Google Sheet with date and evidence",
            "Posts full weekly site report to Slack",
        ],
        "produces": "Weekly Slack website report. 3 tasks written to CRO Backlog sheet.",
        "tools": ["GA4 (Workspace token)", "Microsoft Clarity API", "Google Sheets (personal token)", "Slack Bot API"],
        "reports_to": "Johnson",
    },
    {
        "name": "Hot Lead Monitor",
        "title": "Reply Intelligence & Hot Lead Classifier",
        "role": "Sales Intelligence",
        "schedule": "Every 4 hours (silent midnight-6am UTC)",
        "soul": "Hot Lead Monitor is the sales hawk. It reads every reply that comes into the Instantly campaigns and immediately knows who's interested. It doesn't wait for an explicit yes — it reads between the lines. A fleet manager asking about pricing IS a hot lead. It makes sure George never misses one.",
        "heartbeat": "Every 4 hours (except overnight), Hot Lead Monitor fetches all new replies from Instantly campaigns. It classifies each as HOT, WARM, or COLD using an LLM that understands the nuance of UK haulage buying signals. HOT leads get a suggested reply and a fire alert in Slack. All hot leads are logged to Google Sheets.",
        "what_they_do": [
            "Fetches all new replies from Instantly since last check",
            "Reads last 5 Sheets rows per sender to avoid duplicate alerts",
            "Classifies HOT/WARM/COLD in one batch LLM call (JSON array)",
            "Detects implied interest: fleet context, pricing questions, operational language",
            "Generates 2-sentence personalised reply suggestion per HOT lead",
            "Posts fire alert with reply text + suggested response to Slack",
            "Logs only HOT leads to Hot Leads Google Sheet",
        ],
        "produces": "Slack fire alerts for HOT leads with reply drafts. Hot Leads sheet entries.",
        "tools": ["Instantly API", "Google Sheets", "LLM cascade (Anthropic/Gemini/OpenAI)", "Slack Bot API"],
        "reports_to": "Johnson",
    },
    {
        "name": "Content Strategist",
        "title": "Weekly Content Planner & Trend Researcher",
        "role": "Content Strategy",
        "schedule": "9am UTC, every Monday",
        "soul": "Content Strategist is the show runner. It watches what's happening in UK haulage, checks what's working on the channel, and produces a weekly content plan that's genuinely strategic — not just filler. It knows the audience and won't suggest anything generic.",
        "heartbeat": "Every Monday at 9am UTC, Content Strategist researches live UK haulage trends via Perplexity, checks the last 10 YouTube videos and their performance, scans the Buffer queue for upcoming posts, then generates 5 video ideas: 2 YouTube Shorts and 3 long-form. Each idea has a confidence score, hook, key points, and IG caption. All ideas log to Sheets. The plan goes to Slack.",
        "what_they_do": [
            "Queries Perplexity sonar-pro for UK haulage/logistics news (2 queries)",
            "Fetches last 10 YouTube videos with view and like counts",
            "Checks Buffer queue for next 7 days to avoid duplication",
            "Generates 5 ideas: exactly 2 Shorts + 3 long-form (60-char titles, no em dashes)",
            "Each idea: confidence score/10, hook, 3 key points, CTA, IG caption",
            "Logs all 5 ideas to Content Ideas Google Sheet",
            "Posts weekly content plan to Slack",
        ],
        "produces": "Monday content plan in Slack. 5 ideas written to Content Ideas sheet.",
        "tools": ["Perplexity API", "YouTube Data API v3", "Buffer GraphQL API", "Google Sheets", "LLM cascade", "Slack Bot API"],
        "reports_to": "Johnson",
    },
    {
        "name": "Blog Writer",
        "title": "SEO Blog Writer & Publisher",
        "role": "Content Creation",
        "schedule": "On demand via Slack: blog: [topic]",
        "soul": "Blog Writer is the craftsman. It doesn't produce content for content's sake — it researches, structures for SEO, writes with the BBA voice, and ships to production. Two-stage so George stays in control: review the outline before a word is written.",
        "heartbeat": "When George sends 'blog: [topic]', Blog Writer queries Perplexity for UK haulage data around the topic, generates an SEO-optimised outline with target keywords, and posts it to Slack for review. On 'blog ok', it writes the full 1,000-word post with FAQ, creates an MDX file, commits and pushes to the repo, creates a Google Doc for editing, logs to Sheets, and triggers the Copywriter audit.",
        "what_they_do": [
            "Stage 1: Perplexity research + outline with H1, H2s, target keywords, meta description",
            "Stage 2 (on 'blog ok'): Full 1,000-word post with 7-10 FAQ Q&As",
            "MDX publish: writes to content/blog/, git commits and pushes, triggers Vercel deploy",
            "Google Doc creation in Drive for easy editing",
            "Logs to Blog Queue sheet: status, doc URL, slug, publish date, keyword targets",
            "Triggers Copywriter to audit brand voice consistency",
        ],
        "produces": "Slack outline for review. On approval: live blog post + Google Doc + Sheets entry + Copywriter audit.",
        "tools": ["Perplexity API", "Google Docs API", "Google Drive API", "Google Sheets", "GitHub (git push)", "Vercel deploy hook", "LLM cascade", "Slack Bot API"],
        "reports_to": "Johnson",
    },
    {
        "name": "Campaign Builder",
        "title": "Cold Email Campaign Architect",
        "role": "Sales Automation",
        "schedule": "On demand via Slack: campaign: [segment]",
        "soul": "Campaign Builder is the strategist who turns a target segment into a fully loaded cold email campaign in minutes. It knows UK haulage buyers don't respond to generic pitches — so every sequence is variable-length, tiered, and built for the specific pain point George names.",
        "heartbeat": "When George sends 'campaign: [segment]', Campaign Builder generates a 3, 5, or 7-email sequence (choosing intelligently by segment warmth), writes it to a Campaign Drafts Google Sheet for review, and posts a preview to Slack. On 'approve campaign: [segment]', it creates the campaign in Instantly, uploads the sequence, and reports the result.",
        "what_they_do": [
            "Receives segment description from Slack (e.g. 'cold 50+ vehicle fleets')",
            "Determines optimal sequence length: 3 (hyper-targeted), 5 (warm), 7 (cold broad)",
            "Writes full email sequence with subject lines, body, PS lines, spintax variants",
            "Writes draft to Campaign Drafts Google Sheet for manual review",
            "Posts preview to Slack with sequence summary",
            "On approval: creates Instantly campaign, uploads sequence, configures sending schedule",
            "Reports campaign ID and confirmation back to Slack",
        ],
        "produces": "Campaign Drafts sheet entry. On approval: live Instantly campaign ready to launch.",
        "tools": ["Instantly API", "Google Sheets", "LLM cascade", "Slack Bot API"],
        "reports_to": "Johnson",
    },
    {
        "name": "CEO Weekly Brief",
        "title": "Sunday CEO Synthesiser & Strategic Advisor",
        "role": "Strategic Intelligence",
        "schedule": "11am UTC, every Sunday",
        "soul": "CEO Weekly Brief is the boardroom update George never has to write himself. It synthesises everything from the week — numbers, competitors, decisions pending — into a tight executive summary. It ends with a momentum score and 3 recommended actions. It speaks to George as a founder, not a data analyst.",
        "heartbeat": "Every Sunday at 11am UTC, CEO Weekly Brief pulls data from all active channels, queries Perplexity for competitor and market developments, reviews the decision log, assesses overall system health, and posts a comprehensive Sunday summary to Slack. Tone: direct, strategic, brief.",
        "what_they_do": [
            "Pulls week KPIs: Instantly (email performance), YouTube (growth), GA4 (site traffic), hot leads count",
            "Queries Perplexity for UK haulage competitor news and market developments",
            "Reviews logged decisions and pending items from CEO Briefs sheet",
            "Assesses agent health: any cron failures, token issues, anomalies",
            "Calculates momentum score 1-10 based on combined signals",
            "Writes brief to CEO Briefs Google Sheet for history",
            "Posts to Slack: KPIs + intel + momentum score + 3 recommended actions",
        ],
        "produces": "Sunday strategic brief in Slack. Row written to CEO Briefs sheet.",
        "tools": ["Instantly API", "YouTube Data API v3", "GA4 (Workspace token)", "Perplexity API", "Google Sheets (personal token)", "LLM cascade", "Slack Bot API"],
        "reports_to": None,
    },
    {
        "name": "Queue Sentinel",
        "title": "Buffer Queue Monitor",
        "role": "Content Operations",
        "schedule": "6am UTC, every day",
        "soul": "Queue Sentinel is the quiet guardian of the content calendar. It doesn't create — it watches. The moment the Buffer YouTube queue drops below 3 videos, it wakes George up and suggests topics to fill the gap. Because an empty queue means dead air, and dead air costs subscribers.",
        "heartbeat": "Every morning at 6am UTC, Queue Sentinel checks how many posts are in the Buffer YouTube queue for the next 7 days. If the count is 3 or fewer, it uses the LLM to suggest 3 quick video ideas based on recent trends and posts an alert to Slack. If the queue is healthy, it stays silent.",
        "what_they_do": [
            "Checks Buffer YouTube queue: counts posts scheduled in next 7 days",
            "If count > 3: exits silently",
            "If count <= 3: generates 3 quick video topic suggestions using LLM",
            "Posts queue alert to Slack with current count and topic suggestions",
        ],
        "produces": "Slack queue alert (only when count <= 3). Silent otherwise.",
        "tools": ["Buffer GraphQL API", "LLM cascade", "Slack Bot API"],
        "reports_to": "Johnson",
    },
    {
        "name": "Copywriter",
        "title": "Brand Voice Auditor",
        "role": "Quality Control",
        "schedule": "Triggered after pipeline approvals and blog publishes",
        "soul": "Copywriter is the brand guardian. It has read the voice guide so many times it could quote it from memory. It only speaks when there's a problem — and when it does, it's precise about what's off and why. George never sees a flagged post that doesn't have a specific fix.",
        "heartbeat": "Copywriter is triggered automatically by Pipeline Engineer and Blog Writer after content is approved and published. It reads the full content against the BBA voice guide, checks for em dashes, passive constructions, generic phrases, and off-brand tone. If it finds issues, it DMs George directly. If everything is clean, it logs to the Brand Voice Log sheet and says nothing.",
        "what_they_do": [
            "Receives content text and type (video title/description or blog post)",
            "Reads brand-context/voice.md for current rules",
            "Audits for em dashes, passive voice, generic phrases, off-brand tone",
            "Checks titles for specificity, length (under 60 chars for video), no filler words",
            "If issues found: DMs George with specific flagged text + recommended fix",
            "Always logs audit result to Brand Voice Log Google Sheet",
        ],
        "produces": "Slack DM only if issues found. Always logs to Brand Voice Log sheet.",
        "tools": ["Google Sheets", "LLM cascade", "Slack Bot API"],
        "reports_to": "Johnson",
    },
    {
        "name": "BBA Stack",
        "title": "Infrastructure & API Reference",
        "role": "Reference Catalog",
        "schedule": "Not an active agent — reference only",
        "soul": "BBA Stack is the memory of the machine. It knows every API key that's been wired in, every CLI that's been installed, every MCP that's been connected. When a new agent needs to be built, you start by reading BBA Stack. It is the source of truth for 'does this tool exist and where do I find it.'",
        "heartbeat": "BBA Stack doesn't run on a schedule. It exists to be read. Every time a new tool is added to the stack, its record here is updated. When something breaks and the credential is suspect, BBA Stack tells you which env var to check and where it's stored.",
        "what_they_do": [
            "Documents every API: name, env var, where stored (VPS/.env.local/Vercel), which scripts use it",
            "Documents every CLI: binary path on Mac and VPS, what it's used for",
            "Documents every MCP: package/URL, purpose, which Claude Code tools it enables",
            "Documents Google OAuth: two accounts, scopes, credential prefixes, health check location",
            "Lists deprecated vars to remove (GMAIL_* legacy credentials)",
        ],
        "produces": "Nothing — it is read, not run.",
        "tools": ["Paperclip metadata only"],
        "reports_to": None,
    },
]

# ── Google Docs creation ──────────────────────────────────────────────────────

print('Getting Google token...')
token = get_token()
print('  Token OK.')

# Create blank document
print('Creating Google Doc...')
doc = docs_post('/documents', {'title': 'BBA Agent Handbook'}, token)
doc_id = doc['documentId']
print(f'  Doc created: {doc_id}')

# Build the full document text as a series of batchUpdate requests
# We'll insert all content in one batchUpdate, building from the end backwards
# (Docs API inserts at index, so we insert in reverse order to avoid shifting)

# First build all content as segments with their styles
# Format: list of (text, style) where style is 'heading1', 'heading2', 'normal', 'bullet'

def h1(t): return (t + '\n', 'HEADING_1')
def h2(t): return (t + '\n', 'HEADING_2')
def h3(t): return (t + '\n', 'HEADING_3')
def p(t):  return (t + '\n', 'NORMAL_TEXT')
def sep(): return ('──────────────────────────────────────────\n', 'NORMAL_TEXT')

segments = []

# Cover
segments.append(h1('BBA Agent Handbook'))
segments.append(p('ByeByeAdmin AI Operations — as of March 2026'))
segments.append(p('This handbook profiles every agent in the BBA Paperclip workspace. Each agent has a defined role, schedule, and output. Read it to understand who does what, when, and why.'))
segments.append(p(''))

for i, agent in enumerate(AGENTS):
    segments.append(sep())
    segments.append(h2(f'{agent["name"]}'))
    segments.append(h3(agent["title"]))
    segments.append(p(f'Role: {agent["role"]}'))
    segments.append(p(f'Schedule: {agent["schedule"]}'))
    segments.append(p(f'Reports to: {agent["reports_to"] or "George (directly)"}'))
    segments.append(p(''))

    segments.append(h3('Soul'))
    segments.append(p(agent['soul']))
    segments.append(p(''))

    segments.append(h3('Heartbeat'))
    segments.append(p(agent['heartbeat']))
    segments.append(p(''))

    segments.append(h3('What they do'))
    for item in agent['what_they_do']:
        segments.append((f'• {item}\n', 'NORMAL_TEXT'))
    segments.append(p(''))

    segments.append(h3('What they produce'))
    segments.append(p(agent['produces']))
    segments.append(p(''))

    segments.append(h3('Tools'))
    segments.append(p(', '.join(agent['tools'])))
    segments.append(p(''))

# Build batchUpdate requests
# Insert all text first as one block, then apply styles
full_text = ''
segment_positions = []
pos = 1  # Docs API index starts at 1, after the initial empty paragraph

for text, style in segments:
    segment_positions.append((pos, pos + len(text), style))
    pos += len(text)
    full_text += text

requests = []

# 1. Insert all text at once
requests.append({
    'insertText': {
        'location': {'index': 1},
        'text': full_text,
    }
})

# 2. Apply paragraph styles
for start, end, style in segment_positions:
    if style != 'NORMAL_TEXT':
        requests.append({
            'updateParagraphStyle': {
                'range': {'startIndex': start, 'endIndex': end},
                'paragraphStyle': {'namedStyleType': style},
                'fields': 'namedStyleType',
            }
        })

print(f'Applying formatting ({len(requests)} requests)...')

# Split into batches of 50 to stay under API limits
for i in range(0, len(requests), 50):
    batch = requests[i:i+50]
    docs_post(f'/documents/{doc_id}:batchUpdate', {'requests': batch}, token)
    print(f'  Batch {i//50 + 1} done.')

doc_url = f'https://docs.google.com/document/d/{doc_id}/edit'
print(f'\nHandbook created: {doc_url}')
