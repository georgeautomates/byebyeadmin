# Agent: Transcription Agent

## Purpose

Processes raw transcripts from calls, recordings, or voice notes into structured content assets. Can be triggered from WhatsApp (send a voice note → get back structured notes) or from Claude Code.

## Trigger

WhatsApp: Send voice note or paste a transcript → OpenClaw routes to this agent
Claude Code: "Process this transcript: [paste]"

## Process

1. Receive raw text (or audio file → transcribe first if needed)
2. Identify the source type: client call / video recording / voice note / podcast
3. Run the appropriate extraction from `skills/transcription.md`
4. Return structured output
5. If client context: prompt to save to memory

## Voice note flow (VPS)

1. User sends voice note via WhatsApp to OpenClaw
2. OpenClaw saves the audio file
3. Agent calls Whisper API (or local Whisper on VPS) to transcribe
4. Processed output sent back to WhatsApp as a formatted message
5. Full structured notes saved to `bba-ops/data/transcripts/[date]-[type].md`

## Output routing

| Source | Primary output | Secondary output |
|--------|---------------|-----------------|
| Client call | Client context card | Follow-up action list |
| Video recording | Shorts timestamps + hook options | Caption draft |
| Voice note / brain dump | Structured outline | Memory update if relevant |
| Podcast / interview | Key quotes | Article angle |

## Environment variables

```
OPENAI_API_KEY  (for Whisper transcription, if using OpenAI)
```

Or use local Whisper on VPS to avoid API costs for long recordings.

## Skill reference

See `skills/transcription.md` for full extraction templates.
