// ─────────────────────────────────────────────────────────────────────────────
// "BRING YOUR OWN KEY": where a person's AI key lives. BROWSER ONLY.
//
// The key is saved ONLY in this browser's localStorage. It is never put in
// Liveblocks, the shared room, a database or a file, so nobody else in the
// room can ever see it. It leaves the browser only inside an agent request
// (or a "Test key" request) to our own server, which uses it once and
// forgets it.
// ─────────────────────────────────────────────────────────────────────────────

import { isProviderId, type ProviderId } from "./ai-providers";

export type SavedAiKey = { provider: ProviderId; key: string };

const STORAGE_KEY = "wireframe-studio-ai-key";

/** The saved key, or null if this person hasn't added one. */
export function loadAiKey(): SavedAiKey | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (isProviderId(parsed?.provider) && typeof parsed.key === "string" && parsed.key) {
      return { provider: parsed.provider, key: parsed.key };
    }
  } catch {
    // Storage blocked or corrupted: behave as if no key is saved.
  }
  return null;
}

/**
 * What to put in the agent request body as `aiKey`: the saved key, or
 * undefined (then the server uses the app's own key).
 * Usage: fetch("/api/agent", { body: JSON.stringify({ notes, aiKey: aiKeyForRequest() }) })
 */
export function aiKeyForRequest(): SavedAiKey | undefined {
  return loadAiKey() ?? undefined;
}

export function saveAiKey(value: SavedAiKey): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearAiKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Fired in this tab whenever the key is saved or removed, so the key icon
// and panel can update.
export const CHANGE_EVENT = "wireframe-studio-ai-key-change";

/** "AIzaSyB...x3f9" → "AIza••••••3f9". Safe to show on screen. */
export function maskKey(key: string): string {
  if (key.length <= 8) return "••••••";
  return `${key.slice(0, 4)}••••••${key.slice(-3)}`;
}
