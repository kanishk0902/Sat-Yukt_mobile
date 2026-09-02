import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WelcomeScreen from "../screens/onboarding/WelcomeScreen";
import LanguageSelectScreen from "../screens/onboarding/LanguageSelectScreen";
import PhoneEntryScreen from "../screens/onboarding/PhoneEntryScreen";
import OtpVerifyScreen from "../screens/onboarding/OtpVerifyScreen";
import LocationPermissionScreen from "../screens/onboarding/LocationPermissionScreen";

export type OnboardingStackParamList = {
  Welcome: undefined;
  LanguageSelect: undefined;
  PhoneEntry: undefined;
  OtpVerify: { phone: string };
  LocationPermission: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
    </Stack.Navigator>
  );
}
