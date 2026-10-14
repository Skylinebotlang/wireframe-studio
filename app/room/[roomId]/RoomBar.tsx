"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ROOM BAR — what the top bar shows inside a board: the board's name, then
//   • Decisions → the decision log, slid in from the right (it used to be a
//                 tab in the agent panel)
//   • Share     → copy the board's link
// Roles (Owner / Editor / Viewer) and the member list come in the next step.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar, BarButton } from "../../TopBar";
import { DecisionLog } from "./DecisionLog";

export function RoomBar({
  myName,
  colorOf,
  decisionsTrigger,
}: {
  myName: string;
  colorOf: (name: string) => string;
  decisionsTrigger: string; // changes after each run or pick, so the log reloads
}) {
  const { roomId } = useParams<{ roomId: string }>();
  const [showDecisions, setShowDecisions] = useState(false);
  const [copied, setCopied] = useState(false);

  // Escape closes the decisions panel.
  useEffect(() => {
    if (!showDecisions) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowDecisions(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDecisions]);

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
    <>
      <TopBar>
        <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
        <h1 className="min-w-0 truncate font-mono text-xs text-ink" title={roomId}>
          {roomId}
        </h1>
        <span className="flex-1" />
        <BarButton
          icon={<ListIcon />}
          label="Decisions"
          active={showDecisions}
          onClick={() => setShowDecisions((s) => !s)}
        />
        <BarButton icon={<LinkIcon />} label={copied ? "Link copied ✓" : "Share"} strong onClick={share} />
      </TopBar>

      {showDecisions && (
        <aside
          aria-label="Decisions"
          className="pop-in absolute right-0 top-11 z-[600] flex h-[calc(100%-2.75rem)] w-[360px] max-w-full flex-col border-l border-line bg-surface shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-heading text-sm tracking-wide text-ink">Decisions</h2>
            <button
              type="button"
              onClick={() => setShowDecisions(false)}
              aria-label="Close decisions"
              className="rounded-md px-2 py-1 text-muted hover:bg-raised hover:text-ink"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            <DecisionLog myName={myName} colorOf={colorOf} trigger={decisionsTrigger} />
          </div>
        </aside>
      )}
    </>
  );
}

function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M9 6h11M9 12h11M9 18h11M4 6l.01 0M4 12l.01 0M4 18l.01 0" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" strokeLinecap="round" />
    </svg>
  );
}
