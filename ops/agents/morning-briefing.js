#!/usr/bin/env node
// BBA Morning Briefing
// Pulls Instantly campaign stats + YouTube stats, sends to Slack via OpenClaw
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
const SLACK_USER_ID = process.env.SLACK_USER_ID || "U0AETR5UK4Y";

// ── Date helpers ─────────────────────────────────────────────
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ── Instantly: campaign analytics ───────────────────────────
async function getInstantlyStats() {
  try {
    const BASE = "https://api.instantly.ai/api/v2";
    const headers = { Authorization: `Bearer ${INSTANTLY_API_KEY}` };

    // List all campaigns
    const listRes = await fetch(`${BASE}/campaigns?limit=50`, { headers });
    if (!listRes.ok) throw new Error(`list ${listRes.status}`);
    const listData = await listRes.json();
    const campaigns = listData.items ?? listData ?? [];

    if (campaigns.length === 0) return { sent: 0, opens: 0, replies: 0, openRate: "0.0", replyRate: "0.0", ok: true };

    // Fetch analytics for each campaign and aggregate
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
      videos: stats.videoCount ?? 0,
      ok: true,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Format message ───────────────────────────────────────────
function formatBriefing(instantly, youtube) {
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const lines = [`*BBA Morning Briefing — ${date}*`, ""];

  // Outreach
  if (instantly.ok) {
    lines.push("*Outreach (yesterday)*");
    lines.push(`Sent: ${instantly.sent} | Opens: ${instantly.openRate}% | Replies: ${instantly.replyRate}%`);
    if (instantly.replies > 0) lines.push(`New replies: ${instantly.replies}`);
  } else {
    lines.push(`Outreach: unavailable (${instantly.error})`);
  }

  lines.push("");

  // YouTube
  if (youtube.ok) {
    lines.push("*YouTube*");
    lines.push(`Subscribers: ${youtube.subscribers} | Total views: ${youtube.views}`);
  } else {
    lines.push(`YouTube: unavailable (${youtube.error})`);
  }

  lines.push("");
  lines.push("_GA4 + Instagram coming soon_");

  return lines.join("\n");
}

// ── Send to Slack directly via bot token ──────────────────────
async function sendToSlack(message) {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel: SLACK_USER_ID, text: message }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`Slack error: ${data.error}`)
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("Fetching briefing data...");
  const [instantly, youtube] = await Promise.all([
    getInstantlyStats(),
    getYouTubeStats(),
  ]);

  const message = formatBriefing(instantly, youtube);
  console.log("\n" + message + "\n");
  await sendToSlack(message);
  console.log("Sent.");
}

main().catch((e) => {
  console.error("Briefing failed:", e.message);
  process.exit(1);
});
