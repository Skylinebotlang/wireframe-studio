"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SIGN-IN PAGE — /login. Two steps:
//   1. Email + password (app/AccountForm.tsx, DEMO MODE: interactive, but
//      no real account check yet — a friend is adding OAuth).
//   2. "Who's drawing?" (app/login/LoginIdentity.tsx): role, cursor color,
//      room — with the name from step 1 filled in.
// Coming back in the same tab after step 1 goes straight to step 2.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ACCOUNT_KEY, AccountForm } from "../AccountForm";
import { LoginIdentity } from "./LoginIdentity";

export default function LoginPage() {
  // undefined = still checking; null = not signed in; string = name.
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const read = () => {
    try {
      setAccount(sessionStorage.getItem(ACCOUNT_KEY));
    } catch {
      setAccount(null);
    }
  };
  useEffect(() => {
    const id = requestAnimationFrame(read); // sessionStorage exists only after load
    return () => cancelAnimationFrame(id);
  }, []);

  function signOut() {
    try {
      sessionStorage.removeItem(ACCOUNT_KEY);
    } catch {}
    setAccount(null);
  }

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="font-heading text-lg font-semibold tracking-tight text-ink">
        <Image src="/logo-2d.png" alt="" width={28} height={28} className="mr-2 inline-block align-middle" />
        Wireframe<span className="text-accent-bright">·</span>Studio
      </Link>

      {account === null && <AccountForm mode="signin" onDone={read} />}
      {account && <LoginIdentity accountName={account} />}

      <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-widest text-muted">
        <Link href="/" className="hover:text-ink">
          ← Back to home
        </Link>
        {account && (
          <button type="button" onClick={signOut} className="uppercase tracking-widest hover:text-ink">
            Sign out
          </button>
        )}
      </div>
    </main>
  );
}
