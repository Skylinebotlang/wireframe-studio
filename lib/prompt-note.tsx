// ─────────────────────────────────────────────────────────────────────────────
// PROMPT NOTE — a custom tldraw shape: a sticky note that shows who wrote it.
//
// tldraw shapes = two parts:
//   1. The SHAPE TYPE  (TLPromptNoteShape) — the data: where it is, what it
//      says, who wrote it. This is what gets saved + synced over Liveblocks.
//   2. The SHAPE UTIL  (PromptNoteShapeUtil) — how to draw + interact with it.
//
// We model this on tldraw's own NoteShape (in
// node_modules/tldraw/src/lib/shapes/note/NoteShapeUtil.tsx) so it behaves
// like a first-class tldraw shape: selectable, movable, resizable.
//
// Custom fields:
//   authorName  — the person's display name (e.g. "Asha")
//   authorRole  — their role (PM / Designer / Developer)
//   promptText  — what the prompt says (plain text, our own field)
//
// We deliberately do NOT reuse tldraw's richText field here. That keeps this
// shape simple and avoids the rich-text type system entirely — important for
// a prototype. The prompt text is rendered as plain text inside the card; if
// you want to edit it later, Milestone 3's wireframe tools are where the
// interesting editing happens.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ShapeUtil,
  TLDefaultColorStyle,
  TLDefaultSizeStyle,
  TLBaseShape,
  Group2d,
  Rectangle2d,
  IndexKey,
} from "tldraw";

// ── 1. THE SHAPE TYPE ────────────────────────────────────────────────────────
//
// TLBaseShape<"prompt-note", Props> gives us the standard shape record fields:
//   id, type: "prompt-note", typeName: "shape", x, y, rotation, opacity,
//   isLocked, parentId, index, meta — PLUS whatever we put in Props.
//
// We extend tldraw's note props so the shape inherits all the built-in styling
// fields (color, size, align, labelColor, …). That means our prompt note gets
// tldraw's existing selection + resize behavior for free — we only ADD our own
// fields on top.

import type { TLNoteShapeProps } from "tldraw";

export interface PromptNoteProps extends TLNoteShapeProps {
  // Who wrote this note — filled in when the note is created, not editable.
  authorName: string;
  authorRole: string;
  // The prompt itself — plain text. Editable only by re-creating the note.
  promptText: string;
}

// The full shape type. tldraw stores this in the Yjs document and syncs it to
// every browser in the room.
export type TLPromptNoteShape = TLBaseShape<"prompt-note", PromptNoteProps>;

// ── 2. THE SHAPE UTIL ────────────────────────────────────────────────────────
//
// This is what tldraw calls to draw + interact with our shape. The methods
// below are the ones that matter for our note; everything else uses sensible
// defaults from the ShapeUtil base class.

export class PromptNoteShapeUtil extends ShapeUtil<TLPromptNoteShape> {
  // The string that identifies this shape type. tldraw uses it to:
  //   • add a "Prompt note" tool to the toolbar (automatically, once this util
  //     is passed into createTLStore's shapeUtils)
  //   • store shapes with type "prompt-note" in the Yjs document
  //   • recognise our shapes when reading them back from sync
  static override type = "prompt-note" as const;

  // Props descriptor — required by the ShapeUtil base. We keep it minimal; the
  // real default values live in getDefaultProps().
  static override props = {};

  // Default values for a brand-new prompt note.
  override getDefaultProps() {
    return {
      // Light-yellow note colour (feels like a sticky note, readable on white).
      color: "light-yellow" as TLDefaultColorStyle,
      size: "m" as TLDefaultSizeStyle,
      font: "draw" as const,
      align: "start" as const,
      verticalAlign: "top" as const,
      labelColor: "black" as TLDefaultColorStyle,
      growY: 0,
      fontSizeAdjustment: 0,
      url: "",
      scale: 1,
      // Our custom fields — filled in by the tool at creation time.
      authorName: "",
      authorRole: "",
      promptText: "",
    };
  }

  // ── Geometry ──────────────────────────────────────────────────────────────
  //
  // getGeometry tells tldraw where the shape's bounds are, so selection
  // handles, hit-testing, and layout all work. Our note is a fixed-width card
  // with a header strip (author name + role) and a body area (the prompt).
  // The body grows with the text, like a real sticky note.

  override getGeometry(shape: TLPromptNoteShape) {
    const { scale, promptText } = shape.props;

    // Fixed card width, like a sticky note.
    const cardW = 220 * scale;
    // Header strip height.
    const headerH = 36 * scale;
    // Body height: estimate from text length (~55 chars per line, 20px lines).
    const charsPerLine = 55;
    const textLen = promptText?.length || 0;
    const lines = Math.max(1, Math.ceil(textLen / charsPerLine));
    const bodyH = Math.max(60, lines * 20 * scale);
    const totalH = headerH + bodyH;

    return new Group2d({
      children: [
        // The whole card (white, bordered).
        new Rectangle2d({
          width: cardW,
          height: totalH,
          isFilled: true,
        }),
        // Header strip: tinted cyan (the "people" accent).
        new Rectangle2d({
          x: 0,
          y: 0,
          width: cardW,
          height: headerH,
          isFilled: true,
          isLabel: true,
        }),
      ],
    });
  }

  // ── Resize handles ────────────────────────────────────────────────────────
  //
  // Four handles (top/right/bottom/left) so the note can be resized freely.
  // Unlike tldraw's default note (auto-sized), we let people make the card
  // bigger or smaller.

