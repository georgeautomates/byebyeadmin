/**
 * BBA Slack Router
 * Thin shim: receives Slack DMs via Socket Mode, routes to Claude Code remote triggers.
 * Zero business logic — all intelligence runs in Anthropic's cloud.
 */

const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const ALLOWED_USERS = [
  process.env.SLACK_USER_ID,
  ...(process.env.SLACK_EXTRA_USERS || '').split(',').filter(Boolean),
].filter(Boolean);

const TRIGGERS = {
  briefings: process.env.BRIEFING_TRIGGER_ID,
  content:   process.env.CONTENT_TRIGGER_ID,
  research:  process.env.RESEARCH_TRIGGER_ID,
  agent:     process.env.AGENT_TRIGGER_ID,
  chat:      process.env.CHAT_TRIGGER_ID,
};

const CLAUDE_API = 'https://api.claude.ai/v1/code/triggers';

async function fireTrigger(triggerId, promptAddition) {
  const headers = {
    'Authorization': `Bearer ${process.env.CLAUDE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
  await fetch(`${CLAUDE_API}/${triggerId}/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt_addition: promptAddition }),
  });
}

app.message(async ({ message, say, client }) => {
  if (!message.text || message.bot_id) return;
  if (!ALLOWED_USERS.includes(message.user)) return;

  const text = message.text.trim();
  const coords = `\nSlack channel: ${message.channel}\nThread ts: ${message.thread_ts || message.ts}`;

  // --- last30 [topic] ---
  const research = text.match(/^last30\s+(.+)/i);
  if (research) {
    await say({ text: 'Researching... (2-8 min)', thread_ts: message.ts });
    await fireTrigger(TRIGGERS.research, `\n\nTopic: ${research[1]}${coords}`);
    return;
  }

  // --- title [n], ig [n] (content approval) ---
  if (/^title\s+\d/i.test(text)) {
    await fireTrigger(TRIGGERS.content, `\n\nGeorge approval: "${text}"${coords}`);
    return;
  }

  // --- skip ---
  if (/^skip$/i.test(text)) {
    await fireTrigger(TRIGGERS.content, `\n\nGeorge skipped the pending approval.${coords}`);
    return;
  }

  // --- agent: [task] (existing Claude Code trigger, unchanged) ---
  const agent = text.match(/^agent:\s*([\s\S]+)/i);
  if (agent) {
    await say({ text: 'On it...', thread_ts: message.ts });
    await fireTrigger(TRIGGERS.agent, `\n\nTask: ${agent[1]}${coords}`);
    return;
  }

  // --- fallback: ad-hoc chat ---
  // Fetch thread history for conversational context
  let threadHistory = [];
  if (message.thread_ts) {
    try {
      const result = await client.conversations.replies({
        channel: message.channel,
        ts: message.thread_ts,
        limit: 10,
      });
      threadHistory = (result.messages || []).map(m => ({
        user: m.user,
        text: m.text,
        ts: m.ts,
      }));
    } catch (_) {}
  }

  await say({ text: '...', thread_ts: message.ts });
  await fireTrigger(TRIGGERS.chat,
    `\n\nMessage from George: "${text}"\nThread history: ${JSON.stringify(threadHistory)}${coords}`);
});

(async () => {
  await app.start();
  console.log('BBA Slack router running');
})();
