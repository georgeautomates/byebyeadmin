---
name: summarising-agent
category: ops
depends-on: []
outputs: [exec-brief, data-summary, meeting-notes]
triggers: [summarise, summary, brief, distil, TL;DR, key points, notes]
overlaps: [reflection-agent (both process information, different purposes), transcription (both process source material)]
pre-flight: Check ops/learnings.md → summarising-agent section before starting.
---

# Skill: Summarising Agent

## Purpose

Distil long documents, transcripts, data exports, or research into concise, actionable summaries. Output should be scannable in under 2 minutes.

## How to use

Provide the source material and specify:
1. **Audience** — who is reading this? (George, a client, a prospect?)
2. **Purpose** — what decision or action does this summary support?
3. **Format** — bullet points, prose, structured brief, or one-liner

## Output formats

### Exec brief (default)
```
TOPIC: [What this covers]
KEY POINTS:
- [Point]
- [Point]
- [Point]
SO WHAT: [The implication or recommended action]
```

### Data summary (for analytics, campaign stats)
```
PERIOD: [Date range]
METRICS:
- [Metric]: [Value] ([vs previous period])
HIGHLIGHTS: [What's working]
CONCERNS: [What needs attention]
ACTION: [What to do next]
```

### Meeting / call notes
```
DATE: [Date]
ATTENDEES: [Names]
DECISIONS: [What was agreed]
ACTIONS: [Who does what by when]
CONTEXT: [Anything to remember for next time]
```

## Principles

- Lead with the most important point, not the background
- No padding or throat-clearing
- Specific numbers beat vague descriptions
- If something is ambiguous, flag it rather than guess
- Keep the summary shorter than you think it needs to be
