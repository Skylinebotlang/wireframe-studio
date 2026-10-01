"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TLDRAW APP — puts the whiteboard on screen, wired to live sync.
//
// <Tldraw> is the ready-made whiteboard component. We hand it our synced
// `store` (from useYjsStore, the bridge file) instead of letting it create
// its own local one — that's the whole multiplayer trick.
// ─────────────────────────────────────────────────────────────────────────────

import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { useYjsStore } from "./useYjsStore";
import type { UserIdentity } from "@/lib/user";

export function TldrawApp({ identity }: { identity: UserIdentity }) {
  // Connect the tldraw store to the Liveblocks room.
  // `user` drives the cursor's name and color in other windows.
  const store = useYjsStore({
    user: { id: identity.id, color: identity.color, name: identity.name },
  });

  return (
    <div className="h-screen w-screen">
      <Tldraw
        store={store}
        onMount={(editor) => {
          // Remember the editor instance for later milestones (Milestone 2
          // uses it to place prompt notes; Milestone 3 to draw wireframes).
          (window as any).__tldrawEditor = editor;
        }}
        autoFocus
      />
    </div>
  );
}
