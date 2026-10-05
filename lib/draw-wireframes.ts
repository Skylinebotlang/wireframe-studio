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
// ─────────────────────────────────────────────────────────────────────────────

import { createShapeId, toRichText, type Editor, type TLFrameShape, type TLGeoShape, type TLShapeId } from "tldraw";
import type { AgentResult, BoardScreen, ComponentType } from "./agent-schema";

const PHONE_W = 300; // phone frame width
const PHONE_MIN_H = 600; // phone frame minimum height
const PAD = 16; // space inside the frame
const GAP = 10; // space between components
const SCREEN_GAP = 80; // space between phone frames

// How tall each kind of box is, and how it looks. (Tall enough for one line
// of label text; tldraw grows a box whose label doesn't fit, which would
// make it overlap the next one.)
const LOOK: Record<ComponentType, { h: number; geo: TLGeoShape["props"]["geo"]; fill: TLGeoShape["props"]["fill"] }> = {
  header: { h: 56, geo: "rectangle", fill: "solid" },
  text: { h: 48, geo: "rectangle", fill: "none" },
  input: { h: 48, geo: "rectangle", fill: "none" },
  button: { h: 52, geo: "rectangle", fill: "solid" },
  card: { h: 96, geo: "rectangle", fill: "semi" },
  list: { h: 120, geo: "rectangle", fill: "semi" },
  image: { h: 120, geo: "x-box", fill: "none" }, // the classic "image goes here" box
  summary: { h: 88, geo: "rectangle", fill: "semi" },
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

/** Draw the screens: new ones to the right of the board, updated ones in place. */
export function drawWireframes(editor: Editor, result: AgentResult) {
  if (result.action === "ask" || result.screens.length === 0) return;
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
      if (old) editor.deleteShapes([old.id]);
      frameIds.push(frameId);

      // Stack the components top to bottom.
      let cy = PAD;
      const boxes = screen.components.map((c) => {
        const look = LOOK[c.type];
        const box = { c, look, y: cy };
        cy += look.h + GAP;
        return box;
      });
      const frameH = Math.max(PHONE_MIN_H, cy - GAP + PAD);

      editor.createShape({
        id: frameId,
        type: "frame",
        x: at.x,
        y: at.y,
        props: { w: PHONE_W, h: frameH, name: screen.name, color: "orange" },
      });

      editor.createShapes(
        boxes.map(({ c, look, y: by }) => ({
          id: createShapeId(),
          type: "geo",
          parentId: frameId, // inside the phone frame (x/y are relative to it)
          x: PAD,
          y: by,
          props: {
            geo: look.geo,
            w: PHONE_W - PAD * 2,
            h: look.h,
            fill: look.fill,
            color: "grey",
            labelColor: "black",
            size: "s",
            font: "sans",
            richText: toRichText(c.label),
          },
        }))
      );

      if (!old) x += PHONE_W + SCREEN_GAP;
    }
  });

  // Bring the new screens into view for the person who ran the agent.
  editor.select(...frameIds);
  editor.zoomToSelection({ animation: { duration: 400 } });
  editor.selectNone();
}
