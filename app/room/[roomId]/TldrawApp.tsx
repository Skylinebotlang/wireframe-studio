"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TLDRAW APP — puts the whiteboard on screen, wired to live sync.
//
// <Tldraw> is the ready-made whiteboard component. We hand it our synced
// `store` (from useYjsStore, the bridge file) instead of letting it create
// its own local one — that's the whole multiplayer trick.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { useYjsStore } from "./useYjsStore";
import type { UserIdentity } from "@/lib/user";

export function TldrawApp({ identity }: { identity: UserIdentity }) {
  // IMPORTANT: build the user object with useMemo.
  // The sync bridge (useYjsStore) restarts itself whenever this object
  // changes — a fresh object on every render would restart it endlessly.
  // useMemo keeps the SAME object as long as the identity values don't change.
  const user = useMemo(
    () => ({ id: identity.id, color: identity.color, name: identity.name }),
    [identity.id, identity.color, identity.name]
  );

  // Connect the tldraw store to the Liveblocks room.
  // `user` drives the cursor's name and color in other windows.
  const store = useYjsStore({ user });

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
