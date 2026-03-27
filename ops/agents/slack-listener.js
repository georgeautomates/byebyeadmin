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
// Requires: @slack/bolt, openai  (npm install in ops/)
// Env vars: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_USER_ID, GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY
//           BUFFER_TOKEN, GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN
//           GOOGLE_CONTENT_SHEET_ID

import boltPkg from '@slack/bolt'
const { App } = boltPkg
import OpenAI from 'openai'
import { createServer } from 'http'
import https from 'https'
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

// Prevent stray WebSocket/network errors from crashing the process
// Exit on EADDRINUSE so systemd restarts cleanly instead of accumulating zombie instances
process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught exception:', err.message)
  if (err.code === 'EADDRINUSE') process.exit(1)
})
process.on('unhandledRejection', (reason) => console.error('[fatal] Unhandled rejection:', reason))

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN
const ALLOWED_USER_ID = process.env.SLACK_USER_ID || 'U0AETR5UK4Y'
const ALLOWED_USERS = new Set([
  ALLOWED_USER_ID,
  ...(process.env.SLACK_EXTRA_USERS || 'U0AE35DN7JQ').split(',').map(s => s.trim()).filter(Boolean),
])
const INTERNAL_PORT = parseInt(process.env.SLACK_LISTENER_PORT || '3001')
const BUFFER_TOKEN          = process.env.BUFFER_TOKEN
const GOOGLE_CLIENT_ID      = process.env.GOOGLE_DRIVE_CLIENT_ID
const GOOGLE_CLIENT_SECRET  = process.env.GOOGLE_DRIVE_CLIENT_SECRET
const GOOGLE_REFRESH_TOKEN  = process.env.GOOGLE_DRIVE_REFRESH_TOKEN
const CONTENT_SHEET_ID      = process.env.GOOGLE_CONTENT_SHEET_ID || '1Wx7J-m97iyXnK4_XxvtaAdnXW-FpB77hQI91mw4Lo7c'
const YT_CHANNEL_ID         = '69b7df3d7be9f8b1715f313c'
const IG_CHANNEL_ID         = '69b7de067be9f8b1715f2df4'
const BUFFER_ORG_ID         = '69b7dc8e9ab93fdee82b1f6e'
const RESEARCH_SCRIPT = resolve(__dir, 'research.js')
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const CLAUDE_ACCESS_TOKEN = process.env.CLAUDE_ACCESS_TOKEN
const CLAUDE_TRIGGER_ID = process.env.CLAUDE_TRIGGER_ID

const LLM_PROVIDERS = [
  GEMINI_API_KEY && {
    name: 'gemini',
    model: 'gemini-2.0-flash',
    client: new OpenAI({
      apiKey: GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    }),
  },
  GROQ_API_KEY && {
    name: 'groq',
    model: 'llama-3.3-70b-versatile',
    client: new OpenAI({ apiKey: GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' }),
  },
  OPENAI_API_KEY && {
    name: 'openai',
    model: 'gpt-4o',
    client: new OpenAI({ apiKey: OPENAI_API_KEY }),
  },
].filter(Boolean)

if (!SLACK_BOT_TOKEN || !SLACK_APP_TOKEN) {
  console.error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set')
  process.exit(1)
}

// ── API helpers ───────────────────────────────────────────────
function httpreq(options, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(options, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString()
        try { resolve({ status: res.statusCode, body: JSON.parse(raw), raw }) }
        catch { resolve({ status: res.statusCode, body: null, raw }) }
      })
    })
    r.on('error', reject)
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body))
    r.end()
  })
}

let _googleToken = null
let _tokenExpiry = 0
async function getGoogleToken() {
  if (_googleToken && Date.now() < _tokenExpiry - 60000) return _googleToken
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: GOOGLE_REFRESH_TOKEN,
  }).toString()
  const res = await httpreq({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body)
  if (!res.body?.access_token) throw new Error(`Google token refresh failed: ${res.raw}`)
  _googleToken = res.body.access_token
  _tokenExpiry = Date.now() + (res.body.expires_in * 1000)
  return _googleToken
}

