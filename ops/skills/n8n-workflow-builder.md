# Skill: n8n Workflow Builder

## Purpose

Design and build n8n automation workflows for ByeByeAdmin clients or internal ops. Always search existing workflows before building new ones.

## Before building anything

1. Use n8n MCP `search_workflows` to check if a similar workflow exists
2. Check `bba-ops/agents/morning-briefing.md` for data source patterns
3. Review `~/.claude/skills/n8n-workflow-patterns.md` for architectural patterns

## Common haulage automation patterns

### Invoice matching
`Email trigger → parse attachment (OCR/Firecrawl) → match to job sheet in Airtable/Sheets → flag discrepancy → notify via Slack/WhatsApp`

### Driver daily vehicle check
`WhatsApp webhook → structured form responses → aggregate to dashboard → flag failures → notify manager`

### Compliance reminders
`Cron trigger → query licence/MOT expiry dates in Sheets → calculate days remaining → send reminder at 30/14/7/1 day thresholds`

### Job sheet creation from email
`Email trigger → extract customer, load, destination → create job in TMS (HTTP request) → confirm reply`

### Hot lead detection
`Instantly webhook → check open_count ≥ 3 → add to Hot Openers list → trigger WhatsApp notification to George via OpenClaw`

## n8n instance

URL: `https://n8n.srv1155250.hstgr.cloud`
MCP connected via global Claude settings.

## Build process

1. Sketch the trigger → action chain in plain English first
2. Identify which n8n nodes are needed
3. Check for HTTP API credentials needed (store in n8n credentials, not in workflow JSON)
4. Build in n8n UI or describe the workflow for the user to build
5. Test with sample data before activating

## Output format when describing a workflow

```
WORKFLOW: [Name]
TRIGGER: [What starts it]
NODES:
  1. [Node type] — [what it does]
  2. [Node type] — [what it does]
  ...
OUTPUT: [What it produces/sends]
CREDENTIALS NEEDED: [list]
```
