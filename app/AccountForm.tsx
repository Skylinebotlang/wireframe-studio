"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT FORM — the sign-up / sign-in card. DEMO MODE for now.
//   • "signup" (on /signup): name, email, password
//   • "signin" (on /login):  email, password
//
// There is no real account system yet (a friend is building it with OAuth).
// So the form is fully interactive — it checks what you typed, shows a
// short "one moment…", then moves on to "Who's drawing?" — but nothing is
// sent anywhere and no password is stored. Only the name (or the part of
// the email before @) is kept in this tab, to fill in the next step.
//
// TO WIRE REAL AUTH: replace the body of `submit` below with the real
// sign-up / sign-in call; keep `rememberAccount(name)` + `onDone()`.
// Wine = people (no orange).
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useState } from "react";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ACCOUNT_KEY = "wireframe-studio-demo-account"; // sessionStorage

export function rememberAccount(name: string) {
  try {
    sessionStorage.setItem(ACCOUNT_KEY, name);
  } catch {}
}

export function AccountForm({ mode, onDone }: { mode: "signin" | "signup"; onDone: () => void }) {
  const signup = mode === "signup";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    if (signup && (name.length < 2 || name.length > 40)) return setError("Please enter your name (2–40 characters).");
    if (!EMAIL.test(email)) return setError("That email doesn't look right.");
    if (signup ? password.length < 8 : !password) return setError(signup ? "Use a password of at least 8 characters." : "Enter your password.");
    setError("");
    setPending(true);
    // Demo: pretend to talk to the server for a moment, then continue.
    setTimeout(() => {
      rememberAccount(signup ? name : email.split("@")[0]);
      onDone();
    }, 700);
  }

  return (
    <form onSubmit={submit} noValidate className="glass pop-in w-full max-w-sm rounded-xl p-6">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted">{signup ? "Sign up" : "Sign in"}</p>
      <h1 className="neon-text mt-1 font-heading text-2xl text-ink">{signup ? "Join Wireframe Studio" : "Welcome back"}</h1>

      <div className="mt-5 space-y-4">
        {signup && <Field label="Your name" name="name" autoComplete="name" placeholder="e.g. Asha" />}
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@team.com" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          placeholder={signup ? "At least 8 characters" : ""}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-md bg-accent py-3 font-medium text-ink shadow-[0_0_18px_-4px_var(--accent-bright)] transition hover:brightness-125 active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "One moment…" : signup ? "Create account →" : "Sign in →"}
      </button>

      <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-center text-xs text-accent-bright">
        {error}
      </p>

      <p className="mt-2 text-center font-mono text-[11px] text-muted">
        {signup ? "Already have an account? " : "New here? "}
        <Link href={signup ? "/login" : "/signup"} className="text-ink underline underline-offset-4">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

function Field({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-widest text-muted">{label}</span>
      <input
        {...input}
        className="mt-1.5 w-full rounded-md border border-line bg-raised px-3 py-2.5 text-ink outline-none placeholder:text-muted/60 focus:border-accent-bright"
      />
    </label>
  );
}
