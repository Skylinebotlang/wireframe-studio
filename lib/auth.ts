"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SIGN-IN (browser side) — real accounts (Supabase Auth), email + password,
// all through our own server (app/api/auth).
//
//   useAccount()        → who's signed in: undefined (checking), null (nobody)
//                         or { id, email, name }
//   authCall(action, body) → sign in / sign up / sign out / forgot / reset;
//                         returns { account?, confirm?, error? }
//
// The session lives in HttpOnly cookies (lib/server/session.ts): this page's
// JavaScript can't read or steal it, and the browser sends it with our own
// /api calls by itself. Nothing about the session is kept in localStorage.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

export type Account = { id: string; email: string; name: string };

// Tells other tabs "sign-in changed, check again".
const CHANNEL = "ws-auth";

/** Who's signed in. Updates on sign-in / sign-out (also in other tabs). */
export function useAccount(): Account | null | undefined {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const check = () =>
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => live && setAccount(d?.account ?? null))
        .catch(() => live && setAccount(null));
    check();
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = check;
    window.addEventListener(CHANNEL, check);
    return () => {
      live = false;
      channel.close();
      window.removeEventListener(CHANNEL, check);
    };
  }, []);
  return account;
}

export type AuthResult = { account?: Account | null; confirm?: boolean; ok?: boolean; error?: string };

/** One sign-in step on our server. Tells every tab (this one too) to re-check. */
export async function authCall(action: "signin" | "signup" | "signout" | "forgot" | "reset" | "session", body: object = {}): Promise<AuthResult> {
  const res = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data: AuthResult = (await res?.json().catch(() => null)) ?? {};
  if (!res) return { error: "Couldn't reach the server. Check your connection and try again." };
  if (!res.ok) return { error: data.error ?? "Something went wrong. Please try again." };
  if (action !== "forgot") {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("changed");
    channel.close();
    window.dispatchEvent(new Event(CHANNEL));
  }
  return data;
}
