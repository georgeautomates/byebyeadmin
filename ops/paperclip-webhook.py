#!/usr/bin/env python3
"""BBA Paperclip Webhook Router

Paperclip HTTP adapter dispatcher. Receives POST requests from Paperclip for each
agent, runs the corresponding VPS script, and returns the result with token usage.

Port: 8765 (internal only — not exposed externally)
Secret: PAPERCLIP_WEBHOOK_SECRET env var (set in VPS .env)
"""

import os, json, subprocess, time, sys, logging
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
NODE           = '/home/openclaw/.nvm/versions/node/v22.22.1/bin/node'
SCRIPTS        = '/home/openclaw/byebyeadmin/ops/scripts'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    stream=sys.stdout,
)
log = logging.getLogger('paperclip-webhook')

# ── agent dispatch map ─────────────────────────────────────────────────────────

AGENTS = {
    'morning-brief':    ['python3', f'{SCRIPTS}/bba-morning-briefing.py'],
    'weekly-analytics': ['python3', f'{SCRIPTS}/bba-weekly-analytics.py'],
    'pipeline-check':   [NODE,      f'{SCRIPTS}/bba-pipeline-check.js', '--check'],
    'content-inventory':['python3', f'{SCRIPTS}/bba-content-inventory.py'],
    'website-review':   ['python3', f'{SCRIPTS}/bba-website-review.py'],
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

            # Token counts are reported by scripts separately via PATCH /api/runs/
            # Here we return a summary so Paperclip records the execution.
            self.send_json(200, {
                'status':  'succeeded' if ok else 'failed',
                'result':  stdout[-2000:] if stdout else '',
                'error':   stderr[-1000:] if not ok else '',
                'elapsed': elapsed,
                'usage':   {'inputTokens': 0, 'outputTokens': 0, 'totalTokens': 0},
            })

        except subprocess.TimeoutExpired:
            self.send_json(200, {
                'status': 'failed',
                'error':  f'Agent {agent_name} timed out after 300s',
                'usage':  {'inputTokens': 0, 'outputTokens': 0, 'totalTokens': 0},
            })
        except Exception as e:
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
