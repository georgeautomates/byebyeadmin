# Website & Builds — Project Context

## What this project covers

Development and maintenance of byebyeadmin.co.uk and any client-facing web builds.

## Main site: byebyeadmin.co.uk

Repo: `~/byebyeadmin/`
Stack: Next.js 16 (App Router), React 19, Three.js, GSAP, Lenis, Framer Motion
Deploy: Vercel (`vercel deploy --prod`)

```bash
# Deploy command (use exact PATH prefix due to Homebrew install):
PATH="/Users/george/homebrew/bin:/Users/george/homebrew/Cellar/node/25.6.1/bin:$PATH" NODE_TLS_REJECT_UNAUTHORIZED=0 vercel deploy --prod

# TypeScript check before deploy:
PATH="/Users/george/homebrew/bin:/Users/george/homebrew/Cellar/node/25.6.1/bin:$PATH" node_modules/.bin/tsc --noEmit
```

## Key pages

| Page | Path | Notes |
|------|------|-------|
| Home | `app/page.tsx` | 3D lorry hero, ScrollTrigger sections |
| About | `app/about/page.tsx` | 4-section layout |
| Assessment | `app/assessment/page.tsx` | Multi-screen state machine |
| Contact | `app/contact/page.tsx` | Calendly integration |

## Design system

- Accent orange: `#E8612D`
- Teal: `#2D8B8B`
- Background: `#F5F2EF`
- Dark: `#1F2937`
- Tokens: `C.xxx` in `lib/constants.ts`
- Fonts: Nunito Sans (`FONT`), JetBrains Mono (`MONO`)
- Inline styles only — no Tailwind, no CSS modules

## Conventions

- No em dashes in user-facing copy
- Page titles use `|` separator
- All colours from `C.xxx` tokens

## Skills to use here

- `skills/frontend-design.md` — UI component patterns, layout approaches
- `skills/assessment-builder.md` — Assessment flow and scoring logic

## API routes

- `POST /api/send-report` — sends assessment report email + adds to Instantly + logs to Sheets
- `GET /api/cron/sync-hot-openers` — Vercel daily cron (8am UTC), syncs 3+ open leads to Instantly list
- `GET /api/demos` — demo data endpoint
