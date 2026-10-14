"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ROOM BAR — what the top bar shows inside a board: the board's name, then
//   • Share → copy the board's link
// Decisions show as the "Clashes in the last run" card in the agent panel
// (the full log is still saved: /api/decisions, DecisionLog.tsx).
// Roles (Owner / Editor / Viewer) and the member list come in the next step.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useParams } from "next/navigation";
import { TopBar, BarButton } from "../../TopBar";

export function RoomBar() {
  const { roomId } = useParams<{ roomId: string }>();
  const [copied, setCopied] = useState(false);

  async function share() {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link:", link);
    }
  }

  return (
    <TopBar>
      <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
      <h1 className="min-w-0 truncate font-mono text-xs text-ink" title={roomId}>
        {roomId}
      </h1>
      <span className="flex-1" />
      <BarButton icon={<LinkIcon />} label={copied ? "Link copied ✓" : "Share"} strong onClick={share} />
    </TopBar>
  );
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" strokeLinecap="round" />
    </svg>
  );
}
