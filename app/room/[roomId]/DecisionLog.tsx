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
// Colors: orange label = the agent decided; wine = a person decided.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useRoom } from "@liveblocks/react/suspense";
import { authHeader } from "@/lib/auth";
import type { Decision } from "@/lib/decisions-db";

export function DecisionLog({ trigger }: { trigger: string }) {
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

  // Each decision is a card: who decided (badge) + when, the clash in quiet
  // text, the outcome in bright text, and the screens it touched as chips.
  return (
    <div>
      {error && <p className="text-xs text-wine-light">{error}</p>}
      {decisions === null && !error && <p className="py-6 text-center text-xs text-muted">Loading…</p>}
      {decisions?.length === 0 && (
        <p className="py-6 text-center text-xs leading-relaxed text-muted">
          No decisions yet. When teammates&apos; notes clash, how it was settled shows up here.
        </p>
      )}
      <ol className="space-y-2">
        {decisions?.map((d) => {
          const byAgent = d.decidedBy === "Agent" && d.kind === "merge";
          return (
            <li key={d.id} className="rounded-xl border border-line bg-raised/60 p-3 text-xs">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                    byAgent ? "bg-agent/15 text-agent" : "bg-accent/50 text-ink"
                  }`}
                >
                  {byAgent ? "Agent merged" : `${d.decidedBy} chose`}
                </span>
                <time className="font-mono text-[10px] text-muted">
                  {new Date(d.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
              <p className="leading-relaxed text-muted">{d.summary}</p>
              <p className="mt-1.5 border-l-2 border-accent-bright/60 pl-2 leading-relaxed text-ink">{d.decision}</p>
              {d.screens.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {d.screens.map((s) => (
                    <span key={s} className="rounded-md bg-paper/70 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
