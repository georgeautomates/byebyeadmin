# Agent: Analytics Update

## Purpose

Weekly deeper analytics report, sent every Monday at 8:30 AM. Provides trend data and week-over-week comparisons across all channels.

## Schedule

`30 8 * * 1` (cron) — 8:30 AM UTC every Monday

## Scope

Extends the morning briefing with 7-day trend data:

- **Instantly:** Weekly send volume, open rate %, reply rate %, unsubscribe rate, top performing subject lines
- **GA4:** Weekly sessions, top traffic sources, assessment funnel (start → contact → complete), conversion rate
- **YouTube:** Views (7d), watch time, new subscribers, top video
- **Instagram:** Reach, profile visits, follower growth, top post reach
- **Facebook:** Page reach, top post

## Output format

```
📊 BBA Weekly Analytics — Week of [Date]

📧 OUTREACH (7 days)
Sent: X | Open rate: X% | Reply rate: X%
Best subject: "[subject line]"
[Week-over-week delta]

🌐 SITE (7 days)
Sessions: X (WoW: +X%)
Assessment funnel: X started → X contact → X completed (X% conv)
Top source: [organic/direct/social]

📺 YOUTUBE (7 days)
Views: X | Watch time: Xh | New subs: +X
Top video: "[title]" — Xk views

📱 INSTAGRAM (7 days)
Reach: X | Profile visits: X | New followers: +X
Top post: [description] — X reach

💡 INSIGHT
[1–2 sentences: the most notable trend this week and what it suggests]
```

## Implementation

Script: `agents/analytics-update.js`
Same API calls as morning briefing but with longer date ranges (7-day windows).
Runs on VPS, sends via OpenClaw to WhatsApp.
