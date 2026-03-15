# Skill: Memory Agent

## Purpose

Capture context from the current conversation and save it to persistent memory files so future sessions start with full context.

## When to invoke

- At the end of a significant working session
- When a key decision has been made
- When new context about a client, project, or business direction emerges
- When the user says "remember this" or "save this"

## Memory files

Primary memory index: `bba-ops/memory/MEMORY.md`
Project-specific memory: `bba-ops/projects/[project]/CLAUDE.md` (update the relevant section)
Global Claude memory: `~/.claude/projects/-Users-george-bba-ops/memory/` (for Claude's auto-memory system)

## What to save

Save:
- Key decisions and the reasoning behind them
- Client details (company, fleet size, pain points, stage)
- Campaign performance benchmarks
- Insights that took time to figure out
- Anything prefaced with "from now on..." or "going forward..."

Don't save:
- Step-by-step instructions (those go in skill files)
- Code patterns (they go in the relevant CLAUDE.md or skill file)
- Temporary task state (use todos for that)
- Git history or recent changes

## Process

1. Review the conversation for context worth retaining
2. Check existing memory files to avoid duplicates — update rather than append
3. Write concise entries: date + context + implication
4. Update MEMORY.md index if adding a new section

## Format for memory entries

```markdown
## [Topic] — [Date]

[1–3 sentences of context]
[Implication or what to do with this going forward]
```
