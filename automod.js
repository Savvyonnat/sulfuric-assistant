// Toxic-language AutoMod — multi-language.
//
// Two matching passes:
//   1. Word-boundary pass on the normalized text (low false positives).
//   2. Squash pass on text with all whitespace removed. This catches separators
//      like "f.u.c.k" / "f u c k". It only runs when the message actually looks
//      letter-separated (e.g. "f u c k"), so ordinary words such as "babies" or
//      "masuk" are never flagged by accident.
//
// Normalization: NFKD + diacritics stripped, ß->ss, leet digits mapped,
// repeated letters collapsed, punctuation treated as spaces.
//
// Env:
//   AUTOMOD_MIN_SCORE  minimum severity score before flagging (default 1 = any hit).

const TERMS = [];
function term(lang, source, { squash = true, severity = 2 } = {}) {
  // Match against the *normalized* spelling so accents/leet inside the lexicon
  // still hit the accent-stripped message text.
  const src = normalize(source);
  const stretched = src
    .split(/\s+/)
    .map(w => w.split("").map(c => c + "+").join(""))
    .join("\\s+");
  TERMS.push({
    lang,
    re: new RegExp("\\b(?:" + stretched + ")\\b", "i"),
    squashRe: new RegExp(stretched.replace(/\\s\+/g, "\\s*"), "i"),
    squash,
    severity
  });
}

/* ---------------- English ---------------- */
term("en", "fuck"); term("en", "motherfucker"); term("en", "shit"); term("en", "bullshit");
term("en", "bitch"); term("en", "bastard"); term("en", "cunt"); term("en", "dickhead");
term("en", "dick"); term("en", "asshole"); term("en", "arsehole"); term("en", "slut");
term("en", "whore"); term("en", "retard"); term("en", "retarded"); term("en", "piss off");
term("en", "stfu"); term("en", "gtfo"); term("en", "kys");
term("en", "kill yourself"); term("en", "i hope you die"); term("en", "you should die");
term("en", "idiot"); term("en", "stupid"); term("en", "dumb", { squash: false });
term("en", "dumbass"); term("en", "jackass"); term("en", "loser", { squash: false });

/* ---------------- Indonesian / Malay ---------------- */
term("id", "anjing"); term("id", "asu"); term("id", "babi"); term("id", "bangsat");
term("id", "goblok"); term("id", "tolol"); term("id", "bodoh"); term("id", "kontol");
term("id", "memek"); term("id", "ngentot"); term("id", "jancuk"); term("id", "tai", { squash: false });
term("id", "bajingan"); term("id", "brengsek"); term("id", "sialan"); term("id", "celaka");
term("id", "iblis"); term("id", "setan"); term("id", "monyet"); term("id", "lonte");
term("id", "perek");

/* ---------------- Spanish ---------------- */
term("es", "mierda"); term("es", "puta"); term("es", "puto"); term("es", "cabrón", { squash: false });
term("es", "pendejo"); term("es", "culero"); term("es", "verga");
term("es", "joder");
term("es", "gilipollas"); term("es", "maricón", { squash: false });
term("es", "zorra"); term("es", "pinche");
term("es", "chingada"); term("es", "chingar"); term("es", "idiota"); term("es", "estupido");
term("es", "maldito"); term("es", "hijueputa");

/* ---------------- Portuguese ---------------- */
term("pt", "merda"); term("pt", "puta"); term("pt", "puto"); term("pt", "caralho");
term("pt", "porra"); term("pt", "bosta"); term("pt", "foder");
term("pt", "sacanagem"); term("pt", "viado"); term("pt", "bicha"); term("pt", "corno");
term("pt", "safado"); term("pt", "sacana"); term("pt", "arrombado"); term("pt", "piranha");
term("pt", "desgraça", { squash: false }); term("pt", "puta que pariu"); term("pt", "filho da puta");

/* ---------------- French ---------------- */
term("fr", "merde"); term("fr", "putain"); term("fr", "salope"); term("fr", "connard");
term("fr", "enculé", { squash: false }); term("fr", "nique"); term("fr", "baiser");
term("fr", "pd"); term("fr", "bordel"); term("fr", "foutre");
term("fr", "chier"); term("fr", "emmerder"); term("fr", "abruti"); term("fr", "ducon");
term("fr", "fils de pute"); term("fr", "couillon");

/* ---------------- German ---------------- */
term("de", "scheiße", { squash: false }); term("de", "arschloch");
term("de", "hurensohn"); term("de", "verdammt"); term("de", "fotze"); term("de", "schwul");
term("de", "wichser"); term("de", "mist"); term("de", "fresze"); term("de", "arsch");
term("de", "dreckschwein"); term("de", "verschissener"); term("de", "depp");

