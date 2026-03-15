// Steps 3+4 only: OAuth consent screen setup + OAuth client creation.
// Run this after APIs are already enabled.

import { chromium } from 'playwright';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, '.sessions', 'profile-google');
const REDIRECT_URI = 'http://localhost:8080/callback';

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();

async function waitForSignal(message) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      srv.close();
      resolve();
    });
    srv.listen(7777, () => console.log(`\n[WAITING] ${message}\nClaude signals http://localhost:7777/next`));
  });
}

// ── Step 3: OAuth consent screen ───────────────────────────────────────────
console.log('\nStep 3: Navigating to OAuth consent screen...');
await page.goto('https://console.cloud.google.com/apis/credentials/consent');
await page.waitForTimeout(4000);

console.log('\nComplete the consent screen in the browser:');
console.log('  1. User type: External → CREATE');
console.log('  2. App name: ByeByeAdmin');
console.log('  3. Support email: george@byebyeadmin.com');
console.log('  4. Developer email: george@byebyeadmin.com → SAVE AND CONTINUE');
console.log('  5. Skip Scopes → SAVE AND CONTINUE');
console.log('  6. Test users: add george@byebyeadmin.com → SAVE AND CONTINUE');
await waitForSignal('Consent screen done. Signal when complete.');

// ── Step 4: Create OAuth client ─────────────────────────────────────────────
console.log('\nStep 4: Navigating to create OAuth client...');
await page.goto('https://console.cloud.google.com/apis/credentials/oauthclient');
await page.waitForTimeout(4000);

console.log('\nIn the browser:');
console.log('  1. Application type: Web application');
console.log('  2. Name: BBA Local');
console.log(`  3. Authorised redirect URIs → Add URI: ${REDIRECT_URI}`);
console.log('  4. Click CREATE');
console.log('  5. COPY the Client ID and Client Secret from the dialog');
await waitForSignal('OAuth client created. Signal when credentials are copied.');

await context.close();
console.log('\nDone! Now run:');
console.log('  node google-oauth-reauth.mjs <CLIENT_ID> <CLIENT_SECRET>');
process.exit(0);
