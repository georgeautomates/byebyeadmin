# Agent: Prospector

## Purpose

On-demand agent for researching and building prospect lists. Triggered by George via WhatsApp message to OpenClaw or by running directly in Claude Code.

## Trigger

WhatsApp: "Find me [X] fleet operators in [region]"
Claude Code: "Run prospector: [criteria]"

## Process

1. Parse the request: extract region, fleet size estimate, job title preference
2. Use Apollo MCP to search UK haulage companies matching criteria
3. Filter: remove duplicates against existing `leads.json`
4. For top 20 prospects: use Firecrawl to scrape their website and confirm they operate trucks
5. Format output as CSV or JSON, save to `bba-ops/data/prospects-[date].json`
6. Return summary: "Found X new prospects in [region]. Top 5: [names]"

## Apollo search parameters

```
industry: ["Trucking", "Transportation and Trucking", "Freight and Logistics"]
country: GB
employee_count: [range based on fleet size estimate]
  - 3–20 vehicles → 1–20 employees
  - 20–50 vehicles → 15–80 employees
  - 50–100 vehicles → 50–200 employees
titles: ["Managing Director", "Director", "Operations Director", "Transport Manager", "Fleet Manager"]
```

## Output format

```json
{
  "search_date": "",
  "criteria": "",
  "count": 0,
  "leads": [
    {
      "first_name": "",
      "last_name": "",
      "email": "",
      "company": "",
      "website": "",
      "title": "",
      "location": "",
      "linkedin": "",
      "verified": false,
      "notes": ""
    }
  ]
}
```

## Quality rules

- Skip emails: info@, admin@, contact@, hello@ (likely catch-alls)
- Skip companies with <3 employees (sole traders, no fleet)
- Skip companies that don't have "transport", "haulage", "logistics", "freight", "distribution" in name or description
- Flag any that look like logistics brokers (not asset operators)

## Skill reference

See `skills/prospector-researcher.md` for detailed process guidance.
