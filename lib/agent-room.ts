"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AGENT PANEL — shared state + actions, saved in the Liveblocks room.
//
// Everyone in the room reads the same agent run (plan, progress, last answer)
// and the same activity feed. Late joiners see it too, because it's saved
// in Liveblocks Storage rather than broadcast once.
//
// For the UI, the main entry point is `useAgentPanel(myName)`:
//   const agent = useAgentPanel(identity.name);
//   agent.run          → current run (status, steps, startedBy, provider, result…)
//   agent.activity     → activity feed lines, newest last
//   agent.runAgent(notes, draw)  → the whole "Send to agent" flow (reads notes)
//   agent.runAgent([], draw, idea, board) → "Frame your idea" box: runs on the typed idea
//   agent.pick(conflictSummary, noteAuthor) → conflict card "use X's version"
//   agent.pause() / agent.resume(draw) / agent.takeOver()
//   agent.undo  → what the last run changed (or null); agent.takeUndo()
//                 claims it for "Undo last agent run" (see TldrawApp)
//
// LIVE PROGRESS: runAgent asks the server to stream (see app/api/agent/
// route.ts). The plan ticks follow the agent's real progress, and each
// screen is drawn the moment it arrives. Pause holds screens until Resume;
// Take over stops the run and ignores anything still on its way.
//
// KEY SAFETY: the API key goes straight from this browser to our server in
// the request (aiKeyForRequest). It is never written into the room.
// ─────────────────────────────────────────────────────────────────────────────

import { LiveList, LiveObject } from "@liveblocks/client";
import { useMutation, useRoom, useStorage } from "@liveblocks/react/suspense";
import type { AgentAction, AgentNote, AgentResult, BoardScreen, Screen } from "./agent-schema";
import type { AgentRunInfo } from "./ai-providers";
import type { ActivityItem, ActivityKind, AgentRunState, AgentUndo, PlanStep } from "./agent-room-types";
import type { DrawRecord } from "./draw-wireframes";
import { aiKeyForRequest } from "./byok";
import { authHeader } from "./auth";

// Keep the feed from growing forever.
const MAX_ACTIVITY = 100;

// The agent's plan, shown as a checklist.
const PLAN = ["Read every note", "Spot clashes", "Merge ideas", "Design screens", "Draw on canvas"];
const plan = (doneUpTo: number, workingUpTo = doneUpTo): PlanStep[] =>
  PLAN.map((label, i) => ({
    label,
    state: i < doneUpTo ? "done" : i < workingUpTo ? "working" : "todo",
  }));

const IDLE_RUN: AgentRunState = {
  status: "idle",
  runId: "",
  startedBy: "",
  startedAt: 0,
  provider: "",
  steps: plan(0),
  error: "",
  result: null,
  pendingResult: null,
};

/** Pass to <RoomProvider initialStorage={...}> so new rooms start empty. */
export function createInitialAgentStorage() {
  return {
    agentRun: new LiveObject<AgentRunState>(IDLE_RUN),
    activity: new LiveList<ActivityItem>([]),
    agentUndo: null,
  };
}

// Add one line to the shared feed (used inside mutations).
function log(activity: LiveList<ActivityItem>, who: string, kind: ActivityKind, text: string) {
  activity.push({ id: crypto.randomUUID(), at: Date.now(), who, kind, text });
  while (activity.length > MAX_ACTIVITY) activity.delete(0);
}

