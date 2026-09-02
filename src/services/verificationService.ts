import { apiClient, ApiError, isNetworkError } from "./apiClient";
import { SupportedLanguageCode, VerificationResult, Verdict } from "../types";
import { sendOfflineSMS } from "./twilioService";
import { queueOfflineQuery } from "./offlineQueueService";

const VALID_VERDICTS: Verdict[] = ["True", "False", "Misleading", "Unclear"];

function isValidVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && VALID_VERDICTS.includes(value as Verdict);
}

/**
 * Sends a transcribed claim to Gemini (via the backend) for fact-checking.
 * The backend enforces a strict JSON response shape from the model; this
 * function additionally validates that shape client-side before trusting it,
 * since LLMs occasionally drift from instructed output even with JSON mode.
 *
 * If the request fails due to no network reachability, this automatically:
 *   1. Queues the query locally (AsyncStorage) so it can be shown as "pending"
 *      in history and retried later.
 *   2. Triggers an offline SMS acknowledgment via Twilio, if a phone number
 *      is on file, so the farmer isn't left with silence.
 * It then rethrows so the UI can show the appropriate offline messaging.
 */
export async function verifyClaim(
  claimText: string,
  language: SupportedLanguageCode,
  userPhone?: string | null
): Promise<VerificationResult> {
  try {
    const response = await apiClient.post<{ verdict: string; explanation: string }>(
      "/api/verify",
      { claimText, language }
    );

    const { verdict, explanation } = response.data;

    if (!isValidVerdict(verdict) || typeof explanation !== "string" || !explanation.trim()) {
      throw new ApiError("MALFORMED_VERIFICATION_RESPONSE");
    }

    return {
      verdict,
      explanation,
      language,
      claimText,
      timestamp: Date.now(),
      source: "online",
    };
  } catch (err) {
    if (isNetworkError(err)) {
      await queueOfflineQuery(claimText, language);

      if (userPhone) {
        try {
          await sendOfflineSMS(claimText, userPhone);
        } catch {
          // SMS is a best-effort convenience here; if it fails too, the query
          // is still queued and will show in history as pending. We don't
          // want a Twilio failure to mask the more important "queued offline"
          // outcome from the caller.
        }
      }

      throw new ApiError("NETWORK_ERROR", err);
    }

    throw err instanceof ApiError ? err : new ApiError("VERIFICATION_FAILED", err);
  }
}
