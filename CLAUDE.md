# ByeByeAdmin — Project Context for Claude

## What the project is

B2B marketing site + AI ops infrastructure for ByeByeAdmin (byebyeadmin.co.uk).

**Two parts in this repo:**
- Root — Next.js marketing site (App Router, Three.js, GSAP, Lenis)
- `ops/` — BBA ops infrastructure: skills, agents, project contexts, memory. See `ops/CLAUDE.md`.

---

The site is a Target audience: UK fleet operators running 3–100 vehicles. The site is built with Next.js (App Router), Three.js for the 3D hero, GSAP ScrollTrigger for scroll-driven animations, and Lenis for smooth scrolling.

## Deployment

```bash
PATH="/Users/george/homebrew/bin:/Users/george/homebrew/Cellar/node/25.6.1/bin:$PATH" NODE_TLS_REJECT_UNAUTHORIZED=0 vercel deploy --prod
```

TypeScript check before deploying:
```bash
PATH="/Users/george/homebrew/bin:/Users/george/homebrew/Cellar/node/25.6.1/bin:$PATH" node_modules/.bin/tsc --noEmit
```

Node/Vercel are installed via Homebrew at the non-standard path `/Users/george/homebrew/`. The `NODE_TLS_REJECT_UNAUTHORIZED=0` flag is required due to a sandboxed shell SSL issue.

## Key files

| File | Purpose |
|---|---|
| `app/page.tsx` | Home page (client component) |
| `app/about/page.tsx` | About page |
| `app/assessment/page.tsx` | Multi-screen assessment: welcome → quiz → contact → results |
| `app/contact/page.tsx` | Contact page |
| `app/layout.tsx` | Root layout + metadata |
| `components/ThreeHero.tsx` | 3D lorry hero (Three.js, GSAP ScrollTrigger, 5-act camera) |
| `components/HeroScroll.tsx` | Wrapper for ThreeHero with scroll-driven text acts |
| `components/AgentShowcaseScroll.tsx` | 6-agent sticky scroll section |
| `components/LoadingScreen.tsx` | Pre-loader with animated SVG lorry |
| `components/LenisProvider.tsx` | Smooth scroll (Lenis + GSAP integration) |
| `components/FAQSection.tsx` | Accordion FAQ |
| `components/CTAParticleCanvas.tsx` | Particle convergence canvas in final CTA |
| `components/ui/index.tsx` | Shared UI primitives (Fade, Btn, Section, Card, etc.) |
| `lib/constants.ts` | Brand colour tokens (`C`) and font constants (`FONT`, `MONO`) |
| `lib/assessmentLogic.ts` | Assessment scoring, questions, results calculation |
| `lib/instantly.ts` | Instantly API helper for Next.js (adds leads to CRM list) |
| `lib/sheets.ts` | Google Sheets helper (logs assessment leads to spreadsheet) |

## Design system

- **Accent (orange):** `#E8612D`
- **Teal:** `#2D8B8B`
- **Background (warm off-white):** `#F5F2EF`
- **Dark:** `#1F2937`
- **Font:** Nunito Sans (`FONT`), JetBrains Mono (`MONO`)
- All tokens live in `lib/constants.ts` as `C.xxx`

## Conventions

- **No em dashes** anywhere in user-facing copy. Replace with colon, comma, or restructure.
- **No `—` entities** (`&mdash;`, `\u2014`, unicode `—`) in JSX text. Code comments are fine.
- Page titles use `|` as separator (e.g. `ByeByeAdmin | AI Automation for UK Haulage Operations`).
- Inline styles throughout — no CSS modules, no Tailwind.
- Components use the `C` colour tokens and `FONT`/`MONO` constants directly.

## About page structure (4 sections)

1. **Founder story** — `background: C.bg`
2. **Credentials** — `background: C.bgWhite` (separate section with `<Tag teal>Credentials</Tag>`)
3. **Numbers strip** — `background: C.bgDark` (1,000+ / 12 months / 70 vehicles stats)
4. **How It Works** — `background: C.bg`

