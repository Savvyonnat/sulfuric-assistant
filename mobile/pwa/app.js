"use strict";

// Sulfuric mobile assistant — talks to any OpenAI-compatible chat endpoint.
// Everything (API key included) stays in this device's localStorage.

const SYSTEM = `You are Sulfuric, a friendly AI assistant.
- Be helpful, warm, and concise.
- Use text faces like >w<, >:3, :3c, ^w^ naturally, but not after every sentence.
- Never use Unicode emoji.
- Answer what the user actually asked.
- Never claim to be human.`;

const DEFAULTS = {
  apiKey: "",
  baseUrl: "", // empty -> free provider
  model: "",
  temperature: 0.8
};

const FREE_BASE = "https://text.pollinations.ai/openai";
const FREE_MODEL = "openai";

const els = {
  messages: document.getElementById("messages"),
  typing: document.getElementById("typing"),
  form: document.getElementById("composer"),
  input: document.getElementById("input"),
  mic: document.getElementById("micBtn"),
  status: document.getElementById("status"),
  settings: document.getElementById("settings"),
  apiKey: document.getElementById("apiKey"),
  baseUrl: document.getElementById("baseUrl"),
  model: document.getElementById("model"),
  temperature: document.getElementById("temperature"),
  save: document.getElementById("saveSettings"),
  close: document.getElementById("closeSettings"),
  open: document.getElementById("settingsBtn"),
  clear: document.getElementById("clearChat"),
  phone: document.getElementById("phone"),
  phoneBody: document.getElementById("phoneBody"),
  openPhone: document.getElementById("phoneBtn"),
  closePhone: document.getElementById("closePhone"),
  refreshPhone: document.getElementById("refreshPhone")
};

let settings = loadSettings();
let history = loadJSON("sulfuric.history", []); // [{role, content}]

function loadJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value === null ? fallback : value;
  } catch { return fallback; }
}
function loadSettings() {
  return { ...DEFAULTS, ...loadJSON("sulfuric.settings", {}) };
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function provider() {
  if (settings.apiKey) {
    return {
      base: (settings.baseUrl || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
      model: settings.model || "openai/gpt-oss-120b",
      key: settings.apiKey
    };
  }
  return { base: FREE_BASE, model: FREE_MODEL, key: "" };
}

function setStatus() {
  const p = provider();
  els.status.textContent = p.key ? `AI: ${p.model}` : "AI: free provider";
}

/* ---------- rendering ---------- */

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  els.messages.appendChild(div);
  scrollToEnd();
  return div;
}
function scrollToEnd() { els.messages.scrollTop = els.messages.scrollHeight; }

function renderHistory() {
  els.messages.innerHTML = "";
  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = "<h2>Let's start >w<</h2><p>Type a message or press the mic to talk.</p>";
    els.messages.appendChild(empty);
    return;
  }
  for (const m of history) addMessage(m.role === "user" ? "user" : "bot", m.content);
}

/* ---------- AI call ---------- */

async function askAI(prompt) {
  const p = provider();
  const messages = [
    { role: "system", content: SYSTEM },
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content.slice(0, 2000) })),
    { role: "user", content: prompt.slice(0, 4000) }
  ];
  const res = await fetch(p.base + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(p.key ? { Authorization: "Bearer " + p.key } : {})
    },
    body: JSON.stringify({
      model: p.model,
      messages,
      temperature: Number(settings.temperature) || 0.8,
      max_tokens: 300,
      stream: false
    })
  });
  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  if (data?.error) throw new Error(data.error.message || "AI error");
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI returned an empty response");
  return text.slice(0, 1900);
}

/* ---------- events ---------- */

async function send(text) {
  const prompt = (text ?? els.input.value).trim();
  if (!prompt) return;
  els.input.value = "";
  addMessage("user", prompt);
  els.typing.classList.remove("hidden");
  try {
    const reply = await askAI(prompt);
    addMessage("bot", reply);
    history.push({ role: "user", content: prompt }, { role: "assistant", content: reply });
    save("sulfuric.history", history.slice(-20));
  } catch (e) {
    console.error(e);
    const busy = /FREE_LIMIT|rate limit|402|429/i.test(e.message);
    addMessage("error", busy
      ? "The provider is busy (rate limit). Try again in a moment."
      : "Failed to reach the AI: " + e.message);
  } finally {
    els.typing.classList.add("hidden");
  }
}

els.form.addEventListener("submit", e => { e.preventDefault(); send(); });

/* Voice input: native Android bridge (SpeechRecognizer) when running in the app,
   otherwise the browser's Web Speech API. */
window.onAndroidVoiceResult = text => { if (text) send(text); };
window.onAndroidVoiceError = msg => addMessage("error", "Could not recognize speech (" + (msg || "error") + ").");

function hasNativeVoice() {
  return window.AndroidVoice && typeof window.AndroidVoice.isAvailable === "function" && window.AndroidVoice.isAvailable();
}

