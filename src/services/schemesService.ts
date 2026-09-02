import { apiClient } from "./apiClient";
import { GovernmentScheme, SupportedLanguageCode } from "../types";

// Module-level cache, alongside the backend's own 24h cache. This one exists
// for a different reason: SchemesCard remounts every time the user returns
// to Home's "at rest" view (e.g. backing out of a mic attempt), and without
// this, each remount would re-hit the network even when we already have a
// perfectly good answer from moments ago — wasteful, and during a Gemini
// rate-limit it turned rapid remounts into a retry-storm that starved the
// actual fact-check feature of the same shared quota.
const sessionCache = new Map<string, GovernmentScheme[]>();

/**
 * Fetches a short list of currently active government schemes relevant to
 * the given state, in the given language. Cached both here (per app session,
 * so remounting the card doesn't re-fetch) and on the backend (24h, so
 * different sessions/users share the same cheap answer).
 */
export async function getLatestSchemes(
  state: string | null,
  language: SupportedLanguageCode
): Promise<GovernmentScheme[]> {
  const cacheKey = `${state ?? ""}|${language}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;

  const response = await apiClient.get<{ schemes: GovernmentScheme[] }>("/api/schemes", {
    params: { state: state ?? "", language },
  });
  sessionCache.set(cacheKey, response.data.schemes);
  return response.data.schemes;
}
