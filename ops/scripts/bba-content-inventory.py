#!/usr/bin/env python3
"""BBA Content Inventory — runs on VPS at 6am UTC daily.
Checks Buffer YouTube queue. Alerts George if fewer than 3 posts in next 7 days.
"""

import os, json, sys, datetime
import urllib.request

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

GEORGE        = 'U0AETR5UK4Y'
SLACK_TOKEN   = os.environ['SLACK_BOT_TOKEN']
BUFFER_TOKEN  = os.environ['BUFFER_TOKEN']
BUFFER_ORG_ID = '69b7dc8e9ab93fdee82b1f6e'
BUFFER_YT_ID  = '69b7df3d7be9f8b1715f313c'

def graphql(query, variables=None):
    try:
        body = json.dumps({'query': query, 'variables': variables or {}}).encode()
        req = urllib.request.Request('https://graph.bufferapp.com/graphql',
            data=body,
            headers={'Authorization': f'Bearer {BUFFER_TOKEN}',
                     'Content-Type': 'application/json'})
        resp = json.loads(urllib.request.urlopen(req, timeout=20).read())
        if 'errors' in resp:
            print(f'  GraphQL error: {resp["errors"]}', file=sys.stderr)
        return resp.get('data', {})
    except Exception as e:
        print(f'  GraphQL request failed: {e}', file=sys.stderr)
        return {}

def slack_dm(text):
    try:
        body = json.dumps({'channel': GEORGE, 'text': text}).encode()
        req = urllib.request.Request('https://slack.com/api/chat.postMessage',
            data=body,
            headers={'Authorization': f'Bearer {SLACK_TOKEN}',
                     'Content-Type': 'application/json'})
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception as e:
        print(f'  Slack failed: {e}', file=sys.stderr)
        return {}

# ── get scheduled YouTube posts in next 7 days ────────────────────────────────

now    = datetime.datetime.utcnow()
d7     = (now + datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
now_str = now.strftime('%Y-%m-%dT%H:%M:%SZ')

print('Fetching Buffer scheduled posts...')
data = graphql('''
query($input: PostsInput!, $first: Int) {
  posts(input: $input, first: $first) {
    edges { node { id status dueAt } }
    pageInfo { hasNextPage }
  }
}
''', {
    'input': {
        'organizationId': BUFFER_ORG_ID,
        'filter': {
            'channelIds': [BUFFER_YT_ID],
            'status': ['scheduled'],
            'dueAt': {'start': now_str, 'end': d7},
        },
    },
    'first': 50,
})

if not data:
    print('Buffer unreachable — skipping content inventory.', file=sys.stderr)
    sys.exit(0)

edges = data.get('posts', {}).get('edges', []) or []
count = len(edges)
print(f'YouTube posts scheduled in next 7 days: {count}')

# ── alert if low ──────────────────────────────────────────────────────────────

if count < 3:
    msg = (f':warning: YouTube buffer low — only {count} post{"s" if count != 1 else ""} '
           f'scheduled in the next 7 days. Time to process new videos.')
    result = slack_dm(msg)
    if result.get('ok'):
        print(f'Alert sent: {count} posts in queue.')
    else:
        print(f'Slack error: {result}', file=sys.stderr)
        sys.exit(1)
else:
    print(f'{count} posts in queue — no alert needed.')
