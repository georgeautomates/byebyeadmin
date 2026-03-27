# Slack Router — VPS Setup

The `slack-router.js` is the only persistent service on the VPS. It's a ~75-line Socket Mode listener that routes George's Slack DMs to Claude Code remote triggers. Zero business logic.

## One-time VPS setup

### 1. SSH in
```bash
ssh openclaw@178.104.12.113
```

### 2. Get the 4 trigger IDs from claude.ai

Go to claude.ai → Claude Code → Remote Triggers. Create 4 triggers using the prompts in `ops/triggers/`:
- `bba-briefings` → copy bba-briefings.md
- `bba-content`   → copy bba-content.md
- `bba-research`  → copy bba-research.md
- `bba-chat`      → copy bba-chat.md

Note each trigger ID — you'll need them below.

### 3. Update systemd service

Edit `/etc/systemd/system/bba-slack-listener.service`:

```ini
[Unit]
Description=BBA Slack Router
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/home/openclaw/byebyeadmin/ops
ExecStart=/home/openclaw/.nvm/versions/node/v22.22.1/bin/node agents/slack-router.js
Restart=always
RestartSec=10
Environment=SLACK_BOT_TOKEN=xoxb-...
Environment=SLACK_APP_TOKEN=xapp-...
Environment=SLACK_USER_ID=U0AETR5UK4Y
Environment=SLACK_EXTRA_USERS=U0AE35DN7JQ
Environment=CLAUDE_ACCESS_TOKEN=...
Environment=BRIEFING_TRIGGER_ID=...
Environment=CONTENT_TRIGGER_ID=...
Environment=RESEARCH_TRIGGER_ID=...
Environment=AGENT_TRIGGER_ID=...
Environment=CHAT_TRIGGER_ID=...

[Install]
WantedBy=multi-user.target
```

### 4. Update VPS crontab

```bash
crontab -e
```

Replace the old agent cron entries. Keep the git pull. Add these 4 new entries (fill in actual trigger IDs):

```cron
# Git sync (unchanged)
*/15 * * * * cd /home/openclaw/byebyeadmin && git pull origin main --quiet

# Claude Code remote trigger crons
# Fill in actual values for BRIEFING_TRIGGER_ID, CONTENT_TRIGGER_ID, CLAUDE_ACCESS_TOKEN

# Morning briefing — 8am UTC Mon-Fri
0 8 * * 1-5 curl -s -X POST "https://api.claude.ai/v1/code/triggers/BRIEFING_TRIGGER_ID/run" -H "Authorization: Bearer CLAUDE_ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"prompt_addition":"\n\nRun: MORNING BRIEFING"}' >> /home/openclaw/cron.log 2>&1

# Weekly analytics — 8:30am UTC Monday
30 8 * * 1 curl -s -X POST "https://api.claude.ai/v1/code/triggers/BRIEFING_TRIGGER_ID/run" -H "Authorization: Bearer CLAUDE_ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"prompt_addition":"\n\nRun: WEEKLY ANALYTICS"}' >> /home/openclaw/cron.log 2>&1

# Content pipeline — 9am and 5pm UTC daily
0 9,17 * * * curl -s -X POST "https://api.claude.ai/v1/code/triggers/CONTENT_TRIGGER_ID/run" -H "Authorization: Bearer CLAUDE_ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"prompt_addition":"\n\nRun: PIPELINE CHECK"}' >> /home/openclaw/cron.log 2>&1

# Content inventory — 6am UTC daily
0 6 * * * curl -s -X POST "https://api.claude.ai/v1/code/triggers/BRIEFING_TRIGGER_ID/run" -H "Authorization: Bearer CLAUDE_ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"prompt_addition":"\n\nRun: CONTENT INVENTORY"}' >> /home/openclaw/cron.log 2>&1
```

### 5. Reload and restart

```bash
sudo systemctl daemon-reload
sudo systemctl restart bba-slack-listener
sudo systemctl status bba-slack-listener
```

### 6. Test a trigger manually

```bash
curl -s -X POST "https://api.claude.ai/v1/code/triggers/BRIEFING_TRIGGER_ID/run" \
  -H "Authorization: Bearer CLAUDE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt_addition":"\n\nRun: MORNING BRIEFING"}'
```

Check Slack — briefing should arrive within ~30 seconds.

## Google Sheets setup (one-time)

Open: https://docs.google.com/spreadsheets/d/1Wx7J-m97iyXnK4_XxvtaAdnXW-FpB77hQI91mw4Lo7c

Add two new tabs:

**Tab: Pending Approvals**
Row 1 headers:
run_id | filename | drive_file_id | schedule_date | title_1 | title_2 | title_3 | ig_1 | ig_2 | linkedin | yt_description | transcript | status

**Tab: Analytics State**
Row 1 headers:
week_ending | yt_subscribers | yt_views_7d | sessions_7d | assessment_completions_7d

## Migration checklist

- [ ] Create 4 remote triggers on claude.ai, note trigger IDs
- [ ] Add Pending Approvals + Analytics State tabs to Google Sheets
- [ ] Test each trigger manually via curl (check Slack for output)
- [ ] git pull on VPS to get slack-router.js
- [ ] Update systemd service file with new env vars + new ExecStart
- [ ] Update crontab with 4 curl entries
- [ ] sudo systemctl daemon-reload && restart
- [ ] Test Slack DM: send `last30 haulage` — should see "Researching..."
- [ ] Test content approval flow with a real video
- [ ] Monitor 48h
- [ ] Move old agents to archive/ once stable
