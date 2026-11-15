# Sulfuric Assistant — Android (floating bubble)

Native Android app for **Sulfuric**: a bubble floating over other apps (Siri-style), notifications, and voice input. The chat uses the same web UI as the PWA ([`../pwa`](../pwa)), so the settings are separate but the code is shared.

> **Status:** the Gradle wrapper is included, so the project builds as-is. The development machine has no Android SDK / JDK, so the **APK was not compiled or runtime-tested here** — build it with Android Studio, the CLI, or GitHub Actions (below). Expect small fixes on the first build.

## What it does

- **Floating bubble** over other apps (needs the "Display over other apps" permission).
- Tap the bubble → opens chat. Drag to move. The **×** button turns it off.
- **Full AI chat**: text, history, API key / base URL / model settings.
- **Voice** via Android's `SpeechRecognizer` (a JS bridge `AndroidVoice`), not the Web Speech API.
- **"My phone" status**: battery (level + charging), storage, RAM, network type and uptime, read through the `AndroidPhone` bridge (`PhoneStatus.kt`).
- **Phone control**: the chat can actually operate the phone — flashlight on/off, open any app by name, set volume (percent / up / down / mute), set brightness, open Wi-Fi/Bluetooth/NFC settings, and go home. Executed by `PhoneControl.kt` through the `AndroidControl` bridge, with a local Indonesian/English command parser so it works even when the AI is offline.
- Foreground service + notification so the bubble stays alive.
- Open source, no account, no server.

## Build in the cloud (GitHub Actions — no local toolchain)

The repository ships `.github/workflows/android.yml`. Push to `main` (or open **Actions → Android APK → Run workflow**) and it builds `app-debug.apk` on Ubuntu, then uploads it as a downloadable artifact. This is the easiest way to get an APK without installing anything.

## Build (Android Studio)

1. Install **Android Studio** (bundled JDK 17 + Android SDK).
2. Open this folder: `mobile/android`.
3. Let Gradle sync finish (needs internet; downloads AGP 8.5.2, Kotlin 1.9.24, Gradle 8.7).
4. **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
5. The APK is at `app/build/outputs/apk/debug/app-debug.apk` — install it on your phone (`adb install` or copy & install).

## Build (CLI, if the toolchain is already installed)

The Gradle wrapper is included, so no separate Gradle install is needed:

```sh
cd mobile/android
./gradlew assembleDebug          # first run downloads Gradle 8.7
# APK: app/build/outputs/apk/debug/app-debug.apk
```

## Usage

1. Open the **Sulfuric** app.
2. Tap **Enable Bubble** → allow *Display over other apps*.
3. The bubble appears. Tap → chat. Use the gear icon in chat to set **API key / base URL / model**.
4. Mic: allow **record audio** when asked.

## API setup

Same as the PWA — inside the chat, open **Settings**:
- Leave `AI_API_KEY` empty → free provider (Pollinations, slow).
- Groq: `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=openai/gpt-oss-120b`.
- Gemini / DeepSeek / OpenRouter / LongCat: see [`../pwa/README.md`](../pwa/README.md).

## Structure

```
android/
├── app/
│   ├── build.gradle
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── assets/www/                 # copy of the PWA (chat UI)
│       ├── java/com/sulfuric/assistant/
│       │   ├── MainActivity.kt         # permissions + start button
│       │   ├── ChatActivity.kt         # WebView chat
│       │   ├── FloatingBubbleService.kt# overlay bubble
│       │   ├── VoiceBridge.kt          # SpeechRecognizer -> JS
│       │   ├── PhoneStatus.kt          # phone state + AndroidPhone bridge
│       │   └── PhoneControl.kt         # actions + AndroidControl bridge
│       └── res/…                       # layouts, themes, icons
├── build.gradle
├── settings.gradle
├── gradle.properties
├── gradlew / gradlew.bat               # Gradle 8.7 wrapper
└── README.md
```

## Technical notes

- `minSdk 24`, `targetSdk 34`, AGP 8.5.2, Kotlin 1.9.24, Gradle 8.7.
- Overlay uses `TYPE_APPLICATION_OVERLAY` + a `specialUse` foreground service.
- The API key is stored in WebView `localStorage` (app-internal) and sent directly to the provider over HTTPS.
- If the build fails, send the Gradle error — most often an AGP/Gradle version or dependency issue.

## License

MIT — same as the parent project.
