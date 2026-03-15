# BBA Mission Control — Master Context

## What this is

This is George's personal AI operating system for running ByeByeAdmin. It lives in `ops/` inside the main byebyeadmin repo and contains all ops infrastructure: skills, agents, project contexts, and memory.

**Two environments:**
- **MacBook (Claude Code in VS Code)** — active build work, deliberate tasks
- **Hetzner VPS (OpenClaw)** — ambient 24/7 agent, morning briefings, monitoring

## Projects

| Directory | Domain | What it covers |
|-----------|--------|---------------|
| `projects/sales-outreach/` | Sales & Outreach | Instantly campaigns, Apollo prospecting, cold email, lead tracking |
| `projects/brand-content/` | Brand & Content | IG/YT/LinkedIn content, captions, scripts, ideas |
| `projects/client-delivery/` | Client Delivery | Onboarding, workflow builds, reporting for haulage clients |
| `projects/strategy/` | Strategy | Business decisions, positioning, pricing, offers |
| `projects/website-builds/` | Website & Builds | byebyeadmin.co.uk site, landing pages, client sites |

## Skills directory

Skills are markdown files in `skills/`. Invoke them by name when you need a specific behaviour:

```
skills/assessment-builder.md
skills/frontend-design.md
skills/n8n-workflow-builder.md
skills/script-writing.md
skills/caption-writing.md
skills/idea-generator.md
skills/reflection-agent.md
skills/skill-builder.md
skills/email-writing.md
skills/subject-book-writer.md
skills/prospector-researcher.md
skills/summarising-agent.md
skills/memory-agent.md
skills/claude-md-optimiser.md
```

## Agents directory

Agent definition files in `agents/`. These describe ambient agents that run on the VPS or on demand:

```
agents/morning-briefing.md
agents/analytics-update.md
agents/prospector.md
agents/transcription.md
agents/memory.md
```

## MCP tools wired in

| Tool | Purpose | Key env var |
|------|---------|-------------|
| n8n | Workflow automation | `N8N_API_KEY` |
| Apify | Large-scale web scraping | `APIFY_TOKEN` |
| Instantly | Email campaign CRM | `INSTANTLY_API_KEY` |
| Apollo | Prospect enrichment | `APOLLO_API_KEY` |
| Supabase | Database + memory storage | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| Perplexity | Real-time web research | `PERPLEXITY_API_KEY` |
| Firecrawl | Web scraping + extraction | `FIRECRAWL_API_KEY` |
| Google Workspace | Docs, Sheets, Gmail, Calendar | OAuth |

## Conventions

- No em dashes in any user-facing copy (`—`, `&mdash;`, `\u2014`)
- Inline styles only in Next.js components — no Tailwind, no CSS modules
- Colours from `C.xxx` tokens in `byebyeadmin/lib/constants.ts`
- All API keys in `.env` file (gitignored) or as shell env vars — never hardcoded
- Commit messages: present tense, imperative, concise

## Memory

Persistent context lives in `memory/MEMORY.md`. The memory agent appends to this file when new context should be retained across sessions.

## VPS sync

The VPS clones the `byebyeadmin` repo and pulls from `ops/` every 15 minutes via cron. Push changes from your Mac and they'll be live on OpenClaw within 15 minutes automatically.

VPS path: `/home/openclaw/byebyeadmin/ops/`

## Business context

**ByeByeAdmin** — AI automation for UK haulage fleets (3–100 vehicles). Based in Kent.
George Spain-Warner, founder. Cold outreach to 4,276 UK fleet operators ongoing (Instantly).
Assessment funnel at byebyeadmin.co.uk/assessment captures and scores inbound leads.
