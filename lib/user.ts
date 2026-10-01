// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY — "who am I in this room?"
//
// There is no login system in the prototype. Instead, each person picks a
// name, a role and a cursor color once; we save it in the browser's
// localStorage so a refresh keeps the same identity.
//
// In a real product this would come from your login system — but for the YC
// demo this is exactly what you want: zero friction, just type a name.
// ─────────────────────────────────────────────────────────────────────────────

import { PEOPLE_COLORS, ROLES } from "./theme";

export type UserIdentity = {
  id: string; // random unique id, used as the Liveblocks userId
  name: string; // display name, e.g. "Asha"
  role: string; // one of ROLES, e.g. "PM"
  color: string; // cursor color (hex from PEOPLE_COLORS)
};

// Key under which the identity is stored in localStorage.
const STORAGE_KEY = "wireframe-studio-identity";

/** Read the saved identity, or null if this browser hasn't joined a room yet. */
export function loadIdentity(): UserIdentity | null {
  if (typeof window === "undefined") return null; // not in the browser yet
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserIdentity;
    // Basic sanity check so a corrupted save can't break the app.
    if (!parsed.id || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Save the identity so the next page load remembers this person. */
export function saveIdentity(identity: UserIdentity): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

/**
 * Build a new identity from the join form.
 * `colorIndex` is which swatch the user picked (or -1 for "surprise me").
 */
export function makeIdentity(
  name: string,
  role: string,
  colorIndex: number
): UserIdentity {
  const color =
    colorIndex >= 0 && colorIndex < PEOPLE_COLORS.length
      ? PEOPLE_COLORS[colorIndex]
      : // No pick? Assign a stable color based on the name so the same
        // person tends to get the same color on different devices.
        PEOPLE_COLORS[
          Math.abs(hashString(name + role)) % PEOPLE_COLORS.length
        ];
  return {
    id: `user-${crypto.randomUUID()}`,
    name: name.trim(),
    role: ROLES.includes(role as (typeof ROLES)[number]) ? role : "PM",
    color,
  };
}

// Tiny string hash (djb2) — only used to pick a default color.
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h | 0;
}
