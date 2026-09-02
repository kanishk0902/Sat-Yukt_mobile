const axios = require("axios");

/**
 * Twilio Verify's REST API, called the same way twilioProvider.js calls the
 * Messages API — raw axios + Basic Auth, no Twilio SDK needed. Requires a
 * Verify Service created in the Twilio Console (Console -> Verify ->
 * Services -> Create new) and its SID in TWILIO_VERIFY_SERVICE_SID.
 */
function requireVerifyConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifyServiceSid) {
    throw new Error("Twilio Verify is not fully configured in backend/.env");
  }
  return { accountSid, authToken, verifyServiceSid };
}

async function startVerification(toPhoneNumber) {
  const { accountSid, authToken, verifyServiceSid } = requireVerifyConfig();

  const url = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`;
  const params = new URLSearchParams();
  params.append("To", toPhoneNumber);
  params.append("Channel", "sms");

  const response = await axios.post(url, params, {
    auth: { username: accountSid, password: authToken },
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });

  return response.data; // { sid, status: "pending", ... }
}

async function checkVerification(toPhoneNumber, code) {
  const { accountSid, authToken, verifyServiceSid } = requireVerifyConfig();

  const url = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`;
  const params = new URLSearchParams();
  params.append("To", toPhoneNumber);
  params.append("Code", code);

  const response = await axios.post(url, params, {
    auth: { username: accountSid, password: authToken },
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });

  return response.data; // { status: "approved" | "pending" | "canceled", ... }
}

module.exports = { startVerification, checkVerification };
