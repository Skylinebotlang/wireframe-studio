// ─────────────────────────────────────────────────────────────────────────────
// SAVED BOARDS ENDPOINT — /api/boards
//
//   GET    ?userId=…                    → { boards: [...] } this person's boards
//   POST   { userId, name }             → { board }  make a new board
//   PUT    { userId, boardId }          → { ok }     "I opened this board"
//   PATCH  { userId, boardId, name }    → { ok }     rename a board
//
// The list lives in Supabase (lib/boards-db.ts); the canvas itself stays in
// Liveblocks. NOTE: until real logins exist, `userId` is the random id this
// browser picked on the "Who's drawing?" screen, so it is not proof of who
// someone is. Fine for a list of board names; swap it for the login's user
// id when your friend's login is ready.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { boardsConfigured, listBoards, renameBoard, visitBoard } from "@/lib/boards-db";

const ID = /^[A-Za-z0-9_-]{1,64}$/; // same rule as room ids
const MAX_NAME = 80;

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId") ?? "";
  if (!ID.test(userId)) return friendlyError("Missing who you are. Pick your name first.", 400);
  return run(async () => NextResponse.json({ boards: await listBoards(userId) }));
}

export async function POST(request: Request) {
  const body = await readBody(request);
  const name = cleanName(body?.name);
  if (!ID.test(body?.userId ?? "")) return friendlyError("Missing who you are. Pick your name first.", 400);
  if (!name) return friendlyError(`Give the board a name (up to ${MAX_NAME} characters).`, 400);
  // Room id: a readable slug of the name + a random tail, e.g. "dog-walker-k3f9x2".
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "board";
  const id = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  return run(async () => {
    await visitBoard(body.userId, id, name);
    return NextResponse.json({ board: { id, name } });
  });
}

export async function PUT(request: Request) {
  const body = await readBody(request);
  if (!ID.test(body?.userId ?? "") || !ID.test(body?.boardId ?? "")) return friendlyError("Invalid board.", 400);
  return run(async () => {
    await visitBoard(body.userId, body.boardId);
    return NextResponse.json({ ok: true });
  });
}

export async function PATCH(request: Request) {
  const body = await readBody(request);
  const name = cleanName(body?.name);
  if (!ID.test(body?.userId ?? "") || !ID.test(body?.boardId ?? "")) return friendlyError("Invalid board.", 400);
  if (!name) return friendlyError(`Give the board a name (up to ${MAX_NAME} characters).`, 400);
  return run(async () =>
    (await renameBoard(body.userId, body.boardId, name))
      ? NextResponse.json({ ok: true })
      : friendlyError("Open this board first, then you can rename it.", 403)
  );
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

function friendlyError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
