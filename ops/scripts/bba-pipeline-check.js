/**
 * BBA Pipeline Check
 * Runs at 9am and 5pm UTC daily via VPS cron.
 * Also called by slack-router.js for approvals and skips.
 *
 * Modes:
 *   node bba-pipeline-check.js --check
 *   node bba-pipeline-check.js --approve "title 2, ig 1" [run_id]
 *   node bba-pipeline-check.js --approve "title 2, ig 1, li" [run_id]
 *   node bba-pipeline-check.js --skip [run_id]
 */

import https from 'https';
import http from 'http';
import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── env ───────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = '/home/openclaw/byebyeadmin/ops/.env';
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const GEORGE         = 'U0AETR5UK4Y';
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const SLACK_TOKEN    = process.env.SLACK_BOT_TOKEN;
const OPENAI_KEY     = process.env.OPENAI_API_KEY;
const BUFFER_TOKEN   = process.env.BUFFER_TOKEN;
const GCP_CLIENT_ID  = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
const GCP_SECRET     = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
const GCP_REFRESH    = process.env.GOOGLE_REFRESH_TOKEN;
const SHEET_ID       = process.env.GOOGLE_CONTENT_SHEET_ID;
const DRIVE_FOLDER   = process.env.GOOGLE_DRIVE_FOLDER_ID;

// ── http helpers ──────────────────────────────────────────────────────────────

function request(urlStr, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers,
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function getJson(url, headers = {}) {
  try { return await request(url, { headers }); }
  catch (e) { console.error(`GET ${url.slice(0, 60)} failed:`, e.message); return {}; }
}

async function postJson(url, body, headers = {}) {
  const bodyStr = JSON.stringify(body);
  try {
    return await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers },
      body: bodyStr,
    });
  } catch (e) { console.error(`POST ${url.slice(0, 60)} failed:`, e.message); return {}; }
}

async function postForm(url, data) {
  const body = new URLSearchParams(data).toString();
  try {
    return await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      body,
    });
  } catch (e) { console.error(`POST form ${url.slice(0, 60)} failed:`, e.message); return {}; }
}

// ── GCP token ─────────────────────────────────────────────────────────────────

async function getGcpToken() {
  const resp = await postForm('https://oauth2.googleapis.com/token', {
    client_id: GCP_CLIENT_ID, client_secret: GCP_SECRET,
    refresh_token: GCP_REFRESH, grant_type: 'refresh_token',
  });
  return resp.access_token || '';
}

// ── Slack ─────────────────────────────────────────────────────────────────────

async function slackDm(text) {
  const r = await postJson(
    'https://slack.com/api/chat.postMessage',
    { channel: GEORGE, text },
    { Authorization: `Bearer ${SLACK_TOKEN}` }
  );
  if (!r.ok) console.error('Slack error:', JSON.stringify(r));
  return r;
}

// ── LLM (Anthropic → Gemini fallback) ─────────────────────────────────────────

async function callLlm(prompt, maxTokens = 1500) {
  // Try Anthropic first
  const resp = await postJson(
    'https://api.anthropic.com/v1/messages',
    { model: 'claude-sonnet-4-6', max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }] },
    { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }
  );
  const text = resp?.content?.[0]?.text;
  if (text) return text;

  // Fall back to Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const gr = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } },
      {}
    );
    const gtext = gr?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (gtext) return gtext;
    console.error('Gemini failed — trying OpenAI');
  }
  // Fall back to OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return '';
  const or = await postJson(
    'https://api.openai.com/v1/chat/completions',
    { model: 'gpt-4o-mini', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
    { Authorization: `Bearer ${openaiKey}` }
  );
  return or?.choices?.[0]?.message?.content || '';
}

// ── Sheets helpers ────────────────────────────────────────────────────────────

