// ─────────────────────────────────────────────────────────────────────────────
// DESIGN BRIEF PICTURES — /api/boards/brief/images   (owner and editors)
//
//   POST   { boardId, kind: "logo" | "reference", note, dataUrl } → { ok }
//          add a picture (JPEG/PNG, shrunk in the browser first). A new logo
//          replaces the old one; at most MAX_REFERENCES references.
//   PATCH  { boardId, id, note }  → { ok }   change a picture's note
//   DELETE { boardId, id }        → { ok }   remove a picture
//
// "Make it real" sends these pictures to the AI with the style and screen
// calls (app/api/design), on the person's own AI key.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { briefError, editBrief } from "@/lib/server/brief-api";
import { addImage, deleteImage, listImages, setImageNote } from "@/lib/server/brief-db";
import { MAX_REFERENCES, readImage } from "@/lib/design/brief";

const UUID = /^[0-9a-f-]{36}$/i;
const note = (v: unknown) => (typeof v === "string" ? v : "");

export async function POST(request: Request) {
  return editBrief(request, async (boardId, body) => {
    const kind = body.kind === "logo" ? "logo" : body.kind === "reference" ? "reference" : null;
    if (!kind) return briefError("Unknown kind of picture.", 400);
    const img = readImage(body.dataUrl);
    if ("error" in img) return briefError(img.error, 400);
    if (kind === "reference") {
      const refs = (await listImages(boardId, false)).filter((i) => i.kind === "reference");
      if (refs.length >= MAX_REFERENCES) return briefError(`A board can have ${MAX_REFERENCES} reference pictures. Remove one first.`, 400);
    }
    await addImage(boardId, { kind, note: note(body.note), ...img });
    return NextResponse.json({ ok: true });
  });
}

export async function PATCH(request: Request) {
  return editBrief(request, async (boardId, body) => {
    if (typeof body.id !== "string" || !UUID.test(body.id)) return briefError("Unknown picture.", 400);
    await setImageNote(boardId, body.id, note(body.note));
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(request: Request) {
  return editBrief(request, async (boardId, body) => {
    if (typeof body.id !== "string" || !UUID.test(body.id)) return briefError("Unknown picture.", 400);
    await deleteImage(boardId, body.id);
    return NextResponse.json({ ok: true });
  });
}