async function appendSheet(sheetId, tab, values) {
  const token = await getGoogleToken()
  const range = encodeURIComponent(`${tab}!A1`)
  const body = JSON.stringify({ values })
  const res = await httpreq({
    hostname: 'sheets.googleapis.com',
    path: `/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body)
  if (res.status !== 200) throw new Error(`Sheets append failed (${res.status}): ${res.raw.slice(0, 200)}`)
}

// Buffer posts require media — use Ideas instead (text-only, appears in Buffer Ideas tab)
// Called via MCP relay which handles auth internally
async function bufferCreateIdea(title, igCaption, ytDescription) {
  const text = [
    `*IG caption:*\n${igCaption}`,
    ytDescription ? `*YT description:*\n${ytDescription}` : '',
  ].filter(Boolean).join('\n\n')

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    method: 'tools/call',
    params: {
      name: 'create_idea',
      arguments: {
        organizationId: BUFFER_ORG_ID,
        content: { title, text, services: ['youtube', 'instagram'] },
      },
    },
  })

  // MCP returns SSE (text/event-stream) which never closes — read until first data line then destroy
  const raw = await new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'mcp.buffer.com',
      path: '/mcp',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BUFFER_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let buf = ''
      res.on('data', (chunk) => {
        buf += chunk.toString()
        // Wait for a complete data line (terminated by \n) before destroying
        const lineStart = buf.startsWith('data:') ? 0 : buf.indexOf('\ndata:') + 1
        if (lineStart < 0) return
        const lineEnd = buf.indexOf('\n', lineStart + 5)
        if (lineEnd === -1) return // incomplete line, wait for more
        res.destroy()
        resolve({ status: res.statusCode, raw: buf })
      })
      res.on('end', () => resolve({ status: res.statusCode, raw: buf }))
      res.on('error', (e) => { if (e.code !== 'ECONNRESET') reject(e) })
    })
    r.on('error', reject)
    r.write(body)
    r.end()
  })

  if (raw.status !== 200) throw new Error(`Buffer MCP HTTP ${raw.status}: ${raw.raw?.slice(0, 200)}`)

  const dataLine = (raw.raw || '').split('\n').find(l => l.startsWith('data:'))
  if (!dataLine) throw new Error(`Buffer MCP no data in response: ${raw.raw?.slice(0, 200)}`)
  const parsed = JSON.parse(dataLine.slice(5).trim())
  if (parsed.result?.isError) throw new Error(`Buffer idea failed: ${parsed.result.content?.[0]?.text}`)
  const ideaText = parsed.result?.content?.[0]?.text
  const idea = ideaText ? JSON.parse(ideaText) : null
  return idea
}

// ── Pending content approvals ────────────────────────────────
// Content pipeline registers approval by POSTing to localhost:3001/register-approval
// with: { token, filename, driveFileId, transcript, options, scheduleDate }
const pendingApprovals = new Map()

// ── Slack Bolt app ───────────────────────────────────────────
const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
})

// ── Route: last30 [topic] ────────────────────────────────────
app.message(/^last30\s+(.+)/i, async ({ message, say, context }) => {
  if (!ALLOWED_USERS.has(message.user)) return

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
  if (!ALLOWED_USERS.has(message.user)) return

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
  if (!ALLOWED_USERS.has(message.user)) return

  const titleIndex = parseInt(context.matches[1])
  const captionIndex = parseInt(context.matches[2])
  const includeLi = Boolean(context.matches[3])

  console.log(`[content] Approval — title:${titleIndex} ig:${captionIndex} li:${includeLi}`)

  const pending = pendingApprovals.get('latest')
  if (!pending) {
    await say('No pending content approval found. It may have already been processed or the pipeline hasn\'t run yet.')
    return
  }

  await say(`Scheduling to Buffer: title ${titleIndex}, IG caption ${captionIndex}${includeLi ? ', LinkedIn' : ''}...`)

  try {
    const { options, transcript, filename, driveFileId, scheduleDate } = pending
    const title     = options.titles[titleIndex - 1]
    const igCaption = options.igCaptions[captionIndex - 1]
    const ytDesc    = options.ytDescription || ''
    const liPost    = includeLi ? options.linkedinPost : null

    if (!title)     throw new Error(`Title ${titleIndex} not found in options`)
    if (!igCaption) throw new Error(`IG caption ${captionIndex} not found in options`)

    // Create Buffer idea (text-only; Buffer requires media for posts — George adds video in Buffer)
    const idea = await bufferCreateIdea(title, igCaption, ytDesc)
    console.log(`[content] Buffer idea created: ${idea?.id || 'ok'}`)

    const scheduleDateStr = new Date(scheduleDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

    // Log to Raw Transcripts sheet
    const now = new Date().toISOString().slice(0, 10)
    await appendSheet(CONTENT_SHEET_ID, 'Raw Transcripts', [[
      now, filename, transcript || '',
      options.titles.join(' | '), options.igCaptions.join(' | '),
      options.linkedinPost || '', ytDesc,
      title, igCaption, liPost || '',
    ]])

    // Mark as processed
    await appendSheet(CONTENT_SHEET_ID, 'Processed Videos', [[driveFileId, filename, now]])

    pendingApprovals.delete('latest')
    console.log('[content] Scheduled to Buffer and logged to Sheets')

    await say(
      `Idea saved to Buffer for *${scheduleDateStr}*\n` +
      `*YT title:* ${title}\n` +
      `*IG caption:* ${igCaption.slice(0, 80)}...` +
      (liPost ? `\n*LinkedIn:* ${liPost.slice(0, 80)}...` : '') +
      `\n\nGo to Buffer → Ideas to find it. Add the video and publish.`
    )
  } catch (err) {
    console.error('[content] Failed to schedule:', err.message)
    await say(`Failed to schedule: \`${err.message}\``)
  }
})

