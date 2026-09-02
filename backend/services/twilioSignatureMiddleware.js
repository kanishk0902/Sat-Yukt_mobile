const twilio = require("twilio");

/**
 * Validates that inbound requests to /voice/* genuinely came from Twilio.
 * The rest of this backend intentionally has no auth (see SETUP.md's "Known
 * limitations" — accepted for a local-only dev server), but this endpoint is
 * different: it's a webhook Twilio calls over the public tunnel, and an
 * unauthenticated version of it would let anyone on the internet trigger
 * billable Gemini/Whisper calls. Uses the official twilio package only for
 * this one signature check — no other part of this codebase uses the SDK.
 */
function twilioSignatureMiddleware(req, res, next) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[voice] TWILIO_AUTH_TOKEN not set — rejecting all /voice requests");
    return res.status(500).send("Twilio is not configured");
  }

  const signature = req.headers["x-twilio-signature"];
  // req.protocol/req.hostname reflect the tunnel's forwarded headers because
  // server.js sets `trust proxy` — without that this would always fail
  // behind the Cloudflare tunnel.
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const isValid = twilio.validateRequest(authToken, signature, fullUrl, req.body || {});
  if (!isValid) {
    console.warn(`[voice] rejected request with invalid Twilio signature for ${fullUrl}`);
    return res.status(403).send("Invalid signature");
  }

  next();
}

module.exports = twilioSignatureMiddleware;
