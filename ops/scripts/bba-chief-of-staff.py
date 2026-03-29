#!/usr/bin/env python3
"""BBA Chief of Staff — runs Sunday 7am UTC.

Weekly meta-review of all agent outputs. Reads what each agent actually produced
last 7 days via Paperclip issue history, evaluates quality and consistency,
posts improvement suggestions to Slack.

Runs before the CEO Brief (11am Sunday) so George sees it alongside the weekly summary.
"""

import os, json, datetime, urllib.request, urllib.parse, sys

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
SLACK_TOKEN    = os.environ['SLACK_BOT_TOKEN']
PAPERCLIP_URL  = os.environ.get('PAPERCLIP_API_URL', 'http://localhost:3100')
COMPANY_ID     = os.environ.get('PAPERCLIP_COMPANY_ID', '')
ANTHROPIC_KEY  = os.environ.get('ANTHROPIC_API_KEY', '')

# ── helpers ───────────────────────────────────────────────────────────────────

def get_json(url):
    try:
        req  = urllib.request.Request(url)
        resp = urllib.request.urlopen(req, timeout=20)
        return json.loads(resp.read())
    except Exception as e:
        print(f'  GET failed: {e}', file=sys.stderr)
        return None

def call_llm(prompt, max_tokens=1800):
    """Anthropic Sonnet → Gemini → OpenAI cascade."""
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
    try:
        body = json.dumps({'channel': GEORGE, 'text': text}).encode()
        req  = urllib.request.Request('https://slack.com/api/chat.postMessage', data=body,
            headers={'Authorization': f'Bearer {SLACK_TOKEN}', 'Content-Type': 'application/json'})
        resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
        return resp.get('ok', False)
    except Exception as e:
        print(f'Slack failed: {e}', file=sys.stderr)
        return False

# ── dates ─────────────────────────────────────────────────────────────────────

now      = datetime.datetime.utcnow()
today    = now.strftime('%Y-%m-%d')
d7_ago   = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
week_end = now.strftime('%-d %b %Y')

print(f'Chief of Staff running — week ending {week_end}')

if not COMPANY_ID:
    print('No PAPERCLIP_COMPANY_ID — cannot query issues. Exiting.', file=sys.stderr)
    sys.exit(1)

# ── fetch last 7 days of Paperclip issues ─────────────────────────────────────

print('Fetching Paperclip issue history (last 7 days)...')
issues_data = get_json(f'{PAPERCLIP_URL}/api/companies/{COMPANY_ID}/issues?limit=500')

if issues_data is None:
    issues_data = []
elif isinstance(issues_data, dict):
    issues_data = issues_data.get('issues', issues_data.get('items', issues_data.get('data', [])))

# Filter to last 7 days
recent_issues = [
    i for i in (issues_data or [])
    if i.get('createdAt', '') >= d7_ago
]
print(f'  Found {len(recent_issues)} issues in last 7 days.')

# Group by agent name
agent_runs = {}  # agent_name -> list of {status, description, createdAt}
for issue in recent_issues:
    title = issue.get('title', '')
    if title.startswith('Run: '):
        agent = title[5:]
        if agent not in agent_runs:
            agent_runs[agent] = []
        agent_runs[agent].append({
            'status':      issue.get('status', ''),
            'description': (issue.get('description') or '')[:600],
            'createdAt':   issue.get('createdAt', '')[:10],
        })

# Sort each agent's runs by date
for agent in agent_runs:
    agent_runs[agent].sort(key=lambda x: x['createdAt'])

# ── build context for LLM ─────────────────────────────────────────────────────

agent_order = [
    'morning-brief', 'weekly-analytics', 'hot-lead-monitor', 'pipeline-check',
    'pipeline-chase', 'content-inventory', 'content-strategist', 'blog-writer',
    'campaign-builder', 'website-review', 'copywriter', 'ceo-brief',
]

context_blocks = []
for agent in agent_order:
    runs = agent_runs.get(agent, [])
    if not runs:
        context_blocks.append(f'### {agent}\nNo runs recorded this week.')
        continue
    done_count      = sum(1 for r in runs if r['status'] == 'done')
    cancelled_count = sum(1 for r in runs if r['status'] == 'cancelled')
    total           = len(runs)
    # Include last 2 run outputs for context
    sample_outputs = []
    for r in runs[-2:]:
        desc = r['description'].strip()
        if desc:
            sample_outputs.append(f'[{r["createdAt"]} {r["status"]}] {desc[:300]}')
    block = f'### {agent}\nRuns: {done_count}/{total} succeeded, {cancelled_count} failed.\n'
    if sample_outputs:
        block += 'Sample output:\n' + '\n'.join(sample_outputs)
    context_blocks.append(block)

full_context = '\n\n'.join(context_blocks)

print(f'  Context built ({len(full_context)} chars). Calling LLM...')

# ── LLM synthesis ─────────────────────────────────────────────────────────────

prompt = f"""You are the Chief of Staff reviewing BBA's AI agent team for the week ending {week_end}.

BBA is an AI automation service for UK haulage fleet operators. The agents below run automated ops tasks.

Below is each agent's run history and output samples from the last 7 days:

{full_context[:3500]}

Write a concise weekly review for George (the founder). Format:

:memo: *Chief of Staff — week ending {week_end}*

For each agent that ran, one line: *Agent Name* (X/Y runs) — [brief honest assessment, max 15 words]. Only flag if something is worth noting.

Then end with:

*Top 3 improvement priorities this week:*
1. [specific, actionable — name the agent and what to change]
2. [specific, actionable]
3. [specific, actionable]

Rules:
- Be direct and honest. If an agent is performing well, say so briefly. If not, say why.
- Improvement priorities must be concrete (not "improve output quality" but "hot-lead-monitor: add Company Name to Slack alert so George can look them up instantly")
- No em dashes. Keep the whole message under 600 words.
- Skip agents with no runs this week.
"""

review = call_llm(prompt, max_tokens=1000)

if not review:
    review = (
        f':memo: *Chief of Staff — week ending {week_end}*\n\n'
        '_LLM unavailable — raw run counts below:_\n\n'
    )
    for agent in agent_order:
        runs = agent_runs.get(agent, [])
        if runs:
            done = sum(1 for r in runs if r['status'] == 'done')
            review += f'• *{agent}*: {done}/{len(runs)} runs succeeded\n'

print(f'  LLM response: {len(review)} chars.')

# ── post to Slack ─────────────────────────────────────────────────────────────

if len(review) > 3800:
    review = review[:3750] + '\n_[truncated]_'

print('Posting to Slack...')
ok = post_slack(review)
if ok:
    print('Chief of Staff review sent.')
else:
    print('Slack post failed.', file=sys.stderr)
    sys.exit(1)
