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
// - Storage  : shared persistent data. We'll add shapes here in Milestone 2
//              (prompt notes) — for now the canvas syncs via Yjs, which
//              doesn't need a Storage declaration.
// ─────────────────────────────────────────────────────────────────────────────

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

    // Room IDs are free-form strings like "demo" or "design-sprint-12".
    RoomMetadata: Record<string, never>;
  }
}

export {};
