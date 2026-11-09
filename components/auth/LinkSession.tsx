"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL LINK SIGN-IN — on every page. When someone opens the "confirm your
// email" link, Supabase sends them back with a session in the address (after
// "#"). This hands it to our server, which keeps it as HttpOnly cookies
// (app/api/auth session), wipes it from the address bar and opens their
// boards. A password reset link is passed on to /reset-password instead.
//
// It also deletes sign-in tokens the OLD version of the app kept in
// localStorage ("sb-…-auth-token"), so none are left lying around.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authCall } from "@/lib/auth";

export function LinkSession() {
  const router = useRouter();
  useEffect(() => {
    try {
      for (const key of Object.keys(localStorage)) if (/^sb-.*-auth-token/.test(key)) localStorage.removeItem(key);
    } catch {}

    const p = new URLSearchParams(window.location.hash.slice(1));
    const access_token = p.get("access_token");
    if (!access_token) return;
    if (p.get("type") === "recovery") {
      if (window.location.pathname !== "/reset-password") router.replace(`/reset-password${window.location.hash}`);
      return;
    }
    history.replaceState(null, "", window.location.pathname + window.location.search);
    authCall("session", { access_token, refresh_token: p.get("refresh_token"), expires_in: p.get("expires_in") }).then((r) => {
      if (r.account) router.replace("/boards");
    });
  }, [router]);
  return null;
}