export function useAgentPanel(myName: string) {
  const run = useStorage((root) => root.agentRun);
  const activity = useStorage((root) => root.activity);
  const undo = useStorage((root) => root.agentUndo ?? null);
  const roomId = useRoom().id; // the server rate-limits runs per room

  // ── Start: claim the agent for this run. Returns the new run id plus the
  // steering lines typed since the previous run, or null if it's busy.
  // `idea` is set when the run came from the "Frame your idea" box.
  const start = useMutation(
    ({ storage }, idea: string): { runId: string; steering: string[]; history: string[] } | null => {
      const agentRun = storage.get("agentRun");
      const feed = storage.get("activity");
      const status = agentRun.get("status");
      if (status === "working" || status === "paused") return null;

      // Steering typed after the previous run started goes into this run.
      const since = agentRun.get("startedAt");
      const steering = feed
        .filter((a) => (a.kind === "steer" || a.kind === "pick") && a.at >= since)
        .map((a) => `${a.who}: ${a.text}`);

      // Recent ideas and agent questions, so the agent can follow the chat
      // (e.g. read "the Home one" as an answer to its last question).
      const history = feed
        .filter((a) => a.kind === "prompt" || a.kind === "question")
        .slice(-8)
        .map((a) => `${a.who}: ${a.text}`);

      const runId = crypto.randomUUID();
      agentRun.update({
        status: "working",
        runId,
        startedBy: myName,
        startedAt: Date.now(),
        provider: "",
        steps: plan(1, 4), // reading done; clashes/merge/design in progress
        error: "",
        pendingResult: null,
      });
      if (idea) log(feed, myName, "prompt", idea);
      else log(feed, myName, "start", `${myName} sent the board to the agent`);
      return { runId, steering, history };
    },
    [myName]
  );

  // ── Progress: a live update from the stream. Moves the plan ticks and
  // tells the caller whether the run is still "working", "paused", or
  // "stopped" (taken over, or a newer run started).
  const progress = useMutation(
    ({ storage }, runId: string, steps: PlanStep[], provider?: string): "working" | "paused" | "stopped" => {
      const agentRun = storage.get("agentRun");
      const status = agentRun.get("status");
      if (agentRun.get("runId") !== runId || (status !== "working" && status !== "paused")) return "stopped";
      agentRun.update(provider ? { steps, provider } : { steps });
      return status;
    },
    []
  );

  // ── Finish: store the answer. Returns "draw" if the caller should draw it
  // now, "held" if paused (drawn on Resume), or "ignored" (taken over/stale).
  // `toDraw` = the screens not yet on the canvas (the rest were drawn live).
  const finish = useMutation(
    ({ storage }, runId: string, result: AgentResult, info: AgentRunInfo, toDraw: Screen[]): "draw" | "held" | "ignored" => {
      const agentRun = storage.get("agentRun");
      const feed = storage.get("activity");
      if (agentRun.get("runId") !== runId) return "ignored";

      const status = agentRun.get("status");
      const by = agentRun.get("startedBy");
      const n = result.screens.length;
      const line =
        `Run by ${by} using ${info.providerLabel}` +
        (info.usedOwnKey ? "" : " (built-in free agent)") +
        (result.action === "ask"
          ? " · asked a question"
          : ` · ${result.action === "update" ? "updated or added" : "added"} ${n} screen${n === 1 ? "" : "s"}, ` +
            `${result.conflicts.length} clash${result.conflicts.length === 1 ? "" : "es"}`);

      if (status === "paused") {
        agentRun.update({ provider: info.providerLabel, pendingResult: { ...result, screens: toDraw }, steps: plan(4) });
        log(feed, "Agent", "result", `${line}. Waiting: the agent is paused.`);
        return "held";
      }
      if (status !== "working") return "ignored";

      agentRun.update({
        status: "done",
        provider: info.providerLabel,
        result,
        steps: plan(4, 5), // drawing in progress
      });
      log(feed, "Agent", "result", line);
      if (result.action === "ask") log(feed, "Agent", "question", result.question);
      return "draw";
    },
    []
  );

  const fail = useMutation(({ storage }, runId: string, message: string) => {
    const agentRun = storage.get("agentRun");
    if (agentRun.get("runId") !== runId || agentRun.get("status") !== "working") return;
    agentRun.update({ status: "error", error: message, steps: plan(0) });
    log(storage.get("activity"), "Agent", "error", message);
  }, []);

  // Called after the screens are on the canvas.
  const markDrawn = useMutation(({ storage }) => {
    storage.get("agentRun").update({ steps: plan(5) });
  }, []);

  // ── Undo: remember what a run changed, so anyone can undo it ─────────────
  // Called after drawing. Adds to the record if this run already has one
  // (screens drawn live, then more after Resume); otherwise replaces it.
  const saveUndo = useMutation(
    ({ storage }, runId: string, drew: DrawRecord) => {
      if (drew.created.length === 0) return;
      const by = storage.get("agentRun").get("startedBy");
      const prev = storage.get("agentUndo");
      const same = prev && prev.runId === runId ? prev : null;
      storage.set("agentUndo", {
        runId,
        by,
        screens: (same?.screens ?? 0) + drew.created.length,
        created: [...(same?.created ?? []), ...drew.created],
        removed: JSON.stringify([...(same ? JSON.parse(same.removed) : []), ...drew.removed]),
      });
    },
    []
  );

  // Claim the undo record (so two people can't undo the same run twice).
  // Returns it for the caller to apply on the canvas, or null.
  const takeUndo = useMutation(
    ({ storage }): AgentUndo | null => {
      const status = storage.get("agentRun").get("status");
      const record = storage.get("agentUndo");
      if (!record || status === "working" || status === "paused") return null;
      storage.set("agentUndo", null);
      const n = record.screens;
      log(storage.get("activity"), myName, "undo", `${myName} undid the agent's last run (${n} screen${n === 1 ? "" : "s"} by ${record.by})`);
      return record;
    },
    [myName]
  );

  // ── Pick: a conflict card choice, used on the next run (shown in the feed).
  const pick = useMutation(
    ({ storage }, conflictSummary: string, chosenAuthor: string) => {
      log(
        storage.get("activity"),
        myName,
        "pick",
        `${myName} picked ${chosenAuthor}'s version for the clash "${conflictSummary.slice(0, 200)}" (instead of the merge).`
      );
    },
    [myName]
  );

  // ── Pause / Resume / Take over ────────────────────────────────────────────
  const pause = useMutation(
    ({ storage }) => {
      const agentRun = storage.get("agentRun");
      if (agentRun.get("status") !== "working") return;
      agentRun.update({ status: "paused" });
      log(storage.get("activity"), myName, "pause", `${myName} paused the agent`);
    },
    [myName]
  );

  // Returns a held answer that the caller should now draw, if any.
  const resumeState = useMutation(
    ({ storage }): AgentResult | null => {
      const agentRun = storage.get("agentRun");
      if (agentRun.get("status") !== "paused") return null;
      const held = agentRun.get("pendingResult");
      log(storage.get("activity"), myName, "resume", `${myName} resumed the agent`);
      if (held) {
        agentRun.update({ status: "done", result: held, pendingResult: null, steps: plan(4, 5) });
        return held;
      }
      agentRun.update({ status: "working" });
      return null;
    },
    [myName]
  );

  const takeOver = useMutation(
    ({ storage }) => {
      const agentRun = storage.get("agentRun");
      const status = agentRun.get("status");
      if (status !== "working" && status !== "paused") return;
      agentRun.update({ status: "idle", pendingResult: null, steps: plan(0) });
      log(storage.get("activity"), myName, "takeover", `${myName} took over. The agent stopped this run.`);
    },
    [myName]
  );

  /**
   * The whole agent flow: claim the agent, call the server with this
   * person's own key (if any) and the team's steering, follow the live
   * progress, draw each screen as it arrives, and save the answer for
   * everyone. "Send to agent" passes the board's notes; "Frame your idea"
   * passes the typed idea and no notes. Returns an error message for this
   * person, or null.
   */
  async function runAgent(
    notes: AgentNote[],
    draw: (result: AgentResult) => DrawRecord | void | Promise<DrawRecord | void>,
    idea = "",
    board: BoardScreen[] = []
  ): Promise<string | null> {
    idea = idea.trim().slice(0, 1000);
    const claimed = start(idea);
    if (!claimed) return "The agent is already working. Wait for it to finish, or press Take over.";
    const { runId } = claimed;
    const failWith = (message: string) => {
      fail(runId, message);
      return message;
    };

    let res: Response;
    try {
      res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({
          roomId, notes, idea, board, stream: true,
          history: claimed.history, steering: claimed.steering, aiKey: aiKeyForRequest(),
        }),
      });
    } catch {
      return failWith("Couldn't reach the server. Is the app running?");
    }
    // Problems found before the AI started (rate limit, bad request…) come
    // back as a normal { error } reply.
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => null);
      return failWith(data?.error ?? "The agent ran into a problem. Please try again.");
    }

    // Draw one screen now, or keep it for later if the agent is paused.
    let action: AgentAction = "add";
    const drawn = new Set<Screen>();
    const held: Screen[] = [];
    const drew: DrawRecord = { created: [], removed: [] }; // for undo
    const drawScreens = async (screens: Screen[]) => {
      for (const screen of screens) {
        const r = await draw({ conflicts: [], resolution: "", question: "", action, screens: [screen] });
        if (r) {
          drew.created.push(...r.created);
          drew.removed.push(...r.removed);
        }
        drawn.add(screen);
      }
    };

    // Read the stream: one JSON event per line.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === "error") return failWith(event.error);

          if (event.type === "done") {
            const { type: _type, provider, providerLabel, usedOwnKey, ...result } = event as AgentResult &
              AgentRunInfo & { type: string };
            // Screens that arrived while paused, or that only came with the
            // final answer (Claude/OpenAI don't stream), still need drawing.
            const toDraw = result.screens.filter((s) => ![...drawn].some((d) => d.name === s.name));
            const verdict = finish(runId, result, { provider, providerLabel, usedOwnKey }, toDraw);
            if (verdict === "draw") {
              await drawScreens(toDraw);
              markDrawn();
            }
            saveUndo(runId, drew);
            return null;
          }

          // Live progress: move the plan ticks, and stop if someone took over.
          const steps =
            event.type === "thinking" ? plan(1, 4)
            : event.type === "clashes" ? plan(2, 4)
            : event.type === "merged" ? plan(3, 4)
            : plan(3, 5); // "action" / "screen": designing and drawing
          const state = progress(runId, steps, event.type === "thinking" ? event.provider : undefined);
          if (state === "stopped") {
            await reader.cancel();
            saveUndo(runId, drew); // screens already drawn can still be undone
            return null;
          }
          if (event.type === "action") action = event.action;
          if (event.type === "screen") {
            held.push(event.screen as Screen);
            if (state === "working") await drawScreens(held.splice(0));
          }
        }
      }
      return failWith("The agent stopped before finishing. Please try again.");
    } catch {
      return failWith("Lost the connection to the agent. Please try again.");
    }
  }

  async function resume(draw: (result: AgentResult) => DrawRecord | void | Promise<DrawRecord | void>) {
    const runId = run?.runId ?? "";
    const held = resumeState();
    if (held) {
      const r = await draw(held);
      markDrawn();
      if (r) saveUndo(runId, r);
    }
  }

  return {
    run: run ?? IDLE_RUN,
    activity: activity ?? [],
    runAgent,
    undo,
    takeUndo,
    pick,
    pause,
    resume,
    takeOver,
  };
}
