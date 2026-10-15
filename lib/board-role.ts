"use client";

// ─────────────────────────────────────────────────────────────────────────────
// BOARD ROLE (browser side) — my role on this board and the member list.
//
//   const team = useBoardTeam(roomId);
//   team.me        → "owner" | "editor" | "contributor" | "viewer" | null (still loading)
//   team.members   → [{ userId, name, role }]
//   team.online    → ids of the people who have this board open right now
//   team.setRole(userId, role) → change someone's role (the owner only; "owner"
//                                 hands the board over);
//                                 returns an error message or null
//
// The server decides and enforces roles (/api/boards/members,
// /api/liveblocks-auth); this only reads them to shape the screen.
// A role change reaches the person the next time they open the board.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { shallow, useOthers, useSelf } from "@liveblocks/react/suspense";
import { authHeader } from "./auth";
import type { Member, Role } from "./boards-db";

export function useBoardTeam(roomId: string) {
  const [me, setMe] = useState<Role | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  // My account id, as the server put it in my Liveblocks pass.
  const myId = useSelf((self) => self.id);
  // Who's here right now (one entry per open window; ids repeat for 2 tabs).
  const others = useOthers((list) => list.map((o) => o.id), shallow);
  const online = [myId, ...others];

  const load = useCallback(async () => {
    const res = await fetch(`/api/boards/members?boardId=${encodeURIComponent(roomId)}`, {
      headers: await authHeader(),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok && data) {
      setMe(data.me);
      setMembers(data.members);
    }
  }, [roomId]);

  useEffect(() => {
    // Wait a moment: joining the room records the visit (and role) first.
    const t = setTimeout(load, 800);
    return () => clearTimeout(t);
  }, [load]);

  const setRole = useCallback(
    async (userId: string, role: Role): Promise<string | null> => {
      const res = await fetch("/api/boards/members", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ boardId: roomId, userId, role }),
      }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (!res?.ok) return data?.error ?? "Couldn't change the role. Please try again.";
      await load();
      return null;
    },
    [roomId, load]
  );

  return { me, members, online, setRole };
}
