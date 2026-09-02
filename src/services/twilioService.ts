import axios from "axios";
import { apiClient, ApiError } from "./apiClient";

/**
 * IMPORTANT: This does NOT call Twilio's REST API directly from the device.
 * Twilio Account SID + Auth Token are billing-linked secrets; shipping them
 * in an EXPO_PUBLIC_* var would expose them to anyone who decompiles the app
 * or inspects network traffic. Instead this calls our local backend
 * (backend/server.js -> POST /api/sms), which holds the real Twilio
 * credentials server-side and makes the actual Twilio API call.
 *
 * Flow:
 *   1. This function fires immediately, backend sends an acknowledgment SMS.
 *   2. Backend then verifies the claim with Gemini in the background and
 *      sends a SECOND SMS with the actual verdict — this happens server-side
 *      and does not require the app to stay open or stay connected.
 */
export async function sendOfflineSMS(query: string, userPhone: string): Promise<void> {
  if (!userPhone || userPhone.trim().length < 8) {
    throw new ApiError("INVALID_PHONE_NUMBER");
  }

  try {
    await apiClient.post("/api/sms/queue", {
      query,
      userPhone: normalizePhoneNumber(userPhone),
    });
  } catch (err) {
    // Surface Twilio's Trial-account restriction distinctly, since it needs
    // an actionable, specific message rather than a generic "SMS failed" —
    // the fix is verifying the number in the Twilio Console, not retrying.
    if (axios.isAxiosError(err) && err.response?.data?.error === "TRIAL_NUMBER_UNVERIFIED") {
      throw new ApiError("SMS_TRIAL_NUMBER_UNVERIFIED", err);
    }
    throw new ApiError("SMS_SEND_FAILED", err);
  }
}

/** Best-effort E.164 normalization for Indian numbers, since that's the
 * primary target market — assumes a 10-digit local number if no country
 * code is present. Twilio rejects malformed numbers outright either way,
 * so the backend re-validates this; this is just to reduce avoidable failures. */
function normalizePhoneNumber(raw: string): string {
  const digitsOnly = raw.replace(/[^\d+]/g, "");
  if (digitsOnly.startsWith("+")) return digitsOnly;
  if (digitsOnly.length === 10) return `+91${digitsOnly}`;
  if (digitsOnly.startsWith("91") && digitsOnly.length === 12) return `+${digitsOnly}`;
  return `+${digitsOnly}`;
}
