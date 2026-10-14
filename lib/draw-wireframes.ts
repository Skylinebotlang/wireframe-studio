// ─────────────────────────────────────────────────────────────────────────────
// DRAW WIREFRAMES — turn the agent's answer into shapes on the canvas.
//
// Each screen becomes a phone-sized tldraw FRAME (outlined orange, because
// the agent made it), and each component inside it becomes a simple grey
// box with its label. They're normal canvas shapes, so they sync to everyone
// in the room through the same Yjs bridge as the notes, and people can move
// or edit them afterwards.
//
// When the agent's action is "update", a screen whose name matches a phone
// frame already on the board replaces that frame in the same spot. "ask"
// draws nothing. `readBoardScreens` reads the frames back for the agent.
// `drawWireframes` reports what it created and replaced, and
// `undoWireframes` uses that to put the canvas back as it was.
// ─────────────────────────────────────────────────────────────────────────────

import { Box, createShapeId, toRichText, type Editor, type TLFrameShape, type TLGeoShape, type TLShape, type TLShapeId } from "tldraw";
import type { AgentResult, BoardScreen, ComponentType } from "./agent-schema";
import { layoutScreen, PHONE_W } from "./layout";

const SCREEN_GAP = 80; // space between phone frames

// How each kind of box looks. (Sizes and positions: lib/layout.ts.)
const LOOK: Record<ComponentType, { geo: TLGeoShape["props"]["geo"]; fill: TLGeoShape["props"]["fill"] }> = {
  header: { geo: "rectangle", fill: "solid" },
  text: { geo: "rectangle", fill: "none" },
  input: { geo: "rectangle", fill: "none" },
  button: { geo: "rectangle", fill: "solid" },
  card: { geo: "rectangle", fill: "semi" },
  list: { geo: "rectangle", fill: "semi" },
  image: { geo: "x-box", fill: "none" }, // the classic "image goes here" box
  summary: { geo: "rectangle", fill: "semi" },
  tabbar: { geo: "rectangle", fill: "semi" },
};

// Every frame on the page, by lowercase name.
function framesByName(editor: Editor) {
  const frames = new Map<string, TLFrameShape>();
  for (const s of editor.getCurrentPageShapes()) {
    if (s.type === "frame") frames.set((s as TLFrameShape).props.name.trim().toLowerCase(), s as TLFrameShape);
  }
  return frames;
}

/** The screens on the board (each frame's name + box texts), for the agent. */
export function readBoardScreens(editor: Editor): BoardScreen[] {
  return [...framesByName(editor).values()].map((f) => ({
    name: f.props.name,
    labels: editor
      .getSortedChildIdsForParent(f.id)
      .map((id) => editor.getShape(id))
      .map((c) => (c ? (editor.getShapeUtil(c).getText(c) ?? "").trim() : ""))
      .filter(Boolean),
  }));
}

// What one drawing changed: new frame ids, and the shapes it replaced.
export type DrawRecord = { created: TLShapeId[]; removed: TLShape[] };

/** Draw the screens: new ones to the right of the board, updated ones in place. */
export function drawWireframes(editor: Editor, result: AgentResult): DrawRecord {
  const record: DrawRecord = { created: [], removed: [] };
  if (result.action === "ask" || result.screens.length === 0) return record;
  const existing = editor.getCurrentPageBounds();
  let x = existing ? existing.maxX + 120 : 0;
  const y = existing ? existing.minY : 0;
  const frameIds: TLShapeId[] = [];
  const onBoard = result.action === "update" ? framesByName(editor) : new Map<string, TLFrameShape>();

  editor.run(() => {
    for (const screen of result.screens) {
      const frameId = createShapeId();
      // "update": take the old frame's spot, then remove it (and its boxes).
      const old = onBoard.get(screen.name.trim().toLowerCase());
      const at = old ? { x: old.x, y: old.y } : { x, y };
      if (old) {
        // Keep a copy of the old frame and its boxes, for undo.
        for (const id of editor.getShapeAndDescendantIds([old.id])) {
          const shape = editor.getShape(id);
          if (shape) record.removed.push(structuredClone(shape));
        }
        editor.deleteShapes([old.id]);
      }
      frameIds.push(frameId);

      // Rows, grids and the tab bar: see lib/layout.ts.
      const { boxes, height } = layoutScreen(screen.components);

      editor.createShape({
        id: frameId,
        type: "frame",
        x: at.x,
        y: at.y,
        props: { w: PHONE_W, h: height, name: screen.name, color: "orange" },
      });

      editor.createShapes(
        boxes.map((b) => {
          const scale = labelScale(b.label, b.w, b.h);
          return {
          id: createShapeId(),
          type: "geo",
          parentId: frameId, // inside the phone frame (x/y are relative to it)
          x: b.x,
          y: b.y,
          props: {
            geo: LOOK[b.c.type].geo,
            w: b.w,
            h: b.h,
            scale, // shrinks only the label text, not the box
            fill: LOOK[b.c.type].fill,
            color: "grey",
            labelColor: "black",
            size: "s",
            dash: "solid", // clean straight lines, not tldraw's hand-drawn wobble
            font: "sans",
            richText: toRichText(b.label),
          },
          };
        })
      );

      if (!old) x += PHONE_W + SCREEN_GAP;
    }
  });

  // Bring the new screens into view for the person who ran the agent, with
  // a margin (about 170px a side) so they don't sit under the style panel (top-right) or the
  // toolbar (bottom). Never zoom in past 100%.
  const bounds = Box.Common(frameIds.map((id) => editor.getShapePageBounds(id)!).filter(Boolean));
  if (frameIds.length) editor.zoomToBounds(bounds, { inset: 340, targetZoom: 1, animation: { duration: 400 } });
  record.created = frameIds;
  return record;
}

/**
 * Undo an agent run: remove the frames it drew (with everything inside them,
 * including later hand edits) and put back the frames it replaced.
 */
export function undoWireframes(editor: Editor, created: TLShapeId[], removed: TLShape[]) {
  editor.run(() => {
    editor.deleteShapes(created.filter((id) => editor.getShape(id)));
    // Parents (frames) first, then the boxes that sit inside them.
    const back = removed.filter((s) => !editor.getShape(s.id));
    const isTop = (s: TLShape) => !back.some((p) => p.id === s.parentId);
    editor.createShapes([...back.filter(isTop), ...back.filter((s) => !isTop(s))]);
  });
}

// Small boxes (tab-bar tabs, half-width cards) can't fit their label at
// tldraw's smallest text size, so words broke mid-word ("Das / hbo"). Shrink
// the label (down to 60%) until its longest word fits on a line and the whole
// label fits in the lines the box has room for.
// ponytail: estimates text width from character count (about 13px a letter
// at size "s"); measure real text if labels with very wide letters still clip.
export function labelScale(label: string, w: number, h: number): number {
  const CHAR = 13, LINE = 28, SIDE = 20;
  const longestWord = Math.max(1, ...label.split(/\s+/).map((word) => word.length));
  const lines = Math.max(1, Math.floor(h / LINE));
  const need = Math.max(longestWord, Math.ceil(label.length / lines)) * CHAR;
  return Math.max(0.6, Math.min(1, (w - SIDE) / need));
}
