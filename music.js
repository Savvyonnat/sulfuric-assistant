// Music playback + YouTube download for Sulfuric.
//
// Uses yt-dlp (bundled bin/, system PATH, or `python -m yt_dlp`) for
// search/stream/download and ffmpeg for transcoding. yt-dlp is required
// because YouTube blocks most Node libraries. See tools.js for resolution
// (Windows, Linux/Docker, and Android/Termux all work).

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType
} = require("@discordjs/voice");

const { ytdlpCommand, ffmpegPath } = require("./tools");
const YTDLP = ytdlpCommand(); // { cmd, prefix } | null
const FFMPEG = ffmpegPath();
const FFMPEG_DIR = path.dirname(FFMPEG);

const queues = new Map(); // guildId -> queue

function yt(args, opts = {}) {
  if (!YTDLP) throw new Error("yt-dlp not found");
  return spawn(YTDLP.cmd, [...(YTDLP.prefix || []), ...args], opts);
}

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, { items: [], index: 0, connection: null, player: null, channelId: null });
  }
  return queues.get(guildId);
}

function secondsToClock(sec) {
  if (sec == null) return "live";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Search YouTube. Returns [{title, url, duration, uploader}]. */
function searchSongs(query, limit = 5) {
  return new Promise(resolve => {
    if (!YTDLP) return resolve([]);
    const p = yt(["ytsearch" + limit + ":" + query, "--flat-playlist", "--dump-json", "--no-warnings", "--no-playlist"]);
    let out = "";
    p.stdout.on("data", d => (out += d));
    p.on("error", () => resolve([]));
    p.on("close", () => {
      const items = [];
      for (const line of out.split("\n")) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          items.push({
            title: j.title || j.id,
            url: j.url || `https://www.youtube.com/watch?v=${j.id}`,
            duration: j.duration,
            uploader: j.channel || j.uploader || ""
          });
        } catch { /* skip bad line */ }
      }
      resolve(items);
    });
  });
}

/** Get title/duration for a single URL. */
function videoInfo(url) {
  return new Promise(resolve => {
    if (!YTDLP) return resolve(null);
    const p = yt(["--dump-json", "--no-playlist", "--no-warnings", url]);
    let out = "";
    p.stdout.on("data", d => (out += d));
    p.on("error", () => resolve(null));
    p.on("close", () => {
      try {
        const j = JSON.parse(out.split("\n").filter(Boolean).pop());
        resolve({ title: j.title, url: j.webpage_url || url, duration: j.duration, uploader: j.channel || j.uploader || "" });
      } catch { resolve(null); }
    });
  });
}

/** Resolve a query (URL or search terms) to one song. */
async function resolveSong(query) {
  const q = query.trim();
  if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(q)) {
    const info = await videoInfo(q);
    if (info) return info;
  }
  const results = await searchSongs(q, 5);
  return results[0] || null;
}

/** Stream a URL as an Ogg/Opus readable for Discord voice. */
function createOpusStream(url) {
  const source = yt(["-f", "bestaudio", "-o", "-", "--no-warnings", url]);
  const ff = spawn(FFMPEG, [
    "-hide_banner", "-loglevel", "error",
    "-i", "pipe:0",
    "-f", "ogg", "-c:a", "libopus", "-ar", "48000", "-ac", "2", "-b:a", "96k",
    "-af", "volume=0.6",
    "pipe:1"
  ], { stdio: ["pipe", "pipe", "inherit"] });
  source.stdout.pipe(ff.stdin);
  source.on("error", () => ff.kill());
  ff.on("error", () => source.kill());
  return ff.stdout;
}

/** Download a URL as MP3. Returns the file path. */
function downloadMp3(url) {
  return new Promise((resolve, reject) => {
    if (!YTDLP) return reject(new Error("yt-dlp not found"));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sulfuric-"));
    const template = path.join(dir, "%(id)s.%(ext)s");
    const p = yt([
      "-x", "--audio-format", "mp3", "--audio-quality", "192K",
      "--ffmpeg-location", FFMPEG_DIR,
      "-o", template, "--no-warnings", url
    ]);
    p.on("error", reject);
    p.on("close", code => {
      if (code !== 0) return reject(new Error("yt-dlp exit " + code));
      const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp3"));
      if (!files.length) return reject(new Error("No MP3 file was produced"));
      resolve(path.join(dir, files[0]));
    });
  });
}

/* ---------------- queue / playback ---------------- */
/* All functions return a reply string. */

