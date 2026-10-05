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

import type { LiveList, LiveObject } from "@liveblocks/client";
import type { ActivityItem, AgentRunState } from "./lib/agent-room-types";

declare global {
  interface Liveblocks {
    Presence: {
      // tldraw stores its full presence record here (via the bridge).
      presence: any;
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
