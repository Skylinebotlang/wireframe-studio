// ─────────────────────────────────────────────────────────────────────────────
// SIGN-IN LIMITS + FAILED SIGN-IN LOG — slows down password guessing. SERVER ONLY.
//
//   tooMany(key, limit, windowMs) → true if `key` already used up its tries
//   note(key)                     → count one try for `key`
//   logFailure(kind, ip, email)   → one line in the Vercel logs per failure;
//                                   a "SECURITY ALERT" line once someone
//                                   crosses the alert line (see ALERT_AT)
//
// Keys look like "signin-fail:email@x.com" or "signup:1.2.3.4".
// Supabase has its own per-IP limits on top of these (lib/server/session.ts
// forwards the visitor's IP to it).
// ponytail: counts live in this server's memory, so each Vercel instance
// counts on its own and a restart forgets. Move them to a database table if
// attacks ever get serious.
// ─────────────────────────────────────────────────────────────────────────────

const tries = new Map<string, number[]>();

function recent(key: string, windowMs: number, now: number) {
  const list = (tries.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length) tries.set(key, list);
  else tries.delete(key);
  return list;
}

/** Has `key` already made `limit` tries in the last `windowMs`? */
export function tooMany(key: string, limit: number, windowMs: number, now = Date.now()) {
  return recent(key, windowMs, now).length >= limit;
}

/** Count one try for `key`. */
export function note(key: string, now = Date.now()) {
  if (tries.size > 20_000) tries.clear(); // memory guard against floods of fake keys
  tries.set(key, [...(tries.get(key) ?? []), now]);
}

/** "papi@gmail.com" → "pa***@gmail.com": enough to spot a pattern, not a full address. */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return domain ? `${name.slice(0, 2)}***@${domain}` : "***";
}

// After this many failures for one email (15 min) or one IP (10 min), log an alert.
export const ALERT_AT = { email: 5, ip: 20 };

/** Log one failed sign-in (or reset), and an alert line when a limit is crossed. */
export function logFailure(kind: string, ip: string, email: string, now = Date.now()) {
  const who = { ip, email: maskEmail(email) };
  console.warn(JSON.stringify({ event: "auth.failed", kind, ...who, at: new Date(now).toISOString() }));
  const byEmail = recent(`signin-fail:${email}`, 15 * 60_000, now).length;
  const byIp = recent(`signin-fail-ip:${ip}`, 10 * 60_000, now).length;
  if (byEmail === ALERT_AT.email || byIp === ALERT_AT.ip) {
    console.error(`SECURITY ALERT: many failed sign-ins ${JSON.stringify({ event: "auth.alert", kind, ...who, byEmail, byIp })}`);
  }
}
