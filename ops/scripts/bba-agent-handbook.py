#!/usr/bin/env python3
"""BBA Agent Handbook — creates or updates a Google Doc with employee-handbook-style profiles.

Usage:
  python3 bba-agent-handbook.py                    # create new doc
  python3 bba-agent-handbook.py --update DOC_ID    # overwrite existing doc
"""

import os, json, sys
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

def docs_get(path, token):
    req = urllib.request.Request(f'https://docs.googleapis.com/v1{path}',
        headers={'Authorization': f'Bearer {token}'})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

def docs_post(path, data, token):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f'https://docs.googleapis.com/v1{path}', data=body,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

# ── agent profiles ─────────────────────────────────────────────────────────────

AGENTS = [
    {
        "name": "Johnson",
        "title": "Chief of Operations",
        "role": "Slack Router / Command Hub",
        "schedule": "Always on — Slack Socket Mode listener",
        "soul": "Johnson is the nerve centre of BBA operations. Every message George sends to Slack flows through Johnson first. He doesn't make decisions — he routes them. Calm, precise, tireless. The agent who keeps everything else moving.",
        "heartbeat": "Johnson wakes the moment George DMs the BBA Slack workspace. He parses the intent, decides which specialist to hand off to, and makes sure the right agent responds. When nothing needs routing, he is silent.",
        "what_they_do": [
            "Listens to all Slack DMs via Socket Mode (never misses a message)",
            "Routes blog requests (blog: [topic]) to Blog Writer for outline generation",
            "Routes blog approval (blog ok) to trigger the full post write",
            "Routes campaign requests (campaign: [segment]) to Campaign Builder",
            "Routes campaign approval (approve campaign: [segment]) to Instantly create",
            "Relays Copywriter audit triggers after pipeline and blog approvals",
            "Handles ad-hoc chat and research via direct LLM fallback",
            "Passes unknown queries to LLM for inline response",
        ],
        "produces": "Immediate Slack responses. Agent handoffs. Never posts unprompted.",
        "tools": ["Slack Socket Mode API", "paperclip-webhook.py (port 8765)", "slack-router.js"],
        "reports_to": None,
        "skills": [
            "Intent routing: parses every George DM and routes to correct agent",
            "Two-stage approval flow: blog outline then post; campaign draft then Instantly create",
            "Ad-hoc LLM response: calls LLM directly for unmatched messages",
            "Copywriter trigger relay: passes audit triggers from pipeline and blog approvals",
        ],
    },
    {
        "name": "Morning Brief",
        "title": "Daily Intelligence Officer",
        "role": "Data Aggregator",
        "schedule": "8am UTC, Monday to Friday",
        "soul": "Morning Brief is the first voice George hears each weekday. Concise, factual, no fluff. It pulls every number that matters overnight and lays them out cleanly so George can scan in 30 seconds and know whether today needs action or can flow normally.",
        "heartbeat": "Monday to Friday at 8am UTC, Morning Brief fetches the latest stats from every live system and posts a single structured summary to George's Slack DM. If any signal is off — reply spike, subscriber drop, unusual traffic — it flags it.",
        "what_they_do": [
            "Fetches Instantly campaign stats: sent, open rate, reply rate, new replies since yesterday",
            "Fetches YouTube subscriber count and 7-day view stats",
            "Fetches GA4 sessions (yesterday vs prior day) for byebyeadmin.co.uk",
            "Fetches Clarity: bounce rate, session duration, dead clicks",
            "Formats all data through LLM into one clean Slack message with deltas",
            "Flags anomalies: reply spike >5, subscriber loss, traffic drop >20%",
        ],
        "produces": "One Slack DM every weekday morning. No Sheets logging.",
        "tools": ["Instantly API", "YouTube Data API v3", "GA4 (Workspace token)", "Microsoft Clarity API", "Slack Bot API", "LLM cascade"],
        "reports_to": "Johnson",
        "skills": [
            "Instantly stats pull: last 24h sent, open rate, reply rate, new replies since yesterday",
            "YouTube subscriber check: current subscriber count and 7-day views",
            "GA4 session summary: yesterday sessions and assessment views vs prior day",
            "Clarity insights: bounce rate, session duration, dead click count",
            "Anomaly flagging: highlights significant changes above threshold",
        ],
    },
    {
        "name": "Weekly Analytics",
        "title": "Weekly KPI Analyst",
        "role": "Performance Tracker",
        "schedule": "8:30am UTC, every Monday",
        "soul": "Weekly Analytics is the honest mirror. It doesn't spin numbers — it compares this week to last week and tells you exactly what moved and why. George relies on it to cut through the noise and see which channels are actually working.",
        "heartbeat": "Every Monday at 8:30am UTC, Weekly Analytics pulls a full 7-day window from all data sources, calculates week-on-week deltas, writes the complete KPI set to Google Sheets for history, then posts the highlights to Slack.",
        "what_they_do": [
            "Pulls 7-day Instantly stats: sent, opens, replies, positive intent, leads booked",
            "Pulls YouTube: new subscribers, total views, top video last 7 days",
            "Pulls GA4: sessions, users, bounce rate, top pages with WoW delta",
            "Calculates percentage changes and flags significant moves",
            "Writes full row to Analytics State Google Sheet for trend tracking",
            "Posts summary to Slack with section headers and key deltas highlighted",
        ],
        "produces": "Weekly Slack KPI summary. Row written to Analytics State sheet.",
        "tools": ["Instantly API", "YouTube Data API v3", "GA4 (Workspace token)", "Google Sheets (personal token)", "Slack Bot API"],
        "reports_to": "Johnson",
        "skills": [
            "7-day data pull: Instantly, YouTube, and GA4 stats for last 7 days vs prior 7 days",
            "WoW delta calculation: percentage changes for every metric with significant move flags",
            "Sheets logging: complete KPI row to Analytics State sheet for historical trends",
            "Slack summary: clean weekly summary with section headers and deltas highlighted",
        ],
    },
    {
        "name": "Pipeline Engineer",
        "title": "Content Pipeline Operator",
        "role": "Video Processing and Publishing",
        "schedule": "9am + 5pm UTC daily (check); noon UTC daily (chase)",
        "soul": "Pipeline Engineer is the engine room. It doesn't create ideas — it takes raw video from Google Drive, transcribes it, generates all the publishing assets, and queues everything in Buffer. Methodical, thorough, no opinion on the content itself.",
        "heartbeat": "Twice daily, Pipeline Engineer scans Google Drive for new video files. When it finds one, it extracts audio, transcribes via Whisper, generates 3 title options, 3 IG captions, a LinkedIn post, and a YouTube description, then posts a Slack approval card. On approval, it schedules to Buffer and triggers Copywriter. At noon it chases any Buffer drafts due today that haven't published.",
        "what_they_do": [
            "Scans Google Drive folder for unprocessed video files",
            "Extracts audio via ffmpeg, transcribes via OpenAI Whisper (streaming curl for large files)",
            "Generates 3 title options, 3 IG hooks, LinkedIn post, YouTube description",
            "Posts Slack approval card with all asset options",
            "On 'approve [run_id]': schedules to Buffer YouTube queue, triggers Copywriter audit",
            "Chase mode (noon): DMs George about any Buffer drafts due today not yet published",
            "Logs each run to Pending Approvals Google Sheet",
        ],
        "produces": "Slack approval card. On approval: Buffer queue entry + Sheets log + Copywriter trigger. Noon chase: Slack alert if drafts overdue.",
        "tools": ["Google Drive API", "OpenAI Whisper", "Buffer GraphQL API", "Google Sheets", "Slack Bot API"],
        "reports_to": "Johnson",
        "skills": [
            "Drive scan: checks Google Drive content folder for unprocessed video files",
            "Audio extraction + transcription: ffmpeg for audio, Whisper (streaming curl for large files)",
            "Asset generation: 3 title options, 3 IG captions, LinkedIn post, YouTube description",
            "Slack approval flow: card posted; on approve runs Buffer schedule + Copywriter trigger",
            "Buffer chase (--chase mode): checks Buffer for drafts due today that have not been published",
            "Sheets logging: logs each run to Pending Approvals sheet",
        ],
    },
    {
        "name": "Website Analyst",
        "title": "CRO and UX Investigator",
        "role": "Website Performance Reviewer",
        "schedule": "8am UTC, every Sunday",
        "soul": "Website Analyst thinks like a conversion rate optimiser who's been watching byebyeadmin.co.uk for months. It doesn't just report — it makes specific recommendations backed by data. Every Sunday it tells George what to fix on the site this week.",
        "heartbeat": "Every Sunday at 8am UTC, Website Analyst pulls the full week of GA4 and Clarity data, cross-references traffic with behaviour signals, identifies the 3 highest-leverage CRO actions, writes them to the CRO Backlog Google Sheet, and posts a report to Slack.",
        "what_they_do": [
            "Pulls GA4: page-level traffic, session duration, conversion events, drop-off points",
            "Pulls Clarity: rage clicks, dead clicks, excessive scrolling, bounce patterns",
            "Cross-references highest-friction pages with highest-value traffic sources",
            "Generates 3 specific CRO tasks with priority and rationale",
            "Writes tasks to CRO Backlog Google Sheet with date and supporting evidence",
            "Posts full weekly site report to Slack",
        ],
        "produces": "Weekly Slack website report. 3 tasks written to CRO Backlog sheet.",
        "tools": ["GA4 (Workspace token)", "Microsoft Clarity API", "Google Sheets (personal token)", "Slack Bot API"],
        "reports_to": "Johnson",
        "skills": [
            "GA4 page analysis: page-level traffic, session duration, conversion events, drop-off points",
            "Clarity behaviour analysis: rage clicks, dead clicks, excessive scrolling, bounce patterns",
            "CRO task generation: 3 prioritised tasks with rationale from cross-referenced data",
            "CRO Backlog sheet write: tasks logged with date and supporting evidence",
        ],
    },
    {
        "name": "Hot Lead Monitor",
        "title": "Reply Intelligence and Hot Lead Classifier",
        "role": "Sales Intelligence",
        "schedule": "Every 4 hours (silent midnight-6am UTC)",
        "soul": "Hot Lead Monitor is the sales hawk. It reads every reply that comes into the Instantly campaigns and immediately knows who's interested. It doesn't wait for an explicit yes — it reads between the lines. A fleet manager asking about pricing IS a hot lead. It makes sure George never misses one.",
        "heartbeat": "Every 4 hours (except overnight), Hot Lead Monitor fetches all new replies from Instantly campaigns. It classifies each as HOT, WARM, or COLD using an LLM that understands UK haulage buying signals. HOT leads get a suggested reply and a fire alert in Slack. All hot leads log to Google Sheets.",
        "what_they_do": [
            "Fetches all new replies from Instantly campaigns since last check",
            "Reads last 5 Sheets rows per sender to avoid duplicate alerts",
            "Classifies HOT/WARM/COLD in one batch LLM call (JSON array output)",
            "Detects implied interest: fleet context, pricing questions, operational language",
            "Generates 2-sentence personalised reply suggestion per HOT lead",
            "Posts fire alert with reply text and suggested response to Slack",
            "Logs only HOT leads to Hot Leads Google Sheet",
        ],
        "produces": "Slack fire alerts for HOT leads with reply drafts. Hot Leads sheet entries.",
        "tools": ["Instantly API", "Google Sheets", "LLM cascade (Anthropic/Gemini/OpenAI)", "Slack Bot API"],
        "reports_to": "Johnson",
        "skills": [
            "Implied-interest detection: classifies HOT without explicit yes — detects fleet context, pricing questions, operational language",
            "Batch classification: classifies up to 50 replies in one LLM call as JSON array",
            "Reply drafting: generates 2-sentence personalised reply suggestion per HOT lead",
            "Duplicate suppression: reads last 5 Sheets rows per sender to avoid re-alerting",
            "Silence window enforcement: exits silently if UTC hour is 0-5",
            "Fat context ingestion: reads Sheets history to understand prior replies before classifying",
            "HOT-only logging: writes only HOT leads to Google Sheets Hot Leads tab",
        ],
    },
    {
        "name": "Content Strategist",
        "title": "Weekly Content Planner and Trend Researcher",
        "role": "Content Strategy",
        "schedule": "9am UTC, every Monday",
        "soul": "Content Strategist is the show runner. It watches what's happening in UK haulage, checks what's working on the channel, and produces a weekly content plan that's genuinely strategic — not just filler. It knows the audience and won't suggest anything generic.",
        "heartbeat": "Every Monday at 9am UTC, Content Strategist researches live UK haulage trends via Perplexity, checks the last 10 YouTube videos and their performance, scans the Buffer queue for upcoming posts, then generates 5 video ideas: 2 YouTube Shorts and 3 long-form. Each idea has a confidence score, hook, key points, and IG caption. All ideas log to Sheets. The plan goes to Slack.",
        "what_they_do": [
            "Queries Perplexity sonar-pro for UK haulage/logistics news (2 queries, last 7 days)",
            "Fetches last 10 YouTube videos with view and like counts",
            "Checks Buffer queue for next 7 days to avoid topic duplication",
            "Generates 5 ideas: exactly 2 Shorts + 3 long-form (titles under 60 chars, no em dashes)",
            "Each idea includes: confidence score/10, hook, 3 key points, CTA, IG caption",
            "Logs all 5 ideas to Content Ideas Google Sheet",
            "Posts weekly content plan to Slack",
        ],
        "produces": "Monday content plan in Slack. 5 ideas written to Content Ideas sheet.",
        "tools": ["Perplexity API", "YouTube Data API v3", "Buffer GraphQL API", "Google Sheets", "LLM cascade", "Slack Bot API"],
        "reports_to": "Johnson",
        "skills": [
            "Perplexity research: 2 sonar-pro queries for UK haulage/logistics news last 7 days",
            "YouTube performance check: last 10 videos with view and like counts",
            "Buffer queue awareness: checks scheduled posts to avoid topic duplication",
            "5-idea generation: exactly 2 Shorts + 3 long-form with confidence scores",
            "Per-idea assets: hook, 3 key points, CTA, IG caption for each idea",
            "Content Ideas sheet logging: all 5 ideas written with date and trending topic",
        ],
    },
    {
        "name": "Blog Writer",
        "title": "SEO Blog Writer and Publisher",
        "role": "Content Creation",
        "schedule": "On demand — Slack: blog: [topic]",
        "soul": "Blog Writer is the craftsman. It doesn't produce content for content's sake — it researches, structures for SEO, writes with the BBA voice, and ships to production. Two-stage so George stays in control: review the outline before a word of the post is written.",
        "heartbeat": "When George sends 'blog: [topic]', Blog Writer queries Perplexity for UK haulage data around the topic, generates an SEO-optimised outline with target keywords, and posts it to Slack for review. On 'blog ok', it writes the full 1,000-word post with FAQ, creates an MDX file, commits and pushes to the repo, creates a Google Doc, logs to Sheets, and triggers the Copywriter audit.",
        "what_they_do": [
            "Stage 1 (blog: [topic]): Perplexity research + SEO outline with H1, H2s, target keywords, meta description",
            "Stage 2 (blog ok): Full 1,000-word post with 7-10 FAQ Q&As optimised for featured snippets",
            "MDX publish: writes to content/blog/, git commits and pushes, triggers Vercel deploy hook",
            "Google Doc creation in Drive for easy editing",
            "Logs to Blog Queue sheet: status, doc URL, slug, publish date, keyword targets",
            "Triggers Copywriter to audit brand voice consistency after publish",
        ],
        "produces": "Slack outline for review. On approval: live blog post + Google Doc + Blog Queue entry + Copywriter audit.",
        "tools": ["Perplexity API", "Google Docs API", "Google Drive API", "Google Sheets", "GitHub (git push)", "Vercel deploy hook", "LLM cascade", "Slack Bot API"],
        "reports_to": "Johnson",
        "skills": [
            "Perplexity research: queries sonar-pro for UK haulage stats and angles for the topic",
            "Two-stage review flow: outline to Slack first; waits for blog ok before writing",
            "SEO structure: H1 under 65 chars, 4-6 H2s, meta description 150-160 chars, keyword list",
            "FAQ generation: 7-10 Q&As optimised for featured snippets",
            "MDX publish: writes to content/blog/, git commit + push, triggers Vercel deploy",
            "Google Doc creation: formatted draft for editing",
            "Copywriter handoff: triggers brand voice audit after publish",
            "Sheets logging: logs all posts to Blog Queue tab with status, doc URL, slug, keywords",
        ],
    },
    {
        "name": "Campaign Builder",
        "title": "Cold Email Campaign Architect",
        "role": "Sales Automation",
        "schedule": "On demand — Slack: campaign: [segment]",
        "soul": "Campaign Builder is the strategist who turns a target segment into a fully loaded cold email campaign in minutes. It knows UK haulage buyers don't respond to generic pitches — so every sequence is variable-length, tiered, and built for the specific pain point George names.",
        "heartbeat": "When George sends 'campaign: [segment]', Campaign Builder generates a 3, 5, or 7-email sequence (choosing by segment warmth), writes it to a Campaign Drafts Google Sheet for review, and posts a preview to Slack. On 'approve campaign: [segment]', it creates the campaign in Instantly, uploads the sequence, and confirms.",
        "what_they_do": [
            "Receives segment description from Slack (e.g. 'cold 50+ vehicle fleets')",
            "Determines optimal sequence length: 3 (hyper-targeted), 5 (warm), 7 (cold broad)",
            "Writes full email sequence with subject lines, body, PS lines, and spintax variants",
            "Writes draft to Campaign Drafts Google Sheet for manual review",
            "Posts preview to Slack with sequence summary and email count",
            "On 'approve campaign: [segment]': creates Instantly campaign, uploads sequence, configures sending schedule",
            "Reports campaign ID and confirmation back to Slack",
        ],
        "produces": "Campaign Drafts sheet entry. On approval: live Instantly campaign ready to launch.",
        "tools": ["Instantly API", "Google Sheets", "LLM cascade", "Slack Bot API"],
        "reports_to": "Johnson",
        "skills": [
            "Segment analysis: determines optimal sequence length by warmth and specificity",
            "Sequence generation: subject lines, body, PS lines, spintax for 3/5/7-email sequences",
            "Sheets draft write: full sequence written to Campaign Drafts tab for review",
            "Instantly campaign creation: on approval creates campaign, uploads sequence, configures schedule",
        ],
    },
    {
        "name": "CEO Weekly Brief",
        "title": "Sunday CEO Synthesiser and Strategic Advisor",
        "role": "Strategic Intelligence",
        "schedule": "11am UTC, every Sunday",
        "soul": "CEO Weekly Brief is the boardroom update George never has to write himself. It synthesises everything from the week — numbers, competitors, decisions pending — into a tight executive summary. It ends with a momentum score and 3 recommended actions. It speaks to George as a founder, not a data analyst.",
        "heartbeat": "Every Sunday at 11am UTC, CEO Weekly Brief pulls data from all active channels, queries Perplexity for competitor and market developments, reviews the decision log, assesses overall system health, and posts a comprehensive Sunday summary to Slack.",
        "what_they_do": [
            "Pulls week KPIs: Instantly email performance, YouTube growth, GA4 site traffic, hot lead count",
            "Queries Perplexity for UK haulage competitor news and market developments",
            "Reviews logged decisions and pending items from CEO Briefs Google Sheet",
            "Assesses agent health: checks Paperclip for recent run failures and monthly burn",
            "Calculates momentum score 1-10 based on combined signals",
            "Writes brief to CEO Briefs Google Sheet for decision continuity",
            "Posts to Slack: 9-section brief with KPIs, intel, momentum score, 3 recommended actions",
        ],
        "produces": "Sunday strategic brief in Slack. Row written to CEO Briefs sheet.",
        "tools": ["Instantly API", "YouTube Data API v3", "GA4 (Workspace token)", "Perplexity API", "Paperclip API", "Google Sheets (personal token)", "LLM cascade", "Slack Bot API"],
        "reports_to": None,
        "skills": [
            "Full KPI synthesis: Instantly, YouTube, GA4, hot leads, Buffer queue — all in one pass",
            "Perplexity competitor watch: 2 queries for UK haulage market and competitor news",
            "Decision log continuity: reads last decision from Sheets, sets next week's decision",
            "Agent health check: Paperclip API for failed runs and monthly spend",
            "Momentum scoring: 1-10 score with one-line rationale based on all signals",
        ],
    },
    {
        "name": "Queue Sentinel",
        "title": "Buffer Queue Monitor",
        "role": "Content Operations",
        "schedule": "6am UTC, every day",
        "soul": "Queue Sentinel is the quiet guardian of the content calendar. It doesn't create — it watches. The moment the Buffer YouTube queue drops below 3 videos, it wakes George up and suggests topics to fill the gap. Because an empty queue means dead air, and dead air costs subscribers.",
        "heartbeat": "Every morning at 6am UTC, Queue Sentinel checks how many posts are in the Buffer YouTube queue for the next 7 days. If the count is 3 or fewer, it generates 3 quick video ideas and posts an alert to Slack. If the queue is healthy, it stays silent.",
        "what_they_do": [
            "Checks Buffer YouTube queue: counts posts scheduled in next 7 days via GraphQL",
            "If count > 3: exits silently — no Slack message",
            "If count <= 3: generates 3 quick video topic suggestions using LLM",
            "Posts queue alert to Slack with current count and topic suggestions",
        ],
        "produces": "Slack queue alert (only when count <= 3). Silent otherwise.",
        "tools": ["Buffer GraphQL API", "LLM cascade", "Slack Bot API"],
        "reports_to": "Johnson",
        "skills": [
            "Buffer queue check: counts YouTube posts scheduled in next 7 days via GraphQL API",
            "Queue alert: posts Slack alert with count and 3 quick topic suggestions when low",
            "Silent mode: exits without posting if queue has 4 or more posts",
        ],
    },
    {
        "name": "Copywriter",
        "title": "Brand Voice Auditor",
        "role": "Quality Control",
        "schedule": "Triggered after pipeline approvals and blog publishes",
        "soul": "Copywriter is the brand guardian. It has read the voice guide so many times it could quote it from memory. It only speaks when there's a problem — and when it does, it's precise about what's off and why. George never sees a flagged post that doesn't have a specific fix.",
        "heartbeat": "Copywriter is triggered automatically by Pipeline Engineer and Blog Writer after content is approved and published. It reads the content against the BBA voice guide, checks for em dashes, passive constructions, and off-brand tone. If it finds issues, it DMs George directly with the specific fix. If everything is clean, it logs to the Brand Voice Log sheet and says nothing.",
        "what_they_do": [
            "Receives content text and type (video title/description or blog post)",
            "Reads brand-context/voice.md for current rules before every audit",
            "Audits for em dashes, passive voice, generic phrases, off-brand tone",
            "Checks titles for specificity, length (under 60 chars for video), no filler words",
            "If issues found: DMs George with specific flagged text and recommended fix",
            "Always logs audit result to Brand Voice Log Google Sheet, regardless of outcome",
        ],
        "produces": "Slack DM only if issues found. Always logs to Brand Voice Log sheet.",
        "tools": ["Google Sheets", "LLM cascade", "Slack Bot API"],
        "reports_to": "Johnson",
        "skills": [
            "Voice guide adherence: reads brand-context/voice.md before every audit",
            "Em dash detection: flags any em dash in titles or copy with suggested rewrite",
            "Passive voice check: identifies passive constructions and suggests active alternatives",
            "Title length enforcement: flags video titles over 60 chars",
            "Brand Voice Log: always writes audit result to Sheets regardless of pass/fail",
        ],
    },
    {
        "name": "Cron Watchdog",
        "title": "Daily Cron Reliability Monitor",
        "role": "Infrastructure Monitoring",
        "schedule": "11pm UTC, every day",
        "soul": "Cron Watchdog is the night security guard. It doesn't care about what the agents say — it cares that they showed up. Every night it checks the attendance register and reports to George if anyone went AWOL. Silent if all present, direct if something's wrong.",
        "heartbeat": "Every night at 11pm UTC, after all crons should have completed, Cron Watchdog queries Paperclip for today's agent run issues and checks the expected schedule for that day of the week. It knows which agents run Monday-only, Sunday-only, weekdays, or daily. Any agent that should have run but has no 'done' issue gets flagged.",
        "what_they_do": [
            "Calculates expected agents for today based on day-of-week schedule",
            "Queries Paperclip issues created today: checks for 'Run: {agent}' issues with status done or cancelled",
            "Checks cron.log for google-health (runs python3 directly, not via webhook)",
            "Flags agents with: no issue at all (cron didn't fire) OR all issues cancelled (script errored)",
            "Posts Slack alert if any failures or missing runs",
            "Exits silently if all expected agents have at least one 'done' issue",
        ],
        "produces": "Slack alert if any agent missed or failed. Silent if all green.",
        "tools": ["Paperclip API", "cron.log", "Slack Bot API"],
        "reports_to": "Johnson",
        "skills": [
            "Paperclip issue query: reads today's run issues to determine success vs failure",
            "cron.log fallback: checks log for google-health which runs outside the webhook",
            "Day-aware schedule: knows Mon-only, Sun-only, weekday-only, and daily agents",
            "Failure classification: distinguishes did-not-run from ran-but-failed",
        ],
    },
    {
        "name": "Chief of Staff",
        "title": "Weekly Agent Performance Reviewer",
        "role": "Meta-layer Oversight",
        "schedule": "7am UTC, every Sunday",
        "soul": "Chief of Staff is the meta-layer above all other agents. It doesn't run ops — it reviews the ops team. Every Sunday morning it reads what each agent actually produced last week and asks: is this good enough? Where is the team dropping the ball? What should George change? It's honest, specific, and actionable.",
        "heartbeat": "Every Sunday at 7am UTC, Chief of Staff reads the last 7 days of Paperclip issue descriptions — the actual stdout output of every agent run. It passes this to an LLM for synthesis, then posts a concise weekly review with agent-by-agent assessments and 3 specific improvement priorities. Arrives 4 hours before the CEO Brief, so George can act on recommendations that day.",
        "what_they_do": [
            "Queries Paperclip for all issues created in last 7 days (last 500)",
            "Groups issues by agent name, calculates run counts and success rates",
            "Extracts sample outputs from issue descriptions (up to 600 chars each, last 2 runs per agent)",
            "Passes full context to LLM for synthesis and quality assessment",
            "LLM evaluates each agent: consistency, output quality, error patterns",
            "Generates 3 specific, named improvement actions ranked by priority",
            "Posts review to Slack before CEO Brief fires at 11am",
        ],
        "produces": "Sunday weekly review in Slack at 7am, 4 hours before CEO Brief.",
        "tools": ["Paperclip API", "LLM cascade (Anthropic/Gemini/OpenAI)", "Slack Bot API"],
        "reports_to": None,
        "skills": [
            "Paperclip issue digest: reads last 7 days of agent run outputs from issue descriptions",
            "Run rate analysis: calculates success/failure rates per agent across the week",
            "Quality assessment: LLM evaluates output usefulness and consistency per agent",
            "Priority ranking: surfaces top 3 concrete improvement actions for the week",
        ],
    },
    {
        "name": "BBA Stack",
        "title": "Infrastructure and API Reference",
        "role": "Reference Catalog (not an active agent)",
        "schedule": "Not scheduled — reference only",
        "soul": "BBA Stack is the memory of the machine. It knows every API key that's been wired in, every CLI that's been installed, every MCP that's been connected. When a new agent needs to be built, you start by reading BBA Stack. It is the source of truth for 'does this tool exist and where do I find it.'",
        "heartbeat": "BBA Stack doesn't run on a schedule. It exists to be read. Every time a new tool is added to the stack, its record here should be updated. When something breaks and the credential is suspect, BBA Stack tells you which env var to check and where it's stored.",
        "what_they_do": [
            "Documents every API (21 total): name, env var, where stored (VPS/.env.local/Vercel), which scripts use it",
            "Documents every CLI: binary path on Mac and VPS, what it's used for",
            "Documents every MCP (7 total): package/URL, purpose, which Claude Code tools it enables",
            "Documents Google OAuth: two accounts, scope sets, credential prefixes, health check location",
            "Lists deprecated env vars to remove (GMAIL_* legacy credentials)",
        ],
        "produces": "Nothing — it is read, not run.",
        "tools": ["Paperclip metadata only"],
        "reports_to": None,
        "skills": [
            "API catalog: documents all 21 APIs with env var names and storage locations",
            "CLI reference: vercel, gh, node, python3 — paths on Mac and VPS",
            "MCP catalog: all 7 MCPs including Perplexity MCP added March 2026",
            "Google OAuth reference: two-account setup, scope sets, env var prefixes, health check",
        ],
    },
]

