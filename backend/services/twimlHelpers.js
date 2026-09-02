/**
 * TwiML building/response helpers for the Voice IVR routes in server.js.
 * Kept intentionally small and string-based (no templating library) since
 * there are only a handful of response shapes needed — matches this
 * codebase's preference for direct, dependency-light implementations.
 */

// Digit order MUST match src/localization/languages.ts's LANGUAGES array
// order exactly (digit = array index + 1) — this is a soft coupling between
// the app and the phone menu, not enforced by shared code, since backend/
// and src/ are separate Node/RN runtimes with no shared module today.
const LANGUAGE_ORDER = ["hi", "en", "mr", "ta", "te", "bn", "gu", "pa", "kn"];

const TTS_LOCALE = {
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

// Only hi/en are in Twilio's supported <Gather input="speech"> language list
// today — the rest use <Record> + Whisper instead (see server.js).
const SPEECH_GATHER_SUPPORTED = new Set(["hi", "en"]);

const ASK_QUESTION_PROMPT = {
  hi: "बीप के बाद अपना सवाल पूछें।",
  en: "After the beep, please ask your question.",
  mr: "बीप नंतर तुमचा प्रश्न विचारा.",
  ta: "பீப் ஒலிக்குப் பிறகு உங்கள் கேள்வியைக் கேளுங்கள்.",
  te: "బీప్ తర్వాత మీ ప్రశ్న అడగండి.",
  bn: "বিপের পর আপনার প্রশ্ন জিজ্ঞাসা করুন।",
  gu: "બીપ પછી તમારો પ્રશ્ન પૂછો.",
  pa: "ਬੀਪ ਤੋਂ ਬਾਅਦ ਆਪਣਾ ਸਵਾਲ ਪੁੱਛੋ।",
  kn: "ಬೀಪ್ ನಂತರ ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ.",
};

const NO_INPUT_PROMPT = {
  hi: "कोई जवाब नहीं मिला। धन्यवाद, अलविदा।",
  en: "We didn't receive any input. Thank you, goodbye.",
  mr: "कोणताही प्रतिसाद मिळाला नाही. धन्यवाद, निरोप.",
  ta: "பதில் எதுவும் கிடைக்கவில்லை. நன்றி, குட்பை.",
  te: "ఎలాంటి స్పందన రాలేదు. ధన్యవాదాలు, వీడ్కోలు.",
  bn: "কোনো উত্তর পাওয়া যায়নি। ধন্যবাদ, বিদায়।",
  gu: "કોઈ જવાબ મળ્યો નથી. આભાર, આવજો.",
  pa: "ਕੋਈ ਜਵਾਬ ਨਹੀਂ ਮਿਲਿਆ। ਧੰਨਵਾਦ, ਅਲਵਿਦਾ।",
  kn: "ಯಾವುದೇ ಪ್ರತಿಕ್ರಿಯೆ ಬರಲಿಲ್ಲ. ಧನ್ಯವಾದಗಳು, ವಿದಾಯ.",
};

const DIDNT_CATCH_PROMPT = {
  hi: "माफ़ करें, समझ नहीं आया। कृपया फिर से कोशिश करें।",
  en: "Sorry, we couldn't understand that. Please try again.",
  mr: "माफ करा, समजले नाही. कृपया पुन्हा प्रयत्न करा.",
  ta: "மன்னிக்கவும், புரியவில்லை. மீண்டும் முயற்சிக்கவும்.",
  te: "క్షమించండి, అర్థం కాలేదు. మళ్ళీ ప్రయత్నించండి.",
  bn: "দুঃখিত, বুঝতে পারিনি। আবার চেষ্টা করুন।",
  gu: "માફ કરશો, સમજાયું નહીં. ફરી પ્રયાસ કરો.",
  pa: "ਮਾਫ਼ ਕਰਨਾ, ਸਮਝ ਨਹੀਂ ਆਇਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  kn: "ಕ್ಷಮಿಸಿ, ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
};

const VERDICT_LABEL = {
  True: {
    hi: "सही",
    en: "TRUE",
    mr: "खरे",
    ta: "உண்மை",
    te: "నిజం",
    bn: "সত্য",
    gu: "સાચું",
    pa: "ਸਹੀ",
    kn: "ನಿಜ",
  },
  False: {
    hi: "गलत",
    en: "FALSE",
    mr: "खोटे",
    ta: "பொய்",
    te: "అబద్ధం",
    bn: "মিথ্যা",
    gu: "ખોટું",
    pa: "ਗਲਤ",
    kn: "ಸುಳ್ಳು",
  },
  Misleading: {
    hi: "भ्रामक",
    en: "MISLEADING",
    mr: "दिशाभूल करणारे",
    ta: "தவறாக வழிநடத்தும்",
    te: "తప్పుదారి పట్టించే",
    bn: "বিভ্রান্তিকর",
    gu: "ભ્રામક",
    pa: "ਭਰਮਾਉਣ ਵਾਲਾ",
    kn: "ದಾರಿತಪ್ಪಿಸುವ",
  },
  Unclear: {
    hi: "स्पष्ट नहीं",
    en: "UNCLEAR",
    mr: "अस्पष्ट",
    ta: "தெளிவில்லை",
    te: "అస్పష్టం",
    bn: "অস্পষ্ট",
    gu: "અસ્પષ્ટ",
    pa: "ਸਪਸ਼ਟ ਨਹੀਂ",
    kn: "ಅಸ್ಪಷ್ಟ",
  },
};

const ERROR_PROMPT = {
  hi: "कुछ गलत हो गया। कृपया बाद में फिर कॉल करें।",
  en: "Something went wrong. Please call back later.",
  mr: "काहीतरी चूक झाली. कृपया नंतर पुन्हा कॉल करा.",
  ta: "ஏதோ தவறு நடந்தது. பின்னர் மீண்டும் அழைக்கவும்.",
  te: "ఏదో తప్పు జరిగింది. దయచేసి తర్వాత మళ్ళీ కాల్ చేయండి.",
  bn: "কিছু ভুল হয়েছে। পরে আবার কল করুন।",
  gu: "કંઈક ખોટું થયું. કૃપા કરી પછી ફરી કૉલ કરો.",
  pa: "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਬਾਅਦ ਵਿੱਚ ਦੁਬਾਰਾ ਕਾਲ ਕਰੋ।",
  kn: "ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಕರೆ ಮಾಡಿ.",
};

const LANGUAGE_UNAVAILABLE_PROMPT = {
  hi: "यह भाषा अभी उपलब्ध नहीं है।",
  en: "This language is not available right now.",
  mr: "ही भाषा सध्या उपलब्ध नाही.",
  ta: "இந்த மொழி இப்போது கிடைக்கவில்லை.",
  te: "ఈ భాష ప్రస్తుతం అందుబాటులో లేదు.",
  bn: "এই ভাষা এখন উপলব্ধ নেই।",
  gu: "આ ભાષા હાલમાં ઉપલબ્ધ નથી.",
  pa: "ਇਹ ਭਾਸ਼ਾ ਹੁਣ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।",
  kn: "ಈ ಭಾಷೆ ಈಗ ಲಭ್ಯವಿಲ್ಲ.",
};

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function respondTwiml(res, twimlBody) {
  res.set("Content-Type", "text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${twimlBody}</Response>`);
}

function say(text, ttsLocale) {
  return `<Say language="${xmlEscape(ttsLocale)}">${xmlEscape(text)}</Say>`;
}

function languageMenuTwiml(actionUrl) {
  const hindiMenu =
    "सत-युक्त में आपका स्वागत है। अपनी भाषा चुनने के लिए दबाएं: हिंदी के लिए 1, " +
    "अंग्रेज़ी के लिए 2, मराठी के लिए 3, तमिल के लिए 4, तेलुगु के लिए 5, " +
    "बंगाली के लिए 6, गुजराती के लिए 7, पंजाबी के लिए 8, कन्नड़ के लिए 9।";
  const englishMenu =
    "Welcome to Sat-Yukt. To choose your language, press: 1 for Hindi, 2 for English, " +
    "3 for Marathi, 4 for Tamil, 5 for Telugu, 6 for Bengali, 7 for Gujarati, " +
    "8 for Punjabi, 9 for Kannada.";
  return (
    `<Gather input="dtmf" numDigits="1" action="${xmlEscape(actionUrl)}" method="POST" timeout="12">` +
    say(hindiMenu, "hi-IN") +
    say(englishMenu, "en-IN") +
    `</Gather>` +
    say(NO_INPUT_PROMPT.en, "en-IN")
  );
}

function languageFromDigit(digit) {
  const index = parseInt(digit, 10) - 1;
  return LANGUAGE_ORDER[index] || null;
}

function questionPromptTwiml(lang, actionUrl) {
  const ttsLocale = TTS_LOCALE[lang];
  const prompt = ASK_QUESTION_PROMPT[lang] || ASK_QUESTION_PROMPT.en;

  if (SPEECH_GATHER_SUPPORTED.has(lang)) {
    return (
      `<Gather input="speech" language="${xmlEscape(ttsLocale)}" speechTimeout="auto" ` +
      `action="${xmlEscape(actionUrl)}" method="POST">` +
      say(prompt, ttsLocale) +
      `</Gather>` +
      say(NO_INPUT_PROMPT[lang] || NO_INPUT_PROMPT.en, ttsLocale) +
      "<Hangup/>"
    );
  }

  return (
    say(prompt, ttsLocale) +
    `<Record action="${xmlEscape(actionUrl)}" method="POST" maxLength="30" playBeep="true" trim="trim-silence" />` +
    say(NO_INPUT_PROMPT[lang] || NO_INPUT_PROMPT.en, ttsLocale) +
    "<Hangup/>"
  );
}

function verdictTwiml(verdict, explanation, lang, nextActionUrl) {
  const ttsLocale = TTS_LOCALE[lang] || "en-IN";
  const label = (VERDICT_LABEL[verdict] && VERDICT_LABEL[verdict][lang]) || verdict;
  const spoken = `${label}. ${explanation}`;
  return say(spoken, ttsLocale) + questionPromptTwiml(lang, nextActionUrl);
}

function didntCatchTwiml(lang, actionUrl) {
  const ttsLocale = TTS_LOCALE[lang] || "en-IN";
  return say(DIDNT_CATCH_PROMPT[lang] || DIDNT_CATCH_PROMPT.en, ttsLocale) + questionPromptTwiml(lang, actionUrl);
}

function errorTwiml(lang) {
  const ttsLocale = TTS_LOCALE[lang] || "en-IN";
  return say(ERROR_PROMPT[lang] || ERROR_PROMPT.en, ttsLocale) + "<Hangup/>";
}

function languageUnavailableTwiml(lang) {
  const ttsLocale = TTS_LOCALE[lang] || "en-IN";
  return say(LANGUAGE_UNAVAILABLE_PROMPT[lang] || LANGUAGE_UNAVAILABLE_PROMPT.en, ttsLocale) + "<Hangup/>";
}

module.exports = {
  LANGUAGE_ORDER,
  TTS_LOCALE,
  SPEECH_GATHER_SUPPORTED,
  xmlEscape,
  respondTwiml,
  languageMenuTwiml,
  languageFromDigit,
  questionPromptTwiml,
  verdictTwiml,
  didntCatchTwiml,
  errorTwiml,
  languageUnavailableTwiml,
};