async function sheetsGet(token, range) {
  return getJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`,
    { Authorization: `Bearer ${token}` }
  );
}

async function sheetsAppend(token, range, values) {
  return postJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    { values },
    { Authorization: `Bearer ${token}` }
  );
}

async function sheetsUpdate(token, range, values) {
  const body = JSON.stringify({ values });
  return request(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Authorization: `Bearer ${token}` },
      body }
  );
}

// Column order: run_id | filename | drive_file_id | schedule_date | title_1 | title_2 | title_3 | ig_1 | ig_2 | linkedin | yt_description | transcript | status
const COL = { run_id:0, filename:1, drive_file_id:2, schedule_date:3, title_1:4, title_2:5, title_3:6, ig_1:7, ig_2:8, linkedin:9, yt_description:10, transcript:11, status:12 };

async function getPendingApprovals(token) {
  const data = await sheetsGet(token, 'Pending Approvals!A:M');
  const rows = data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((r, i) => ({ rowIndex: i + 2, data: r }));
}

function scheduleDate() {
  // Next available weekday at 10am UK time (approximated as UTC+1)
  const d = new Date();
  d.setUTCHours(10, 0, 0, 0);
  if (d.getTime() < Date.now() + 3600000) d.setUTCDate(d.getUTCDate() + 1);
  // Skip weekends
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10) + 'T10:00:00';
}

// ── Buffer helpers ─────────────────────────────────────────────────────────────

let _bufferProfiles = null;
async function getBufferProfiles() {
  if (_bufferProfiles) return _bufferProfiles;
  const resp = await getJson(`https://api.bufferapp.com/1/profiles.json?access_token=${BUFFER_TOKEN}`);
  _bufferProfiles = Array.isArray(resp) ? resp : [];
  return _bufferProfiles;
}