# ── document builder ──────────────────────────────────────────────────────────

def build_segments():
    def h1(t): return (t + '\n', 'HEADING_1')
    def h2(t): return (t + '\n', 'HEADING_2')
    def h3(t): return (t + '\n', 'HEADING_3')
    def p(t):  return (t + '\n', 'NORMAL_TEXT')
    def sep(): return ('──────────────────────────────────────────\n', 'NORMAL_TEXT')

    segments = []
    segments.append(h1('BBA Agent Handbook'))
    segments.append(p('ByeByeAdmin AI Operations — last updated March 2026'))
    segments.append(p('This handbook profiles every agent in the BBA Paperclip workspace. Each agent has a defined role, schedule, and output. Read it to understand who does what, when, and why.'))
    segments.append(p(''))

    for agent in AGENTS:
        segments.append(sep())
        segments.append(h2(agent['name']))
        segments.append(h3(agent['title']))
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

        segments.append(h3('Skills'))
        for skill in agent['skills']:
            segments.append((f'• {skill}\n', 'NORMAL_TEXT'))
        segments.append(p(''))

        segments.append(h3('What they produce'))
        segments.append(p(agent['produces']))
        segments.append(p(''))

        segments.append(h3('Tools'))
        segments.append(p(', '.join(agent['tools'])))
        segments.append(p(''))

    return segments


