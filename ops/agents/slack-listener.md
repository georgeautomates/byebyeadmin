# Agent: Slack Listener

## Purpose

Persistent Socket Mode Slack bot that routes on-demand commands from George's DMs to the appropriate agent scripts on the VPS. Runs as a systemd service alongside OpenClaw.

## Supported commands

| DM | Action |
|----|--------|
| `last30 [topic]` | Run last30days research, post brief to Slack |

## Implementation

Script: `agents/slack-listener.js`
Requires: `@slack/bolt` npm package

## Required env vars

| Var | Where to get it |
|-----|-----------------|
| `SLACK_BOT_TOKEN` | Slack app config → OAuth & Permissions → Bot Token (xoxb-...) |
| `SLACK_APP_TOKEN` | Slack app config → Basic Information → App-Level Tokens (xapp-...) |
| `SLACK_USER_ID` | George's Slack user ID — `U0AETR5UK4Y` (default) |

These are already set in OpenClaw's systemd env. Copy them into the `bba-slack-listener` service.

## VPS setup

### 1. Install @slack/bolt

```bash
cd /home/openclaw/byebyeadmin/ops
npm init -y
npm install @slack/bolt
```

### 2. Create systemd service

```ini
# /etc/systemd/system/bba-slack-listener.service

[Unit]
Description=BBA Slack Listener
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/home/openclaw/byebyeadmin/ops
ExecStart=/home/openclaw/.nvm/versions/node/v22.22.1/bin/node /home/openclaw/byebyeadmin/ops/agents/slack-listener.js
Restart=always
RestartSec=10

Environment=SLACK_BOT_TOKEN=xoxb-...
Environment=SLACK_APP_TOKEN=xapp-...
Environment=SLACK_USER_ID=U0AETR5UK4Y

[Install]
WantedBy=multi-user.target
```

### 3. Enable and start

```bash
systemctl daemon-reload
systemctl enable bba-slack-listener
systemctl start bba-slack-listener
systemctl status bba-slack-listener
```

### 4. Check logs

```bash
journalctl -u bba-slack-listener -f
```

## Notes

- Slack supports multiple simultaneous Socket Mode connections to the same app — no conflict with OpenClaw
- The listener only processes DMs from `SLACK_USER_ID` — ignores all other messages
- research.js is spawned as a child process so the listener stays responsive during long research runs
- If research.js fails, it sends its own error message to Slack