async function bufferPost(serviceType, text, scheduledAt) {
  const profiles = await getBufferProfiles();
  const profile = profiles.find(p => p.service?.toLowerCase().includes(serviceType));
  if (!profile) { console.error(`No Buffer profile found for: ${serviceType}`); return null; }

  const schedTs = Math.floor(new Date(scheduledAt).getTime() / 1000);
  const params = new URLSearchParams({
    access_token: BUFFER_TOKEN,
    profile_ids: profile.id,
    text,
    scheduled_at: String(schedTs),
    now: 'false',
    top: 'false',
  });
  const body = params.toString();
  return request('https://api.bufferapp.com/1/updates/create.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
}

// ── PIPELINE CHECK ────────────────────────────────────────────────────────────

async function runCheck() {
  console.log('Pipeline check starting...');
  const token = await getGcpToken();
  if (!token) { console.error('No GCP token'); return; }

  // 1. Check for pending approvals
  const pending = await getPendingApprovals(token);
  const awaiting = pending.find(r => r.data[COL.status] === 'awaiting');
  if (awaiting) {
    console.log('Pending approval found — skipping check.');
    return;
  }

  // 2. List Drive files
  console.log('Scanning Drive folder...');
  const driveResp = await getJson(
    `https://www.googleapis.com/drive/v3/files?q='${DRIVE_FOLDER}'+in+parents+and+trashed=false&fields=files(id,name,createdTime,mimeType)&orderBy=createdTime&pageSize=50`,
    { Authorization: `Bearer ${token}` }
  );
  const allFiles = driveResp.files || [];
  const videoFiles = allFiles.filter(f =>
    f.mimeType?.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(f.name)
  );

  // 3. Get processed IDs
  const processedData = await sheetsGet(token, 'Processed Videos!A:E');
  const processedIds = new Set((processedData.values || []).slice(1).map(r => r[0]).filter(Boolean));

  // 4. Pick oldest unprocessed
  const unprocessed = videoFiles.filter(f => !processedIds.has(f.id));
  if (unprocessed.length === 0) {
    console.log('No new videos.');
    await slackDm('No new videos to process.');
    return;
  }
  const video = unprocessed[0];
  console.log(`Processing: ${video.name}`);

  // 5. Download
  const tmpVideo = `/tmp/${video.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const tmpAudio = tmpVideo.replace(/\.[^.]+$/, '.mp3');
  console.log(`Downloading to ${tmpVideo}...`);
  execSync(
    `curl -s -L "https://www.googleapis.com/drive/v3/files/${video.id}?alt=media" ` +
    `-H "Authorization: Bearer ${token}" -o "${tmpVideo}"`,
    { stdio: 'pipe' }
  );

  // 6. Extract audio
  console.log('Extracting audio...');
  execSync(`ffmpeg -i "${tmpVideo}" -vn -acodec libmp3lame -q:a 4 "${tmpAudio}" -y 2>/dev/null`, { stdio: 'pipe' });

  // 7. Whisper transcription
  console.log('Transcribing...');
  const whisperResp = execSync(
    `curl -s https://api.openai.com/v1/audio/transcriptions ` +
    `-H "Authorization: Bearer ${OPENAI_KEY}" ` +
    `-F file=@"${tmpAudio}" -F model=whisper-1`
  ).toString();
  let transcript = '';
  try { transcript = JSON.parse(whisperResp).text || ''; }
  catch { console.error('Whisper parse error:', whisperResp.slice(0, 200)); }

  // Cleanup tmp files
  try { fs.unlinkSync(tmpVideo); fs.unlinkSync(tmpAudio); } catch {}

  if (!transcript) {
    await slackDm(`:warning: Transcription failed for ${video.name}. Check cron.log.`);
    return;
  }

  // 8. Generate content with Claude
  console.log('Generating content...');

  // Read brand context
  let voiceMd = '', icpMd = '', captionMd = '';
  try { voiceMd = fs.readFileSync('/home/openclaw/byebyeadmin/ops/brand-context/voice.md', 'utf8').slice(0, 2000); } catch {}
  try { icpMd = fs.readFileSync('/home/openclaw/byebyeadmin/ops/brand-context/icp.md', 'utf8').slice(0, 1500); } catch {}
  try { captionMd = fs.readFileSync('/home/openclaw/byebyeadmin/ops/skills/caption-writing.md', 'utf8').slice(0, 2000); } catch {}

  const contentPrompt = `Generate content for a ByeByeAdmin YouTube video based on this transcript.

VOICE RULES:
${voiceMd}

ICP:
${icpMd}

CAPTION RULES:
${captionMd}

TRANSCRIPT:
${transcript.slice(0, 4000)}

Output EXACTLY this JSON (no other text):
{
  "title_1": "...",
  "title_2": "...",
  "title_3": "...",
  "ig_1": "...",
  "ig_2": "...",
  "linkedin": "...",
  "yt_description": "..."
}

Rules:
- YouTube titles: punchy, under 60 chars each, no clickbait, no em dashes
- Instagram captions: hook + body + 3-5 hashtags, no em dashes
- LinkedIn: professional, 2-3 short paragraphs, no em dashes
- YouTube description: 2-3 sentences + hashtags`;

  const raw = await callLlm(contentPrompt, 1500);
  let content = {};
  try {
    const jsonMatch = raw.match(/\{[\s\S]+\}/);
    content = JSON.parse(jsonMatch?.[0] || raw);
  } catch { console.error('Content parse error:', raw.slice(0, 200)); }

  const { title_1='', title_2='', title_3='', ig_1='', ig_2='', linkedin='', yt_description='' } = content;

  // 9. Write to Pending Approvals
  const runId = `${video.name.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40)}-${Date.now()}`;
  const schedDate = scheduleDate();
  await sheetsAppend(token, 'Pending Approvals!A:M', [[
    runId, video.name, video.id, schedDate,
    title_1, title_2, title_3, ig_1, ig_2, linkedin, yt_description,
    transcript.slice(0, 5000), 'awaiting',
  ]]);

  // 10. Send approval DM
  const msg = [
    `:clapper: *New content ready:* ${video.name}`,
    '',
    '*YouTube titles:*',
    `1. ${title_1}`,
    `2. ${title_2}`,
    `3. ${title_3}`,
    '',
    '*Instagram captions:*',
    `1. ${ig_1.slice(0, 120)}${ig_1.length > 120 ? '...' : ''}`,
    `2. ${ig_2.slice(0, 120)}${ig_2.length > 120 ? '...' : ''}`,
    '',
    'Reply: `title [n], ig [n]` (add `, li` for LinkedIn)',
    `_run_id: ${runId}_`,
  ].join('\n');

  await slackDm(msg);
  console.log('Approval DM sent.');
}

// ── APPROVAL ──────────────────────────────────────────────────────────────────

