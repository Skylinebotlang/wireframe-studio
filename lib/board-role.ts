"use client";

// ─────────────────────────────────────────────────────────────────────────────
// BOARD ROLE (browser side) — my role on this board and the member list.
//
//   const team = useBoardTeam(roomId);
//   team.me        → "owner" | "editor" | "contributor" | "viewer" | null (still loading)
//   team.members   → [{ userId, name, role }]
//   team.online    → ids of the people who have this board open right now
//   team.notice    → "You're now a Contributor" for a few seconds after
//                    the owner changes MY role (else "")
//   team.setRole(userId, role) → change someone's role (the owner only; "owner"
//                                 hands the board over);
//                                 returns an error message or null
//
// The server decides and enforces roles (/api/boards/members,
// /api/liveblocks-auth); this only reads them to shape the screen.
// LIVE: when a role changes, the server tells the room ("team-changed").
// Every window reloads the list; if it's MY role, Liveblocks reconnects with
// a fresh pass (client.logout() clears the saved one; it does NOT sign you
// out), so the canvas and the AI buttons switch without a page reload.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { shallow, useClient, useEventListener, useOthers, useSelf } from "@liveblocks/react/suspense";
import { authHeader } from "./auth";
import type { Member } from "./boards-db";
import type { Role } from "./roles";

const LABEL: Record<Role, string> = { owner: "Owner", editor: "Editor", contributor: "Contributor", viewer: "Viewer" };
const NOTICE_MS = 5000;

export function useBoardTeam(roomId: string) {
  const [me, setMe] = useState<Role | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [notice, setNotice] = useState("");
  const client = useClient();
  // My account id, as the server put it in my Liveblocks pass.
  const myId = useSelf((self) => self.id);
  // Who's here right now (one entry per open window; ids repeat for 2 tabs).
  const others = useOthers((list) => list.map((o) => o.id), shallow);
  const online = [myId, ...others];

  // The role as last shown, to spot when MY role changes.
  const shown = useRef<Role | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/boards/members?boardId=${encodeURIComponent(roomId)}`, {
      headers: await authHeader(),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok && data) {
      if (shown.current && data.me !== shown.current) {
        const r = data.me as Role;
        setNotice(`You're now ${r === "owner" ? "the" : r === "editor" ? "an" : "a"} ${LABEL[r]}`);
      }
      shown.current = data.me;
      setMe(data.me);
      setMembers(data.members);
    }
  }, [roomId]);

  useEffect(() => {
    // Wait a moment: joining the room records the visit (and role) first.
    const t = setTimeout(load, 800);
    return () => clearTimeout(t);
  }, [load]);

  // Someone's role changed (the server says so): refresh the list, and if
  // it's mine, reconnect so Liveblocks gives me my new access.
  useEventListener(({ event }) => {
    if (event.type !== "team-changed") return;
    if (event.userId === myId) client.logout();
    load();
  });

  // The "You're now…" note fades after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

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

  return { me, members, online, notice, setRole };
}
