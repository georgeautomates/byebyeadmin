#!/usr/bin/env node
// ============================================================
// Google OAuth re-authorisation script
// Generates a new refresh token with both:
//   - https://www.googleapis.com/auth/gmail.send
//   - https://www.googleapis.com/auth/spreadsheets
//
// Usage:
//   PATH="/Users/george/homebrew/Cellar/node/25.6.1/bin:$PATH" node scripts/google-reauth.js
//
// Then copy the printed GMAIL_REFRESH_TOKEN value into .env.local
// and into Vercel environment variables.
// ============================================================

import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────
function loadEnv() {
  try {
    const lines = readFileSync(resolve(__dir, "../.env.local"), "utf-8").split("\n");
    for (const line of lines) {
      const [k, ...rest] = line.split("=");
      if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
    }
  } catch {
    // rely on actual env
  }
}

loadEnv();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const PORT = 3333;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌  GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET not found in .env.local");
  process.exit(1);
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent` +
  `&login_hint=george%40byebyeadmin.com`;

console.log("\nOpening browser for Google authorisation...");
console.log("If it doesn't open automatically, paste this URL:\n");
console.log(authUrl + "\n");

exec(`open "${authUrl}"`);

// ── Local callback server ────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>❌ Authorisation failed: ${error ?? "no code"}</h2><p>Close this tab.</p>`);
    console.error("❌  Authorisation failed:", error);
    server.close();
    return;
  }

  // Exchange code for tokens
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokens.refresh_token) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<h2>⚠️ No refresh token returned</h2><p>Try revoking access at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> and running this script again.</p>`);
      console.error("⚠️  No refresh_token in response:", JSON.stringify(tokens, null, 2));
      server.close();
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>✅ Authorisation successful</h2><p>Close this tab and check your terminal.</p>`);

    console.log("\n✅  Success! Add this to .env.local and Vercel env vars:\n");
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log("(Replace the existing GMAIL_REFRESH_TOKEN value — do not add a second one)");
  } catch (err) {
    res.writeHead(500);
    res.end("Token exchange failed");
    console.error("❌  Token exchange error:", err);
  }

  server.close();
});

server.listen(PORT, () => {
  console.log(`Waiting for Google callback on http://localhost:${PORT}/callback ...`);
});
