// GCP project setup — creates project, enables APIs, creates OAuth client.
// Requires: node login.mjs google first.
//
// Usage: node gcp-setup.mjs
// The script opens GCP in the saved Google session and guides you through setup.
// Claude signals each step completion via curl http://localhost:7777/next

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
    srv.listen(7777, () => console.log(`\n[WAITING] ${message}\nClaude will signal http://localhost:7777/next when ready.`));
  });
}

// ── Step 1: Create project ──────────────────────────────────────────────────
console.log('\nStep 1: GCP project creation page...');
await page.goto('https://console.cloud.google.com/projectcreate');
await page.waitForLoadState('networkidle');

const nameInput = page.locator('input[id*="p_name"], input[placeholder*="project name" i], input[aria-label*="project name" i]').first();
try {
  await nameInput.waitFor({ timeout: 10000 });
  await nameInput.fill('ByeByeAdmin');
  console.log('Filled project name: ByeByeAdmin');
} catch {
  console.log('Could not auto-fill name — fill it manually in the browser.');
}

await waitForSignal('Fill in project name "ByeByeAdmin" if not auto-filled, then click CREATE. Signal when creation is complete.');

// ── Step 2: Enable APIs ─────────────────────────────────────────────────────
const APIS = [
  { id: 'gmail.googleapis.com',        name: 'Gmail API' },
  { id: 'sheets.googleapis.com',       name: 'Sheets API' },
  { id: 'analyticsdata.googleapis.com', name: 'Analytics Data API' },
];

for (const api of APIS) {
  console.log(`\nStep 2: Enabling ${api.name}...`);
  await page.goto(`https://console.cloud.google.com/apis/library/${api.id}`);
  await page.waitForTimeout(3000);

  await page.waitForTimeout(2000);
  const enableBtn = page.getByRole('button', { name: /^enable$/i });
  if (await enableBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await enableBtn.click();
    await page.waitForTimeout(3000);
    console.log(`  Auto-clicked Enable for ${api.name}`);
  } else {
    await waitForSignal(`Click ENABLE for ${api.name} in the browser, then signal.`);
  }
}

// ── Step 3: OAuth consent screen ───────────────────────────────────────────
console.log('\nStep 3: OAuth consent screen...');
await page.goto('https://console.cloud.google.com/apis/credentials/consent');
await page.waitForLoadState('networkidle');

console.log('\nIn the browser, complete the OAuth consent screen:');
console.log('  1. User type: External → CREATE');
console.log('  2. App name: ByeByeAdmin');
console.log('  3. User support email: george@byebyeadmin.com');
console.log('  4. Developer email: george@byebyeadmin.com → SAVE AND CONTINUE');
console.log('  5. Skip Scopes → SAVE AND CONTINUE');
console.log('  6. Test users: add george@byebyeadmin.com → SAVE AND CONTINUE');
await waitForSignal('Consent screen fully configured. Signal when done.');

// ── Step 4: Create OAuth client ─────────────────────────────────────────────
console.log('\nStep 4: Creating OAuth 2.0 client...');
await page.goto('https://console.cloud.google.com/apis/credentials/oauthclient');
await page.waitForLoadState('networkidle');

console.log('\nIn the browser:');
console.log('  1. Application type: Web application');
console.log('  2. Name: BBA Local');
console.log(`  3. Authorised redirect URIs: ${REDIRECT_URI}`);
console.log('  4. Click CREATE');
console.log('  5. COPY the Client ID and Client Secret from the dialog');
await waitForSignal('OAuth client created and credentials copied. Signal when done.');

await context.close();

console.log('\n=== DONE ===');
console.log('Now run:');
console.log('  node google-oauth-reauth.mjs <CLIENT_ID> <CLIENT_SECRET>');
console.log('Paste the client ID and secret you just copied.');
process.exit(0);
