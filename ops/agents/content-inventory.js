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

// Buffer organization + channel IDs
const ORG_ID    = '69b7dc8e9ab93fdee82b1f6e';
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
        try { resolve({ status: res.statusCode, body: JSON.parse(raw), raw }); }
        catch { resolve({ status: res.statusCode, body: null, raw }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

async function getScheduledPosts() {
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const query = `
    query GetPosts($input: PostsInput!) {
      posts(input: $input, first: 100) {
        edges { node { id dueAt } }
      }
    }
  `;
  const variables = {
    input: {
      organizationId: ORG_ID,
      filter: {
        channelIds: CHANNEL_IDS,
        status: ['scheduled'],
        dueAt: { start: now.toISOString(), end: sevenDays.toISOString() },
      },
    },
  };
  const body = JSON.stringify({ query, variables });
  const res = await httpreq({
    hostname: 'api.buffer.com',
    path: '/graphql',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BUFFER_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (res.status !== 200) {
    console.error(`[inventory] Buffer GraphQL HTTP ${res.status}: ${(res.raw || '').slice(0, 200)}`);
    return [];
  }
  if (res.body?.errors) {
    console.error(`[inventory] Buffer GraphQL errors: ${JSON.stringify(res.body.errors).slice(0, 200)}`);
    return [];
  }
  return res.body?.data?.posts?.edges?.map(e => e.node) || [];
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
  // Count unique dates covered in the next 7 days across all channels
  const coveredDates = new Set();

  try {
    const posts = await getScheduledPosts();
    for (const p of posts) {
      if (p.dueAt) coveredDates.add(p.dueAt.slice(0, 10));
    }
  } catch (e) {
    console.error('[inventory] Failed to get Buffer scheduled posts:', e.message);
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
