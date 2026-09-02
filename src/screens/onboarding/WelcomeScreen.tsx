import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Localization from "expo-localization";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import OnboardingLayout from "../../components/onboarding/OnboardingLayout";
import PrimaryButton from "../../components/ui/PrimaryButton";
import { t } from "../../localization/strings";
import { mapDeviceLocaleToSupported } from "../../localization/languages";
import { OnboardingStackParamList } from "../../navigation/OnboardingStackNavigator";

type Nav = NativeStackNavigationProp<OnboardingStackParamList, "Welcome">;

export default function WelcomeScreen() {
  const navigation = useNavigation<Nav>();
  // Best-guess language before the user has made an explicit choice — same
  // device-locale heuristic HomeScreen uses, so the very first screen isn't
  // arbitrarily English/Hindi regardless of the phone's actual locale.
  const language = useMemo(
    () => mapDeviceLocaleToSupported(Localization.getLocales()[0]?.languageTag),
    []
  );

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={5}
      title={t(language, "welcomeTitle")}
      subtitle={t(language, "welcomeSubtitle")}
      footer={
        <PrimaryButton
          label={t(language, "getStarted")}
          icon="arrow-forward"
          onPress={() => navigation.navigate("LanguageSelect")}
        />
      }
    >
      <View className="items-center justify-center">
        <View className="w-28 h-28 rounded-full bg-brand items-center justify-center mb-6">
          <Ionicons name="shield-checkmark" size={56} color="#FFFFFF" />
        </View>
      </View>
    </OnboardingLayout>
  );
}
