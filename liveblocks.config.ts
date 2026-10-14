// ─────────────────────────────────────────────────────────────────────────────
// LIVEBLOCKS TYPES
//
// Liveblocks lets us declare the shape of the data flowing through its rooms.
// TypeScript then checks every useSelf / useOthers call in the app, which
// catches typos (like `inf0.name`) before the app ever runs.
//
// - Presence : per-browser ephemeral state (cursor position). tldraw manages
//              it via the bridge, so we keep it loose (`any`).
// - UserMeta : who each connected person is. The auth endpoint
//              (app/api/liveblocks-auth) fills this from the identity screen.
// - Storage  : shared persistent data. The canvas itself syncs via Yjs, so
//              Storage only holds the agent panel: the current run and the
//              activity feed (see lib/agent-room.ts).
// ─────────────────────────────────────────────────────────────────────────────

import type { JsonObject, LiveList, LiveMap, LiveObject } from "@liveblocks/client";
import type { ActivityItem, AgentRunState, AgentUndo, DesignRecord } from "./lib/agent-room-types";

declare global {
  interface Liveblocks {
    Presence: {
      // tldraw stores its full presence record here (via the bridge).
      presence: JsonObject | null;
    };

    UserMeta: {
      id: string;
      info: {
        name: string; // display name, e.g. "Asha"
        role: string; // "PM" | "Designer" | "Developer"
        color: string; // cursor color, hex
      };
    };

    // Saved, shared data everyone in the room sees (and late joiners too).
    // NEVER put an API key in here.
    Storage: {
      agentRun: LiveObject<AgentRunState>; // the current/last agent run
      activity: LiveList<ActivityItem>; // newest last, capped (see agent-room)
      // The agent's last run, for "Undo last agent run". Missing in rooms
      // made before undo existed; null once undone.
      agentUndo?: AgentUndo | null;
      // "Make it real" designs by id (the canvas only holds the id). Missing
      // in rooms made before designs existed; created on first use.
      designs?: LiveMap<string, DesignRecord>;
      // Each person's cursor color by name, so the feed and decision log can
      // show their color even after they leave. Created on first join.
      colors?: LiveMap<string, string>;
    };

    // One-off messages broadcast to everyone in the room (not saved).
    // "agent-status" tells every window to show/hide the agent's scanning
    // laser, and who started it.
    // `provider` is the AI's display name ("Gemini" | "Claude" | "OpenAI")
    // for "Run by papi using Claude". NEVER put an API key in any event,
    // presence or storage: everything here is visible to the whole room.
    RoomEvent: { type: "agent-status"; busy: boolean; by: string; provider?: string };

    // Room IDs are free-form strings like "demo" or "design-sprint-12".
    RoomMetadata: Record<string, never>;
  }
}

export {};
