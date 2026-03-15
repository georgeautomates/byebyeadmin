# Agent: Memory Agent

## Purpose

Captures important context from conversations and saves it to the right memory files. Ensures future sessions start with full context without George having to re-explain things.

## Trigger

WhatsApp: "Remember: [context]" or "Save this: [context]"
Claude Code: End of session, or when user says "save this to memory"
Automatic: After a client call transcript is processed

## Process

1. Receive the context to remember
2. Classify it: client info / decision / project state / business context / preference
3. Check existing memory files for duplicates — update rather than add duplicate
4. Write to the correct file with date stamp
5. Confirm back: "Saved to memory: [brief description of what was saved]"

## Memory file map

| Type | File |
|------|------|
| General ops context | `bba-ops/memory/MEMORY.md` |
| Client context | `bba-ops/projects/client-delivery/CLAUDE.md` (Client section) |
| Sales context | `bba-ops/projects/sales-outreach/CLAUDE.md` |
| Content ideas bank | `bba-ops/projects/brand-content/CLAUDE.md` |
| Strategy decisions | `bba-ops/projects/strategy/CLAUDE.md` |
| Claude auto-memory | `~/.claude/projects/-Users-george-bba-ops/memory/` |

## What to save

**Yes:**
- "George's preferred cold email structure is X"
- "Client [Company] has 40 trucks, main pain is invoice admin, in Kent"
- "Decision: pricing set at £X/month for retainer tier"
- "T2 campaign reply rate is running at X% — benchmark for future tiers"

**No:**
- Step-by-step instructions (skills/CLAUDE.md files)
- Git history or recent commits
- Current task state (use todos)
- Temporary information (campaign launches, one-off tasks)

## Memory entry format

```markdown
## [Topic] — [YYYY-MM-DD]

[Context in 1–3 sentences]
[What this means going forward, if relevant]
```

## Skill reference

See `skills/memory-agent.md` for full guidance.
