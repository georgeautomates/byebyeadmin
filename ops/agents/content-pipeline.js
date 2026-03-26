#!/usr/bin/env node
// Content Pipeline — Drive → Whisper → Claude → Slack approval → Buffer + Sheets
//
// Runs twice daily via cron (9am + 5pm UTC). Picks one unprocessed video from
// the "George Approved" Drive folder, transcribes it, generates copy options,
// and DMs George on Slack for approval. On approval (handled by slack-listener.js),
// posts drafts to Buffer and logs to Google Sheets.
//
// Cron: 0 9,17 * * * node ops/agents/content-pipeline.js
//
// Required env vars:
//   OPENAI_API_KEY, ANTHROPIC_API_KEY, SLACK_BOT_TOKEN, SLACK_USER_ID
//   GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN
//   BUFFER_TOKEN, GOOGLE_DRIVE_FOLDER_ID, GOOGLE_CONTENT_SHEET_ID

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { execFileSync } from 'child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env ────────────────────────────────────────────────
function loadEnv() {
  try {
    const lines = fs.readFileSync(path.resolve(__dir, '../.env'), 'utf-8').split('\n');
    for (const line of lines) {
      const [k, ...rest] = line.split('=');
      if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
    }
  } catch { /* rely on systemd env */ }
}
loadEnv();

const OPENAI_API_KEY        = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY     = process.env.ANTHROPIC_API_KEY;
const SLACK_BOT_TOKEN       = process.env.SLACK_BOT_TOKEN;
const SLACK_USER_ID         = process.env.SLACK_USER_ID || 'U0AETR5UK4Y';
const GOOGLE_CLIENT_ID      = process.env.GOOGLE_DRIVE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET  = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN  = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const BUFFER_TOKEN          = process.env.BUFFER_TOKEN;
const DRIVE_FOLDER_ID       = process.env.GOOGLE_DRIVE_FOLDER_ID || '1GAFZIXRoghF5sgr2mxEc6OariPrK-HBY';
const CONTENT_SHEET_ID      = process.env.GOOGLE_CONTENT_SHEET_ID || '1Wx7J-m97iyXnK4_XxvtaAdnXW-FpB77hQI91mw4Lo7c';
const LISTENER_PORT         = parseInt(process.env.SLACK_LISTENER_PORT || '3001');

// ── Helpers ──────────────────────────────────────────────────
function req(options, body) {
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

function log(msg) { console.log(`[content-pipeline] ${msg}`); }

// ── Google OAuth ─────────────────────────────────────────────
let _googleToken = null;
let _tokenExpiry = 0;

async function getGoogleToken() {
  if (_googleToken && Date.now() < _tokenExpiry - 60000) return _googleToken;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: GOOGLE_REFRESH_TOKEN,
  }).toString();

  const res = await req({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);

  if (!res.body?.access_token) throw new Error(`Google token refresh failed: ${res.raw}`);
  _googleToken = res.body.access_token;
  _tokenExpiry = Date.now() + (res.body.expires_in * 1000);
  return _googleToken;
}

// ── Google Drive: list files in folder ───────────────────────
async function listDriveFiles() {
  const token = await getGoogleToken();
  const query = encodeURIComponent(`'${DRIVE_FOLDER_ID}' in parents and trashed = false`);
  const res = await req({
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,createdTime)&pageSize=50&includeItemsFromAllDrives=true&supportsAllDrives=true`,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) throw new Error(`Drive list failed (${res.status}): ${res.raw.slice(0, 200)}`);
  return res.body.files || [];
}

// ── Google Sheets: read a tab ────────────────────────────────
async function readSheet(sheetId, tab) {
  const token = await getGoogleToken();
  const range = encodeURIComponent(`${tab}!A:Z`);
  const res = await req({
    hostname: 'sheets.googleapis.com',
    path: `/v4/spreadsheets/${sheetId}/values/${range}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) throw new Error(`Sheets read failed (${res.status}): ${res.raw.slice(0, 200)}`);
  return res.body.values || [];
}

