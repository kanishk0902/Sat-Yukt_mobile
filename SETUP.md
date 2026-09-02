# Sat-Yukt — Setup Guide

Sat-Yukt is a voice-first fact-checking app for rural, low-literacy users to verify
news, government schemes, and agricultural advisories by speaking a question aloud.

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐        ┌─────────────┐
│  Expo React Native   │  HTTPS  │  Local Node backend   │  HTTPS │  Gemini API │
│  app (this device)   │ ──────> │  (your machine / LAN) │──────> │  Twilio API │
└─────────────────────┘         └──────────────────────┘        └─────────────┘
```

**Why a backend at all, if it's "just for you"?**
Expo's `EXPO_PUBLIC_*` env vars are compiled directly into the JS bundle that ships
to the phone. Anyone with the APK/IPA (or just a proxy on the same wifi) can read
them in plain text. Your **Twilio Auth Token** and **Gemini API key** are real
secrets tied to your billing — they must never live behind `EXPO_PUBLIC_`. The Wispr
key is lower-stakes (STT-only, per Wispr's docs) but we proxy it too for consistency
and so you can swap providers without touching the app.

The backend below is deliberately minimal — a single `server.js`, no auth, no
deployment config — because you told me it's local-only. **Do not point this at
the public internet as-is**: there's no rate limiting or authentication on it.
If you later want to expose it (e.g. to demo over LAN to real farmers), at minimum
add an API key check on the phone→backend leg — ask me and I'll add it.

---

## 1. Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli` not required for SDK 50+; `npx expo` works directly)
- A phone with Expo Go installed, OR an Android/iOS simulator
- Accounts/keys for: Google AI Studio (Gemini), Twilio, Wispr Flow (or OpenAI as STT fallback)

## 2. Create the Expo app

```bash
npx create-expo-app@latest gramsatya --template blank-typescript
cd gramsatya
```

## 3. Install dependencies

```bash
# Core
npx expo install expo-av expo-speech expo-file-system expo-haptics expo-localization
npx expo install @react-native-async-storage/async-storage @react-native-community/netinfo
npm install axios

# Styling — NativeWind v4 + Tailwind
npm install nativewind tailwindcss@^3.4.0
npx tailwindcss init

# Navigation (Home + Settings + History)
npx expo install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
```

## 4. NativeWind config

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        verdictTrue: "#1B7A3D",
        verdictFalse: "#B3261E",
        verdictMisleading: "#B8860B",
        brand: "#0B5FA5",
      },
    },
  },
  plugins: [],
};
```

`babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

`metro.config.js`:
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

`global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## 5. Copy the generated files

Copy every file under `src/`, `App.tsx`, `app.config.ts` from this project into
your `gramsatya/` folder, preserving paths.

## 6. Environment variables

### App (`.env` in project root — client-safe only)
```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.50:4000
```
Replace with your computer's LAN IP (not `localhost` — the phone can't resolve
your laptop's localhost). Find it with `ipconfig getifaddr en0` (Mac) or
`ipconfig` (Windows, look for IPv4).

**Nothing else goes in the app's `.env`.** The keys below live only in the backend.

### Backend (`backend/.env` — secrets, never shipped to the phone)
```env
GEMINI_API_KEY=
GOOGLE_STT_API_KEY=
WISPR_API_KEY=
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_VERIFY_SERVICE_SID=
N8N_WEBHOOK_URL=
PORT=4000
```
`TWILIO_VERIFY_SERVICE_SID` powers phone number OTP during onboarding —
create a Verify Service at Twilio Console → Verify → Services → Create new.

`GOOGLE_STT_API_KEY` powers voice transcription (speech-to-text) — see
section 11 below for setup and why it's the recommended provider.

## 7. Run the backend

```bash
cd backend
npm install
npm start
# → Sat-Yukt backend listening on http://0.0.0.0:4000
```

Keep this running in a terminal while you use the app. Your phone and laptop
must be on the **same wifi network**.

## 8. Run the app

```bash
cd gramsatya
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## 9. Sanity check

1. Open the app — you should see the big mic button and a language selector.
2. Tap the mic, say a short claim in Hindi or English, tap again.
3. You should see "Analyzing…" then a color-coded verdict card, and hear it read aloud.
4. Turn off wifi on the phone (keep the backend running — this simulates the
   phone losing signal but the SMS path uses your carrier signal, not wifi, so
   test this on a real device with mobile data, not the simulator) and tap
   "No internet? Get result by SMS" to test the Twilio fallback.

## 10. Set up the Voice IVR (phone-call channel)