  override getHandles(shape: TLPromptNoteShape): import("tldraw").TLHandle[] {
    const { scale, promptText } = shape.props;
    const textLen = promptText?.length || 0;
    const charsPerLine = 55;
    const lines = Math.max(1, Math.ceil(textLen / charsPerLine));
    const bodyH = Math.max(60, lines * 20 * scale);
    const headerH = 36 * scale;
    const totalH = headerH + bodyH;
    const zoom = this.editor.getZoomLevel();
    const margin = 8 / zoom;
    const cardW = 220 * scale;
    const halfW = cardW / 2;

    return [
      { id: "top" as IndexKey, index: "a1" as IndexKey, type: "clone", x: halfW, y: -margin },
      { id: "right" as IndexKey, index: "a2" as IndexKey, type: "clone", x: halfW + cardW + margin, y: totalH / 2 },
      { id: "bottom" as IndexKey, index: "a3" as IndexKey, type: "clone", x: halfW, y: totalH + margin },
      { id: "left" as IndexKey, index: "a4" as IndexKey, type: "clone", x: -margin, y: totalH / 2 },
    ];
  }

  // ── React rendering ───────────────────────────────────────────────────────
  //
  // component() returns the JSX for the shape — what you see on the canvas.
  //
  // We render:
  //   • a header strip (blue background) with the author's name + role pill
  //   • a body area with the prompt text (plain text, read-only for now)
  //
  // The header only renders when both authorName and authorRole are set. If
  // they're missing (e.g. a note loaded from old data), we still render the
  // card body so the note isn't broken.

  override component(shape: TLPromptNoteShape) {
    const {
      id,
      props: {
        authorName,
        authorRole,
        scale,
        promptText,
      },
    } = shape;

    const cardW = 220 * scale;
    const headerH = 36 * scale;
    const textLen = promptText?.length || 0;
    const charsPerLine = 55;
    const lines = Math.max(1, Math.ceil(textLen / charsPerLine));
    const bodyH = Math.max(60, lines * 20 * scale);
    const totalH = headerH + bodyH;
    const isEmpty = !promptText;

    return (
      <>
        {/* The card body — white, hairline border, subtle shadow. */}
        <div
          id={id}
          style={{
            width: cardW,
            height: totalH,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderTop: "none",
            boxShadow:
              "0 0 18px -6px var(--accent-bright)",
            overflow: "hidden",
            fontFamily: "var(--font-ibm-plex-sans)",
          }}
        >
          {/* Header strip — wine = "people" per our design direction. */}
          {authorName && authorRole && (
            <div
              style={{
                height: headerH,
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                padding: `${6 * scale}px ${10 * scale}px`,
                gap: 6,
                color: "var(--ink)",
                fontFamily: "var(--font-ibm-plex-mono)",
                fontSize: `${10 * scale}px`,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <span style={{ fontWeight: 500 }}>{authorName}</span>
              <span
                style={{
                  background: "rgba(0,0,0,0.18)",
                  borderRadius: 3,
                  padding: `${1 * scale}px ${5 * scale}px`,
                  fontSize: `${9 * scale}px`,
                  fontWeight: 500,
                }}
              >
                {authorRole}
              </span>
            </div>
          )}

          {/* Body area — the prompt text. Shows a placeholder when empty. */}
          <div
            style={{
              padding: `${8 * scale}px ${10 * scale}px`,
              minHeight: bodyH - headerH,
              color: "var(--ink)",
              fontSize: `${13 * scale}px`,
              lineHeight: 1.5,
              outline: "none",
              overflow: "hidden",
            }}
          >
            {isEmpty && (
              <span
                style={{
                  color: "var(--muted)",
                  fontFamily: "var(--font-ibm-plex-mono)",
                  fontSize: `${10 * scale}px`,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                type your prompt…
              </span>
            )}
            {!isEmpty && promptText && (
              <span style={{ whiteSpace: "pre-wrap" }}>{promptText}</span>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── The selection indicator (dashed outline when selected) ────────────────
  //
  // Required by ShapeUtil. We render a simple rect that matches the card size.

  override indicator(shape: TLPromptNoteShape) {
    const { scale, promptText } = shape.props;
    const textLen = promptText?.length || 0;
    const charsPerLine = 55;
    const lines = Math.max(1, Math.ceil(textLen / charsPerLine));
    const bodyH = Math.max(60, lines * 20 * scale);
    const headerH = 36 * scale;
    const totalH = headerH + bodyH;
    const cardW = 220 * scale;
    return (
      <rect
        rx={scale}
        x={-cardW / 2}
        y={-headerH}
        width={cardW}
        height={totalH}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={1 / scale}
        strokeDasharray={`${4 / scale} ${2 / scale}`}
      />
    );
  }

  // ── Creation / updates ────────────────────────────────────────────────────
  //
  // Normalise our custom fields to strings so old or partial data can't break
  // the component.

  override onBeforeCreate(next: TLPromptNoteShape) {
    return {
      ...next,
      props: {
        ...next.props,
        authorName: next.props.authorName || "",
        authorRole: next.props.authorRole || "",
        promptText: next.props.promptText || "",
      },
    };
  }

  override onBeforeUpdate(
    _prev: TLPromptNoteShape,
    next: TLPromptNoteShape
  ) {
    return {
      ...next,
      props: {
        ...next.props,
        authorName: next.props.authorName || "",
        authorRole: next.props.authorRole || "",
        promptText: next.props.promptText || "",
      },
    };
  }

  // ── Small behaviors we borrow from tldraw's own note ─────────────────────

  override canEdit() {
    return true;
  }

  override hideResizeHandles() {
    return false;
  }

  override isAspectRatioLocked() {
    return false;
  }

  override hideSelectionBoundsFg() {
    return false;
  }

  // Plain-text representation (used by search, layers panel, etc.). We return
  // the prompt text so the note shows up meaningfully in tldraw's UIs.
  override getText(shape: TLPromptNoteShape) {
    return shape.props.promptText || "";
  }
}
