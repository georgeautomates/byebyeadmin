/**
 * BBA Slack Router
 * Receives Slack DMs via Socket Mode.
 *
 * Only handles content approval commands — everything else is managed in Paperclip.
 *
 * Commands handled here:
 *   title [n]   → approve content title option n (queued via pipeline script)
 *   ig [n]      → approve Instagram caption option n
 *   skip        → skip current pending approval
 */

import pkg from '@slack/bolt';
const { App } = pkg;
import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local (works on both Mac and VPS)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPaths = [
  resolve(__dirname, '../../.env.local'),
  resolve(__dirname, '../.env'),
];
for (const p of envPaths) {
  try {
    readFileSync(p, 'utf8').split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...rest] = line.split('=');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    });
    break;
  } catch (_) {}
}

// Detect environment
const IS_MAC = process.platform === 'darwin';
const REPO   = IS_MAC ? '/Users/george/byebyeadmin' : '/home/openclaw/byebyeadmin';
const NODE   = IS_MAC
  ? '/Users/george/homebrew/Cellar/node/25.6.1/bin/node'
  : '/home/openclaw/.nvm/versions/node/v22.22.1/bin/node';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const ALLOWED_USERS = [
  process.env.SLACK_USER_ID,
  ...(process.env.SLACK_EXTRA_USERS || '').split(',').filter(Boolean),
].filter(Boolean);

app.message(async ({ message, say }) => {
  if (!message.text || message.bot_id) return;
  if (!ALLOWED_USERS.includes(message.user)) return;

  const text = message.text.trim();

  if (/^(title|ig)\s+\d/i.test(text)) {
    const scriptPath = `${REPO}/ops/scripts/bba-pipeline-check.js`;
    exec(`${NODE} ${scriptPath} --approve ${JSON.stringify(text)}`, (err, stdout, stderr) => {
      if (err) console.error('Pipeline approval error:', stderr);
      else console.log('Pipeline approval:', stdout);
    });
    exec(`python3 ${REPO}/ops/scripts/bba-copywriter.py --source pipeline`, (err) => {
      if (err) console.error('Copywriter audit error:', err.message);
    });
    await say({ text: 'On it...', thread_ts: message.ts });
    return;
  }

  if (/^skip$/i.test(text)) {
    const scriptPath = `${REPO}/ops/scripts/bba-pipeline-check.js`;
    exec(`${NODE} ${scriptPath} --skip`, (err, stdout, stderr) => {
      if (err) console.error('Pipeline skip error:', stderr);
      else console.log('Pipeline skip:', stdout);
    });
    await say({ text: 'Skipped.', thread_ts: message.ts });
    return;
  }
});

(async () => {
  await app.start();
  console.log('BBA Slack router running');
})();