// ── Route: agent: [task] — dispatch to Claude Code remote agent ──
// Syntax: "agent: write a caption about X"
// Updates the remote trigger prompt with the task + Slack coords, then fires it.
// The CCR agent posts results back to this thread via Slack MCP.
app.message(/^agent:\s*([\s\S]+)/i, async ({ message, say, context }) => {
  if (!ALLOWED_USERS.has(message.user)) return

  const task = context.matches[1].trim()
  const threadTs = message.thread_ts || message.ts
  const channel = message.channel

  console.log(`[agent] Dispatching: "${task.slice(0, 80)}"`)

  if (!CLAUDE_ACCESS_TOKEN || !CLAUDE_TRIGGER_ID) {
    await say({ text: 'Agent not configured. Missing `CLAUDE_ACCESS_TOKEN` or `CLAUDE_TRIGGER_ID`.', thread_ts: threadTs })
    return
  }

  await say({ text: `Dispatching to Claude Code... results will appear here when done.`, thread_ts: threadTs })

  const prompt = `You are a Claude Code sub-agent dispatched by OpenClaw (George's Slack bot) to complete a task.

TASK: ${task}
SLACK_CHANNEL: ${channel}
SLACK_THREAD: ${threadTs}

Instructions:
1. Read ops/CLAUDE.md for full project context
2. Read ops/brand-context/voice.md before any task involving copy or strategy
3. Check ops/learnings.md for the relevant skill section if running a named skill
4. Complete the task thoroughly using the repo files and your reasoning
5. Post your complete results to Slack channel ${channel} in thread ${threadTs} using the Slack MCP tool

The repo is byebyeadmin — a UK haulage AI automation business. All ops context is in ops/.`

  const headers = {
    'Authorization': `Bearer ${CLAUDE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  }

  try {
    // Inject current task into trigger prompt
    const updateRes = await fetch(`https://api.claude.ai/v1/code/triggers/${CLAUDE_TRIGGER_ID}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        job_config: {
          ccr: {
            environment_id: 'env_011WwFnvUrimXhUbsRai7z26',
            session_context: {
              model: 'claude-sonnet-4-6',
              sources: [{ git_repository: { url: 'https://github.com/georgeautomates/byebyeadmin' } }],
              allowed_tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
            },
            events: [{
              data: {
                uuid: '7a2f4e8b-3c15-4d92-b861-9f0e1a523d78',
                session_id: '',
                type: 'user',
                parent_tool_use_id: null,
                message: { role: 'user', content: prompt },
              },
            }],
          },
        },
      }),
    })

    if (!updateRes.ok) {
      const err = await updateRes.text()
      throw new Error(`Trigger update failed (${updateRes.status}): ${err}`)
    }

    // Fire the trigger
    const runRes = await fetch(`https://api.claude.ai/v1/code/triggers/${CLAUDE_TRIGGER_ID}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })

    if (!runRes.ok) {
      const err = await runRes.text()
      throw new Error(`Trigger run failed (${runRes.status}): ${err}`)
    }

    const runData = await runRes.json()
    console.log(`[agent] Dispatched, run id: ${runData?.run?.id || JSON.stringify(runData)}`)
  } catch (err) {
    console.error('[agent] Error:', err.message)
    await say({ text: `Agent dispatch failed: \`${err.message}\``, thread_ts: threadTs })
  }
})

