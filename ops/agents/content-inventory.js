#!/usr/bin/env node
// Content Inventory Check — Buffer queue check, DM George if low
//
// Runs daily at 6am UTC. Counts posts scheduled in the next 7 days.
// If fewer than 4, DMs George to record more videos.
//
// Cron: 0 6 * * * node ops/agents/content-inventory.js
//
// Required env vars: BUFFER_TOKEN, SLACK_BOT_TOKEN, SLACK_USER_ID

import https from 'https';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const lines = readFileSync(resolve(__dir, '../.env'), 'utf-8').split('\n');
    for (const line of lines) {
      const [k, ...rest] = line.split('=');
      if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
    }
  } catch { /* rely on systemd env */ }
}
loadEnv();

const BUFFER_TOKEN  = process.env.BUFFER_TOKEN;
const SLACK_TOKEN   = process.env.SLACK_BOT_TOKEN;
const SLACK_USER_ID = process.env.SLACK_USER_ID || 'U0AETR5UK4Y';

// YouTube and Instagram channel IDs
const CHANNEL_IDS = [
  '69b7df3d7be9f8b1715f313c', // YouTube
  '69b7de067be9f8b1715f2df4', // Instagram
];

function httpreq(options, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: null, raw }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

async function getBufferQueue(channelId) {
  const res = await httpreq({
    hostname: 'api.bufferapp.com',
    path: `/1/profiles/${channelId}/updates/pending.json?count=100&access_token=${BUFFER_TOKEN}`,
  });
  if (res.status !== 200) return [];
  return res.body?.updates || [];
}

async function slackDM(text) {
  const body = JSON.stringify({ channel: SLACK_USER_ID, text });
  await httpreq({
    hostname: 'slack.com',
    path: '/api/chat.postMessage',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
}

async function main() {
  const now = Date.now();
  const sevenDays = now + 7 * 24 * 60 * 60 * 1000;

  // Count unique dates covered in the next 7 days across all channels
  const coveredDates = new Set();

  for (const channelId of CHANNEL_IDS) {
    try {
      const updates = await getBufferQueue(channelId);
      for (const u of updates) {
        const due = (u.due_at || u.scheduled_at) * 1000;
        if (due >= now && due <= sevenDays) {
          coveredDates.add(new Date(due).toISOString().slice(0, 10));
        }
      }
    } catch (e) {
      console.error(`[inventory] Failed to get Buffer queue for ${channelId}:`, e.message);
    }
  }

  console.log(`[inventory] Covered dates in next 7 days: ${coveredDates.size}`);

  if (coveredDates.size < 4) {
    const missing = 4 - coveredDates.size;
    await slackDM(
      `*Content queue is running low.* Only ${coveredDates.size} of the next 7 days have posts scheduled.\n\nRecord ${missing} more video${missing > 1 ? 's' : ''} and drop them in your Google Drive "George Approved" folder.`
    );
    console.log('[inventory] Low queue alert sent to Slack');
  } else {
    console.log('[inventory] Queue looks healthy. No action needed.');
  }
}

main().catch(err => {
  console.error('[inventory] Fatal:', err.message);
  process.exit(1);
});
