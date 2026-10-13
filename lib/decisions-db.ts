// ─────────────────────────────────────────────────────────────────────────────
// DECISION LOG — save and read a board's design decisions. SERVER ONLY.
//
// A decision is saved when the agent merges a clash ("merge") or a person
// picks one teammate's version on a clash card ("pick"). Table:
// supabase/decisions.sql. Uses the same Supabase connection as the boards
// list (lib/boards-db.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { rest } from "./boards-db";

export type Decision = {
  id: string;
  kind: "merge" | "pick";
  summary: string; // what clashed
  decision: string; // what was decided
  decidedBy: string; // "Agent" or a person's name
  screens: string[];
  createdAt: string; // ISO time
};

export type NewDecision = {
  boardId: string;
  kind: "merge" | "pick";
  summary: string;
  decision: string;
  decidedBy: string;
  userId?: string;
  screens?: string[];
  runId?: string;
};

type Row = { id: string; kind: Decision["kind"]; summary: string; decision: string; decided_by: string; screens: string[]; created_at: string };

const cut = (s: string, n: number) => s.trim().slice(0, n);

/** Save decisions (silently skips empty ones). */
export async function addDecisions(list: NewDecision[]) {
  const rows = list
    .filter((d) => d.summary.trim() && d.decision.trim())
    .map((d) => ({
      board_id: d.boardId,
      kind: d.kind,
      summary: cut(d.summary, 500),
      decision: cut(d.decision, 1000),
      decided_by: cut(d.decidedBy, 80) || "Someone",
      user_id: d.userId ?? null,
      screens: (d.screens ?? []).slice(0, 20).map((s) => cut(s, 100)),
      run_id: d.runId ?? null,
    }));
  if (rows.length) await rest("decisions", { method: "POST", body: JSON.stringify(rows) });
}

/** A board's decisions, newest first. */
export async function listDecisions(boardId: string, limit = 50): Promise<Decision[]> {
  const rows: Row[] = await rest(
    `decisions?board_id=eq.${encodeURIComponent(boardId)}` +
      `&select=id,kind,summary,decision,decided_by,screens,created_at&order=created_at.desc&limit=${limit}`
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    summary: r.summary,
    decision: r.decision,
    decidedBy: r.decided_by,
    screens: r.screens,
    createdAt: r.created_at,
  }));
}

/** Past decisions as text for the agent's prompt ("" if none or unreachable). */
export async function decisionsForPrompt(boardId: string): Promise<string> {
  try {
    const list = await listDecisions(boardId, 15);
    if (!list.length) return "";
    const lines = list
      .reverse() // oldest first reads like a story
      .map((d) => `- [${d.kind === "pick" ? `${d.decidedBy} chose` : "Agent merged"}] ${d.summary} → ${d.decision}`);
    return `<past_decisions>\nThe team already settled these on this board (oldest first). Keep to them unless the new idea or notes clearly change one; if you do change one, say so in "resolution":\n${lines.join("\n")}\n</past_decisions>`;
  } catch (err) {
    console.error("Decisions: couldn't read past decisions:", err);
    return ""; // the agent still works without them
  }
}
