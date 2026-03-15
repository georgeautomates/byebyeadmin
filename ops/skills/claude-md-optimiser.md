# Skill: CLAUDE.md Optimiser

## Purpose

Audit and improve CLAUDE.md files across all projects to ensure Claude Code gets the best possible context. A well-written CLAUDE.md means fewer corrections and better first drafts.

## When to use

- Monthly review of all CLAUDE.md files
- After a project significantly changes direction
- When Claude keeps making the same mistake (the fix belongs in CLAUDE.md)
- When onboarding a new project area

## What makes a good CLAUDE.md

1. **Purpose is clear in the first paragraph** — what is this project and who is it for?
2. **Conventions are explicit** — not assumed. "No em dashes" not "write professionally"
3. **File paths are accurate** — reference real files that exist
4. **Commands work** — any bash commands are tested and include the right PATH prefixes
5. **It's short enough to scan in 2 minutes** — trim anything that isn't consulted regularly
6. **It tells Claude what NOT to do** — prohibitions are as valuable as instructions

## Audit process

For each CLAUDE.md file:

```
FILE: [path]
ISSUES FOUND:
  - [ ] Purpose unclear or missing
  - [ ] Stale file references (files that no longer exist)
  - [ ] Commands that don't work
  - [ ] Missing conventions (things Claude keeps getting wrong)
  - [ ] Too long / sections never referenced
  - [ ] Missing prohibitions
RECOMMENDED CHANGES:
  - [Specific edit]
```

## Common fixes

- **Too verbose:** Trim sections that are descriptive but not instructional
- **Missing file paths:** Add exact paths to key files Claude should read
- **Vague conventions:** Replace "write clearly" with specific rules
- **Outdated state:** Update project status, active campaigns, and current focus
- **Missing tool context:** Add env var names, API endpoints, MCP tool names

## Scope

Files to audit:
- `~/bba-ops/CLAUDE.md`
- `~/bba-ops/projects/*/CLAUDE.md` (5 files)
- `~/byebyeadmin/CLAUDE.md`
- Any new project CLAUDE.md files added since last audit