// ── Fallback: route all other DMs through LLM cascade ────────
// Tries providers in order: Gemini → Groq → OpenAI. Falls through on 429/rate-limit.
app.message(async ({ message, say, client }) => {
  if (!ALLOWED_USERS.has(message.user)) return
  if (!message.text || message.subtype) return

  const threadTs = message.thread_ts || message.ts
  console.log(`[llm] DM from ${message.user} thread:${threadTs}: "${message.text?.slice(0, 80)}"`)

  if (!LLM_PROVIDERS.length) {
    await say({ text: 'No LLM configured. Commands: `last30 [topic]` | `title [n], ig [n]` | `skip`', thread_ts: threadTs })
    return
  }

  try {
    const systemPrompt = readFileSync(resolve(__dir, '../brand-context/voice.md'), 'utf-8').slice(0, 2000)

    // Fetch full thread history for conversation context
    const { messages: thread } = await client.conversations.replies({
      channel: message.channel,
      ts: threadTs,
    })

    const history = thread
      .filter(m => !m.subtype && m.text)
      .map(m => ({ role: m.bot_id ? 'assistant' : 'user', content: m.text }))
      .slice(-10)

    const systemMsg = {
      role: 'system',
      content: `You are OpenClaw, George's AI business assistant running on his VPS. You help him run ByeByeAdmin, a UK haulage AI automation company. Be concise — Slack messages, not essays. You can discuss strategy, review ideas, answer questions, and help plan work. You cannot directly execute tasks (file edits, deployments, API calls) but you can advise clearly on what to do or suggest commands.\n\nEMAIL CONSTRAINT: You must NEVER send emails or trigger any action that sends an email. You may draft email content (subject, body, to/cc) and present it to George so he can send it manually. This is an absolute restriction.\n\nBrand voice context:\n${systemPrompt}`,
    }

    let reply = null
    for (const provider of LLM_PROVIDERS) {
      try {
        console.log(`[llm] trying ${provider.name} (${provider.model})`)
        const response = await provider.client.chat.completions.create({
          model: provider.model,
          max_tokens: 1024,
          messages: [systemMsg, ...history],
        })
        reply = response.choices[0].message.content
        console.log(`[llm] responded via ${provider.name}`)
        break
      } catch (err) {
        if (LLM_PROVIDERS.indexOf(provider) < LLM_PROVIDERS.length - 1) {
          console.warn(`[llm] ${provider.name} failed (${err.message}), falling back...`)
          continue
        }
        throw err
      }
    }

    if (reply) await say({ text: reply, thread_ts: threadTs })
  } catch (err) {
    console.error('[llm] Error:', err.message)
    await say({ text: `Error: \`${err.message}\``, thread_ts: threadTs })
  }
})

// ── Internal HTTP server: content-pipeline registers pending approvals ──
// content-pipeline.js POSTs here after sending the Slack options message:
//   POST http://127.0.0.1:3001/register-approval
//   Body: { token, filename, driveFileId, transcript, options, scheduleDate }
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
      if (!data.token) {
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
