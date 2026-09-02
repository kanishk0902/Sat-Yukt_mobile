require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { transcribeWithWispr, transcribeWithWhisper } = require("./services/sttProvider");
const { transcribeWithGoogle } = require("./services/googleSttProvider");
const { verifyClaimWithGemini, fetchLatestSchemes } = require("./services/geminiProvider");
const { sendSms } = require("./services/twilioProvider");
const { startVerification, checkVerification } = require("./services/twilioVerifyProvider");
const twilioSignatureMiddleware = require("./services/twilioSignatureMiddleware");
const {
  LANGUAGE_ORDER,
  SPEECH_GATHER_SUPPORTED,
  respondTwiml,
  languageMenuTwiml,
  languageFromDigit,
  questionPromptTwiml,
  verdictTwiml,
  didntCatchTwiml,
  errorTwiml,
  languageUnavailableTwiml,
} = require("./services/twimlHelpers");
const axios = require("axios");
// n8n/WhatsApp forwarding disabled for now — not in use. Re-enable by
// uncommenting this require and the /api/whatsapp/forward route below.
// const { forwardToN8n } = require("./services/n8nProvider");

const app = express();
// Required for twilioSignatureMiddleware to see the Cloudflare tunnel's
// public https:// URL via req.protocol/req.hostname, instead of the raw
// internal http://localhost:4000 this process actually listens on.
app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "15mb" })); // base64 audio can be a few MB
app.use(express.urlencoded({ extended: false })); // Twilio webhooks POST form-encoded bodies

const PORT = process.env.PORT || 4000;

function requireEnv(name) {
  if (!process.env[name]) {
    console.warn(`[Sat-Yukt backend] WARNING: ${name} is not set in backend/.env`);
  }
}

[
  "GEMINI_API_KEY",
  "GOOGLE_STT_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "TWILIO_VERIFY_SERVICE_SID",
].forEach(requireEnv);

