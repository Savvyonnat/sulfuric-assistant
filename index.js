require("dotenv").config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder, ActivityType } = require("discord.js");
const { Jimp } = require("jimp");
const GifEncoder = require("gif-encoder");
const fs = require("fs");
const path = require("path");
const { detectToxic } = require("./automod");
const { askAI, providerName } = require("./ai");
const memory = require("./memory");
const music = require("./music");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN) {
  console.error("Missing DISCORD_TOKEN in .env — copy .env.example to .env and fill it in.");
  process.exit(1);
}

const ACTIVITY_NAME = process.env.ACTIVITY_NAME || process.env.STREAM_NAME || "Sulfuric Online >w<";
const POLL_REACTIONS = ["1\uFE0F\u20E3", "2\uFE0F\u20E3", "3\uFE0F\u20E3", "4\uFE0F\u20E3", "5\uFE0F\u20E3"];
const GIVEAWAY_REACTION = "\u{1F389}";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });
const DB_FILE = path.join(__dirname, "database.json");

function loadDB() {
  try {
    const d = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : {};
    return { warnings: d.warnings || {}, joins: d.joins || {}, security: d.security || {}, automod: d.automod || {}, gifts: d.gifts || {}, afk: d.afk || {}, memory: d.memory || {} };
  } catch (e) {
    console.error("Failed to read database.json:", e);
    return { warnings: {}, joins: {}, security: {}, automod: {}, gifts: {}, afk: {}, memory: {} };
  }
}
function saveDB(db) {
  try {
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, DB_FILE);
  } catch (e) { console.error("Failed to save database:", e); }
}
const db = loadDB();
const aiHistory = new Map();
const aiCooldowns = new Map();
const AI_COOLDOWN_MS = Number(process.env.AI_COOLDOWN_MS || 5000);
function cooldownLeft(key) {
  const last = aiCooldowns.get(key) || 0;
  const left = AI_COOLDOWN_MS - (Date.now() - last);
  if (left > 0) return Math.ceil(left / 1000);
  aiCooldowns.set(key, Date.now());
  return 0;
}

