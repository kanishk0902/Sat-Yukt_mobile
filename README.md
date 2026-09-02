<div align="center">

<img src="assets/icon.png" width="120" alt="Sat-Yukt logo" />

# Sat-Yukt

**सही जानकारी, सबकी पहुंच में — Truth that reaches everyone**

A voice-first fact-checking app for rural India. Speak a claim, a scheme, or a
WhatsApp forward — in your own language — and get a clear, spoken verdict back.

</div>

---

## Why this exists

Misinformation about government schemes, crop advice, and viral WhatsApp
forwards spreads fastest exactly where fact-checking tools are least
accessible — among low-literacy, low-bandwidth users who don't read English
and don't type well. Sat-Yukt is built around **voice in, voice out**, in nine
Indian languages, so checking a claim takes no more effort than asking a
neighbor.

## How it works

<div align="center">

```mermaid
sequenceDiagram
    participant U as Farmer
    participant A as Sat-Yukt App
    participant S as Speech-to-Text
    participant B as Backend
    participant G as Gemini

    U->>A: Taps mic, speaks claim (any of 9 languages)
    A->>S: Uploads audio
    S-->>A: Transcribed text + detected language
    A->>B: POST /api/verify { claimText, language }
    B->>G: Fact-check prompt (native-script response)
    G-->>B: { verdict, explanation }
    B-->>A: Verdict: True / False / Misleading / Unclear
    A->>U: Reads verdict aloud (native TTS)
```

</div>

No typing required end to end — though a text input is always available as a
fallback for users who prefer it, or in noisy environments.

## Feature coverage

```mermaid
graph LR
    A[Claim Input] --> A1["🎙️ Voice — 9 languages"]
    A --> A2["⌨️ Typed text"]
    A --> A3["📩 SMS fallback — no data plan"]

    B[Verification Engine] --> B1["Gemini-powered fact-check"]
    B --> B2["Verdict: True / False / Misleading / Unclear"]
    B --> B3["2-sentence plain-language explanation"]

    C[Delivery] --> C1["🔊 Spoken verdict — native TTS"]
    C --> C2["📖 On-screen card, native script"]

    D[Extras] --> D1["Latest government schemes — by state"]
    D --> D2["Onboarding: language, location, phone"]
```

## Language coverage

Nine languages, chosen for combined reach across rural India — UI, voice
input, Gemini responses, and text-to-speech output all work natively in each,
not just translated labels.

| Language | Script | TTS |
|---|---|---|
| हिन्दी (Hindi) | Devanagari | ✅ |
| English | Latin | ✅ |
| मराठी (Marathi) | Devanagari | ✅ |
| தமிழ் (Tamil) | Tamil | ✅ |
| తెలుగు (Telugu) | Telugu | ✅ |
| বাংলা (Bengali) | Bengali | ✅ |
| ગુજરાતી (Gujarati) | Gujarati | ✅ |
| ਪੰਜਾਬੀ (Punjabi) | Gurmukhi | ✅ |
| ಕನ್ನಡ (Kannada) | Kannada | ✅ |

Device locale is auto-detected on first launch (falling back to Hindi, not
English — the stronger signal for this audience), and can be switched anytime
from the home screen.

## Architecture

```mermaid
flowchart TB
    subgraph Client["📱 Expo / React Native App"]
        Mic["Mic + Type input"]
        UI["Home · Onboarding · Settings"]
        TTS["Text-to-Speech"]
    end

    subgraph Backend["🖥️ Node / Express Backend"]
        Verify["/api/verify"]
        Transcribe["/api/transcribe"]
        Schemes["/api/schemes"]
        Sms["/api/sms"]
        Config["/api/config-status"]
    end

    subgraph External["☁️ External Services"]
        Gemini["Google Gemini — fact-check + schemes"]
        STT["Google Cloud Speech-to-Text"]
        Twilio["Twilio — SMS / Voice / OTP"]
    end

    Mic --> Transcribe --> STT
    Mic --> Verify
    UI --> Schemes
    UI --> Config
    UI --> Sms --> Twilio

    Verify --> Gemini
    Schemes --> Gemini
    TTS -.->|"reads verdict aloud"| UI

    style Client fill:#407348,color:#fff
    style Backend fill:#1A241C,color:#fff
    style External fill:#f4f1ea,color:#1A241C
```

All third-party API keys live **only** on the backend — the client never
talks to Gemini, Google STT, or Twilio directly, so no secret ever ships
inside the app bundle.

## Tech stack

- **Client**: Expo (React Native), TypeScript, NativeWind (Tailwind for RN), React Navigation
- **Backend**: Node.js, Express
- **Fact-checking**: Google Gemini
- **Speech-to-text**: Google Cloud Speech-to-Text (ffmpeg transcoding for phone audio)
- **Text-to-speech**: native platform TTS via `expo-speech`
- **SMS fallback**: Twilio

## Getting started

```bash
# Client
npm install
cp .env.example .env        # point EXPO_PUBLIC_BACKEND_URL at your backend
npx expo start --tunnel

# Backend
cd backend
npm install
cp .env.example .env        # add your Gemini / Google STT / Twilio keys
node server.js
```

Full setup instructions, including how to get each API key, are in
[SETUP.md](SETUP.md).

## Project structure

```
src/
  screens/          Home, onboarding flow, settings
  components/        MicButton, VerdictCard, LanguageSelector, SchemesCard...
  services/           API client, voice, verification, offline queue
  localization/       9-language string tables

backend/
  server.js           Express routes
  services/            Gemini, Speech-to-Text, Twilio providers
```

---

<div align="center">
<sub>Built for accessibility-first fact-checking in rural India.</sub>
</div>
