// ─────────────────────────────────────────────────────────────────────────────
// DESIGN BRIEF — the team's own design rules for a board, in one shape.
//
//   doc / dos / donts        the design document and the always / never rules
//   brandColor / brandFont   brand basics: forced into every style guide
//   lockedStyle              a style guide the team locked: reused, not re-picked
//   images                   the logo + up to MAX_REFERENCES reference images,
//                            each with a note ("take the card style")
//
// The owner and editors write it in the Design brief panel
// (components/room/BriefPanel.tsx); the server saves it (app/api/boards/
// brief, lib/server/brief-db.ts) and "Make it real" adds it to every design
// prompt (app/api/design) via `briefPrompt`.
//
// `cleanBrief` is the one gate: it trims and caps everything, so the panel,
// the API and the database all agree on the limits (supabase/briefs.sql).
// No secrets and no network: safe in the browser and the server.
// ─────────────────────────────────────────────────────────────────────────────

// Type-only import (nothing loaded at run time), so the self-check can run
// this file directly. Brand rules that need the style code live there
// (applyBrand, brandColorProblem in lib/design/agent-design.ts).
import type { FONTS } from "./agent-design";

export const MAX_DOC_CHARS = 8000;
export const MAX_RULES = 12; // per list
export const MAX_RULE_CHARS = 160;
export const MAX_REFERENCES = 5; // reference images per board (plus one logo)
export const MAX_NOTE_CHARS = 200;
export const MAX_IMAGE_BASE64 = 300_000; // ~220 KB picture; the browser shrinks first
export type FontId = keyof typeof FONTS;
export const FONT_IDS: FontId[] = ["sans", "serif", "rounded", "mono"];

export type Brief = {
  doc: string; // the design document, in the team's own words
  dos: string[]; // rules every design must follow
  donts: string[]; // rules every design must avoid
  brandColor: string; // "#rrggbb" or "" (none)
  brandFont: FontId | ""; // one of the safe font families, or "" (none)
};

export const EMPTY_BRIEF: Brief = { doc: "", dos: [], donts: [], brandColor: "", brandFont: "" };

// A logo or reference picture (JPEG or PNG, sent to the AI with design calls).
export type BriefImage = { id: string; kind: "logo" | "reference"; note: string; mime: "image/jpeg" | "image/png"; base64: string };

const rules = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.trim().slice(0, MAX_RULE_CHARS))
    .filter(Boolean)
    .slice(0, MAX_RULES);
const cleanColor = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : "");
const cleanFont = (v: unknown): FontId | "" => (FONT_IDS.includes(v as FontId) ? (v as FontId) : "");

/** Anything (a request body, a database row) → a Brief within the limits. */
export function cleanBrief(raw: unknown): Brief {
  const b = (raw ?? {}) as Record<string, unknown>;
  return {
    doc: typeof b.doc === "string" ? b.doc.trim().slice(0, MAX_DOC_CHARS) : "",
    dos: rules(b.dos),
    donts: rules(b.donts),
    brandColor: cleanColor(b.brandColor ?? b.brand_color),
    brandFont: cleanFont(b.brandFont ?? b.brand_font),
  };
}

export const isEmptyBrief = (b: Brief) =>
  !b.doc && b.dos.length === 0 && b.donts.length === 0 && !b.brandColor && !b.brandFont;

/** A data URL from the browser → a picture we accept, or why not. */
export function readImage(dataUrl: unknown): { mime: BriefImage["mime"]; base64: string } | { error: string } {
  const m = typeof dataUrl === "string" ? dataUrl.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m) return { error: "Only JPEG or PNG pictures can be added." };
  if (m[2].length > MAX_IMAGE_BASE64) return { error: "That picture is too big, even after shrinking. Try a smaller one." };
  return { mime: m[1] as BriefImage["mime"], base64: m[2] };
}

/**
 * The brief as a block for the AI's message, or "" when there's none.
 * `images` = the pictures attached to the same message, in the same order.
 * It's the team's guidance about LOOK and FEEL; the safety rules in the
 * system prompt (no scripts, no outside links, no orange…) still win.
 */
export function briefPrompt(b: Brief, images: Pick<BriefImage, "kind" | "note">[] = []): string {
  if (isEmptyBrief(b) && images.length === 0) return "";
  const list = (title: string, items: string[]) => (items.length ? `${title}\n${items.map((r) => `- ${r}`).join("\n")}\n` : "");
  const pictures = images.map((img, i) =>
    img.kind === "logo"
      ? `${i + 1}. The product's logo: match its colours and character.${img.note ? ` (${img.note})` : ""}`
      : `${i + 1}. A reference the team likes. ${img.note ? `Take from it: ${img.note}.` : "Take its overall look and feel."} Never copy it outright.`
  );
  return (
    `<brief>\nThe team's design brief for this product. Follow it closely: it outranks your own taste ` +
    `(but never the technical and safety rules above).\n` +
    (b.doc ? `Design document:\n${b.doc}\n` : "") +
    (b.brandColor ? `Brand colour (the main / primary colour): ${b.brandColor}\n` : "") +
    (b.brandFont ? `Brand font family: ${b.brandFont}\n` : "") +
    list("Always do:", b.dos) +
    list("Never do:", b.donts) +
    (pictures.length ? `Attached pictures, in order:\n${pictures.join("\n")}\n` : "") +
    `</brief>`
  );
}
