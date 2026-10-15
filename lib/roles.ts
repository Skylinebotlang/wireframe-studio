// ─────────────────────────────────────────────────────────────────────────────
// BOARD ROLES — who may do what on a board. Plain data + two rules, shared by
// the server (lib/boards-db.ts, the API routes) and the screen (TldrawApp,
// AgentPanel, RoomBar), so both always agree.
//
//   owner        everything, plus people (roles, hand over) and delete.
//                Exactly one per board (supabase/boards.sql).
//   editor       draw, add notes, pick clash winners, run the AI
//   contributor  draw, add notes, pick clash winners; NOT the AI (agent,
//                Make it real), so the AI limits stay with the drivers
//   viewer       watch only. New visitors join as viewers.
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = ["owner", "editor", "contributor", "viewer"] as const; // most to least
export type Role = (typeof ROLES)[number];

/** May this person change the canvas (draw, notes, clash picks)? */
export const canEdit = (role: Role | null) => role === "owner" || role === "editor" || role === "contributor";

/** May this person use the AI (run the agent, Make it real, Retry, Pause / Take over)? */
export const canUseAI = (role: Role | null) => role === "owner" || role === "editor";
