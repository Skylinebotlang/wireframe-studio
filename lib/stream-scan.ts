// ─────────────────────────────────────────────────────────────────────────────
// STREAM SCAN — read a half-finished JSON answer while the AI is still typing.
//
// Gemini sends its answer a few words at a time. The text so far is not valid
// JSON yet (it's cut off mid-way), so JSON.parse can't read it. This file
// finds the parts that ARE finished:
//   • which action the agent picked ("add" | "update" | "ask")
//   • whether the list of clashes is complete, and how many there are
//   • whether the merge paragraph ("resolution") is complete
//   • every screen whose { … } has closed, so it can be drawn right away
// The server (app/api/agent/route.ts) turns these into progress events.
// Self-check: node --experimental-strip-types lib/stream-scan.check.ts
// ─────────────────────────────────────────────────────────────────────────────

export type ScanResult = {
  action?: "add" | "update" | "ask";
  clashes?: number; // set once the "conflicts" list has closed
  merged: boolean; // the "resolution" text has closed
  screens: unknown[]; // complete screen objects, in order
};

export function scanPartial(text: string): ScanResult {
  const action = text.match(/"action"\s*:\s*"(add|update|ask)"/)?.[1] as ScanResult["action"];
  const conflicts = arrayItems(text, "conflicts");
  return {
    action,
    clashes: conflicts?.closed ? conflicts.items.length : undefined,
    // ponytail: a regex for "resolution": "…" closed; good enough because the
    // closing quote of a JSON string is never preceded by an odd backslash run.
    merged: /"resolution"\s*:\s*"(?:[^"\\]|\\.)*"/.test(text),
    screens: (arrayItems(text, "screens")?.items ?? []).flatMap((raw) => {
      try {
        return [JSON.parse(raw)];
      } catch {
        return [];
      }
    }),
  };
}

/**
 * Find `"key": [ … ]` and return the raw text of each COMPLETE item, plus
 * whether the list itself has closed. Walks the text one character at a
 * time, tracking strings (so brackets inside labels don't count) and depth.
 */
function arrayItems(text: string, key: string): { items: string[]; closed: boolean } | null {
  const m = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(text);
  if (!m) return null;
  const items: string[] = [];
  let depth = 0; // depth inside the list: 0 = between items
  let start = -1;
  let inString = false;
  for (let i = m.index + m[0].length; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++; // skip the escaped character
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      if (depth === 0) start = i; // a plain string item
    } else if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" || ch === "]") {
      if (depth === 0) return { items, closed: true }; // the list's own "]"
      depth--;
      if (depth === 0) items.push(text.slice(start, i + 1));
    }
  }
  return { items, closed: false };
}
