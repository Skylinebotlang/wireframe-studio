"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — /forgot-password. Type your email; Supabase emails a
// link that opens /reset-password, where you pick a new password.
//
// We always say "check your email", even if no account uses that address,
// so this page can't be used to find out who has an account.
// Emails come from Supabase (or the email service set up in Supabase, e.g.
// Resend). No code change is needed to switch email service.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useState } from "react";
import { Field } from "../AccountForm";
import { friendlyAuthError, supabase } from "@/lib/auth";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!EMAIL.test(email)) return setError("That email doesn't look right.");
    setError("");
    setPending(true);
    const { error: failed } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    // Only "too many tries" is worth showing; anything else would hint whether the account exists.
    if (failed && /rate limit|too many/i.test(failed.message)) return setError(friendlyAuthError(failed.message));
    setSent(true);
  }

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <form onSubmit={submit} noValidate className="glass pop-in w-full max-w-sm rounded-xl p-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Forgot password</p>
        <h1 className="neon-text mt-1 font-heading text-2xl text-ink">Reset your password</h1>
        {sent ? (
          <p className="mt-5 text-sm leading-relaxed text-ink">
            If there&apos;s an account for that email, a reset link is on its way. Open it on this device. Check spam
            if it doesn&apos;t arrive in a few minutes.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">We&apos;ll email you a link to pick a new password.</p>
            <div className="mt-5">
              <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@team.com" />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="mt-6 w-full rounded-md bg-accent py-3 font-medium text-ink shadow-[0_0_18px_-4px_var(--accent-bright)] transition hover:brightness-125 active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? "One moment…" : "Send reset link →"}
            </button>
            <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-center text-xs text-accent-bright">
              {error}
            </p>
          </>
        )}
      </form>
      <Link href="/login" className="font-mono text-[11px] uppercase tracking-widest text-muted hover:text-ink">
        ← Back to sign in
      </Link>
    </main>
  );
}
