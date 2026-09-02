import { Audio } from "expo-av";
// SDK 54's default expo-file-system export is the new File/Directory API;
// the legacy import preserves getInfoAsync/readAsStringAsync/EncodingType
// used below, avoiding a rewrite of this file for an unrelated SDK bump.
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import { apiClient, ApiError, isNetworkError } from "./apiClient";
import { SupportedLanguageCode, TranscriptionResult } from "../types";
import { getLanguage } from "../localization/languages";

let recordingInstance: Audio.Recording | null = null;

// M4A/AAC at a modest bitrate is the right choice here, not WAV: WAV at 16-bit/
// 44.1kHz runs ~5MB/min, which is a real problem for farmers on 2G/3G data
// uploading to a verification API. M4A at this bitrate is ~1MB/min with no
// meaningful loss for speech-to-text accuracy.
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000, // 16kHz is standard for speech STT models, halves file size vs 44.1kHz
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 64000,
  },
};

export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === "granted";
}

export async function startRecording(): Promise<void> {
  if (recordingInstance) {
    throw new ApiError("A recording is already in progress.");
  }

  const hasPermission = await requestMicPermission();
  if (!hasPermission) {
    throw new ApiError("MIC_PERMISSION_DENIED");
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(RECORDING_OPTIONS);
  await recording.startAsync();
  recordingInstance = recording;
}

/** Returns the local file URI of the recorded clip, or null if nothing was recorded. */
export async function stopRecording(): Promise<string | null> {
  if (!recordingInstance) return null;

  await recordingInstance.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  const uri = recordingInstance.getURI();
  recordingInstance = null;
  return uri;
}

/** Cancels an in-progress recording without saving/using the result. */
export async function cancelRecording(): Promise<void> {
  if (!recordingInstance) return;
  try {
    await recordingInstance.stopAndUnloadAsync();
  } catch {
    // already stopped/unloaded — fine to ignore
  }
  recordingInstance = null;
}

/**
 * Uploads the recorded clip to our backend, which forwards it to Wispr Flow
 * (primary) or OpenAI Whisper (fallback) depending on which key the backend
 * has configured. Returns transcribed text plus the detected language so the
 * UI can auto-switch to it.
 *
 * preferredLanguage is passed as a hint (not a hard constraint) — useful when
 * the user has manually overridden the language, since STT models generally
 * improve accuracy given a language hint even if they can auto-detect.
 */
export async function transcribeAudio(
  fileUri: string,
  preferredLanguage?: SupportedLanguageCode
): Promise<TranscriptionResult> {
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists) {
    throw new ApiError("Recording file not found.");
  }

  // Base64-encode on-device, matching the multipart-alternative contract most
  // STT proxy endpoints accept; our backend accepts either, see server.js.
  const base64Audio = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    const response = await apiClient.post<{
      text: string;
      detectedLanguage: SupportedLanguageCode;
    }>("/api/transcribe", {
      audioBase64: base64Audio,
      mimeType: "audio/m4a",
      languageHint: preferredLanguage,
    });

    return {
      text: response.data.text,
      detectedLanguage: response.data.detectedLanguage ?? preferredLanguage ?? "hi",
    };
  } catch (err) {
    if (isNetworkError(err)) {
      throw new ApiError("NETWORK_ERROR", err);
    }
    throw new ApiError("TRANSCRIPTION_FAILED", err);
  } finally {
    // Clean up the local recording file regardless of outcome — these are
    // small but there's no reason to accumulate them on a low-storage device.
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }
}

// ---- Text-to-Speech ----------------------------------------------------

let isSpeaking = false;

export async function speak(
  text: string,
  language: SupportedLanguageCode,
  onDone?: () => void
): Promise<void> {
  const { ttsLocale } = getLanguage(language);
  isSpeaking = true;
  Speech.speak(text, {
    language: ttsLocale,
    pitch: 1.0,
    rate: 0.92, // slightly slower than default — improves comprehension for
    // low-literacy listeners who rely on audio more than text confirmation.
    onDone: () => {
      isSpeaking = false;
      onDone?.();
    },
    onStopped: () => {
      isSpeaking = false;
    },
    onError: () => {
      isSpeaking = false;
    },
  });
}

export function stopSpeaking(): void {
  if (isSpeaking) {
    Speech.stop();
    isSpeaking = false;
  }
}

/** Checks whether a TTS voice is installed for the given language, so the UI
 * can warn the user instead of silently producing no audio (a real failure
 * mode on budget Android phones missing regional language packs). */
export async function checkTtsAvailability(
  language: SupportedLanguageCode
): Promise<boolean> {
  const { ttsLocale } = getLanguage(language);
  const voices = await Speech.getAvailableVoicesAsync();
  return voices.some((v) => v.language?.toLowerCase().startsWith(ttsLocale.split("-")[0]));
}
