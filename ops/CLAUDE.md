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
| `projects/website-builds/` | Website Builds | Site development, landing pages, assessment funnel |

## Brand Context (Source of Truth)

Single source of truth for all written output. **Mandatory: read before any skill that produces copy.**

```
brand-context/voice.md       — tone, sentence style, hard rules, channel notes
brand-context/positioning.md — what we are, differentiators, proof points, narrative
brand-context/icp.md         — who we're talking to, pain points, triggers, language
```

## Skills directory

Skills are in `skills/`. Invoke by name when you need a specific behaviour. All skills have front matter with `category`, `depends-on`, `triggers`, and `overlaps` for collision detection.

**Mandatory rule:** Before executing any skill, check the relevant section of `ops/learnings.md` and apply any logged corrections.

```
skills/assessment-builder.md    — category: product
skills/campaign-writer.md       — category: sales          (reads brand-context/voice + icp + positioning)
skills/caption-writing.md       — category: brand-content  (reads brand-context/voice + icp)
skills/client-onboarding.md     — category: client-delivery (reads brand-context/icp + positioning)
skills/claude-md-optimiser.md   — category: meta
skills/email-writing.md         — category: sales          (reads brand-context/voice + icp)
skills/frontend-design.md       — category: product
skills/heartbeat.md             — category: meta           (run at session start)
skills/idea-generator.md        — category: brand-content  (reads brand-context/icp + positioning)
skills/memory-agent.md          — category: meta
skills/n8n-workflow-builder.md  — category: client-delivery
skills/prospector-researcher.md — category: sales
skills/reflection-agent.md      — category: strategy
skills/reply-handler.md         — category: sales          (reads brand-context/voice + icp)
skills/script-writing.md        — category: brand-content  (reads brand-context/voice + positioning)
skills/skill-builder.md         — category: meta
skills/subject-book-writer.md   — category: brand-content  (reads brand-context/voice + positioning + icp)
skills/summarising-agent.md     — category: ops
skills/transcription.md         — category: ops
skills/wrap-up.md               — category: meta           (run at session end)
```

## Agents directory

Agent definitions and implementations in `agents/`:

```
agents/morning-briefing.js   — LIVE cron: Instantly + GA4 + Clarity tip + YouTube + IG + FB → Slack (8am UTC Mon-Fri)
agents/morning-briefing.md   — spec
agents/analytics-update.js   — LIVE cron: 7-day trends → Slack (8:30am UTC Mondays)
agents/analytics-update.md   — spec
agents/research.js           — LIVE on-demand: last30days research → Slack (triggered by slack-listener)
agents/research.md           — spec
agents/slack-listener.js     — LIVE service: Socket Mode inbound handler, routes "last30 [topic]" DMs
agents/slack-listener.md     — spec (includes VPS setup + systemd service config)
agents/lib/context-loader.js — shared utility: loads skills/brand-context/learnings for VPS agents
agents/prospector.md         — spec only (implement: apollo → CSV → Slack)
agents/transcription.md      — spec only (implement: voice → Whisper → structured output)
agents/memory.md             — spec only (manual via memory-agent skill)
```

**VPS agents that produce written output** must use `agents/lib/context-loader.js`:
```js
import { buildSystemPrompt } from './lib/context-loader.js'
const system = buildSystemPrompt(['skill-name'], ['voice', 'icp'])
// pass `system` as the system prompt in your Anthropic API call
```

## API tools wired in (OpenClaw VPS + Claude Code)

| Tool | Purpose | Status |
|------|---------|--------|
| Instantly | Email campaign CRM | Live — `INSTANTLY_API_KEY` in env, MCP wired on Mac + VPS |
| Apollo | Prospect enrichment | Live — `APOLLO_API_KEY` in env |
| Apify | Web scraping | Live — `APIFY_TOKEN` in env |
| YouTube | Channel stats | Live — `YOUTUBE_API_KEY` in env |
| Supabase | Database + memory | Configured — `SUPABASE_ACCESS_TOKEN` |
| Vercel CLI | Deployments | Live — `VERCEL_TOKEN` in env |
| gh CLI | GitHub | Live — authenticated as `georgeautomates` |
| n8n | Workflow automation | Live — MCP wired in Claude Code |
| GA4 | Website analytics | Live — `GA4_PROPERTY_ID=527598212`, OAuth via `GMAIL_*` vars |
| Perplexity | Web research | Live — `PERPLEXITY_API_KEY` in env |
| Tavily | Web search | Live — `TAVILY_API_KEY` in env |

## Conventions

- No em dashes in any user-facing copy (`—`, `&mdash;`, `\u2014`)
- Inline styles only in Next.js components — no Tailwind, no CSS modules
- Colours from `C.xxx` tokens in `lib/constants.ts`
- All API keys in `.env` or `.env.local` (gitignored) — never hardcoded
- Commit messages: present tense, imperative, concise

## Learnings

`ops/learnings.md` — structured feedback log. One section per skill. **Read the relevant section before running any skill.** Log corrections and process improvements here via the wrap-up skill.

## Memory

Persistent context in `memory/MEMORY.md`. The memory agent appends here when context should survive across sessions.

## VPS sync

The VPS clones the `byebyeadmin` repo and pulls every 15 minutes via cron. Push from Mac, live on OpenClaw within 15 min.

VPS path: `/home/openclaw/byebyeadmin/ops/`

## Business context

**ByeByeAdmin** — AI automation for UK haulage fleets (3–100 vehicles). Based in Kent.
George Spain-Warner, founder. Cold outreach to 4,276 UK fleet operators ongoing (Instantly).
Assessment funnel at byebyeadmin.co.uk/assessment captures and scores inbound leads.
