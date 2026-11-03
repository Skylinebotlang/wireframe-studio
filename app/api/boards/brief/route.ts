// ─────────────────────────────────────────────────────────────────────────────
// DESIGN BRIEF ENDPOINT — /api/boards/brief
//
//   GET ?boardId=…           → { brief: { doc, dos, donts, brandColor, brandFont,
//                              lockedStyle, updatedByName, updatedAt },
//                              images: [{ id, kind, note, dataUrl }], canEdit }
//                              anyone on the board
//   PUT { boardId, doc, dos, donts, brandColor, brandFont } → { ok }
//                              the text and brand basics (owner and editors)
//   PATCH { boardId, lockedStyle: styleGuide | null } → { ok }
//                              lock a style for Make it real, or unlock (owner and editors)
//
// Pictures: /api/boards/brief/images. Figma import: /api/boards/brief/figma.
// The brief steers "Make it real" (app/api/design reads it itself, so a
// browser can't swap in a different one). SIGN-IN REQUIRED; "you" is always
// the account in the sign-in token. Limits: lib/design/brief.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { boardsConfigured, getRole } from "@/lib/server/boards-db";
import { briefError, briefRun, editBrief } from "@/lib/server/brief-api";
import { getBrief, listImages, saveBrief, setLockedStyle } from "@/lib/server/brief-db";
import { getSignedInUser } from "@/lib/server/auth-server";
import { canUseAI } from "@/lib/roles";
import { cleanBrief } from "@/lib/design/brief";
import { brandColorProblem, checkStyleGuide } from "@/lib/design/agent-design";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET(request: Request) {
  const me = await getSignedInUser(request);
  if (!me) return briefError("Please sign in first.", 401);
  const boardId = new URL(request.url).searchParams.get("boardId") ?? "";
  if (!ID.test(boardId)) return briefError("Invalid board.", 400);
  if (!boardsConfigured()) return briefError("The design brief needs the database (Supabase) set up.", 503);
  return briefRun(async () => {
    const [role, brief, images] = await Promise.all([getRole(me.id, boardId), getBrief(boardId), listImages(boardId)]);
    if (!role) return briefError("Open this board first.", 403);
    return NextResponse.json({
      brief,
      images: images.map(({ base64, mime, ...rest }) => ({ ...rest, dataUrl: `data:${mime};base64,${base64}` })),
      canEdit: canUseAI(role),
    });
  });
}

export async function PUT(request: Request) {
  return editBrief(request, async (boardId, body, name) => {
    const brief = cleanBrief(body);
    const problem = brandColorProblem(brief.brandColor);
    if (problem) return briefError(problem, 400);
    await saveBrief(boardId, brief, name);
    return NextResponse.json({ ok: true });
  });
}

export async function PATCH(request: Request) {
  return editBrief(request, async (boardId, body, name) => {
    if (body.lockedStyle === null) {
      await setLockedStyle(boardId, null, name);
      return NextResponse.json({ ok: true });
    }
    const checked = checkStyleGuide(body.lockedStyle);
    if (!checked.ok) return briefError("That style can't be locked.", 400);
    await setLockedStyle(boardId, checked.guide, name);
    return NextResponse.json({ ok: true });
  });
}
