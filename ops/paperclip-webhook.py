#!/usr/bin/env python3
"""BBA Paperclip Webhook Router

Paperclip HTTP adapter dispatcher. Receives POST requests from Paperclip for each
agent, runs the corresponding VPS script, and returns the result with token usage.

Port: 8765 (internal only — not exposed externally)
Secret: PAPERCLIP_WEBHOOK_SECRET env var (set in VPS .env)
"""

import os, json, subprocess, time, sys, logging, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

# ── env ───────────────────────────────────────────────────────────────────────

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

WEBHOOK_SECRET = os.environ.get('PAPERCLIP_WEBHOOK_SECRET', '')
PAPERCLIP_URL  = os.environ.get('PAPERCLIP_API_URL', 'http://localhost:3100')
PAPERCLIP_KEY  = os.environ.get('PAPERCLIP_API_KEY', '')
COMPANY_ID     = os.environ.get('PAPERCLIP_COMPANY_ID', '')
NODE           = '/home/openclaw/.nvm/versions/node/v22.22.1/bin/node'
SCRIPTS        = '/home/openclaw/byebyeadmin/ops/scripts'

# Agent IDs — used to create Paperclip issues per run
AGENT_IDS = {
    'morning-brief':      '718f13c4-06a8-45cb-927c-b5222eaff473',
    'weekly-analytics':   'e919e9fa-7ce7-4a03-8413-f1ff2b0ec6ee',
    'pipeline-check':     'c3efa1b1-8abc-49e9-b06c-f28a9d3110d4',
    'pipeline-chase':     'c3efa1b1-8abc-49e9-b06c-f28a9d3110d4',
    'content-inventory':  'afd1fb9c-721d-45b1-b2a2-67a2e965dc84',
    'website-review':     '42a0c3ff-e4fd-41ab-b40e-532cba86e0e5',
    'hot-lead-monitor':   'f83169d0-939a-4497-bcb7-ec124ced7326',
    'content-strategist': 'f93a9134-9e1f-4b5b-b112-9ddfa2779c7b',
    'blog-writer':        '3bbdf6aa-8313-4250-aa60-5e1013fbfd9f',
    'campaign-builder':   '1c478422-6aba-4dd2-a5fc-32a3ce6a8fe4',
    'ceo-brief':          '880bc2ea-22bd-4e8d-abff-d3c8cc19a7ed',
    'copywriter':         'a85864ef-7691-4fd4-a715-5248d3b8f356',
    'cron-watchdog':      '88ccefac-ed41-4efb-9b25-ea40401fedb8',
    'chief-of-staff':     'ce07090f-ec39-4384-82ff-47c286bc01d1',
    'johnson':            '80570e2d-92fd-431c-8239-1f5d48826927',
}

def paperclip_post(path, data):
    """POST to Paperclip API. Fire-and-forget — never blocks execution."""
    if not COMPANY_ID:
        return None
    try:
        body = json.dumps(data).encode()
        req  = urllib.request.Request(
            f'{PAPERCLIP_URL}/api{path}',
            data=body,
            headers={'Content-Type': 'application/json'},
        )
        resp = urllib.request.urlopen(req, timeout=5)
        return json.loads(resp.read())
    except Exception as e:
        log.warning('Paperclip API call failed: %s', e)
        return None

def paperclip_patch(path, data):
    """PATCH to Paperclip API."""
    if not COMPANY_ID:
        return None
    try:
        body = json.dumps(data).encode()
        req  = urllib.request.Request(
            f'{PAPERCLIP_URL}/api{path}',
            data=body,
            method='PATCH',
            headers={'Content-Type': 'application/json'},
        )
        resp = urllib.request.urlopen(req, timeout=5)
        return json.loads(resp.read())
    except Exception as e:
        log.warning('Paperclip PATCH failed: %s', e)
        return None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    stream=sys.stdout,
)
log = logging.getLogger('paperclip-webhook')

# ── agent dispatch map ─────────────────────────────────────────────────────────

AGENTS = {
    'morning-brief':      ['python3', f'{SCRIPTS}/bba-morning-briefing.py'],
    'weekly-analytics':   ['python3', f'{SCRIPTS}/bba-weekly-analytics.py'],
    'pipeline-check':     [NODE,      f'{SCRIPTS}/bba-pipeline-check.js', '--check'],
    'pipeline-chase':     [NODE,      f'{SCRIPTS}/bba-pipeline-check.js', '--chase'],
    'content-inventory':  ['python3', f'{SCRIPTS}/bba-content-inventory.py'],
    'website-review':     ['python3', f'{SCRIPTS}/bba-website-review.py'],
    'hot-lead-monitor':   ['python3', f'{SCRIPTS}/bba-hot-leads.py'],
    'content-strategist': ['python3', f'{SCRIPTS}/bba-content-strategist.py'],
    'blog-writer':        ['python3', f'{SCRIPTS}/bba-blog-writer.py', '--mode', 'full'],
    'campaign-builder':   ['python3', f'{SCRIPTS}/bba-campaign-builder.py', '--segment', 'scheduled run'],
    'ceo-brief':          ['python3', f'{SCRIPTS}/bba-ceo-brief.py'],
    'copywriter':         ['python3', f'{SCRIPTS}/bba-copywriter.py', '--source', 'pipeline'],
    'cron-watchdog':      ['python3', f'{SCRIPTS}/bba-cron-watchdog.py'],
    'chief-of-staff':     ['python3', f'{SCRIPTS}/bba-chief-of-staff.py'],
    'johnson':            ['python3', f'{SCRIPTS}/bba-johnson-handler.py'],
}

