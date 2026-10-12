// ─────────────────────────────────────────────────────────────────────────────
// AGENT PANEL DATA — the shapes saved in the Liveblocks room.
//
// Everything here is shared with everyone in the room, so it must never
// contain an API key. (Types only; the logic is in lib/agent-room.ts.)
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentResult } from "./agent-schema";

// Where the agent is at:
//   idle    → nothing running
//   working → a run is in progress
//   paused  → someone pressed Pause; a finished answer waits until Resume
//   done    → the last run finished and was drawn
//   error   → the last run failed (see `error`)
export type AgentStatus = "idle" | "working" | "paused" | "done" | "error";

export type StepState = "todo" | "working" | "done";

// One line of the agent's plan, e.g. { label: "Find clashes", state: "done" }.
export type PlanStep = { label: string; state: StepState };

export type AgentRunState = {
  status: AgentStatus;
  runId: string; // changes on every run, so a stale answer can be ignored
  startedBy: string; // display name, e.g. "papi"
  startedAt: number; // ms timestamp
  provider: string; // "Gemini" | "Claude" | "OpenAI" ("" until known)
  steps: PlanStep[];
  error: string; // friendly message when status is "error", else ""
  // The last finished answer (conflicts + merge explanation + screens), so
  // conflict cards and late joiners can show it. null until the first run.
  result: AgentResult | null;
  // An answer that arrived while paused. Drawn when someone presses Resume.
  pendingResult: AgentResult | null;
};

// What happened, for the activity feed.
export type ActivityKind =
  | "start" // someone started a run
  | "prompt" // someone typed an idea in the "Frame your idea" box (starts a run)
  | "steer" // older rooms only: the steer box this replaced
  | "pick" // someone picked one person's version on a conflict card
  | "question" // the agent wasn't sure and asked the room something
  | "result" // the agent finished ("Run by papi using Claude")
  | "error" // the agent failed
  | "pause"
  | "resume"
  | "takeover" // a human took over: the run was cancelled
  | "undo"; // someone undid the agent's last run

export type ActivityItem = {
  id: string;
  at: number; // ms timestamp
  who: string; // display name, or "Agent"
  kind: ActivityKind;
  text: string; // the line to show, e.g. "Run by papi using Claude"
};

// What the agent's last run changed on the canvas, so anyone can undo it.
// `created` = ids of the phone frames it drew. `removed` = the shapes it
// replaced on an "update" (frames + their boxes), saved as a JSON string
// of tldraw shapes so they can be put back exactly.
export type AgentUndo = {
  runId: string;
  by: string; // who started that run
  screens: number; // how many screens it drew, for the button label
  created: string[];
  removed: string;
};
