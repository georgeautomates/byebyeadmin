# Website & Builds — Project Context

## Main site: byebyeadmin.co.uk

The site lives at the **root of this repo** (not a subdirectory). See the root `CLAUDE.md` for the full site reference: stack, deployment, key files, design system, conventions, and component details.

## Quick reference

- Stack: Next.js (App Router), Three.js, GSAP ScrollTrigger, Lenis
- Deploy: `vercel deploy --prod` (see root CLAUDE.md for exact PATH prefix)
- Design tokens: `C.xxx` in `lib/constants.ts`
- No Tailwind, no CSS modules — inline styles only

## Skills to use here

- `skills/frontend-design.md` — UI component patterns, layout approaches
- `skills/assessment-builder.md` — Assessment flow and scoring logic

## API routes

- `POST /api/send-report` — sends assessment report email + adds to Instantly + logs to Sheets
- `GET /api/cron/sync-hot-openers` — Vercel daily cron (8am UTC), syncs 3+ open leads to Instantly list
