// ─────────────────────────────────────────────────────────────────────────────
// SAVED BOARDS ENDPOINT — /api/boards
//
//   GET                          → { boards: [...] } your boards
//   POST   { name }              → { board }  make a new board
//   PUT    { boardId }           → { ok }     "I opened this board"
//   PATCH  { boardId, name }     → { ok }     rename a board
//   DELETE { boardId }           → { ok }     delete a board (its creator only):
//                                  the list entry, its decision log AND the
//                                  drawings in Liveblocks. Can't be undone.
//
// SIGN-IN REQUIRED: every call needs the Supabase sign-in token, and "you"
// is the account in that token (never an id the browser sends).
// The list lives in Supabase (lib/boards-db.ts); the canvas itself stays in
// Liveblocks.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { boardsConfigured, deleteBoard, listBoards, renameBoard, visitBoard } from "@/lib/boards-db";
import { getSignedInUser } from "@/lib/auth-server";

const ID = /^[A-Za-z0-9_-]{1,64}$/; // same rule as room ids
const MAX_NAME = 80;

export async function GET(request: Request) {
  const me = await getSignedInUser(request);
  if (!me) return signInFirst();
  return run(async () => NextResponse.json({ boards: await listBoards(me.id) }));
}

export async function POST(request: Request) {
  const me = await getSignedInUser(request);
  if (!me) return signInFirst();
  const body = await readBody(request);
  const name = cleanName(body?.name);
  if (!name) return friendlyError(`Give the board a name (up to ${MAX_NAME} characters).`, 400);
  // Room id: a readable slug of the name + a random tail, e.g. "dog-walker-k3f9x2".
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "board";
  const id = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  return run(async () => {
    await visitBoard(me.id, id, name, me.name);
    return NextResponse.json({ board: { id, name } });
  });
}

export async function PUT(request: Request) {
  const me = await getSignedInUser(request);
  if (!me) return signInFirst();
  const body = await readBody(request);
  if (!ID.test(body?.boardId ?? "")) return friendlyError("Invalid board.", 400);
  return run(async () => {
    await visitBoard(me.id, body.boardId, undefined, me.name);
    return NextResponse.json({ ok: true });
  });
}

export async function PATCH(request: Request) {
  const me = await getSignedInUser(request);
  if (!me) return signInFirst();
  const body = await readBody(request);
  const name = cleanName(body?.name);
  if (!ID.test(body?.boardId ?? "")) return friendlyError("Invalid board.", 400);
  if (!name) return friendlyError(`Give the board a name (up to ${MAX_NAME} characters).`, 400);
  return run(async () =>
    (await renameBoard(me.id, body.boardId, name))
      ? NextResponse.json({ ok: true })
      : friendlyError("Open this board first, then you can rename it.", 403)
  );
}

export async function DELETE(request: Request) {
  const me = await getSignedInUser(request);
  if (!me) return signInFirst();
  const body = await readBody(request);
  if (!ID.test(body?.boardId ?? "")) return friendlyError("Invalid board.", 400);
  return run(async () => {
    if (!(await deleteBoard(me.id, body.boardId))) {
      return friendlyError("Only the person who made this board can delete it.", 403);
    }
    // The drawings too, so the old link opens an empty board. Best effort:
    // the list entry is already gone either way.
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (secret) await new Liveblocks({ secret }).deleteRoom(body.boardId).catch((err) => console.error("Boards: couldn't delete the room:", err));
    return NextResponse.json({ ok: true });
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function readBody(request: Request) {
  return request.json().catch(() => null);
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME) : "";
}

// Run a database call, turning any failure into a friendly message.
async function run(work: () => Promise<Response>) {
  if (!boardsConfigured()) {
    return friendlyError("Saved boards aren't set up: add SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local.", 500);
  }
  try {
    return await work();
  } catch (err) {
    console.error("Boards:", err);
    return friendlyError("Couldn't reach the boards list. Please try again.", 502);
  }
}

function signInFirst() {
  return friendlyError("Please sign in first.", 401);
}

function friendlyError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
