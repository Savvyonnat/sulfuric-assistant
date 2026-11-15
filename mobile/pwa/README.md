# Sulfuric Assistant — PWA

Mobile AI assistant for **Sulfuric**, as an installable web app. One page, no build, no framework.

> This is the **PWA** (web) version. For the native Android app with a floating bubble, see [`../android`](../android).

## Features

- Chat with an AI (OpenAI-compatible `/chat/completions`).
- **Use your own API** — set key / base URL / model in Settings.
- **Voice input** (Web Speech API, Chrome/Android) — tap the mic and talk.
- Chat history saved on the device (localStorage).
- **My phone** panel (phone icon): battery, storage, memory, network, device model, uptime.
- Installable to the home screen (manifest + service worker), full-screen look.
- No account, no server, no build.

## Use it on your phone (2 ways)

### Way 1 — through Discord (easiest)
The Sulfuric bot already works on mobile in the Discord app: `/ai message:...` or mention `@Sulfuric`. No need for this app.

### Way 2 — install this PWA
1. Serve `index.html` over **HTTPS** (or `localhost`), e.g. GitHub Pages / Netlify / a VPS, or locally:
   ```sh
   npx serve .        # or: python -m http.server 8080
   ```
2. Chrome → ⋮ menu → **Add to Home screen** / **Install app**.
3. The "Sulfuric" icon appears on your home screen; open it like an app.

> A PWA needs HTTPS (except `localhost`) for the service worker and speech recognition.

## API setup

Open **Settings** (gear icon) and fill in:

| Field | Example | Notes |
|---|---|---|
| API Key | `gsk_...` | Groq. Leave empty for the free provider. |
| Base URL | `https://api.groq.com/openai/v1` | required when using a key |
| Model | `openai/gpt-oss-120b` | Groq |
| Temperature | `0.8` | optional |

**Without a key** → uses `https://text.pollinations.ai/openai` (free, model `openai`), about 1 reply / 45 seconds per IP.

Other providers (Gemini, DeepSeek, OpenRouter, LongCat, a local llama.cpp) just need a different base URL + model — the request format is the same.

## Security

The API key is stored **only** in this device's `localStorage` and sent directly to the provider over HTTPS. No middleman server. Do not share a backup of localStorage.

## Structure

```
pwa/
├── index.html          # UI
├── styles.css          # mobile-first styling
├── app.js              # chat + voice + settings logic
├── manifest.webmanifest# install metadata
├── sw.js               # shell cache (offline)
├── icons/              # 192 & 512 icons
└── README.md
```

## Limitations

- A floating bubble over other apps is **not** possible from the web — that needs the native app (see `../android`).
- Speech recognition uses the browser engine (Chrome).
