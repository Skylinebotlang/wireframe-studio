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
import type { UserIdentity } from "@/lib/user";

type RoomProps = {
  roomId: string;
  identity: UserIdentity; // who is joining (from the identity screen)
  children: ReactNode;
};

export function Room({ roomId, identity, children }: RoomProps) {
  return (
    <LiveblocksProvider
      // When joining, Liveblocks calls our server endpoint, which signs a
      // token using the SECRET key. That's how everyone learns your name,
      // role and color (set on the identity screen).
      // (With a custom auth endpoint, no public key is needed in the browser.)
      authEndpoint={async (): Promise<{ token: string }> => {
        const response = await fetch("/api/liveblocks-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: roomId, identity }),
        });
        if (!response.ok) {
          // Surface the server's plain-language error to the user.
          const data = await response
            .json()
            .catch(() => ({ error: "Authentication failed." }));
          throw new Error(data.error ?? "Authentication failed.");
        }
        return await response.json();
      }}
    >
      <RoomProvider
        id={roomId}
        initialPresence={{
          // tldraw's cursor/selection records live here via the bridge.
          presence: null,
        }}
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
