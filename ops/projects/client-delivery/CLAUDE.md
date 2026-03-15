# Client Delivery — Project Context

## What this project covers

Onboarding, workflow builds, reporting, and ongoing delivery for ByeByeAdmin clients. UK haulage fleet operators who have signed up for AI automation services.

## Typical client engagement

1. **Assessment** — Client completes assessment at byebyeadmin.co.uk/assessment
2. **Discovery call** — Calendly booking, review their assessment score and maturity stage
3. **Audit** — Map their current admin processes, identify top 3 automation wins
4. **Build** — n8n workflows for their specific ops (invoice processing, driver comms, compliance, etc.)
5. **Handover** — Documentation, training, ongoing support tier

## Skills to use here

- `skills/n8n-workflow-builder.md` — Build automations for client ops
- `skills/assessment-builder.md` — Create or customise assessment flows
- `skills/summarising-agent.md` — Summarise audit findings into a brief
- `skills/reflection-agent.md` — Review delivery quality, identify improvements

## n8n

Workflows built in n8n (self-hosted). n8n MCP is wired in. Use it to search existing workflows before building new ones — avoid duplication.

Instance: `https://n8n.srv1155250.hstgr.cloud`

## Common automation patterns for haulage clients

- **Invoice matching** — OCR + webhook → match to job sheet → flag discrepancies
- **Driver daily checks** — WhatsApp bot → structured form → dashboard
- **Compliance reminders** — Scheduled cron → licence/MOT expiry alerts
- **Job sheet creation** — Customer email → parse → create job in TMS
- **Subcontractor comms** — Trigger on job assignment → send job details via WhatsApp

## Active clients

None yet (pre-revenue, outreach live as of Mar 9). First client expected via assessment funnel or outreach reply.

## Assessment maturity stages (from assessmentLogic.ts)

Determines where in the journey a client is and what to prioritise. Reference `~/byebyeadmin/lib/assessmentLogic.ts` for full scoring logic.
