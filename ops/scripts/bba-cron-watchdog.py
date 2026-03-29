#!/usr/bin/env python3
"""BBA Cron Watchdog — runs 11pm UTC daily.

Checks that every expected cron agent ran and succeeded today.
DMs George if anything missed or failed. Silent if all green.

Mechanism: the paperclip-webhook.py creates a Paperclip issue per agent run
(title: 'Run: {agent-name}', status: done|cancelled). We query today's issues
and cross-check against the expected schedule for today's day-of-week.

google-health is special: runs python3 directly (no Paperclip issue), so
we check cron.log directly for that one.
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
SLACK_TOKEN    = os.environ.get('SLACK_BOT_TOKEN', '')
PAPERCLIP_URL  = os.environ.get('PAPERCLIP_API_URL', 'http://localhost:3100')
COMPANY_ID     = os.environ.get('PAPERCLIP_COMPANY_ID', '')
CRON_LOG       = '/home/openclaw/.openclaw/cron.log'

# ── expected schedule ─────────────────────────────────────────────────────────

# Agents that run every day
DAILY = ['hot-lead-monitor', 'pipeline-check', 'pipeline-chase', 'content-inventory']

# Agents by day-of-week (0=Mon, 6=Sun)
WEEKDAY_ONLY = ['morning-brief']          # Mon-Fri
MONDAY_ONLY  = ['weekly-analytics', 'content-strategist', 'google-health']
SUNDAY_ONLY  = ['website-review', 'ceo-brief']

def expected_today(weekday):
    """Return list of agent names expected to have run today."""
    agents = list(DAILY)
    if weekday < 5:
        agents += WEEKDAY_ONLY
    if weekday == 0:
        agents += MONDAY_ONLY
    if weekday == 6:
        agents += SUNDAY_ONLY
    return agents

# ── helpers ───────────────────────────────────────────────────────────────────

def get_json(url):
    try:
        req  = urllib.request.Request(url)
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read())
    except Exception as e:
        print(f'  GET {url[:80]} failed: {e}', file=sys.stderr)
        return None

def post_slack(text):
    if not SLACK_TOKEN:
        print(text)
        return
    try:
        body = json.dumps({'channel': GEORGE, 'text': text}).encode()
        req  = urllib.request.Request('https://slack.com/api/chat.postMessage', data=body,
            headers={'Authorization': f'Bearer {SLACK_TOKEN}', 'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f'Slack failed: {e}', file=sys.stderr)

# ── main ──────────────────────────────────────────────────────────────────────

now     = datetime.datetime.utcnow()
today   = now.strftime('%Y-%m-%d')
weekday = now.weekday()  # 0=Mon, 6=Sun

print(f'Cron watchdog running — {today} (weekday {weekday})')

expected = expected_today(weekday)
print(f'Expected agents today: {expected}')

if not COMPANY_ID:
    print('No PAPERCLIP_COMPANY_ID — cannot query issues. Exiting.', file=sys.stderr)
    sys.exit(1)

# ── query today's Paperclip issues ────────────────────────────────────────────

# Fetch last 200 issues (more than enough for one day)
issues_data = get_json(f'{PAPERCLIP_URL}/api/companies/{COMPANY_ID}/issues?limit=200')

if issues_data is None:
    issues_data = []
elif isinstance(issues_data, dict):
    issues_data = issues_data.get('issues', issues_data.get('items', issues_data.get('data', [])))

# Filter to issues created today (UTC)
today_issues = []
for issue in (issues_data or []):
    created = issue.get('createdAt', '')
    if created.startswith(today):
        today_issues.append(issue)

print(f'  Found {len(today_issues)} issues created today.')

# Build a map: agent_name -> list of statuses
agent_runs = {}
for issue in today_issues:
    title = issue.get('title', '')
    if title.startswith('Run: '):
        agent_name = title[5:]
        status = issue.get('status', 'unknown')
        if agent_name not in agent_runs:
            agent_runs[agent_name] = []
        agent_runs[agent_name].append(status)

print(f'  Agent runs found: {dict(agent_runs)}')

# ── check google-health separately (runs python3 directly, no Paperclip issue) ─

google_health_ok = None
if 'google-health' in expected:
    try:
        with open(CRON_LOG) as f:
            log_content = f.read()
        # Look for today's date in the health check success line
        if f'All Google credentials healthy ({today})' in log_content:
            google_health_ok = True
            print('  google-health: found success line in cron.log')
        elif today in log_content and 'Google Auth Health Check' in log_content:
            # Health check ran but may have failed
            google_health_ok = False
            print('  google-health: ran but found failure in cron.log')
        else:
            google_health_ok = None  # No evidence it ran
            print('  google-health: no evidence of run in cron.log')
    except Exception as e:
        print(f'  Could not read cron.log: {e}', file=sys.stderr)
        google_health_ok = None

# ── evaluate ──────────────────────────────────────────────────────────────────

failures = []
missing  = []

for agent in expected:
    if agent == 'google-health':
        if google_health_ok is True:
            print(f'  {agent}: OK (cron.log)')
        elif google_health_ok is False:
            failures.append(agent)
            print(f'  {agent}: FAILED (cron.log)')
        else:
            missing.append(agent)
            print(f'  {agent}: DID NOT RUN (no cron.log evidence)')
        continue

    runs = agent_runs.get(agent, [])
    if not runs:
        missing.append(agent)
        print(f'  {agent}: DID NOT RUN (no Paperclip issue)')
    elif 'done' in runs:
        print(f'  {agent}: OK ({runs.count("done")} successful run(s))')
    elif all(s == 'cancelled' for s in runs):
        failures.append(agent)
        print(f'  {agent}: FAILED (all runs cancelled)')
    else:
        # Has in_progress or other status — may still be running
        print(f'  {agent}: status={runs} (may still be running)')

# ── report ────────────────────────────────────────────────────────────────────

if failures or missing:
    lines = [f':rotating_light: *Cron Watchdog — {today}*\n']
    if failures:
        lines += [f'• {a}: FAILED' for a in failures]
    if missing:
        lines += [f'• {a}: DID NOT RUN' for a in missing]
    lines.append('\nCheck `tail -50 ~/.openclaw/cron.log` on VPS.')
    post_slack('\n'.join(lines))
    print(f'Alert sent. failures={failures} missing={missing}', file=sys.stderr)
    sys.exit(1)
else:
    print(f'All {len(expected)} expected agents ran successfully. Silent.')
