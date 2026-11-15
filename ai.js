// AI chat for Sulfuric — any OpenAI-compatible chat-completions endpoint.
//
// Provider selection (env):
//   AI_API_KEY set    -> LongCat by default (AI_BASE_URL + AI_MODEL overridden by env)
//   AI_API_KEY empty  -> free Pollinations endpoint (rate limited by the provider)
//
// Point AI_BASE_URL / AI_MODEL at any other OpenAI-compatible provider
// (OpenRouter, DeepSeek, Groq, a local llama.cpp server, ...) to switch.

const AI_API_KEY = process.env.AI_API_KEY || "";
// No key -> always use the free provider, even if AI_BASE_URL is set in .env.
const AI_BASE_URL = AI_API_KEY
  ? (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "")
  : "https://text.pollinations.ai/openai";
const AI_MODEL = AI_API_KEY
  ? (process.env.AI_MODEL || "openai/gpt-oss-120b")
  : "openai";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60000);

const SYSTEM = `You are Sulfuric, a friendly Discord bot.

Style:
- Be helpful, warm, and concise.
- Use text faces like >w<, >:3, :3c, ^w^ naturally, but not after every sentence.
- Never use Unicode emoji.
- Answer what the user actually asked.
- Do not mention that you are an AI unless asked.
- Never claim to be human.

Conversation:
- Use the supplied history to answer follow-up questions.
- Do not repeat the same response unnecessarily.`;

function aiConfigured() { return !!AI_BASE_URL; }
function providerName() { return AI_API_KEY ? AI_MODEL : `free (${AI_MODEL})`; }

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (AI_API_KEY) headers.Authorization = `Bearer ${AI_API_KEY}`;
  return headers;
}

async function doAsk(prompt, history = [], systemExtra = "") {
  if (!AI_BASE_URL) throw new Error("AI_BASE_URL is not set");

  const system = systemExtra ? `${SYSTEM}\n\n${systemExtra}` : SYSTEM;
  const messages = [
    { role: "system", content: system },
    ...history.slice(-10).map(item => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").slice(0, 2000)
    })),
    { role: "user", content: String(prompt || "").slice(0, 4000) }
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: 0.8,
        top_p: 0.9,
        max_tokens: 300,
        stream: false
      }),
      signal: controller.signal
    });

    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch { /* non-JSON body */ }

    if (!response.ok) {
      const detail = data?.error?.message || data?.message || raw.slice(0, 200);
      throw new Error(`AI HTTP ${response.status}: ${detail}`);
    }
    if (data?.error) throw new Error(data.error.message || "AI returned an error");
    if (data?.success === false) throw new Error(data.error?.message || "AI request failed");

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("AI returned an empty response");
    return text.replace(/\uFFFD/g, "").trim().slice(0, 1900);
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// One retry on transient failures (rate limit, 5xx, network blips).
async function askAI(prompt, history = [], systemExtra = "") {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await doAsk(prompt, history, systemExtra);
    } catch (e) {
      lastError = e;
      const retryable = /HTTP (402|429|5\d\d)|fetch failed|aborted|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(e.message);
      if (attempt === 0 && retryable) { await sleep(1500); continue; }
      throw e;
    }
  }
  throw lastError;
}

module.exports = { askAI, aiConfigured, providerName, AI_MODEL, AI_BASE_URL };
