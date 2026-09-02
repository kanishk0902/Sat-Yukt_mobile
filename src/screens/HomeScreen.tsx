import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import {
  startRecording,
  stopRecording,
  cancelRecording,
  transcribeAudio,
  speak,
  stopSpeaking,
} from "../services/voiceService";
import { verifyClaim } from "../services/verificationService";
import { sendOfflineSMS } from "../services/twilioService";
import { ApiError } from "../services/apiClient";
import MicButton from "../components/MicButton";
import VerdictCard from "../components/VerdictCard";
import LanguageSelector from "../components/LanguageSelector";
import SchemesCard from "../components/SchemesCard";
import PrimaryButton from "../components/ui/PrimaryButton";
import { SupportedLanguageCode, VerificationResult } from "../types";
import { mapDeviceLocaleToSupported } from "../localization/languages";
import { t } from "../localization/strings";
import { CONFIG } from "../config";
import { subscribeToConnectivityRetries } from "../services/offlineQueueService";
import { getConfigStatus } from "../services/configStatusService";
import { getStoredLocation } from "../services/locationService";

type FlowState = "idle" | "recording" | "processing" | "result" | "error";

export default function HomeScreen() {
  const navigation = useNavigation<any>();

  const [language, setLanguage] = useState<SupportedLanguageCode>("hi");
  const [isAutoDetect, setIsAutoDetect] = useState(true);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [smsStatus, setSmsStatus] = useState<
    "idle" | "sending" | "sent" | "failed" | "failed-trial-unverified"
  >("idle");
  const [typedQuestion, setTypedQuestion] = useState("");
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [inputMode, setInputMode] = useState<"voice" | "typing" | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [userState, setUserState] = useState<string | null>(null);

  // Load saved preferences and set up initial language from device locale.
  useEffect(() => {
    (async () => {
      const [savedLang, savedAutoMode, savedPhone] = await Promise.all([
        AsyncStorage.getItem(CONFIG.asyncStorageKeys.languagePreference),
        AsyncStorage.getItem(CONFIG.asyncStorageKeys.languageModeAuto),
        AsyncStorage.getItem(CONFIG.asyncStorageKeys.userPhone),
      ]);

      if (savedAutoMode === "false" && savedLang) {
        setIsAutoDetect(false);
        setLanguage(savedLang as SupportedLanguageCode);
      } else {
        const deviceLocale = Localization.getLocales()[0]?.languageTag;
        setLanguage(mapDeviceLocaleToSupported(deviceLocale));
      }

      if (savedPhone) setUserPhone(savedPhone);
    })();

    getConfigStatus().then((status) => setSmsAvailable(status.smsAvailable));
    getStoredLocation().then((loc) => {
      setDistrict(loc?.district ?? null);
      setUserState(loc?.state ?? null);
    });

    // Auto-retry any offline-queued questions whenever connectivity returns,
    // even if the user isn't actively looking at this screen.
    const unsubscribe = subscribeToConnectivityRetries();
    return unsubscribe;
  }, []);

  const handleSelectLanguage = useCallback(async (code: SupportedLanguageCode) => {
    setIsAutoDetect(false);
    setLanguage(code);
    await AsyncStorage.setItem(CONFIG.asyncStorageKeys.languagePreference, code);
    await AsyncStorage.setItem(CONFIG.asyncStorageKeys.languageModeAuto, "false");
  }, []);

  const handleEnableAutoDetect = useCallback(async () => {
    setIsAutoDetect(true);
    await AsyncStorage.setItem(CONFIG.asyncStorageKeys.languageModeAuto, "true");
  }, []);

  const resetToIdle = useCallback(() => {
    stopSpeaking();
    setFlowState("idle");
    setResult(null);
    setErrorMessage(null);
    setSmsStatus("idle");
    setInputMode(null);
  }, []);

  const handleMicPress = useCallback(async () => {
    if (flowState === "idle" || flowState === "result" || flowState === "error") {
      // Start recording
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setResult(null);
        setErrorMessage(null);
        await startRecording();
        setFlowState("recording");
      } catch (err) {
        const message =
          err instanceof ApiError && err.message === "MIC_PERMISSION_DENIED"
            ? t(language, "micPermissionDenied")
            : t(language, "recordingError");
        setErrorMessage(message);
        setFlowState("error");
      }
      return;
    }

    if (flowState === "recording") {
      // Stop recording -> transcribe -> verify
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setFlowState("processing");

        const fileUri = await stopRecording();
        if (!fileUri) {
          throw new ApiError("No audio was recorded.");
        }

        const languageHint = isAutoDetect ? undefined : language;
        const transcription = await transcribeAudio(fileUri, languageHint);

        // If auto-detecting, adopt whatever language the STT detected so the
        // verdict card and TTS come back in the language the farmer actually spoke.
        const effectiveLanguage = isAutoDetect ? transcription.detectedLanguage : language;
        if (isAutoDetect) setLanguage(effectiveLanguage);

        const verification = await verifyClaim(
          transcription.text,
          effectiveLanguage,
          userPhone
        );

        setResult(verification);
        setFlowState("result");

        await Haptics.notificationAsync(
          verification.verdict === "True"
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        );

        // Read the explanation aloud automatically — the core accessibility
        // feature for users who may not read fluently even in their own language.
        speak(verification.explanation, effectiveLanguage);
      } catch (err) {
        await cancelRecording();
        const isNetwork = err instanceof ApiError && err.message === "NETWORK_ERROR";
        setErrorMessage(
          isNetwork ? t(language, "queuedOffline") : t(language, "genericError")
        );
        setFlowState("error");
      }
    }
  }, [flowState, isAutoDetect, language, userPhone]);

  const handleSubmitTyped = useCallback(async () => {
    const claimText = typedQuestion.trim();
    if (!claimText) return;

    try {
      setResult(null);
      setErrorMessage(null);
      setFlowState("processing");

      const verification = await verifyClaim(claimText, language, userPhone);

      setResult(verification);
      setFlowState("result");
      setTypedQuestion("");

      await Haptics.notificationAsync(
        verification.verdict === "True"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );

      speak(verification.explanation, language);
    } catch (err) {
      const isNetwork = err instanceof ApiError && err.message === "NETWORK_ERROR";
      setErrorMessage(isNetwork ? t(language, "queuedOffline") : t(language, "genericError"));
      setFlowState("error");
    }
  }, [typedQuestion, language, userPhone]);

  const handleSmsFallback = useCallback(async () => {
    // Alert.prompt is iOS-only in React Native and silently does nothing on
    // Android — the majority platform for this app's target users — so we
    // route to Settings to collect the phone number there instead of relying
    // on a platform-specific dialog.
    if (!userPhone) {
      Alert.alert(
        t(language, "smsButtonLabel"),
        t(language, "addPhoneNumberFirst"),
        [
          { text: t(language, "cancel"), style: "cancel" },
          {
            text: t(language, "settings"),
            onPress: () =>
              navigation.navigate("SettingsTab", { screen: "Profile" }),
          },
        ]
      );
      return;
    }

    try {
      setSmsStatus("sending");
      // Use last spoken/typed claim if we have one queued from a failed attempt;
      // otherwise this button mainly serves users who already tried the mic
      // and hit a network error, so result/errorMessage context matters most.
      const claimToSend = result?.claimText ?? "General verification request from Sat-Yukt app";
      await sendOfflineSMS(claimToSend, userPhone);
      setSmsStatus("sent");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const isTrialUnverified =
        err instanceof ApiError && err.message === "SMS_TRIAL_NUMBER_UNVERIFIED";
      setSmsStatus(isTrialUnverified ? "failed-trial-unverified" : "failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [userPhone, result, language, navigation]);

  const showOfflineSmsButton =
    smsAvailable && (flowState === "error" || flowState === "idle");

  // "Home" is the resting state: no flow in progress and no input mode chosen
  // yet — this is when the Quick Actions tiles show instead of an active
  // mic/type/result view, matching the reference layout's card-based feel.
  const isAtRest = flowState === "idle" && inputMode === null;

  const handleChooseVoice = useCallback(() => {
    setInputMode("voice");
    handleMicPress();
  }, [handleMicPress]);

  const handleChooseTyping = useCallback(() => {
    setInputMode("typing");
  }, []);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header — brand identity + a location-aware welcome line, the
            screen a user returns to hundreds of times after onboarding. */}
        <View className="bg-brand px-6 pt-14 pb-7 rounded-b-[32px] mb-6">
          <Text className="text-2xl font-poppinsBold text-white text-center">
            {t(language, "welcomeTitle")}
          </Text>
          {isAtRest && (
            <Text className="text-white/80 font-poppinsMedium text-center mt-1 text-sm">
              {t(language, "welcomeBack")}
              {district ? ` — ${district}` : ""}
            </Text>
          )}
        </View>

        {/* Language selector */}
        <View className="mb-6">
          <LanguageSelector
            selectedLanguage={language}
            isAutoDetect={isAutoDetect}
            onSelect={handleSelectLanguage}
            onEnableAutoDetect={handleEnableAutoDetect}
          />
        </View>

        {isAtRest ? (
          <View className="mx-6 bg-white rounded-3xl px-5 py-5" style={cardShadow}>
            <Text className="text-lg font-poppinsBold text-gray-900 mb-4">
              {t(language, "quickActions")}
            </Text>
            <View className="flex-row gap-4">
              <Pressable
                onPress={handleChooseVoice}
                accessibilityRole="button"
                className="flex-1 items-center bg-gray-50 rounded-2xl py-5 active:opacity-70"
              >
                <View className="w-14 h-14 rounded-full bg-brand items-center justify-center mb-2">
                  <Ionicons name="mic" size={26} color="#FFFFFF" />
                </View>
                <Text className="text-gray-800 font-poppinsSemibold text-center">
                  {t(language, "askByVoice")}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleChooseTyping}
                accessibilityRole="button"
                className="flex-1 items-center bg-gray-50 rounded-2xl py-5 active:opacity-70"
              >
                <View className="w-14 h-14 rounded-full bg-brand items-center justify-center mb-2">
                  <Ionicons name="create" size={24} color="#FFFFFF" />
                </View>
                <Text className="text-gray-800 font-poppinsSemibold text-center">
                  {t(language, "askByTyping")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {isAtRest && <SchemesCard state={userState} language={language} />}

        {!isAtRest && (
          <View className="items-center px-6">
            {flowState === "processing" ? (
              <View className="items-center py-6">
                <ActivityIndicator size="large" color="#407348" />
                <Text className="text-xl font-poppinsSemibold text-gray-700 mt-4">
                  {t(language, "analyzing")}
                </Text>
              </View>
            ) : flowState === "result" && result ? (
              <VerdictCard
                verdict={result.verdict}
                explanation={result.explanation}
                claimText={result.claimText}
                language={language}
                onListenAgain={() => speak(result.explanation, language)}
                onAskAnother={resetToIdle}
              />
            ) : inputMode === "voice" ? (
              <MicButton
                state={flowState === "recording" ? "recording" : "idle"}
                onPress={handleMicPress}
                language={language}
              />
            ) : null}

            {flowState === "error" && errorMessage && (
              <View className="mt-6 bg-red-50 border border-red-100 rounded-2xl px-5 py-4 w-full flex-row items-center gap-3">
                <Ionicons name="alert-circle" size={20} color="#B3261E" />
                <Text className="text-red-700 text-base font-poppinsMedium flex-1">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Type bar — same verifyClaim pipeline as the mic, shown once
                "Ask by Typing" is chosen from Quick Actions. */}
            {inputMode === "typing" && flowState !== "result" && (
              <View className="w-full mt-2">
                <View
                  className="flex-row items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2"
                  style={cardShadow}
                >
                  <TextInput
                    value={typedQuestion}
                    onChangeText={setTypedQuestion}
                    placeholder={t(language, "typeQuestionPlaceholder")}
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 text-base font-poppinsMedium py-2"
                    multiline
                    autoFocus
                    onSubmitEditing={handleSubmitTyped}
                    returnKeyType="send"
                  />
                  <Pressable
                    onPress={handleSubmitTyped}
                    disabled={!typedQuestion.trim()}
                    accessibilityRole="button"
                    accessibilityLabel={t(language, "send")}
                    className={`w-11 h-11 rounded-full items-center justify-center ${
                      typedQuestion.trim() ? "bg-brand" : "bg-gray-200"
                    }`}
                  >
                    <Ionicons
                      name="send"
                      size={18}
                      color={typedQuestion.trim() ? "#FFFFFF" : "#9CA3AF"}
                    />
                  </Pressable>
                </View>
              </View>
            )}

            {(flowState === "idle" || flowState === "error") && (
              <Pressable
                onPress={resetToIdle}
                accessibilityRole="button"
                className="mt-5 flex-row items-center gap-1"
              >
                <Ionicons name="arrow-back" size={16} color="#407348" />
                <Text className="text-brand font-poppinsMedium text-sm">
                  {t(language, "quickActions")}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Offline SMS fallback — always reachable without needing a successful
            verification first, since a farmer with no data connection needs
            this as their PRIMARY path, not a recovery option buried behind
            a failed attempt. */}
        {showOfflineSmsButton && (
          <View className="mx-6 mt-6 mb-2 bg-white rounded-3xl px-5 py-5 items-center" style={cardShadow}>
            <View className="w-11 h-11 rounded-full bg-brand/10 items-center justify-center mb-2">
              <Ionicons name="wifi-outline" size={20} color="#407348" />
            </View>
            <Text className="text-gray-500 text-sm font-poppinsMedium mb-3">
              {t(language, "noInternetTitle")}
            </Text>
            <PrimaryButton
              label={t(language, "smsButtonLabel")}
              icon="chatbubble-ellipses"
              loading={smsStatus === "sending"}
              onPress={handleSmsFallback}
            />

            {smsStatus === "sent" && (
              <Text className="text-green-700 mt-3 text-center font-poppinsMedium">
                {t(language, "smsSent")}
              </Text>
            )}
            {smsStatus === "failed" && (
              <Text className="text-red-700 mt-3 text-center font-poppinsMedium">
                {t(language, "smsFailed")}
              </Text>
            )}
            {smsStatus === "failed-trial-unverified" && (
              <Text className="text-red-700 mt-3 text-center font-poppinsMedium">
                {t(language, "smsTrialUnverified")}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const cardShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
