# Agent: Research (last30days)

## Purpose

On-demand research across Reddit, X, YouTube, TikTok, HN, Bluesky, and the web for the last 30 days. Triggered by Slack DM via `slack-listener.js`, or run directly from terminal.

## Trigger

DM OpenClaw in Slack: `last30 [topic]`

Examples:
- `last30 UK fleet telematics`
- `last30 AI automation haulage`
- `last30 cold email best practices 2026`

## Implementation

Script: `agents/research.js`

Takes `--topic "[topic]"` as a CLI argument. Runs `last30days.py`, formats output for Slack (4000 char limit), sends via `openclaw message send`.

## Dependencies

| Requirement | Notes |
|-------------|-------|
| `SCRAPECREATORS_API_KEY` | In `ops/.env` on Mac; systemd env on VPS |
| `python3` | Available on VPS |
| last30days skill | Clone to `.claude/skills/last30days/` — NOT synced via git |
| `openclaw` CLI | Available on VPS |

### Clone last30days on VPS

```bash
git clone https://github.com/mvanhorn/last30days-skill \
  /home/openclaw/byebyeadmin/.claude/skills/last30days
```

## Manual run

```bash
# From VPS or Mac
node /path/to/ops/agents/research.js --topic "UK fleet telematics"
```

## Output

Sends a Slack DM to George with:
- Topic header
- Source list (Reddit, X, YouTube, HN, Bluesky, web)
- Full research brief (truncated to Slack limit if needed)
- Note pointing to full report at `~/Documents/Last30Days/` if truncated

Research takes 2-8 minutes depending on topic niche.
