import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LANGUAGES } from "../localization/languages";
import { SupportedLanguageCode } from "../types";
import { t } from "../localization/strings";

interface LanguageSelectorProps {
  selectedLanguage: SupportedLanguageCode;
  isAutoDetect: boolean;
  onSelect: (code: SupportedLanguageCode) => void;
  onEnableAutoDetect: () => void;
}

/**
 * Horizontal pill selector shown compactly at the top of the home screen —
 * kept out of a buried settings menu because language is the single most
 * important accessibility control in this app and should never require more
 * than one tap to change. Each pill is rendered in its own script (not
 * translated/transliterated) so a non-Hindi-reading Tamil speaker can still
 * recognize "தமிழ்" visually even before the app has fully localized.
 */
export default function LanguageSelector({
  selectedLanguage,
  isAutoDetect,
  onSelect,
  onEnableAutoDetect,
}: LanguageSelectorProps) {
  const handleSelect = (code: SupportedLanguageCode) => {
    Haptics.selectionAsync();
    onSelect(code);
  };

  const handleAutoDetect = () => {
    Haptics.selectionAsync();
    onEnableAutoDetect();
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      <Pressable
        onPress={handleAutoDetect}
        className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-full border ${
          isAutoDetect ? "bg-brand border-brand" : "bg-white border-gray-200"
        }`}
        style={isAutoDetect ? undefined : shadowStyle}
      >
        <Ionicons
          name="globe-outline"
          size={16}
          color={isAutoDetect ? "#FFFFFF" : "#6B7280"}
        />
        <Text
          className={
            isAutoDetect
              ? "text-white font-poppinsSemibold"
              : "text-gray-700 font-poppinsMedium"
          }
        >
          {t(selectedLanguage, "autoDetect")}
        </Text>
      </Pressable>

      {LANGUAGES.map((lang) => {
        const active = !isAutoDetect && selectedLanguage === lang.code;
        return (
          <Pressable
            key={lang.code}
            onPress={() => handleSelect(lang.code)}
            className={`px-4 py-2.5 rounded-full border ${
              active ? "bg-brand border-brand" : "bg-white border-gray-200"
            }`}
            style={active ? undefined : shadowStyle}
          >
            <Text
              className={
                active ? "text-white font-poppinsSemibold" : "text-gray-700 font-poppinsMedium"
              }
            >
              {lang.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const shadowStyle = {
  shadowColor: "#000",
  shadowOpacity: 0.04,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};
