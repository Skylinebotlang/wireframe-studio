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
//
// KEY SAFETY: the API key goes straight from this browser to our server in
// the request (aiKeyForRequest). It is never written into the room.
// ─────────────────────────────────────────────────────────────────────────────

import { LiveList, LiveObject } from "@liveblocks/client";
import { useMutation, useRoom, useStorage } from "@liveblocks/react/suspense";
import type { AgentNote, AgentResult, BoardScreen } from "./agent-schema";
import type { AgentRunInfo } from "./ai-providers";
import type { ActivityItem, ActivityKind, AgentRunState, PlanStep } from "./agent-room-types";
import { aiKeyForRequest } from "./byok";

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

  // ── Finish: store the answer. Returns "draw" if the caller should draw it
  // now, "held" if paused (drawn on Resume), or "ignored" (taken over/stale).
  const finish = useMutation(
    ({ storage }, runId: string, result: AgentResult, info: AgentRunInfo): "draw" | "held" | "ignored" => {
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
        agentRun.update({ provider: info.providerLabel, pendingResult: result, steps: plan(4) });
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
   * person's own key (if any) and the team's steering, save the answer for
   * everyone, then call `draw(result)` to put the screens on the canvas.
   * "Send to agent" passes the board's notes; "Frame your idea" passes the
   * typed idea and no notes. Returns an error message for this person, or null.
   */
  async function runAgent(
    notes: AgentNote[],
    draw: (result: AgentResult) => void | Promise<void>,
    idea = "",
    board: BoardScreen[] = []
  ): Promise<string | null> {
    idea = idea.trim().slice(0, 1000);
    const claimed = start(idea);
    if (!claimed) return "The agent is already working. Wait for it to finish, or press Take over.";

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, notes, idea, board, history: claimed.history, steering: claimed.steering, aiKey: aiKeyForRequest() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error ?? "The agent ran into a problem. Please try again.";
        fail(claimed.runId, message);
        return message;
      }
      const { provider, providerLabel, usedOwnKey, ...result } = data as AgentResult & AgentRunInfo;
      if (finish(claimed.runId, result, { provider, providerLabel, usedOwnKey }) === "draw") {
        await draw(result);
        markDrawn();
      }
      return null;
    } catch {
      const message = "Couldn't reach the server. Is the app running?";
      fail(claimed.runId, message);
      return message;
    }
  }

  async function resume(draw: (result: AgentResult) => void | Promise<void>) {
    const held = resumeState();
    if (held) {
      await draw(held);
      markDrawn();
    }
  }

  return {
    run: run ?? IDLE_RUN,
    activity: activity ?? [],
    runAgent,
    pick,
    pause,
    resume,
    takeOver,
  };
}