async function ensureConnection(guild, channel) {
  const queue = getQueue(guild.id);
  if (queue.connection?.state?.status === VoiceConnectionStatus.Ready) return queue;

  // Drop a half-open connection before retrying, otherwise the bot lingers in voice.
  if (queue.connection) {
    try { queue.connection.destroy(); } catch { /* ignore */ }
    queues.delete(guild.id);
    return ensureConnection(guild, channel);
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
    debug: process.env.VOICE_DEBUG === "1"
  });
  const player = createAudioPlayer();
  connection.subscribe(player);
  queue.connection = connection;
  queue.player = player;
  queue.channelId = channel.id;

  player.on(AudioPlayerStatus.Idle, () => {
    queue.index += 1;
    playCurrent(guild.id).catch(() => {});
  });
  player.on("error", e => console.error("[voice] player error:", e.message));
  connection.on(VoiceConnectionStatus.Destroyed, () => queues.delete(guild.id));
  connection.on("stateChange", (oldState, newState) => {
    console.log(`[voice] ${guild.id}: ${oldState.status} -> ${newState.status}`);
  });
  connection.on("error", e => console.error("[voice] connection error:", e.message));

  await entersState(connection, VoiceConnectionStatus.Ready, 30000);
  return queue;
}

async function playCurrent(guildId) {
  const queue = getQueue(guildId);
  const song = queue.items[queue.index];
  if (!song) {
    try { queue.connection?.destroy(); } catch { /* ignore */ }
    return;
  }
  const stream = createOpusStream(song.url);
  // inlineVolume:false keeps the pipeline as a plain Ogg/Opus demuxer, so no
  // native Opus encoder is required. Volume is set in ffmpeg instead.
  const resource = createAudioResource(stream, { inputType: StreamType.OggOpus, inlineVolume: false });
  queue.player.play(resource);
}

async function play(guild, member, query) {
  const voice = member?.voice;
  if (!voice?.channel) return "You need to be in a voice channel first. >w<";
  const channel = voice.channel;

  const song = await resolveSong(query);
  if (!song) return `Couldn't find a song for "${query}".`;

  const queue = getQueue(guild.id);
  queue.items.push(song);

  if (!queue.connection) {
    let ready;
    try {
      ready = await ensureConnection(guild, channel);
    } catch (e) {
      try { queue.connection?.destroy(); } catch { /* ignore */ }
      queues.delete(guild.id);
      console.error("[voice] join failed:", e.message);
      return "Failed to join the voice channel. Make sure Sulfuric has **Connect** and **Speak** permission there. >w<";
    }
    await playCurrent(guild.id);
    return `Now playing: **${song.title}** (${secondsToClock(song.duration)})\nPlaying in **${channel.name}**. >w<`;
  }

  const status = queue.player?.state?.status;
  const playing = status === AudioPlayerStatus.Playing || status === AudioPlayerStatus.Paused;
  if (playing) return `Added to queue (#${queue.items.length - queue.index}): **${song.title}**`;
  await playCurrent(guild.id);
  return `Now playing: **${song.title}** (${secondsToClock(song.duration)})`;
}

function skip(guild) {
  const queue = queues.get(guild.id);
  if (!queue?.player) return "Nothing is playing.";
  queue.index += 1;
  queue.player.stop();
  const next = queue.items[queue.index];
  return next ? `Skipped. Now playing: **${next.title}**` : "Skipped. The queue is empty.";
}

function stop(guild) {
  const queue = queues.get(guild.id);
  if (!queue) return "Nothing is playing.";
  queue.items = [];
  queue.index = 0;
  try { queue.player?.stop(); } catch { /* ignore */ }
  try { queue.connection?.destroy(); } catch { /* ignore */ }
  queues.delete(guild.id);
  return "Stopped and the queue has been cleared. >w<";
}

function list(guild) {
  const queue = queues.get(guild.id);
  if (!queue || !queue.items.length) return "The queue is empty. Add a song with `!play <song>`.";
  const current = queue.items[queue.index];
  const header = current ? `Now playing: **${current.title}**\n\n` : "";
  const lines = queue.items.slice(queue.index, queue.index + 15).map((s, i) => {
    const marker = i === 0 ? "▶" : `#${queue.index + i}`;
    return `${marker} **${s.title}** (${secondsToClock(s.duration)})`;
  });
  return header + lines.join("\n");
}

module.exports = {
  searchSongs, resolveSong, videoInfo, downloadMp3,
  play, skip, stop, list, getQueue, secondsToClock, YTDLP
};
