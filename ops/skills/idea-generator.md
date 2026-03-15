---
name: idea-generator
category: brand-content
depends-on: [brand-context/icp.md, brand-context/positioning.md]
outputs: [content-ideas, campaign-angles, product-ideas]
triggers: [ideas, brainstorm, content ideas, angles, what should I post]
overlaps: [script-writing (executes content ideas), caption-writing (executes content ideas)]
pre-flight: Check ops/learnings.md → idea-generator section before starting.
---

# Skill: Idea Generator

## Pre-Flight

Before generating: read `ops/brand-context/icp.md` (pain points, triggers, language) and `ops/brand-context/positioning.md` (what angles align with our market position). Check `ops/learnings.md` → idea-generator section for any logged corrections.

## Purpose

Generate content ideas, business ideas, product ideas, or campaign angles. Optimised for ByeByeAdmin's context: haulage, AI automation, B2B founder brand.

## How to use

Provide:
1. **Topic or domain** — e.g. "YouTube content", "cold email hooks", "new service idea"
2. **Constraint (optional)** — e.g. "based on something that happened this week", "targeting T5 large fleets"
3. **Volume** — how many ideas (default: 10)

Output: numbered list, one line each, no padding.

## Content idea sources to pull from

- Client pain points discovered in discovery calls
- Common questions fleet managers ask
- Industry news (DVSA updates, fuel costs, driver shortage, EV transition)
- Automation demos from recent n8n workflow builds
- Assessment data trends (which questions score lowest = biggest pain)
- Competitor gaps (what nobody in the space is talking about)

## Idea quality filter

A good idea passes at least 2 of these:
- Is it specific to haulage? (not generic "AI saves time" content)
- Does it have a concrete result or number attached?
- Would a Transport Manager stop scrolling for it?
- Does it show a process, not just a claim?
- Is it something George has actually done or seen?

## Output format

```
1. [Idea]
2. [Idea]
...

Strongest 3: [pick the ones most likely to perform]
Angle notes: [any specific hooks or angles worth noting]
```
