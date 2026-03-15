---
name: skill-builder
category: meta
depends-on: []
outputs: [new-skill-file, improved-skill-file]
triggers: [new skill, build a skill, improve skill, audit skills, monthly review]
overlaps: [claude-md-optimiser (both maintain the ops system)]
pre-flight: Check ops/learnings.md → skill-builder section before starting.
---

# Skill: Skill Builder & Improver

## Purpose

Create new skill files for this repo, or audit and improve existing ones. Ensures skills are sharp, practical, and actually used.

## When to use

- A task comes up that doesn't have a matching skill yet
- An existing skill produced a bad output — time to refine it
- A new tool or API has been wired in and needs a skill to support it
- Monthly skill audit

## Creating a new skill

1. **Name it** — verb + noun: `email-writing`, `script-writing`, `prospector-researcher`
2. **Define the purpose** — one sentence: what does this skill do and when should it be invoked?
3. **Define the process** — step-by-step instructions Claude should follow
4. **Define the output** — exact format with a template
5. **Add quality criteria** — how to know if the output is good
6. **Save to** `bba-ops/skills/[name].md`

## Skill file template

```markdown
# Skill: [Name]

## Purpose
[One sentence. What it does and when to use it.]

## When to use
[2–4 bullet points of specific trigger conditions]

## Process
[Numbered steps]

## Output format
[Template with placeholders]

## Quality criteria
[How to evaluate the output]

## Notes
[Edge cases, API limits, tool dependencies]
```

## Improving an existing skill

1. Look at the last 3 outputs from the skill
2. Identify what was missing, wrong, or needed manual correction
3. Update the process or output format to prevent that failure
4. If the skill is being ignored (never invoked), either sharpen the "when to use" trigger or merge it into another skill

## Monthly audit checklist

- [ ] Are all 14 skills still relevant?
- [ ] Has any skill not been used this month? Why?
- [ ] Do any skills need updating for new tools or context?
- [ ] Is there a recurring task without a skill? Create one.
