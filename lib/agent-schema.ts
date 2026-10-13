// ─────────────────────────────────────────────────────────────────────────────
// AGENT ANSWER FORMAT — the "contract" between the AI and the canvas.
//
// Claude must reply in exactly this shape. The server route
// (app/api/agent/route.ts) checks every answer with `validateAgentResult`
// BEFORE sending it to the browser, so the canvas never tries to draw
// something broken.
//
// Shape of a valid answer:
//   {
//     conflicts:  [{ noteIds: ["shape:a", "shape:b"], summary: "PM wants X, designer wants Y" }],
//     resolution: "One paragraph explaining how the notes were merged.",
//     screens:    [{ name: "Home", components: [{ type: "header", label: "Welcome", notes: "" }] }],
//     action:     "add" | "update" | "ask",
//     question:   ""   (only for "ask": what the agent wants to know)
//   }
//
// action: "add"    → draw the screens as new phone frames
//         "update" → a screen with the same name as one on the board
//                    replaces it in place; other screens are added
//         "ask"    → the agent wasn't sure; it draws nothing and shows
//                    `question` in the panel instead
// ─────────────────────────────────────────────────────────────────────────────

// The only building blocks a wireframe can use. Each one is drawn as a
// simple grey box on the canvas.
export const COMPONENT_TYPES = [
  "header",
  "text",
  "input",
  "button",
  "card",
  "list",
  "image",
  "summary",
  "tabbar", // label "Home | Search | Profile" → tabs along the bottom
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export type WireframeComponent = {
  type: ComponentType;
  label: string; // what the box says, e.g. "Sign in"
  notes?: string; // optional detail, e.g. "primary action"
  // 2 or 3 = sits side by side with neighbours that have the same number
  // (a row of buttons, a grid of cards). 1 or missing = full width.
  columns?: 1 | 2 | 3;
};

export type Screen = {
  name: string; // e.g. "Dashboard"
  components: WireframeComponent[]; // top-to-bottom order
};

export type Conflict = {
  noteIds: string[]; // which notes disagree (tldraw shape ids)
  summary: string; // why they disagree, in plain words
};

export const AGENT_ACTIONS = ["add", "update", "ask"] as const;
export type AgentAction = (typeof AGENT_ACTIONS)[number];

export type AgentResult = {
  conflicts: Conflict[];
  resolution: string;
  screens: Screen[];
  action: AgentAction;
  question: string; // "" unless action is "ask"
};

// A screen already on the canvas, sent along with a typed idea so the agent
// can decide between adding and updating. Read from the canvas, so it
// includes people's hand edits.
export type BoardScreen = {
  name: string;
  labels: string[]; // the text in each box, top to bottom
};

// What the browser sends to the agent: one entry per note on the board.
export type AgentNote = {
  id: string;
  authorName: string;
  authorRole: string;
  noteText: string;
};

// JSON Schema version of AgentResult. Claude's "submit_wireframes" tool uses
// this, so Claude is guided to answer in the right shape.
// (`notes` is always present here; Claude sends "" when there's nothing to add.)
export const AGENT_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["conflicts", "resolution", "screens", "action", "question"],
  properties: {
    action: { type: "string", enum: [...AGENT_ACTIONS] },
    question: { type: "string" },
    conflicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["noteIds", "summary"],
        properties: {
          noteIds: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
        },
      },
    },
    resolution: { type: "string" },
    screens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "components"],
        properties: {
          name: { type: "string" },
          components: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "label", "notes", "columns"],
              properties: {
                type: { type: "string", enum: [...COMPONENT_TYPES] },
                label: { type: "string" },
                notes: { type: "string" },
                columns: { type: "integer", enum: [1, 2, 3] },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Check that `data` really is a valid AgentResult.
 * Returns the cleaned-up result, or an error message saying what's wrong.
 * (We check by hand instead of adding a validation library — it's short.)
 */
export function validateAgentResult(
  data: unknown
): { ok: true; result: AgentResult } | { ok: false; error: string } {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const isText = (v: unknown): v is string => typeof v === "string";

  if (!isObj(data)) return { ok: false, error: "Answer is not an object." };

  const { conflicts, resolution, screens } = data;
  // Older answers had no action: treat them as "add".
  const action = (data.action ?? "add") as AgentAction;
  const question = isText(data.question) ? data.question.trim() : "";
  if (!AGENT_ACTIONS.includes(action)) return { ok: false, error: `Unknown action "${String(action)}".` };
  if (action === "ask" && !question) return { ok: false, error: "The agent wanted to ask, but gave no question." };

  if (!Array.isArray(conflicts)) return { ok: false, error: "'conflicts' must be a list." };
  for (const c of conflicts) {
    if (!isObj(c) || !isText(c.summary) || !Array.isArray(c.noteIds) || !c.noteIds.every(isText)) {
      return { ok: false, error: "A conflict is missing its summary or note ids." };
    }
  }

  // A question needs no screens or merge paragraph; anything else does.
  if (action !== "ask" && (!isText(resolution) || !resolution.trim())) {
    return { ok: false, error: "'resolution' must be a non-empty paragraph." };
  }
  if (!Array.isArray(screens) || (action !== "ask" && screens.length === 0)) {
    return { ok: false, error: "'screens' must be a non-empty list." };
  }
  for (const s of screens) {
    if (!isObj(s) || !isText(s.name) || !s.name.trim()) {
      return { ok: false, error: "Every screen needs a name." };
    }
    if (!Array.isArray(s.components) || s.components.length === 0) {
      return { ok: false, error: `Screen "${s.name}" has no components.` };
    }
    for (const comp of s.components) {
      if (!isObj(comp) || !isText(comp.label)) {
        return { ok: false, error: `A component on "${s.name}" has no label.` };
      }
      if (!COMPONENT_TYPES.includes(comp.type as ComponentType)) {
        return { ok: false, error: `Unknown component type "${String(comp.type)}" on "${s.name}".` };
      }
      if (comp.columns !== undefined && ![1, 2, 3].includes(comp.columns as number)) {
        return { ok: false, error: `Component columns on "${s.name}" must be 1, 2 or 3.` };
      }
      if (comp.notes !== undefined && !isText(comp.notes)) {
        return { ok: false, error: `Component notes on "${s.name}" must be text.` };
      }
    }
  }

  // Rebuild the result so only known fields reach the canvas.
  return {
    ok: true,
    result: {
      conflicts: (conflicts as Conflict[]).map((c) => ({
        noteIds: c.noteIds,
        summary: c.summary,
      })),
      resolution: isText(resolution) ? resolution.trim() : "",
      action,
      question: action === "ask" ? question : "",
      // "ask" never draws, so drop any screens that came with it.
      screens: (action === "ask" ? [] : (screens as Screen[])).map((s) => ({
        name: s.name.trim(),
        components: s.components.map((comp) => ({
          type: comp.type,
          label: comp.label,
          ...(comp.notes ? { notes: comp.notes } : {}),
          ...(comp.columns && comp.columns > 1 ? { columns: comp.columns } : {}),
        })),
      })),
    },
  };
}
