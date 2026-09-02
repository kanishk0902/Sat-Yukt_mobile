import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SupportedLanguageCode, UserLocation } from "../../types";
import { t } from "../../localization/strings";
import { CONFIG } from "../../config";
import { getStoredLocation } from "../../services/locationService";

export default function ProfileScreen() {
  const [language, setLanguage] = useState<SupportedLanguageCode>("hi");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    (async () => {
      const [savedLang, savedPhone, savedLocation] = await Promise.all([
        AsyncStorage.getItem(CONFIG.asyncStorageKeys.languagePreference),
        AsyncStorage.getItem(CONFIG.asyncStorageKeys.userPhone),
        getStoredLocation(),
      ]);
      if (savedLang) setLanguage(savedLang as SupportedLanguageCode);
      if (savedPhone) setPhone(savedPhone);
      setLocation(savedLocation);
    })();
  }, []);

  const handleSavePhone = async () => {
    if (phone.trim().length < 8) {
      Alert.alert(t(language, "phoneNumberLabel"), t(language, "otpIncorrect"));
      return;
    }
    await AsyncStorage.setItem(CONFIG.asyncStorageKeys.userPhone, phone.trim());
    Alert.alert(t(language, "profile"), t(language, "smsSent"));
  };

  const locationLabel = location
    ? [location.district, location.state].filter(Boolean).join(", ") ||
      `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`
    : t(language, "locationNotSet");

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text className="text-2xl font-poppinsBold text-gray-900 mb-6">{t(language, "profile")}</Text>

      <Text className="text-gray-500 font-poppinsMedium mb-2">
        {t(language, "phoneNumberLabel")}
      </Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="+91XXXXXXXXXX"
        keyboardType="phone-pad"
        className="bg-white border border-gray-300 rounded-2xl px-4 py-4 text-base mb-3 font-poppinsMedium"
      />
      <Pressable
        onPress={handleSavePhone}
        className="bg-brand rounded-2xl py-4 items-center mb-8 active:opacity-80"
      >
        <Text className="text-white font-poppinsSemibold text-base">{t(language, "send")}</Text>
      </Pressable>

      <Text className="text-gray-500 font-poppinsMedium mb-2">{t(language, "yourLocation")}</Text>
      <View className="flex-row items-center gap-3 bg-white rounded-2xl px-5 py-4 mb-8">
        <Ionicons name="location-outline" size={20} color="#407348" />
        <Text className="flex-1 text-gray-800 font-poppinsMedium">{locationLabel}</Text>
      </View>

      <Text className="text-gray-400 text-xs text-center">
        {t(language, "appVersion")}: 1.0.0
      </Text>
    </ScrollView>
  );
}
