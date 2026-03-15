# Sales & Outreach — Project Context

## What this project covers

Cold outreach, lead generation, prospecting, CRM management, and pipeline tracking for ByeByeAdmin.

## Active campaigns (Instantly)

4,276 UK haulage contacts across 6 tiers. Scripts in `instantly-campaigns/` at repo root.

Key env vars: `INSTANTLY_API_KEY`, `INSTANTLY_ASSESSMENT_LIST_ID=7eac5b71-46a6-491f-b3af-6801d35abeb9`

| Tier | Campaign | Leads | Copy | Status |
|------|----------|-------|------|--------|
| T1 | T1-Kent-HomeTurf | 159 | Done | Launched Mar 9 |
| T2 | T2-SweetSpot-DMs | 1,355 | Done | Launched Mar 9 |
| T3 | T3-Ops-Transport | 145 | Needs writing | Blocked |
| T4 | T4-Commercial-Growth | 475 | Needs writing | Blocked |
| T5 | T5-Larger-Fleets | 921 | Needs writing | Blocked |
| T6 | T6-Micro-Operators | 1,221 | Done | Ready (Wave 4) |

Send window: Mon–Thu 08:30–10:30 UK. Timezone in Instantly: `Atlantic/Canary`.

## Launch sequence

| Wave | Tiers | Notes |
|------|-------|-------|
| 1 | T1 + T2 | Launched Mar 9 |
| 2 | T3 + T4 | After T2 completes (~Mar 18). Copy needs writing first. |
| 3 | T5 | Copy needs writing |
| 4 | T6 | Ready to go |

## Hot opener sync

Vercel cron at `byebyeadmin.co.uk/api/cron/sync-hot-openers` runs daily at 8am UTC. Pulls leads with 3+ email opens into the "Hot Openers – 3+ Opens" Instantly list.

## Apollo prospecting

Apollo API key: `APOLLO_API_KEY` in env. Use for enriching prospects by company, title, or domain.

Typical use: "Find UK fleet operators with 10–50 vehicles in [county], pull decision maker contacts"

## Skills to use here

- `skills/prospector-researcher.md` — Apollo-driven prospect research
- `skills/email-writing.md` — Cold email copy, subject lines, follow-ups
- `skills/summarising-agent.md` — Summarise campaign performance data

## Data sources

- Instantly API — campaign stats, open/reply rates, lead status
- Apollo API — prospect enrichment
- Google Sheets — assessment lead log
- `instantly-campaigns/data/leads.json` — master lead list (4,276 contacts)

## Target audience

UK haulage fleet operators running 3–100 vehicles. Job titles: Managing Director, Operations Director, Transport Manager, Fleet Manager. Decision-making is centralised — owner/director makes the call.

Pain points: admin overload, compliance paperwork, driver communication, invoice chasing.

## Tone

Direct, no-nonsense, peer-to-peer. Not salesy. Position as someone who understands haulage ops. No buzzwords. Short sentences.
