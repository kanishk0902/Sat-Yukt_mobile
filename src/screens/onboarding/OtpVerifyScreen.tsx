import React, { useEffect, useState } from "react";
import { View, Text, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import OnboardingLayout from "../../components/onboarding/OnboardingLayout";
import PrimaryButton from "../../components/ui/PrimaryButton";
import SecondaryButton from "../../components/ui/SecondaryButton";
import { sendOtp, verifyOtp } from "../../services/otpService";
import { getConfigStatus } from "../../services/configStatusService";
import { t } from "../../localization/strings";
import { CONFIG } from "../../config";
import { SupportedLanguageCode } from "../../types";
import { OnboardingStackParamList } from "../../navigation/OnboardingStackNavigator";

type Nav = NativeStackNavigationProp<OnboardingStackParamList, "OtpVerify">;
type Route = RouteProp<OnboardingStackParamList, "OtpVerify">;

const RESEND_COOLDOWN_SECONDS = 30;

export default function OtpVerifyScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<SupportedLanguageCode>("en");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CONFIG.asyncStorageKeys.languagePreference).then((saved) => {
      if (saved) setLanguage(saved as SupportedLanguageCode);
    });
    getConfigStatus().then((status) => setTestMode(!status.otpAvailable));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async () => {
    if (code.trim().length < 4) return;
    setVerifying(true);
    setError(null);
    try {
      const verified = await verifyOtp(params.phone, code);
      if (verified) {
        await AsyncStorage.setItem(CONFIG.asyncStorageKeys.userPhone, params.phone);
        navigation.navigate("LocationPermission");
      } else {
        setError(t(language, "otpIncorrect"));
      }
    } catch {
      // Same "Twilio Verify not configured" case as PhoneEntryScreen — no
      // crash, clear message, flow stays usable once keys are added later.
      setError(t(language, "otpConfigMissing"));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    try {
      await sendOtp(params.phone);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError(t(language, "otpConfigMissing"));
    }
  };

  return (
    <OnboardingLayout
      currentStep={4}
      totalSteps={5}
      title={t(language, "otpSentTitle")}
      footer={
        <>
          <PrimaryButton
            label={t(language, "verifyCode")}
            icon="keypad-outline"
            loading={verifying}
            disabled={code.trim().length < 4}
            onPress={handleVerify}
          />
          <SecondaryButton
            label={
              cooldown > 0 ? `${t(language, "resendCode")} (${cooldown}s)` : t(language, "resendCode")
            }
            onPress={handleResend}
            disabled={cooldown > 0}
          />
        </>
      }
    >
      <View>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.replace(/[^\d]/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="••••••"
          placeholderTextColor="#9CA3AF"
          className="border-2 border-gray-200 rounded-2xl h-16 px-4 text-2xl tracking-[8px] text-gray-900 text-center"
          accessibilityLabel={t(language, "otpSentTitle")}
        />

        {testMode && !error && (
          <Text className="mt-4 text-center text-gray-500">{t(language, "otpTestModeHint")}</Text>
        )}

        {error && (
          <View className="mt-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex-row items-center gap-2">
            <Ionicons name="alert-circle" size={20} color="#B3261E" />
            <Text className="text-red-700 flex-1">{error}</Text>
          </View>
        )}
      </View>
    </OnboardingLayout>
  );
}