// ---------------------------------------------------------------------------
// POST /api/transcribe
// Body: { audioBase64: string, mimeType: string, languageHint?: string }
// Provider priority: Google Cloud Speech-to-Text (best accuracy + native
// support for all 9 languages, has a free tier) -> Wispr Flow (if configured)
// -> OpenAI Whisper. Each provider falls through to the next on failure
// rather than failing the whole request, provided a later provider is
// actually configured.
// ---------------------------------------------------------------------------
app.post("/api/transcribe", async (req, res) => {
  const { audioBase64, mimeType, languageHint } = req.body || {};

  if (!audioBase64 || typeof audioBase64 !== "string") {
    return res.status(400).json({ error: "audioBase64 is required" });
  }

  const hasGoogle = !!process.env.GOOGLE_STT_API_KEY;
  const hasWispr = !!process.env.WISPR_API_KEY;
  const hasOpenAi = !!process.env.OPENAI_API_KEY;

  if (!hasGoogle && !hasWispr && !hasOpenAi) {
    return res.status(500).json({
      error:
        "No STT provider configured. Set GOOGLE_STT_API_KEY (recommended), WISPR_API_KEY, or OPENAI_API_KEY in backend/.env",
    });
  }

  try {
    let result;

    if (hasGoogle) {
      try {
        result = await transcribeWithGoogle(audioBase64, mimeType, languageHint);
      } catch (googleErr) {
        console.error("[transcribe] Google STT failed:", googleErr.message);
        if (!hasWispr && !hasOpenAi) throw googleErr;
      }
    }

    if (!result && hasWispr) {
      try {
        result = await transcribeWithWispr(audioBase64, mimeType, languageHint);
      } catch (wisprErr) {
        console.error("[transcribe] Wispr failed:", wisprErr.message);
        if (!hasOpenAi) throw wisprErr;
      }
    }

    if (!result && hasOpenAi) {
      result = await transcribeWithWhisper(audioBase64, mimeType, languageHint);
    }

    if (!result) {
      throw new Error("All configured STT providers failed");
    }

    return res.json(result); // { text, detectedLanguage }
  } catch (err) {
    console.error("[transcribe] failed:", err.message);
    return res.status(502).json({ error: "Transcription failed", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/verify
// Body: { claimText: string, language: string }
// Returns: { verdict: "True"|"False"|"Misleading"|"Unclear", explanation: string }
// ---------------------------------------------------------------------------
app.post("/api/verify", async (req, res) => {
  const { claimText, language } = req.body || {};

  if (!claimText || typeof claimText !== "string" || !claimText.trim()) {
    return res.status(400).json({ error: "claimText is required" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  try {
    const result = await verifyClaimWithGemini(claimText, language || "hi");
    return res.json(result);
  } catch (err) {
    console.error("[verify] failed:", err.message);
    return res.status(502).json({ error: "Verification failed", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/schemes?state=...&language=...
// Returns a short list of real, currently active government schemes relevant
// to the given state, generated by Gemini. Cached in-memory per (state,
// language) pair for 24h — scheme relevance doesn't change minute-to-minute,
// and this avoids a Gemini call on every Home screen load for every user.
// ---------------------------------------------------------------------------
const SCHEMES_CACHE = new Map(); // key: `${state}|${language}` -> { schemes, cachedAt }
const SCHEMES_CACHE_MS = 24 * 60 * 60 * 1000;
// A separate, much shorter cooldown for FAILURES specifically. Without this,
// many clients re-mounting the schemes card in a short window (e.g. every
// time a user backs out of a mic attempt on Home) can retry-storm Gemini
// during a rate-limit or outage, which then starves the actual /api/verify
// fact-check feature of the same shared quota — a real incident this
// exact bug caused once already.
const SCHEMES_FAILURE_COOLDOWN = new Map(); // key -> failedAt timestamp
const SCHEMES_FAILURE_COOLDOWN_MS = 2 * 60 * 1000;

app.get("/api/schemes", async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state.trim() : "";
  const language = typeof req.query.language === "string" ? req.query.language : "hi";

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  const cacheKey = `${state}|${language}`;
  const cached = SCHEMES_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < SCHEMES_CACHE_MS) {
    return res.json({ schemes: cached.schemes });
  }

  const failedAt = SCHEMES_FAILURE_COOLDOWN.get(cacheKey);
  if (failedAt && Date.now() - failedAt < SCHEMES_FAILURE_COOLDOWN_MS) {
    return res.status(502).json({ error: "Could not fetch schemes", detail: "cooldown after recent failure" });
  }

  try {
    const schemes = await fetchLatestSchemes(state || null, language);
    SCHEMES_CACHE.set(cacheKey, { schemes, cachedAt: Date.now() });
    SCHEMES_FAILURE_COOLDOWN.delete(cacheKey);
    return res.json({ schemes });
  } catch (err) {
    SCHEMES_FAILURE_COOLDOWN.set(cacheKey, Date.now());
    console.error("[schemes] failed:", err.message);
    // Serve a stale cache entry rather than an empty card if Gemini fails
    // but we have something from earlier today/yesterday.
    if (cached) return res.json({ schemes: cached.schemes });
    return res.status(502).json({ error: "Could not fetch schemes", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/sms/queue
// Body: { query: string, userPhone: string }
// Sends an immediate acknowledgment SMS via Twilio, then verifies the claim
// with Gemini in the background and sends a follow-up SMS with the verdict.
// Responds as soon as the acknowledgment SMS is sent — does NOT block on
// the Gemini call, since the whole point is this path serves users with an
// unreliable data connection who may close the app immediately after.
// ---------------------------------------------------------------------------
app.post("/api/sms/queue", async (req, res) => {
  const { query, userPhone } = req.body || {};

  if (!query || !userPhone) {
    return res.status(400).json({ error: "query and userPhone are required" });
  }

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return res.status(500).json({ error: "Twilio is not configured" });
  }

  const ackMessage = `Sat-Yukt Received: "${truncate(query, 100)}". We are verifying this and will text you the result.`;

  try {
    await sendSms(userPhone, ackMessage);
    res.json({ queued: true });
  } catch (err) {
    console.error("[sms/queue] ack SMS failed:", err.message);
    // Twilio error 21608: "unverified number" — only possible on a Trial
    // account, which can only SMS numbers manually verified in the Twilio
    // Console (Phone Numbers -> Verified Caller IDs). Surface this distinctly
    // so the app can show an actionable message instead of a generic failure.
    const twilioErrorCode = err.response?.data?.code;
    if (twilioErrorCode === 21608) {
      return res.status(502).json({
        error: "TRIAL_NUMBER_UNVERIFIED",
        detail:
          "This Twilio account is a Trial account, which can only send SMS to phone numbers verified in the Twilio Console.",
      });
    }
    return res.status(502).json({ error: "Could not send SMS", detail: err.message });
  }

  // Fire-and-forget: verify, then send a follow-up SMS with the result.
  // Runs after the response is already sent so the app isn't kept waiting.
  (async () => {
    try {
      const result = await verifyClaimWithGemini(query, "en");
      const verdictMessage = `Sat-Yukt Result for "${truncate(query, 60)}": ${result.verdict.toUpperCase()}. ${result.explanation}`;
      await sendSms(userPhone, truncate(verdictMessage, 320)); // SMS-length safety margin
    } catch (err) {
      console.error("[sms/queue] background verification/follow-up SMS failed:", err.message);
      try {
        await sendSms(
          userPhone,
          "Sat-Yukt: We could not verify your question right now. Please try again later."
        );
      } catch {
        // Both attempts failed — nothing more we can do server-side; logged above.
      }
    }
  })();
});

// ---------------------------------------------------------------------------
// POST /api/auth/otp/send
// Body: { phone: string }
// Starts a Twilio Verify SMS verification for the given phone number.
// ---------------------------------------------------------------------------
const TWILIO_VERIFY_CONFIGURED = () =>
  !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_VERIFY_SERVICE_SID
  );

// TEMPORARY, TEST-ONLY: while Twilio Verify isn't configured, accept this
// fixed code so onboarding can be tested end-to-end without real SMS. This
// path is only reachable when TWILIO_VERIFY_CONFIGURED() is false, so it
// stops applying automatically the moment real credentials are added —
// remove this block once Twilio Verify is live.
const TEST_MODE_OTP_CODE = "000000";

app.post("/api/auth/otp/send", async (req, res) => {
  const { phone } = req.body || {};

  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ error: "phone is required" });
  }

  if (!TWILIO_VERIFY_CONFIGURED()) {
    console.warn(
      `[auth/otp/send] TEST MODE (Twilio Verify not configured): use code ${TEST_MODE_OTP_CODE} to verify ${phone}`
    );
    return res.json({ sent: true, testMode: true });
  }

  try {
    await startVerification(phone);
    return res.json({ sent: true });
  } catch (err) {
    console.error("[auth/otp/send] failed:", err.message);
    return res.status(502).json({ error: "Could not send OTP", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/otp/verify
// Body: { phone: string, code: string }
// Returns: { verified: boolean } — a wrong/expired code is a normal false,
// not an HTTP error; only a broken Twilio call itself is a 502.
// ---------------------------------------------------------------------------
app.post("/api/auth/otp/verify", async (req, res) => {
  const { phone, code } = req.body || {};

  if (!phone || !code) {
    return res.status(400).json({ error: "phone and code are required" });
  }

  if (!TWILIO_VERIFY_CONFIGURED()) {
    // TEMPORARY, TEST-ONLY — see TEST_MODE_OTP_CODE comment above.
    return res.json({ verified: code === TEST_MODE_OTP_CODE });
  }

  try {
    const result = await checkVerification(phone, code);
    return res.json({ verified: result.status === "approved" });
  } catch (err) {
    console.error("[auth/otp/verify] failed:", err.message);
    return res.status(502).json({ error: "Could not verify OTP", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/whatsapp/forward — disabled for now, not in use. Uncomment along
// with the forwardToN8n require above and N8N_WEBHOOK_URL in .env to re-enable.
// Body: { mediaUrl: string|null, text: string }
// ---------------------------------------------------------------------------
// app.post("/api/whatsapp/forward", async (req, res) => {
//   const { mediaUrl, text } = req.body || {};
//
//   if (!process.env.N8N_WEBHOOK_URL) {
//     return res.status(500).json({ error: "N8N_WEBHOOK_URL is not configured" });
//   }
//
//   try {
//     await forwardToN8n(mediaUrl || null, text || "");
//     return res.json({ forwarded: true });
//   } catch (err) {
//     console.error("[whatsapp/forward] failed:", err.message);
//     return res.status(502).json({ error: "Forward failed", detail: err.message });
//   }
// });

// ---------------------------------------------------------------------------
// Voice IVR — lets anyone call the Sat-Yukt Twilio number, speak a question,
// and hear the verdict read back, in any of the 9 supported languages. Not
// gated behind an app; reaches any phone, including one with no data plan.
//
// Flow: /voice/incoming (language menu) -> /voice/language (digit picked) ->
// /voice/question (hi/en, Twilio's own speech recognition) or
// /voice/question-recorded (the other 7 languages, via <Record> + Whisper,
// since Twilio's speech recognition doesn't support them) -> loops back into
// another question until the caller hangs up or a gather/record times out.
//
// All four routes are Twilio webhooks: they must always respond with TwiML,
// never JSON — even on failure, so callers hear a spoken message instead of
// a broken call.
// ---------------------------------------------------------------------------
app.use("/voice", twilioSignatureMiddleware);

app.post("/voice/incoming", (_req, res) => {
  respondTwiml(res, languageMenuTwiml("/voice/language"));
});

app.post("/voice/language", (req, res) => {
  const lang = languageFromDigit(req.body?.Digits);

  if (!lang) {
    return respondTwiml(res, languageMenuTwiml("/voice/language"));
  }

  const actionUrl = SPEECH_GATHER_SUPPORTED.has(lang)
    ? `/voice/question?lang=${lang}`
    : `/voice/question-recorded?lang=${lang}`;
  respondTwiml(res, questionPromptTwiml(lang, actionUrl));
});

app.post("/voice/question", async (req, res) => {
  const lang = req.query.lang && LANGUAGE_ORDER.includes(req.query.lang) ? req.query.lang : "en";
  const claimText = req.body?.SpeechResult;
  const actionUrl = `/voice/question?lang=${lang}`;

  if (!claimText || !claimText.trim()) {
    return respondTwiml(res, didntCatchTwiml(lang, actionUrl));
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("[voice/question] GEMINI_API_KEY not configured");
    return respondTwiml(res, errorTwiml(lang));
  }

  try {
    const result = await verifyClaimWithGemini(claimText, lang);
    respondTwiml(res, verdictTwiml(result.verdict, result.explanation, lang, actionUrl));
  } catch (err) {
    console.error("[voice/question] verification failed:", err.message);
    respondTwiml(res, errorTwiml(lang));
  }
});

app.post("/voice/question-recorded", async (req, res) => {
  const lang = req.query.lang && LANGUAGE_ORDER.includes(req.query.lang) ? req.query.lang : "hi";
  const recordingUrl = req.body?.RecordingUrl;
  const actionUrl = `/voice/question-recorded?lang=${lang}`;

  if (!recordingUrl) {
    return respondTwiml(res, didntCatchTwiml(lang, actionUrl));
  }

  const hasGoogleStt = !!process.env.GOOGLE_STT_API_KEY;
  const hasOpenAi = !!process.env.OPENAI_API_KEY;

  if (!hasGoogleStt && !hasOpenAi) {
    console.error(`[voice/question-recorded] no STT provider configured, needed for ${lang}`);
    return respondTwiml(res, languageUnavailableTwiml(lang));
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("[voice/question-recorded] GEMINI_API_KEY not configured");
    return respondTwiml(res, errorTwiml(lang));
  }

  try {
    const audioResponse = await axios.get(`${recordingUrl}.mp3`, {
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
      responseType: "arraybuffer",
      timeout: 15000,
    });
    const audioBase64 = Buffer.from(audioResponse.data).toString("base64");

    let transcription;
    if (hasGoogleStt) {
      try {
        transcription = await transcribeWithGoogle(audioBase64, "audio/mp3", lang);
      } catch (googleErr) {
        console.error("[voice/question-recorded] Google STT failed:", googleErr.message);
        if (!hasOpenAi) throw googleErr;
      }
    }
    if (!transcription) {
      transcription = await transcribeWithWhisper(audioBase64, "audio/mp3", lang);
    }
    if (!transcription.text || !transcription.text.trim()) {
      return respondTwiml(res, didntCatchTwiml(lang, actionUrl));
    }

    const result = await verifyClaimWithGemini(transcription.text, lang);
    respondTwiml(res, verdictTwiml(result.verdict, result.explanation, lang, actionUrl));
  } catch (err) {
    console.error("[voice/question-recorded] failed:", err.message);
    respondTwiml(res, errorTwiml(lang));
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// GET /api/config-status
// Lets the app know which optional features are actually usable, so it can
// hide UI for features that would just fail (e.g. SMS fallback when no
// Twilio phone number is provisioned on the account — common on a Twilio
// Trial account, which now requires adding billing to claim any number at
// all). This is a UI-affordance signal only, not a security boundary.
//
// Having TWILIO_PHONE_NUMBER set in .env isn't enough to know SMS will
// actually work — that number might not really be provisioned on the
// account (e.g. left over from a previous/different account). So this
// checks Twilio's actual IncomingPhoneNumbers list, cached briefly since
// it rarely changes and querying Twilio on every app load is wasteful.
// ---------------------------------------------------------------------------
let smsAvailableCache = { value: false, checkedAt: 0 };
const SMS_STATUS_CACHE_MS = 5 * 60 * 1000;

async function checkSmsAvailable() {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_PHONE_NUMBER
  ) {
    return false;
  }

  if (Date.now() - smsAvailableCache.checkedAt < SMS_STATUS_CACHE_MS) {
    return smsAvailableCache.value;
  }

  try {
    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`,
      {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
        timeout: 8000,
      }
    );
    const hasNumber = (response.data?.incoming_phone_numbers || []).some(
      (n) => n.phone_number === process.env.TWILIO_PHONE_NUMBER
    );
    smsAvailableCache = { value: hasNumber, checkedAt: Date.now() };
    return hasNumber;
  } catch (err) {
    console.error("[config-status] could not verify Twilio phone number:", err.message);
    smsAvailableCache = { value: false, checkedAt: Date.now() };
    return false;
  }
}

app.get("/api/config-status", async (_req, res) => {
  res.json({
    smsAvailable: await checkSmsAvailable(),
    otpAvailable: TWILIO_VERIFY_CONFIGURED(),
  });
});

function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sat-Yukt backend listening on http://0.0.0.0:${PORT}`);
  console.log("Make sure your phone is on the same wifi network as this machine.");
});
