import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SupportedLanguageCode } from "../../types";
import { t } from "../../localization/strings";
import { CONFIG } from "../../config";

// TODO: replace with your real support phone number / email before launch.
const SUPPORT_PHONE = "+91XXXXXXXXXX";
const SUPPORT_EMAIL = "support@sat-yukt.app";

export default function ContactUsScreen() {
  const [language, setLanguage] = useState<SupportedLanguageCode>("hi");

  useEffect(() => {
    AsyncStorage.getItem(CONFIG.asyncStorageKeys.languagePreference).then((savedLang) => {
      if (savedLang) setLanguage(savedLang as SupportedLanguageCode);
    });
  }, []);

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text className="text-2xl font-poppinsBold text-gray-900 mb-6">{t(language, "contactUs")}</Text>

      <Text className="text-gray-600 font-poppinsMedium mb-6 text-base">
        {t(language, "contactUsIntro")}
      </Text>

      <Pressable
        onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}
        className="flex-row items-center gap-4 bg-white rounded-2xl px-5 py-4 mb-3 active:opacity-70"
      >
        <View className="w-10 h-10 rounded-full items-center justify-center bg-brand/10">
          <Ionicons name="call" size={20} color="#407348" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-800 font-poppinsMedium">{t(language, "contactPhone")}</Text>
          <Text className="text-gray-500 text-sm">{SUPPORT_PHONE}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#B0B0B0" />
      </Pressable>

      <Pressable
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        className="flex-row items-center gap-4 bg-white rounded-2xl px-5 py-4 mb-3 active:opacity-70"
      >
        <View className="w-10 h-10 rounded-full items-center justify-center bg-brand/10">
          <Ionicons name="mail" size={20} color="#407348" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-800 font-poppinsMedium">{t(language, "contactEmail")}</Text>
          <Text className="text-gray-500 text-sm">{SUPPORT_EMAIL}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#B0B0B0" />
      </Pressable>
    </ScrollView>
  );
}