async function runApproval(approvalStr, runId = null) {
  console.log(`Processing approval: "${approvalStr}"`);
  const token = await getGcpToken();
  if (!token) { console.error('No GCP token'); return; }

  // Parse "title 2, ig 1" or "title 2, ig 1, li"
  const titleMatch = approvalStr.match(/title\s+(\d)/i);
  const igMatch    = approvalStr.match(/ig\s+(\d)/i);
  const wantLi     = /\bli\b/i.test(approvalStr);
  const titleN = titleMatch ? parseInt(titleMatch[1]) : 1;
  const igN    = igMatch    ? parseInt(igMatch[1])    : 1;

  // Find awaiting row
  const rows = await getPendingApprovals(token);
  let row;
  if (runId) {
    row = rows.find(r => r.data[COL.run_id] === runId && r.data[COL.status] === 'awaiting');
  }
  if (!row) {
    row = rows.find(r => r.data[COL.status] === 'awaiting');
  }
  if (!row) {
    await slackDm(':warning: No pending approval found to process.');
    return;
  }

  const d = row.data;
  const titles = [d[COL.title_1], d[COL.title_2], d[COL.title_3]];
  const igs    = [d[COL.ig_1], d[COL.ig_2]];
  const chosenTitle = titles[titleN - 1] || titles[0];
  const chosenIg    = igs[igN - 1]       || igs[0];
  const chosenLi    = d[COL.linkedin];
  const ytDesc      = d[COL.yt_description];
  const schedDate   = d[COL.schedule_date];
  const filename    = d[COL.filename];
  const driveFileId = d[COL.drive_file_id];
  const transcript  = d[COL.transcript] || '';
  const rowRunId    = d[COL.run_id];

  // Post to Buffer
  console.log('Posting to Buffer...');
  const ytText = `${chosenTitle}\n\n${ytDesc}`;
  await bufferPost('youtube', ytText, schedDate);
  await bufferPost('instagram', chosenIg, schedDate);
  if (wantLi && chosenLi) await bufferPost('linkedin', chosenLi, schedDate);

  const today = new Date().toISOString().slice(0, 10);

  // Append to Processed Videos
  await sheetsAppend(token, 'Processed Videos!A:E', [[driveFileId, filename, today, chosenTitle, chosenIg]]);

  // Append to Raw Transcripts
  await sheetsAppend(token, 'Raw Transcripts!A:C', [[filename, transcript, today]]);

  // Update Pending Approvals row status
  const statusRange = `Pending Approvals!M${row.rowIndex}`;
  await sheetsUpdate(token, statusRange, [['processed']]);

  // Confirm to Slack
  await slackDm(`:white_check_mark: Scheduled for ${schedDate.slice(0, 10)}: *${chosenTitle}*`);
  console.log('Approval processed.');
}

// ── SKIP ──────────────────────────────────────────────────────────────────────

async function runSkip(runId = null) {
  console.log('Processing skip...');
  const token = await getGcpToken();
  if (!token) return;

  const rows = await getPendingApprovals(token);
  let row = runId ? rows.find(r => r.data[COL.run_id] === runId && r.data[COL.status] === 'awaiting') : null;
  if (!row) row = rows.find(r => r.data[COL.status] === 'awaiting');
  if (!row) { await slackDm(':warning: No pending approval found to skip.'); return; }

  await sheetsUpdate(token, `Pending Approvals!M${row.rowIndex}`, [['skipped']]);
  await slackDm('Skipped.');
  console.log('Skipped.');
}

// ── main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const mode = args[0];

if (mode === '--check') {
  runCheck().catch(e => { console.error(e); process.exit(1); });
} else if (mode === '--approve') {
  const approvalStr = args[1] || '';
  const runId = args[2] || null;
  runApproval(approvalStr, runId).catch(e => { console.error(e); process.exit(1); });
} else if (mode === '--skip') {
  const runId = args[1] || null;
  runSkip(runId).catch(e => { console.error(e); process.exit(1); });
} else {
  console.error('Usage: node bba-pipeline-check.js --check | --approve "title N, ig N" [run_id] | --skip [run_id]');
  process.exit(1);
}
