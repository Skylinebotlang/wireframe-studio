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

  return (
    <section>
      <h3 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">
        Decisions{decisions ? ` (${decisions.length})` : ""}
      </h3>
      {error && <p className="text-xs text-accent-bright">{error}</p>}
      {decisions === null && !error && <p className="text-xs text-muted">Loading…</p>}
      {decisions?.length === 0 && (
        <p className="text-xs text-muted">No decisions yet. When teammates&apos; notes clash, how it was settled shows up here.</p>
      )}
      <ol className="space-y-2">
        {decisions?.map((d) => (
          <li key={d.id} className="rounded-md border border-line bg-raised p-2.5 text-xs leading-relaxed">
            <p className="text-muted">{d.summary}</p>
            <p className="mt-1 text-ink">→ {d.decision}</p>
            <p className="mt-1.5 font-mono text-[11px] text-muted">
              <span className={d.decidedBy === "Agent" && d.kind === "merge" ? "text-agent" : "text-accent-bright"}>
                {d.kind === "merge" ? "Agent merged" : `${d.decidedBy} chose`}
              </span>
              {" · "}
              {new Date(d.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              {d.screens.length > 0 && ` · ${d.screens.join(", ")}`}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
