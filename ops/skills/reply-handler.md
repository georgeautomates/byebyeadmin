---
name: reply-handler
category: sales
depends-on: [brand-context/voice.md, brand-context/icp.md]
outputs: [reply-classification, draft-reply, slack-card]
triggers: [reply, cold email reply, someone replied, response, triage reply]
overlaps: [email-writing (both produce outbound email copy — reply-handler is reactive, email-writing is proactive)]
pre-flight: Check ops/learnings.md → reply-handler section before starting.
---

# Skill: Reply Handler

## Pre-Flight

Before handling: read `ops/brand-context/voice.md` (tone, hard no's) and `ops/brand-context/icp.md` (audience context). Check `ops/learnings.md` → reply-handler section.

## Purpose

Triage incoming replies to cold email campaigns. Classify intent, enrich with lead context, and draft a personalised response in George's voice. Output is a Slack card for George to approve or edit before sending.

## When to use

- When a cold email reply arrives in Instantly
- Triggered by OpenClaw reply-monitor.js on VPS
- Or manually: "Handle this reply: [paste reply text]"

## Inputs required

1. **Reply text** — the actual email reply from the prospect
2. **Lead data** — from Instantly: name, company, email, open count, which email they replied to (email number in sequence)
3. **Enrichment** (optional, from Apollo) — fleet size estimate, job title, location

## Step 1 — Classify Intent

Assign one of four categories:

| Category | Signals |
|----------|---------|
| **INTERESTED** | Asks for a call, asks a question about the service, says "tell me more", asks for pricing, references a specific pain point |
| **OBJECTION** | "Not right now", "too busy", "already have something", "not my decision", budget concern |
| **NOT NOW** | "Try again in X months", "come back after [event]", "on holiday until [date]" |
| **BOUNCE / AUTO** | Out of office, delivery failure, "this is an automated reply", LinkedIn-style auto-response |

Output the classification clearly before drafting.

## Step 2 — Draft Reply

### INTERESTED replies

Structure:
```
Hi [First name],

[1 sentence acknowledging what they said / asked — be specific, not generic]

[1–2 sentences answering their question or moving toward a call]

[Soft CTA: suggest a specific time slot or link to Calendly]

George
```

Rules:
- Reference something specific from their reply — don't write a generic "great to hear from you"
- If they mentioned their fleet size or a specific problem, echo it back: "Given you're running 40 vehicles, the driver daily check automation would save you the most time immediately"
- Keep it short. They replied — don't overwhelm them with text.
- One ask only: book a call.

### OBJECTION replies

Don't push. Acknowledge, reframe, leave the door open.

```
Hi [First name],

[1 sentence acknowledging the objection without arguing with it]

[1 sentence brief reframe — optional. Only if there's something genuinely useful to say. If not, skip.]

[Exit gracefully. Leave the door open.]

George
```

Examples:
- "Too busy right now" → "Completely understand — the whole point of this is to give time back, but timing matters. I'll drop you a line in a month."
- "Already sorting it internally" → "Good to hear. If it gets complicated or takes longer than expected, we specialise in exactly this — happy to compare notes when the dust settles."

### NOT NOW replies

Short. Acknowledge the timeline. Set a reminder mentally.

```
Hi [First name],

No problem at all. I'll reach back out [in X time / after the thing they mentioned].

George
```

### BOUNCE / AUTO replies

No reply needed. Output: "Auto-reply or bounce — no response required."

## Step 3 — Output Format

```
CLASSIFICATION: [INTERESTED / OBJECTION / NOT NOW / BOUNCE]

LEAD CONTEXT:
- Name: [First Last]
- Company: [Company]
- Fleet size: [estimate if known]
- Opened: [X times]
- Replied to: Email [N] in sequence

DRAFT REPLY:
---
[Draft reply text]
---

NOTES: [Anything George should know before sending — e.g. "They mentioned a DVSA audit — reference compliance automation in call"]
```

## Quality checks

- Does the draft reference something specific to this person/company?
- Is it under 100 words?
- No em dashes?
- No buzzwords?
- Single ask?
- Sounds like George, not a template?
