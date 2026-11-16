# Sulfuric

A Discord bot with moderation, anti-raid security, roles and channel tools, accurate weather, gifts, giveaways, and fun commands. Built with [discord.js](https://discord.js.org) v14.

> Text-face fluent: `>w<`, `>:3`, `:3c`, `^w^`. No Unicode emoji in replies (number/celebration reactions in polls and giveaways aside).

---

## Features

- **Moderation** — `/ban`, `/kick`, `/timeout`, `/warn add|revoke|list`, `/purge`, `/cleanup`, with full role-hierarchy checks.
- **Roles and channels** — `/role add|remove`, `/nickname`, `/slowmode`, `/lock`, `/unlock`, `/say`.
- **Local AutoMod** — rule-based toxic filter covering ~18 languages, with leet-speak, separator, diacritic, and repetition normalization. Matching messages are deleted and a warning is recorded.
- **Warning escalation** — warning #3 adds a 10-minute timeout, warning #5 bans when Sulfuric has permission.
- **Anti-raid security** — tracks repeat joiners and newly-created accounts. `/security` toggles it per server.
- **Accurate weather** — real current conditions and today's high/low from [Open-Meteo](https://open-meteo.com) (free, no API key). Resolves city names to coordinates; falls back to your IP location.
- **Fun** — `/gift` with cumulative coins, `/poll`, `/giveaway`, `/remind`, `/afk`, `/rps`, `/joke`, `/fact`, `/coinflip`, `/dice`, `/8ball`, and 16 cute action commands.
- **Utilities** — `/photo2gif` (static GIF), `/uwuify`, `/ytmp3`, `/serverinfo`, `/userinfo`, `/membercount`, `/avatar`, `/invite`, `/ping`, `/help`, `/about`.
- **AI agent** — `/ai` and `@Sulfuric` mentions via an OpenAI-compatible endpoint, with long-term per-user memory (`/remember`, `/forget`, `/memories`). Works out of the box on a free provider, or set `AI_API_KEY` for Groq.
- **Music** — `!play`/`/play`, `!skip`, `!stop`, `!list`, `!ytmp3`, plus `/afkvc` (keep the bot in voice 24/7) and `/vclist` (who is in voice, for how long).
- **Configurable presence** — `ACTIVITY_NAME` sets the "Playing ..." activity.

---

## Requirements

- [Node.js](https://nodejs.org) 20 or newer
- A Discord application with a bot user ([Developer Portal](https://discord.com/developers/applications))

---

## Setup

1. Clone the repository and enter the folder:

   ```sh
   git clone https://github.com/YOUR_USERNAME/sulfur-bot.git
   cd sulfur-bot
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Copy the environment template and fill in your credentials:

   ```sh
   cp .env.example .env
   ```

   | Variable | Required | Description |
   |---|---|---|
   | `DISCORD_TOKEN` | yes | Bot token from the Developer Portal |
   | `CLIENT_ID` | yes | Application (client) ID |
   | `GUILD_ID` | no | Test server ID — commands register instantly here |
   | `ACTIVITY_NAME` | no | Presence activity name (defaults to `Sulfuric Online >w<`) |
| `AI_API_KEY` | no | API key for the AI chat. Without it, `/ai` and mentions fall back to a plain reply. |
| `AI_BASE_URL` | no | OpenAI-compatible base URL (default `https://api.longcat.chat/openai/v1`) |
| `AI_MODEL` | no | Model name (default `LongCat-2.5`) |
| `AI_TIMEOUT_MS` | no | AI request timeout in milliseconds (default `60000`) |

4. In the Discord Developer Portal, enable **Server Members Intent** and **Message Content Intent** for your bot.

5. Invite the bot with the `bot` and `applications.commands` scopes, and grant it: View Channels, Send Messages, Embed Links, Read Message History, Manage Messages, Moderate Members, Kick Members, Ban Members, Manage Roles, Manage Channels, Manage Nicknames, Create Invite, Add Reactions.

6. Put the Sulfuric role **above** members it needs to moderate.

7. Start it:

   ```sh
   npm start
   ```

For local development with auto-restart:

```sh
npm run dev
```

---

## Commands

### Moderation
| Command | Description |
|---|---|
| `/ban user:<member> reason:<text>` | Ban a member |
| `/kick user:<member> reason:<text>` | Kick a member |
| `/timeout user:<member> minutes:<1-40320> reason:<text>` | Timeout a member |
| `/warn add user:<member> reason:<text>` | Add a warning |
| `/warn revoke user:<member>` | Revoke one warning |
| `/warn list [user:<member>]` | List warnings in the server |
| `/purge amount:<1-100> [user:<member>]` | Delete recent messages, optionally only from one member |
| `/cleanup amount:<1-100>` | Delete recent messages (owner only) |
| `/automod enabled:<true\|false>` | Toggle toxic-message AutoMod |
| `/security enabled:<true\|false>` | Toggle anti-raid protection |

### Roles and channels
| Command | Description |
|---|---|
| `/role add user:<member> role:<role>` | Add a role |
| `/role remove user:<member> role:<role>` | Remove a role |
| `/nickname user:<member> [name:<text>]` | Change or clear a nickname |
| `/slowmode seconds:<0-21600>` | Set channel slowmode |
| `/lock [channel:<channel>]` | Lock a channel |
| `/unlock [channel:<channel>]` | Unlock a channel |
| `/say text:<text>` | Send a message as Sulfuric |

### Utilities
| Command | Description |
|---|---|
| `/ping` | Show API latency |
| `/serverinfo` | Server details in an embed |
| `/userinfo [user:<member>]` | User details, warnings, and AFK status |
| `/membercount` | Total, human, and bot counts |
| `/avatar [user:<member>]` | Full-size avatar link |
| `/invite` | Create an invite link for this channel |
| `/weather [city]` | Accurate current weather and today's high/low |
| `/photo2gif photo:<image>` | Convert an image to a GIF |
| `/uwuify text:<text>` | Uwuify some text |
| `/ai message:<text>` | Chat with Sulfuric's AI |
| `/ytmp3 url:<youtube\|title>` | Download a song as MP3 |

### Fun
| Command | Description |
|---|---|
| `/gift user:<member> item:<text> quantity:<1-99> coins:<0-100000>` | Send a gift embed with cumulative coins |
| `/poll question:<text> option1:<text> option2:<text> [option3..5]` | Create a reaction poll |
| `/giveaway minutes:<1-1440> prize:<text>` | Start a reaction giveaway |
| `/remind minutes:<1-1440> message:<text>` | DM yourself a reminder |
| `/afk [message]` | Set your AFK status (leave empty to clear) |
| `/coinflip` | Flip a coin |
| `/dice [sides:<2-100>]` | Roll a die |
| `/8ball question:<text>` | Ask the magic 8-ball |
| `/rps choice:<rock\|paper\|scissors>` | Rock paper scissors |
| `/joke` | Tell a joke |
| `/fact` | Tell a random fact |
| `/hug`, `/pat`, `/boop`, `/bap`, `/bite`, `/kiss`, `/meow`, `/poke`, `/carry`, `/hamburger`, `/jumpscare`, `/defenestrate`, `/gnaw`, `/arrest`, `/blowup`, `/murder` | Cute action commands |

### Info
| Command | Description |
|---|---|
| `/help` | Command overview |
| `/about` | Bot stats and version |

### Music
The bot joins your voice channel. Prefix (`!`) and slash (`/`) work the same.

| Command | Description |
|---|---|
| `!play <title or URL>` | Search and play a song |
| `!skip` | Skip the current song |
| `!stop` | Stop and clear the queue |
| `!list` | Show the queue |

Example: `!play alan walker faded`, `!play https://youtu.be/...`

### Admin
| Command | Description |
|---|---|
| `/proxy bot:<bot> command:<text>` | Run another bot's command as Sulfuric (owner or admin) |

### Voice / music
| Command | Description |
|---|---|
| `!play <song>` / `/play <song>` | Play in your voice channel |
| `!skip` / `/skip` | Skip the current song |
| `!stop` / `/stop` | Stop and clear the queue |
| `!list` / `/list` | Show the queue |
| `!ytmp3 <url>` | Download a song as MP3 |
| `/afkvc enabled:<true\|false> [channel]` | Keep Sulfuric in voice (AFK mode) |
| `/vclist [channel]` | Who is in voice, and for how long |

- `/afkvc` joins the channel and streams near-inaudible audio (default pink noise at about -68 dB, tune with `AFK_NOISE`) so Discord never moves the bot to AFK or disconnects it. It also keeps an empty channel from closing.
- `/vclist` tracks how long each member has been in voice; durations start when the bot sees them join.

Example: `/proxy bot:carl-bot command:!kick @spam reason: raid`

Details:
- Allowed for the **owner** (your user ID in `OWNER_ID`, or the application owner) **or anyone with Administrator / Manage Guild**.
- The target bot must be in `PROXY_BOTS` (comma-separated ID/username list) if that list is filled in.
- Sulfuric re-sends the `command` to the channel, and the target bot executes it (because Sulfuric is admin, the target bot sees Sulfuric as having permission).
- Sulfuric confirms with an ephemeral message.
- Dangerous: this acts on your behalf. Do not fill in `PROXY_BOTS` unless you need it.

---

## Music: how it works

`music.js` uses **yt-dlp** (`bin/yt-dlp.exe`) for search/stream/download and **ffmpeg** for transcoding. YouTube blocks Node libraries such as `ytdl-core`/`play-dl`, which is why yt-dlp is used.

The yt-dlp binary is **not** committed (~23 MB). Download it with:
```sh
node scripts/get-yt-dlp.js
```
`ffmpeg-static` is already an npm dependency. If `ffmpeg.exe` was not installed during `npm install` (npm blocked the install script), run:
```sh
node node_modules/ffmpeg-static/install.js
```

Voice uses `@discordjs/voice`; audio is encoded to Ogg/Opus via ffmpeg, so no native Opus library is needed.

Set `VOICE_DEBUG=1` in `.env` to log voice connection state changes — useful if music cannot join.

Limitation: live streams have a `live` duration and do not advance to the next queue entry automatically.

---

## Configuration

All runtime data lives in `database.json` (created automatically on first write). Copy `database.example.json` if you want a starting template.

| Key | Purpose |
|---|---|
| `warnings` | `${guildId}:${userId}` → warning count |
| `joins` | `${guildId}:${userId}` → lifetime join count |
| `security` | `${guildId}` → `false` disables anti-raid |
| `automod` | `${guildId}` → `false` disables AutoMod |
| `gifts` | `${guildId}:${userId}` → cumulative coins |
| `afk` | `${guildId}:${userId}` → `{ message, since }` |

---

## AI chat

`/ai message:<text>` and `@Sulfuric <text>` call an OpenAI-compatible chat endpoint. Two ways to run it:

**A. Free, no key — works immediately.** Leave `AI_API_KEY` empty. The bot uses the free Pollinations endpoint. Provider limit: about **1 reply per 45 seconds per IP**, so replies can be slow or refused while busy. Good for trying it out.

**B. Groq — default, free tier, fast.** Create a key at [console.groq.com](https://console.groq.com) → **API Keys** → **Create API Key**, then add to `.env`:

```env
AI_API_KEY=your_key_here
```

`AI_BASE_URL` and `AI_MODEL` already default to `https://api.groq.com/openai/v1` and `openai/gpt-oss-120b`.

Any other OpenAI-compatible provider works too — set `AI_BASE_URL` and `AI_MODEL`. Fast options:

| Provider | Cost | `AI_BASE_URL` | `AI_MODEL` |
|---|---|---|---|
| Groq | free tier, very fast | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Google Gemini | free tier, fast | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-flash` |
| DeepSeek | cheap | `https://api.deepseek.com` | `deepseek-chat` |
| OpenRouter | pay-as-you-go | `https://openrouter.ai/api/v1` | any model slug |
| LongCat | pay-as-you-go | `https://api.longcat.chat/openai/v1` | `LongCat-2.5` |

The only requirement is `POST {AI_BASE_URL}/chat/completions`.

Notes:
- Conversation history is kept in memory per server+user (last 8 entries) and is lost on restart.
- `AI_COOLDOWN_MS` (default `5000`) adds a per-user cooldown so the bot does not spam the provider.
- `/about` shows which provider is active.

---

## Extending AutoMod

`automod.js` ships a multi-language lexicon (~18 languages: English, Indonesian/Malay, Spanish, Portuguese, French, German, Italian, Turkish, Arabic, Hindi/Urdu, Russian, Vietnamese, Korean, Japanese, Tagalog, Dutch, Polish, Swedish/Norwegian) plus harassment phrases.

Exports:

- `detectToxic(text)` → `{ toxic, normalized, matches, score }`
- `normalize(text)` → normalized string
- `TERMS` → the lexicon entries

Matching is two-pass:

- **Word-boundary pass** on normalized text (low false positives).
- **Squash pass** on whitespace-stripped text, but **only when the message looks letter-separated** (`f u c k`, `s.h.i.t`), so innocent words such as `babies` or `masuk` are not flagged.

Normalization strips diacritics (NFKD), maps ß→ss, maps leet digits, and collapses repeated letters. Add a new language with:

```js
term("xx", "insult", { squash: true, severity: 2 });
```

Env: `AUTOMOD_MIN_SCORE` (default `1`) is the minimum severity score before a message is flagged — raise it to `2` if your server sees false positives.

Keep the list focused — AutoMod is a rule-based filter, not a perfect toxicity classifier.

---

## Android / Termux

The bot is plain Node.js, so it runs headless on Android through Termux. A ready-made folder with the full tutorial lives at **[`termux/`](termux/README.md)**:

```sh
git clone https://github.com/Savvyonnat/sulfuric-assistant.git
cd sulfuric-assistant
bash termux/setup.sh          # installs nodejs, ffmpeg, python, yt-dlp + npm install
cp .env.example .env && nano .env
bash termux/start.sh
```

- `termux/setup.sh` / `start.sh` / `stop.sh` / `boot.sh` handle packages, the wake lock and boot autostart.
- `tools.js` resolves binaries in order: bundled `bin/` → system PATH → `python -m yt_dlp`. On Termux the system `ffmpeg` and `yt-dlp` are used.
- Keep Termux alive with `termux-wake-lock` (Termux:API) and set battery optimisation to **Unrestricted**.
- Voice playback works, but Android may kill the process when Termux is swiped away.

## AI agent

Sulfuric already acts as an AI agent through Discord: `/ai` (or mention `@Sulfuric`) answers using any OpenAI-compatible provider, keeps per-user conversation history, and can run bot actions.

**Memory** — the agent remembers facts across sessions:

- `/remember <fact>` — save a fact about you (ephemeral confirmation).
- `/forget <text|#n>` — remove one.
- `/memories` — list what it knows about you.
- It also auto-captures `remember ...` / `ingat ...` / `note that ...` in chat.
- Facts are stored per user in `database.json` (`memory` key) and injected into the system prompt.

**Mobile front-end** — `mobile/pwa` (browser) or `mobile/android` (native APK source).

**Towards a fully autonomous agent** (not implemented): an agent loop where the model decides to call tools (`weather`, `play`, `remind`, `search`, ...) plus scheduled/proactive messages. The building blocks already exist — `memory.js`, the command set, and the AI client in `ai.js`.

---

## Docker

```sh
docker build -t sulfuric .
docker run --env-file .env sulfuric
```

---

## Sulfuric on your phone

Run the Sulfuric AI on Android through Discord, through the PWA, or through the native app with a floating bubble:

- [mobile/pwa](mobile/pwa) — web app, install to the home screen, no build.
- [mobile/android](mobile/android) — native APK: ChatGPT-style chat that can **control your phone** (flashlight, open apps, volume, brightness, Wi-Fi/Bluetooth, home) plus a floating bubble and a "My phone" status panel. Build it with the bundled Gradle wrapper, Android Studio, or GitHub Actions (`.github/workflows/android.yml` builds and uploads the APK).

See [mobile/README.md](mobile/README.md).

---

## Project structure

```
sulfur-bot/
├── index.js            # bot entry point: client, commands, event handlers
├── automod.js          # toxic-language detection
├── package.json
├── .env.example
├── database.example.json
├── Dockerfile
└── README.md
```

---

## Contributing

Contributions are welcome. Please:

1. Fork the repository and create a feature branch.
2. Keep changes focused — one fix or feature per pull request.
3. Run `npm run check` before opening a PR.
4. Never commit `.env`, `database.json`, or any token.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## Security

Never commit `.env`, your Discord bot token, or `database.json`. The repository ignores all three.

AutoMod is a local rule-based filter and will make mistakes. Review and expand `automod.js` for the language and slang used by your server. Anti-raid protection times out newly-created accounts on first join — if that is too aggressive for your community, run `/security enabled:false`.

`/weather` sends the city name you type to the Open-Meteo geocoding service, and with no city it asks `ipwho.is` for your approximate location. No data is stored.

---

## License

[MIT](LICENSE)