function securityEnabled(guildId) { return db.security[guildId] !== false; }
function automodEnabled(guildId) { return db.automod[guildId] !== false; }
function isAdmin(member) { return !!member?.permissions?.has(PermissionFlagsBits.Administrator); }
function isMod(member) { return isAdmin(member) || !!member?.permissions?.has(PermissionFlagsBits.ManageGuild); }
function hasPerm(member, perm) { return isMod(member) || !!member?.permissions?.has(perm); }
function isOwner(member) {
  if (!member) return false;
  if (process.env.OWNER_ID && member.id === process.env.OWNER_ID) return true;
  const owner = client.application?.owner;
  return !!owner && owner.id === member.id;
}
const ROLE_DECLINED = "command-checkingrole-roledeclined-sorry";
// Moderation commands and the permission each one requires.
const MOD_PERMISSIONS = {
  ban: PermissionFlagsBits.BanMembers,
  kick: PermissionFlagsBits.KickMembers,
  timeout: PermissionFlagsBits.ModerateMembers,
  warn: PermissionFlagsBits.ManageMessages,
  purge: PermissionFlagsBits.ManageMessages,
  cleanup: PermissionFlagsBits.ManageGuild,
  automod: PermissionFlagsBits.ManageGuild,
  security: PermissionFlagsBits.ManageGuild,
  say: PermissionFlagsBits.ManageMessages,
  giveaway: PermissionFlagsBits.ManageGuild
};
async function requirePermission(i, perm) {
  if (hasPerm(i.member, perm)) return true;
  await i.reply({ content: ROLE_DECLINED, ephemeral: true }).catch(() => {});
  return false;
}
function getSubcommand(i) { try { return i.options.getSubcommand(); } catch { return null; } }
async function getMember(i, id) { try { return await i.guild.members.fetch(id); } catch { return null; } }
function uptime() {
  const s = Math.floor(process.uptime());
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function targetError(i, target) {
  if (!target) return "That member is not in the server.";
  if (target.id === i.user.id) return "You cannot do this to yourself.";
  if (target.id === client.user.id) return "Please do not moderate Sulfuric >w<";
  const authorHighest = i.member?.roles?.highest;
  if (!authorHighest) return "Could not determine your role position. Try again.";
  if (i.guild.ownerId !== i.user.id && target.roles.highest.position >= authorHighest.position) return "The target's highest role is equal to or higher than yours.";
  if (target.roles.highest.position >= i.guild.members.me.roles.highest.position) return "Sulfuric's highest role must be higher than the target's role.";
  return null;
}

const answers = ["Yes, definitely.", "It is certain.", "Without a doubt.", "Most likely.", "Outlook good.", "Cannot predict now.", "Ask again later.", "Better not tell you now.", "Don't count on it.", "Very doubtful.", "My sources say no.", "Signs point to yes."];
const jokes = [
  "I told my computer I needed a break. Now it will not stop sending me KitKat ads.",
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "I would tell you a UDP joke, but you might not get it.",
  "There are only 10 kinds of people: those who understand binary and those who do not.",
  "A SQL query walks into a bar, sees two tables and asks... mind if I join you?",
  "Why did the developer go broke? Because he used up all his cache.",
  "I have a joke about recursion, but I have a joke about recursion.",
  "JavaScript is like a broken pencil: it has no point."
];
const facts = [
  "Honey never spoils. Archaeologists have tasted 3000-year-old honey and found it edible.",
  "Octopuses have three hearts and blue blood.",
  "A day on Venus is longer than a year on Venus.",
  "Bananas are berries, but strawberries are not.",
  "The Eiffel Tower grows about 15 cm taller in summer.",
  "Wombat poop is cube-shaped.",
  "Sea otters hold hands while sleeping so they do not drift apart.",
  "The first computer bug was a real moth found in a Harvard Mark II in 1947."
];
const funReplies = {
  defenestrate: target => `*opens the window* ${target} has been gently defenestrated. In spirit. >w<`,
  gnaw: target => `*nom nom* ${target} received a tiny chaotic gnaw. >w<`,
  hamburger: target => `Here, ${target}, have a hamburger. >w<`,
  hug: target => `*wraps ${target} in a warm hug* >w<`,
  arrest: target => `Stop right there, ${target}. You are under arrest for excessive silliness. >:3`,
  bap: target => `*bap bap* ${target} has been bonked with affection. >w<`,
  bite: target => `*nom* ${target} got a playful little bite. >:3`,
  blowup: target => `*stares intensely* The pancakes near ${target} have exploded with mind powers. >w<`,
  boop: target => `*boop* ${target}'s snoot has been booped. >w<`,
  carry: target => `*yoink* ${target} is being carried away. >w<`,
  jumpscare: target => `BOO. ${target} has been jumpscared. >:3`,
  kiss: target => `*mwah* ${target} received a sweet little kiss. >w<`,
  meow: target => `Mrrrrow at ${target}. >w<`,
  murder: target => `*dramatic cartoon bonk* ${target} has been defeated in a fictional way. >:3`,
  pat: target => `*pat pat pat* Good goober, ${target}. >w<`,
  poke: target => `*poke poke poke* Hey ${target}, pay attention. >w<`
};

const commands = [
  // Moderation
  new SlashCommandBuilder().setName("ban").setDescription("Ban a member").addUserOption(o => o.setName("user").setDescription("Member to ban").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a member").addUserOption(o => o.setName("user").setDescription("Member to kick").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a member").addUserOption(o => o.setName("user").setDescription("Member to timeout").setRequired(true)).addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes").setMinValue(1).setMaxValue(40320).setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder().setName("warn").setDescription("Manage warnings").addSubcommand(s => s.setName("add").setDescription("Add a warning").addUserOption(o => o.setName("user").setDescription("Member").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason"))).addSubcommand(s => s.setName("revoke").setDescription("Revoke one warning").addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))).addSubcommand(s => s.setName("list").setDescription("List warnings in this server").addUserOption(o => o.setName("user").setDescription("Filter by member"))),
  new SlashCommandBuilder().setName("purge").setDescription("Delete recent messages").addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100).setRequired(true)).addUserOption(o => o.setName("user").setDescription("Only delete messages from this member")),
  new SlashCommandBuilder().setName("cleanup").setDescription("Delete recent messages (owner only)").addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName("automod").setDescription("Configure toxic-message AutoMod").addBooleanOption(o => o.setName("enabled").setDescription("Enable or disable AutoMod").setRequired(true)),
  new SlashCommandBuilder().setName("security").setDescription("Configure anti-raid protection").addBooleanOption(o => o.setName("enabled").setDescription("Enable or disable security").setRequired(true)),
  // Roles and channels
  new SlashCommandBuilder().setName("role").setDescription("Manage roles").addSubcommand(s => s.setName("add").setDescription("Add a role to a member").addUserOption(o => o.setName("user").setDescription("Member").setRequired(true)).addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))).addSubcommand(s => s.setName("remove").setDescription("Remove a role from a member").addUserOption(o => o.setName("user").setDescription("Member").setRequired(true)).addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))),
  new SlashCommandBuilder().setName("nickname").setDescription("Change a member nickname").addUserOption(o => o.setName("user").setDescription("Member").setRequired(true)).addStringOption(o => o.setName("name").setDescription("New nickname (leave empty to clear)")),
  new SlashCommandBuilder().setName("slowmode").setDescription("Set channel slowmode").addIntegerOption(o => o.setName("seconds").setDescription("Seconds between messages (0 to disable)").setMinValue(0).setMaxValue(21600).setRequired(true)),
  new SlashCommandBuilder().setName("lock").setDescription("Lock this channel").addChannelOption(o => o.setName("channel").setDescription("Channel (default: this one)")),
  new SlashCommandBuilder().setName("unlock").setDescription("Unlock this channel").addChannelOption(o => o.setName("channel").setDescription("Channel (default: this one)")),
  new SlashCommandBuilder().setName("say").setDescription("Send a message as Sulfuric").addStringOption(o => o.setName("text").setDescription("Message text").setRequired(true)),
  // Utilities
  new SlashCommandBuilder().setName("ping").setDescription("Check latency"),
  new SlashCommandBuilder().setName("avatar").setDescription("View an avatar").addUserOption(o => o.setName("user").setDescription("User")),
  new SlashCommandBuilder().setName("serverinfo").setDescription("View server information"),
  new SlashCommandBuilder().setName("userinfo").setDescription("View user information").addUserOption(o => o.setName("user").setDescription("User")),
  new SlashCommandBuilder().setName("membercount").setDescription("Show member statistics"),
  new SlashCommandBuilder().setName("invite").setDescription("Create an invite link for this channel"),
  new SlashCommandBuilder().setName("weather").setDescription("Get accurate current weather").addStringOption(o => o.setName("city").setDescription("City name (default: your location)")),
  new SlashCommandBuilder().setName("photo2gif").setDescription("Turn an image into a GIF").addAttachmentOption(o => o.setName("photo").setDescription("Image").setRequired(true)),
  new SlashCommandBuilder().setName("uwuify").setDescription("Uwuify text").addStringOption(o => o.setName("text").setDescription("Text").setRequired(true)),
  new SlashCommandBuilder().setName("ai").setDescription("Chat with Sulfuric's AI").addStringOption(o => o.setName("message").setDescription("Message for Sulfuric").setRequired(true)),
  new SlashCommandBuilder().setName("remember").setDescription("Tell Sulfuric to remember something about you").addStringOption(o => o.setName("fact").setDescription("What to remember").setRequired(true)),
  new SlashCommandBuilder().setName("forget").setDescription("Forget a remembered fact").addStringOption(o => o.setName("query").setDescription("Fact text or #number").setRequired(true)),
  new SlashCommandBuilder().setName("memories").setDescription("List what Sulfuric remembers about you"),
  new SlashCommandBuilder().setName("play").setDescription("Play a song in a voice channel").addStringOption(o => o.setName("query").setDescription("Song title or YouTube URL").setRequired(true)),
  new SlashCommandBuilder().setName("skip").setDescription("Skip the current song"),
  new SlashCommandBuilder().setName("stop").setDescription("Stop playback and clear the queue"),
  new SlashCommandBuilder().setName("list").setDescription("Show the song queue"),
  new SlashCommandBuilder().setName("proxy").setDescription("Run another bot's command (owner or admin)").addUserOption(o => o.setName("bot").setDescription("Target bot").setRequired(true)).addStringOption(o => o.setName("command").setDescription("Command for the target bot to run").setRequired(true)),
  new SlashCommandBuilder().setName("ytmp3").setDescription("Download a song as MP3").addStringOption(o => o.setName("url").setDescription("YouTube URL or song title").setRequired(true)),
  // Fun
  new SlashCommandBuilder().setName("gift").setDescription("Send a gift-style embed").addUserOption(o => o.setName("user").setDescription("Recipient").setRequired(true)).addStringOption(o => o.setName("item").setDescription("Gift item").setRequired(true)).addIntegerOption(o => o.setName("quantity").setDescription("Quantity").setMinValue(1).setMaxValue(99).setRequired(true)).addIntegerOption(o => o.setName("coins").setDescription("Coins per gift").setMinValue(0).setMaxValue(100000).setRequired(true)),
  new SlashCommandBuilder().setName("poll").setDescription("Create a reaction poll").addStringOption(o => o.setName("question").setDescription("Poll question").setRequired(true)).addStringOption(o => o.setName("option1").setDescription("First option").setRequired(true)).addStringOption(o => o.setName("option2").setDescription("Second option").setRequired(true)).addStringOption(o => o.setName("option3").setDescription("Third option")).addStringOption(o => o.setName("option4").setDescription("Fourth option")).addStringOption(o => o.setName("option5").setDescription("Fifth option")),
  new SlashCommandBuilder().setName("giveaway").setDescription("Start a reaction giveaway").addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes").setMinValue(1).setMaxValue(1440).setRequired(true)).addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true)),
  new SlashCommandBuilder().setName("remind").setDescription("Set a personal reminder").addIntegerOption(o => o.setName("minutes").setDescription("Minutes from now").setMinValue(1).setMaxValue(1440).setRequired(true)).addStringOption(o => o.setName("message").setDescription("Reminder message").setRequired(true)),
  new SlashCommandBuilder().setName("afk").setDescription("Set or clear your AFK status").addStringOption(o => o.setName("message").setDescription("AFK message (leave empty to clear)")),
  new SlashCommandBuilder().setName("coinflip").setDescription("Flip a coin"),
  new SlashCommandBuilder().setName("dice").setDescription("Roll a die").addIntegerOption(o => o.setName("sides").setDescription("Number of sides").setMinValue(2).setMaxValue(100)),
  new SlashCommandBuilder().setName("8ball").setDescription("Ask the magic 8-ball").addStringOption(o => o.setName("question").setDescription("Question").setRequired(true)),
  new SlashCommandBuilder().setName("rps").setDescription("Rock paper scissors").addStringOption(o => o.setName("choice").setDescription("Your choice").setRequired(true).addChoices({ name: "Rock", value: "rock" }, { name: "Paper", value: "paper" }, { name: "Scissors", value: "scissors" })),
  new SlashCommandBuilder().setName("joke").setDescription("Tell a joke"),
  new SlashCommandBuilder().setName("fact").setDescription("Tell a random fact"),
  // Info
  new SlashCommandBuilder().setName("help").setDescription("List all commands"),
  new SlashCommandBuilder().setName("about").setDescription("About Sulfuric"),
  ...Object.keys(funReplies).map(name => new SlashCommandBuilder().setName(name).setDescription(`Cute ${name} action`).addUserOption(o => o.setName("user").setDescription("Target").setRequired(true)))
].map(c => c.toJSON());

