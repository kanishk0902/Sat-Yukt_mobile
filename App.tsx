import "./global.css";
import React, { useCallback, useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import OnboardingStackNavigator from "./src/navigation/OnboardingStackNavigator";
import MainStackNavigator from "./src/navigation/MainStackNavigator";
import { OnboardingContext } from "./src/navigation/OnboardingContext";
import { usePoppinsFonts, applyGlobalPoppinsDefault } from "./src/theme/fonts";
import { isOnboardingComplete } from "./src/services/onboardingService";

SplashScreen.preventAutoHideAsync().catch(() => {});

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = usePoppinsFonts();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    isOnboardingComplete().then((done) => {
      setIsOnboarded(done);
      setOnboardingChecked(true);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded) applyGlobalPoppinsDefault();
  }, [fontsLoaded]);

  const ready = fontsLoaded && onboardingChecked;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const completeOnboarding = useCallback(() => setIsOnboarded(true), []);
  const uncompleteOnboarding = useCallback(() => setIsOnboarded(false), []);

  if (!ready) return null; // native splash screen stays visible, no flash

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <OnboardingContext.Provider value={{ completeOnboarding, uncompleteOnboarding }}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isOnboarded ? (
              <Stack.Screen name="Main" component={MainStackNavigator} />
            ) : (
              <Stack.Screen name="Onboarding" component={OnboardingStackNavigator} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </OnboardingContext.Provider>
    </SafeAreaProvider>
  );
}
