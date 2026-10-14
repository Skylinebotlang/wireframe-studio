"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ROOM PAGE — the screen at /room/<anything>.
//
// Flow: must be signed in (else → /login, then back here) → if this account
// hasn't picked a name/color yet, show the join screen → connect to
// Liveblocks (<Room>) and render the canvas.
// Opening a room also adds it to this person's /boards list.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Room } from "./Room";
import { TldrawApp } from "./TldrawApp";
import { IdentityGate } from "./IdentityGate";
import { loadIdentity, UserIdentity } from "@/lib/user";
import { authHeader, useAccount } from "@/lib/auth";

export default function RoomPage() {
  // The [roomId] part of the URL, e.g. "demo" in /room/demo.
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;

  const router = useRouter();
  const account = useAccount();

  // null = still checking; false = this account has no name/color yet.
  const [identity, setIdentity] = useState<UserIdentity | null | false>(null);

  useEffect(() => {
    if (account === undefined) return; // still checking the sign-in
    if (!account) {
      router.replace(`/login?next=/room/${roomId}`);
      return;
    }
    // A saved identity only counts if it belongs to this account.
    const id = requestAnimationFrame(() => {
      const saved = loadIdentity();
      setIdentity(saved?.id === account.id ? saved : false);
    });
    return () => cancelAnimationFrame(id);
  }, [account, roomId, router]);

  // Add this room to "my boards" (fire and forget: the canvas works even if
  // the list can't be reached).
  const userId = identity ? identity.id : "";
  useEffect(() => {
    if (!userId) return;
    authHeader().then((auth) =>
      fetch("/api/boards", {
        method: "PUT",
        headers: { "content-type": "application/json", ...auth },
        body: JSON.stringify({ boardId: roomId }),
      }).catch(() => {})
    );
  }, [userId, roomId]);

  // Still deciding whether to show the join screen…
  if (identity === null) {
    return (
      <div className="dot-grid flex h-screen items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Loading…
        </p>
      </div>
    );
  }

  // First visit to this browser: show the "who are you?" screen.
  if (!identity) {
    return (
      <IdentityGate
        roomId={roomId}
        userId={account?.id}
        accountName={account?.name}
        onJoin={() => setIdentity(loadIdentity())}
      />
    );
  }

  // We know who this is: connect and draw.
  return (
    <Room roomId={roomId}>
      {/* The room name + "My boards" link sit in tldraw's top bar (TldrawApp). */}
      <TldrawApp identity={identity} />
    </Room>
  );
}
