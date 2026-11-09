// ─────────────────────────────────────────────────────────────────────────────
// SIGN-IN ENDPOINTS — /api/auth/<action>. Every sign-in step goes through our
// server, so passwords are checked here (format), tries are limited, failures
// are logged, and the session lands in HttpOnly cookies the page's
// JavaScript can't read (lib/server/session.ts).
//
//   POST signin  { email, password }          → { account }   sign in
//   POST signup  { name, email, password }    → { account } or { confirm: true }
//   POST signout                              → { ok }        sign out (this device)
//   POST forgot  { email }                    → { ok }        email a reset link
//   POST reset   { token, password }          → { account }   new password from
//                the reset link: signs out every other session, then signs in
//   POST session { access_token, refresh_token } → { account } an email link
//                (confirm sign-up) signed you in: keep it as cookies
//   GET  me                                   → { account: {id,email,name} | null }
//
// Limits (lib/server/auth-limit.ts): 5 wrong passwords per email per 15 min,
// 30 sign-in tries per IP per 10 min, 5 sign-ups per IP per hour, 3 reset
// emails per address per hour. Supabase adds its own per-IP limits.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { clearSession, clientIp, isTokens, setSession, supabaseAuth, authMessage, REFRESH, readCookie } from "@/lib/server/session";
import { accessToken, getSignedInUser, userFromToken } from "@/lib/server/auth-server";
import { logFailure, note, tooMany } from "@/lib/server/auth-limit";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN = 60_000;
const TOO_MANY = "Too many tries. Wait a few minutes and try again.";

