# Sulfuric on your phone

Two ways to run the Sulfuric AI on Android:

| | [PWA](pwa) | [Android](android) |
|---|---|---|
| Floating bubble over other apps | no | yes |
| Install | "Add to Home screen" from Chrome | APK (build with Android Studio or GitHub Actions) |
| Requires build | no | yes |
| Voice | Web Speech API (Chrome) | SpeechRecognizer (native) |
| "My phone" status | Web APIs (battery, storage, memory, network) | native bridge (battery, storage, RAM, network, uptime) |
| Control the phone (flashlight, apps, volume, brightness, Wi-Fi) | no (browser cannot) | yes, from chat |
| Chat UI | same | same (copied into assets) |
| Available | right now | after the APK is built |

Both use the same AI provider (Groq by default, or the free one with no key) and store the API key on the device.

- Use it right now → [PWA](pwa)
- Want a Siri-like bubble → [Android](android) (needs a build)
