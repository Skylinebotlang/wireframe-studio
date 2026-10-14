"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD — /reset-password. The page the "reset your password" email
// links to. Supabase reads the link and signs the person in for this one
// purpose; they type a new password and go to their boards.
// No sign-in from the link (expired or already used) → ask for a new link.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "../AccountForm";
import { friendlyAuthError, supabase, useAccount } from "@/lib/auth";

export default function ResetPasswordPage() {
  const account = useAccount(); // undefined = still reading the link
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (password !== String(f.get("again") ?? "")) return setError("The two passwords don't match.");
    setError("");
    setPending(true);
    const { error: failed } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (failed) return setError(friendlyAuthError(failed.message));
    router.push("/boards");
  }

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="glass pop-in w-full max-w-sm rounded-xl p-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Reset password</p>
        <h1 className="neon-text mt-1 font-heading text-2xl text-ink">Pick a new password</h1>

        {account === undefined && <p className="mt-5 text-sm text-muted">Checking your link…</p>}

        {account === null && (
          <p className="mt-5 text-sm leading-relaxed text-ink">
            This link has expired or was already used.{" "}
            <Link href="/forgot-password" className="underline underline-offset-4">
              Send a new one
            </Link>
            .
          </p>
        )}

        {account && (
          <form onSubmit={submit} noValidate>
            <p className="mt-2 text-sm text-muted">For {account.email}</p>
            <div className="mt-5 space-y-4">
              <Field label="New password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" />
              <Field label="Type it again" name="again" type="password" autoComplete="new-password" />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="mt-6 w-full rounded-md bg-accent py-3 font-medium text-ink shadow-[0_0_18px_-4px_var(--accent-bright)] transition hover:brightness-125 active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? "One moment…" : "Save new password →"}
            </button>
            <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-center text-xs text-accent-bright">
              {error}
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
