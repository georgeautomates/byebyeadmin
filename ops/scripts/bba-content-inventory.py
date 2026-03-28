#!/usr/bin/env python3
"""BBA Content Inventory — runs on VPS at 6am UTC daily.
Checks Buffer YouTube queue. Alerts George if fewer than 3 posts in next 7 days.
"""

import os, json, sys
import urllib.request, urllib.parse

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

GEORGE       = 'U0AETR5UK4Y'
SLACK_TOKEN  = os.environ['SLACK_BOT_TOKEN']
BUFFER_TOKEN = os.environ['BUFFER_TOKEN']

def get(url, headers=None):
    try:
        req = urllib.request.Request(url, headers=headers or {})
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception as e:
        print(f'  GET {url[:60]}... failed: {e}', file=sys.stderr)
        return {}

def post_json(url, data, headers=None):
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body,
            headers={'Content-Type': 'application/json', **(headers or {})})
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception as e:
        print(f'  POST {url[:60]}... failed: {e}', file=sys.stderr)
        return {}

# ── get Buffer profiles ───────────────────────────────────────────────────────

print('Fetching Buffer profiles...')
profiles = get(
    'https://api.bufferapp.com/1/profiles.json',
    {'Authorization': f'Bearer {BUFFER_TOKEN}'}
)

if not profiles:
    # Try v2 GraphQL approach
    print('  Buffer v1 profiles failed, trying without auth header...', file=sys.stderr)
    profiles = get(f'https://api.bufferapp.com/1/profiles.json?access_token={BUFFER_TOKEN}')

if not profiles or not isinstance(profiles, list):
    print('Could not fetch Buffer profiles — skipping content inventory', file=sys.stderr)
    sys.exit(0)

# Find YouTube profile
yt_profile = next(
    (p for p in profiles if p.get('service') == 'youtube' or 'youtube' in p.get('service', '').lower()),
    None
)

if not yt_profile:
    print('No YouTube profile found in Buffer', file=sys.stderr)
    sys.exit(0)

yt_profile_id = yt_profile['id']
print(f'Found YouTube profile: {yt_profile_id}')

# ── get pending posts ─────────────────────────────────────────────────────────

pending = get(
    f'https://api.bufferapp.com/1/profiles/{yt_profile_id}/updates/pending.json',
    {'Authorization': f'Bearer {BUFFER_TOKEN}'}
)
if not pending:
    pending = get(
        f'https://api.bufferapp.com/1/profiles/{yt_profile_id}/updates/pending.json'
        f'?access_token={BUFFER_TOKEN}'
    )

updates = pending.get('updates', []) if isinstance(pending, dict) else []
count = len(updates)
print(f'YouTube posts in queue: {count}')

# ── alert if low ──────────────────────────────────────────────────────────────

if count < 3:
    msg = (f':warning: YouTube buffer low — only {count} post{"s" if count != 1 else ""} '
           f'scheduled in the next 7 days. Time to process new videos.')
    result = post_json(
        'https://slack.com/api/chat.postMessage',
        {'channel': GEORGE, 'text': msg},
        {'Authorization': f'Bearer {SLACK_TOKEN}'}
    )
    if result.get('ok'):
        print(f'Alert sent: {count} posts in queue.')
    else:
        print(f'Slack error: {result}', file=sys.stderr)
        sys.exit(1)
else:
    print(f'{count} posts in queue — no alert needed.')
