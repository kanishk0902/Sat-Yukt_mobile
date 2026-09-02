import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Lower-emphasis companion to PrimaryButton — same height/radius/press
 * feedback, outline style instead of filled, for secondary actions like
 * "Skip for now" or "Resend code". */
export default function SecondaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
}: SecondaryButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      className={`w-full h-14 rounded-2xl items-center justify-center flex-row gap-2 border-2 ${
        isDisabled ? "border-gray-200" : "border-brand"
      }`}
    >
      {loading ? (
        <ActivityIndicator color="#407348" />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon && <Ionicons name={icon} size={20} color={isDisabled ? "#9CA3AF" : "#407348"} />}
          <Text
            className={`text-base font-poppinsMedium ${
              isDisabled ? "text-gray-400" : "text-brand"
            }`}
          >
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}
