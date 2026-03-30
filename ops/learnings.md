# Learnings

This file is the system's long-term feedback memory. It logs corrections, process improvements, and things that didn't work — organised by skill and project domain.

**Mandatory rule:** Before executing any skill, read the relevant section here and apply any logged corrections. Do not repeat past mistakes.

---

## Global

*Lessons that apply across all skills and tasks.*

<!-- Format: [YYYY-MM-DD] What happened → What to do instead -->

---

## By Skill

### assessment-builder
<!-- Log learnings from assessment build tasks here -->

### campaign-writer
<!-- Log learnings from Instantly sequence/tier copy tasks here -->

### caption-writing
<!-- Log learnings from caption writing tasks here -->

### client-onboarding
<!-- Log learnings from client onboarding and discovery call tasks here -->

### claude-md-optimiser
<!-- Log learnings from CLAUDE.md audit tasks here -->

### email-writing
<!-- Log learnings from email writing tasks here -->

### frontend-design
<!-- Log learnings from frontend/UI tasks here -->

### heartbeat
<!-- Log learnings from heartbeat/registry sync tasks here -->

### idea-generator
<!-- Log learnings from idea generation tasks here -->

### memory-agent
<!-- Log learnings from memory capture tasks here -->

### n8n-workflow-builder
<!-- Log learnings from n8n workflow tasks here -->

### prospector-researcher
<!-- Log learnings from prospecting and research tasks here -->

### reflection-agent
<!-- Log learnings from reflection and strategy tasks here -->

### reply-handler
<!-- Log learnings from cold email reply triage and drafting tasks here -->

### script-writing
<!-- Log learnings from script writing tasks here -->

### skill-builder
<!-- Log learnings from skill creation/auditing tasks here -->

### subject-book-writer
<!-- Log learnings from long-form writing tasks here -->

### summarising-agent
<!-- Log learnings from summarisation tasks here -->

### transcription
<!-- Log learnings from transcription tasks here -->

### wrap-up
<!-- Log learnings from wrap-up/session-close tasks here -->

---

## By Project

### sales-outreach
<!-- Log learnings from campaign, prospecting, and cold email work here -->

### brand-content

<!-- Content pipeline (bba-pipeline-check.js) learnings — 2026-03-30 -->

**[2026-03-30] Instagram API silently rejects HTTP video URLs**
Source videos must be served over HTTPS. Buffer can fetch and thumbnail a video over HTTP, but when it passes the URL to Instagram's Graph API, Instagram rejects it with a generic "media specifications" error. Fix: the pipeline starts a Cloudflare quick tunnel (`cloudflared tunnel --url http://localhost:8766`) to expose the video server as HTTPS before posting. Binary at `/home/openclaw/.local/bin/cloudflared` (ARM64). Never use a bare VPS IP (`http://178.104.12.113:...`) for Instagram video URLs.

**[2026-03-30] Source videos may be HEVC/4K — must compress before posting**
iPhone and modern cameras record in HEVC (H.265) at 4K. Buffer and Instagram reject these. Always compress to H.264 baseline, 1080x1920, CRF 23, AAC 128k, faststart before serving to Buffer:
```
ffmpeg -i input.mp4 -vcodec libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -crf 23 -preset fast -vf "scale=1080:1920" -acodec aac -b:a 128k -movflags +faststart output_h264.mp4 -y
```
The pipeline does this automatically in `runApproval()`.

**[2026-03-30] All previous successful Instagram posts were via:network — never via Buffer API**
Buffer's direct Instagram API video posting had never worked. Root cause: Instagram requires HTTPS media URLs. After confirming HTTPS fix, Reels now post successfully via Buffer API (`status: sent`, `via: buffer`).

**[2026-03-30] Video server must stay running until Buffer has fetched the video**
The pipeline serves the compressed video from the VPS on port 8766 for Buffer to download. Server must be running when Buffer fetches — not just when the post is created. Use a detached background Node process with a 48h timeout. Kill existing servers on 8766 before starting a new one (`fuser -k 8766/tcp`).

**[2026-03-30] Google Drive token split — two separate OAuth tokens needed**
`GOOGLE_DRIVE_REFRESH_TOKEN` — drive.readonly scope (for downloading videos from Drive)
`GOOGLE_REFRESH_TOKEN` — spreadsheets + gmail scope (for reading/writing Sheets)
These are different Google accounts. Never use one token for both purposes.

### client-delivery
<!-- Log learnings from client onboarding, n8n builds, and delivery here -->

### strategy
<!-- Log learnings from business strategy and positioning work here -->
