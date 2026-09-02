import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "../config";
import { UserLocation } from "../types";

/**
 * One-time location capture for onboarding — not continuous tracking. Uses
 * the on-device OS geocoder (reverseGeocodeAsync), so this needs zero API
 * keys and works even before any backend service is configured. Permission
 * denial or geocode failure degrades gracefully (returns null / partial
 * data) rather than throwing, since location is always skippable.
 */
export async function requestAndStoreLocation(): Promise<UserLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    return null;
  }

  let district: string | null = null;
  let state: string | null = null;
  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    district = place?.subregion ?? place?.city ?? null;
    state = place?.region ?? null;
  } catch {
    // Reverse geocoding is best-effort; coordinates alone are still useful.
  }

  const location: UserLocation = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    district,
    state,
    capturedAt: Date.now(),
  };

  await AsyncStorage.setItem(CONFIG.asyncStorageKeys.userLocation, JSON.stringify(location));
  return location;
}

export async function getStoredLocation(): Promise<UserLocation | null> {
  const raw = await AsyncStorage.getItem(CONFIG.asyncStorageKeys.userLocation);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserLocation;
  } catch {
    return null;
  }
}
