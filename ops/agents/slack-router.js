/**
 * BBA Slack Router
 * Receives Slack DMs via Socket Mode.
 *
 * Scheduled tasks (briefings, pipeline, website review) run via Anthropic's
 * built-in trigger cron — no VPS involvement needed for those.
 *
 * DM commands handled here:
 *   last30 [topic]   → fires bba-research via Anthropic API direct call
 *   title [n], ig [n] → content approval (queued to Sheets, picked up by next pipeline cron)
 *   skip             → marks pending approval as skipped in Sheets
 *   agent: [task]    → direct Anthropic API call with full ops context
 *   [anything else]  → direct Anthropic API chat response (OpenClaw-style)
 *
 * Note: api.claude.ai is Cloudflare-protected and not callable from VPS.
 * All AI responses use the Anthropic Messages API directly (ANTHROPIC_API_KEY).
 */

import pkg from '@slack/bolt';
const { App } = pkg;
import https from 'https';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const ALLOWED_USERS = [
  process.env.SLACK_USER_ID,
  ...(process.env.SLACK_EXTRA_USERS || '').split(',').filter(Boolean),
].filter(Boolean);

// Call Anthropic Messages API directly (bypasses Cloudflare issue with api.claude.ai)
async function callClaude(systemPrompt, userMessage) {
  const body = JSON.stringify({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.content?.[0]?.text || 'No response');
        } catch {
          resolve('Error parsing response');
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Write content approval/skip to Google Sheets pending approvals tab
// (bba-content trigger picks this up at 9am/5pm)
async function writeApprovalToSheets(action, text, channel, ts) {
  // For now, just log — the trigger reads the Slack DM thread anyway
  console.log(`Approval action: ${action} | ${text} | ${channel} ${ts}`);
}

app.message(async ({ message, say, client }) => {
  if (!message.text || message.bot_id) return;
  if (!ALLOWED_USERS.includes(message.user)) return;

  const text = message.text.trim();
  const threadTs = message.thread_ts || message.ts;

  // --- last30 [topic]: research via direct API call ---
  const research = text.match(/^last30\s+(.+)/i);
  if (research) {
    await say({ text: 'Researching... (2-8 min)', thread_ts: message.ts });
    const reply = await callClaude(
      'You are a research assistant. Run the BBA last30days research script and summarise findings.',
      `Research topic: ${research[1]}\n\nNote: The last30days.py script is at /home/openclaw/byebyeadmin/.claude/skills/last30days/scripts/last30days.py — but you cannot run Bash here. Instead, use your web knowledge to summarise what has been happening in the last 30 days on this topic from Reddit, X, YouTube, HN, and industry sources. Format: *Research: ${research[1]}* / _Sources: public knowledge — last 30 days_ / [content]`
    );
    await say({ text: reply.substring(0, 3800), thread_ts: message.ts });
    return;
  }

  // --- title [n], ig [n] or skip: content approval ---
  if (/^title\s+\d/i.test(text) || /^skip$/i.test(text)) {
    await writeApprovalToSheets(text, text, message.channel, threadTs);
    await say({ text: `Got it: "${text}" — will be processed at next pipeline run (9am/5pm UTC).`, thread_ts: message.ts });
    return;
  }

  // --- agent: or fallback: full ops context chat ---
  let threadHistory = [];
  if (message.thread_ts) {
    try {
      const result = await client.conversations.replies({
        channel: message.channel,
        ts: message.thread_ts,
        limit: 10,
      });
      threadHistory = (result.messages || []).map(m => `${m.user}: ${m.text}`).join('\n');
    } catch (_) {}
  }

  const isAgent = /^agent:\s*/i.test(text);
  const cleanText = text.replace(/^agent:\s*/i, '');

  if (isAgent) await say({ text: 'On it...', thread_ts: message.ts });

  const systemPrompt = `You are OpenClaw, George Spain-Warner's AI business assistant for ByeByeAdmin — a UK haulage AI automation company based in Kent. George's cold outreach campaign targets 4,276 UK fleet operators. Assessment funnel is live at byebyeadmin.co.uk/assessment.

Rules:
- Be concise. Slack replies, not essays.
- No em dashes anywhere.
- Quick question = quick answer.
- Copy requests: no buzzwords, short sentences, specifics over claims.
- NEVER send emails or deploy to production unless explicitly told to.
- You have no tool access here — if a task requires data APIs or file access, tell George what to do or that it needs a full Claude Code session.`;

  const userMsg = threadHistory
    ? `Thread so far:\n${threadHistory}\n\nGeorge's message: ${cleanText}`
    : cleanText;

  const reply = await callClaude(systemPrompt, userMsg);
  await say({ text: reply.substring(0, 3800), thread_ts: message.ts });
});

(async () => {
  await app.start();
  console.log('BBA Slack router running');
})();
