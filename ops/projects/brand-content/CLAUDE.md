# Brand & Content — Project Context

## What this project covers

All content creation for ByeByeAdmin's brand channels: Instagram, YouTube, LinkedIn, and any written content (articles, newsletters, case studies).

## Brand voice

Confident, straight-talking, knowledgeable about haulage. Not corporate. Not startup-bro. Think: sharp operator who happens to know AI. Educate without lecturing. Make complex AI concepts land for fleet managers who don't care about tech — they care about saving time and money.

- No em dashes anywhere
- Short sentences. Active voice.
- Numbers and specifics beat vague claims ("saves 4 hours a week" beats "saves time")

## Channels

| Channel | Format | Cadence |
|---------|--------|---------|
| Instagram | Reels + carousels | 3–5x/week |
| YouTube | Shorts (60s) + long-form tutorials | Weekly |
| LinkedIn | Posts + articles | 3x/week |

## Skills to use here

- `skills/script-writing.md` — YouTube scripts and Reels voiceovers
- `skills/caption-writing.md` — IG and LinkedIn captions
- `skills/idea-generator.md` — Content ideas from industry topics or client insights
- `skills/transcription.md` — Process raw video/audio into repurposed content
- `skills/subject-book-writer.md` — Long-form articles, email newsletters

## Content pillars

1. **Automation demos** — "Here's what I automated this week for a fleet client"
2. **Education** — "What is [AI concept] and why haulage operators should care"
3. **Behind the business** — Founder story, building in public, honest takes
4. **Social proof** — Client results, assessment scores, case studies
5. **Industry takes** — Commentary on UK haulage news, regulations, FORS, etc.

## Knowledge bank

Transcripts, research, and distilled insights get stored in `memory/MEMORY.md` via the memory agent for reuse across content.

## YouTube channel

`YOUTUBE_API_KEY` and `YOUTUBE_CHANNEL_ID` in `~/bba-ops/.env` and byebyeadmin `.env.local`. Shorts URLs tracked in `~/byebyeadmin/instantly-campaigns/video-urls.js`. Subscriber count pulled daily in the morning briefing.
