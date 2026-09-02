import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SupportedLanguageCode } from "../types";
import { t } from "../localization/strings";

type MicState = "idle" | "recording" | "processing";

interface MicButtonProps {
  state: MicState;
  onPress: () => void;
  language: SupportedLanguageCode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The dominant, zero-friction interaction point of the app. Deliberately
 * huge (per the brief) — this is designed for users who may have limited
 * fine motor precision (older farmers), be operating the phone one-handed
 * in a field, or have no prior smartphone UI mental model at all. A single
 * large unmissable target beats any amount of clever iconography.
 */
export default function MicButton({ state, onPress, language }: MicButtonProps) {
  const pulse = useSharedValue(1);
  const press = useSharedValue(1);

  useEffect(() => {
    if (state === "recording") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 650, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 650, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 150 });
    }
  }, [state]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value * press.value }],
  }));

  const bgColor =
    state === "recording" ? "#B3261E" : state === "processing" ? "#9CA3AF" : "#407348";

  const label =
    state === "recording"
      ? t(language, "tapToStop")
      : state === "processing"
      ? t(language, "analyzing")
      : t(language, "tapToSpeak");

  return (
    <View className="items-center justify-center">
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => (press.value = withTiming(0.96, { duration: 80 }))}
        onPressOut={() => (press.value = withTiming(1, { duration: 80 }))}
        disabled={state === "processing"}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t(language, "tapToSpeak")}
        style={[
          {
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: bgColor,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 8,
          },
          animatedStyle,
        ]}
      >
        <Ionicons name={state === "recording" ? "stop" : "mic"} size={88} color="#FFFFFF" />
      </AnimatedPressable>

      <Text className="text-xl font-poppinsBold text-gray-800 mt-5 text-center">{label}</Text>
    </View>
  );
}
