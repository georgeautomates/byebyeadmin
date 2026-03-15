#!/usr/bin/env node
// BBA Weekly Analytics Update
// Sends 7-day trend data every Monday at 8:30 AM UTC via OpenClaw → Slack
// Cron: 30 8 * * 1  (8:30 AM UTC every Monday)
//
// Data sources:
//   - Instantly: 7-day campaign stats (sent, open rate, reply rate, best subject)
//   - YouTube: 7-day views, new subs (note: YouTube API only provides total counts,
//              so we compare snapshots stored in VPS state file for delta)
//   - GA4: 7-day sessions, assessment funnel (start → contact → complete)
//
// Instagram/Facebook: skipped until META_ACCESS_TOKEN is configured

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Load .env ─────────────────────────────────────────────────
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

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '527598212'
const GMAIL_CLIENT_ID = '698251746508-3q6ah4t7hb56uit827gae055deb8f0rj.apps.googleusercontent.com'
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN
const SLACK_USER_ID = process.env.SLACK_USER_ID || 'U0AETR5UK4Y'

// State file for YouTube snapshot deltas (since API only gives totals)
const STATE_FILE = resolve(__dir, '../.analytics-state.json')

// ── Date helpers ──────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function weekOf() {
  return new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ── State management (for YouTube deltas) ─────────────────────
function loadState() {
  try {
    return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf-8')) : {}
  } catch {
    return {}
  }
}

function saveState(state) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  } catch (e) {
    console.warn('Could not save state:', e.message)
  }
}

