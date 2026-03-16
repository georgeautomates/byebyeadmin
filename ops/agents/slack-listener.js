#!/usr/bin/env node
// BBA Slack Listener
// Socket Mode listener for on-demand agent triggers from George's DMs
// Runs as a persistent systemd service on the VPS alongside OpenClaw
//
// Supported commands (DM OpenClaw):
//   last30 [topic]           — run last30days research, post brief to Slack
//   title [n], ig [n]        — approve content pipeline options, schedule to Buffer
//   title [n], ig [n], li    — approve + include LinkedIn post
//   skip                     — dismiss current pending content approval
//
// Requires: @slack/bolt, @anthropic-ai/sdk  (npm install in ops/)
// Env vars: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_USER_ID, N8N_BASE_URL, ANTHROPIC_API_KEY

import boltPkg from '@slack/bolt'
const { App } = boltPkg
import Anthropic from '@anthropic-ai/sdk'
import { createServer } from 'http'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Load .env ────────────────────────────────────────────────
function loadEnv() {
  try {
    const lines = readFileSync(resolve(__dir, '../.env'), 'utf-8').split('\n')
    for (const line of lines) {
      const [k, ...rest] = line.split('=')
      if (k && rest.length) process.env[k.trim()] = rest.join('=').trim()
    }
  } catch {
    // rely on systemd env
  }
}
loadEnv()

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN
const ALLOWED_USER_ID = process.env.SLACK_USER_ID || 'U0AETR5UK4Y'
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://n8n.srv1155250.hstgr.cloud'
const INTERNAL_PORT = parseInt(process.env.SLACK_LISTENER_PORT || '3001')
const RESEARCH_SCRIPT = resolve(__dir, 'research.js')
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!SLACK_BOT_TOKEN || !SLACK_APP_TOKEN) {
  console.error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set')
  process.exit(1)
}

// ── Pending content approvals ────────────────────────────────
// Tracks the most recent content approval waiting for George's selection.
// n8n registers a pending approval by POSTing to localhost:3001/register-approval
// with: { token, resumeUrl, filename }
const pendingApprovals = new Map()

// ── Slack Bolt app ───────────────────────────────────────────
const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
})

// ── Route: last30 [topic] ────────────────────────────────────
app.message(/^last30\s+(.+)/i, async ({ message, say, context }) => {
  if (message.user !== ALLOWED_USER_ID) return

  const topic = context.matches[1].trim()
  console.log(`[last30] Received request for: "${topic}"`)

  await say(`Researching *${topic}* across Reddit, X, YouTube, HN, Bluesky, and the web... ⏳\n_This takes 2-8 minutes._`)

  const child = spawn('node', [RESEARCH_SCRIPT, '--topic', topic], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })

  child.stdout.on('data', (data) => process.stdout.write(data))
  child.stderr.on('data', (data) => process.stderr.write(data))

  child.on('error', async (err) => {
    console.error('[last30] Failed to spawn research.js:', err.message)
    await say(`Failed to start research: \`${err.message}\``)
  })

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`[last30] research.js exited with code ${code}`)
      // Error message already sent to Slack by research.js itself
    } else {
      console.log(`[last30] Research complete for: "${topic}"`)
    }
  })
})

// ── Route: skip ──────────────────────────────────────────────
app.message(/^skip$/i, async ({ message, say }) => {
  if (message.user !== ALLOWED_USER_ID) return

  if (!pendingApprovals.has('latest')) {
    await say('No pending content approval to skip.')
    return
  }

  pendingApprovals.clear()
  console.log('[content] Pending approval dismissed by user')
  await say('Content approval dismissed.')
})

