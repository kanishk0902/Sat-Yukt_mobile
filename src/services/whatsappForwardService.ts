import { apiClient, ApiError } from "./apiClient";

/**
 * Handoff point for forwarded WhatsApp scam/misinformation messages. Like
 * Twilio, the n8n webhook URL itself is not necessarily secret, but routing
 * through the backend keeps a single consistent boundary between "things the
 * client calls" and "things that touch external services" — makes it trivial
 * to add auth, logging, or rate limiting later in one place.
 *
 * mediaUrl is optional: n8n workflows for WhatsApp handoff commonly need to
 * fetch forwarded media (images/voice notes) from a URL rather than receiving
 * raw bytes, since the source is typically a WhatsApp Business API webhook
 * upstream of n8n, not this app directly.
 */
export async function forwardToWhatsAppAgent(
  mediaUrl: string | null,
  text: string
): Promise<{ forwarded: boolean }> {
  try {
    const response = await apiClient.post<{ forwarded: boolean }>(
      "/api/whatsapp/forward",
      { mediaUrl, text }
    );
    return response.data;
  } catch (err) {
    throw new ApiError("WHATSAPP_FORWARD_FAILED", err);
  }
}
