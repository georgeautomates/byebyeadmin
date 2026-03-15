// Google OAuth re-auth — gets a refresh token covering Gmail + Sheets + GA4.
// Uses the Google session saved by login.mjs to skip the login step.
//
// Usage: node google-oauth-reauth.mjs <CLIENT_ID> <CLIENT_SECRET>
//
// Outputs a refresh token. Update GMAIL_CLIENT_ID, MAIL_CLIENT_SECRET,
// and GMAIL_REFRESH_TOKEN in Vercel + VPS env.

import http from 'http';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, '.sessions', 'profile-google');

// Required due to sandboxed shell SSL issue on this Mac
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const CLIENT_ID     = process.argv[2];
const CLIENT_SECRET = process.argv[3];
const REDIRECT_URI  = 'http://localhost:8080/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Usage: node google-oauth-reauth.mjs <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/analytics.readonly',
].join(' ');

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`;

// Start local callback server
const codePromise = new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost:8080');
    if (url.pathname !== '/callback') return;
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    res.end('<h2>Done — you can close this tab.</h2>');
    server.close();
    if (error) reject(new Error(error));
    else resolve(code);
  });
  server.listen(8080);
});

// Open auth URL in the Google browser context (already logged in)
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1000, height: 700 },
});

const page = await context.newPage();
console.log('\nOpening Google consent screen...');
await page.goto(authUrl);

// Wait for callback
const code = await codePromise;
await context.close();

// Exchange code for tokens
console.log('\nExchanging code for tokens...');
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
  console.error('\nNo refresh_token in response:');
  console.error(JSON.stringify(tokens, null, 2));
  process.exit(1);
}

console.log('\n=== TOKENS ===');
console.log(`CLIENT_ID:     ${CLIENT_ID}`);
console.log(`CLIENT_SECRET: ${CLIENT_SECRET}`);
console.log(`REFRESH_TOKEN: ${tokens.refresh_token}`);

console.log('\n=== Update these env vars ===');
console.log('Vercel:');
console.log(`  vercel env rm GMAIL_CLIENT_ID && echo "${CLIENT_ID}" | vercel env add GMAIL_CLIENT_ID production`);
console.log(`  vercel env rm MAIL_CLIENT_SECRET && echo "${CLIENT_SECRET}" | vercel env add MAIL_CLIENT_SECRET production`);
console.log(`  vercel env rm GMAIL_REFRESH_TOKEN && echo "${tokens.refresh_token}" | vercel env add GMAIL_REFRESH_TOKEN production`);
console.log('\nVPS: /home/openclaw/byebyeadmin/ops/.env');
process.exit(0);
