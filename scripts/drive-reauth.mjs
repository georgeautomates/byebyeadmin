// Google OAuth re-authorisation — george.automates.ai@gmail.com (personal)
// Grants: drive + spreadsheets + documents + gmail.send
//
// Run: node scripts/drive-reauth.mjs  (.env.local is loaded automatically)
// Then update GOOGLE_DRIVE_REFRESH_TOKEN in VPS ops/.env + .env.local

import http from 'http';
import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// Load .env.local to pick up GOOGLE_DRIVE_CLIENT_ID / SECRET
function loadEnv() {
  try {
    const lines = readFileSync(resolve(__dir, '../.env.local'), 'utf-8').split('\n');
    for (const line of lines) {
      const [k, ...rest] = line.split('=');
      if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
    }
  } catch {}
}
loadEnv();

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET must be set (in .env.local or env)');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:8080/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ');

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('\nOpening browser for Google authorisation (george.automates.ai@gmail.com)...');
console.log('If it does not open automatically, visit:\n');
console.log(authUrl + '\n');
exec(`open "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8080');
  if (url.pathname !== '/callback') return;

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.end(`<h2>Error: ${error}</h2>`);
    server.close();
    console.error('Auth error:', error);
    return;
  }

  res.end('<h2>Authorised. You can close this tab.</h2>');
  server.close();

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.refresh_token) {
    console.error('\nNo refresh_token returned. Full response:');
    console.error(JSON.stringify(tokens, null, 2));
    console.error('\nThis usually means the app already has a grant. Revoke access at');
    console.error('https://myaccount.google.com/permissions and re-run this script.');
    return;
  }

  console.log('\n=== NEW GOOGLE_DRIVE_REFRESH_TOKEN (george.automates.ai@gmail.com) ===');
  console.log(tokens.refresh_token);
  console.log('\nUpdate GOOGLE_DRIVE_REFRESH_TOKEN in:');
  console.log('  1. VPS: ssh openclaw@178.104.12.113 then edit ~/byebyeadmin/ops/.env');
  console.log('  2. .env.local: update GOOGLE_DRIVE_REFRESH_TOKEN\n');
});

server.listen(8080, () => {
  console.log('Waiting for Google callback on http://localhost:8080/callback...\n');
});
