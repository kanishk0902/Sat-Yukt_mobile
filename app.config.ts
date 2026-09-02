import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Sat-Yukt",
  slug: "gramsatya",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#1A241C",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.gramsatya.app",
    infoPlist: {
      NSMicrophoneUsageDescription:
        "Sat-Yukt needs microphone access so you can ask your question by speaking.",
      NSLocationWhenInUseUsageDescription:
        "Sat-Yukt uses your location to show news and schemes relevant to your district.",
    },
  },
  android: {
    package: "com.gramsatya.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1A241C",
    },
    permissions: ["RECORD_AUDIO", "INTERNET", "ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
  },
  plugins: [
    [
      "expo-av",
      {
        microphonePermission:
          "Sat-Yukt needs microphone access so you can ask your question by speaking.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Sat-Yukt uses your location to show news and schemes relevant to your district.",
      },
    ],
    "expo-font",
  ],
  extra: {},
};

export default config;