type Ctx = { params: Promise<{ action: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if ((await params).action !== "me") return reply({ error: "Not found." }, 404);
  return reply({ account: await getSignedInUser(request) });
}

export async function POST(request: Request, { params }: Ctx) {
  const action = (await params).action;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const ip = clientIp(request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  switch (action) {
    case "signin": {
      if (!EMAIL.test(email) || email.length > 254 || !password || password.length > 200) return reply({ error: "Wrong email or password." }, 400);
      if (tooMany(`signin-fail:${email}`, 5, 15 * MIN) || tooMany(`signin-ip:${ip}`, 30, 10 * MIN)) return reply({ error: TOO_MANY }, 429);
      note(`signin-ip:${ip}`);
      const r = await supabaseAuth("token?grant_type=password", { body: { email, password }, ip });
      if (!r.ok || !isTokens(r.data)) {
        if (r.status === 400 || r.status === 401) {
          note(`signin-fail:${email}`);
          note(`signin-fail-ip:${ip}`);
          logFailure("signin", ip, email);
        }
        return reply({ error: friendly(authMessage(r.data), r.status) }, r.status === 429 ? 429 : r.status === 0 ? 503 : 400);
      }
      return signedIn(r.data);
    }

    case "signup": {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const problem = checkNew(name, email, password, true);
      if (problem) return reply({ error: problem }, 400);
      if (tooMany(`signup:${ip}`, 5, 60 * MIN)) return reply({ error: TOO_MANY }, 429);
      note(`signup:${ip}`);
      if (await isLeakedPassword(password)) return reply({ error: LEAKED }, 400);
      const back = encodeURIComponent(`${new URL(request.url).origin}/login`);
      const r = await supabaseAuth(`signup?redirect_to=${back}`, { body: { email, password, data: { name } }, ip });
      if (!r.ok) return reply({ error: friendly(authMessage(r.data), r.status) }, r.status === 429 ? 429 : r.status === 0 ? 503 : 400);
      // "Confirm email" switched on in Supabase → no session until they click the link.
      return isTokens(r.data) ? signedIn(r.data) : reply({ confirm: true });
    }

    case "signout": {
      const token = accessToken(request);
      if (token) await supabaseAuth("logout?scope=local", { method: "POST", token, ip });
      const res = reply({ ok: true });
      clearSession(res);
      return res;
    }

    case "forgot": {
      if (!EMAIL.test(email) || email.length > 254) return reply({ error: "That email doesn't look right." }, 400);
      if (tooMany(`forgot:${email}`, 3, 60 * MIN) || tooMany(`forgot-ip:${ip}`, 10, 60 * MIN)) return reply({ error: TOO_MANY }, 429);
      note(`forgot:${email}`);
      note(`forgot-ip:${ip}`);
      const back = encodeURIComponent(`${new URL(request.url).origin}/reset-password`);
      const r = await supabaseAuth(`recover?redirect_to=${back}`, { body: { email }, ip });
      if (r.status === 429) return reply({ error: TOO_MANY }, 429);
      // Always "check your email": never reveal whether an account exists.
      return reply({ ok: true });
    }

    case "reset": {
      const token = typeof body.token === "string" ? body.token : "";
      const problem = checkNew("ok", "a@b.co", password, false);
      if (problem) return reply({ error: problem }, 400);
      if (tooMany(`reset:${ip}`, 10, 60 * MIN)) return reply({ error: TOO_MANY }, 429);
      note(`reset:${ip}`);
      const user = token ? await userFromToken(token) : null;
      if (!user) {
        logFailure("reset", ip, "unknown@link");
        return reply({ error: EXPIRED }, 401);
      }
      if (await isLeakedPassword(password)) return reply({ error: LEAKED }, 400);
      const changed = await supabaseAuth("user", { method: "PUT", token, body: { password }, ip });
      if (!changed.ok) return reply({ error: friendly(authMessage(changed.data), changed.status) }, 400);
      // The link's session and every other session end here (one use only),
      // then a fresh session starts with the new password.
      await supabaseAuth("logout?scope=global", { method: "POST", token, ip });
      const r = await supabaseAuth("token?grant_type=password", { body: { email: user.email, password }, ip });
      return isTokens(r.data) ? signedIn(r.data) : reply({ account: null });
    }

    case "session": {
      if (tooMany(`session:${ip}`, 20, 60 * MIN)) return reply({ error: TOO_MANY }, 429);
      note(`session:${ip}`);
      const t = { access_token: body.access_token, refresh_token: body.refresh_token, expires_in: Number(body.expires_in) || 3600 };
      if (!isTokens(t)) return reply({ error: EXPIRED }, 400);
      if (!(await userFromToken(t.access_token))) return reply({ error: EXPIRED }, 401);
      return signedIn(t);
    }

    case "refresh": {
      // Normally proxy.ts renews the session by itself; this is the manual way.
      const refresh = readCookie(request, REFRESH);
      const r = refresh ? await supabaseAuth("token?grant_type=refresh_token", { body: { refresh_token: refresh }, ip }) : null;
      if (!r || !isTokens(r.data)) {
        const res = reply({ account: null }, 401);
        clearSession(res);
        return res;
      }
      return signedIn(r.data);
    }
  }
  return reply({ error: "Not found." }, 404);
}

// ── helpers ──────────────────────────────────────────────────────────────────

const EXPIRED = "This link has expired or was already used. Ask for a new one.";
const LEAKED = "That password has appeared in a data leak on another site, so it's easy to guess. Please pick a different one.";

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** Session cookies + the account, for the page to show. */
async function signedIn(t: Record<string, unknown> & { access_token: string; refresh_token: string; expires_in: number }) {
  const res = reply({ account: await userFromToken(t.access_token) });
  setSession(res, t);
  return res;
}

/** Checks for a new account or a new password; null when fine. */
function checkNew(name: string, email: string, password: string, signup: boolean) {
  if (signup && (name.length < 2 || name.length > 40)) return "Please enter your name (2–40 characters).";
  if (!EMAIL.test(email) || email.length > 254) return "That email doesn't look right.";
  if (password.length < 8) return "Use a password of at least 8 characters.";
  // Supabase hashes passwords with bcrypt, which only reads the first 72 bytes.
  if (new TextEncoder().encode(password).length > 72) return "Use a password of at most 72 characters.";
  return null;
}

/**
 * Has this password shown up in a known data leak? HaveIBeenPwned's free
 * k-anonymity check: only the first 5 characters of the password's SHA-1
 * hash leave our server, never the password. If the check can't be reached,
 * the password is allowed (it's an extra guard, not the lock).
 */
async function isLeakedPassword(password: string) {
  try {
    const bytes = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hash = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const rest = hash.slice(5);
    return (await res.text()).split("\n").some((line) => {
      const [suffix, count] = line.trim().split(":");
      return suffix === rest && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

/** Supabase error messages, said in plain words. */
function friendly(message: string, status: number) {
  const m = message.toLowerCase();
  if (status === 429 || m.includes("rate limit") || m.includes("too many")) return TOO_MANY;
  if (m.includes("invalid login") || m.includes("invalid_credentials") || m.includes("invalid_grant")) return "Wrong email or password.";
  if (m.includes("already registered") || m.includes("already been registered")) return "There's already an account with that email. Sign in instead.";
  if (m.includes("email not confirmed")) return "Confirm your email first (check your inbox), then sign in.";
  if (m.includes("same_password") || m.includes("different from the old")) return "Pick a password different from your old one.";
  if (m.includes("password")) return message; // Supabase's own password rule message is clear
  if (status === 0) return "Couldn't reach the sign-in service. Please try again.";
  return "Couldn't sign you in. Please try again.";
}
