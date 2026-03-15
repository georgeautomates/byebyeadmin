---
name: heartbeat
category: meta
depends-on: []
outputs: [registry-sync-report, updated-claude-md]
triggers: [heartbeat, start session, run heartbeat, sync registry, what skills do I have]
overlaps: [claude-md-optimiser (heartbeat auto-syncs, optimiser does deeper audit), skill-builder (skill-builder creates, heartbeat registers)]
pre-flight: No pre-flight needed — this skill IS the pre-flight check.
---

# Skill: Heartbeat

## Purpose

Run at the start of a session (or on demand) to keep the ops system in sync. Scans the physical directory, compares against the registry in `ops/CLAUDE.md`, and auto-updates if anything has changed. Also checks for skill trigger overlaps.

## When to run

- At the start of any session that touches `ops/`
- After adding or removing a skill, agent, or project
- Triggered by: "Run heartbeat", "What skills do I have?", "Sync registry"

## Process

### Step 1 — Scan directories

Read the actual files in:
- `ops/skills/*.md` — list all skill files
- `ops/agents/*.md` and `ops/agents/*.js` — list all agent files
- `ops/projects/*/` — list all project directories
- `ops/brand-context/*.md` — list all brand context files

### Step 2 — Compare against registry

Read the **Skills directory** and **Agents directory** sections in `ops/CLAUDE.md`.

For each directory scanned, check:
- Are all physical files listed in the registry?
- Are any registry entries missing a corresponding file?
- Are there new files that aren't registered?

### Step 3 — Update if needed

If discrepancies found:
- Add new skill/agent entries to the relevant registry section in `ops/CLAUDE.md`
- Remove entries for files that no longer exist
- Add a section in `ops/learnings.md` for any newly registered skill (under `## By Skill`)
- Report what changed

If no discrepancies: confirm "Registry is in sync — [N] skills, [N] agents."

### Step 4 — Check for trigger overlaps

Read the `triggers:` field from the front matter of every skill file.

Flag any case where two or more skills share the same trigger keyword. Output:

```
OVERLAP DETECTED:
  Trigger: [keyword]
  Skills: [skill-a], [skill-b]
  Recommendation: [clarify which to use when]
```

### Step 5 — Report

Output a concise summary:

```
HEARTBEAT — [date]
Skills: [N] registered, [N] on disk
Agents: [N] registered, [N] on disk
Brand context: [files present]
Changes made: [list or "none"]
Overlaps: [list or "none"]
```

## Notes

- Do not modify any skill file content during heartbeat — only update `ops/CLAUDE.md` registry and `ops/learnings.md` index
- If a skill file has no front matter, flag it for the skill-builder to fix
