import { Text, TextInput } from "react-native";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

export function usePoppinsFonts() {
  return useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
}

/**
 * Applies Poppins as the default font for every <Text>/<TextInput> in the
 * app, including existing screens/components — none of them set an explicit
 * font-family class, so there's nothing to override. This is what makes the
 * font apply app-wide without editing every file that renders text.
 */
export function applyGlobalPoppinsDefault() {
  const AnyText = Text as unknown as { defaultProps?: { style?: unknown } };
  AnyText.defaultProps = AnyText.defaultProps || {};
  AnyText.defaultProps.style = [{ fontFamily: "Poppins_400Regular" }, AnyText.defaultProps.style];

  const AnyTextInput = TextInput as unknown as { defaultProps?: { style?: unknown } };
  AnyTextInput.defaultProps = AnyTextInput.defaultProps || {};
  AnyTextInput.defaultProps.style = [
    { fontFamily: "Poppins_400Regular" },
    AnyTextInput.defaultProps.style,
  ];
}
