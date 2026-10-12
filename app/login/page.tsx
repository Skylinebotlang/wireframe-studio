"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SIGN-IN PAGE — /login. Two steps:
//   1. Email + password (app/AccountForm.tsx): a real Supabase account.
//   2. "Who's drawing?" (app/login/LoginIdentity.tsx): role, cursor color,
//      room — with the name from step 1 filled in.
// Already signed in (on this browser) → straight to step 2.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import Image from "next/image";
import { AccountForm } from "../AccountForm";
import { LoginIdentity } from "./LoginIdentity";
import { supabase, useAccount } from "@/lib/auth";

export default function LoginPage() {
  // undefined = still checking; null = not signed in; else the account.
  // (Updates by itself after signing in or out.)
  const account = useAccount();
  const signOut = () => supabase.auth.signOut();

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="font-heading text-lg font-semibold tracking-tight text-ink">
        <Image src="/logo-2d.png" alt="" width={28} height={28} className="mr-2 inline-block align-middle" />
        Wireframe<span className="text-accent-bright">·</span>Studio
      </Link>

      {account === null && <AccountForm mode="signin" onDone={() => {}} />}
      {account && <LoginIdentity accountName={account.name} accountId={account.id} />}

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
