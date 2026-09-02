import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import OnboardingLayout from "../../components/onboarding/OnboardingLayout";
import PrimaryButton from "../../components/ui/PrimaryButton";
import { sendOtp } from "../../services/otpService";
import { getConfigStatus } from "../../services/configStatusService";
import { t } from "../../localization/strings";
import { CONFIG } from "../../config";
import { SupportedLanguageCode } from "../../types";
import { OnboardingStackParamList } from "../../navigation/OnboardingStackNavigator";

type Nav = NativeStackNavigationProp<OnboardingStackParamList, "PhoneEntry">;

export default function PhoneEntryScreen() {
  const navigation = useNavigation<Nav>();
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<SupportedLanguageCode>("en");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpAvailable, setOtpAvailable] = useState(true);

  React.useEffect(() => {
    AsyncStorage.getItem(CONFIG.asyncStorageKeys.languagePreference).then((saved) => {
      if (saved) setLanguage(saved as SupportedLanguageCode);
    });
    getConfigStatus().then((status) => setOtpAvailable(status.otpAvailable));
  }, []);

  const handleSendCode = async () => {
    if (phone.trim().length < 10) return;
    setSending(true);
    setError(null);

    // Twilio Verify isn't provisioned yet (no phone number on the trial
    // account) — rather than send the user into a dead-end OTP screen that
    // can never succeed, store the phone as given and continue onboarding.
    if (!otpAvailable) {
      await AsyncStorage.setItem(CONFIG.asyncStorageKeys.userPhone, phone);
      setSending(false);
      navigation.navigate("LocationPermission");
      return;
    }

    try {
      await sendOtp(phone);
      navigation.navigate("OtpVerify", { phone });
    } catch {
      // Covers both "Twilio Verify not configured" (500) and any real send
      // failure (502) — either way, this is expected right now since
      // backend/.env has no Twilio Verify credentials yet, and it must not
      // crash the app.
      setError(t(language, "otpConfigMissing"));
    } finally {
      setSending(false);
    }
  };

  return (
    <OnboardingLayout
      currentStep={3}
      totalSteps={5}
      title={t(language, "enterPhoneNumber")}
      subtitle={t(language, "phoneNumberHint")}
      footer={
        <PrimaryButton
          label={t(language, "sendCode")}
          icon="call-outline"
          loading={sending}
          disabled={phone.trim().length < 10}
          onPress={handleSendCode}
        />
      }
    >
      <View>
        <View className="flex-row items-center border-2 border-gray-200 rounded-2xl h-16 px-4">
          <Text className="text-lg font-poppinsMedium text-gray-500 mr-2">+91</Text>
          <TextInput
            value={phone}
            onChangeText={(value) => setPhone(value.replace(/[^\d]/g, "").slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
            placeholder="98765 43210"
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-lg text-gray-900"
            accessibilityLabel={t(language, "enterPhoneNumber")}
          />
        </View>

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
