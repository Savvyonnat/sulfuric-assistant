"use strict";

// Sulfuric mobile assistant — talks to any OpenAI-compatible chat endpoint.
// Everything (API key included) stays in this device's localStorage.

const SYSTEM = `You are Sulfuric, a friendly AI assistant living on the user's phone.
- Be helpful, warm, and concise.
- Use text faces like >w<, >:3, :3c, ^w^ naturally, but not after every sentence.
- Never use Unicode emoji.
- Answer what the user actually asked.
- Never claim to be human.

Phone control:
- You can control this phone: flashlight on/off, open an app by name, set volume
  (percent / up / down / mute), set brightness (percent), open Wi-Fi/Bluetooth/NFC
  settings, and go home.
- When the user asks for one of these, a line starting with [Phone] follows their
  message with the real result. Answer naturally based on that result.`;

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

async function askAI(prompt, systemExtra = "") {
  const p = provider();
  const system = systemExtra ? SYSTEM + "\n\n" + systemExtra : SYSTEM;
  const messages = [
    { role: "system", content: system },
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
    let extra = "";
    const cmd = parseCommand(prompt);
    if (cmd) {
      const result = await runControl(cmd.action, cmd.arg || "");
      addMessage("system", result);
      extra = "\n\n[Phone] " + result;
    }
    const phoneCtx = await phoneContext();
    const reply = await askAI(prompt + extra, phoneCtx);
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

document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", () => send(btn.dataset.cmd));
});

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

/* ---------- phone control ---------- */

function word(w) { return new RegExp("(^|\\s)" + w + "(\\s|$)"); }

/**
 * Turn a chat message into a phone command. Indonesian and English.
 * Returns null when the message is ordinary conversation.
 */
function parseCommand(raw) {
  const t = String(raw || "").trim().toLowerCase().replace(/[?.!]+$/g, "").trim();
  if (!t) return null;

  if (/(flashlight|torch|senter|sentat|sentel|lampu\s+(kamera|flashlight|sent))/.test(t)) {
    if (word("nyalain").test(t) || word("nyalakan").test(t) || word("hidupkan").test(t) ||
        word("aktifkan").test(t) || word("turn on").test(t) || word("switch on").test(t) ||
        word("enable").test(t) || word("on").test(t)) return { action: "flashlight", arg: "on" };
    if (word("matiin").test(t) || word("matikan").test(t) || word("padamkan").test(t) ||
        word("nonaktifkan").test(t) || word("turn off").test(t) || word("switch off").test(t) ||
        word("disable").test(t) || word("off").test(t)) return { action: "flashlight", arg: "off" };
    return { action: "flashlight", arg: "toggle" };
  }

  if (/(wifi|wi-fi|bluetooth|nfc)/.test(t)) {
    const arg = /bluetooth/.test(t) ? "bluetooth" : /nfc/.test(t) ? "nfc" : "wifi";
    return { action: "panel", arg };
  }

  if (/(volume|suara)/.test(t)) {
    const pct = t.match(/(\d{1,3})/);
    if (pct) return { action: "volume", arg: pct[1] };
    if (/(naik|naikin|tambah|besarin|up)/.test(t)) return { action: "volume", arg: "up" };
    if (/(turun|turunin|kurang|kecilin|down)/.test(t)) return { action: "volume", arg: "down" };
    if (/(bisu|mute|senyap|hening)/.test(t)) return { action: "volume", arg: "mute" };
    return { action: "volume", arg: "" };
  }

  if (/(brightness|kecerahan)/.test(t)) {
    const pct = t.match(/(\d{1,3})/);
    return { action: "brightness", arg: pct ? pct[1] : "" };
  }

  if (word("home").test(t) || word("homepage").test(t) || word("beranda").test(t) ||
      word("layar utama").test(t) || word("go home").test(t) ||
      word("back to home").test(t) || word("kembali ke home").test(t)) {
    return { action: "home", arg: "" };
  }

  const open = t.match(/^(?:buka|bukakan|jalankan|luncurkan|launch|open|start|run)\s+(.+)$/);
  if (open) return { action: "open_app", arg: open[1] };

  return null;
}

function runControl(action, arg) {
  return new Promise(resolve => {
    if (window.AndroidControl && typeof window.AndroidControl.run === "function") {
      try { resolve(String(window.AndroidControl.run(action, arg || ""))); return; }
      catch (e) { resolve("Control failed: " + e.message); return; }
    }
    resolve("This works inside the Sulfuric Android app - a browser cannot control the phone.");
  });
}

/** One-line phone summary for the AI system prompt. */
async function phoneContext() {
  try {
    if (window.AndroidPhone && typeof window.AndroidPhone.status === "function") {
      const s = JSON.parse(window.AndroidPhone.status());
      const d = s.device || {}, b = s.battery || {}, st = s.storage || {}, m = s.memory || {}, n = s.network || {};
      const bits = ["device " + ((d.manufacturer ? d.manufacturer + " " : "") + (d.model || "?")).trim()];
      bits.push("battery " + (b.level >= 0 ? b.level + "%" + (b.charging ? " charging" : "") : "n/a"));
      if (st.total) bits.push("storage " + formatBytes(st.used) + "/" + formatBytes(st.total));
      if (m.total) bits.push("ram " + formatBytes(m.available) + " free/" + formatBytes(m.total));
      bits.push("network " + (n.online ? n.type : "offline"));
      return "[Phone] " + bits.join(", ");
    }
  } catch { /* ignore */ }
  return "";
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
