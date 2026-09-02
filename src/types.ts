export type Verdict = "True" | "False" | "Misleading" | "Unclear";

export interface VerificationResult {
  verdict: Verdict;
  explanation: string;
  language: SupportedLanguageCode;
  claimText: string;
  timestamp: number;
  source: "online" | "sms-pending";
}

export type SupportedLanguageCode =
  | "hi" // Hindi
  | "en" // English
  | "mr" // Marathi
  | "ta" // Tamil
  | "te" // Telugu
  | "bn" // Bengali
  | "gu" // Gujarati
  | "pa" // Punjabi
  | "kn"; // Kannada

export interface LanguageOption {
  code: SupportedLanguageCode;
  label: string; // shown in its own script
  englishLabel: string;
  ttsLocale: string; // BCP-47 tag for expo-speech
}

export interface TranscriptionResult {
  text: string;
  detectedLanguage: SupportedLanguageCode;
}

export interface QueuedQuery {
  id: string;
  claimText: string;
  language: SupportedLanguageCode;
  createdAt: number;
  status: "pending" | "resolved" | "failed";
  result?: VerificationResult;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  district: string | null;
  state: string | null;
  capturedAt: number;
}

export interface GovernmentScheme {
  name: string;
  summary: string;
}
