const axios = require("axios");
const FormData = require("form-data");

/**
 * NOTE ON WISPR FLOW: Wispr Flow's primary product is a desktop/system-level
 * dictation tool; its public REST API surface for arbitrary third-party audio
 * uploads is not something I can verify against real documentation as of
 * writing. This client is written against the most plausible REST contract
 * (multipart audio upload with a Bearer key, returning transcribed text) so
 * that swapping in the real endpoint is a small, contained change. If Wispr's
 * actual API differs, update WISPR_ENDPOINT and the field names below —
 * everything else in the app is unaffected since callers only see
 * { text, detectedLanguage }.
 *
 * The Whisper fallback below IS a real, verified contract
 * (OpenAI's /v1/audio/transcriptions) and works today if you set
 * OPENAI_API_KEY with no Wispr key at all — that's a fully production path.
 */

const WISPR_ENDPOINT = "https://api.wisprflow.ai/v1/transcribe";

async function transcribeWithWispr(audioBase64, mimeType, languageHint) {
  const apiKey = process.env.WISPR_API_KEY;
  const audioBuffer = Buffer.from(audioBase64, "base64");

  const form = new FormData();
  form.append("audio", audioBuffer, {
    filename: `recording.${extensionFromMime(mimeType)}`,
    contentType: mimeType || "audio/m4a",
  });
  if (languageHint) form.append("language", languageHint);

  const response = await axios.post(WISPR_ENDPOINT, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: 25000,
  });

  // Defensive parsing: accept a couple of plausible response shapes rather
  // than assuming one exact schema, since this endpoint is unverified.
  const text = response.data?.text ?? response.data?.transcript ?? "";
  const detectedLanguage =
    response.data?.language ?? response.data?.detected_language ?? languageHint ?? "hi";

  if (!text) {
    throw new Error("Wispr returned an empty transcript");
  }

  return { text, detectedLanguage };
}

async function transcribeWithWhisper(audioBase64, mimeType, languageHint) {
  const apiKey = process.env.OPENAI_API_KEY;
  const audioBuffer = Buffer.from(audioBase64, "base64");

  const form = new FormData();
  form.append("file", audioBuffer, {
    filename: `recording.${extensionFromMime(mimeType)}`,
    contentType: mimeType || "audio/m4a",
  });
  form.append("model", "whisper-1");
  // Whisper accepts an ISO-639-1 language hint to improve accuracy; omit
  // if unknown so it auto-detects.
  if (languageHint) form.append("language", languageHint);
  // "verbose_json" surfaces the detected language even when no hint is given.
  form.append("response_format", "verbose_json");

  const response = await axios.post(
    "https://api.openai.com/v1/audio/transcriptions",
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 25000,
    }
  );

  const text = response.data?.text ?? "";
  // Whisper's verbose_json returns a full language name (e.g. "hindi"), not
  // an ISO code — map back to our short codes for consistency.
  const detectedLanguage = mapWhisperLanguage(response.data?.language, languageHint);

  if (!text) {
    throw new Error("Whisper returned an empty transcript");
  }

  return { text, detectedLanguage };
}

function extensionFromMime(mimeType) {
  if (!mimeType) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("webm")) return "webm";
  return "m4a";
}

const WHISPER_LANGUAGE_MAP = {
  hindi: "hi",
  english: "en",
  marathi: "mr",
  tamil: "ta",
  telugu: "te",
  bengali: "bn",
  gujarati: "gu",
  punjabi: "pa",
  kannada: "kn",
};

function mapWhisperLanguage(whisperLangName, fallback) {
  if (!whisperLangName) return fallback || "hi";
  const mapped = WHISPER_LANGUAGE_MAP[whisperLangName.toLowerCase()];
  return mapped || fallback || "hi";
}

module.exports = { transcribeWithWispr, transcribeWithWhisper };
