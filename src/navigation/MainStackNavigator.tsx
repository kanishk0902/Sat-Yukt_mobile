import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/HomeScreen";
import SettingsHomeScreen from "../screens/settings/SettingsHomeScreen";
import ProfileScreen from "../screens/settings/ProfileScreen";
import ContactUsScreen from "../screens/settings/ContactUsScreen";
import FaqScreen from "../screens/settings/FaqScreen";
import HistoryScreen from "../screens/HistoryScreen";

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Profile: undefined;
  ContactUs: undefined;
  Faq: undefined;
  History: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  SettingsTab: undefined;
};

const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

function SettingsStackNavigator() {
  return (
    <SettingsStack.Navigator
      screenOptions={{ headerShown: true, headerTitle: "", headerShadowVisible: false }}
    >
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsHomeScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen name="Profile" component={ProfileScreen} />
      <SettingsStack.Screen name="ContactUs" component={ContactUsScreen} />
      <SettingsStack.Screen name="Faq" component={FaqScreen} />
      <SettingsStack.Screen name="History" component={HistoryScreen} />
    </SettingsStack.Navigator>
  );
}

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainStackNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#407348",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarLabelStyle: { fontFamily: "Poppins_500Medium", fontSize: 12 },
        tabBarStyle: { height: 64, paddingBottom: 10, paddingTop: 6 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
