import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, LayoutAnimation, Platform, UIManager } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SupportedLanguageCode } from "../../types";
import { t, StringKey } from "../../localization/strings";
import { CONFIG } from "../../config";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_KEYS: Array<{ q: StringKey; a: StringKey }> = [
  { q: "faqQ1", a: "faqA1" },
  { q: "faqQ2", a: "faqA2" },
  { q: "faqQ3", a: "faqA3" },
  { q: "faqQ4", a: "faqA4" },
];

export default function FaqScreen() {
  const [language, setLanguage] = useState<SupportedLanguageCode>("hi");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CONFIG.asyncStorageKeys.languagePreference).then((savedLang) => {
      if (savedLang) setLanguage(savedLang as SupportedLanguageCode);
    });
  }, []);

  const toggle = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text className="text-2xl font-poppinsBold text-gray-900 mb-6">{t(language, "faqs")}</Text>

      {FAQ_KEYS.map(({ q, a }, index) => {
        const isOpen = openIndex === index;
        return (
          <Pressable
            key={q}
            onPress={() => toggle(index)}
            className="bg-white rounded-2xl px-5 py-4 mb-3 active:opacity-80"
          >
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-gray-800 font-poppinsMedium text-base pr-3">
                {t(language, q)}
              </Text>
              <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="#407348" />
            </View>
            {isOpen && (
              <Text className="text-gray-600 mt-3 leading-6">{t(language, a)}</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