# ── HTTP handler ───────────────────────────────────────────────────────────────

class WebhookHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        log.info(fmt % args)

    def send_json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        # ── secret check ──────────────────────────────────────────────────────
        if WEBHOOK_SECRET:
            incoming = self.headers.get('X-Webhook-Secret', '')
            if incoming != WEBHOOK_SECRET:
                self.send_json(403, {'error': 'Forbidden'})
                return

        # ── parse body ────────────────────────────────────────────────────────
        length = int(self.headers.get('Content-Length', 0))
        body   = json.loads(self.rfile.read(length) or b'{}')
        run_id = body.get('runId', '')

        # ── route to agent ────────────────────────────────────────────────────
        # Path: /run/{agent-name}
        parts = self.path.strip('/').split('/')
        if len(parts) != 2 or parts[0] != 'run':
            self.send_json(404, {'error': f'Unknown path: {self.path}'})
            return

        agent_name = parts[1]
        cmd = AGENTS.get(agent_name)
        if not cmd:
            self.send_json(404, {'error': f'Unknown agent: {agent_name}'})
            return

        log.info('Running agent=%s run_id=%s', agent_name, run_id)
        start = time.time()

        # Open a Paperclip issue to track this run.
        # Skip for agents that Paperclip invokes directly (e.g. johnson/ceo role) —
        # those already have an issue created by Paperclip. Creating another one
        # assigned back to the same agent causes an infinite retry loop.
        SKIP_ISSUE_CREATION = {'johnson'}
        issue_id = None
        agent_id = AGENT_IDS.get(agent_name)
        if agent_id and COMPANY_ID and agent_name not in SKIP_ISSUE_CREATION:
            issue = paperclip_post(f'/companies/{COMPANY_ID}/issues', {
                'title':          f'Run: {agent_name}',
                'assigneeAgentId': agent_id,
                'priority':        'medium',
                'status':          'in_progress',
            })
            if issue:
                issue_id = issue.get('id')
                log.info('Paperclip issue %s created for %s', issue_id, agent_name)

        env = {**os.environ, 'PAPERCLIP_RUN_ID': run_id, 'PAPERCLIP_API_URL': PAPERCLIP_URL}

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=300,   # 5 min max
                env=env,
            )
            elapsed = round(time.time() - start, 1)
            stdout  = result.stdout.decode(errors='replace')
            stderr  = result.stderr.decode(errors='replace')
            ok      = result.returncode == 0

            log.info('Agent=%s done in %ss exit=%d', agent_name, elapsed, result.returncode)
            if stderr:
                log.warning('Agent=%s stderr: %s', agent_name, stderr[:500])

            # Close the Paperclip issue with result
            if issue_id:
                paperclip_patch(f'/issues/{issue_id}', {
                    'status':      'done' if ok else 'cancelled',
                    'description': f'Elapsed: {elapsed}s\n\n{stdout[-1500:]}' + (f'\n\nErrors:\n{stderr[-500:]}' if stderr else ''),
                })

            self.send_json(200, {
                'status':  'succeeded' if ok else 'failed',
                'result':  stdout[-2000:] if stdout else '',
                'error':   stderr[-1000:] if not ok else '',
                'elapsed': elapsed,
                'usage':   {'inputTokens': 0, 'outputTokens': 0, 'totalTokens': 0},
            })

        except subprocess.TimeoutExpired:
            if issue_id:
                paperclip_patch(f'/issues/{issue_id}', {
                    'status': 'cancelled',
                    'description': f'Timed out after 300s',
                })
            self.send_json(200, {
                'status': 'failed',
                'error':  f'Agent {agent_name} timed out after 300s',
                'usage':  {'inputTokens': 0, 'outputTokens': 0, 'totalTokens': 0},
            })
        except Exception as e:
            if issue_id:
                paperclip_patch(f'/issues/{issue_id}', {'status': 'cancelled', 'description': str(e)})
            log.exception('Agent=%s unexpected error', agent_name)
            self.send_json(500, {'status': 'failed', 'error': str(e)})

    def do_GET(self):
        if self.path == '/health':
            self.send_json(200, {'status': 'ok', 'agents': list(AGENTS.keys())})
        else:
            self.send_json(404, {'error': 'Not found'})


# ── main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.environ.get('PAPERCLIP_WEBHOOK_PORT', 8765))
    server = HTTPServer(('127.0.0.1', port), WebhookHandler)
    log.info('BBA Paperclip webhook router listening on 127.0.0.1:%d', port)
    log.info('Registered agents: %s', ', '.join(AGENTS.keys()))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info('Shutting down.')
