#!/usr/bin/env node
// BBA Slack Listener
// Socket Mode listener for on-demand agent triggers from George's DMs
// Runs as a persistent systemd service on the VPS alongside OpenClaw
//
// Supported commands (DM OpenClaw):
//   last30 [topic]   — run last30days research, post brief to Slack
//
// Requires: @slack/bolt  (npm install @slack/bolt in ops/)
// Env vars: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_USER_ID

import { App } from '@slack/bolt'
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
const RESEARCH_SCRIPT = resolve(__dir, 'research.js')

if (!SLACK_BOT_TOKEN || !SLACK_APP_TOKEN) {
  console.error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set')
  process.exit(1)
}

// ── Slack Bolt app ───────────────────────────────────────────
const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
})

// ── Route: last30 [topic] ────────────────────────────────────
app.message(/^last30\s+(.+)/i, async ({ message, say, context }) => {
  // Only respond to DMs from George
  if (message.user !== ALLOWED_USER_ID) return

  const topic = context.matches[1].trim()

  console.log(`[last30] Received request for: "${topic}"`)

  // Immediate acknowledgement
  await say(`Researching *${topic}* across Reddit, X, YouTube, HN, Bluesky, and the web... ⏳\n_This takes 2-8 minutes._`)

  // Spawn research.js as a child process so it doesn't block the listener
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

// ── Start ────────────────────────────────────────────────────
;(async () => {
  await app.start()
  console.log('BBA Slack listener started (Socket Mode)')
  console.log(`Listening for DMs from ${ALLOWED_USER_ID}`)
  console.log('Commands: last30 [topic]')
})()
