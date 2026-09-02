const axios = require("axios");
const os = require("os");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

const RECOGNIZE_ENDPOINT = "https://speech.googleapis.com/v1/speech:recognize";

// Google Cloud Speech-to-Text doesn't accept AAC/M4A directly (the format
// expo-av records in on the phone) — it only takes lossless/simple codecs
// (LINEAR16, FLAC, etc). We transcode server-side with ffmpeg to 16kHz mono
// LINEAR16 WAV, matching the sample rate the phone already records at, so
// there's no quality loss from resampling.
async function transcodeToLinear16Wav(audioBuffer, mimeType) {
  const tmpDir = os.tmpdir();
  const id = crypto.randomBytes(8).toString("hex");
  const inputExt = mimeType?.includes("webm")
    ? "webm"
    : mimeType?.includes("mp3")
      ? "mp3"
      : "m4a";
  const inputPath = path.join(tmpDir, `gramsatya-in-${id}.${inputExt}`);
  const outputPath = path.join(tmpDir, `gramsatya-out-${id}.wav`);

  await fs.writeFile(inputPath, audioBuffer);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec("pcm_s16le")
        .audioChannels(1)
        .audioFrequency(16000)
        .format("wav")
        .on("error", reject)
        .on("end", resolve)
        .save(outputPath);
    });

    return await fs.readFile(outputPath);
  } finally {
    // Best-effort cleanup; leftover temp files are harmless but shouldn't
    // accumulate across many requests.
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

const GOOGLE_STT_LANGUAGE_MAP = {
  hi: "hi-IN",
  en: "en-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  te: "te-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  kn: "kn-IN",
};

async function transcribeWithGoogle(audioBase64, mimeType, languageHint) {
  const apiKey = process.env.GOOGLE_STT_API_KEY;
  const audioBuffer = Buffer.from(audioBase64, "base64");
  const wavBuffer = await transcodeToLinear16Wav(audioBuffer, mimeType);

  const languageCode = GOOGLE_STT_LANGUAGE_MAP[languageHint] || "hi-IN";

  const response = await axios.post(
    `${RECOGNIZE_ENDPOINT}?key=${apiKey}`,
    {
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: 16000,
        languageCode,
        // Farmers' claims are often longer than a short command, and audio
        // quality varies a lot on cheap phone mics in the field.
        enableAutomaticPunctuation: true,
        model: "default",
      },
      audio: { content: wavBuffer.toString("base64") },
    },
    { timeout: 25000 }
  );

  const results = response.data?.results;
  if (!results || results.length === 0) {
    throw new Error("Google STT returned no speech results");
  }

  const text = results
    .map((r) => r.alternatives?.[0]?.transcript)
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!text) {
    throw new Error("Google STT returned an empty transcript");
  }

  // Google STT doesn't auto-detect across all 9 languages in one request
  // (languageCode is a required hint, not optional detection) — so the
  // detected language is whatever we asked for.
  return { text, detectedLanguage: languageHint || "hi" };
}

module.exports = { transcribeWithGoogle };
