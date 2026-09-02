const axios = require("axios");

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const LANGUAGE_NAMES = {
  hi: "Hindi",
  en: "English",
  mr: "Marathi",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  gu: "Gujarati",
  pa: "Punjabi",
  kn: "Kannada",
};

const VALID_VERDICTS = ["True", "False", "Misleading", "Unclear"];

function buildPrompt(claimText, languageName) {
  return `You are a fact-checking assistant for rural Indian farmers with low digital literacy, used inside an app called Sat-Yukt. A farmer has spoken the following claim, question, or forwarded message aloud; it was transcribed to text:

"""${claimText}"""

Your job: determine whether this claim is factually TRUE, FALSE, MISLEADING (partially true but deceptive or missing key context), or UNCLEAR (not a factual claim, or insufficient information to verify — e.g. a vague question, a request for advice rather than a checkable statement).

This claim may be about: a government scheme or subsidy (e.g. PM-KISAN, crop insurance, MSP announcements), agricultural advice (pesticide/fertilizer use, weather-dependent farming decisions), or general news/rumors (often spread via WhatsApp) — including claims that could cause real financial or physical harm if wrongly believed (e.g. fake subsidy scams, unsafe pesticide combinations, fabricated government orders).

Respond with ONLY a raw JSON object, no markdown code fences, no preamble, no explanation outside the JSON, in exactly this shape:
{"verdict": "True" | "False" | "Misleading" | "Unclear", "explanation": "..."}

Rules for "explanation":
- Write it in ${languageName}, in the same script a farmer speaking ${languageName} would read (not transliterated into Latin script).
- Exactly 2 short sentences. Plain, simple, everyday words — no jargon, no legal or bureaucratic phrasing.
- If verdict is False or Misleading, briefly state what is actually true.
- If the claim involves something dangerous if believed (a scam, an unsafe chemical mix, a fabricated deadline), the first sentence should lead with the safety-relevant correction.
- Do not hedge with phrases like "it depends" unless the verdict is genuinely Unclear.

Respond with the JSON object only.`;
}

async function verifyClaimWithGemini(claimText, languageCode) {
  const apiKey = process.env.GEMINI_API_KEY;
  const languageName = LANGUAGE_NAMES[languageCode] || "Hindi";

  const response = await axios.post(
    `${GEMINI_ENDPOINT}?key=${apiKey}`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(claimText, languageName) }],
        },
      ],
      generationConfig: {
        temperature: 0.2, // low temperature: we want consistent, non-creative verdicts
        maxOutputTokens: 300,
        responseMimeType: "application/json",
        // gemini-3.6-flash is a "thinking" model whose reasoning tokens count
        // against maxOutputTokens by default — without this, thinking alone
        // can consume the entire budget and truncate the actual JSON answer.
        // "minimal" is Google's documented setting for classification tasks.
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    },
    { timeout: 20000 }
  );

  const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini returned no content");
  }

  const parsed = safeParseJson(rawText);
  if (!parsed) {
    throw new Error("Gemini response was not valid JSON: " + rawText.slice(0, 200));
  }

  const verdict = VALID_VERDICTS.includes(parsed.verdict) ? parsed.verdict : "Unclear";
  const explanation =
    typeof parsed.explanation === "string" && parsed.explanation.trim()
      ? parsed.explanation.trim()
      : fallbackExplanation(languageCode);

  return { verdict, explanation };
}

function safeParseJson(text) {
  // Even with responseMimeType: "application/json", strip stray code fences
  // defensively — some Gemini versions occasionally wrap JSON in ```json ```
  // despite the instruction, and this is cheap insurance against a crash.
  const cleaned = text.replace(/^```json\s*|```\s*$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function fallbackExplanation(languageCode) {
  const fallbacks = {
    hi: "हम इस दावे की पुष्टि नहीं कर सके। कृपया किसी विश्वसनीय स्रोत से जाँच करें।",
    en: "We could not confirm this claim. Please check with a trusted source.",
  };
  return fallbacks[languageCode] || fallbacks.en;
}

function buildSchemesPrompt(stateName, languageName) {
  const locationClause = stateName
    ? `the Indian state of ${stateName}`
    : "India (no specific state given — cover well-known central government schemes only)";

  return `You are a government-schemes information assistant for rural Indian farmers, used inside an app called Sat-Yukt. List 5 real, currently active government welfare/agricultural schemes relevant to a farmer in ${locationClause}.

Only include schemes you are confident are real and genuinely still active (e.g. PM-KISAN, PMFBY crop insurance, Kisan Credit Card, soil health card scheme, state-specific irrigation or subsidy schemes). Do not invent scheme names or fabricate details.

Respond with ONLY a raw JSON array, no markdown code fences, no preamble, in exactly this shape:
[{"name": "...", "summary": "..."}, ...]

Rules:
- "name" and "summary" must both be in ${languageName}, in the same script a farmer speaking ${languageName} would read (not transliterated into Latin script) — except widely-known scheme abbreviations (e.g. "PM-KISAN") may stay in Latin script since that's how they're commonly referred to even in regional speech.
- "summary": exactly 1 short sentence, plain everyday words, stating who it helps and the core benefit (e.g. an amount or type of support) — no legal/bureaucratic phrasing.
- Order by broadest relevance first (central schemes before state-specific ones, unless a state scheme is especially significant).

Respond with the JSON array only.`;
}

async function fetchLatestSchemes(stateName, languageCode) {
  const apiKey = process.env.GEMINI_API_KEY;
  const languageName = LANGUAGE_NAMES[languageCode] || "Hindi";

  const response = await axios.post(
    `${GEMINI_ENDPOINT}?key=${apiKey}`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildSchemesPrompt(stateName, languageName) }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    },
    { timeout: 20000 }
  );

  const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini returned no content");
  }

  const parsed = safeParseJson(rawText);
  if (!Array.isArray(parsed)) {
    throw new Error("Gemini schemes response was not a JSON array: " + rawText.slice(0, 200));
  }

  return parsed
    .filter((item) => item && typeof item.name === "string" && typeof item.summary === "string")
    .map((item) => ({ name: item.name.trim(), summary: item.summary.trim() }))
    .filter((item) => item.name && item.summary)
    .slice(0, 5);
}

module.exports = { verifyClaimWithGemini, fetchLatestSchemes };
