"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SIGN-IN PAGE — /login
//
// Its own page, separate from the landing page. Shows the sign-in card
// (app/LoginCard.tsx): name, role, cursor color and room. Signing in saves
// that in this browser and opens the room.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoginCard } from "../LoginCard";
import { loadIdentity, UserIdentity } from "@/lib/user";

export default function LoginPage() {
  const router = useRouter();

  // Who's signed in on this browser (read after load, since localStorage
  // doesn't exist on the server). undefined = still checking.
  const [identity, setIdentity] = useState<UserIdentity | null | undefined>(undefined);
  useEffect(() => setIdentity(loadIdentity()), []);

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="font-heading text-lg font-semibold tracking-tight text-ink">
        <Image src="/logo-2d.png" alt="" width={28} height={28} className="mr-2 inline-block align-middle" />
        Wireframe<span className="text-accent-bright">·</span>Studio
      </Link>

      {/* Wait until we know if someone is signed in, so the form doesn't
          flash empty and then fill itself. */}
      {identity !== undefined && (
        <LoginCard initial={identity} onDone={(room) => router.push(`/room/${room}`)} />
      )}

      <Link href="/" className="font-mono text-[11px] uppercase tracking-widest text-muted hover:text-ink">
        ← Back to home
      </Link>
    </main>
  );
}