function uwuify(text) { return text.replace(/r|l/g, "w").replace(/R|L/g, "W").replace(/n([aeiou])/gi, "ny$1").replace(/ove/gi, "uv").replace(/\s+/g, " ").trim() + " >w<"; }

async function photoToGif(buffer) {
  const source = await Jimp.read(buffer);
  const max = 480;
  const scale = Math.min(1, max / source.bitmap.width, max / source.bitmap.height);
  const w = Math.max(1, Math.round(source.bitmap.width * scale));
  const h = Math.max(1, Math.round(source.bitmap.height * scale));
  source.resize({ w, h });

  // A plain, static GIF: one frame, no animation.
  const enc = new GifEncoder(w, h);
  const chunks = [];
  const done = new Promise((resolve, reject) => { enc.on("data", c => chunks.push(Buffer.from(c))); enc.on("end", () => resolve(Buffer.concat(chunks))); enc.on("error", reject); });
  enc.setRepeat(0);
  enc.setDelay(1000);
  enc.setQuality(10);
  enc.writeHeader();
  enc.addFrame(source.bitmap.data);
  enc.finish();
  return done;
}

const WMO_CODES = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  56: "Light freezing drizzle", 57: "Dense freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Light freezing rain", 67: "Heavy freezing rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
};

async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const r = await fetch(url, { headers: { "User-Agent": "Sulfuric/5.0" } });
  if (!r.ok) throw new Error(`geocoding ${r.status}`);
  const data = await r.json();
  const hit = data.results?.[0];
  if (!hit) return null;
  return { name: hit.name, country: hit.country || "", admin1: hit.admin1 || "", latitude: hit.latitude, longitude: hit.longitude };
}

async function locate() {
  // Try IP geolocation first so the default is the user's real location.
  try {
    const r = await fetch("https://ipwho.is/", { headers: { "User-Agent": "Sulfuric/5.0" } });
    if (r.ok) {
      const d = await r.json();
      if (d.success && typeof d.latitude === "number" && typeof d.longitude === "number") {
        return { name: d.city || "Your location", country: d.country || "", admin1: d.region || "", latitude: d.latitude, longitude: d.longitude };
      }
    }
  } catch { /* fall through */ }
  try {
    const r = await fetch("http://ip-api.com/json/?fields=status,message,city,country,lat,lon", { headers: { "User-Agent": "Sulfuric/5.0" } });
    if (r.ok) {
      const d = await r.json();
      if (d.status === "success") return { name: d.city || "Your location", country: d.country || "", admin1: "", latitude: d.lat, longitude: d.lon };
    }
  } catch { /* ignore */ }
  return null;
}

async function getWeather(city) {
  let place = null;
  if (city?.trim()) {
    place = await geocode(city.trim());
    if (!place) return { error: `I could not find a place called "${city}". Check the spelling or try a bigger nearby city.` };
  } else {
    place = await locate();
    if (!place) return { error: "I could not determine your location. Please give me a city name." };
  }

  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "1"
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { headers: { "User-Agent": "Sulfuric/5.0" } });
  if (!r.ok) throw new Error(`weather ${r.status}`);
  const data = await r.json();
  const cur = data.current, day = data.daily;
  if (!cur) throw new Error("no weather data");

  const condition = WMO_CODES[cur.weather_code] || "Unknown";
  const location = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
  return {
    location, condition,
    temperature: cur.temperature_2m,
    feelsLike: cur.apparent_temperature,
    humidity: cur.relative_humidity_2m,
    wind: cur.wind_speed_10m,
    precipitation: cur.precipitation,
    isDay: cur.is_day === 1,
    max: day?.temperature_2m_max?.[0],
    min: day?.temperature_2m_min?.[0],
    time: cur.time
  };
}

