// ─────────────────────────────────────────────────────────────────────────────
// BOARD MEMBERS ENDPOINT — /api/boards/members
//
//   GET   ?boardId=…                  → { me: role, members: [{ userId, name, role }] }
//                                       anyone who has opened the board
//   PATCH { boardId, userId, role }   → { ok }  change someone's role (the owner only).
//                                       role "owner" hands the board over: one
//                                       owner per board, the old owner becomes editor
//
// Roles: owner / editor / viewer (lib/boards-db.ts). SIGN-IN REQUIRED, and
// "you" is always the account in the sign-in token.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { boardsConfigured, changeRole, getRole, listMembers, ROLES, type Role } from "@/lib/boards-db";
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
    return problem ? error(problem, 403) : NextResponse.json({ ok: true });
  });
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
