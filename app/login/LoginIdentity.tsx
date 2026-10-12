"use client";

// ─────────────────────────────────────────────────────────────────────────────
// "WHO'S DRAWING?" STEP — the second half of /login (app/login/page.tsx).
//
// Shows the card from app/LoginCard.tsx: name, role, cursor color and room.
// It saves that in this browser and opens the room (or /boards when no
// room was typed). If the person has an
// account, their account name is filled in for them (`accountName`).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoginCard } from "../LoginCard";
import { loadIdentity, UserIdentity } from "@/lib/user";
import { PEOPLE_COLORS, ROLES } from "@/lib/theme";

export function LoginIdentity({ accountName, accountId }: { accountName?: string; accountId?: string }) {
  const router = useRouter();

  // Who's signed in on this browser (read after load, since localStorage
  // doesn't exist on the server). undefined = still checking.
  const [identity, setIdentity] = useState<UserIdentity | null | undefined>(undefined);
  useEffect(() => {
    const saved = loadIdentity();
    // An account name wins over an older name saved in this browser.
    // (Set on the next frame: localStorage only exists after the page loads.)
    const id = requestAnimationFrame(() =>
      setIdentity(accountName ? { ...(saved ?? { id: "", role: ROLES[0], color: PEOPLE_COLORS[0] }), name: accountName } : saved),
    );
    return () => cancelAnimationFrame(id);
  }, [accountName]);

  return (
    <main className="dot-grid flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="font-heading text-lg font-semibold tracking-tight text-ink">
        <Image src="/logo-2d.png" alt="" width={28} height={28} className="mr-2 inline-block align-middle" />
        Wireframe<span className="text-accent-bright">·</span>Studio
      </Link>

      {/* Wait until we know if someone is signed in, so the form doesn't
          flash empty and then fill itself. */}
      {identity !== undefined && (
        <LoginCard initial={identity} userId={accountId} onDone={(room) => router.push(room ? `/room/${room}` : nextPage())} />
      )}

      <Link href="/" className="font-mono text-[11px] uppercase tracking-widest text-muted hover:text-ink">
        ← Back to home
      </Link>
    </main>
  );
}

// Where to go after login: the page that sent you here (?next=/room/…), or
// your boards. Only our own /room and /boards pages are allowed.
function nextPage() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return /^\/(room\/[A-Za-z0-9_-]{1,64}|boards)$/.test(next) ? next : "/boards";
}
