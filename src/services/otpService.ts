import { apiClient, ApiError } from "./apiClient";

/**
 * IMPORTANT: mirrors twilioService.ts's rationale — Twilio Verify credentials
 * are billing-linked secrets, so this calls our local backend
 * (backend/server.js -> POST /api/auth/otp/send|verify), which holds the
 * real Twilio Verify Service SID and makes the actual Twilio API calls.
 */
export async function sendOtp(phone: string): Promise<void> {
  if (!phone || phone.trim().length < 8) {
    throw new ApiError("INVALID_PHONE_NUMBER");
  }

  try {
    await apiClient.post("/api/auth/otp/send", { phone: normalizePhoneNumber(phone) });
  } catch (err) {
    throw new ApiError("OTP_SEND_FAILED", err);
  }
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  try {
    const response = await apiClient.post<{ verified: boolean }>("/api/auth/otp/verify", {
      phone: normalizePhoneNumber(phone),
      code,
    });
    return response.data.verified;
  } catch (err) {
    throw new ApiError("OTP_VERIFY_FAILED", err);
  }
}

/** Best-effort E.164 normalization for Indian numbers — same heuristic as
 * twilioService.ts's normalizePhoneNumber, duplicated here since it's a
 * tiny, self-contained helper and this file shouldn't reach into that
 * module's internals. */
function normalizePhoneNumber(raw: string): string {
  const digitsOnly = raw.replace(/[^\d+]/g, "");
  if (digitsOnly.startsWith("+")) return digitsOnly;
  if (digitsOnly.length === 10) return `+91${digitsOnly}`;
  if (digitsOnly.startsWith("91") && digitsOnly.length === 12) return `+${digitsOnly}`;
  return `+${digitsOnly}`;
}
