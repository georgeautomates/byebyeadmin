---
name: wrap-up
category: meta
depends-on: [memory-agent]
outputs: [session-summary, learnings-update, git-commit]
triggers: [wrap up, end session, finish up, wrap, close session, done for today]
overlaps: [memory-agent (wrap-up triggers memory capture as part of its process)]
pre-flight: No pre-flight needed — this skill closes the session.
---

# Skill: Wrap-Up

## Purpose

Close a working session properly. Capture what was produced, collect feedback, update the learnings file, and commit everything. Every session that ends with wrap-up makes the system slightly better.

## When to run

- At the end of any working session
- Triggered by: "Wrap up", "End session", "Done for today"

## Process

### Step 1 — Review what was produced

List the deliverables from this session. Ask George to confirm, add, or correct:

```
This session produced:
- [Deliverable 1]
- [Deliverable 2]
- [...]

Anything to add or correct?
```

### Step 2 — Collect feedback

Ask one focused question:

> "Anything that didn't work well this session, or should be done differently next time?"

If George provides feedback:
- Identify which skill(s) the feedback applies to
- Proceed to Step 3

If no feedback: skip to Step 4.

### Step 3 — Log feedback to learnings.md

Append to the relevant section(s) in `ops/learnings.md`:

```markdown
- [YYYY-MM-DD] [What happened] → [What to do instead]
```

If the feedback implies a process change (not just a one-off note), also update the relevant `skill.md` to prevent the issue recurring.

### Step 4 — Update brand context if refined

If the session produced any refinements to voice, positioning, or ICP (e.g. a new phrase that works well, a differentiator that clicked), update the relevant `ops/brand-context/*.md` file.

### Step 5 — Memory capture

If any decisions, client context, or strategic insights emerged this session that should survive into future sessions, invoke the `memory-agent` skill to save them.

### Step 6 — Commit to git

Stage and commit all changes in `ops/`:

```bash
git add ops/
git commit -m "ops: session wrap-up [YYYY-MM-DD]"
```

List the files changed in the commit message body if there are more than 3.

### Step 7 — Confirm close

Output:

```
SESSION CLOSED — [date]
Produced: [N items]
Learnings logged: [yes/no — which skills]
Brand context updated: [yes/no — which files]
Memory updated: [yes/no]
Committed: [yes/no — commit hash]
```

## Notes

- Wrap-up should take 2–5 minutes, not 20. Keep questions tight.
- If George has no feedback, that's fine — still do the commit.
- Don't summarise the entire session in detail — just log what matters for future sessions.
