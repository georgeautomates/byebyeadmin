# ByeByeAdmin — Project Context for Claude

## What this repo is

Two things in one repo:
- **Root** — Next.js marketing site for byebyeadmin.co.uk
- **`ops/`** — BBA ops infrastructure (skills, agents, project contexts, memory). See `ops/CLAUDE.md`.

---

## Site: byebyeadmin.co.uk

B2B marketing site for a UK haulage AI automation service. Target audience: UK fleet operators running 3–100 vehicles. Built with Next.js (App Router), Three.js for the 3D hero, GSAP ScrollTrigger for scroll-driven animations, and Lenis for smooth scrolling.

## Deployment

```bash
PATH="/Users/george/homebrew/bin:/Users/george/homebrew/Cellar/node/25.6.1/bin:$PATH" NODE_TLS_REJECT_UNAUTHORIZED=0 vercel deploy --prod
```

TypeScript check before deploying:
```bash
PATH="/Users/george/homebrew/bin:/Users/george/homebrew/Cellar/node/25.6.1/bin:$PATH" node_modules/.bin/tsc --noEmit
```

Node/Vercel are installed via Homebrew at `/Users/george/homebrew/`. `NODE_TLS_REJECT_UNAUTHORIZED=0` required due to a sandboxed shell SSL issue.

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

When a user submits the contact screen, `/api/send-report` does three things in parallel:

1. **Sends report email** via Gmail API to the user
2. **Adds lead to Instantly CRM** (`lib/instantly.ts`) — list: "Assessment Completions" (`INSTANTLY_ASSESSMENT_LIST_ID`)
3. **Logs to Google Sheet** (`lib/sheets.ts`) — `GOOGLE_SHEET_ID` env var

Data sent to Instantly: `readiness_score`, `vehicle_count`, `annual_savings`, `maturity_stage`.

**Required env vars** (set in `.env.local` and Vercel):
```
INSTANTLY_API_KEY
INSTANTLY_ASSESSMENT_LIST_ID=7eac5b71-46a6-491f-b3af-6801d35abeb9
GOOGLE_SHEET_ID
```

## 3D hero (ThreeHero.tsx) key state

```js
const cam = {
  x: -2.0, y: 3.5, z: -11.0,   // intro: shows cab front
  lx: -0.6, ly: 1.2, lz: -3.5, // look-at aimed at grille
  fov: isMobile ? 62 : 52,
};
```

Intro camera rise (fires after model loads):
```js
gsap.to(cam, { y: 5.5, ly: 2.0, duration: 1.5, ease: 'power2.inOut', delay: 0.6 });
```

Per-frame lorry collision clamp in the animate loop prevents camera going inside the lorry. `lorryBbox` captured from `loadLorry()` return value.

## LenisProvider

Scroll-to-top on route change via `usePathname` + `lenis.scrollTo(0, { immediate: true })`. Prevents the 500vh scroll offset carrying over between pages.

---

## Outbound Campaign (Instantly)

Cold email outreach to 4,276 UK haulage contacts. Scripts in `instantly-campaigns/`. Campaign context and tier status in `ops/projects/sales-outreach/CLAUDE.md`.

### Key files

| File | Purpose |
|---|---|
| `instantly-campaigns/run.js` | Main script: create / upload leads / launch |
| `instantly-campaigns/sequences.js` | All 6 tier email sequences (full copy + spintax) |
| `instantly-campaigns/api.js` | Instantly API v2 wrapper |
| `instantly-campaigns/video-urls.js` | YouTube Shorts URLs |
| `instantly-campaigns/extract-leads.py` | Reads xlsx → data/leads.json |

### Run commands

```bash
PATH="/Users/george/homebrew/Cellar/node/25.6.1/bin:$PATH"

node instantly-campaigns/run.js --test          # verify API + list inboxes
node instantly-campaigns/run.js --dry-run       # preview campaigns
node instantly-campaigns/run.js --tier T1 --launch
node instantly-campaigns/run.js --all
```

### API notes

- Timezone in schedule: `Atlantic/Canary` (Instantly doesn't accept `Europe/London`)
- Sequences set via `PATCH /campaigns/{id}`
- Leads uploaded via `POST /leads/add` (batch, up to 1000/call)
- T3/T4/T5 copy flagged `NEEDS_REVIEW` — confirm before running those tiers
