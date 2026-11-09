"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD — /reset-password. The page the "reset your password" email
// links to. The link carries a one-time pass in the address (after "#",
// never sent to any server by the browser). We read it, wipe it from the
// address bar, and send it with the new password to our server
// (app/api/auth reset), which saves the password, ends every session
// (so the link can't be used again) and signs you in fresh.
// No pass in the link (expired or already used) → ask for a new link.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/auth/AccountForm";
import { authCall } from "@/lib/auth";

export default function ResetPasswordPage() {
  // undefined = still reading the link; null = no usable pass in it.
  const [link, setLink] = useState<{ token: string; email: string } | null | undefined>(undefined);
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    history.replaceState(null, "", window.location.pathname); // don't leave the pass in the address bar or history
    const token = p.get("type") === "recovery" ? p.get("access_token") : null;
    let email = "";
    try {
      email = JSON.parse(atob((token ?? "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).email ?? ""; // display only
    } catch {}
    // Reading the address happens once, after the page appears in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLink(token ? { token, email } : null);
  }, []);
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
    const result = await authCall("reset", { token: link?.token, password });
    setPending(false);
    if (result.error) return setError(result.error);
    router.push(result.account ? "/boards" : "/login");
  }

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="glass pop-in w-full max-w-sm rounded-xl p-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Reset password</p>
        <h1 className="neon-text mt-1 font-heading text-2xl text-ink">Pick a new password</h1>

        {link === undefined && <p className="mt-5 text-sm text-muted">Checking your link…</p>}

        {link === null && (
          <p className="mt-5 text-sm leading-relaxed text-ink">
            This link has expired or was already used.{" "}
            <Link href="/forgot-password" className="underline underline-offset-4">
              Send a new one
            </Link>
            .
          </p>
        )}

        {link && (
          <form onSubmit={submit} noValidate>
            {link.email && <p className="mt-2 text-sm text-muted">For {link.email}</p>}
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
