import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Verdict, SupportedLanguageCode } from "../types";
import { t } from "../localization/strings";
import PrimaryButton from "./ui/PrimaryButton";
import SecondaryButton from "./ui/SecondaryButton";

interface VerdictCardProps {
  verdict: Verdict;
  explanation: string;
  claimText: string;
  language: SupportedLanguageCode;
  onListenAgain: () => void;
  onAskAnother: () => void;
}

// Color choices deliberately avoid relying on color alone (accessibility for
// color-blind users, which is common enough to matter at population scale):
// each verdict also gets a distinct icon glyph and the verdict word itself,
// spoken aloud via TTS regardless of whether the user can see the card.
const VERDICT_STYLES: Record<
  Verdict,
  { bg: string; icon: keyof typeof Ionicons.glyphMap; hapticSuccess: boolean }
> = {
  True: { bg: "bg-verdictTrue", icon: "checkmark-circle", hapticSuccess: true },
  False: { bg: "bg-verdictFalse", icon: "close-circle", hapticSuccess: false },
  Misleading: { bg: "bg-verdictMisleading", icon: "alert-circle", hapticSuccess: false },
  Unclear: { bg: "bg-gray-500", icon: "help-circle", hapticSuccess: false },
};

const VERDICT_LABEL_KEY: Record<Verdict, "verdictTrue" | "verdictFalse" | "verdictMisleading" | "verdictUnclear"> = {
  True: "verdictTrue",
  False: "verdictFalse",
  Misleading: "verdictMisleading",
  Unclear: "verdictUnclear",
};

export default function VerdictCard({
  verdict,
  explanation,
  claimText,
  language,
  onListenAgain,
  onAskAnother,
}: VerdictCardProps) {
  const style = VERDICT_STYLES[verdict];

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, []);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleListenAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onListenAgain();
  };

  const handleAskAnother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAskAnother();
  };

  return (
    <Animated.View
      style={entranceStyle}
      className="w-full rounded-3xl overflow-hidden border-4 border-black/10 shadow-lg"
    >
      {/* Verdict header — the single most important visual element on screen */}
      <View className={`${style.bg} px-6 py-8 items-center`}>
        <Ionicons name={style.icon} size={64} color="#FFFFFF" style={{ marginBottom: 8 }} />
        <Text className="text-white text-4xl font-poppinsBold tracking-wide">
          {t(language, VERDICT_LABEL_KEY[verdict])}
        </Text>
      </View>

      {/* Body */}
      <View className="bg-white px-6 py-5 gap-3">
        <Text className="text-gray-500 text-sm font-poppinsMedium mb-1">
          {t(language, "yourQuestion")}
        </Text>
        <Text className="text-gray-800 text-base mb-4" numberOfLines={3}>
          {claimText}
        </Text>

        <Text className="text-gray-900 text-lg leading-7 mb-6">{explanation}</Text>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <PrimaryButton
              label={t(language, "listenAgain")}
              icon="volume-high"
              onPress={handleListenAgain}
            />
          </View>
          <View className="flex-1">
            <SecondaryButton
              label={t(language, "askAnother")}
              icon="mic-outline"
              onPress={handleAskAnother}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
