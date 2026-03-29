#!/usr/bin/env python3
"""BBA Paperclip Agent Snapshot

Pulls all agents from Paperclip API and writes a formatted Google Doc
with their title, capabilities, skills, and metadata.

Run on VPS:
  python3 ops/scripts/bba-paperclip-snapshot.py
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

PAPERCLIP_URL  = os.environ.get('PAPERCLIP_API_URL', 'http://localhost:3100')
COMPANY_ID     = os.environ.get('PAPERCLIP_COMPANY_ID', '')
GCP_CLIENT_ID  = os.environ.get('GOOGLE_DRIVE_CLIENT_ID', '')  # gmail.com — Docs creation
GCP_SECRET     = os.environ.get('GOOGLE_DRIVE_CLIENT_SECRET', '')
GCP_REFRESH    = os.environ.get('GOOGLE_DRIVE_REFRESH_TOKEN', '')

today = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')

# ── helpers ───────────────────────────────────────────────────────────────────

def get_json(url, headers=None):
    try:
        req = urllib.request.Request(url, headers=headers or {})
        return json.loads(urllib.request.urlopen(req, timeout=15).read())
    except Exception as e:
        print(f'  GET {url[:70]}... failed: {e}', file=sys.stderr)
        return {}

def post_json(url, data, headers=None):
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body,
            headers={'Content-Type': 'application/json', **(headers or {})})
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
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

def get_gcp_token():
    if not (GCP_CLIENT_ID and GCP_SECRET and GCP_REFRESH):
        return None
    resp = post_form('https://oauth2.googleapis.com/token', {
        'client_id': GCP_CLIENT_ID,
        'client_secret': GCP_SECRET,
        'refresh_token': GCP_REFRESH,
        'grant_type': 'refresh_token',
    })
    return resp.get('access_token')

# ── fetch agents from Paperclip ───────────────────────────────────────────────

if not COMPANY_ID:
    print('PAPERCLIP_COMPANY_ID not set', file=sys.stderr)
    sys.exit(1)

print('Fetching agents from Paperclip...')
resp = get_json(f'{PAPERCLIP_URL}/api/companies/{COMPANY_ID}/agents')
agents = resp if isinstance(resp, list) else resp.get('agents', resp.get('data', []))

if not agents:
    print('No agents returned from Paperclip API', file=sys.stderr)
    sys.exit(1)

print(f'  Found {len(agents)} agents')

# ── build doc text ────────────────────────────────────────────────────────────

lines = [
    f'BBA Paperclip Agent Registry',
    f'Snapshot: {today}',
    f'Source: {PAPERCLIP_URL}',
    f'',
    f'{"=" * 60}',
    f'',
]

for agent in agents:
    name  = agent.get('name') or agent.get('title', 'Unnamed')
    title = agent.get('title', '')
    role  = agent.get('role', '')
    caps  = agent.get('capabilities', '')
    meta  = agent.get('metadata') or {}
    agent_id = agent.get('id', '')

    lines.append(f'AGENT: {name}')
    lines.append(f'ID: {agent_id}')
    if title and title != name:
        lines.append(f'Title: {title}')
    if role:
        lines.append(f'Role: {role}')
    if meta.get('domain'):
        lines.append(f'Domain: {meta["domain"]}')
    if meta.get('schedule'):
        lines.append(f'Schedule: {meta["schedule"]}')
    if meta.get('trigger'):
        lines.append(f'Trigger: {meta["trigger"]}')
    lines.append(f'')

    if caps:
        lines.append(f'Capabilities:')
        lines.append(caps)
        lines.append(f'')

    skills = meta.get('skills', [])
    if skills:
        lines.append(f'Skills ({len(skills)}):')
        for s in skills:
            skill_name = s.get('name', '')
            skill_desc = s.get('desc', '')
            lines.append(f'  * {skill_name}: {skill_desc}')
        lines.append(f'')

    lines.append(f'{"-" * 60}')
    lines.append(f'')

doc_text = '\n'.join(lines)

# ── create Google Doc ─────────────────────────────────────────────────────────

gcp_token = get_gcp_token()
if not gcp_token:
    print('No GCP token — printing to stdout instead:\n')
    print(doc_text)
    sys.exit(0)

print('Creating Google Doc...')
doc_resp = post_json(
    'https://docs.googleapis.com/v1/documents',
    {'title': f'BBA Paperclip Agents — {today[:10]}'},
    {'Authorization': f'Bearer {gcp_token}'}
)
doc_id = doc_resp.get('documentId')
if not doc_id:
    print(f'Failed to create doc: {doc_resp}', file=sys.stderr)
    sys.exit(1)

post_json(
    f'https://docs.googleapis.com/v1/documents/{doc_id}:batchUpdate',
    {'requests': [{'insertText': {'location': {'index': 1}, 'text': doc_text}}]},
    {'Authorization': f'Bearer {gcp_token}'}
)

doc_url = f'https://docs.google.com/document/d/{doc_id}/edit'
print(f'Done: {doc_url}')
