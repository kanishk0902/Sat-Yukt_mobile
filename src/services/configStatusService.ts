import { apiClient } from "./apiClient";

export interface ConfigStatus {
  smsAvailable: boolean;
  otpAvailable: boolean;
}

const FALLBACK_STATUS: ConfigStatus = { smsAvailable: false, otpAvailable: false };

/**
 * Asks the backend which optional features are actually usable right now
 * (e.g. SMS fallback needs a real Twilio phone number provisioned, which a
 * Twilio Trial account may not have). Used to hide UI for features that
 * would just fail, rather than showing a button that always errors.
 * Fails closed (features hidden) on any network error — this only ever
 * hides UI, never blocks a flow, so failing closed is the safe default.
 */
export async function getConfigStatus(): Promise<ConfigStatus> {
  try {
    const response = await apiClient.get<ConfigStatus>("/api/config-status");
    return response.data;
  } catch {
    return FALLBACK_STATUS;
  }
}
