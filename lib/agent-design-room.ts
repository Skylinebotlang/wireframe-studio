"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MAKE IT REAL — the browser side of stage 2 (wireframes → real mockups).
//
//   const design = useDesignPanel(identity.name);
//   design.makeReal(boardScreens, idsFor, onDesign)   → design these screens
//   design.regenerate(designId, "make it darker", onDesign) → redo one design
//
// A run, driven from the browser of the person who clicked, one server call
// at a time (app/api/design):
//   1. claim the agent (the same shared run as stage 1, so only one thing
//      runs at once, and Pause / Resume / Take over work the same)
//   2. ask for ONE style guide for the whole app
//   3. ask for each screen's design in turn, save it in the room's
//      `designs` map, and put it on the canvas (onDesign) right away
// Before each call we check the shared run: paused → wait; taken over →
// stop and cancel the call in flight.
//
// KEY SAFETY: the AI key goes from this browser to our server with each
// call (aiKeyForRequest). It is never written into the room. Designs are
// saved in Liveblocks Storage (not the Yjs canvas), newest
// MAX_SAVED_DESIGNS only, so the room doesn't grow forever.
// ─────────────────────────────────────────────────────────────────────────────

import { LiveMap } from "@liveblocks/client";
import { useMutation, useRoom } from "@liveblocks/react/suspense";
import type { BoardScreen } from "./agent-schema";
import type { ActivityItem, DesignRecord, PlanStep } from "./agent-room-types";
import { MAX_DESIGN_SCREENS, PHONE_CSS_H, PHONE_CSS_W, type DesignScreen, type StyleGuide } from "./agent-design";
import { aiKeyForRequest } from "./byok";
import { screenshotHtml } from "./screenshot";
import { authHeader } from "./auth";

// ~20-60 KB each; a free Liveblocks room holds about 1 MB of Storage.
export const MAX_SAVED_DESIGNS = 12;
const MAX_ACTIVITY = 100;
const POLL_MS = 400;

const PLAN = ["Pick a style", "Design screens", "Place on canvas"];
const plan = (doneUpTo: number, workingUpTo = doneUpTo): PlanStep[] =>
  PLAN.map((label, i) => ({ label, state: i < doneUpTo ? "done" : i < workingUpTo ? "working" : "todo" }));

type Control = "go" | "paused" | "stop";
// Puts a saved design on the canvas (TldrawApp → placeDesign).
type OnDesign = (designId: string, screenName: string) => void;

