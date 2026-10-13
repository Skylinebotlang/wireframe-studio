// ─────────────────────────────────────────────────────────────────────────────
// PHONE LAYOUT — where each wireframe box goes inside a phone frame.
//
// Plain maths, no tldraw, so it can be tested on its own
// (node --experimental-strip-types lib/layout.check.ts).
// lib/draw-wireframes.ts turns the result into shapes.
//
// Rules, top to bottom:
//   • columns 1 (the default): the box takes the full width.
//   • columns 2 or 3: neighbouring boxes with the same number sit side by
//     side, 2 or 3 per row (two buttons → a row; four cards → a 2×2 grid).
//   • tabbar: split its label on "|" ("Home | Search | Profile") into equal
//     tabs, pinned to the bottom of the phone. Only the first one counts.
// ─────────────────────────────────────────────────────────────────────────────

import type { ComponentType, WireframeComponent } from "./agent-schema";

export const PHONE_W = 300; // phone frame width
export const PHONE_MIN_H = 600; // phone frame minimum height
export const PAD = 16; // space inside the frame
export const GAP = 10; // space between boxes

// How tall each kind of box is. (Tall enough for one line of label text;
// tldraw grows a box whose label doesn't fit, which would overlap the next.)
export const HEIGHT: Record<ComponentType, number> = {
  header: 56,
  text: 48,
  input: 48,
  button: 52,
  card: 96,
  list: 120,
  image: 120,
  summary: 88,
  tabbar: 52,
};

export type Placed = { c: WireframeComponent; label: string; x: number; y: number; w: number; h: number };

export function layoutScreen(components: WireframeComponent[]): { boxes: Placed[]; height: number } {
  const inner = PHONE_W - PAD * 2;
  const boxes: Placed[] = [];
  const body = components.filter((c) => c.type !== "tabbar");
  const tabbar = components.find((c) => c.type === "tabbar");

  // ── Body: rows of 1, 2 or 3 ───────────────────────────────────────────────
  let y = PAD;
  for (let i = 0; i < body.length; ) {
    const cols = body[i].columns ?? 1;
    // This row: up to `cols` neighbours that asked for the same columns.
    let n = 1;
    while (n < cols && i + n < body.length && (body[i + n].columns ?? 1) === cols) n++;
    const row = body.slice(i, i + n);
    const w = (inner - GAP * (cols - 1)) / cols;
    const h = Math.max(...row.map((c) => HEIGHT[c.type]));
    row.forEach((c, k) => boxes.push({ c, label: c.label, x: PAD + k * (w + GAP), y, w, h }));
    y += h + GAP;
    i += n;
  }
  const bodyEnd = body.length ? y - GAP : PAD;

  // ── Tab bar: equal tabs along the bottom ──────────────────────────────────
  const tabs = tabbar ? tabbar.label.split("|").map((t) => t.trim()).filter(Boolean) : [];
  const height = Math.max(PHONE_MIN_H, bodyEnd + (tabs.length ? GAP + HEIGHT.tabbar : 0) + PAD);
  if (tabbar && tabs.length) {
    const w = inner / tabs.length;
    const ty = height - PAD - HEIGHT.tabbar;
    tabs.forEach((label, k) => boxes.push({ c: tabbar, label, x: PAD + k * w, y: ty, w, h: HEIGHT.tabbar }));
  }
  return { boxes, height };
}
