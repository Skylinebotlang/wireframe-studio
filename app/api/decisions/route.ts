// ─────────────────────────────────────────────────────────────────────────────
// DECISION LOG ENDPOINT — /api/decisions
//
//   GET  ?boardId=…                         → { decisions: [...] } newest first
//   POST { boardId, summary, chosenAuthor } → { ok }  a person picked one
//                                             teammate's version on a clash card
//
// Agent merges are saved by /api/agent itself (lib/decisions-db.ts).
// SIGN-IN REQUIRED, like every API: the person comes from the sign-in token.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getSignedInUser } from "@/lib/auth-server";
import { boardsConfigured, editorCheck } from "@/lib/boards-db";
import { addDecisions, listDecisions } from "@/lib/decisions-db";

const ID = /^[A-Za-z0-9_-]{1,64}$/; // same rule as room ids

export async function GET(request: Request) {
  const me = await getSignedInUser(request);
  if (!me) return friendlyError("Please sign in first.", 401);
  const boardId = new URL(request.url).searchParams.get("boardId") ?? "";
  if (!ID.test(boardId)) return friendlyError("Invalid board.", 400);
  return run(async () => NextResponse.json({ decisions: await listDecisions(boardId) }));
}

export async function POST(request: Request) {
  const me = await getSignedInUser(request);
  if (!me) return friendlyError("Please sign in first.", 401);
  const body = await request.json().catch(() => null);
  const boardId = typeof body?.boardId === "string" ? body.boardId : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  const chosen = typeof body?.chosenAuthor === "string" ? body.chosenAuthor.trim().slice(0, 80) : "";
  const byName = typeof body?.byName === "string" && body.byName.trim() ? body.byName.trim() : me.name;
  if (!ID.test(boardId) || !summary || !chosen) return friendlyError("Missing the clash or the chosen version.", 400);
  // Viewers can't pick a clash winner; contributors can (roles: lib/roles.ts).
  const notAllowed = await editorCheck(me.id, boardId);
  if (notAllowed) return friendlyError(notAllowed, 403);
  return run(async () => {
    await addDecisions([
      { boardId, kind: "pick", summary, decision: `Use ${chosen}'s version`, decidedBy: byName, userId: me.id },
    ]);
    return NextResponse.json({ ok: true });
  });
}

async function run(work: () => Promise<Response>) {
  if (!boardsConfigured()) return friendlyError("The decision log isn't set up (Supabase keys missing).", 500);
  try {
    return await work();
  } catch (err) {
    console.error("Decisions:", err);
    return friendlyError("Couldn't reach the decision log. Please try again.", 502);
  }
}

function friendlyError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