// ── Google Sheets: append rows ───────────────────────────────
async function appendSheet(sheetId, tab, values) {
  const token = await getGoogleToken();
  const range = encodeURIComponent(`${tab}!A1`);
  const body = JSON.stringify({ values });
  const res = await req({
    hostname: 'sheets.googleapis.com',
    path: `/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (res.status !== 200) throw new Error(`Sheets append failed (${res.status}): ${res.raw.slice(0, 200)}`);
  return res.body;
}

// ── Google Drive: download file ──────────────────────────────
async function downloadDriveFile(fileId, destPath) {
  const token = await getGoogleToken();
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      path: `/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      headers: { Authorization: `Bearer ${token}` },
    };
    const fileStream = createWriteStream(destPath);
    https.get(options, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Follow redirect
        const url = new URL(res.headers.location);
        https.get({ hostname: url.hostname, path: url.pathname + url.search, headers: { Authorization: `Bearer ${token}` } }, (res2) => {
          res2.pipe(fileStream);
          fileStream.on('finish', () => fileStream.close(resolve));
          res2.on('error', reject);
        }).on('error', reject);
      } else {
        res.pipe(fileStream);
        fileStream.on('finish', () => fileStream.close(resolve));
        res.on('error', reject);
      }
    }).on('error', reject);
  });
}

// ── Whisper transcription (via curl to avoid OOM on large files) ─
function transcribe(filePath) {
  // Use curl to stream the file directly — avoids loading 300MB into JS heap
  const result = execFileSync('curl', [
    '-s',
    'https://api.openai.com/v1/audio/transcriptions',
    '-H', `Authorization: Bearer ${OPENAI_API_KEY}`,
    '-F', `file=@${filePath}`,
    '-F', 'model=whisper-1',
    '-F', 'response_format=json',
  ], { maxBuffer: 10 * 1024 * 1024, timeout: 600000 }); // 10 min timeout

  const data = JSON.parse(result.toString());
  if (!data.text) throw new Error(`Whisper failed: ${result.toString().slice(0, 300)}`);
  return data.text;
}

// ── Fetch few-shot examples from Sheets ──────────────────────
async function getFewShotExamples() {
  try {
    const rows = await readSheet(CONTENT_SHEET_ID, 'Raw Transcripts');
    if (rows.length <= 1) return '';
    // Last 5 rows: [Date, File, Transcript, Title, IG Caption, LinkedIn, YT Description, Selected Title, Selected IG]
    const examples = rows.slice(-5).filter(r => r[7] && r[8]).map(r => (
      `Transcript snippet: "${(r[2] || '').slice(0, 300)}..."\nSelected title: ${r[7]}\nSelected IG: ${r[8]}`
    ));
    return examples.join('\n\n');
  } catch { return ''; }
}

