import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "../config";

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(CONFIG.asyncStorageKeys.onboardingComplete);
  return value === "true";
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(CONFIG.asyncStorageKeys.onboardingComplete, "true");
}