/* ---------------- Italian ---------------- */
term("it", "merda"); term("it", "cazzo"); term("it", "fanculo"); term("it", "puttana");
term("it", "stronzo"); term("it", "bastardo"); term("it", "merdaccia"); term("it", "porca");
term("it", "minchia"); term("it", "pezzo di merda"); term("it", "figlio di puttana");
term("it", "schifo"); term("it", "testa di cazzo");

/* ---------------- Turkish ---------------- */
term("tr", "amk"); term("tr", "orospu"); term("tr", "orospucocu");
term("tr", "yarrak"); term("tr", "sikik"); term("tr", "göt");
term("tr", "ibne"); term("tr", "kaltak"); term("tr", "dalyarak"); term("tr", "amcik");
term("tr", "manyak"); term("tr", "gerizekali"); term("tr", "lanet"); term("tr", "aptal");

/* ---------------- Arabic (transliterated) ---------------- */
term("ar", "kalb"); term("ar", "sharmouta"); term("ar", "sharmout"); term("ar", "kuss");
term("ar", "ibn el kalb"); term("ar", "ya kelb");

/* ---------------- Hindi / Urdu (transliterated) ---------------- */
term("hi", "madarchod"); term("hi", "behenchod"); term("hi", "chutiya"); term("hi", "gandu");
term("hi", "randi"); term("hi", "harami"); term("hi", "lund"); term("hi", "lode");
term("hi", "betichod"); term("hi", "bhosadike"); term("hi", "gaand"); term("hi", "kutiya");
term("hi", "chut"); term("hi", "bahen ke lode");

/* ---------------- Russian (transliterated) ---------------- */
term("ru", "blyat"); term("ru", "blyad"); term("ru", "pizda");
term("ru", "urod"); term("ru", "mudila"); term("ru", "nahuj"); term("ru", "zaebis");
term("ru", "eblan"); term("ru", "huj");

/* ---------------- Vietnamese (transliterated) ---------------- */
term("vi", "mekiep"); term("vi", "buoi"); term("vi", "dcm");
term("vi", "dmm"); term("vi", "vkl"); term("vi", "clgt");

/* ---------------- Korean (romanized) ---------------- */
term("ko", "ssibal"); term("ko", "shibal"); term("ko", "byeongsin"); term("ko", "gaesaekki");
term("ko", "gaessaekki");

/* ---------------- Japanese (romanized) ---------------- */
term("ja", "kuso"); term("ja", "kisama"); term("ja", "temee"); term("ja", "korosu");
term("ja", "baka", { squash: false }); term("ja", "aho", { squash: false });

/* ---------------- Tagalog / Filipino ---------------- */
term("tl", "putangina"); term("tl", "pangina"); term("tl", "gago"); term("tl", "tanga");
term("tl", "burat"); term("tl", "lintik"); term("tl", "hayop");

/* ---------------- Dutch ---------------- */
term("nl", "kut"); term("nl", "lul"); term("nl", "tyfus"); term("nl", "godverdomme");
term("nl", "hoer"); term("nl", "klote"); term("nl", "verdomme"); term("nl", "neuken");

/* ---------------- Polish ---------------- */
term("pl", "kurwa"); term("pl", "pierdol"); term("pl", "jebać", { squash: false });
term("pl", "huj"); term("pl", "dziwka"); term("pl", "skurwysyn"); term("pl", "chuj");
term("pl", "dupa");

/* ---------------- Swedish / Norwegian ---------------- */
term("sv", "helvete"); term("sv", "jävla", { squash: false }); term("sv", "hora");
term("sv", "kuk"); term("sv", "skit"); term("sv", "perke");

/* ---------------- Harassment phrases ---------------- */
term("xx", "kill yourself"); term("xx", "kill your self"); term("xx", "i hope you die");
term("xx", "you should die"); term("xx", "go kill yourself");

function normalize(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")                 // strip combining diacritics
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .toLowerCase()
    .replace(/[​-‍﻿]/g, "")       // zero-width characters
    .replace(/[4@]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!]/g, "i")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[0]/g, "o")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/(.)\1{3,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

function detectToxic(text) {
  const value = normalize(text);
  if (!value) return { toxic: false, normalized: value, matches: [], score: 0 };

  const matches = [];
  // Only attempt the separator-resistant pass when the message looks like it has
  // letters split apart ("f u c k", "s.h.i.t").
  const looksSplit = /(^|\s)[a-z0-9](\s|$)/.test(value);
  const squashed = value.replace(/\s+/g, "");

  for (const t of TERMS) {
    if (t.re.test(value)) {
      matches.push({ lang: t.lang, severity: t.severity });
    } else if (looksSplit && t.squash && t.squashRe.test(squashed)) {
      matches.push({ lang: t.lang, severity: t.severity, obfuscated: true });
    }
  }

  const score = matches.reduce((a, m) => a + m.severity, 0);
  const minScore = Number(process.env.AUTOMOD_MIN_SCORE || 1);
  return { toxic: matches.length > 0 && score >= minScore, normalized: value, matches, score };
}

module.exports = { detectToxic, normalize, TERMS };
