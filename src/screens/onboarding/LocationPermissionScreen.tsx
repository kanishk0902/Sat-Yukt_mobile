import React, { useContext, useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OnboardingLayout from "../../components/onboarding/OnboardingLayout";
import PrimaryButton from "../../components/ui/PrimaryButton";
import SecondaryButton from "../../components/ui/SecondaryButton";
import { requestAndStoreLocation } from "../../services/locationService";
import { markOnboardingComplete } from "../../services/onboardingService";
import { t } from "../../localization/strings";
import { CONFIG } from "../../config";
import { SupportedLanguageCode } from "../../types";
import { OnboardingContext } from "../../navigation/OnboardingContext";

export default function LocationPermissionScreen() {
  const { completeOnboarding } = useContext(OnboardingContext);
  const [language, setLanguage] = useState<SupportedLanguageCode>("en");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CONFIG.asyncStorageKeys.languagePreference).then((saved) => {
      if (saved) setLanguage(saved as SupportedLanguageCode);
    });
  }, []);

  const finish = async () => {
    await markOnboardingComplete();
    completeOnboarding();
  };

  const handleAllow = async () => {
    setRequesting(true);
    try {
      await requestAndStoreLocation();
    } finally {
      setRequesting(false);
      await finish();
    }
  };

  return (
    <OnboardingLayout
      currentStep={5}
      totalSteps={5}
      title={t(language, "locationPermissionTitle")}
      subtitle={t(language, "locationPermissionBody")}
      footer={
        <>
          <PrimaryButton
            label={t(language, "allowLocation")}
            icon="location-outline"
            loading={requesting}
            onPress={handleAllow}
          />
          <SecondaryButton label={t(language, "skipForNow")} onPress={finish} />
        </>
      }
    >
      <View className="items-center justify-center">
        <View className="w-28 h-28 rounded-full bg-brand/10 items-center justify-center mb-6">
          <Ionicons name="location" size={56} color="#407348" />
        </View>
      </View>
    </OnboardingLayout>
  );
}
