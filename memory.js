// Long-term per-user memory for the Sulfuric AI agent.
//
// Facts live in database.json under memory["guildId:userId"] = ["fact", ...].
// They are injected into the AI system prompt, so the agent remembers things
// across sessions and conversations.

const MAX_FACTS = 20;
const MAX_LEN = 200;

function keyOf(guildId, userId) {
  return `${guildId}:${userId}`;
}

function bucket(db, key) {
  if (!db.memory) db.memory = {};
  if (!Array.isArray(db.memory[key])) db.memory[key] = [];
  return db.memory[key];
}

function remember(db, guildId, userId, fact) {
  const clean = String(fact || "").trim().replace(/\s+/g, " ");
  if (!clean) return { ok: false, reason: "empty" };
  if (clean.length > MAX_LEN) return { ok: false, reason: "too long" };
  const list = bucket(db, keyOf(guildId, userId));
  const lower = clean.toLowerCase();
  if (list.some(f => f.toLowerCase() === lower)) return { ok: false, reason: "duplicate", count: list.length };
  list.push(clean);
  if (list.length > MAX_FACTS) list.shift();
  return { ok: true, count: list.length };
}

function forget(db, guildId, userId, query) {
  const key = keyOf(guildId, userId);
  const list = db.memory?.[key] || [];
  if (!list.length) return { ok: false, reason: "empty" };

  const q = String(query || "").trim().toLowerCase();
  let idx = -1;
  if (/^#\d+$/.test(q)) {
    idx = Number(q.slice(1)) - 1;
  } else {
    idx = list.findIndex(f => f.toLowerCase() === q);
    if (idx === -1) idx = list.findIndex(f => f.toLowerCase().includes(q));
  }
  if (idx < 0 || idx >= list.length) return { ok: false, reason: "not found" };

  const removed = list.splice(idx, 1)[0];
  if (!list.length) delete db.memory[key];
  return { ok: true, removed };
}

function listFacts(db, guildId, userId) {
  return (db.memory?.[keyOf(guildId, userId)] || []).slice();
}

/** Render facts for the AI system prompt ("" when there are none). */
function render(db, guildId, userId) {
  const list = listFacts(db, guildId, userId);
  if (!list.length) return "";
  return "Things you remember about this user:\n" + list.map((f, i) => `${i + 1}. ${f}`).join("\n");
}

module.exports = { remember, forget, listFacts, render, keyOf, MAX_FACTS };
