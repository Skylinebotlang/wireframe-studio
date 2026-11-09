// ─────────────────────────────────────────────────────────────────────────────
// SIGN-IN SESSION (server side) — the two sign-in cookies, and calls to
// Supabase Auth. SERVER ONLY.
//
// After signing in, the browser holds two cookies it can't read with
// JavaScript (HttpOnly), that only travel over HTTPS (Secure, live site) and
// only with requests from our own pages (SameSite=Lax):
//   ACCESS   the short-lived sign-in pass (about 1 hour)
//   REFRESH  swaps an old pass for a new one (proxy.ts does it automatically)
// Passwords are checked and stored (hashed with bcrypt) by Supabase; this
// app never stores them.
//
// supabaseAuth() talks to Supabase with the SECRET key and forwards the
// visitor's IP (Sb-Forwarded-For), so Supabase's own rate limits count each
// visitor separately rather than all of them as "our server".
// (Needs "IP address forwarding" switched on in Supabase → Authentication →
// Rate Limits.)
// ─────────────────────────────────────────────────────────────────────────────

import type { NextResponse } from "next/server";

const LIVE = process.env.NODE_ENV === "production";
// "__Host-" makes the browser refuse these cookies unless they are Secure,
// for this exact site, path "/". Plain names in development (http://).
export const ACCESS = LIVE ? "__Host-ws-access" : "ws-access";
export const REFRESH = LIVE ? "__Host-ws-refresh" : "ws-refresh";
const REFRESH_DAYS = 30;

export type Tokens = { access_token: string; refresh_token: string; expires_in: number };

/** The visitor's IP address (Vercel puts it first in x-forwarded-for). */
export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Read one cookie from a request. */
export function readCookie(request: Request, name: string) {
  const hit = (request.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

/** When a sign-in pass runs out (seconds since 1970), read from inside it. 0 if unreadable. */
export function expiresAt(token: string) {
  try {
    return Number(JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()).exp) || 0;
  } catch {
    return 0;
  }
}

/** Put a fresh session into the two cookies. */
export function setSession(res: NextResponse, t: Tokens) {
  const base = { httpOnly: true, secure: LIVE, sameSite: "lax" as const, path: "/" };
  res.cookies.set(ACCESS, t.access_token, { ...base, maxAge: t.expires_in || 3600 });
  res.cookies.set(REFRESH, t.refresh_token, { ...base, maxAge: REFRESH_DAYS * 86400 });
}

/** Remove both cookies (signed out, or the session can't be renewed). */
export function clearSession(res: NextResponse) {
  for (const name of [ACCESS, REFRESH]) res.cookies.set(name, "", { httpOnly: true, secure: LIVE, sameSite: "lax", path: "/", maxAge: 0 });
}

/**
 * One call to Supabase Auth (path like "token?grant_type=password").
 * Returns { ok, status, data }; never throws (a network failure → status 0).
 */
export async function supabaseAuth(
  path: string,
  init: { method?: string; body?: unknown; token?: string; ip?: string } = {}
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || key.includes("paste_yours_here")) return { ok: false, status: 0, data: { msg: "Sign-in isn't set up on the server." } };
  try {
    const res = await fetch(`${url}/auth/v1/${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        apikey: key,
        "content-type": "application/json",
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...(init.ip && init.ip !== "unknown" ? { "sb-forwarded-for": init.ip } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: data && typeof data === "object" ? data : {} };
  } catch {
    return { ok: false, status: 0, data: { msg: "Couldn't reach the sign-in service." } };
  }
}

/** Supabase's error text, whichever field it used. */
export function authMessage(data: Record<string, unknown>) {
  return String(data.msg ?? data.error_description ?? data.message ?? data.error_code ?? data.error ?? "");
}

/** Does a reply contain a full session? */
export function isTokens(d: Record<string, unknown>): d is Record<string, unknown> & Tokens {
  return typeof d.access_token === "string" && typeof d.refresh_token === "string";
}
