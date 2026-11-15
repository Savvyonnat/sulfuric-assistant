# Sulfuric on Termux (Android)

Run the Sulfuric bot directly on your phone with [Termux](https://termux.dev) — no PC, no server. The bot is plain Node.js, so it works headless; music uses the system `ffmpeg` and `yt-dlp` (resolved by `tools.js`).

---

## 1. Install Termux

- **F-Droid** (recommended) or the [GitHub releases](https://github.com/termux/termux-app/releases) page.
- **Do not use the Play Store version** — it is outdated and broken.
- Open Termux once, then:
  ```sh
  pkg update && pkg upgrade -y
  ```

Optional but recommended:
- **Termux:API** (F-Droid) — enables `termux-wake-lock`.
- **Termux:Boot** (F-Droid) — start the bot automatically at boot.

## 2. Get the project

**Option A — clone from GitHub (easiest):**
```sh
git clone https://github.com/Savvyonnat/sulfuric-assistant.git
cd sulfuric-assistant
```

**Option B — copy from your PC:** copy the whole project folder to your phone (for example into `~/sulfur-bot`), then:
```sh
cd ~/sulfur-bot
```

## 3. Run the installer

```sh
bash termux/setup.sh
```

This installs `nodejs`, `ffmpeg`, `python`, `git`, and `yt-dlp`, then runs `npm install`. It is safe to run again.

> If `npm install` fails on `ffmpeg-static`, run:
> ```sh
> npm install --ignore-scripts
> ```
> The bot then uses the system `ffmpeg` from Termux instead.

## 4. Configure

```sh
cp .env.example .env
nano .env
```

Fill in at least:

```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id
```

| Variable | Required | Notes |
|---|---|---|
| `DISCORD_TOKEN` | yes | Bot token from the Discord Developer Portal |
| `CLIENT_ID` | yes | Application ID (used for the invite link) |
| `GUILD_ID` | recommended | Registers slash commands instantly on your server |
| `ACTIVITY_NAME` | no | Presence text, default `Sulfuric Online >w<` |
| `AI_API_KEY` | no | Empty = free provider; set = Groq/OpenRouter/DeepSeek/… |
| `AI_BASE_URL` / `AI_MODEL` | no | Defaults to Groq `openai/gpt-oss-120b` |

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`.

Get the token at <https://discord.com/developers/applications> → your app → **Bot** → Reset Token. Enable **Message Content Intent** on the same page (the bot needs it for prefix commands).

## 5. Start the bot

```sh
bash termux/start.sh
```

You should see `Logged in as Sulfuric#....`. To stop, press `Ctrl+C`.

Run it in the background instead:
```sh
nohup bash termux/start.sh > bot.log 2>&1 &
tail -f bot.log
```

## 6. Keep Termux alive

Android kills background apps to save battery. To stop that:

1. **Wake lock** (needs Termux:API):
   ```sh
   termux-wake-lock
   ```
   (`termux/start.sh` runs this for you automatically.)
2. **Battery optimization:** Android Settings → Apps → Termux → Battery → **Unrestricted**.
3. **Autostart (optional):** with Termux:Boot installed, `termux/boot.sh` runs at boot.

## 7. Using it

- Music: `!play <song>`, `!skip`, `!stop`, `!list`, `!ytmp3 <url>` — the bot must be in a voice channel.
- AI: `/ai <message>` or mention `@Sulfuric`.
- Everything else is in `/help`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Logged in as ...` never appears | Check `DISCORD_TOKEN`; run `pkg install -y nodejs` again |
| Music says yt-dlp not found | `pkg install -y yt-dlp` or `python -m pip install -U yt-dlp` |
| Music says ffmpeg not found | `pkg install -y ffmpeg` |
| Voice joins but is silent | Check the bot has **Connect** + **Speak** in that channel |
| `AI HTTP 401` | Your `AI_API_KEY` is wrong or expired |
| Bot dies when you leave Termux | `termux-wake-lock` + battery **Unrestricted** |
| `Permission denied` on a script | `bash termux/setup.sh` (do not `./termux/setup.sh`) or `chmod +x termux/*.sh` |

## Files

| File | Purpose |
|---|---|
| `termux/setup.sh` | One-time installer (packages + npm install) |
| `termux/start.sh` | Start the bot (with wake lock) |
| `termux/stop.sh` | Stop a background bot |
| `termux/boot.sh` | Start at boot (for Termux:Boot) |
| `termux/README.md` | This tutorial |
