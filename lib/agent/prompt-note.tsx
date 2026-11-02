// ─────────────────────────────────────────────────────────────────────────────
// PROMPT NOTE — a sticky note that shows who wrote it.
//
// tldraw custom shapes have three parts, all in this file:
//   1. The SHAPE (TLPromptNoteShape): the data that's saved and synced:
//      size, the prompt text, and the author's name / role / color.
//   2. The SHAPE UTIL (PromptNoteShapeUtil): how to draw it and edit it.
//      Double-click a note (or press Enter) to type in it.
//   3. The TOOL (PromptNoteTool): the toolbar button. Click it, then click
//      or drag on the canvas to drop a note. The author is filled in
//      automatically from your sign-in (see TldrawApp.tsx).
// ─────────────────────────────────────────────────────────────────────────────

import {
  BaseBoxShapeTool,
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type RecordProps,
  type TLBaseShape,
} from "tldraw";

// ── 1. THE SHAPE ─────────────────────────────────────────────────────────────
export type TLPromptNoteShape = TLBaseShape<
  "prompt-note",
  {
    w: number;
    h: number;
    text: string; // the prompt itself
    authorName: string; // e.g. "Asha"
    authorRole: string; // e.g. "PM"
    authorColor: string; // the author's cursor color (hex)
  }
>;

// ── 2. THE SHAPE UTIL ────────────────────────────────────────────────────────
export class PromptNoteShapeUtil extends BaseBoxShapeUtil<TLPromptNoteShape> {
  static override type = "prompt-note" as const;

  // Validators: tldraw checks every synced note against these, so a broken
  // record can't crash the canvas.
  static override props: RecordProps<TLPromptNoteShape> = {
    w: T.number,
    h: T.number,
    text: T.string,
    authorName: T.string,
    authorRole: T.string,
    authorColor: T.string,
  };

  override getDefaultProps(): TLPromptNoteShape["props"] {
    return { w: 240, h: 150, text: "", authorName: "", authorRole: "", authorColor: "#c2475f" };
  }

  // Double-click / Enter turns on typing mode.
  override canEdit() {
    return true;
  }

  // Used by search, and by "Send to agent" to read the note.
  override getText(shape: TLPromptNoteShape) {
    return shape.props.text;
  }

  override component(shape: TLPromptNoteShape) {
    const { w, h, text, authorName, authorRole, authorColor } = shape.props;
    const isEditing = this.editor.getEditingShapeId() === shape.id;

    return (
      <HTMLContainer
        style={{
          width: w,
          height: h,
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          boxShadow: "0 0 18px -6px var(--accent-bright)",
          overflow: "hidden",
          fontFamily: "var(--font-ibm-plex-sans), sans-serif",
          // Only catch clicks while typing, so normal dragging still works.
          pointerEvents: isEditing ? "all" : "none",
        }}
      >
        {/* Header strip: wine = people. Author's color dot, name and role. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            background: "var(--accent)",
            color: "var(--ink)",
            fontFamily: "var(--font-ibm-plex-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 99, background: authorColor }} />
          <span style={{ fontWeight: 500 }}>{authorName || "Someone"}</span>
          {authorRole && (
            <span style={{ background: "rgba(0,0,0,0.25)", borderRadius: 3, padding: "1px 5px" }}>
              {authorRole}
            </span>
          )}
        </div>

        {/* Body: a text box while typing, plain text otherwise. */}
        {isEditing ? (
          <textarea
            autoFocus
            value={text}
            placeholder="Type your prompt…"
            onChange={(e) =>
              this.editor.updateShape<TLPromptNoteShape>({
                id: shape.id,
                type: "prompt-note",
                props: { text: e.target.value },
              })
            }
            // Stop tldraw from treating typing as keyboard shortcuts.
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") this.editor.setEditingShape(null);
            }}
            style={{
              flex: 1,
              resize: "none",
              border: 0,
              outline: "none",
              padding: "8px 10px",
              background: "transparent",
              color: "var(--ink)",
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: "inherit",
            }}
          />
        ) : (
          <div
            style={{
              flex: 1,
              padding: "8px 10px",
              color: text ? "var(--ink)" : "var(--muted)",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              overflow: "hidden",
            }}
          >
            {text || "Double-click to type your prompt…"}
          </div>
        )}
      </HTMLContainer>
    );
  }

  // The outline shown when the note is selected.
  override indicator(shape: TLPromptNoteShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />;
  }
}

// ── 3. THE TOOL ──────────────────────────────────────────────────────────────
// Click on the canvas = a default-size note; drag = a note of that size.
export class PromptNoteTool extends BaseBoxShapeTool {
  static override id = "prompt-note";
  static override initial = "idle";
  override shapeType = "prompt-note" as const;
}
