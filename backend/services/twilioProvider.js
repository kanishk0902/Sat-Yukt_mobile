const axios = require("axios");

/**
 * Direct call to Twilio's REST API using Basic Auth (Account SID as username,
 * Auth Token as password) — this is Twilio's documented server-to-server
 * pattern. This must run server-side only: see SETUP.md / voiceService.ts
 * comments for why this can't live in the mobile app.
 */
async function sendSms(toPhoneNumber, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio credentials are not fully configured in backend/.env");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const params = new URLSearchParams();
  params.append("To", toPhoneNumber);
  params.append("From", fromNumber);
  params.append("Body", body);

  const response = await axios.post(url, params, {
    auth: {
      username: accountSid,
      password: authToken,
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 15000,
  });

  return response.data; // includes Twilio message SID, status, etc.
}

module.exports = { sendSms };
