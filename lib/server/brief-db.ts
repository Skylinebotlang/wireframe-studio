// ─────────────────────────────────────────────────────────────────────────────
// DESIGN BRIEF STORE (server only) — read and save a board's design brief in
// Supabase (tables board_briefs + board_images, supabase/briefs.sql). Who
// may save is checked by the caller (app/api/boards/brief). Uses the same
// Supabase helper as the boards list (lib/server/boards-db.ts `rest`).
// ─────────────────────────────────────────────────────────────────────────────

import { boardsConfigured, rest } from "./boards-db";
import { cleanBrief, EMPTY_BRIEF, MAX_NOTE_CHARS, type Brief, type BriefImage } from "@/lib/design/brief";
import { checkStyleGuide, type StyleGuide } from "@/lib/design/agent-design";

export type SavedBrief = Brief & { lockedStyle: StyleGuide | null; updatedByName: string; updatedAt: string };

const enc = encodeURIComponent;

/** The board's brief (empty if nobody wrote one, or no database is set up). */
export async function getBrief(boardId: string): Promise<SavedBrief> {
  const none: SavedBrief = { ...EMPTY_BRIEF, lockedStyle: null, updatedByName: "", updatedAt: "" };
  if (!boardsConfigured()) return none;
  const rows: Record<string, unknown>[] = await rest(
    `board_briefs?board_id=eq.${enc(boardId)}&select=doc,dos,donts,brand_color,brand_font,locked_style,updated_by_name,updated_at`
  );
  const r = rows[0];
  if (!r) return none;
  const locked = r.locked_style ? checkStyleGuide(r.locked_style) : null;
  return {
    ...cleanBrief(r),
    lockedStyle: locked?.ok ? locked.guide : null,
    updatedByName: String(r.updated_by_name ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

// Create or update the board's row with just these columns.
async function upsert(boardId: string, byName: string, columns: Record<string, unknown>) {
  await rest("board_briefs?on_conflict=board_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ board_id: boardId, ...columns, updated_by_name: byName.slice(0, 80), updated_at: new Date().toISOString() }),
  });
}

/** Save the text and brand basics (the locked style and pictures stay as they are). */
export function saveBrief(boardId: string, brief: Brief, byName: string) {
  const b = cleanBrief(brief);
  return upsert(boardId, byName, { doc: b.doc, dos: b.dos, donts: b.donts, brand_color: b.brandColor, brand_font: b.brandFont });
}

/** Lock a style guide for the board, or unlock (null). */
export function setLockedStyle(boardId: string, guide: StyleGuide | null, byName: string) {
  return upsert(boardId, byName, { locked_style: guide });
}

// ── Pictures: the logo and reference images ──────────────────────────────────

type ImageRow = { id: string; kind: BriefImage["kind"]; note: string; mime: BriefImage["mime"]; data?: string };

/** The board's pictures, logo first, then references oldest first. `withData` = include the picture itself. */
export async function listImages(boardId: string, withData = true): Promise<BriefImage[]> {
  if (!boardsConfigured()) return [];
  const rows: ImageRow[] = await rest(
    `board_images?board_id=eq.${enc(boardId)}&select=id,kind,note,mime${withData ? ",data" : ""}&order=created_at.asc`
  );
  return rows
    .map((r) => ({ id: r.id, kind: r.kind, note: r.note, mime: r.mime, base64: r.data ?? "" }))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "logo" ? -1 : 1));
}

/** Add a picture. A new logo replaces the old one. */
export async function addImage(boardId: string, img: Omit<BriefImage, "id">) {
  if (img.kind === "logo") await rest(`board_images?board_id=eq.${enc(boardId)}&kind=eq.logo`, { method: "DELETE" });
  await rest("board_images", {
    method: "POST",
    body: JSON.stringify({ board_id: boardId, kind: img.kind, note: img.note.slice(0, MAX_NOTE_CHARS), mime: img.mime, data: img.base64 }),
  });
}

export async function setImageNote(boardId: string, id: string, note: string) {
  await rest(`board_images?board_id=eq.${enc(boardId)}&id=eq.${enc(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ note: note.trim().slice(0, MAX_NOTE_CHARS) }),
  });
}

export async function deleteImage(boardId: string, id: string) {
  await rest(`board_images?board_id=eq.${enc(boardId)}&id=eq.${enc(id)}`, { method: "DELETE" });
}
