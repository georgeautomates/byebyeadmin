#!/usr/bin/env python3
"""BBA Johnson — Paperclip task handler.

Called when a task is assigned to Johnson via the Paperclip board.
Reads the task/issue from Paperclip, uses LLM to think through it,
and posts the result to George on Slack.

If the task can be delegated to another agent, Johnson creates a
Paperclip sub-issue and posts the delegation to Slack.
"""

import os, json, sys, urllib.request, urllib.parse
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

def patch_issue(issue_id, data):
    if not COMPANY_ID or not issue_id:
        return
    try:
        body = json.dumps(data).encode()
        req  = urllib.request.Request(
            f'{PAPERCLIP_URL}/api/issues/{issue_id}',
            data=body, method='PATCH',
            headers={'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f'  Paperclip PATCH failed: {e}', file=sys.stderr)

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

Your job: assess this task and produce TWO outputs — a full assessment for Paperclip, and a
brief one-line Slack ping so George knows it is done.

Available agents you can delegate to:
{AGENT_ROSTER}

Format your response EXACTLY like this (no extra lines between the headers):

PAPERCLIP_RESULT:
[Full assessment: what the task is, your recommended approach or delegation, any blockers,
next steps. 100-300 words. No em dashes. Bullet points welcome.]

SLACK_NOTIFICATION:
[:briefcase: *Johnson* — one sentence summary of action taken or recommended, max 20 words.]
"""

raw = call_llm(prompt, max_tokens=1200)

# ── parse sections ────────────────────────────────────────────────────────────

def parse_section(text, header):
    marker = f'{header}:'
    idx = text.find(marker)
    if idx == -1:
        return ''
    start = idx + len(marker)
    # Find next section header (all-caps word followed by colon at line start)
    import re
    next_header = re.search(r'\n[A-Z_]+:', text[start:])
    end = start + next_header.start() if next_header else len(text)
    return text[start:end].strip()

if raw:
    paperclip_text = parse_section(raw, 'PAPERCLIP_RESULT')
    slack_text     = parse_section(raw, 'SLACK_NOTIFICATION')
else:
    paperclip_text = ''
    slack_text     = ''

if not paperclip_text:
    paperclip_text = f'Task received but LLM processing failed. Raw output:\n\n{raw[:1000]}' if raw else 'Task received but LLM returned no output.'
if not slack_text:
    slack_text = f':briefcase: *Johnson* — task `{title}` received. Check Paperclip issue for details.'

print(f'Paperclip result: {len(paperclip_text)} chars')
print(f'Slack notification: {slack_text[:120]}')

# ── write result to Paperclip issue ──────────────────────────────────────────

patch_issue(issue_id, {
    'status':      'done',
    'description': paperclip_text,
})
print(f'Paperclip issue {issue_id} marked done.')

# ── post brief notification to Slack ─────────────────────────────────────────

ok = post_slack(slack_text)
if ok:
    print('Johnson notification sent to Slack.')
else:
    print('Slack post failed.', file=sys.stderr)
    sys.exit(1)
