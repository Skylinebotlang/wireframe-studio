"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SIGN-IN (browser side) — real accounts with Supabase Auth, email + password.
//
//   supabase            → the one Supabase client for this browser tab
//   useAccount()        → who's signed in: undefined (checking), null (nobody)
//                         or { id, email, name }
//   authHeader()        → { authorization: "Bearer <token>" } for our own
//                         /api routes, which check it (lib/auth-server.ts)
//
// Supabase keeps the session in this browser and refreshes it by itself.
// Uses the PUBLISHABLE key, which is meant to be public: it can sign people
// in, but it can't read our tables (those are locked to the server).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
);

export type Account = { id: string; email: string; name: string };

type SupabaseUser = { id: string; email?: string; user_metadata?: { name?: string } };
const toAccount = (u: SupabaseUser): Account => ({
  id: u.id,
  email: u.email ?? "",
  name: u.user_metadata?.name || (u.email ?? "").split("@")[0],
});

/** Who's signed in. Updates on sign-in / sign-out (also in other tabs). */
export function useAccount(): Account | null | undefined {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  useEffect(() => {
    let answered = false;
    const answer = (session: { user: SupabaseUser } | null) => {
      answered = true;
      setAccount(session ? toAccount(session.user) : null);
    };
    supabase.auth
      .getSession()
      .then(({ data }) => answer(data.session))
      .catch(() => answer(null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => answer(session));
    // Renewing an expired sign-in can hang (e.g. another tab holds the lock).
    // Never leave the page blank: after 6s, treat it as signed out, so the
    // sign-in form shows. Signing in again fixes the session.
    const giveUp = setTimeout(() => {
      if (!answered) {
        console.warn("Sign-in check timed out; showing the sign-in form.");
        setAccount(null);
      }
    }, 6000);
    return () => {
      clearTimeout(giveUp);
      data.subscription.unsubscribe();
    };
  }, []);
  return account;
}

/** The signed-in person's token, for calls to our own /api routes. */
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { authorization: `Bearer ${data.session.access_token}` } : {};
}

/**
 * Has this password shown up in a known data leak? Our own version of
 * Supabase's paid "leaked password protection". Uses HaveIBeenPwned's free
 * k-anonymity check: only the first 5 characters of the password's SHA-1
 * hash leave this browser, never the password. If the check can't be reached,
 * we let the password through (it's an extra guard, not the lock).
 * ponytail: runs in the browser, so someone calling Supabase directly can skip
 * it; switch on Supabase's own check (Pro plan) for a server-side guarantee.
 */
export async function isLeakedPassword(password: string): Promise<boolean> {
  try {
    const bytes = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hash = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
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

export const LEAKED_PASSWORD_MESSAGE =
  "That password has appeared in a data leak on another site, so it's easy to guess. Please pick a different one.";

// Supabase error messages, said in plain words.
export function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password.";
  if (m.includes("already registered") || m.includes("already been registered")) return "There's already an account with that email. Sign in instead.";
  if (m.includes("email not confirmed")) return "Confirm your email first (check your inbox), then sign in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Wait a minute and try again.";
  if (m.includes("password")) return message; // Supabase's own password rule message is clear
  return "Couldn't sign you in. Please try again.";
}
