import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, Alert } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { QueuedQuery, SupportedLanguageCode } from "../types";
import {
  getAllQueriesFromHistory,
  clearHistory,
} from "../services/offlineQueueService";
import { t } from "../localization/strings";
import { speak } from "../services/voiceService";

const VERDICT_COLORS: Record<string, string> = {
  True: "#1B7A3D",
  False: "#B3261E",
  Misleading: "#B8860B",
  Unclear: "#6B7280",
};

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<QueuedQuery[]>([]);
  const [language] = useState<SupportedLanguageCode>("hi"); // header chrome only

  const load = useCallback(async () => {
    const history = await getAllQueriesFromHistory();
    setItems(history);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleClear = () => {
    Alert.alert(t(language, "clearHistory"), undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: t(language, "clearHistory"),
        style: "destructive",
        onPress: async () => {
          await clearHistory();
          setItems([]);
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-gray-50 pt-4 px-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-poppinsBold text-gray-900">{t(language, "history")}</Text>
        {items.length > 0 && (
          <Pressable onPress={handleClear}>
            <Text className="text-red-600 font-poppinsMedium">{t(language, "clearHistory")}</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 text-base">{t(language, "noHistoryYet")}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                if (item.result) speak(item.result.explanation, item.language);
              }}
              className="bg-white rounded-2xl p-4 mb-3 border border-gray-200"
            >
              <Text className="text-gray-800 text-base mb-2" numberOfLines={2}>
                {item.claimText}
              </Text>

              {item.status === "pending" ? (
                <View className="bg-amber-100 self-start rounded-full px-3 py-1">
                  <Text className="text-amber-700 text-xs font-semibold">
                    ⏳ {t(item.language, "queuedOffline")}
                  </Text>
                </View>
              ) : item.result ? (
                <View
                  className="self-start rounded-full px-3 py-1"
                  style={{ backgroundColor: VERDICT_COLORS[item.result.verdict] }}
                >
                  <Text className="text-white text-xs font-bold">
                    {item.result.verdict.toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