## Assessment results page

- Multi-screen state machine: `'welcome' | 'quiz' | 'contact' | 'results'`
- Results page has a **full-width dark header banner** (`C.bgDark`) outside the 680px content column
- Background: snaking road SVG (orange, `#E8612D`) behind the cards
  - `position: 'absolute', zIndex: 0` on the SVG wrapper
  - Content at `zIndex: 1` — cards are always on top
  - Road starts top-left, snakes R→L→R→L→R using 5 cubic bezier segments, `preserveAspectRatio="none"`

## Assessment lead automation

When a user submits the contact screen in the assessment, `/api/send-report` does three things in parallel (fire-and-forget, so Gmail failure doesn't block the others):

1. **Sends report email** via Gmail API to the user
2. **Adds lead to Instantly CRM** (`lib/instantly.ts`) — list: "Assessment Completions" (`INSTANTLY_ASSESSMENT_LIST_ID`)
3. **Logs to Google Sheet** (`lib/sheets.ts`) — `GOOGLE_SHEET_ID` env var

Data sent to Instantly custom variables: `readiness_score`, `vehicle_count`, `annual_savings`, `maturity_stage`.

**Required env vars** (set in `.env.local` and Vercel):
```
INSTANTLY_API_KEY          — existing
INSTANTLY_ASSESSMENT_LIST_ID=7eac5b71-46a6-491f-b3af-6801d35abeb9
GOOGLE_SHEET_ID            — ID of the Google Sheet (from its URL)
```

**Setup scripts** (one-time, already run):
```bash
# Create the Instantly list (already done — list ID above is live)
PATH="/Users/george/homebrew/Cellar/node/25.6.1/bin:$PATH" NODE_TLS_REJECT_UNAUTHORIZED=0 node instantly-campaigns/create-assessment-list.js
```

## 3D hero (ThreeHero.tsx) key state

```js
const cam = {
  x: -2.0, y: 3.5, z: -11.0,   // intro: shows cab front
  lx: -0.6, ly: 1.2, lz: -3.5, // look-at aimed at grille
  fov: isMobile ? 62 : 52,
};
```

Intro camera rise (fires after model loads, as loading screen fades):
```js
gsap.to(cam, { y: 5.5, ly: 2.0, duration: 1.5, ease: 'power2.inOut', delay: 0.6 });
```

Per-frame lorry collision clamp in the animate loop prevents camera going inside the lorry. `lorryBbox` is captured from `loadLorry()` return value.

## LenisProvider

Scroll-to-top on route change is handled via `usePathname` + `lenis.scrollTo(0, { immediate: true })`. This prevents the homepage's 500vh scroll offset carrying over to other pages.

---

## Outbound Campaign (Instantly)

Cold email outreach to 4,276 UK haulage contacts across 6 tiers. All scripts live in `instantly-campaigns/`.

### Key files

| File | Purpose |
|---|---|
| `instantly-campaigns/run.js` | Main script: create / upload leads / launch |
| `instantly-campaigns/sequences.js` | All 6 tier email sequences (full copy + spintax) |
| `instantly-campaigns/api.js` | Instantly API v2 wrapper (verified endpoints) |
| `instantly-campaigns/video-urls.js` | YouTube Shorts URLs (all 11 populated) |
| `instantly-campaigns/extract-leads.py` | Reads xlsx → data/leads.json (python3 + openpyxl) |
| `instantly-campaigns/data/BBA_Email_Outbound_Segments.xlsx` | Master lead list (6 tier tabs) |
| `instantly-campaigns/data/leads.json` | Extracted leads, 4,276 total |

### Run commands

```bash
# All commands need this PATH prefix:
PATH="/Users/george/homebrew/Cellar/node/25.6.1/bin:$PATH"

node instantly-campaigns/run.js --test                        # verify API + list inboxes
node instantly-campaigns/run.js --dry-run                     # preview all 6 campaigns
node instantly-campaigns/run.js --tier T1                     # create T1 in Instantly (no launch)
node instantly-campaigns/run.js --tier T1 --launch            # create + launch
node instantly-campaigns/run.js --all                         # create all (no launch)

# Hot leads campaigns (no lead upload — leads moved in via subsequence or n8n webhook)
node instantly-campaigns/run.js --hot-leads                   # create all 6 HL campaigns (no launch)
node instantly-campaigns/run.js --hot-leads --tier T2         # create HL-T2 only
node instantly-campaigns/run.js --hot-leads --launch          # create all HL campaigns + launch

# Re-extract leads if xlsx changes:
/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/bin/python3 instantly-campaigns/extract-leads.py
```

### Tier status

| Tier | Campaign | Leads | Copy | Wave | Status |
|---|---|---|---|---|---|
| T1 | T1-Kent-HomeTurf | 159 | Written ✓ | 1 | Ready |
| T2 | T2-SweetSpot-DMs | 1,355 | Written ✓ | 1 | Ready |
| T3 | T3-Ops-Transport | 145 | NEEDS WRITING | 2 | Blocked |
| T4 | T4-Commercial-Growth | 475 | NEEDS WRITING | 2 | Blocked |
| T5 | T5-Larger-Fleets | 921 | NEEDS WRITING | 3 | Blocked |
| T6 | T6-Micro-Operators | 1,221 | Written ✓ | 4 | Ready |

### Launch calendar (Mon–Thu send window, 08:30–10:30 UK)

| Date | Action | Capacity |
|---|---|---|
| Sat–Sun Mar 7–8 | Setup: create T1, T2, T6 in Instantly | — |
| **Mon Mar 9** | **LAUNCH T1** (2 inboxes, 30/day) + **LAUNCH T2** (1 inbox, 30/day) | 90/day |
| **Wed Mar 11** | Add 8 more inboxes. Assign all 9 to T2: T2 limit 280/day. T1 keeps 2 inboxes at 30/day | 310/day |
| Thu Mar 12 | T1 completes (159 leads). Reassign T1's 2 inboxes to T2 (11 total on T2) | |
| ~Wed Mar 18 | T2 completes | |
| Wed–Thu Mar 18–19 | **LAUNCH T3+T4** (620 leads, ~2 days) | |
| Wed Mar 25 | T5 complete → **LAUNCH T6** | |
| Wed Apr 1 | T6 complete — all 4,276 Email 1s sent | |
| ~Apr 19 | Last follow-up email sent (T6 breakup Day 18) | |

Monday run commands:
```bash
# T1 — 2 inboxes
node instantly-campaigns/run.js --tier T1 --inboxes george@byebyeadmin.uk,george@byebyeadmin.co.uk --launch
# T2 — 1 inbox
node instantly-campaigns/run.js --tier T2 --inboxes george@automatedhaulage.co.uk --launch
```

### Inboxes (all 11, warmup score 98–100)

- george.s-w@byebyeadmin.co.uk, george.spainw@byebyeadmin.uk, george.spainw@fleetautomation.co.uk
- george.sw@byebyeadmin.uk, george.spain-warner@fleetautomation.co.uk, george.sw@fleetautomation.co.uk
- george@fleetautomation.co.uk, george.spain-warner@byebyeadmin.uk, george@automatedhaulage.co.uk
- george@byebyeadmin.co.uk, george@byebyeadmin.uk

**3 inboxes ready Mon Mar 9 (George to confirm which 3, 2 for T1 and 1 for T2). All 11 ready from Wed Mar 11.**

### API / technical notes

- `INSTANTLY_API_KEY` in `.env.local`
- Timezone in schedule: `Atlantic/Canary` (UTC+0/+1, same DST as UK — Instantly doesn't accept `Europe/London`)
- Sequences set via `PATCH /campaigns/{id}` (not a separate endpoint)
- Leads uploaded via `POST /leads/add` (batch, up to 1000/call)
- Delete campaigns via `DELETE /campaigns/{id}` (no Content-Type header)
- T3/T4/T5 copy is drafted in `sequences.js` but flagged `NEEDS_REVIEW` — confirm before running those tiers
