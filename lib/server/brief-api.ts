// ─────────────────────────────────────────────────────────────────────────────
// DESIGN BRIEF API HELPERS (server only) — the checks every brief change
// shares (signed in, valid board, owner or editor) and the friendly error
// shape. Used by app/api/boards/brief, /images and /figma.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { aiCheck, boardsConfigured } from "./boards-db";
import { getSignedInUser } from "./auth-server";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The shared part of every change: signed in, a valid board, owner or
 * editor.
 */
export async function editBrief(
  request: Request,
  fn: (boardId: string, body: Record<string, unknown>, myName: string) => Promise<Response>
) {
  const me = await getSignedInUser(request);
  if (!me) return briefError("Please sign in first.", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const boardId = body?.boardId;
  if (typeof boardId !== "string" || !ID.test(boardId)) return briefError("Invalid board.", 400);
  if (!boardsConfigured()) return briefError("The design brief needs the database (Supabase) set up.", 503);
  return briefRun(async () => {
    const notAllowed = await aiCheck(me.id, boardId);
    if (notAllowed) return briefError("Only editors and the owner can change the design brief.", 403);
    return fn(boardId, body!, me.name);
  });
}

export async function briefRun(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (err) {
    console.error("Design brief:", err);
    return briefError("Couldn't reach the design brief. Please try again.", 502);
  }
}

export function briefError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
