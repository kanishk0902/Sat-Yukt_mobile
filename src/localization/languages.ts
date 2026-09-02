import { LanguageOption, SupportedLanguageCode } from "../types";

// Nine languages covering the large majority of India's rural population.
// ttsLocale values are what expo-speech (which wraps native iOS/Android TTS
// engines) expects — these are standard BCP-47 tags supported by both platforms'
// system TTS voices as of Android 13+/iOS 16+. Device TTS language packs must be
// installed for the voice to actually speak; we detect and warn if missing
// (see voiceService.ttsIsAvailable).
export const LANGUAGES: LanguageOption[] = [
  { code: "hi", label: "हिन्दी", englishLabel: "Hindi", ttsLocale: "hi-IN" },
  { code: "en", label: "English", englishLabel: "English", ttsLocale: "en-IN" },
  { code: "mr", label: "मराठी", englishLabel: "Marathi", ttsLocale: "mr-IN" },
  { code: "ta", label: "தமிழ்", englishLabel: "Tamil", ttsLocale: "ta-IN" },
  { code: "te", label: "తెలుగు", englishLabel: "Telugu", ttsLocale: "te-IN" },
  { code: "bn", label: "বাংলা", englishLabel: "Bengali", ttsLocale: "bn-IN" },
  { code: "gu", label: "ગુજરાતી", englishLabel: "Gujarati", ttsLocale: "gu-IN" },
  { code: "pa", label: "ਪੰਜਾਬੀ", englishLabel: "Punjabi", ttsLocale: "pa-IN" },
  { code: "kn", label: "ಕನ್ನಡ", englishLabel: "Kannada", ttsLocale: "kn-IN" },
];

export function getLanguage(code: SupportedLanguageCode): LanguageOption {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

// Maps a device locale (from expo-localization) to our nearest supported code.
// Falls back to Hindi (not English) since the target audience is rural India —
// a farmer's phone set to a regional locale is a much stronger signal than
// defaulting to English.
export function mapDeviceLocaleToSupported(
  deviceLocale: string | null | undefined
): SupportedLanguageCode {
  if (!deviceLocale) return "hi";
  const lower = deviceLocale.toLowerCase();
  const match = LANGUAGES.find((l) => lower.startsWith(l.code));
  return match?.code ?? "hi";
}
