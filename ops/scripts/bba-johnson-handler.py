#!/usr/bin/env python3
"""BBA Johnson — Paperclip task handler.

Called when a task is assigned to Johnson via the Paperclip board.
Reads the task/issue from Paperclip, uses LLM to think through it,
and posts the result to George on Slack.

If the task can be delegated to another agent, Johnson creates a
Paperclip sub-issue and posts the delegation to Slack.
"""

import os, json, sys, urllib.request, urllib.parse

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

GEORGE         = 'U0AETR5UK4Y'
SLACK_TOKEN    = os.environ.get('SLACK_BOT_TOKEN', '')
PAPERCLIP_URL  = os.environ.get('PAPERCLIP_API_URL', 'http://localhost:3100')
COMPANY_ID     = os.environ.get('PAPERCLIP_COMPANY_ID', '')
ANTHROPIC_KEY  = os.environ.get('ANTHROPIC_API_KEY', '')
RUN_ID         = os.environ.get('PAPERCLIP_RUN_ID', '')

# ── helpers ───────────────────────────────────────────────────────────────────

def get_json(url):
    try:
        req  = urllib.request.Request(url)
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read())
    except Exception as e:
        print(f'  GET failed: {e}', file=sys.stderr)
        return None

def call_llm(prompt, max_tokens=800):
    # Cascade: Gemini → Groq → OpenAI (Anthropic rate-limited on this VPS)
    gemini_key = os.environ.get('GEMINI_API_KEY', '')
    if gemini_key:
        body = json.dumps({'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'maxOutputTokens': max_tokens}}).encode()
        gurl = (f'https://generativelanguage.googleapis.com/v1beta/models/'
                f'gemini-2.0-flash:generateContent?key={gemini_key}')
        req = urllib.request.Request(gurl, data=body, headers={'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
            text = resp['candidates'][0]['content']['parts'][0]['text']
            if text:
                return text
        except Exception as e:
            print(f'  Gemini failed: {e}', file=sys.stderr)
    groq_key = os.environ.get('GROQ_API_KEY', '')
    if groq_key:
        body = json.dumps({'model': 'llama-3.3-70b-versatile', 'max_tokens': max_tokens,
            'messages': [{'role': 'user', 'content': prompt}]}).encode()
        req = urllib.request.Request('https://api.groq.com/openai/v1/chat/completions', data=body,
            headers={'Authorization': f'Bearer {groq_key}', 'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
            text = resp['choices'][0]['message']['content']
            if text:
                return text
        except Exception as e:
            print(f'  Groq failed: {e}', file=sys.stderr)
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

def post_slack(text):
    if not SLACK_TOKEN:
        print(text)
        return False
    try:
        body = json.dumps({'channel': GEORGE, 'text': text}).encode()
        req  = urllib.request.Request('https://slack.com/api/chat.postMessage', data=body,
            headers={'Authorization': f'Bearer {SLACK_TOKEN}', 'Content-Type': 'application/json'})
        resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
        return resp.get('ok', False)
    except Exception as e:
        print(f'Slack failed: {e}', file=sys.stderr)
        return False

# ── main ──────────────────────────────────────────────────────────────────────

print(f'Johnson handler — run_id={RUN_ID}')

JOHNSON_ID = '80570e2d-92fd-431c-8239-1f5d48826927'

# Find the actual task assigned to Johnson.
# Paperclip creates the issue before calling the webhook. We look for the most
# recent non-tracking issue assigned to Johnson (status: todo or in_progress,
# title does NOT start with "Run:" which are internal webhook tracking issues).
issue = None
if COMPANY_ID:
    data = get_json(f'{PAPERCLIP_URL}/api/companies/{COMPANY_ID}/issues?limit=50')
    if isinstance(data, dict):
        data = data.get('issues', data.get('items', data.get('data', [])))
    candidates = [
        i for i in (data or [])
        if i.get('assigneeAgentId') == JOHNSON_ID
        and i.get('status') in ('todo', 'in_progress')
        and not i.get('title', '').startswith('Run:')
    ]
    # Most recently created first
    candidates.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
    if candidates:
        issue = candidates[0]

if not issue:
    print('No actionable task found for Johnson.')
    sys.exit(0)

title       = issue.get('title', '(no title)')
description = issue.get('description', '') or ''
issue_id    = issue.get('id', '')

print(f'Task: {title}')
print(f'Issue ID: {issue_id}')

# ── LLM: think through the task ───────────────────────────────────────────────

# Known BBA agents for delegation context
AGENT_ROSTER = """
- morning-brief: Daily Instantly + YouTube + GA4 snapshot
- hot-lead-monitor: Monitors Instantly replies for HOT leads
- pipeline-check: Runs content pipeline (Drive → Whisper → Claude → Buffer)
- pipeline-chase: Chases today's scheduled Buffer posts
- content-inventory: Buffer queue alert + video topic ideas
- content-strategist: Weekly trend research + 5 video ideas
- blog-writer: Full blog post from topic → Vercel deploy
- campaign-builder: Builds Instantly email sequences
- website-review: Weekly GA4 + Clarity CRO report
- copywriter: Brand voice audit on new content
- ceo-brief: Sunday CEO synthesis
- cron-watchdog: Nightly cron health check
- chief-of-staff: Weekly agent performance review
"""

prompt = f"""You are Johnson, Chief of Operations at ByeByeAdmin (UK haulage AI automation).
George has assigned you a task via the Paperclip board.

Task title: {title}
Task description: {description[:800]}

Your job: assess this task, decide whether you can handle it directly or need to delegate,
and write a brief response for George on Slack.

Available agents you can delegate to:
{AGENT_ROSTER}

Write a short Slack message (max 200 words) that:
1. Acknowledges the task
2. States your assessment or next step (or which agent you'd delegate to and why)
3. Flags if you need more info from George

Rules: no em dashes, be direct, use bullet points if helpful.
Start the message with: :briefcase: *Johnson — task received*
"""

response = call_llm(prompt)
if not response:
    response = f':briefcase: *Johnson — task received*\n\nTask: _{title}_\n\nI received this but could not process it automatically. Please check Paperclip issue `{issue_id}`.'

print(f'LLM response: {len(response)} chars')

# ── post to Slack ─────────────────────────────────────────────────────────────

ok = post_slack(response)
if ok:
    print('Johnson response sent to Slack.')
else:
    print('Slack post failed.', file=sys.stderr)
    sys.exit(1)