export function useDesignPanel(myName: string) {
  const room = useRoom();
  const roomId = room.id;

  // ── Claim the agent for a design run. Returns the run id, or null if busy.
  // Also returns what the screens are about: the last idea typed and the
  // last merge paragraph (from stage 1), and its screens with box types.
  const start = useMutation(
    ({ storage }, feedLine: string) => {
      const agentRun = storage.get("agentRun");
      const status = agentRun.get("status");
      if (status === "working" || status === "paused") return null;
      const feed = storage.get("activity");
      const idea = feed.filter((a) => a.kind === "prompt").pop()?.text ?? "";
      const result = agentRun.get("result");
      const runId = crypto.randomUUID();
      agentRun.update({
        status: "working",
        runId,
        startedBy: myName,
        startedAt: Date.now(),
        provider: "",
        steps: plan(0, 1),
        error: "",
        pendingResult: null,
      });
      log(feed, myName, "design", feedLine);
      return { runId, idea, resolution: result?.resolution ?? "", lastScreens: result?.screens ?? [] };
    },
    [myName]
  );

  // Move the plan ticks (only while this run is still the current one).
  const progress = useMutation(({ storage }, runId: string, steps: PlanStep[], provider: string) => {
    const agentRun = storage.get("agentRun");
    if (agentRun.get("runId") === runId) agentRun.update(provider ? { steps, provider } : { steps });
  }, []);

  // Save one finished design for everyone, keeping only the newest few.
  const save = useMutation(({ storage }, runId: string, designId: string, record: DesignRecord) => {
    const agentRun = storage.get("agentRun");
    if (agentRun.get("runId") !== runId || agentRun.get("status") === "idle") return false;
    let designs = storage.get("designs");
    if (!designs) {
      designs = new LiveMap<string, DesignRecord>();
      storage.set("designs", designs);
    }
    designs.set(designId, record);
    const oldestFirst = [...designs.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [id] of oldestFirst.slice(0, Math.max(0, designs.size - MAX_SAVED_DESIGNS))) designs.delete(id);
    log(storage.get("activity"), "Agent", "design", `Agent designed ${record.name}`);
    return true;
  }, []);

  const end = useMutation(({ storage }, runId: string, error: string, line: string) => {
    const agentRun = storage.get("agentRun");
    if (agentRun.get("runId") !== runId || agentRun.get("status") !== "working") return;
    agentRun.update(error ? { status: "error", error, steps: plan(0) } : { status: "done", steps: plan(3) });
    log(storage.get("activity"), "Agent", error ? "error" : "design", error || line);
  }, []);

  // ── The shared run, read live: Pause / Take over can come from anyone.
  const control = (runId: string): Control => {
    const agentRun = room.getStorageSnapshot()?.get("agentRun");
    if (!agentRun || agentRun.get("runId") !== runId) return "stop";
    const status = agentRun.get("status");
    return status === "working" ? "go" : status === "paused" ? "paused" : "stop";
  };
  const holdWhilePaused = async (runId: string) => {
    let c = control(runId);
    while (c === "paused") {
      await new Promise((r) => setTimeout(r, POLL_MS));
      c = control(runId);
    }
    return c;
  };

  // One call to /api/design, cancelled if the run is taken over meanwhile.
  async function call(runId: string, body: object): Promise<Record<string, unknown> | { error: string } | "stopped"> {
    const ac = new AbortController();
    const watch = setInterval(() => control(runId) === "stop" && ac.abort(), POLL_MS);
    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeader()) },
        signal: ac.signal,
        body: JSON.stringify({ roomId, aiKey: aiKeyForRequest(), ...body }),
      });
      const data = await res.json().catch(() => null);
      if (control(runId) === "stop") return "stopped";
      if (!res.ok || !data) return { error: data?.error ?? "The design agent ran into a problem. Please try again." };
      return data;
    } catch {
      return control(runId) === "stop" ? "stopped" : { error: "Couldn't reach the server. Is the app running?" };
    } finally {
      clearInterval(watch);
    }
  }

  /**
   * The shared part of a run: (style guide unless given) → each screen →
   * saved + placed. `ids[i]` is the design id to (re)use for screens[i].
   * Returns an error message for this person, or null.
   */
  async function designRun(opts: {
    feedLine: string;
    screens: DesignScreen[];
    ids: string[];
    guide?: StyleGuide;
    instruction?: string;
    onDesign: OnDesign;
  }): Promise<string | null> {
    const claimed = start(opts.feedLine);
    if (!claimed) return "The agent is busy. Wait for it to finish, or press Take over.";
    const { runId, idea, resolution } = claimed;
    const names = opts.screens.map((s) => s.name);

    // 1. One style guide for the whole run (Regenerate reuses the old one).
    let guide = opts.guide;
    let provider = "";
    if (!guide) {
      if ((await holdWhilePaused(runId)) === "stop") return null;
      const r = await call(runId, { kind: "style", idea, resolution, screens: names });
      if (r === "stopped") return null;
      if ("error" in r) return fail(String(r.error));
      guide = r.styleGuide as StyleGuide;
      provider = String(r.providerLabel ?? "");
    }
    progress(runId, plan(1, 3), provider);

    // 2. Each screen in turn: designed, saved, placed on the canvas.
    let made = 0;
    const problems: string[] = [];
    for (const [i, screen] of opts.screens.entries()) {
      if ((await holdWhilePaused(runId)) === "stop") return null;
      const r = await call(runId, {
        kind: "screen",
        idea,
        resolution,
        styleGuide: guide,
        screen,
        otherScreens: names.filter((n) => n !== screen.name),
        instruction: opts.instruction ?? "",
      });
      if (r === "stopped") return null;
      if ("error" in r) {
        problems.push(`${screen.name}: ${r.error}`);
        continue; // one bad screen doesn't sink the others
      }
      provider = String(r.providerLabel ?? provider);
      const record: DesignRecord = {
        name: screen.name,
        html: String(r.html),
        screen,
        styleGuide: guide,
        by: myName,
        at: Date.now(),
        provider,
      };
      if ((await holdWhilePaused(runId)) === "stop") return null; // finished while paused: held until Resume
      if (!save(runId, opts.ids[i], record)) return null;
      opts.onDesign(opts.ids[i], screen.name);
      made++;

      // 3. Design-director pass: the AI checks the page against a design
      // checklist and fixes it. Saved over the first version only if it
      // comes back clean; otherwise the first version simply stays.
      // With a screenshot, the reviewer sees what actually renders (null =
      // couldn't capture; it then reviews from the HTML alone).
      const screenshot = await screenshotHtml(record.html, PHONE_CSS_W, PHONE_CSS_H);
      const reviewed = await call(runId, { kind: "review", idea, styleGuide: guide, screen, html: record.html, screenshot });
      if (reviewed === "stopped") return null;
      if (!("error" in reviewed) && typeof reviewed.html === "string") {
        if ((await holdWhilePaused(runId)) === "stop") return null;
        if (!save(runId, opts.ids[i], { ...record, html: reviewed.html, at: Date.now() })) return null;
      }
    }

    if (made === 0) return fail(problems[0] ?? "The agent couldn't design these screens. Please try again.");
    const failed = problems.length ? ` (${problems.length} failed: ${problems.join("; ")})` : "";
    end(runId, "", `Made ${made} screen${made === 1 ? "" : "s"} real using ${provider}${failed}`);
    return problems.length ? `Some screens failed: ${problems.join("; ")}` : null;

    function fail(message: string) {
      end(runId, message, "");
      return message;
    }
  }

  /**
   * "Make it real": design these wireframe screens (max MAX_DESIGN_SCREENS).
   * Box types come from the agent's last answer when the names match (they
   * know "button" vs "card"); hand-made frames only have their box text.
   */
  async function makeReal(board: BoardScreen[], idFor: (name: string) => string, onDesign: OnDesign) {
    const lastScreens = room.getStorageSnapshot()?.get("agentRun").get("result")?.screens ?? [];
    const screens: DesignScreen[] = board
      .filter((s) => s.labels.length)
      .slice(0, MAX_DESIGN_SCREENS)
      .map((s) => {
        const known = lastScreens.find((k) => k.name.trim().toLowerCase() === s.name.trim().toLowerCase());
        const sameBoxes = known && known.components.length === s.labels.length;
        return {
          name: s.name,
          components: s.labels.map((label, i) => ({
            type: sameBoxes ? known.components[i].type : i === 0 ? "header" : "text",
            label,
            notes: sameBoxes ? known.components[i].notes ?? "" : "",
          })),
        };
      });
    if (screens.length === 0) return "There are no wireframes to make real yet. Frame an idea first.";
    const n = screens.length;
    return designRun({
      feedLine: `${myName} asked the agent to make ${n} screen${n === 1 ? "" : "s"} real`,
      screens,
      ids: screens.map((s) => idFor(s.name)),
      onDesign,
    });
  }

  /** Redo one design with a short instruction, keeping its style guide. */
  async function regenerate(designId: string, instruction: string, onDesign: OnDesign) {
    const record = room.getStorageSnapshot()?.get("designs")?.get(designId);
    if (!record) return "That design is no longer saved. Select its wireframe and press Make it real.";
    const what = instruction.trim().slice(0, 300);
    return designRun({
      feedLine: `${myName} asked the agent to redo ${record.name}${what ? `: "${what}"` : ""}`,
      screens: [record.screen],
      ids: [designId],
      guide: record.styleGuide,
      instruction: what,
      onDesign,
    });
  }

  return { makeReal, regenerate };
}

function log(feed: { push: (a: ActivityItem) => void; length: number; delete: (i: number) => void }, who: string, kind: ActivityItem["kind"], text: string) {
  feed.push({ id: crypto.randomUUID(), at: Date.now(), who, kind, text });
  while (feed.length > MAX_ACTIVITY) feed.delete(0);
}
