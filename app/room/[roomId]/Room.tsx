"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ROOM — the Liveblocks connection wrapper.
//
// Think of Liveblocks like a group chat for the canvas:
//   • LiveblocksProvider → "the phone line" to Liveblocks' servers
//   • RoomProvider       → "join the group chat called <roomId>"
//   • ClientSideSuspense → show a loading screen until connected
//
// Everything inside <Room> can use hooks like useSelf() and useOthers()
// to see who's in the room and what they're doing.
// ─────────────────────────────────────────────────────────────────────────────

import { ReactNode } from "react";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";
import { createInitialAgentStorage } from "@/lib/agent-room";

type RoomProps = {
  roomId: string;
  children: ReactNode;
};

export function Room({ roomId, children }: RoomProps) {
  return (
    <LiveblocksProvider
      // The public key identifies your project to Liveblocks' servers.
      // It is safe to load in browsers (that's its job) — it cannot grant
      // admin access. Everyone joining gets their name/role/color from the
      // identity screen, stored in their own browser.
      publicApiKey={process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY ?? ""}
    >
      <RoomProvider
        id={roomId}
        initialPresence={{
          // tldraw's cursor/selection records live here via the bridge.
          presence: null,
        }}
        // Shared agent panel data (current run + activity feed). Only used
        // the first time a room is created; after that it's loaded.
        initialStorage={createInitialAgentStorage}
      >
        <ClientSideSuspense fallback={<RoomLoading />}>{children}</ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

// Simple loading screen shown while connecting to the room.
function RoomLoading() {
  return (
    <div className="dot-grid flex h-screen w-screen flex-col items-center justify-center gap-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
      </div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        Connecting to room…
      </p>
    </div>
  );
}
