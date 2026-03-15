# BBA Mission Control — Master Context

## What this is

George's AI operating system for running ByeByeAdmin. Lives in `ops/` inside the main byebyeadmin repo alongside the site code.

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

## Skills directory

Skills are in `skills/`. Invoke by name when you need a specific behaviour:

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

Agent definitions in `agents/`:

```
agents/morning-briefing.js   — live cron on VPS (Instantly + YouTube → Slack, 8am UTC Mon-Fri)
agents/morning-briefing.md
agents/analytics-update.md
agents/prospector.md
agents/transcription.md
agents/memory.md
```

## API tools wired in (OpenClaw VPS + Claude Code)

| Tool | Purpose | Status |
|------|---------|--------|
| Instantly | Email campaign CRM | Live — `INSTANTLY_API_KEY` in env |
| Apollo | Prospect enrichment | Live — `APOLLO_API_KEY` in env |
| Apify | Web scraping | Live — `APIFY_TOKEN` in env |
| YouTube | Channel stats | Live — `YOUTUBE_API_KEY` in env |
| Supabase | Database + memory | Configured — `SUPABASE_ACCESS_TOKEN` |
| Vercel CLI | Deployments | Live — `VERCEL_TOKEN` in env |
| gh CLI | GitHub | Live — authenticated as `georgeautomates` |
| n8n | Workflow automation | Live — MCP wired in Claude Code |
| Perplexity | Web research | Not yet — needs `PERPLEXITY_API_KEY` |
| Firecrawl | Web scraping | Not yet — needs `FIRECRAWL_API_KEY` |

## Conventions

- No em dashes in any user-facing copy (`—`, `&mdash;`, `\u2014`)
- Inline styles only in Next.js components — no Tailwind, no CSS modules
- Colours from `C.xxx` tokens in `lib/constants.ts`
- All API keys in `.env` or `.env.local` (gitignored) — never hardcoded
- Commit messages: present tense, imperative, concise

## Memory

Persistent context in `memory/MEMORY.md`. The memory agent appends here when context should survive across sessions.

## VPS sync

The VPS clones the `byebyeadmin` repo and pulls every 15 minutes via cron. Push from Mac, live on OpenClaw within 15 min.

VPS path: `/home/openclaw/byebyeadmin/ops/`

## Business context

**ByeByeAdmin** — AI automation for UK haulage fleets (3–100 vehicles). Based in Kent.
George Spain-Warner, founder. Cold outreach to 4,276 UK fleet operators ongoing (Instantly).
Assessment funnel at byebyeadmin.co.uk/assessment captures and scores inbound leads.
