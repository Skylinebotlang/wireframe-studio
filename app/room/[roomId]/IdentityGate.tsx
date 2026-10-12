"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY GATE — shown when a signed-in person opens a room before picking
// their role and cursor color. Same card as the login page
// (app/LoginCard.tsx), with the room and account already filled in.
// ─────────────────────────────────────────────────────────────────────────────

import { LoginCard } from "@/app/LoginCard";

export function IdentityGate({
  roomId,
  userId,
  accountName,
  onJoin,
}: {
  roomId: string;
  userId?: string;
  accountName?: string;
  onJoin: () => void;
}) {
  return (
    <div className="dot-grid flex h-screen w-screen items-center justify-center p-6">
      <LoginCard
        roomId={roomId}
        userId={userId}
        initial={accountName ? { id: userId ?? "", name: accountName, role: "PM", color: "" } : null}
        onDone={onJoin}
      />
    </div>
  );
}
