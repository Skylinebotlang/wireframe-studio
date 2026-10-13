"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SHAPE — a "Make it real" mockup on the canvas (stage 2).
//
// A phone-sized card, outlined in the agent's orange (the AI made it), that
// shows one design from the room's `designs` map (lib/agent-design-room.ts).
// The shape itself only stores the design's id, so the big HTML stays out of
// the canvas's Yjs history; Regenerate swaps the HTML and every window updates.
//
// SAFETY (the second lock; the server already checked the HTML): the page is
// checked again here (anyone in the room can edit Storage), then shown in an
// <iframe sandbox=""> via srcdoc: no scripts, no same-origin, no forms, no
// navigation. A Content-Security-Policy added to the page blocks ALL network
// loading (only inline styles and data: images/fonts). The iframe ignores the
// mouse, so the canvas still drags and selects it like any shape.
// ─────────────────────────────────────────────────────────────────────────────

import { useStorage } from "@liveblocks/react/suspense";
import { BaseBoxShapeUtil, HTMLContainer, T, type Editor, type RecordProps, type TLBaseShape, type TLFrameShape } from "tldraw";
import { checkDesignHtml, PHONE_CSS_H, PHONE_CSS_W } from "./agent-design";

const DESIGN_W = 300; // same width as a wireframe phone frame
const DESIGN_H = Math.round((DESIGN_W * PHONE_CSS_H) / PHONE_CSS_W);
const GAP_BELOW = 60; // space between a wireframe and its design

const CSP =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">`;

export type TLDesignShape = TLBaseShape<
  "design",
  {
    w: number;
    h: number;
    designId: string; // key in the room's `designs` map
    name: string; // the wireframe screen it was made from
  }
>;

export class DesignShapeUtil extends BaseBoxShapeUtil<TLDesignShape> {
  static override type = "design" as const;

  static override props: RecordProps<TLDesignShape> = {
    w: T.number,
    h: T.number,
    designId: T.string,
    name: T.string,
  };

  override getDefaultProps(): TLDesignShape["props"] {
    return { w: DESIGN_W, h: DESIGN_H, designId: "", name: "" };
  }

  override isAspectRatioLocked() {
    return true; // a phone stays phone-shaped when resized
  }

  override getText(shape: TLDesignShape) {
    return shape.props.name;
  }

  override component(shape: TLDesignShape) {
    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: "all" }}>
        <DesignView {...shape.props} />
      </HTMLContainer>
    );
  }

  override indicator(shape: TLDesignShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={18} ry={18} />;
  }
}

function DesignView({ w, h, designId, name }: TLDesignShape["props"]) {
  const record = useStorage((root) => root.designs?.[designId] ?? null); // (a LiveMap reads as a plain object here)
  const checked = record ? checkDesignHtml(record.html) : null;
  const scale = w / PHONE_CSS_W;

  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        borderRadius: 18,
        outline: "2px solid var(--agent, #ff6b2c)", // orange = made by the AI
        boxShadow: "0 0 24px -8px var(--agent, #ff6b2c)",
        background: "var(--raised, #191a2f)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -22,
          left: 0,
          font: "500 11px var(--font-mono, monospace)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--agent, #ff6b2c)",
          whiteSpace: "nowrap",
        }}
      >
        {name} · design
      </span>
      <div style={{ width: w, height: h, overflow: "hidden", borderRadius: 18 }}>
        {checked?.ok ? (
          <iframe
            title={`${name} design`}
            sandbox=""
            srcDoc={withCsp(checked.html)}
            style={{
              width: PHONE_CSS_W,
              height: h / scale,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              pointerEvents: "none",
              background: "#fff",
            }}
          />
        ) : (
          <p style={{ margin: 0, padding: 16, font: "12px var(--font-sans, sans-serif)", color: "var(--muted, #9e99a8)" }}>
            {record
              ? "This design didn't pass the safety check, so it isn't shown. Regenerate it."
              : "This design is no longer saved (only the newest ones are kept). Select its wireframe and press Make it real."}
          </p>
        )}
      </div>
    </div>
  );
}

// Put the network-blocking rule at the very top of the page's <head>.
function withCsp(html: string) {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + CSP);
  return html.replace(/<html[^>]*>/i, (m) => m + CSP);
}

// ── Placing designs ─────────────────────────────────────────────────────────

const designShapes = (editor: Editor) =>
  editor.getCurrentPageShapes().filter((s): s is TLDesignShape => s.type === "design");

/** The design id already used for this screen's design (so a redo replaces it), or a new one. */
export function designIdFor(editor: Editor, screenName: string) {
  const key = screenName.trim().toLowerCase();
  return designShapes(editor).find((s) => s.props.name.trim().toLowerCase() === key)?.props.designId ?? crypto.randomUUID();
}

/**
 * Show a saved design on the canvas, below its wireframe frame. If a shape
 * for this design is already there (Regenerate, or making it real again), it
 * just updates by itself, because it reads the design from the room.
 */
export function placeDesign(editor: Editor, designId: string, screenName: string) {
  if (designShapes(editor).some((s) => s.props.designId === designId)) return;
  const key = screenName.trim().toLowerCase();
  const frame = editor
    .getCurrentPageShapes()
    .find((s): s is TLFrameShape => s.type === "frame" && (s as TLFrameShape).props.name.trim().toLowerCase() === key);
  const page = editor.getCurrentPageBounds();
  editor.createShape<TLDesignShape>({
    type: "design",
    x: frame ? frame.x : page ? page.maxX + 120 : 0,
    y: frame ? frame.y + frame.props.h + GAP_BELOW : page ? page.minY : 0,
    props: { w: DESIGN_W, h: DESIGN_H, designId, name: screenName },
  });
}

/** The design shape the person has selected (for Regenerate), or null. */
export function selectedDesign(editor: Editor): TLDesignShape | null {
  const [only, ...more] = editor.getSelectedShapes();
  return only?.type === "design" && more.length === 0 ? (only as TLDesignShape) : null;
}
