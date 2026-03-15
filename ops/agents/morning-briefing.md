# Agent: Morning Briefing

## Purpose

Runs daily at 8:00 AM UK time on the VPS. Fetches overnight stats from all key data sources, formats a short briefing, and pushes it to George's WhatsApp via OpenClaw.

## Schedule

`0 8 * * *` (cron) — 8:00 AM UTC (same as UK time in winter; adjust to `0 7 * * *` when BST is active)

## Data sources

| Source | What to fetch | API / method |
|--------|--------------|-------------|
| Instantly | Campaign stats: sends today, opens (24h), replies (24h), hot openers count | Instantly API `GET /campaigns` + `GET /leads` |
| Google Analytics (GA4) | Sessions yesterday, assessment starts, assessment completions | GA4 Data API `runReport` |
| YouTube | Subscriber count, views (last 7 days) | YouTube Data API `channels.list` |
| Instagram | Follower count, reach (last 7 days) | Meta Graph API `me/insights` |
| Facebook | Page likes/followers | Meta Graph API `me?fields=fan_count` |

## Output format (WhatsApp message)

```
🌅 BBA Morning Briefing — [Date]

📧 Outreach
Opens (24h): X | Replies: X | Hot openers: X
Active campaigns: X

🌐 Site (yesterday)
Sessions: X | Assessments started: X | Completed: X

📱 Social
YT subs: X (+X) | IG followers: X (+X) | FB: X (+X)

---
[Any alert flags — e.g. "⚠️ 0 replies in 48h — check T2 campaign"]
```

Keep it under 250 words. No padding. Just the numbers and any flags.

## Alert conditions

Automatically flag if:
- Instantly replies = 0 for 48+ hours (campaign may be paused or landing in spam)
- GA4 assessment completions = 0 for 3+ days
- Any API call fails (note which source was unavailable)

## Environment variables needed

```
INSTANTLY_API_KEY
YOUTUBE_API_KEY
YOUTUBE_CHANNEL_ID
META_ACCESS_TOKEN
META_PAGE_ID
META_IG_ACCOUNT_ID
GOOGLE_APPLICATION_CREDENTIALS  (path to GA4 service account JSON)
GA4_PROPERTY_ID
```

## Implementation notes

This agent runs as a Node.js script on the VPS: `agents/morning-briefing.js`
Script calls each API, aggregates results, formats the message, then calls:
`openclaw send --channel whatsapp --to $OPENCLAW_WHATSAPP_NUMBER --message "[formatted text]"`

If any single API fails, the briefing still sends with that source marked as "unavailable" — don't block the whole briefing on one failure.