async function addWarning(guildId, userId) { const key = `${guildId}:${userId}`; db.warnings[key] = (db.warnings[key] || 0) + 1; saveDB(db); return db.warnings[key]; }
async function applyAutoWarning(message) {
  const count = await addWarning(message.guild.id, message.author.id); let action = "warning recorded"; const member = message.member;
  if (count === 3 && member?.moderatable) { await member.timeout(10 * 60 * 1000, "Sulfuric AutoMod: repeated toxic messages").catch(() => {}); action = "10 minute timeout added"; }
  else if (count >= 5 && member?.bannable) { await member.ban({ reason: "Sulfuric AutoMod: repeated toxic messages" }).catch(() => {}); action = "member banned after repeated warnings"; }
  return { count, action };
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({ activities: [{ name: ACTIVITY_NAME, type: ActivityType.Playing }], status: "online" });

  try {
    if (!CLIENT_ID) throw new Error("CLIENT_ID is not set in .env");
    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`Slash commands registered on guild ${GUILD_ID}`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log("Slash commands registered globally (may take up to 1 hour to propagate)");
    }
  } catch (e) {
    console.error("Failed to register slash commands:", e.message);
  }
});

client.on("guildMemberAdd", async member => {
  if (!securityEnabled(member.guild.id)) return;
  try {
    const key = `${member.guild.id}:${member.id}`;
    const joinCount = (db.joins[key] || 0) + 1;
    db.joins[key] = joinCount;
    saveDB(db);

    // A first join is never a raid signal. Only act on repeat joiners and very fresh accounts.
    const accountAgeMs = Date.now() - member.user.createdAt.getTime();
    const freshAccount = accountAgeMs < 24 * 60 * 60 * 1000;

    if (joinCount >= 5 && member.bannable) {
      await member.ban({ reason: `Sulfuric anti-raid: repeated join #${joinCount}` });
      return;
    }
    if (joinCount >= 2 && member.moderatable) {
      await member.timeout(
        Math.min(joinCount * 10 * 60 * 1000, 28 * 24 * 60 * 60 * 1000),
        `Sulfuric anti-raid join #${joinCount}`
      );
    } else if (joinCount === 1 && freshAccount && member.moderatable) {
      await member.timeout(10 * 60 * 1000, "Sulfuric anti-raid: newly created account");
    }
  } catch (e) {
    console.error("guildMemberAdd:", e);
  }
});

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  if (automodEnabled(message.guild.id)) {
    const result = detectToxic(message.content);
    if (result.toxic) {
      await message.delete().catch(() => {});
      const data = await applyAutoWarning(message);
      const langs = [...new Set((result.matches || []).map(m => m.lang))].filter(l => l !== "xx");
      const langText = langs.length ? ` (${langs.join(", ")})` : "";
      const notice = await message.channel.send(
        `Sulfuric AutoMod: ${message.author} your message was removed for toxic language${langText}. Warning #${data.count} recorded; ${data.action}. >w<`
      ).catch(() => null);
      if (notice) setTimeout(() => notice.delete().catch(() => {}), 8000);
      return;
    }
  }

  // Lightweight memory capture: "remember ..." / "ingat ...".
  const capture = message.content.match(/(?:^|\s)(?:please\s+)?(?:remember|ingat|note that)\s+(.{3,120})$/i);
  if (capture) {
    const res = memory.remember(db, message.guild.id, message.author.id, capture[1].replace(/[.!]+$/, ""));
    if (res.ok) saveDB(db);
  }

  // AFK notifications: tell people who mention an AFK member.
  if (message.mentions.users.size) {
    for (const [, mentioned] of message.mentions.users) {
      if (mentioned.bot) continue;
      const afk = db.afk[`${message.guild.id}:${mentioned.id}`];
      if (afk) {
        await message.channel.send(`${mentioned} is AFK: ${afk.message || "no reason given"}`).catch(() => {});
      }
    }
  }

  // Prefix commands: !play, !skip, !stop, !list, !ytmp3
  const prefix = message.content.match(/^!(play|skip|stop|list|ytmp3)\b\s*([\s\S]*)$/i);
  if (prefix) {
    const cmd = prefix[1].toLowerCase();
    const arg = (prefix[2] || "").trim();
    if (cmd === "play") {
      if (!arg) return message.channel.send("Usage: `!play <song name>`").catch(() => {});
      return message.channel.send(await music.play(message.guild, message.member, arg)).catch(() => {});
    }
    if (cmd === "skip") return message.channel.send(music.skip(message.guild)).catch(() => {});
    if (cmd === "stop") return message.channel.send(music.stop(message.guild)).catch(() => {});
    if (cmd === "list") return message.channel.send(music.list(message.guild)).catch(() => {});
    if (cmd === "ytmp3") {
      if (!arg) return message.channel.send("Usage: `!ytmp3 <url or title>`").catch(() => {});
      try {
        const song = await music.resolveSong(arg);
        if (!song) return message.channel.send("Couldn't find a song for that.").catch(() => {});
        const file = await music.downloadMp3(song.url);
        if (fs.statSync(file).size > 25 * 1024 * 1024) {
          try { fs.unlinkSync(file); } catch { /* ignore */ }
          return message.channel.send("That song is too large (>25 MB).").catch(() => {});
        }
        const safe = (song.title || "song").replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "song";
        return message.channel.send({ content: `**${song.title}**`, files: [new AttachmentBuilder(file, { name: safe + ".mp3" })] }).catch(() => {});
      } catch (e) {
        return message.channel.send("Failed to download the song: " + String(e.message).slice(0, 150)).catch(() => {});
      }
    }
  }

  // Figure out why this message is directed at the bot: an @mention, or a reply
  // to one of Sulfuric's own messages.
  const mentioned = message.mentions.users.has(client.user.id);

  let replyContext = "";
  let replyToBot = false;
  if (message.reference?.messageId) {
    const ref = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
    if (ref) {
      replyToBot = ref.author.id === client.user.id;
      replyContext = (ref.content || ref.embeds?.[0]?.description || "").trim();
    }
  }

  if (!mentioned && !replyToBot) return;

  const prompt = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();
  if (!prompt) return message.reply("mrrp? you called me? >w<").catch(() => {});

  // Give the AI the message it is replying to, so it knows what the chat is about.
  const fullPrompt = replyContext
    ? `The user is replying to my earlier message: "${replyContext.slice(0, 500)}"\nThe user's reply: ${prompt}`
    : prompt;

  const key = `${message.guild.id}:${message.author.id}`;
  const wait = cooldownLeft(key);
  if (wait) return message.reply(`AI lagi sibuk, coba lagi dalam ${wait} detik. >w<`).catch(() => {});

  const history = aiHistory.get(key) || [];
  try {
    await message.channel.sendTyping();
    const text = await askAI(fullPrompt, history);
    history.push({ role: "user", content: fullPrompt }, { role: "assistant", content: text });
    aiHistory.set(key, history.slice(-8));
    await message.reply(text);
  } catch (e) {
    console.error("AI:", e.message);
    const busy = /FREE_LIMIT|rate limit|HTTP (402|429|5\d\d)/i.test(e.message);
    await message.reply(
      busy
        ? "AI provider-nya sedang sibuk (limit penggunaan). Coba lagi sebentar. >w<"
        : "My AI could not answer right now. Please try again in a moment. >w<"
    ).catch(() => {});
  }
});

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;
  try {
    const name = i.commandName; const sub = getSubcommand(i);
    // Moderation commands are admin-only: check the role before running anything.
    const requiredPerm = MOD_PERMISSIONS[name];
    if (requiredPerm && !(await requirePermission(i, requiredPerm))) return;

    if (name === "automod") { const enabled = i.options.getBoolean("enabled", true); db.automod[i.guild.id] = enabled; saveDB(db); return i.reply(`AutoMod is now **${enabled ? "ON" : "OFF"}**. Toxic matching messages are deleted and warned when it is ON. >w<`); }
    if (name === "security") { const enabled = i.options.getBoolean("enabled", true); db.security[i.guild.id] = enabled; saveDB(db); return i.reply(`Security is now **${enabled ? "ON" : "OFF"}**.`); }

    if (name === "ai") {
      const prompt = i.options.getString("message", true);
      const key = `${i.guild.id}:${i.user.id}`;
      const wait = cooldownLeft(key);
      if (wait) return i.reply({ content: `AI lagi sibuk, coba lagi dalam ${wait} detik. >w<`, ephemeral: true });
      const history = aiHistory.get(key) || [];
      await i.deferReply();
      try {
        const text = await askAI(prompt, history, memory.render(db, i.guild.id, i.user.id));
        history.push({ role: "user", content: prompt }, { role: "assistant", content: text });
        aiHistory.set(key, history.slice(-8));
        return i.editReply(text);
      } catch (e) {
        console.error("AI:", e.message);
        return i.editReply("My AI could not answer right now. Please try again in a moment. >w<");
      }
    }

    // Music
    if (name === "play") { const query = i.options.getString("query", true); await i.deferReply(); return i.editReply(await music.play(i.guild, i.member, query)); }
    if (name === "skip") { await i.deferReply(); return i.editReply(music.skip(i.guild)); }
    if (name === "stop") { await i.deferReply(); return i.editReply(music.stop(i.guild)); }
    if (name === "list") { return i.reply(music.list(i.guild)); }

    // Run another bot's command (owner or server admin only, allowlisted)
    if (name === "proxy") {
      const callerAllowed = isOwner(i.member)
        || !!i.member?.permissions?.has(PermissionFlagsBits.Administrator)
        || !!i.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
      if (!callerAllowed) return i.reply({ content: ROLE_DECLINED, ephemeral: true });
      const bot = i.options.getUser("bot", true);
      const command = i.options.getString("command", true);
      const allowed = (process.env.PROXY_BOTS || "").split(",").map(s => s.trim()).filter(Boolean);
      if (allowed.length && !allowed.includes(bot.id) && !allowed.includes(bot.username)) {
        return i.reply({ content: "That bot is not on the PROXY_BOTS list.", ephemeral: true });
      }
      await i.deferReply({ ephemeral: true });
      await i.channel.send(command);
      return i.editReply(`Sent \`${command}\` as Sulfuric to **${bot.username}**. >w<`).catch(() => {});
    }

    if (name === "remember") {
      const fact = i.options.getString("fact", true);
      const res = memory.remember(db, i.guild.id, i.user.id, fact);
      if (!res.ok) {
        const msg = res.reason === "duplicate" ? "I already remember that. >w<" : "That is too long to remember.";
        return i.reply({ content: msg, ephemeral: true });
      }
      saveDB(db);
      return i.reply({ content: `Got it, I will remember: **${fact}**. >w<`, ephemeral: true });
    }
    if (name === "forget") {
      const res = memory.forget(db, i.guild.id, i.user.id, i.options.getString("query", true));
      saveDB(db);
      return i.reply({ content: res.ok ? `Forgot: **${res.removed}**. >w<` : "I do not have that in memory.", ephemeral: true });
    }
    if (name === "memories") {
      const list = memory.listFacts(db, i.guild.id, i.user.id);
      if (!list.length) return i.reply("I do not remember anything about you yet.");
      return i.reply(list.map((f, n) => `**#${n + 1}** ${f}`).join("\n"));
    }

    if (name === "help") {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Sulfuric Help >w<")
        .setDescription("Here is everything I can do.")
        .addFields(
          { name: "Moderation", value: "`/ban` `/kick` `/timeout` `/warn add|revoke|list` `/purge` `/cleanup` `/automod` `/security`" },
          { name: "Roles and channels", value: "`/role add|remove` `/nickname` `/slowmode` `/lock` `/unlock` `/say`" },
          { name: "Utilities", value: "`/ping` `/serverinfo` `/userinfo` `/membercount` `/avatar` `/invite` `/weather` `/photo2gif` `/uwuify` `/ytmp3`" },
          { name: "AI", value: "`/ai` — chat\n`/remember` `/forget` `/memories` — Sulfuric remembers things about you" },
          { name: "Music", value: "`!play <song>` `/play` — play in voice\n`!skip` `/skip` — skip\n`!stop` `/stop` — stop\n`!list` `/list` — queue" },
          { name: "Admin", value: "`/proxy bot: command:` — run another bot's command (owner or admin)" },
          { name: "Fun", value: "`/gift` `/poll` `/giveaway` `/remind` `/afk` `/coinflip` `/dice` `/8ball` `/rps` `/joke` `/fact`" },
          { name: "Actions", value: "`/hug` `/pat` `/boop` `/bap` `/bite` `/kiss` `/meow` `/poke` `/carry` `/hamburger` `/jumpscare` `/defenestrate` `/gnaw` `/arrest` `/blowup` `/murder`" },
          { name: "Info", value: "`/help` `/about`" }
        )
        .setFooter({ text: "Sulfuric 5.0 | made with >w<" })
        .setTimestamp();
      return i.reply({ embeds: [embed] });
    }

    if (name === "about") {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("About Sulfuric")
        .setDescription("Discord bot with moderation, security, roles and channel tools, accurate weather, gifts, giveaways, and fun commands.")
        .addFields(
          { name: "Latency", value: `${client.ws.ping}ms`, inline: true },
          { name: "Uptime", value: uptime(), inline: true },
          { name: "Servers", value: `${client.guilds.cache.size}`, inline: true },
          { name: "AI", value: providerName(), inline: true },
          { name: "Version", value: "5.0.0", inline: true }
        )
        .setTimestamp();
      return i.reply({ embeds: [embed] });
    }

    if (name === "poll") {
      const q = i.options.getString("question", true);
      const opts = [1, 2, 3, 4, 5].map(n => i.options.getString(`option${n}`)).filter(Boolean);
      if (opts.length < 2) return i.reply({ content: "Give me at least two options for the poll.", ephemeral: true });
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`Poll: ${q}`).setDescription(opts.map((o, idx) => `${POLL_REACTIONS[idx]} ${o}`).join("\n")).setFooter({ text: `Poll by ${i.user.tag}` }).setTimestamp();
      const msg = await i.reply({ embeds: [embed], fetchReply: true });
      for (let idx = 0; idx < opts.length; idx++) await msg.react(POLL_REACTIONS[idx]).catch(() => {});
      return;
    }

    if (name === "giveaway") {
      const minutes = i.options.getInteger("minutes", true);
      const prize = i.options.getString("prize", true);
      const ms = minutes * 60 * 1000;
      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle("Giveaway").setDescription(`**Prize:** ${prize}\nReact with ${GIVEAWAY_REACTION} to enter.\nEnds <t:${Math.floor((Date.now() + ms) / 1000)}:R>`).setFooter({ text: `Hosted by ${i.user.tag}` }).setTimestamp();
      const msg = await i.reply({ embeds: [embed], fetchReply: true });
      await msg.react(GIVEAWAY_REACTION).catch(() => {});
      setTimeout(async () => {
        try {
          const fresh = await i.channel.messages.fetch(msg.id);
          const reaction = fresh.reactions.cache.get(GIVEAWAY_REACTION);
          const users = reaction ? await reaction.users.fetch() : null;
          const entries = users ? users.filter(u => !u.bot).first(100) : [];
          if (!entries.length) return i.channel.send(`The giveaway for **${prize}** ended with no entries. >w<`).catch(() => {});
          const winner = entries[Math.floor(Math.random() * entries.length)];
          await i.channel.send(`${GIVEAWAY_REACTION} Giveaway ended! ${winner} won **${prize}**! Congrats >w<`).catch(() => {});
        } catch (e) { console.error("Giveaway draw:", e); }
      }, ms);
      return;
    }

    if (name === "remind") {
      const minutes = i.options.getInteger("minutes", true);
      const text = i.options.getString("message", true);
      const ms = minutes * 60 * 1000;
      await i.reply({ content: `Reminder set for **${minutes} minute${minutes === 1 ? "" : "s"}** from now. >w<`, ephemeral: true });
      setTimeout(() => {
        i.user.send(`Reminder >w< ${text}`).catch(() => i.channel?.send(`<@${i.user.id}> reminder: ${text}`).catch(() => {}));
      }, ms);
      return;
    }

    if (name === "afk") {
      const key = `${i.guild.id}:${i.user.id}`;
      const text = i.options.getString("message")?.trim();
      if (!text) {
        delete db.afk[key]; saveDB(db);
        return i.reply({ content: "Welcome back! Your AFK status is cleared. >w<", ephemeral: true });
      }
      db.afk[key] = { message: text.slice(0, 200), since: Date.now() };
      saveDB(db);
      return i.reply({ content: `You are now AFK: ${text.slice(0, 200)} >w<`, ephemeral: true });
    }

    if (name === "say") {
      const text = i.options.getString("text", true).slice(0, 2000);
      await i.deferReply({ ephemeral: true });
      await i.deleteReply();
      return i.channel.send(text).catch(() => {});
    }

    if (name === "nickname") {
      if (!hasPerm(i.member, PermissionFlagsBits.ManageNicknames)) return i.reply({ content: "You need Manage Nicknames to use this command.", ephemeral: true });
      const user = i.options.getUser("user", true);
      const target = await getMember(i, user.id);
      if (!target) return i.reply({ content: "That member is not in the server.", ephemeral: true });
      const newName = i.options.getString("name")?.slice(0, 32) || null;
      await target.setNickname(newName, `Changed by ${i.user.tag}`).catch(() => {});
      return i.reply(newName ? `Nickname for **${user.tag}** is now **${newName}**. >w<` : `Nickname for **${user.tag}** cleared. >w<`);
    }

    if (name === "slowmode") {
      if (!hasPerm(i.member, PermissionFlagsBits.ManageChannels)) return i.reply({ content: "You need Manage Channels to use this command.", ephemeral: true });
      const seconds = i.options.getInteger("seconds", true);
      await i.channel.setRateLimitPerUser(seconds, `Set by ${i.user.tag}`).catch(() => {});
      return i.reply(seconds === 0 ? "Slowmode disabled. >w<" : `Slowmode set to **${seconds} seconds**. >w<`);
    }

    if (name === "lock" || name === "unlock") {
      if (!hasPerm(i.member, PermissionFlagsBits.ManageChannels)) return i.reply({ content: "You need Manage Channels to use this command.", ephemeral: true });
      const channel = i.options.getChannel("channel") || i.channel;
      if (!channel?.isTextBased?.()) return i.reply({ content: "That is not a text channel.", ephemeral: true });
      const allow = name === "unlock";
      await channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: allow ? null : false }, { reason: `${name} by ${i.user.tag}` }).catch(() => {});
      return i.reply(allow ? `Unlocked **${channel.name}**. >w<` : `Locked **${channel.name}**. >w<`);
    }

    if (name === "purge") {
      if (!hasPerm(i.member, PermissionFlagsBits.ManageMessages)) return i.reply({ content: "You need Manage Messages to use this command.", ephemeral: true });
      const amount = i.options.getInteger("amount", true);
      const user = i.options.getUser("user");
      let deleted;
      if (user) {
        const fetched = await i.channel.messages.fetch({ limit: 100 });
        const targets = [...fetched.values()].filter(m => m.author.id === user.id).slice(0, amount);
        deleted = await i.channel.bulkDelete(targets, true);
      } else {
        deleted = await i.channel.bulkDelete(amount, true);
      }
      return i.reply({ content: `Deleted **${deleted.size}** message${deleted.size === 1 ? "" : "s"}.`, ephemeral: true });
    }

    if (name === "role") {
      if (!hasPerm(i.member, PermissionFlagsBits.ManageRoles)) return i.reply({ content: "You need Manage Roles to use this command.", ephemeral: true });
      const user = i.options.getUser("user", true); const role = i.options.getRole("role", true);
      const target = await getMember(i, user.id); const me = i.guild.members.me;
      if (!target) return i.reply({ content: "That member is not in the server.", ephemeral: true });
      if (role.managed || role.position >= me.roles.highest.position) return i.reply({ content: "Sulfuric cannot manage that role.", ephemeral: true });
      if (target.roles.highest.position >= me.roles.highest.position) return i.reply({ content: "Sulfuric cannot manage that member.", ephemeral: true });
      if (sub === "remove") { await target.roles.remove(role, `Removed by ${i.user.tag}`).catch(() => {}); return i.reply(`Removed **${role.name}** from **${user.tag}**. >w<`); }
      await target.roles.add(role, `Added by ${i.user.tag}`).catch(() => {});
      return i.reply(`Added **${role.name}** to **${user.tag}** >w<`);
    }

    if (name === "gift") {
      const user = i.options.getUser("user", true); const item = i.options.getString("item", true); const quantity = i.options.getInteger("quantity", true); const coins = i.options.getInteger("coins", true);
      const key = `${i.guild.id}:${user.id}`; const added = quantity * coins; db.gifts[key] = (db.gifts[key] || 0) + added; saveDB(db);
      const embed = new EmbedBuilder().setColor(0x5865F2).setAuthor({ name: i.user.tag, iconURL: i.user.displayAvatarURL() }).setTitle(`Gifted ${quantity}x ${item}! (${coins} Coins)`).addFields({ name: "Total Accumulative", value: `${db.gifts[key]} Coins` }).setDescription(`To <@${user.id}>`).setTimestamp();
      return i.reply({ embeds: [embed] });
    }

    if (name === "ping") return i.reply(`Pong. API latency: **${client.ws.ping}ms** >w<`);
    if (name === "coinflip") return i.reply(`Result: **${Math.random() < 0.5 ? "Heads" : "Tails"}** >w<`);
    if (name === "dice") { const sides = i.options.getInteger("sides") || 6; return i.reply(`D${sides}: **${Math.floor(Math.random() * sides) + 1}** >w<`); }
    if (name === "8ball") { const q = i.options.getString("question", true); return i.reply(`Question: ${q}\nAnswer: **${answers[Math.floor(Math.random() * answers.length)]}** >w<`); }
    if (name === "rps") {
      const choice = i.options.getString("choice", true);
      const bot = ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];
      const emoji = { rock: "\u{1FAA8}", paper: "\u{1F4C4}", scissors: "\u{2702}\uFE0F" };
      let result;
      if (choice === bot) result = "It's a tie!";
      else if ((choice === "rock" && bot === "scissors") || (choice === "paper" && bot === "rock") || (choice === "scissors" && bot === "paper")) result = "You win!";
      else result = "I win!";
      return i.reply(`You: ${emoji[choice]} ${choice}\nMe: ${emoji[bot]} ${bot}\n**${result}** >w<`);
    }
    if (name === "joke") return i.reply(jokes[Math.floor(Math.random() * jokes.length)]);
    if (name === "fact") return i.reply(facts[Math.floor(Math.random() * facts.length)]);
    if (name === "avatar") { const user = i.options.getUser("user") || i.user; return i.reply(`Avatar for **${user.tag}**\n${user.displayAvatarURL({ size: 1024, extension: "png" })}`); }
    if (name === "invite") {
      if (!hasPerm(i.member, PermissionFlagsBits.CreateInstantInvite)) return i.reply({ content: "I need Create Invite permission in this channel.", ephemeral: true });
      const invite = await i.channel.createInvite({ maxAge: 0, maxUses: 0, unique: true, reason: `Created by ${i.user.tag}` }).catch(() => null);
      return i.reply(invite ? `Invite link: https://discord.gg/${invite.code}` : "I could not create an invite here.");
    }
    if (name === "membercount") {
      const g = i.guild;
      const members = [...g.members.cache.values()];
      const bots = members.filter(m => m.user?.bot).length;
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(g.name).addFields(
        { name: "Total members", value: `${g.memberCount}`, inline: true },
        { name: "Humans", value: `${g.memberCount - bots}`, inline: true },
        { name: "Bots", value: `${bots}`, inline: true }
      ).setTimestamp();
      return i.reply({ embeds: [embed] });
    }
    if (name === "serverinfo") {
      const g = i.guild;
      const owner = g.members.cache.get(g.ownerId)?.user?.tag || "Unknown";
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(g.name)
        .setThumbnail(g.iconURL({ size: 256 }))
        .addFields(
          { name: "Owner", value: owner, inline: true },
          { name: "Members", value: `${g.memberCount}`, inline: true },
          { name: "Channels", value: `${g.channels.cache.size}`, inline: true },
          { name: "Roles", value: `${g.roles.cache.size}`, inline: true },
          { name: "Boosts", value: `${g.premiumSubscriptionCount || 0}`, inline: true },
          { name: "Created", value: `<t:${Math.floor(g.createdAt.getTime() / 1000)}:R>`, inline: true },
          { name: "Security", value: securityEnabled(g.id) ? "ON" : "OFF", inline: true },
          { name: "AutoMod", value: automodEnabled(g.id) ? "ON" : "OFF", inline: true }
        )
        .setFooter({ text: `Server ID: ${g.id}` })
        .setTimestamp();
      return i.reply({ embeds: [embed] });
    }
    if (name === "userinfo") {
      const user = i.options.getUser("user") || i.user;
      const member = await getMember(i, user.id);
      const warnings = db.warnings[`${i.guild.id}:${user.id}`] || 0;
      const afk = db.afk[`${i.guild.id}:${user.id}`];
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(user.tag)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "ID", value: `\`${user.id}\``, inline: true },
          { name: "Warnings", value: `${warnings}`, inline: true },
          { name: "Account created", value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`, inline: true },
          { name: "Joined server", value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Unknown", inline: true }
        );
      if (afk) embed.setDescription(`AFK: ${afk.message}`);
      embed.setTimestamp();
      return i.reply({ embeds: [embed] });
    }
    if (name === "cleanup") { if (i.guild.ownerId !== i.user.id) return i.reply({ content: "This command is owner-only.", ephemeral: true }); const amount = i.options.getInteger("amount", true); const deleted = await i.channel.bulkDelete(amount, true); return i.reply({ content: `Deleted **${deleted.size}** recent messages.`, ephemeral: true }); }

    if (name === "warn") {
      if (sub === "list") {
        const filterUser = i.options.getUser("user");
        const prefix = `${i.guild.id}:`;
        const entries = Object.entries(db.warnings).filter(([k, v]) => k.startsWith(prefix) && v > 0 && (!filterUser || k === `${prefix}${filterUser.id}`));
        if (!entries.length) return i.reply({ content: "No warnings recorded for this server. >w<", ephemeral: true });
        const lines = entries.sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `<@${k.slice(prefix.length)}> — **${v}** warning${v === 1 ? "" : "s"}`);
        const embed = new EmbedBuilder().setColor(0x5865F2).setTitle("Warnings").setDescription(lines.join("\n")).setTimestamp();
        return i.reply({ embeds: [embed], ephemeral: true });
      }
      const user = i.options.getUser("user", true); const target = await getMember(i, user.id); const err = targetError(i, target); if (err) return i.reply({ content: err, ephemeral: true }); const key = `${i.guild.id}:${user.id}`;
      if (sub === "revoke") { db.warnings[key] = Math.max(0, (db.warnings[key] || 0) - 1); saveDB(db); return i.reply(`Warning revoked. Remaining warnings: **${db.warnings[key]}**.`); }
      const reason = i.options.getString("reason") || "No reason provided."; const count = await addWarning(i.guild.id, user.id);
      if (count === 3 && target.moderatable) await target.timeout(10 * 60 * 1000, `Warn #${count}: ${reason}`).catch(() => {});
      if (count >= 5 && target.bannable) await target.ban({ reason: `Warn #${count}: ${reason}` }).catch(() => {});
      return i.reply(`**${user.tag}** received warning #${count}.\nReason: ${reason} >w<`);
    }

    if (["ban", "kick", "timeout"].includes(name)) {
      const user = i.options.getUser("user", true); const reason = i.options.getString("reason") || "No reason provided."; const target = await getMember(i, user.id); const err = targetError(i, target); if (err) return i.reply({ content: err, ephemeral: true });
      if (name === "ban") { if (!target.bannable) return i.reply({ content: "Sulfuric cannot ban this member. Check the role hierarchy.", ephemeral: true }); await target.ban({ reason }); return i.reply(`**${user.tag}** has been banned.\nReason: ${reason}`); }
      if (name === "kick") { if (!target.kickable) return i.reply({ content: "Sulfuric cannot kick this member. Check the role hierarchy.", ephemeral: true }); await target.kick(reason); return i.reply(`**${user.tag}** has been kicked.\nReason: ${reason}`); }
      const minutes = i.options.getInteger("minutes", true); if (!target.moderatable) return i.reply({ content: "Sulfuric cannot timeout this member. Check the role hierarchy.", ephemeral: true }); await target.timeout(minutes * 60000, reason); return i.reply(`**${user.tag}** has been timed out for **${minutes} minutes**.\nReason: ${reason}`);
    }

    if (name === "photo2gif") { await i.deferReply(); const a = i.options.getAttachment("photo", true); if (a.size > 10 * 1024 * 1024) return i.editReply("The image must be 10 MB or smaller."); const r = await fetch(a.url); if (!r.ok) return i.editReply("Failed to fetch the image from Discord."); const gif = await photoToGif(Buffer.from(await r.arrayBuffer())); return i.editReply({ content: "GIF created >w<", files: [new AttachmentBuilder(gif, { name: "Sulfuric.gif" })] }); }
    if (name === "uwuify") return i.reply(uwuify(i.options.getString("text", true)));
    if (name === "weather") {
      await i.deferReply();
      const result = await getWeather(i.options.getString("city"));
      if (result.error) return i.editReply(result.error);
      const embed = new EmbedBuilder()
        .setColor(result.isDay ? 0x5865F2 : 0x1b2838)
        .setTitle(`Weather in ${result.location}`)
        .addFields(
          { name: "Condition", value: result.condition, inline: true },
          { name: "Temperature", value: `${result.temperature}\u00B0C`, inline: true },
          { name: "Feels like", value: `${result.feelsLike}\u00B0C`, inline: true },
          { name: "Humidity", value: `${result.humidity}%`, inline: true },
          { name: "Wind", value: `${result.wind} km/h`, inline: true },
          { name: "Precipitation", value: `${result.precipitation} mm`, inline: true }
        )
        .setFooter({ text: "Data: Open-Meteo" })
        .setTimestamp();
      if (typeof result.max === "number" && typeof result.min === "number") {
        embed.setDescription(`Today's high **${result.max}\u00B0C** / low **${result.min}\u00B0C**`);
      }
      return i.editReply({ embeds: [embed] });
    }
    if (name === "ytmp3") {
      const input = i.options.getString("url", true).trim();
      await i.deferReply();
      try {
        const song = await music.resolveSong(input);
        if (!song) return i.editReply("Couldn't find a song for that.");
        const file = await music.downloadMp3(song.url);
        const size = fs.statSync(file).size;
        if (size > 25 * 1024 * 1024) {
          try { fs.unlinkSync(file); } catch { /* ignore */ }
          return i.editReply("That song is too large (>25 MB) to send on Discord.");
        }
        const safe = (song.title || "song").replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "song";
        return i.editReply({ content: `**${song.title}**`, files: [new AttachmentBuilder(file, { name: safe + ".mp3" })] });
      } catch (e) {
        console.error("ytmp3:", e.message);
        return i.editReply("Failed to download the song: " + String(e.message).slice(0, 150));
      }
    }
    if (funReplies[name]) { const user = i.options.getUser("user", true); return i.reply(funReplies[name](user)); }
  } catch (e) {
    console.error("Command error:", e);
    if (i.deferred || i.replied) await i.editReply("Something went wrong while running that command. >w<").catch(() => {});
    else await i.reply({ content: "Something went wrong while running that command. >w<", ephemeral: true }).catch(() => {});
  }
});

client.on("error", e => console.error("Discord client error:", e));
process.on("unhandledRejection", e => console.error("Unhandled rejection:", e));
process.on("uncaughtException", e => console.error("Uncaught exception:", e));
client.login(DISCORD_TOKEN).catch(e => { console.error("Failed to log in to Discord:", e.message); process.exit(1); });
