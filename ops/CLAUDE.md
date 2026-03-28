# BBA Mission Control — Master Context

## What this is

George's AI operating system for running ByeByeAdmin. Lives in `ops/` inside the main byebyeadmin repo alongside the site code.

**Two environments:**
- **MacBook (Claude Code in VS Code)** — active build work, deliberate tasks
- **Hetzner VPS** — runs the Slack router (Socket Mode listener) and 5 direct cron scripts that call APIs and post to Slack. All AI logic runs on the VPS itself via an LLM cascade (Anthropic → Gemini → OpenAI).

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

## Agent architecture (VPS cron scripts)

All scheduled AI logic runs as Python/Node.js scripts directly on the VPS. Scripts call APIs, run an LLM cascade (Anthropic → Gemini → OpenAI), and post results to Slack via the Johnson bot. The VPS also runs the Slack router for interactive DM handling.

### VPS cron scripts

| Script | Schedule | Purpose |
|--------|----------|---------|
| `ops/scripts/bba-morning-briefing.py` | 8am UTC Mon-Fri | Daily snapshot: Instantly + YouTube + GA4 + Clarity → Slack |
| `ops/scripts/bba-weekly-analytics.py` | 8:30am UTC Monday | 7-day KPIs with WoW deltas + writes Google Sheets → Slack |
| `ops/scripts/bba-pipeline-check.js` | 9am + 5pm UTC daily | Drive → Whisper → Claude → Buffer content pipeline |
| `ops/scripts/bba-content-inventory.py` | 6am UTC daily | Buffer YouTube queue alert if <3 posts in next 7 days |
| `ops/scripts/bba-website-review.py` | 8am UTC Sunday | GA4 + Clarity weekly website report (Claude Sonnet) → Slack |

### VPS files

```
agents/slack-router.js   — LIVE service: Socket Mode router, handles interactive DMs
agents/archive/          — old remote trigger implementations (reference only)
```

### VPS crontab (actual entries)

```
0 8 * * 1-5   python3 /home/openclaw/byebyeadmin/ops/scripts/bba-morning-briefing.py >> ~/.openclaw/cron.log 2>&1
30 8 * * 1    python3 /home/openclaw/byebyeadmin/ops/scripts/bba-weekly-analytics.py >> ~/.openclaw/cron.log 2>&1
0 9,17 * * *  /home/openclaw/.nvm/versions/node/v22.22.1/bin/node /home/openclaw/byebyeadmin/ops/scripts/bba-pipeline-check.js --check >> ~/.openclaw/cron.log 2>&1
0 6 * * *     python3 /home/openclaw/byebyeadmin/ops/scripts/bba-content-inventory.py >> ~/.openclaw/cron.log 2>&1
0 8 * * 0     python3 /home/openclaw/byebyeadmin/ops/scripts/bba-website-review.py >> ~/.openclaw/cron.log 2>&1
```

Logs: `tail -f ~/.openclaw/cron.log` on VPS.

### Instantly API proxy

Cloudflare Worker (`instantly-proxy.georgeautomates.workers.dev`) proxies VPS → api.instantly.ai, bypassing Cloudflare's ASN block on Hetzner IPs. Secret in VPS `.env` as `INSTANTLY_PROXY_SECRET`. Worker code in `ops/instantly-proxy/worker.js`.

### Remote triggers (kept for interactive DM handling only)

| Trigger | Purpose |
|---------|---------|
| `bba-research` | On-demand last30days research via Slack (`last30 [topic]`) |
| `bba-chat` | Ad-hoc DM chat + agent tasks (Slack router fallback) |

### Content pipeline approval state

Pending approvals are stored in Google Sheets tab "Pending Approvals" in sheet `1Wx7J-m97iyXnK4_XxvtaAdnXW-FpB77hQI91mw4Lo7c`.
Columns: run_id | filename | drive_file_id | schedule_date | title_1 | title_2 | title_3 | ig_1 | ig_2 | linkedin | yt_description | transcript | status
Status values: awaiting → processed | skipped

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
| GA4 | Website analytics | Live — `GA4_PROPERTY_ID=527598212`, OAuth via `GOOGLE_CLIENT_ID`/`GOOGLE_REFRESH_TOKEN` (fallback: `GMAIL_*` vars) |
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
