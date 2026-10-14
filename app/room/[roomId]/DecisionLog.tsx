"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DECISION LOG — the "Decisions" list in the agent panel.
//
// Every design decision ever made on this board, newest first: clashes the
// agent merged, and "Use X's version" picks people made. Read from
// /api/decisions (Supabase, kept forever), unlike the activity feed which
// only keeps the last 100 lines.
//
// It reloads whenever the shared activity feed shows a finished run or a
// pick, so everyone in the room sees new decisions within a second or two.
// Colors: orange = the agent decided; wine = you; each teammate = their
// cursor color (useTeamColors in lib/agent-room.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useRoom } from "@liveblocks/react/suspense";
import { authHeader } from "@/lib/auth";
import type { Decision } from "@/lib/decisions-db";
export function DecisionLog({
  trigger,
  myName,
  colorOf,
}: {
  trigger: string;
  myName: string;
  colorOf: (name: string) => string;
}) {
  const boardId = useRoom().id;
  const [decisions, setDecisions] = useState<Decision[] | null>(null); // null = loading
  const [error, setError] = useState("");

  // `trigger` changes after each run or pick. Wait a moment so the server
  // has finished saving, then reload.
  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/decisions?boardId=${encodeURIComponent(boardId)}`, {
        headers: await authHeader(),
      }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (!current) return;
      if (!res?.ok) setError(data?.error ?? "Couldn't load the decisions.");
      else {
        setError("");
        setDecisions(data.decisions);
      }
    }, trigger ? 1200 : 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [boardId, trigger]);

  // Each decision leads with WHAT was decided (bright), then who and when,
  // then the clash it settled (quiet, 2 lines, click for more) and the
  // screens it touched. Grouped by day so a late joiner sees the history.
  return (
    <div>
      {error && <p className="text-xs text-wine-light">{error}</p>}
      {decisions === null && !error && (
        <div className="space-y-2" aria-label="Loading decisions">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-line bg-raised/40" />
          ))}
        </div>
      )}
      {decisions?.length === 0 && (
        <p className="py-6 text-center text-xs leading-relaxed text-muted">
          No decisions yet. When teammates&apos; notes clash, how it was settled shows up here.
        </p>
      )}
      <ol className="space-y-2">
        {decisions?.map((d, i, all) => {
          const byAgent = d.decidedBy === "Agent" && d.kind === "merge";
          const day = dayLabel(Date.parse(d.createdAt));
          const divider = i === 0 || dayLabel(Date.parse(all[i - 1].createdAt)) !== day;
          // A teammate's pick: their name and a faint border in their own color.
          const other = !byAgent && d.decidedBy !== myName ? colorOf(d.decidedBy) : undefined;
          return (
            <li key={d.id}>
              {divider && (
                <div className="mb-2 mt-1 flex items-center gap-2 text-[10px] text-muted">
                  <span className="h-px flex-1 bg-line" />
                  {day}
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <details
                className="group rounded-xl border border-line bg-raised/60 p-3 text-xs"
                style={other ? { borderColor: other + "4D" } : undefined}
              >
                <summary className="cursor-pointer list-none">
                  <p className="leading-relaxed text-ink">{d.decision}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                    <span className={byAgent ? "text-agent" : other ? "" : "text-wine-light"} style={other ? { color: other } : undefined}>
                      {byAgent ? "Agent merged" : d.decidedBy === myName ? "You chose" : `${d.decidedBy} chose`}
                    </span>
                    <span aria-hidden>·</span>
                    <time>{new Date(d.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                    <span className="ml-auto text-[10px] group-open:hidden">Why</span>
                  </p>
                </summary>
                <p className="mt-2 border-t border-line pt-2 leading-relaxed text-muted">
                  <span className="text-ink/70">The clash: </span>
                  {d.summary}
                </p>
                {d.screens.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.screens.map((s) => (
                      <span key={s} className="rounded-md bg-paper/70 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "Today", "Yesterday", or a short date like "Oct 12", for feed dividers. */
export function dayLabel(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
