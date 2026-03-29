# BBA Google Auth Reference

Two OAuth credential sets. Each maps to a Google account with specific scopes and responsibilities.

---

## Account 1: george@byebyeadmin.com (Workspace)

**Env var prefix:** `GOOGLE_*`

| Var | Where stored |
|-----|-------------|
| `GOOGLE_CLIENT_ID` | VPS `.env`, `.env.local`, Vercel |
| `GOOGLE_CLIENT_SECRET` | VPS `.env`, `.env.local`, Vercel |
| `GOOGLE_REFRESH_TOKEN` | VPS `.env`, `.env.local`, Vercel |

**Scopes:**
- `spreadsheets` — assessment lead sheet (owned by this account)
- `analytics.readonly` — GA4 property 527598212 (byebyeadmin.co.uk)
- `documents` — Google Docs creation
- `drive` — Google Drive access

**Used by:**
- `lib/sheets.ts` (Next.js — writes assessment leads)
- `ops/scripts/bba-morning-briefing.py` (GA4 only)
- `ops/scripts/bba-weekly-analytics.py` (GA4 only — Sheets uses Account 2)
- `ops/scripts/bba-website-review.py` (GA4 only — Sheets uses Account 2)

**Reauth script:** `scripts/google-reauth.mjs`
```
GOOGLE_CLIENT_SECRET=xxx node scripts/google-reauth.mjs
```
Sign in as george@byebyeadmin.com. Revoke first at https://myaccount.google.com/permissions

---

## Account 2: george.automates.ai@gmail.com (personal)

**Env var prefix:** `GOOGLE_DRIVE_*`

| Var | Where stored |
|-----|-------------|
| `GOOGLE_DRIVE_CLIENT_ID` | VPS `.env`, `.env.local` |
| `GOOGLE_DRIVE_CLIENT_SECRET` | VPS `.env`, `.env.local` |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | VPS `.env`, `.env.local` |

**Scopes:**
- `drive` — Google Drive (content pipeline video folder)
- `spreadsheets` — all ops Sheets (Hot Leads, Content Ideas, Blog Queue, Campaign Drafts, CEO Briefs, Brand Voice Log, Analytics State, CRO Backlog, Pending Approvals)
- `documents` — Google Docs creation (blog posts)
- `gmail.send` — email sending from this address

**Used by:**
- `ops/agents/content-pipeline.js` (Drive read + Sheets write)
- `ops/scripts/bba-hot-leads.py` (Sheets)
- `ops/scripts/bba-content-strategist.py` (Sheets)
- `ops/scripts/bba-blog-writer.py` (Sheets + Docs + Drive)
- `ops/scripts/bba-campaign-builder.py` (Sheets)
- `ops/scripts/bba-ceo-brief.py` (Sheets)
- `ops/scripts/bba-copywriter.py` (Sheets)
- `ops/scripts/bba-paperclip-snapshot.py` (Docs)
- `ops/scripts/bba-weekly-analytics.py` (Sheets only)
- `ops/scripts/bba-website-review.py` (Sheets only)

**Reauth script:** `scripts/drive-reauth.mjs`
```
node scripts/drive-reauth.mjs
```
Sign in as george.automates.ai@gmail.com. Revoke first at https://myaccount.google.com/permissions
(GOOGLE_DRIVE_CLIENT_ID/SECRET loaded automatically from .env.local)

---

## YouTube API Key

Not OAuth. Public data only (channel stats, subscriber count).

| Var | Where stored |
|-----|-------------|
| `YOUTUBE_API_KEY` | VPS `.env`, `.env.local` |
| `YOUTUBE_CHANNEL_ID` | VPS `.env`, `.env.local` |

No expiry. Rotate via Google Cloud Console if needed.

---

## Health check

`ops/scripts/bba-google-health.py` runs Monday 7am UTC. Tests both tokens + YouTube key.
DMs George via Slack if anything is broken. Silent if all healthy.

```bash
# Run manually to check
python3 ops/scripts/bba-google-health.py
```

---

## Vars to REMOVE (deprecated — consolidated into GOOGLE_*)

These existed previously and should not be set anywhere:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`

Remove from: VPS `.env`, `.env.local`, Vercel dashboard.