// ── Claude content generation ────────────────────────────────
async function generateContent(transcript, fewShot) {
  const systemPrompt = `You are a social media content writer for ByeByeAdmin, a UK haulage AI automation company. Write in George Spain-Warner's voice: confident, straight-talking, peer-to-peer. No buzzwords, no hype. Uses haulage industry terms naturally (TMS, PODs, tachograph, O-licence, FORS, driver checks). Short punchy sentences. Specific numbers over vague claims. No em dashes.`;

  const userPrompt = `Based on this video transcript, generate social media copy options.

TRANSCRIPT:
${transcript}

${fewShot ? `EXAMPLES OF GEORGE'S APPROVED STYLE:\n${fewShot}\n` : ''}

Generate:
1. THREE YouTube title options (max 70 chars each, punchy, specific)
2. TWO Instagram captions (hook line first, 150-300 chars, no hashtags spam, max 3 relevant hashtags)
3. ONE LinkedIn post (2-4 short paragraphs, industry insight angle, ends with a specific question)
4. ONE YouTube description (150-200 words, includes timestamps if relevant, 3-5 hashtags at end)

Format your response as JSON:
{
  "titles": ["title1", "title2", "title3"],
  "igCaptions": ["caption1", "caption2"],
  "linkedinPost": "...",
  "ytDescription": "..."
}`;

  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const res = await req({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (res.status !== 200) throw new Error(`Claude failed (${res.status}): ${res.raw.slice(0, 300)}`);

  const text = res.body.content?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Claude returned no JSON: ${text.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]);
}

// ── Calculate next schedule date (every other day, 1 week ahead) ─
function getScheduleDate() {
  // Every-other-day pattern: Mon, Wed, Fri, Sun, Tue, Thu, Sat
  // Find the next slot that is ~7 days from now
  const target = new Date();
  target.setDate(target.getDate() + 7);
  // Adjust to nearest even day offset (every other day from Jan 1)
  const dayOfYear = Math.floor((target - new Date(target.getFullYear(), 0, 0)) / 86400000);
  if (dayOfYear % 2 !== 0) target.setDate(target.getDate() + 1);
  target.setUTCHours(12, 0, 0, 0); // noon UTC
  return target.toISOString();
}

// ── Slack: send DM to George ──────────────────────────────────
async function slackDM(text) {
  const body = JSON.stringify({ channel: SLACK_USER_ID, text });
  const res = await req({
    hostname: 'slack.com',
    path: '/api/chat.postMessage',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (!res.body?.ok) throw new Error(`Slack DM failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

// ── Register pending approval with slack-listener ────────────
function registerApproval(data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const r = http.request({
      hostname: '127.0.0.1',
      port: LISTENER_PORT,
      path: '/register-approval',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  log('Starting content pipeline run');

  // 1. Get list of processed files
  log('Reading processed videos sheet...');
  let processedIds = new Set();
  try {
    const rows = await readSheet(CONTENT_SHEET_ID, 'Processed Videos');
    processedIds = new Set(rows.slice(1).map(r => (r[0] || '').trim()).filter(Boolean));
    log(`Found ${processedIds.size} already-processed files`);
  } catch (e) {
    log(`Warning: could not read Processed Videos tab: ${e.message}`);
  }

  // 2. List Drive files
  log('Listing Drive files...');
  const driveFiles = await listDriveFiles();
  const videoExts = /\.(mp4|mov|avi|mkv|webm|m4v)$/i;
  const newFiles = driveFiles.filter(f => videoExts.test(f.name) && !processedIds.has(f.id));

  if (newFiles.length === 0) {
    log('No new video files found. Done.');
    return;
  }

  // Process one file per run
  const file = newFiles[0];
  log(`Processing: ${file.name} (${file.id})`);

  // 3. Download
  const tmpPath = `/tmp/bba-video-${file.id}${path.extname(file.name)}`;
  log(`Downloading to ${tmpPath}...`);
  await downloadDriveFile(file.id, tmpPath);
  log(`Downloaded (${Math.round(fs.statSync(tmpPath).size / 1024 / 1024)}MB)`);

  // 4. Transcribe
  log('Transcribing with Whisper...');
  const transcript = await transcribe(tmpPath);
  log(`Transcript: ${transcript.slice(0, 100)}...`);
  fs.unlinkSync(tmpPath);

  // 5. Few-shot examples
  const fewShot = await getFewShotExamples();

  // 6. Generate content
  log('Generating content with Claude...');
  const options = await generateContent(transcript, fewShot);
  log('Content generated');

  // 7. Calculate schedule date
  const scheduleDate = getScheduleDate();
  const scheduleDateStr = new Date(scheduleDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  // 8. Build approval token
  const token = Math.random().toString(36).slice(2, 10);

  // 9. Send Slack message
  const msg = [
    `*New video ready for approval:* \`${file.name}\``,
    '',
    `*Titles:*`,
    options.titles.map((t, i) => `  ${i + 1}. ${t}`).join('\n'),
    '',
    `*Instagram captions:*`,
    options.igCaptions.map((c, i) => `  ${i + 1}. ${c}`).join('\n\n'),
    '',
    `*LinkedIn:* ${options.linkedinPost.slice(0, 120)}...`,
    '',
    `*Schedules for:* ${scheduleDateStr}`,
    '',
    `Reply: \`title [1-3], ig [1-2]\` to approve  |  \`title [n], ig [n], li\` to include LinkedIn  |  \`skip\` to dismiss`,
  ].join('\n');

  log('Sending Slack approval message...');
  await slackDM(msg);

  // 10. Register with slack-listener (include transcription for Sheets logging on approval)
  await registerApproval({
    token,
    filename: file.name,
    driveFileId: file.id,
    transcript,
    options,
    scheduleDate,
  });

  log(`Approval registered (token: ${token}). Waiting for George.`);
}

main().catch(err => {
  console.error('[content-pipeline] Fatal:', err.message);
  process.exit(1);
});
