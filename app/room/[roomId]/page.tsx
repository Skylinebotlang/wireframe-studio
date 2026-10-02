"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ROOM PAGE — the screen at /room/<anything>.
//
// Flow: load saved identity → if none, show the join screen → once we know
// who you are, connect to Liveblocks (<Room>) and render the canvas.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Room } from "./Room";
import { TldrawApp } from "./TldrawApp";
import { IdentityGate } from "./IdentityGate";
import { loadIdentity, UserIdentity } from "@/lib/user";

export default function RoomPage() {
  // The [roomId] part of the URL, e.g. "demo" in /room/demo.
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;

  // null = still checking localStorage; false = no identity yet.
  const [identity, setIdentity] = useState<UserIdentity | null | false>(null);

  useEffect(() => {
    // loadIdentity() returns null when this browser has no saved identity.
    // We convert that to `false` so `null` keeps meaning "still checking".
    setIdentity(loadIdentity() ?? false);
  }, []);

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
        onJoin={() => setIdentity(loadIdentity())}
      />
    );
  }

  // We know who this is: connect and draw.
  return (
    <Room roomId={roomId}>
      <TldrawApp identity={identity} />
      {/* A small, fixed room label so you always know where you are. */}
      <div className="glass pointer-events-none fixed left-3 top-14 z-50 rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-muted backdrop-blur">
        Room: {roomId} ·{" "}
        <Link href="/" className="pointer-events-auto underline hover:text-ink">
          home
        </Link>
      </div>
    </Room>
  );
}
