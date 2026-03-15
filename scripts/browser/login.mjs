// One-time login helper — opens a headed browser, lets you log in, saves session.
//
// Usage:
//   node login.mjs google      → opens Google, saves .sessions/google.json
//   node login.mjs vercel      → opens Vercel dashboard
//   node login.mjs supabase    → opens Supabase dashboard
//   node login.mjs gcp         → opens Google Cloud Console (same Google session)
//
// When the browser opens, log in, then Claude will call http://localhost:7777/done
// to signal that the session should be saved.

import { chromium } from 'playwright';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(__dirname, '.sessions');

const SERVICES = {
  google:   'https://accounts.google.com',
  gcp:      'https://console.cloud.google.com',
  ga4:      'https://analytics.google.com',
  vercel:   'https://vercel.com/login',
  supabase: 'https://supabase.com/dashboard',
};

const service = process.argv[2];
if (!service || !SERVICES[service]) {
  console.error(`Usage: node login.mjs <service>`);
  console.error(`Services: ${Object.keys(SERVICES).join(', ')}`);
  process.exit(1);
}

const url = SERVICES[service];
const profileDir = path.join(SESSIONS_DIR, `profile-${['gcp','ga4'].includes(service) ? 'google' : service}`);
const storageFile = path.join(SESSIONS_DIR, `${['gcp','ga4'].includes(service) ? 'google' : service}.json`);

console.log(`\nOpening ${service} at ${url}`);
console.log('Log in, then Claude will signal /done to save the session.\n');

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1280, height: 900 },
});

const page = await context.newPage();
await page.goto(url);

// Wait for /done signal via local HTTP
await new Promise(resolve => {
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK — saving session');
    srv.close();
    resolve();
  });
  srv.listen(7777, () => {
    console.log('Waiting for done signal on http://localhost:7777/done');
    console.log('Claude will call this automatically, or you can visit it in a browser.\n');
  });
});

await context.storageState({ path: storageFile });
await context.close();

console.log(`\nSession saved to ${storageFile}`);
console.log('Claude can now use this session headlessly.\n');
process.exit(0);
