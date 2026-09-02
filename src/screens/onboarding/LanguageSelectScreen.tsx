import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import OnboardingLayout from "../../components/onboarding/OnboardingLayout";
import PrimaryButton from "../../components/ui/PrimaryButton";
import { LANGUAGES } from "../../localization/languages";
import { t } from "../../localization/strings";
import { CONFIG } from "../../config";
import { SupportedLanguageCode } from "../../types";
import { OnboardingStackParamList } from "../../navigation/OnboardingStackNavigator";

type Nav = NativeStackNavigationProp<OnboardingStackParamList, "LanguageSelect">;

export default function LanguageSelectScreen() {
  const navigation = useNavigation<Nav>();
  const [selected, setSelected] = useState<SupportedLanguageCode | "auto" | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selected === "auto") {
      await AsyncStorage.setItem(CONFIG.asyncStorageKeys.languageModeAuto, "true");
    } else {
      await AsyncStorage.setItem(CONFIG.asyncStorageKeys.languagePreference, selected);
      await AsyncStorage.setItem(CONFIG.asyncStorageKeys.languageModeAuto, "false");
    }
    navigation.navigate("PhoneEntry");
  };

  const displayLang: SupportedLanguageCode = selected === "auto" || !selected ? "en" : selected;

  return (
    <OnboardingLayout
      currentStep={2}
      totalSteps={5}
      title={t(displayLang, "selectLanguage")}
      footer={
        <PrimaryButton
          label={t(displayLang, "continueLabel")}
          icon="arrow-forward"
          disabled={!selected}
          onPress={handleContinue}
        />
      }
    >
      <View className="gap-3">
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setSelected("auto");
          }}
          accessibilityRole="button"
          className={`h-16 rounded-2xl flex-row items-center px-4 border-2 ${
            selected === "auto" ? "border-brand bg-brand/5" : "border-gray-200"
          }`}
        >
          <Ionicons
            name="globe-outline"
            size={26}
            color={selected === "auto" ? "#407348" : "#6B7280"}
          />
          <Text
            className={`ml-3 text-lg font-poppinsMedium ${
              selected === "auto" ? "text-brand" : "text-gray-700"
            }`}
          >
            {t("en", "autoDetect")}
          </Text>
        </Pressable>

        {LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            onPress={() => {
              Haptics.selectionAsync();
              setSelected(lang.code);
            }}
            accessibilityRole="button"
            className={`h-16 rounded-2xl flex-row items-center justify-between px-4 border-2 ${
              selected === lang.code ? "border-brand bg-brand/5" : "border-gray-200"
            }`}
          >
            <Text
              className={`text-lg font-poppinsMedium ${
                selected === lang.code ? "text-brand" : "text-gray-800"
              }`}
            >
              {lang.label}
            </Text>
            {selected === lang.code && (
              <Ionicons name="checkmark-circle" size={24} color="#407348" />
            )}
          </Pressable>
        ))}
      </View>
    </OnboardingLayout>
  );
}
