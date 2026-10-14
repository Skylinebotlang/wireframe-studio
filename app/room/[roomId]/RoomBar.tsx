"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ROOM BAR — what the top bar shows inside a board:
//   • the board's name and YOUR role on it (Owner / Editor / Viewer)
//   • Team  → everyone who has opened the board, with their role. Owners get
//             a dropdown to change roles; everyone else just sees them.
//   • Share → copy the board's link (new people join as viewers)
// Decisions show as the "Clashes in the last run" card in the agent panel.
// Roles are decided and enforced on the server (lib/boards-db.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar, BarButton } from "../../TopBar";
import type { useBoardTeam } from "@/lib/board-role";
import type { Role } from "@/lib/boards-db";

type Team = ReturnType<typeof useBoardTeam>;
const LABEL: Record<Role, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

export function RoomBar({ team, myId, colorOf }: { team: Team; myId: string; colorOf: (name: string) => string }) {
  const { roomId } = useParams<{ roomId: string }>();
  const [copied, setCopied] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

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
      {team.me && (
        <span className="shrink-0 rounded-full border border-accent-bright/60 px-2 py-0.5 text-[11px] text-wine-light">
          {LABEL[team.me]}
        </span>
      )}
      <span className="flex-1" />
      <div className="relative">
        <BarButton icon={<PeopleIcon />} label="Team" active={showTeam} onClick={() => setShowTeam((s) => !s)} />
        {showTeam && <TeamPopup team={team} myId={myId} colorOf={colorOf} onClose={() => setShowTeam(false)} />}
      </div>
      <BarButton icon={<LinkIcon />} label={copied ? "Link copied ✓" : "Share"} strong onClick={share} />
    </TopBar>
  );
}

function TeamPopup({ team, myId, colorOf, onClose }: { team: Team; myId: string; colorOf: (n: string) => string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const owner = team.me === "owner";

  // Close on Escape or a click outside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onClick = (e: MouseEvent) => !box.current?.parentElement?.contains(e.target as Node) && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  async function change(userId: string, role: Role) {
    setError("");
    const problem = await team.setRole(userId, role);
    if (problem) setError(problem);
  }

  return (
    <div ref={box} className="glass pop-in absolute right-0 top-10 z-[1000] w-72 rounded-xl p-3 text-sm">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">People on this board</p>
      <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
        {team.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium uppercase text-paper"
              style={{ backgroundColor: colorOf(m.name) }}
              aria-hidden
            >
              {m.name.charAt(0)}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">
              {m.name}
              {m.userId === myId && <span className="text-muted"> (you)</span>}
            </span>
            {owner ? (
              <select
                aria-label={`Role for ${m.name}`}
                value={m.role}
                onChange={(e) => change(m.userId, e.target.value as Role)}
                className="rounded-md border border-line bg-raised px-1.5 py-1 text-xs text-ink"
              >
                {(Object.keys(LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {LABEL[r]}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted">{LABEL[m.role]}</span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-wine-light">{error}</p>}
      <p className="mt-3 border-t border-line pt-2 text-xs leading-relaxed text-muted">
        New people who open the link join as viewers.
        {owner ? " Changes apply next time they open the board." : " Only owners can change roles."}
      </p>
    </div>
  );
}

function PeopleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M21 21v-1a6 6 0 0 0-4-5.6" strokeLinecap="round" />
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
