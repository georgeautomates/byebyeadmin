# Skill: Prospector / Researcher

## Purpose

Research and build prospect lists of UK haulage fleet operators. Enrich contacts with decision-maker details, validate emails, and output structured data ready for Instantly campaigns.

## When to use

- Building prospect lists for new campaign tiers
- Enriching a company name/domain with contact details
- Researching a specific prospect before outreach
- Finding market data on UK haulage (fleet sizes, regions, operators)

## Process

### 1. Define the target
Establish: region, fleet size (vehicle count), company type (owner-operator vs. Ltd vs. PLC), and target job title (MD, Director, Transport Manager, Fleet Manager).

### 2. Apollo search (MCP)
Use Apollo MCP to search by:
- Industry: "Trucking", "Transportation", "Freight", "Logistics"
- Location: UK, specific county or city
- Company size: employee count as proxy for fleet size
- Job titles: Managing Director, Operations Director, Transport Manager, Fleet Manager

Extract: full name, email, LinkedIn URL, company name, company website, phone (if available).

### 3. Firecrawl validation (optional)
For high-value prospects, use Firecrawl to scrape their website and confirm:
- They actually operate trucks/lorries (not just logistics brokerage)
- Fleet size clues (testimonials, "our fleet of X vehicles")
- Specific pain points mentioned on site

### 4. Output format

```json
{
  "first_name": "",
  "last_name": "",
  "email": "",
  "company": "",
  "website": "",
  "title": "",
  "location": "",
  "linkedin": "",
  "vehicle_count_estimate": "",
  "notes": ""
}
```

### 5. Upload to Instantly

Use Instantly MCP or `instantly-campaigns/run.js` to upload leads to the appropriate campaign tier.

## Quality checks

- Flag any email that looks like a catch-all (info@, admin@, contact@) — de-prioritise
- Check for duplicates against `instantly-campaigns/data/leads.json` before uploading
- Minimum: first name + email + company for Instantly upload

## Notes

- Apollo free tier has limits. For large runs (500+), check remaining credits first.
- UK haulage SIC codes: 4941 (Freight transport by road), 5229 (Other transportation support)
