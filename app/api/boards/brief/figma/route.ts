// ─────────────────────────────────────────────────────────────────────────────
// IMPORT FROM FIGMA — POST /api/boards/brief/figma   (owner and editors)
//
//   { boardId, fileUrl, token } → { colors: [{ name, hex }], brandColor,
//                                   fontFamily, brandFont }
//
// Reads the colour and text styles saved in a Figma file and suggests brand
// basics. Nothing is saved here: the Design brief panel fills in the
// suggestion, and the person checks it and presses Save.
//
// KEY SAFETY: `token` is the person's own Figma personal access token. It is
// used for these two Figma calls only, never saved, never logged, never put
// in the room.
//
// ponytail: reads only styles that are PUBLISHED in the file (Figma's
// /styles API). Local, unpublished styles aren't listed there; reading them
// would mean downloading the whole file. Fonts map to the nearest of our 4
// safe families (designs can't load web fonts).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { briefError, editBrief } from "@/lib/server/brief-api";
import { isOrange } from "@/lib/design/agent-design";
import type { FontId } from "@/lib/design/brief";

const FIGMA = "https://api.figma.com/v1";
const MAX_STYLES = 60;

export async function POST(request: Request) {
  return editBrief(request, async (_boardId, body) => {
    const key = typeof body.fileUrl === "string" ? body.fileUrl.match(/figma\.com\/(?:file|design|proto)\/([A-Za-z0-9]{10,64})/)?.[1] : null;
    if (!key) return briefError("That doesn't look like a Figma file link (figma.com/design/…).", 400);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token || token.length > 200) return briefError("Paste your Figma personal access token.", 400);

    const get = async (path: string) => {
      const res = await fetch(`${FIGMA}${path}`, { headers: { "X-Figma-Token": token }, cache: "no-store" });
      if (res.status === 403 || res.status === 401) throw new FigmaProblem("Figma refused the token. Check it, and that it can read files.");
      if (res.status === 404) throw new FigmaProblem("Figma couldn't find that file, or the token can't open it.");
      if (!res.ok) throw new FigmaProblem("Figma didn't answer properly. Please try again.");
      return res.json();
    };

    try {
      const list = await get(`/files/${key}/styles`);
      const styles: { node_id: string; style_type: string; name: string }[] = (list?.meta?.styles ?? [])
        .filter((s: { style_type?: string }) => s.style_type === "FILL" || s.style_type === "TEXT")
        .slice(0, MAX_STYLES);
      if (styles.length === 0) {
        return briefError("This file has no published colour or text styles. In Figma, publish its styles (Assets → Libraries), then try again.", 404);
      }
      const nodes = (await get(`/files/${key}/nodes?ids=${styles.map((s) => encodeURIComponent(s.node_id)).join(",")}`))?.nodes ?? {};

      const colors: { name: string; hex: string }[] = [];
      const families: string[] = [];
      for (const s of styles) {
        const doc = nodes[s.node_id]?.document;
        if (s.style_type === "FILL") {
          const fill = (doc?.fills ?? []).find((f: { type?: string }) => f.type === "SOLID");
          if (fill?.color) colors.push({ name: s.name.slice(0, 60), hex: toHex(fill.color) });
        } else if (typeof doc?.style?.fontFamily === "string") {
          families.push(doc.style.fontFamily);
        }
      }
      const fontFamily = mostCommon(families);
      return NextResponse.json({ colors, brandColor: pickBrandColor(colors), fontFamily, brandFont: fontFamily ? nearestFont(fontFamily) : "" });
    } catch (err) {
      if (err instanceof FigmaProblem) return briefError(err.message, 400);
      throw err;
    }
  });
}

class FigmaProblem extends Error {}

const toHex = (c: { r: number; g: number; b: number }) =>
  "#" + [c.r, c.g, c.b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");

const mostCommon = (list: string[]) =>
  list.sort((a, b) => list.filter((x) => x === b).length - list.filter((x) => x === a).length)[0] ?? "";

/** A style named primary / brand / main wins; else the most colourful one. Never orange (the AI's colour). */
function pickBrandColor(colors: { name: string; hex: string }[]) {
  const usable = colors.filter((c) => !isOrange(c.hex));
  const named = usable.find((c) => /primary|brand|main/i.test(c.name));
  if (named) return named.hex;
  const vivid = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return Math.max(r, g, b) - Math.min(r, g, b); // 0 = grey, 1 = pure colour
  };
  return usable.sort((a, b) => vivid(b.hex) - vivid(a.hex))[0]?.hex ?? "";
}

/** A Figma font name → the nearest of our 4 safe families. */
function nearestFont(family: string): FontId {
  if (/mono|code|courier|consol/i.test(family)) return "mono";
  if (/nunito|quicksand|varela|rounded|comfortaa|baloo|fredoka|M PLUS Rounded/i.test(family)) return "rounded";
  if (/serif|georgia|times|garamond|playfair|merriweather|lora|baskerville|didot|bodoni|caslon|crimson|libre/i.test(family) && !/sans/i.test(family)) {
    return "serif";
  }
  return "sans";
}
