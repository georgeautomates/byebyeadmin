---
name: campaign-writer
category: sales
depends-on: [brand-context/voice.md, brand-context/icp.md, brand-context/positioning.md]
outputs: [instantly-sequence, spintax-emails, subject-lines]
triggers: [write campaign, campaign copy, email sequence, T3, T4, T5, tier copy, Instantly sequence]
overlaps: [email-writing (email-writing handles individual one-off emails; campaign-writer handles full 6-email Instantly sequences with spintax)]
pre-flight: Check ops/learnings.md → campaign-writer section before starting. Read instantly-campaigns/sequences.js for T1+T2 gold standard.
---

# Skill: Campaign Writer

## Pre-Flight

Before writing:
1. Read `ops/brand-context/voice.md` — tone rules, hard no's
2. Read `ops/brand-context/icp.md` — audience language and pain points
3. Read `ops/brand-context/positioning.md` — what we are and what we're not
4. Read `instantly-campaigns/sequences.js` — T1 and T2 sequences as the gold standard
5. Check `ops/learnings.md` → campaign-writer section

## Purpose

Write complete 6-email Instantly campaign sequences for a specific tier. Each sequence includes full spintax variation, subject lines, and follow-up logic. Output is ready to paste into `instantly-campaigns/sequences.js`.

## When to use

- Writing new tier copy (T3, T4, T5)
- Refreshing an underperforming tier with new angles
- Triggered by: "Write T3 campaign", "Create email sequence for [tier profile]"

## Inputs required

1. **Tier profile** — seniority level, company type, fleet size range, primary pain point
2. **Sequence reference** — T1 or T2 from sequences.js as gold standard format
3. **Any intelligence** — reply rate data, subject lines that worked, angles to avoid

## Tier profiles (existing)

| Tier | Who | Primary pain | Tone |
|------|-----|-------------|------|
| T1 (Kent HomeTurf) | Local operators, personal connection | All admin | Very personal, local references |
| T2 (Sweet Spot DMs) | 10–40 vehicles, MDs/Directors | Invoice + compliance admin | Peer-to-peer, results-focused |
| T3 (Ops/Transport) | Transport Managers, Ops Managers | Day-to-day ops paperwork | More operational, shift their perspective |
| T4 (Commercial Growth) | Commercial Directors, growth-focused MDs | Revenue-blocking admin | ROI-framing, efficiency as growth enabler |
| T5 (Larger Fleets) | 40–100 vehicles, Head of Ops | Scale + compliance pressure | Speak to the scale problem, not individual tasks |
| T6 (Micro Operators) | Under 10 vehicles, owner-operators | Everything — no admin team | Simple, affordable, owner-to-owner |

## Sequence structure

6 emails per campaign. Pattern:
1. **Email 1** — Primary hook. Most specific. Best subject line.
2. **Email 2** — Different angle. New hook. References a different pain point or outcome.
3. **Email 3** — Short bump. One sentence. References Email 1.
4. **Email 4** — Social proof or specific result. One concrete example.
5. **Email 5** — New angle. Address common objection pre-emptively.
6. **Email 6** — Break-up email. Honest close. Leaves door open.

## Spintax rules

Every sentence that could vary should have 2–3 alternatives. Format: `{option1|option2|option3}`

Vary:
- Opening lines: `{Hi|Hey|Morning} {{firstName}},`
- Company references: `{at {{companyName}}|for your fleet|running {{companyName}}}`
- Pain point hooks: alternate between invoice/compliance/driver admin
- CTAs: vary the ask slightly across versions

Do NOT vary: core value proposition, company name (ByeByeAdmin), contact name (George)

## Output format

```javascript
// T[N] — [Tier Name]
{
  name: 'T[N]-[Tier-Name]',
  subject: '{Subject option 1|Subject option 2|Subject option 3}',
  body: `Hi {{firstName}},

[Email body with spintax]

George`,
  delay: 0  // Days from previous email (0 = same day as trigger)
},
```

Produce all 6 emails in this format, ready to paste into the `sequences` array in `sequences.js`.

## Subject line formulas

Reference the tier's primary pain and audience:

- Question format: "How are you handling [specific task] at {{companyName}}?"
- Observation: "[Region/tier descriptor] fleet operators and [pain point]"
- Result-first: "[Specific outcome] for a [fleet size] operator"
- Direct: "Quick question about [specific admin task]"

Write 3 subject line variations per email (spintax them together).

## Quality checks

Before submitting:
- [ ] Each email reads like it was written in 2 minutes by a real person
- [ ] No email is longer than 5 sentences
- [ ] Single CTA per email
- [ ] No em dashes anywhere
- [ ] No buzzwords (leverage, innovative, game-changing)
- [ ] Email 3 and Email 6 are noticeably shorter than the others
- [ ] Spintax validated: every `{||}` has matching opening/closing braces
- [ ] Subject lines tested: read them out loud — do they sound human?

## After writing

Add the sequences to `instantly-campaigns/sequences.js` in the `SEQUENCES` object. Then run:
```bash
node instantly-campaigns/run.js --dry-run --tier T[N]
```
to preview before launch.