// ── Route: title [n], ig [n] (content approval) ──────────────
// Matches: "title 2, ig 1" / "title 1, ig 2, li" / "title 3 ig 1"
app.message(/^title\s+(\d)[,\s]+ig\s+(\d)(,?\s*li)?/i, async ({ message, say, context }) => {
  if (message.user !== ALLOWED_USER_ID) return

  const titleIndex = parseInt(context.matches[1])
  const captionIndex = parseInt(context.matches[2])
  const includeLi = Boolean(context.matches[3])

  console.log(`[content] Approval — title:${titleIndex} ig:${captionIndex} li:${includeLi}`)

  const pending = pendingApprovals.get('latest')
  if (!pending) {
    await say('No pending content approval found. The n8n workflow may have expired or already been processed.')
    return
  }

  await say(`Scheduling to Buffer: title ${titleIndex}, IG caption ${captionIndex}${includeLi ? ', LinkedIn' : ''}...`)

  try {
    const response = await fetch(pending.resumeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titleIndex,
        captionIndex,
        includeLi,
        scheduleAt: null,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`n8n resume failed (${response.status}): ${text}`)
    }

    pendingApprovals.delete('latest')
    console.log('[content] n8n workflow resumed successfully')
    // Confirmation DM is sent by the "Confirm to Slack" node in n8n
  } catch (err) {
    console.error('[content] Failed to resume n8n workflow:', err.message)
    await say(`Failed to schedule: \`${err.message}\``)
  }
})

// ── Fallback: route all other DMs through Claude ─────────────
app.message(async ({ message, say, client }) => {
  if (message.user !== ALLOWED_USER_ID) return
  if (!message.text || message.subtype) return

  const threadTs = message.thread_ts || message.ts
  console.log(`[claude] DM from ${message.user} thread:${threadTs}: "${message.text?.slice(0, 80)}"`)

  if (!ANTHROPIC_API_KEY) {
    await say({ text: 'Commands: `last30 [topic]` | `title [n], ig [n]` | `skip`', thread_ts: threadTs })
    return
  }

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const systemPrompt = readFileSync(resolve(__dir, '../brand-context/voice.md'), 'utf-8').slice(0, 2000)

    // Fetch full thread history so Claude has conversation context
    const { messages: thread } = await client.conversations.replies({
      channel: message.channel,
      ts: threadTs,
    })

    const history = thread
      .filter(m => !m.subtype && m.text)
      .map(m => ({ role: m.bot_id ? 'assistant' : 'user', content: m.text }))

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: `You are OpenClaw, George's AI business assistant running on his VPS. You help him run ByeByeAdmin, a UK haulage AI automation company. Be concise — Slack messages, not essays. You can discuss strategy, review ideas, answer questions, and help plan work. You cannot directly execute tasks (file edits, deployments, API calls) but you can advise clearly on what to do or suggest commands.\n\nBrand voice context:\n${systemPrompt}`,
      messages: history,
    })

    const reply = response.content[0]?.text
    if (reply) await say({ text: reply, thread_ts: threadTs })
  } catch (err) {
    console.error('[claude] Error:', err.message)
    await say({ text: `Error: \`${err.message}\``, thread_ts: threadTs })
  }
})

// ── Internal HTTP server: n8n registers pending approvals ────
// n8n's "Store Resume URL" node POSTs here after sending the Slack options message:
//   POST http://127.0.0.1:3001/register-approval
//   Body: { token: "abc12345", resumeUrl: "https://n8n.../webhook-waiting/...", filename: "..." }
createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/register-approval') {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    try {
      const data = JSON.parse(body)
      if (!data.resumeUrl || !data.token) {
        res.writeHead(400)
        res.end('Missing resumeUrl or token')
        return
      }
      pendingApprovals.set(data.token, data)
      pendingApprovals.set('latest', data)
      console.log(`[content] Registered pending approval: token=${data.token} file="${data.filename}"`)
      res.writeHead(200)
      res.end('OK')
    } catch (e) {
      res.writeHead(400)
      res.end('Invalid JSON')
    }
  })
}).listen(INTERNAL_PORT, '127.0.0.1', () => {
  console.log(`Internal registration server listening on 127.0.0.1:${INTERNAL_PORT}`)
})

// ── Start ────────────────────────────────────────────────────
;(async () => {
  await app.start()
  console.log('BBA Slack listener started (Socket Mode)')
  console.log(`Listening for DMs from ${ALLOWED_USER_ID}`)
  console.log('Commands: last30 [topic] | title [n], ig [n] | skip')
})()
