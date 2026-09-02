import axios from "axios";
import { CONFIG } from "../config";

/**
 * Single axios instance for all calls to our local backend. The app never
 * calls Gemini, Twilio, or Wispr directly — everything routes through
 * backend/server.js, which holds the real API keys. See SETUP.md for why.
 */
export const apiClient = axios.create({
  baseURL: CONFIG.backendUrl,
  timeout: CONFIG.requestTimeoutMs,
});

export class ApiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

/** True if the error looks like "no network reached the backend at all",
 * as opposed to the backend reaching upstream (Gemini/Twilio) and failing. */
export function isNetworkError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    return !err.response; // no response = request never completed (offline, DNS, timeout)
  }
  return false;
}
