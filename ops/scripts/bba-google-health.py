#!/usr/bin/env python3
"""BBA Google Auth Health Check

Tests all Google credentials weekly and DMs George if anything is broken.
Runs Monday 7am UTC via crontab (before content strategist at 9am).

Checks:
  1. Workspace token (byebyeadmin.com) — GA4 metadata endpoint
  2. Personal token (gmail.com) — Drive about endpoint
  3. YouTube API key — public channel stats
"""

import os, json, sys, datetime
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

GEORGE      = 'U0AETR5UK4Y'
SLACK_TOKEN = os.environ.get('SLACK_BOT_TOKEN', '')
GA4_PROP    = os.environ.get('GA4_PROPERTY_ID', '')
YT_KEY      = os.environ.get('YOUTUBE_API_KEY', '')
YT_CHANNEL  = os.environ.get('YOUTUBE_CHANNEL_ID', '')

WS_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
WS_SECRET    = os.environ.get('GOOGLE_CLIENT_SECRET', '')
WS_REFRESH   = os.environ.get('GOOGLE_REFRESH_TOKEN', '')

P_CLIENT_ID  = os.environ.get('GOOGLE_DRIVE_CLIENT_ID', '')
P_SECRET     = os.environ.get('GOOGLE_DRIVE_CLIENT_SECRET', '')
P_REFRESH    = os.environ.get('GOOGLE_DRIVE_REFRESH_TOKEN', '')

# ── helpers ───────────────────────────────────────────────────────────────────

def post_form(url, data):
    try:
        body = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(url, data=body,
            headers={'Content-Type': 'application/x-www-form-urlencoded'})
        return json.loads(urllib.request.urlopen(req, timeout=15).read())
    except Exception as e:
        return {'error': str(e)}

def get_json(url, headers=None):
    try:
        req = urllib.request.Request(url, headers=headers or {})
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read()), resp.status
    except urllib.request.HTTPError as e:
        return {'error': e.reason}, e.code
    except Exception as e:
        return {'error': str(e)}, 0

def post_slack(text):
    if not SLACK_TOKEN:
        print(text)
        return
    try:
        body = json.dumps({'channel': GEORGE, 'text': text}).encode()
        req = urllib.request.Request('https://slack.com/api/chat.postMessage', data=body,
            headers={'Authorization': f'Bearer {SLACK_TOKEN}', 'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f'Slack failed: {e}', file=sys.stderr)

# ── checks ────────────────────────────────────────────────────────────────────

failures = []
today = datetime.datetime.utcnow().strftime('%Y-%m-%d')

# 1. Workspace token (byebyeadmin.com) — test against GA4
print('Checking workspace token (byebyeadmin.com)...')
if not (WS_CLIENT_ID and WS_SECRET and WS_REFRESH):
    failures.append('Workspace: GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN not set in .env')
else:
    token_resp = post_form('https://oauth2.googleapis.com/token', {
        'client_id': WS_CLIENT_ID, 'client_secret': WS_SECRET,
        'refresh_token': WS_REFRESH, 'grant_type': 'refresh_token',
    })
    ws_token = token_resp.get('access_token', '')
    if not ws_token:
        failures.append(f'Workspace: token exchange failed — {token_resp.get("error_description", token_resp.get("error", "unknown"))}')
    else:
        data, status = get_json(
            f'https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROP}/metadata',
            {'Authorization': f'Bearer {ws_token}'}
        )
        if status != 200:
            failures.append(f'Workspace: GA4 API returned {status} — {data.get("error", {}).get("message", data.get("error", ""))}')
        else:
            print('  Workspace token: OK (GA4 accessible)')

# 2. Personal token (gmail.com) — test against Drive
print('Checking personal token (gmail.com)...')
if not (P_CLIENT_ID and P_SECRET and P_REFRESH):
    failures.append('Personal: GOOGLE_DRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN not set in .env')
else:
    token_resp = post_form('https://oauth2.googleapis.com/token', {
        'client_id': P_CLIENT_ID, 'client_secret': P_SECRET,
        'refresh_token': P_REFRESH, 'grant_type': 'refresh_token',
    })
    p_token = token_resp.get('access_token', '')
    if not p_token:
        failures.append(f'Personal: token exchange failed — {token_resp.get("error_description", token_resp.get("error", "unknown"))}')
    else:
        data, status = get_json(
            'https://www.googleapis.com/drive/v3/about?fields=user',
            {'Authorization': f'Bearer {p_token}'}
        )
        if status != 200:
            failures.append(f'Personal: Drive API returned {status} — {data.get("error", {}).get("message", data.get("error", ""))}')
        else:
            user_email = data.get('user', {}).get('emailAddress', 'unknown')
            print(f'  Personal token: OK (Drive accessible as {user_email})')

# 3. YouTube API key
print('Checking YouTube API key...')
if not (YT_KEY and YT_CHANNEL):
    failures.append('YouTube: YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID not set')
else:
    data, status = get_json(
        f'https://www.googleapis.com/youtube/v3/channels?part=snippet&id={YT_CHANNEL}&key={YT_KEY}'
    )
    if status != 200 or not data.get('items'):
        failures.append(f'YouTube: API key check failed — status {status}')
    else:
        print('  YouTube API key: OK')

# ── report ────────────────────────────────────────────────────────────────────

if failures:
    msg = f':warning: *Google Auth Health Check — {today}*\n\n'
    msg += '\n'.join(f'• {f}' for f in failures)
    msg += '\n\nRun the relevant reauth script:\n'
    msg += '• Workspace (byebyeadmin.com): `node scripts/google-reauth.mjs`\n'
    msg += '• Personal (gmail.com): `node scripts/drive-reauth.mjs`'
    post_slack(msg)
    print(f'FAILURES: {failures}', file=sys.stderr)
    sys.exit(1)
else:
    print(f'All Google credentials healthy ({today})')
