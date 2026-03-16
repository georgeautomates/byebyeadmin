#!/usr/bin/env node
// BBA Research Agent
// Runs last30days.py for a given topic and sends the brief to Slack via OpenClaw
// Usage: node research.js --topic "UK fleet telematics"
//
// Called by slack-listener.js when George DMs "last30 [topic]"
// Can also be run directly from terminal for ad-hoc research

import { execSync, spawnSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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
    // rely on actual env vars
  }
}
loadEnv()

const SLACK_USER_ID = process.env.SLACK_USER_ID || 'U0AETR5UK4Y'
const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY

// last30days.py lives here on both Mac and VPS (cloned separately, not in repo)
const SKILL_ROOT = resolve(__dir, '../../.claude/skills/last30days')
const SCRIPT_PATH = resolve(SKILL_ROOT, 'scripts/last30days.py')

// ── Parse CLI args ───────────────────────────────────────────
function parseTopic() {
  const args = process.argv.slice(2)
  const topicIdx = args.indexOf('--topic')
  if (topicIdx === -1 || !args[topicIdx + 1]) {
    console.error('Usage: node research.js --topic "your topic here"')
    process.exit(1)
  }
  return args[topicIdx + 1]
}

// ── Run last30days.py ────────────────────────────────────────
function runResearch(topic) {
  if (!existsSync(SCRIPT_PATH)) {
    throw new Error(
      `last30days.py not found at ${SCRIPT_PATH}\n` +
      `Clone the skill: git clone https://github.com/mvanhorn/last30days-skill ${SKILL_ROOT}`
    )
  }

  if (!SCRAPECREATORS_API_KEY) {
    throw new Error('SCRAPECREATORS_API_KEY not set — add it to ops/.env or systemd env')
  }

  console.log(`Running last30days research for: "${topic}"`)
  console.log('This takes 2-8 minutes...\n')

  const result = spawnSync('python3', [SCRIPT_PATH, topic], {
    cwd: resolve(SKILL_ROOT, 'scripts'),
    env: {
      ...process.env,
      SCRAPECREATORS_API_KEY,
    },
    timeout: 10 * 60 * 1000, // 10 min hard limit
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024, // 10MB
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    const err = result.stderr?.trim() || 'unknown error'
    throw new Error(`last30days.py exited ${result.status}: ${err}`)
  }

  return result.stdout || ''
}

// ── Format for Slack ─────────────────────────────────────────
// Slack messages are limited to 4000 chars. Truncate gracefully.
const SLACK_LIMIT = 3800

function formatBrief(topic, raw) {
  const header = `*Research: ${topic}*\n_Sources: Reddit, X, YouTube, HN, Bluesky, web — last 30 days_\n\n`

  // Strip ANSI escape codes (Python scripts sometimes emit them)
  const clean = raw.replace(/\x1b\[[0-9;]*m/g, '').trim()

  if (header.length + clean.length <= SLACK_LIMIT) {
    return header + clean
  }

  const truncated = clean.slice(0, SLACK_LIMIT - header.length - 80)
  const lastPara = truncated.lastIndexOf('\n\n')
  const cut = lastPara > 0 ? truncated.slice(0, lastPara) : truncated

  return header + cut + '\n\n_[Brief truncated — full report saved to ~/Documents/Last30Days/]_'
}

// ── Send via OpenClaw ────────────────────────────────────────
function sendToSlack(message) {
  execSync(
    `openclaw message send --channel slack --target ${SLACK_USER_ID} --message ${JSON.stringify(message)}`,
    { stdio: 'inherit' }
  )
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const topic = parseTopic()

  try {
    const raw = runResearch(topic)
    const message = formatBrief(topic, raw)
    console.log('\n--- Slack message ---')
    console.log(message)
    console.log('---\n')
    sendToSlack(message)
    console.log('Sent.')
  } catch (e) {
    const errMsg = `*Research failed for "${topic}"*\n\`${e.message}\``
    console.error('Research failed:', e.message)
    sendToSlack(errMsg)
    process.exit(1)
  }
}

main()
