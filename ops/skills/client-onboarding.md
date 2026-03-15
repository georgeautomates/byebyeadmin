---
name: client-onboarding
category: client-delivery
depends-on: [brand-context/icp.md, brand-context/positioning.md]
outputs: [discovery-call-agenda, audit-checklist, proposal-structure, onboarding-timeline]
triggers: [client onboard, new client, they said yes, client converting, discovery call, first client]
overlaps: [n8n-workflow-builder (onboarding feeds into the workflow build), reflection-agent (use for post-call review)]
pre-flight: Check ops/learnings.md → client-onboarding section before starting.
---

# Skill: Client Onboarding

## Pre-Flight

Before generating: read `ops/brand-context/icp.md` (client profile) and `ops/brand-context/positioning.md` (what we deliver). Check `ops/learnings.md` → client-onboarding section.

## Purpose

Generate a complete onboarding pack when a prospect converts to a client. Makes George look systematic and prepared from day one — not figuring it out as he goes.

## When to use

- When a prospect says yes (from assessment, outreach, or referral)
- Before a discovery call with a qualified lead
- Triggered by: "Onboard [Company name]", "Discovery call with [Company] — fleet size [X], pain: [Y]"

## Inputs required

1. **Company name and contact name**
2. **Fleet size** (vehicle count)
3. **Assessment score** (if came via assessment funnel) or known pain points
4. **How they came in** (cold email reply, assessment, referral, other)

## Output 1: Discovery Call Agenda

A focused 45-minute call structure. The goal is to understand their operations deeply enough to scope the first automation build.

```
DISCOVERY CALL — [Company Name]
Date: [TBC]
Duration: 45 minutes

AGENDA

0:00 — Intro (5 min)
  - Quick context: what BBA does, what this call is for
  - Let them talk first: "Tell me about your operation"

0:05 — Their operation (15 min)
  Questions tailored to their profile:
  [Generated based on fleet size + pain points — see below]

0:20 — Current admin picture (10 min)
  - "Walk me through a typical Monday morning admin-wise"
  - "What takes the most time per week that you wish didn't?"
  - "Where do things fall through the cracks?"

0:30 — Tech stack (5 min)
  - TMS / job management system (if any)
  - How they communicate with drivers (WhatsApp, email, phone?)
  - Where data lives (spreadsheets, paper, system?)

0:35 — Scope and next steps (10 min)
  - "Based on what you've told me, the first thing I'd automate is [X]"
  - "Here's what that would look like in practice"
  - Agree: audit → proposal → build timeline

QUESTIONS SPECIFIC TO THEIR PROFILE:
[Generated per fleet size and pain point — see generation rules below]
```

### Question generation rules

**Fleet size 3–10 (micro):**
- "How many hours a week do you spend on admin personally?"
- "Do you have anyone helping with the paperwork or is it all on you?"
- "What's the one thing you'd fix if you had a magic wand?"

**Fleet size 10–40 (sweet spot):**
- "How do your drivers submit their daily checks — WhatsApp, paper, an app?"
- "How do you currently handle invoice matching between job sheets and supplier invoices?"
- "When something falls through the cracks, what is it usually?"

**Fleet size 40–100 (larger):**
- "How many people are in your ops/admin team?"
- "Is compliance — tachograph, driver CPC, O-licence renewals — handled manually or through a system?"
- "What does your reporting structure look like? Who needs what data and when?"

**FORS accredited:**
- "How are you currently evidencing your FORS compliance requirements?"
- "Which FORS Bronze/Silver requirements take the most time to maintain?"

## Output 2: Audit Checklist

What to look at before scoping a build. Send this as a pre-call questionnaire or complete it on the call.

```
PRE-AUDIT CHECKLIST — [Company Name]

OPERATIONS
[ ] Vehicle count and type (HGV, LGV, van, mixed)
[ ] Number of drivers (full-time vs. subcontractors)
[ ] Geographic base and main routes
[ ] TMS/job management system (name + version)
[ ] Driver communication method (WhatsApp group / phone / app)

ADMIN PROCESSES (score each 1–5: 1=manual/chaotic, 5=automated/smooth)
[ ] Driver daily vehicle checks: _/5
[ ] Job sheet creation: _/5
[ ] Invoice matching: _/5
[ ] Compliance tracking (CPC, tachograph, licence renewal): _/5
[ ] Subcontractor comms and paperwork: _/5
[ ] Customer reporting / POD confirmation: _/5

PAIN POINT RANKING (ask them to rank top 3)
[ ] Chasing invoices
[ ] Driver admin and checks
[ ] Compliance paperwork
[ ] Job sheet management
[ ] Reporting (customers or management)
[ ] Communication (drivers, subcontractors, customers)

TECH READINESS
[ ] Is there an existing email address we can connect to for automation?
[ ] Do drivers have smartphones?
[ ] Is there a shared location (Google Drive / Dropbox / SharePoint) for documents?
[ ] Any existing automation or systems we should know about?
```

## Output 3: Proposal Structure

Skeleton proposal to fill in after the audit.

```
PROPOSAL — AI Admin Automation for [Company Name]

PREPARED FOR: [Contact Name], [Company Name]
DATE: [Date]
PREPARED BY: George Spain-Warner, ByeByeAdmin

---

THE PROBLEM
[1–2 sentences describing their specific situation based on audit findings]

WHAT WE'LL BUILD
[Primary automation — most impactful based on audit score]
  Description: [Plain English description of the workflow]
  How it works: [Simple 3-step explanation]
  Time saved: [Estimate based on fleet size and current process]

[Secondary automation — if in scope]
  Description:
  How it works:
  Time saved:

WHAT YOU GET
- [Automation 1] running and tested
- [2 weeks] of monitoring and tweaks
- Documentation of what was built
- Handover call with your team

WHAT WE NEED FROM YOU
- Access to [specific system/email/data source]
- 1 hour for setup and testing
- [Any other dependency]

TIMELINE
Week 1: Audit + workflow design
Week 2: Build + internal testing
Week 3: Client testing + iteration
Week 4: Handover + documentation

INVESTMENT
[Price — TBD based on scope. Reference productised tier if applicable]

NEXT STEP
[Book next call / sign off / start date]
```

## Output 4: Onboarding Timeline

4-week standard implementation plan.

```
[Company Name] — Onboarding Timeline

WEEK 1: Audit + Design
  Mon: Send pre-audit checklist
  Wed: Audit call (30 min) — fill in checklist together
  Fri: Deliver workflow design doc (plain English, no technical jargon)

WEEK 2: Build
  Mon–Wed: Build automation in n8n
  Thu: Internal test with sample data
  Fri: Client preview (15 min screen share)

WEEK 3: Client Testing
  Mon–Wed: Client runs the automation in parallel with existing process
  Thu: Feedback call — what needs tweaking?
  Fri: Final tweaks deployed

WEEK 4: Handover
  Mon: Handover call — walk through what was built, how to monitor it
  Tue: Documentation delivered
  Wed: Old process officially retired
  Ongoing: Monthly check-in (15 min) for first 3 months
```

## Notes

- Tailor all outputs to the specific company — no boilerplate language in the final versions
- If assessment score was low (below 40%), emphasise quick wins over complex builds
- If fleet size is 40+, assume there's an ops person to hand over to, not just the MD
- Log the client details to `ops/memory/MEMORY.md` via the memory-agent after the discovery call
