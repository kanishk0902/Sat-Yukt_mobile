import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { CONFIG } from "../config";
import { QueuedQuery, SupportedLanguageCode } from "../types";
import { apiClient } from "./apiClient";

/**
 * Rural connectivity is often intermittent rather than fully absent — a
 * farmer might record a question with no signal, then walk to a spot with
 * signal minutes later. Rather than losing the query, we persist it locally
 * and retry automatically once NetInfo reports a connection.
 */

async function getQueue(): Promise<QueuedQuery[]> {
  const raw = await AsyncStorage.getItem(CONFIG.asyncStorageKeys.history);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedQuery[];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedQuery[]): Promise<void> {
  await AsyncStorage.setItem(CONFIG.asyncStorageKeys.history, JSON.stringify(queue));
}

export async function queueOfflineQuery(
  claimText: string,
  language: SupportedLanguageCode
): Promise<QueuedQuery> {
  const queue = await getQueue();
  const entry: QueuedQuery = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    claimText,
    language,
    createdAt: Date.now(),
    status: "pending",
  };
  queue.unshift(entry);
  await saveQueue(queue);
  return entry;
}

export async function getAllQueriesFromHistory(): Promise<QueuedQuery[]> {
  return getQueue();
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(CONFIG.asyncStorageKeys.history);
}

export async function markResolved(
  id: string,
  result: QueuedQuery["result"]
): Promise<void> {
  const queue = await getQueue();
  const updated = queue.map((q) =>
    q.id === id ? { ...q, status: "resolved" as const, result } : q
  );
  await saveQueue(updated);
}

/**
 * Attempts to resolve every pending queued query against the backend.
 * Call this on app foreground and whenever NetInfo transitions to connected.
 * Silently no-ops queries that still fail (stays pending for the next retry).
 */
export async function retryPendingQueries(): Promise<void> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  const queue = await getQueue();
  const pending = queue.filter((q) => q.status === "pending");
  if (pending.length === 0) return;

  for (const query of pending) {
    try {
      const response = await apiClient.post<{ verdict: string; explanation: string }>(
        "/api/verify",
        { claimText: query.claimText, language: query.language }
      );
      await markResolved(query.id, {
        verdict: response.data.verdict as VerificationResultVerdict,
        explanation: response.data.explanation,
        language: query.language,
        claimText: query.claimText,
        timestamp: Date.now(),
        source: "online",
      });
    } catch {
      // Leave as pending; will retry again on next connectivity event.
      continue;
    }
  }
}

/** Subscribes to connectivity changes and auto-retries the queue. Call once
 * near app root; returns an unsubscribe function. */
export function subscribeToConnectivityRetries(): () => void {
  let wasConnected: boolean | null = null;
  const unsubscribe = NetInfo.addEventListener((state) => {
    const isConnected = !!state.isConnected;
    if (isConnected && wasConnected === false) {
      retryPendingQueries().catch(() => {
        /* best-effort background retry */
      });
    }
    wasConnected = isConnected;
  });
  return unsubscribe;
}

// Local type alias to avoid a circular import with types.ts's Verdict export
// while keeping this file self-contained for the retry path.
type VerificationResultVerdict = "True" | "False" | "Misleading" | "Unclear";
