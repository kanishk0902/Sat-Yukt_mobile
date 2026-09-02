import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface OnboardingLayoutProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * Shared shell for every onboarding screen — consistent padding, a step-dot
 * progress row (so the user always knows where they are and how much is
 * left), and fixed title/subtitle typography. Screens fill in content +
 * footer rather than each building their own layout, which is what keeps
 * spacing/sizing consistent across the whole flow.
 */
export default function OnboardingLayout({
  currentStep,
  totalSteps,
  title,
  subtitle,
  children,
  footer,
}: OnboardingLayoutProps) {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <View className="flex-row justify-center gap-2 mt-4 mb-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={index}
            className={`h-2 rounded-full ${
              index === currentStep - 1 ? "w-6 bg-brand" : "w-2 bg-gray-200"
            }`}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="flex-1 px-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="pt-8 pb-4">
          <Text className="text-2xl font-poppinsBold text-gray-900">{title}</Text>
          {subtitle && (
            <Text className="text-base text-gray-500 mt-2 leading-6">{subtitle}</Text>
          )}
        </View>

        <View className="flex-1 justify-center">{children}</View>
      </ScrollView>

      <View className="px-6 pb-6 pt-2 gap-3">{footer}</View>
    </SafeAreaView>
  );
}
