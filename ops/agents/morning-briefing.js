#!/usr/bin/env node
// BBA Morning Briefing
// Daily performance update: Outreach + Website (GA4 + Clarity tip) + Content (YT + IG + FB)
// Cron: 0 8 * * 1-5  (8:00 AM UTC Mon-Fri, = 8am GMT / 9am BST)

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load .env ────────────────────────────────────────────────
function loadEnv() {
  try {
    const lines = readFileSync(resolve(__dir, "../.env"), "utf-8").split("\n");
    for (const line of lines) {
      const [k, ...rest] = line.split("=");
      if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
    }
  } catch {
    // rely on actual env vars
  }
}
loadEnv();

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "527598212";
const GMAIL_CLIENT_ID = "698251746508-3q6ah4t7hb56uit827gae055deb8f0rj.apps.googleusercontent.com";
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const CLARITY_API_TOKEN = process.env.CLARITY_API_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SLACK_USER_ID = process.env.SLACK_USER_ID || "U0AETR5UK4Y";

// ── Date helpers ─────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ── Instantly: campaign analytics ───────────────────────────
async function getInstantlyStats() {
  try {
    const BASE = "https://api.instantly.ai/api/v2";
    const headers = { Authorization: `Bearer ${INSTANTLY_API_KEY}` };

    const listRes = await fetch(`${BASE}/campaigns?limit=50`, { headers });
    if (!listRes.ok) throw new Error(`list ${listRes.status}`);
    const listData = await listRes.json();
    const campaigns = listData.items ?? listData ?? [];

    if (campaigns.length === 0) return { sent: 0, opens: 0, replies: 0, openRate: "0.0", replyRate: "0.0", ok: true };

    let sent = 0, opens = 0, replies = 0;
    await Promise.all(
      campaigns.map(async (c) => {
        try {
          const r = await fetch(`${BASE}/campaigns/analytics/overview?id=${c.id}`, { headers });
          if (!r.ok) return;
          const d = await r.json();
          sent += d.total_sent ?? d.sent ?? 0;
          opens += d.total_opened ?? d.opens ?? d.total_opens ?? 0;
          replies += d.total_replied ?? d.replies ?? d.total_replies ?? 0;
        } catch {}
      })
    );

    const openRate = sent > 0 ? ((opens / sent) * 100).toFixed(1) : "0.0";
    const replyRate = sent > 0 ? ((replies / sent) * 100).toFixed(1) : "0.0";
    return { sent, opens, replies, openRate, replyRate, ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Google OAuth: get access token ───────────────────────────
async function getGoogleAccessToken() {
  if (!GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("GMAIL_CLIENT_SECRET or GMAIL_REFRESH_TOKEN not set");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── GA4: yesterday sessions + assessment views ────────────────
async function getGA4Stats() {
  try {
    const accessToken = await getGoogleAccessToken();
    const yesterday = daysAgo(1);

    const sessionsRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: yesterday, endDate: yesterday }],
          metrics: [{ name: "sessions" }],
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
        }),
      }
    );

    if (!sessionsRes.ok) {
      const err = await sessionsRes.text();
      throw new Error(`GA4 ${sessionsRes.status}: ${err}`);
    }

    const sessionsData = await sessionsRes.json();
    const rows = sessionsData.rows ?? [];
    let totalSessions = 0;
    let topSource = "unknown";
    let topSourceSessions = 0;

    for (const row of rows) {
      const n = parseInt(row.metricValues?.[0]?.value ?? 0);
      totalSessions += n;
      const channel = row.dimensionValues?.[0]?.value ?? "unknown";
      if (n > topSourceSessions) {
        topSourceSessions = n;
        topSource = channel;
      }
    }

    const funnelRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: yesterday, endDate: yesterday }],
          metrics: [{ name: "screenPageViews" }],
          dimensions: [{ name: "pagePath" }],
          dimensionFilter: {
            filter: {
              fieldName: "pagePath",
              stringFilter: { matchType: "BEGINS_WITH", value: "/assessment" },
            },
          },
        }),
      }
    );

    let assessmentViews = 0;
    if (funnelRes.ok) {
      const funnelData = await funnelRes.json();
      for (const row of funnelData.rows ?? []) {
        assessmentViews += parseInt(row.metricValues?.[0]?.value ?? 0);
      }
    }

    return { sessions: totalSessions, topSource, assessmentViews, ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Clarity: yesterday's data + LLM tip ──────────────────────
async function getClarityTip() {
  if (!CLARITY_API_TOKEN) return { ok: false, error: "CLARITY_API_TOKEN not set" };

  try {
    const res = await fetch("https://clarity.microsoft.com/mcp/dashboard/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLARITY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "Sessions, scroll depth percentage and rage clicks by page URL for yesterday. Filter out bot traffic.",
        timezone: "Europe/London",
      }),
    });

    if (!res.ok) throw new Error(`Clarity ${res.status}`);
    const data = await res.json();

    const summary = JSON.stringify(data).slice(0, 1500);

    if (!GEMINI_API_KEY) return { ok: true, tip: null };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Here is yesterday's Microsoft Clarity data for byebyeadmin.co.uk: ${summary}\n\nGive me ONE specific actionable UX improvement in 2 sentences max. Be direct. No preamble, no "Based on the data".`,
            }],
          }],
          generationConfig: { maxOutputTokens: 100 },
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const tip = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    return { ok: true, tip };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── YouTube: channel statistics ──────────────────────────────
async function getYouTubeStats() {
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YOUTUBE_CHANNEL_ID}&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const stats = data.items?.[0]?.statistics ?? {};
    return {
      subscribers: parseInt(stats.subscriberCount ?? 0).toLocaleString(),
      views: parseInt(stats.viewCount ?? 0).toLocaleString(),
      ok: true,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Format message ───────────────────────────────────────────
function formatBriefing(instantly, ga4, clarity, youtube) {
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const lines = [`*BBA Morning Briefing — ${date}*`, ""];

  // Outreach
  if (instantly.ok) {
    lines.push("*Outreach (yesterday)*");
    lines.push(`Sent: ${instantly.sent.toLocaleString()} | Opens: ${instantly.openRate}% | Replies: ${instantly.replyRate}%`);
    if (instantly.replies > 0) lines.push(`New replies: ${instantly.replies}`);
  } else {
    lines.push(`Outreach: unavailable (${instantly.error})`);
  }

  lines.push("");

  // Website
  if (ga4.ok) {
    lines.push("*Website (yesterday — GA4)*");
    lines.push(`Sessions: ${ga4.sessions.toLocaleString()} | Top source: ${ga4.topSource}`);
    if (ga4.assessmentViews > 0) lines.push(`Assessment views: ${ga4.assessmentViews}`);
  } else {
    lines.push(`Website: unavailable (${ga4.error})`);
  }

  lines.push("");

  // Content
  lines.push("*Content*");
  if (youtube.ok) {
    lines.push(`YouTube: ${youtube.subscribers} subs | ${youtube.views} total views`);
  } else {
    lines.push(`YouTube: unavailable (${youtube.error})`);
  }
  lines.push("");

  // Site tip
  if (clarity.ok && clarity.tip) {
    lines.push("*Site tip (Clarity)*");
    lines.push(clarity.tip);
  } else if (clarity.ok && !clarity.tip) {
    lines.push("*Site tip (Clarity)*");
    lines.push("Tip unavailable — Clarity data fetched but LLM generation failed.");
  } else if (!clarity.ok && clarity.error && !clarity.error.includes("not set")) {
    lines.push(`Clarity: unavailable (${clarity.error})`);
  }

  return lines.join("\n");
}

// ── Send to Slack ─────────────────────────────────────────────
async function sendToSlack(message) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: SLACK_USER_ID, text: message }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("Fetching briefing data...");
  const [instantly, ga4, clarity, youtube] = await Promise.all([
    getInstantlyStats(),
    getGA4Stats(),
    getClarityTip(),
    getYouTubeStats(),
  ]);

  const message = formatBriefing(instantly, ga4, clarity, youtube);
  console.log("\n" + message + "\n");
  await sendToSlack(message);
  console.log("Sent.");
}

main().catch((e) => {
  console.error("Briefing failed:", e.message);
  process.exit(1);
});
