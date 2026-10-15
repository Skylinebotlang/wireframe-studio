// ─────────────────────────────────────────────────────────────────────────────
// BOARD MEMBERS ENDPOINT — /api/boards/members
//
//   GET   ?boardId=…                  → { me: role, members: [{ userId, name, role }] }
//                                       anyone who has opened the board
//   PATCH { boardId, userId, role }   → { ok }  change someone's role (the owner only).
//                                       role "owner" hands the board over: one
//                                       owner per board, the old owner becomes editor
//
// Roles: owner / editor / contributor / viewer (lib/roles.ts). SIGN-IN
// REQUIRED, and "you" is always the account in the sign-in token.
//
// LIVE: after a role change, the person's Liveblocks access is updated right
// away and the room hears { type: "team-changed", userId }. Every open window
// reloads the Team list; the person whose role changed reconnects with a
// fresh pass, so the new role applies without a reload (lib/board-role.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { boardsConfigured, canEdit, changeRole, getRole, listMembers, ROLES, type Role } from "@/lib/boards-db";
import { getSignedInUser } from "@/lib/auth-server";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET(request: Request) {
  const me = await getSignedInUser(request);
  if (!me) return error("Please sign in first.", 401);
  const boardId = new URL(request.url).searchParams.get("boardId") ?? "";
  if (!ID.test(boardId)) return error("Invalid board.", 400);
  return run(async () => {
    const role = await getRole(me.id, boardId);
    if (!role) return error("Open this board first.", 403);
    return NextResponse.json({ me: role, members: await listMembers(boardId) });
  });
}

export async function PATCH(request: Request) {
  const me = await getSignedInUser(request);
  if (!me) return error("Please sign in first.", 401);
  const body = await request.json().catch(() => null);
  const role = body?.role as Role;
  if (!ID.test(body?.boardId ?? "") || typeof body?.userId !== "string" || !ROLES.includes(role)) {
    return error("Invalid request.", 400);
  }
  return run(async () => {
    const problem = await changeRole(me.id, body.boardId, body.userId, role);
    if (problem) return error(problem, 403);
    await tellRoom(body.boardId, body.userId, role);
    return NextResponse.json({ ok: true });
  });
}

// The role is saved; now make it live. Best effort: if Liveblocks can't be
// reached, the new role still applies the next time they open the board.
async function tellRoom(boardId: string, userId: string, role: Role) {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) return;
  const liveblocks = new Liveblocks({ secret });
  try {
    // The room's own rule for this person (same as /api/liveblocks-auth).
    // Handing over ownership leaves the old owner an editor: still writes.
    await liveblocks.updateRoom(boardId, { usersAccesses: { [userId]: canEdit(role) ? ["room:write"] : null } });
    await liveblocks.broadcastEvent(boardId, { type: "team-changed", userId });
  } catch (err) {
    console.error("Members: couldn't update the room live:", err);
  }
}

async function run(work: () => Promise<Response>) {
  if (!boardsConfigured()) return error("Saved boards aren't set up.", 500);
  try {
    return await work();
  } catch (err) {
    console.error("Members:", err);
    return error("Couldn't reach the member list. Please try again.", 502);
  }
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