def apply_content(doc_id, token):
    segments = build_segments()

    full_text = ''
    segment_positions = []
    pos = 1
    for text, style in segments:
        segment_positions.append((pos, pos + len(text), style))
        pos += len(text)
        full_text += text

    requests = [{'insertText': {'location': {'index': 1}, 'text': full_text}}]
    for start, end, style in segment_positions:
        if style != 'NORMAL_TEXT':
            requests.append({
                'updateParagraphStyle': {
                    'range': {'startIndex': start, 'endIndex': end},
                    'paragraphStyle': {'namedStyleType': style},
                    'fields': 'namedStyleType',
                }
            })

    print(f'Applying {len(requests)} requests...')
    for i in range(0, len(requests), 50):
        docs_post(f'/documents/{doc_id}:batchUpdate', {'requests': requests[i:i+50]}, token)
        print(f'  Batch {i//50 + 1} done.')


# ── main ──────────────────────────────────────────────────────────────────────

print('Getting Google token...')
token = get_token()
print('  Token OK.')

# Check for --update DOC_ID flag
update_doc_id = None
if '--update' in sys.argv:
    idx = sys.argv.index('--update')
    if idx + 1 < len(sys.argv):
        update_doc_id = sys.argv[idx + 1]

if update_doc_id:
    doc_id = update_doc_id
    print(f'Updating existing doc: {doc_id}')
    # Get current end index to clear content
    doc = docs_get(f'/documents/{doc_id}', token)
    end_index = doc['body']['content'][-1]['endIndex'] - 1
    print(f'  Current doc end index: {end_index}')
    if end_index > 1:
        # Delete all existing content (keep doc structure intact)
        docs_post(f'/documents/{doc_id}:batchUpdate', {
            'requests': [{'deleteContentRange': {'range': {'startIndex': 1, 'endIndex': end_index}}}]
        }, token)
        print('  Cleared existing content.')
    apply_content(doc_id, token)
else:
    print('Creating new Google Doc...')
    doc = docs_post('/documents', {'title': 'BBA Agent Handbook'}, token)
    doc_id = doc['documentId']
    print(f'  Doc created: {doc_id}')
    apply_content(doc_id, token)

doc_url = f'https://docs.google.com/document/d/{doc_id}/edit'
print(f'\nHandbook ready: {doc_url}')
