import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The single primary-action button used across onboarding, VerdictCard, and
 * Home's SMS fallback — fixed height, icon + label (never emoji/text-only),
 * consistent press feedback. One implementation instead of five ad hoc
 * Pressables is what keeps spacing/sizing consistent across the app.
 */
export default function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
}: PrimaryButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => (scale.value = withTiming(0.96, { duration: 80 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 80 }))}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={animatedStyle}
      className={`w-full h-14 rounded-2xl items-center justify-center flex-row gap-2 ${
        isDisabled ? "bg-brand/50" : "bg-brand"
      }`}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon && <Ionicons name={icon} size={22} color="#FFFFFF" />}
          <Text className="text-white text-lg font-poppinsSemibold">{label}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}