if (hasNativeVoice()) {
  els.mic.addEventListener("click", () => window.AndroidVoice.start());
} else {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    els.mic.style.display = "none";
  } else {
    const rec = new SR();
    rec.lang = "id-ID";
    rec.interimResults = false;
    rec.continuous = false;
    let listening = false;
    els.mic.addEventListener("click", () => {
      if (listening) { rec.stop(); return; }
      try { rec.start(); } catch { /* already started */ }
    });
    rec.addEventListener("start", () => { listening = true; els.mic.classList.add("listening"); });
    rec.addEventListener("end", () => { listening = false; els.mic.classList.remove("listening"); });
    rec.addEventListener("result", e => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) send(text);
    });
    rec.addEventListener("error", e => {
      listening = false;
      els.mic.classList.remove("listening");
      addMessage("error", "Could not recognize speech (" + (e.error || "error") + ").");
    });
  }
}

/* ---------- phone status ---------- */

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "n/a";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(v >= 100 ? 0 : 1) + " " + units[i];
}

function formatUptime(sec) {
  if (sec == null || sec < 0) return "n/a";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return h + "h " + m + "m";
  return m + "m " + Math.floor(sec % 60) + "s";
}

function phoneRow(label, value) {
  return '<div class="phone-row"><span>' + label + "</span><strong>" + value + "</strong></div>";
}

function renderPhone(data) {
  const d = data.device || {};
  const b = data.battery || {};
  const s = data.storage || {};
  const m = data.memory || {};
  const n = data.network || {};

  const rows = [];
  rows.push(phoneRow("Device", (d.manufacturer ? d.manufacturer + " " : "") + (d.model || "unknown")));
  rows.push(phoneRow("Android", d.android ? d.android + " (SDK " + d.sdk + ")" : "n/a"));
  rows.push(phoneRow("Battery", b.level >= 0 ? b.level + "%" + (b.charging ? " - charging" : "") : "n/a"));
  if (s.total) rows.push(phoneRow("Storage", formatBytes(s.used) + " / " + formatBytes(s.total) + " (" + formatBytes(s.free) + " free)"));
  if (m.total) rows.push(phoneRow("Memory", formatBytes(m.available) + " free / " + formatBytes(m.total) + (m.low ? " - LOW" : "")));
  rows.push(phoneRow("Network", n.online ? (n.type || "online") : "offline"));
  rows.push(phoneRow("Uptime", formatUptime(data.uptimeSeconds)));
  els.phoneBody.innerHTML = rows.join("");
}

async function webBase() {
  const out = { device: {}, battery: {}, storage: {}, memory: {}, network: {}, uptimeSeconds: Math.round(performance.now() / 1000) };
  const m = navigator.userAgent.match(/Android\s([\d.]+)/);
  out.device = { manufacturer: "", model: "", android: m ? m[1] : "", sdk: 0 };
  if (navigator.deviceMemory) out.memory = { total: navigator.deviceMemory * Math.pow(1024, 3), available: 0 };
  const c = navigator.connection;
  out.network = { online: navigator.onLine, type: c ? (c.effectiveType || "unknown") : "unknown" };
  if (navigator.getBattery) {
    try {
      const bat = await navigator.getBattery();
      out.battery = { level: Math.round(bat.level * 100), charging: bat.charging };
    } catch { /* battery not available */ }
  }
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const e = await navigator.storage.estimate();
      out.storage = { total: e.quota || 0, used: e.usage || 0, free: Math.max(0, (e.quota || 0) - (e.usage || 0)) };
    } catch { /* storage estimate not available */ }
  }
  return out;
}

async function loadPhoneStatus() {
  els.phoneBody.innerHTML = '<p class="hint">Loading...</p>';
  try {
    if (window.AndroidPhone && typeof window.AndroidPhone.status === "function") {
      renderPhone(JSON.parse(window.AndroidPhone.status()));
      return;
    }
    renderPhone(await webBase());
  } catch (e) {
    els.phoneBody.innerHTML = '<p class="hint">Could not read phone status: ' + e.message + "</p>";
  }
}

els.openPhone.addEventListener("click", () => {
  els.phone.classList.remove("hidden");
  loadPhoneStatus();
});
els.closePhone.addEventListener("click", () => els.phone.classList.add("hidden"));
els.phone.addEventListener("click", e => { if (e.target === els.phone) els.phone.classList.add("hidden"); });
els.refreshPhone.addEventListener("click", loadPhoneStatus);

/* Settings sheet */
function openSettings() {
  els.apiKey.value = settings.apiKey;
  els.baseUrl.value = settings.baseUrl;
  els.model.value = settings.model;
  els.temperature.value = settings.temperature;
  els.settings.classList.remove("hidden");
}
function closeSettings() { els.settings.classList.add("hidden"); }

els.open.addEventListener("click", openSettings);
els.close.addEventListener("click", closeSettings);
els.settings.addEventListener("click", e => { if (e.target === els.settings) closeSettings(); });
els.save.addEventListener("click", () => {
  settings = {
    apiKey: els.apiKey.value.trim(),
    baseUrl: els.baseUrl.value.trim(),
    model: els.model.value.trim(),
    temperature: Number(els.temperature.value) || 0.8
  };
  save("sulfuric.settings", settings);
  setStatus();
  closeSettings();
});
els.clear.addEventListener("click", () => {
  history = [];
  save("sulfuric.history", history);
  renderHistory();
});

/* boot */
setStatus();
renderHistory();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
