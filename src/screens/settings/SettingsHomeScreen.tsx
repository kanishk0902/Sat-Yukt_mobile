import React, { useEffect, useState, useCallback, useContext } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { LANGUAGES } from "../../localization/languages";
import { SupportedLanguageCode } from "../../types";
import { t } from "../../localization/strings";
import { CONFIG } from "../../config";
import { checkTtsAvailability } from "../../services/voiceService";
import { OnboardingContext } from "../../navigation/OnboardingContext";

interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuRow({ icon, label, onPress, danger }: MenuRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-4 bg-white rounded-2xl px-5 py-4 mb-3 active:opacity-70"
    >
      <View
        className={`w-10 h-10 rounded-full items-center justify-center ${
          danger ? "bg-red-50" : "bg-brand/10"
        }`}
      >
        <Ionicons name={icon} size={20} color={danger ? "#B3261E" : "#407348"} />
      </View>
      <Text
        className={`flex-1 text-base font-poppinsMedium ${
          danger ? "text-red-700" : "text-gray-800"
        }`}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color="#B0B0B0" />
    </Pressable>
  );
}

export default function SettingsHomeScreen() {
  const navigation = useNavigation<any>();
  const { uncompleteOnboarding } = useContext(OnboardingContext);
  const [language, setLanguage] = useState<SupportedLanguageCode>("hi");
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CONFIG.asyncStorageKeys.languagePreference).then((savedLang) => {
      if (savedLang) setLanguage(savedLang as SupportedLanguageCode);
    });
  }, []);

  useEffect(() => {
    checkTtsAvailability(language).then((available) => {
      setTtsWarning(
        available
          ? null
          : "Voice playback for this language may not be installed on this device. Check your phone's Settings > Language & Input > Text-to-Speech."
      );
    });
  }, [language]);

  const handleSelectLanguage = useCallback(async (code: SupportedLanguageCode) => {
    setLanguage(code);
    await AsyncStorage.setItem(CONFIG.asyncStorageKeys.languagePreference, code);
    await AsyncStorage.setItem(CONFIG.asyncStorageKeys.languageModeAuto, "false");
  }, []);

  const handleResetOnboarding = useCallback(() => {
    Alert.alert(
      t(language, "resetOnboardingConfirmTitle"),
      t(language, "resetOnboardingConfirmBody"),
      [
        { text: t(language, "cancel"), style: "cancel" },
        {
          text: t(language, "resetOnboarding"),
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(CONFIG.asyncStorageKeys.onboardingComplete);
            uncompleteOnboarding();
          },
        },
      ]
    );
  }, [language, uncompleteOnboarding]);

  return (
    <ScrollView className="flex-1 bg-gray-50 pt-14 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text className="text-2xl font-poppinsBold text-gray-900 mb-6">
        {t(language, "settings")}
      </Text>

      <MenuRow
        icon="person-circle-outline"
        label={t(language, "profile")}
        onPress={() => navigation.navigate("Profile")}
      />
      <MenuRow
        icon="time-outline"
        label={t(language, "history")}
        onPress={() => navigation.navigate("History")}
      />
      <MenuRow
        icon="call-outline"
        label={t(language, "contactUs")}
        onPress={() => navigation.navigate("ContactUs")}
      />
      <MenuRow
        icon="help-circle-outline"
        label={t(language, "faqs")}
        onPress={() => navigation.navigate("Faq")}
      />

      <Text className="text-gray-500 font-poppinsMedium mt-4 mb-2">
        {t(language, "selectLanguage")}
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            onPress={() => handleSelectLanguage(lang.code)}
            className={`px-4 py-2 rounded-full border ${
              language === lang.code ? "bg-brand border-brand" : "bg-white border-gray-300"
            }`}
          >
            <Text
              className={
                language === lang.code
                  ? "text-white font-poppinsMedium"
                  : "text-gray-700 font-poppinsMedium"
              }
            >
              {lang.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {ttsWarning && (
        <View className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6">
          <Text className="text-amber-800 text-sm">{ttsWarning}</Text>
        </View>
      )}

      <MenuRow
        icon="refresh-outline"
        label={t(language, "resetOnboarding")}
        onPress={handleResetOnboarding}
        danger
      />

      <Text className="text-gray-400 text-xs text-center mt-6">
        {t(language, "appVersion")}: 1.0.0
      </Text>
    </ScrollView>
  );
}
