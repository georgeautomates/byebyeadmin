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
    if ANTHROPIC_KEY:
        body = json.dumps({'model': 'claude-sonnet-4-6', 'max_tokens': max_tokens,
            'messages': [{'role': 'user', 'content': prompt}]}).encode()
        req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body,
            headers={'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01',
                     'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
            text = resp.get('content', [{}])[0].get('text', '')
            if text:
                return text
        except Exception as e:
            print(f'  Anthropic failed: {e}', file=sys.stderr)
    gemini_key = os.environ.get('GEMINI_API_KEY', '')
    if gemini_key:
        body = json.dumps({'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'maxOutputTokens': max_tokens}}).encode()
        gurl = (f'https://generativelanguage.googleapis.com/v1beta/models/'
                f'gemini-2.0-flash:generateContent?key={gemini_key}')
        req = urllib.request.Request(gurl, data=body, headers={'Content-Type': 'application/json'})
        try:
            resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
            return resp['candidates'][0]['content']['parts'][0]['text']
        except Exception as e:
            print(f'  Gemini failed: {e}', file=sys.stderr)
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

# Fetch the issue assigned to this run
issue = None
if RUN_ID and COMPANY_ID:
    # Try to find the issue from recent issues matching this run
    data = get_json(f'{PAPERCLIP_URL}/api/companies/{COMPANY_ID}/issues?limit=50')
    if isinstance(data, dict):
        data = data.get('issues', data.get('items', data.get('data', [])))
    for i in (data or []):
        if i.get('assigneeAgentId') == '80570e2d-92fd-431c-8239-1f5d48826927' and i.get('status') == 'in_progress':
            issue = i
            break

if not issue:
    print('No in-progress issue found for Johnson. Nothing to act on.')
    post_slack(':information_source: *Johnson* received a Paperclip task ping but could not find the associated issue. Check Paperclip for context.')
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
