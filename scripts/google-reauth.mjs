// Google OAuth re-authorisation script — george@byebyeadmin.com (Workspace)
// Grants: spreadsheets + analytics.readonly + documents + drive
// No gmail.send — email sending is handled by george.automates.ai@gmail.com
//
// Run: GOOGLE_CLIENT_SECRET=xxx node scripts/google-reauth.mjs
// Then update GOOGLE_REFRESH_TOKEN in VPS ops/.env + .env.local + Vercel.

import http from 'http';
import { exec } from 'child_process';

const CLIENT_ID = '698251746508-3q6ah4t7hb56uit827gae055deb8f0rj.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || (() => {
  throw new Error('GOOGLE_CLIENT_SECRET env var is required. Set it before running: GOOGLE_CLIENT_SECRET=xxx node scripts/google-reauth.mjs');
})();
const REDIRECT_URI = 'http://localhost:8080/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
].join(' ');

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('\nOpening browser for Google authorisation...');
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

  // Exchange code for tokens
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

  console.log('\n=== NEW GOOGLE_REFRESH_TOKEN (byebyeadmin.com) ===');
  console.log(tokens.refresh_token);
  console.log('\nUpdate GOOGLE_REFRESH_TOKEN in:');
  console.log('  1. VPS: ssh openclaw@178.104.12.113 then edit ~/byebyeadmin/ops/.env');
  console.log('  2. .env.local: update GOOGLE_REFRESH_TOKEN');
  console.log('  3. Vercel: vercel env rm GOOGLE_REFRESH_TOKEN && vercel env add GOOGLE_REFRESH_TOKEN');
  console.log('  Also remove GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN from all three.\n');
});

server.listen(8080, () => {
  console.log('Waiting for Google callback on http://localhost:8080/callback...\n');
});
