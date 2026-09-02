import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getLatestSchemes } from "../services/schemesService";
import { GovernmentScheme, SupportedLanguageCode } from "../types";
import { t } from "../localization/strings";

interface SchemesCardProps {
  state: string | null;
  language: SupportedLanguageCode;
}

type LoadState = "loading" | "loaded" | "error";

/**
 * Fills the space below Quick Actions on Home with a short, Gemini-generated
 * list of currently active government schemes relevant to the user's state
 * (captured once during onboarding). The backend caches this per state+
 * language for 24h, so this is cheap to call on every Home mount.
 */
export default function SchemesCard({ state, language }: SchemesCardProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");

    getLatestSchemes(state, language)
      .then((result) => {
        if (cancelled) return;
        setSchemes(result);
        setLoadState("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [state, language]);

  return (
    <View className="mx-6 mt-6 bg-white rounded-3xl px-5 py-5" style={cardShadow}>
      <View className="flex-row items-center gap-2 mb-4">
        <Ionicons name="newspaper-outline" size={20} color="#407348" />
        <Text className="text-lg font-poppinsBold text-gray-900">
          {t(language, "latestSchemes")}
        </Text>
      </View>

      {loadState === "loading" && (
        <View className="items-center py-4">
          <ActivityIndicator color="#407348" />
        </View>
      )}

      {loadState === "error" && (
        <Text className="text-gray-500 font-poppinsMedium text-center py-2">
          {t(language, "schemesLoadFailed")}
        </Text>
      )}

      {loadState === "loaded" && schemes.length === 0 && (
        <Text className="text-gray-500 font-poppinsMedium text-center py-2">
          {t(language, "schemesEmpty")}
        </Text>
      )}

      {loadState === "loaded" &&
        schemes.map((scheme, index) => (
          <View
            key={scheme.name}
            className={`flex-row gap-3 py-3 ${
              index < schemes.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <View className="w-8 h-8 rounded-full bg-brand/10 items-center justify-center mt-0.5">
              <Ionicons name="document-text-outline" size={16} color="#407348" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-poppinsSemibold text-base">{scheme.name}</Text>
              <Text className="text-gray-500 font-poppinsMedium text-sm mt-0.5">
                {scheme.summary}
              </Text>
            </View>
          </View>
        ))}
    </View>
  );
}

const cardShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
