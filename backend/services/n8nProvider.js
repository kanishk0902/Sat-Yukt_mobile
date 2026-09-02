const axios = require("axios");

/** Forwards a possible WhatsApp scam/misinformation message to an n8n
 * workflow for further automated handling (e.g. cross-posting to a
 * moderation queue, triggering a WhatsApp Business API reply, logging to a
 * community-reports sheet). The shape of the payload is intentionally
 * generic since n8n workflows are user-defined on the receiving end. */
async function forwardToN8n(mediaUrl, text) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("N8N_WEBHOOK_URL is not configured");
  }

  const response = await axios.post(
    webhookUrl,
    {
      source: "sat-yukt-app",
      mediaUrl,
      text,
      timestamp: new Date().toISOString(),
    },
    { timeout: 15000 }
  );

  return response.data;
}

module.exports = { forwardToN8n };
