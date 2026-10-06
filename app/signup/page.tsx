"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SIGN-UP PAGE — /signup. The registration card (app/AccountForm.tsx in
// "signup" mode): name, email, password. DEMO MODE: interactive, nothing is
// saved anywhere yet (real OAuth comes later). On success it continues to
// /login's "Who's drawing?" step with the name filled in.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AccountForm } from "../AccountForm";

export default function SignUpPage() {
  const router = useRouter();
  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="font-heading text-lg font-semibold tracking-tight text-ink">
        <Image src="/logo-2d.png" alt="" width={28} height={28} className="mr-2 inline-block align-middle" />
        Wireframe<span className="text-accent-bright">·</span>Studio
      </Link>
      <AccountForm mode="signup" onDone={() => router.push("/login")} />
      <Link href="/" className="font-mono text-[11px] uppercase tracking-widest text-muted hover:text-ink">
        ← Back to home
      </Link>
    </main>
  );
}
