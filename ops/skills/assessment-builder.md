# Skill: Assessment Builder

## Purpose

Design, build, or modify assessment flows. Primarily for the ByeByeAdmin automation readiness assessment, but applicable to any quiz/scoring flow.

## Reference implementation

Live at: `byebyeadmin.co.uk/assessment`
Code: `~/byebyeadmin/app/assessment/page.tsx`
Logic: `~/byebyeadmin/lib/assessmentLogic.ts`

State machine: `'welcome' | 'quiz' | 'contact' | 'results'`

## Assessment structure

1. **Welcome screen** — context setting, what they'll get
2. **Quiz** — multiple choice questions, each scored
3. **Contact screen** — name, email, company, fleet size (gates the results)
4. **Results screen** — score, maturity stage, recommendations, CTA to book call

## Scoring logic (reference assessmentLogic.ts)

Each question has weighted options. Total score maps to a maturity stage. Maturity stage determines which result cards and recommendations appear.

## When building a new assessment

Define:
1. **Purpose** — what decision does the score help the user make?
2. **Questions** — 6–10 max. Each must be answerable without research.
3. **Scoring** — weighted 1–5 per answer. No trick questions.
4. **Stages** — 3–4 output buckets with distinct recommendations
5. **Gate** — what contact info to collect and why

## Result page requirements (byebyeadmin style)

- Full-width dark header banner (`C.bgDark`) outside content column
- Content column: 680px max-width
- Snaking road SVG background (orange `#E8612D`, opacity 0.13, `preserveAspectRatio="none"`)
- Cards at `zIndex: 1`, SVG at `zIndex: 0`
- CTA to book a Calendly call

## Lead automation on submission

`POST /api/send-report` does three things in parallel:
1. Gmail API → sends assessment report to user
2. Instantly API → adds to "Assessment Completions" list
3. Google Sheets → logs lead with score and metadata
