#!/usr/bin/env node
// Deploy content-pipeline.json to n8n via REST API
//
// Usage:
//   NODE_TLS_REJECT_UNAUTHORIZED=0 N8N_API_KEY=your_key node ops/scripts/deploy-n8n-workflow.js
//   NODE_TLS_REJECT_UNAUTHORIZED=0 N8N_API_KEY=your_key node ops/scripts/deploy-n8n-workflow.js --dry-run
//
// The script creates the workflow if it doesn't exist, updates it if it does,
// then activates it. Safe to run repeatedly.

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Config ───────────────────────────────────────────────────
const N8N_BASE_URL = (process.env.N8N_BASE_URL || 'https://n8n.srv1155250.hstgr.cloud').replace(/\/$/, '')
const N8N_API_KEY = process.env.N8N_API_KEY
const DRY_RUN = process.argv.includes('--dry-run')
const WORKFLOW_FILE = resolve(__dir, '../n8n-workflows/content-pipeline.json')

if (!N8N_API_KEY) {
  console.error('Error: N8N_API_KEY is not set.')
  console.error('Get it from: n8n UI → Settings → API Keys → Create API Key')
  console.error('Then run: N8N_API_KEY=your_key node ops/scripts/deploy-n8n-workflow.js')
  process.exit(1)
}

// ── Helpers ──────────────────────────────────────────────────
const api = async (method, path, body) => {
  const res = await fetch(`${N8N_BASE_URL}/api/v1${path}`, {
    method,
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`n8n API ${method} ${path} failed (${res.status}): ${text}`)
  }

  return text ? JSON.parse(text) : null
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log(`n8n deploy — ${N8N_BASE_URL}`)
  if (DRY_RUN) console.log('(dry run — no changes will be made)')

  // Load workflow definition
  const workflow = JSON.parse(readFileSync(WORKFLOW_FILE, 'utf-8'))
  console.log(`Loaded: ${workflow.name} (${workflow.nodes.length} nodes)`)

  if (DRY_RUN) {
    console.log('\nWorkflow JSON is valid. Run without --dry-run to deploy.')
    return
  }

  // Strip fields not accepted by the n8n REST API
  const { meta, pinData, id: _id, versionId, active, ...workflowPayload } = workflow

  // Check if workflow already exists by name — paginate through all results
  let match = null
  let cursor = null
  do {
    const url = cursor ? `/workflows?limit=50&cursor=${cursor}` : '/workflows?limit=50'
    const page = await api('GET', url)
    match = page.data?.find(w => w.name === workflow.name)
    cursor = page.nextCursor
  } while (!match && cursor)

  let result
  if (match) {
    console.log(`Found existing workflow id=${match.id} — updating...`)
    result = await api('PUT', `/workflows/${match.id}`, {
      ...workflowPayload,
      id: match.id,
    })
    console.log(`Updated: ${result.name} (id=${result.id})`)
  } else {
    console.log('No existing workflow found — creating...')
    result = await api('POST', '/workflows', workflowPayload)
    console.log(`Created: ${result.name} (id=${result.id})`)
  }

  // Activate the workflow (may fail if env vars not set yet — that's fine)
  try {
    await api('POST', `/workflows/${result.id}/activate`)
    console.log('Activated.')
  } catch (err) {
    if (err.message.includes('env vars')) {
      console.log('Not yet activated — env vars need to be set first (see below).')
    } else {
      throw err
    }
  }

  console.log(`\nWorkflow deployed: ${N8N_BASE_URL}/workflow/${result.id}`)
  console.log('\nTo go live, complete setup in n8n:')
  console.log('  1. Settings → Variables → add:')
  console.log('     GOOGLE_DRIVE_FOLDER_ID  (Drive folder ID to watch)')
  console.log('     OPENAI_API_KEY          (for Whisper transcription)')
  console.log('     ANTHROPIC_API_KEY       (for Claude content generation)')
  console.log('     SLACK_BOT_TOKEN         (OpenClaw bot token)')
  console.log('     SLACK_USER_ID           (U0AETR5UK4Y)')
  console.log('     BUFFER_ACCESS_TOKEN     (from publish.buffer.com → settings → API)')
  console.log('     BUFFER_IG_PROFILE_ID    (Buffer IG profile ID)')
  console.log('     BUFFER_LI_PROFILE_ID    (Buffer LinkedIn profile ID)')
  console.log('  2. Open workflow → connect Google Drive credentials')
  console.log('  3. Re-run this script to activate, or toggle Active in the n8n UI')
}

main().catch(err => {
  console.error('Deploy failed:', err.message)
  process.exit(1)
})