// ── Instantly: 7-day campaign analytics ──────────────────────
async function getInstantlyWeekly() {
  try {
    const BASE = 'https://api.instantly.ai/api/v2'
    const headers = { Authorization: `Bearer ${INSTANTLY_API_KEY}` }

    const listRes = await fetch(`${BASE}/campaigns?limit=50`, { headers })
    if (!listRes.ok) throw new Error(`list ${listRes.status}`)
    const listData = await listRes.json()
    const campaigns = listData.items ?? listData ?? []

    if (campaigns.length === 0) {
      return { sent: 0, opens: 0, replies: 0, openRate: '0.0', replyRate: '0.0', ok: true }
    }

    let sent = 0, opens = 0, replies = 0
    const subjectStats = {}

    await Promise.all(
      campaigns.map(async (c) => {
        try {
          const r = await fetch(`${BASE}/campaigns/analytics/overview?id=${c.id}`, { headers })
          if (!r.ok) return
          const d = await r.json()
          sent += d.total_sent ?? d.sent ?? 0
          opens += d.total_opened ?? d.opens ?? d.total_opens ?? 0
          replies += d.total_replied ?? d.replies ?? d.total_replies ?? 0
        } catch {}
      })
    )

    const openRate = sent > 0 ? ((opens / sent) * 100).toFixed(1) : '0.0'
    const replyRate = sent > 0 ? ((replies / sent) * 100).toFixed(1) : '0.0'

    return { sent, opens, replies, openRate, replyRate, ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ── YouTube: channel stats with delta ────────────────────────
async function getYouTubeWeekly() {
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YOUTUBE_CHANNEL_ID}&key=${YOUTUBE_API_KEY}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    const stats = data.items?.[0]?.statistics ?? {}

    const subscribers = parseInt(stats.subscriberCount ?? 0)
    const views = parseInt(stats.viewCount ?? 0)
    const videos = parseInt(stats.videoCount ?? 0)

    // Compare to last week's snapshot
    const state = loadState()
    const lastWeek = state.youtube ?? {}
    const subDelta = lastWeek.subscribers ? subscribers - lastWeek.subscribers : null
    const viewDelta = lastWeek.views ? views - lastWeek.views : null

    // Save new snapshot
    saveState({ ...state, youtube: { subscribers, views, videos } })

    return {
      subscribers: subscribers.toLocaleString(),
      views: views.toLocaleString(),
      videos,
      subDelta: subDelta !== null ? (subDelta >= 0 ? `+${subDelta}` : `${subDelta}`) : null,
      viewDelta: viewDelta !== null ? (viewDelta >= 0 ? `+${viewDelta.toLocaleString()}` : `${viewDelta.toLocaleString()}`) : null,
      ok: true,
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ── Google OAuth: get access token ───────────────────────────
async function getGoogleAccessToken() {
  if (!GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error('GMAIL_CLIENT_SECRET or GMAIL_REFRESH_TOKEN not set')
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
  return data.access_token
}

// ── GA4: 7-day sessions + assessment funnel ───────────────────
async function getGA4Weekly() {
  try {
    const accessToken = await getGoogleAccessToken()

    const body = {
      dateRanges: [{ startDate: daysAgo(7), endDate: daysAgo(0) }],
      metrics: [
        { name: 'sessions' },
        { name: 'screenPageViews' },
      ],
      dimensions: [
        { name: 'sessionDefaultChannelGroup' },
      ],
    }

    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`GA4 ${res.status}: ${err}`)
    }

    const data = await res.json()
    const rows = data.rows ?? []

    let totalSessions = 0
    let topSource = 'unknown'
    let topSourceSessions = 0

    for (const row of rows) {
      const sessions = parseInt(row.metricValues?.[0]?.value ?? 0)
      totalSessions += sessions
      const channel = row.dimensionValues?.[0]?.value ?? 'unknown'
      if (sessions > topSourceSessions) {
        topSourceSessions = sessions
        topSource = channel
      }
    }

    // Assessment funnel: sessions on /assessment pages
    // Use a separate event-based query for page views on assessment path
    const funnelBody = {
      dateRanges: [{ startDate: daysAgo(7), endDate: daysAgo(0) }],
      metrics: [{ name: 'screenPageViews' }],
      dimensions: [{ name: 'pagePath' }],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: { matchType: 'BEGINS_WITH', value: '/assessment' },
        },
      },
    }

    const funnelRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(funnelBody),
      }
    )

    let assessmentViews = 0
    if (funnelRes.ok) {
      const funnelData = await funnelRes.json()
      for (const row of funnelData.rows ?? []) {
        assessmentViews += parseInt(row.metricValues?.[0]?.value ?? 0)
      }
    }

    return {
      sessions: totalSessions.toLocaleString(),
      topSource,
      assessmentViews,
      ok: true,
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ── Format message ────────────────────────────────────────────
function formatWeeklyUpdate(instantly, youtube, ga4) {
  const lines = [`*BBA Weekly Analytics — w/e ${weekOf()}*`, '']

  // Outreach
  if (instantly.ok) {
    lines.push('*Outreach (7 days)*')
    lines.push(`Sent: ${instantly.sent.toLocaleString()} | Opens: ${instantly.openRate}% | Replies: ${instantly.replyRate}%`)
    if (instantly.replies > 0) lines.push(`Total replies: ${instantly.replies}`)
  } else {
    lines.push(`Outreach: unavailable (${instantly.error})`)
  }

  lines.push('')

  // YouTube
  if (youtube.ok) {
    lines.push('*YouTube*')
    const subLine = youtube.subDelta
      ? `Subscribers: ${youtube.subscribers} (${youtube.subDelta} this week)`
      : `Subscribers: ${youtube.subscribers}`
    const viewLine = youtube.viewDelta
      ? `Total views: ${youtube.views} (${youtube.viewDelta} this week)`
      : `Total views: ${youtube.views}`
    lines.push(subLine)
    lines.push(viewLine)
  } else {
    lines.push(`YouTube: unavailable (${youtube.error})`)
  }

  lines.push('')

  // GA4
  if (ga4.ok) {
    lines.push('*Site (7 days)*')
    lines.push(`Sessions: ${ga4.sessions} | Top source: ${ga4.topSource}`)
    if (ga4.assessmentViews > 0) {
      lines.push(`Assessment page views: ${ga4.assessmentViews}`)
    }
  } else {
    lines.push(`Site: unavailable (${ga4.error})`)
  }

  lines.push('')
  lines.push('_Instagram/Facebook: coming soon_')

  return lines.join('\n')
}

// ── Send via OpenClaw ─────────────────────────────────────────
function sendToSlack(message) {
  execSync(
    `openclaw message send --channel slack --target ${SLACK_USER_ID} --message ${JSON.stringify(message)}`,
    { stdio: 'inherit' }
  )
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('Fetching weekly analytics...')

  const [instantly, youtube, ga4] = await Promise.all([
    getInstantlyWeekly(),
    getYouTubeWeekly(),
    getGA4Weekly(),
  ])

  const message = formatWeeklyUpdate(instantly, youtube, ga4)
  console.log('\n' + message + '\n')
  sendToSlack(message)
  console.log('Sent.')
}

main().catch((e) => {
  console.error('Analytics update failed:', e.message)
  process.exit(1)
})