Anyone can call your Sat-Yukt Twilio number, pick a language by pressing a
digit, ask their question aloud, and hear the verdict read back — no app or
data connection needed on their end.

1. Your backend must be reachable at a public HTTPS URL (a Cloudflare/ngrok
   tunnel works for testing; see the tunnel-mode notes above if you're behind
   a network with client isolation).
2. In the [Twilio Console](https://console.twilio.com), go to
   **Phone Numbers → Manage → Active Numbers**, click your number, and under
   **Voice Configuration** set "A call comes in" to
   **Webhook**, `{your public backend URL}/voice/incoming`, **HTTP POST**.
3. Call the number. Press a digit for your language, ask your question after
   the beep, listen for the verdict.

**Important:** if you're using a free/ephemeral tunnel (like `cloudflared`'s
quick tunnels), the public URL changes every time the tunnel restarts — you
must update step 2 by hand each time, or the calls will fail.

Hindi and English use Twilio's own speech recognition (fast). The other 7
languages use `<Record>` + the same STT pipeline the app uses (Google Cloud
Speech-to-Text if `GOOGLE_STT_API_KEY` is set, else OpenAI Whisper), since
Twilio's own speech recognition doesn't support them.

---

## 11. Set up voice transcription (speech-to-text)

Every recorded question — in the app and the 7-language phone-call path —
needs a speech-to-text provider to turn audio into text before Gemini can
fact-check it. Without one configured, every voice recording fails with
"Something went wrong."

**Recommended: Google Cloud Speech-to-Text** — best accuracy for all 9 app
languages, and has a genuine free tier (60 minutes/month free, then
pay-as-you-go — no card needed just to try it in most regions).

1. Go to the [Google Cloud Console](https://console.cloud.google.com),
   create or select a project.
2. Search for **"Cloud Speech-to-Text API"** in the API library and enable it.
3. Go to **APIs & Services → Credentials → Create Credentials → API key**.
4. Copy the key into `backend/.env` as `GOOGLE_STT_API_KEY=...`.

The backend transcodes recordings (m4a/mp3) to WAV internally using a
bundled `ffmpeg` binary (via `ffmpeg-static`) before calling Google's API,
since Google Speech-to-Text doesn't accept AAC/M4A directly — this is
automatic, no setup needed on your end.

**Fallback order:** `GOOGLE_STT_API_KEY` → `WISPR_API_KEY` → `OPENAI_API_KEY`.
Only one is required; set whichever you have. Wispr Flow's public API
contract for third-party audio upload isn't independently verifiable (see
Known Limitations below); OpenAI Whisper works but has no free tier
(~$0.006/min).

---

## 12. Twilio Trial account limits (SMS and Verify OTP)

If you're on a **Twilio Trial account** (the default until you add billing),
two things in this app are restricted, not broken:

- **SMS fallback ("Get result by SMS")** can only text phone numbers you've
  manually verified: Twilio Console → Phone Numbers → Manage →
  **Verified Caller IDs** → add a number (Twilio calls/texts it a
  confirmation code). Sending to any other number fails with a
  "SMS service is still in test mode" message in the app.
- **Phone number OTP during onboarding** (`TWILIO_VERIFY_SERVICE_SID`)
  requires upgrading to a paid Twilio account to create a Verify Service at
  all — this is a Twilio account-level restriction, not a code bug. Until
  you upgrade, the app's test-mode OTP bypass (code `000000`) is the only
  way past that screen.

Neither of these can be worked around in code — upgrading the Twilio
account (adding a payment method) removes both restrictions.

---

## Known limitations / what to harden before real deployment

- **No auth on the backend.** Fine for local dev; not fine for a public server.
- **OTP success only sets a local AsyncStorage flag on the phone, not a server
  session.** Consistent with the "no auth on backend" limitation above — there's
  no server-side user store to attach a real session to yet.
- **No rate limiting** — someone could hammer your Gemini/Twilio quota via the backend.
- **Wispr Flow's public API surface for third-party integration is not something I
  could verify** — I've written the client against a plausible REST contract
  (multipart audio upload → `{ text, language }`) and given you an OpenAI Whisper
  fallback that I know works, toggled by which key is present. Check Wispr's actual
  docs before relying on it; the fallback is production-real.
- **SMS-based "verification"**: the backend queues the query and Twilio texts an
  acknowledgment immediately; a **second** SMS with the actual verdict fires once
  Gemini responds (fire-and-forget from the backend, works even if the phone is
  offline since it doesn't depend on the app being open).
