"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY GATE — shown when someone opens a room link without signing in.
// It's the same sign-in card as the landing page (app/LoginCard.tsx), with
// the room already filled in.
// ─────────────────────────────────────────────────────────────────────────────

import { LoginCard } from "@/app/LoginCard";

export function IdentityGate({ roomId, onJoin }: { roomId: string; onJoin: () => void }) {
  return (
    <div className="dot-grid flex h-screen w-screen items-center justify-center p-6">
      <LoginCard roomId={roomId} onDone={onJoin} />
    </div>
  );
}
