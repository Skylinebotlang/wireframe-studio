"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TLDRAW APP — the workspace: shared canvas on the left, agent panel on the right.
//
// The flow:
//   1. useYjsStore builds the synced tldraw store (the bridge to Liveblocks),
//      so everyone in the room sees the same shapes and cursors.
//   2. The toolbar gets a "Prompt note" tool (lib/prompt-note.tsx). New notes
//      are stamped with the author's name, role and color automatically.
//   3. "Send to agent" (in the panel) collects every note on the board and
//      runs the real agent through the shared agent state (lib/agent-room.ts).
//   4. The agent's screens are drawn as phone frames (lib/draw-wireframes.ts),
//      which sync to everyone like any other shape.
//   5. While the agent works, an orange scanning laser sweeps the canvas in
//      every window, driven by the shared run status.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import {
  DefaultColorThemePalette,
  DefaultStylePanel,
  DefaultToolbar,
  DefaultFillStyle,
  DefaultToolbarContent,
  Editor,
  Tldraw,
  TldrawUiMenuItem,
  useEditor,
  useIsToolSelected,
  useTools,
  useTransform,
  useValue,
  type TLComponents,
  type TLShapeId,
  type TLUiOverrides,
} from "tldraw";
import "tldraw/tldraw.css";
import { useYjsStore } from "./useYjsStore";
import { AgentPanel } from "./AgentPanel";
import { RoomBar } from "./RoomBar";
import { useParams } from "next/navigation";
import { useBoardTeam } from "@/lib/board-role";
import { PromptNoteShapeUtil, PromptNoteTool, type TLPromptNoteShape } from "@/lib/prompt-note";
import { drawWireframes, fitBoardLabels, readBoardScreens, undoWireframes } from "@/lib/draw-wireframes";
import { useAgentPanel, useTeamColors } from "@/lib/agent-room";
import { useDesignPanel } from "@/lib/agent-design-room";
import { DesignShapeUtil, designIdFor, placeDesign, selectedDesign } from "@/lib/design-shape";
import type { AgentResult } from "@/lib/agent-schema";
import { useTilt } from "@/lib/tilt";
import type { UserIdentity } from "@/lib/user";

// Defined once, outside the component, so tldraw doesn't rebuild them.
const shapeUtils = [PromptNoteShapeUtil, DesignShapeUtil];
const tools = [PromptNoteTool];

// Wireframe boxes are tldraw "grey" shapes inside phone frames. tldraw's
// dark theme paints them silver on pure black, which looks harsh; recolor
// them to soft navies from our palette so wireframes read as calm blocks.
// tldraw needs raw hex here (not CSS variables); keep these in step with
// the tokens in app/globals.css (--surface, --raised, --line).
const dark = DefaultColorThemePalette.darkMode;
dark.solid = "#191a2f"; // the "semi" fill (cards, lists) is based on this
dark.grey.solid = "#4a4866"; // outlines + solid fills (headers, buttons)
dark.grey.fill = "#4a4866";
dark.grey.semi = "#2b2a42"; // solid-fill boxes (headers, buttons) use this in dark mode
for (const c of Object.values(dark)) {
  // Every color's phone-frame background + title tab.
  if (typeof c === "object" && "frame" in c) {
    Object.assign(c.frame, { fill: "#131224", stroke: "#2b2a42", headingFill: "#191a2f", headingStroke: "#2b2a42" });
  }
}

// Add the "Prompt note" button to tldraw's toolbar (first in the row).
const uiOverrides: TLUiOverrides = {
  tools(editor, toolItems) {
    toolItems["prompt-note"] = {
      id: "prompt-note",
      icon: "comment", // speech bubble, so it never looks like tldraw's plain Note
      label: "tool.prompt-note",
      onSelect: () => editor.setCurrentTool("prompt-note"),
    };
    return toolItems;
  },
  translations: { en: { "tool.prompt-note": "Prompt note" } },
};

const components: TLComponents = {
  // A teammate's drag-select box. tldraw's own draws it at ~7% strength,
  // which reads as a dark/black box on our navy canvas. Draw it in their
  // cursor color: light fill, clear outline.
  CollaboratorBrush: ({ brush, color }) => {
    const ref = useRef<SVGSVGElement>(null);
    useTransform(ref as React.RefObject<SVGSVGElement>, brush.x, brush.y); // tldraw's own brush does the same
    const w = Math.max(1, brush.w);
    const h = Math.max(1, brush.h);
    return (
      <svg className="tl-overlays__item" ref={ref} aria-hidden="true">
        <rect width={w} height={h} fill={color ?? "#c2475f"} fillOpacity={0.15} stroke={color ?? "#c2475f"} className="tl-brush" />
      </svg>
    );
  },
  Toolbar: (props) => {
    const toolItems = useTools();
    const isSelected = useIsToolSelected(toolItems["prompt-note"]);
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...toolItems["prompt-note"]} isSelected={isSelected} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    );
  },
  // tldraw's color/style panel: only while there is something to style (a
  // selection, or a drawing tool picked). Otherwise it sat open top-right,
  // eating canvas space next to the agent panel.
  StylePanel: (props) => {
    const editor = useEditor();
    const show = useValue(
      "style panel needed",
      () => editor.getSelectedShapeIds().length > 0 || !editor.isIn("select"),
      [editor]
    );
    return show ? <DefaultStylePanel {...props} /> : null;
  },
  // (The board name and "My boards" now live in the top bar: RoomBar.tsx.)
};

export function TldrawApp({ identity }: { identity: UserIdentity }) {
  // Memoize so the bridge only restarts when the identity actually changes.
  const user = useMemo(
    () => ({ id: identity.id, color: identity.color, name: identity.name }),
    [identity.id, identity.color, identity.name]
  );

  // The synced store, with our custom shape included.
  const store = useYjsStore({ shapeUtils, user });

  // The editor instance, once tldraw has mounted.
  const [editor, setEditor] = useState<Editor | null>(null);

  // True while the board has nothing on it (shows the "what to do first" hint).
  const isEmpty = useValue("board is empty", () => !!editor && editor.getCurrentPageShapeIds().size === 0, [editor]);

  // The shared agent: run status, plan, activity feed and actions.
  const agent = useAgentPanel(identity.name);
  // Each teammate's cursor color, for their lines in the feed and decision log.
  const colorOf = useTeamColors(identity.name, identity.color);
  // My role on this board (Owner / Editor / Viewer) and the member list.
  const { roomId } = useParams<{ roomId: string }>();
  const team = useBoardTeam(roomId);
  const viewer = team.me === "viewer";
  // Viewers can look but not change the canvas. (Liveblocks also refuses
  // their changes on the server; this just stops the tools from pretending.)
  useEffect(() => {
    editor?.updateInstanceState({ isReadonly: viewer });
  }, [editor, viewer]);

  // A message for this person only (e.g. "No notes yet").
  const [message, setMessage] = useState("");

  // Toolbar buttons lean toward the pointer (see lib/tilt.ts).
  useTilt();

  // Put the agent's screens on the canvas.
  const draw = useCallback((result: AgentResult) => {
    if (editor) return drawWireframes(editor, result);
  }, [editor]);

  // ── "Send to agent": collect every note on the board ─────────────────────
  // Reads our Prompt notes and tldraw's plain sticky notes (press N).
  // What this person last asked for, so "Retry" can ask again.
  const [lastAsk, setLastAsk] = useState<{ idea: string } | "notes" | "design" | null>(null);

  const handleSend = useCallback(async () => {
    setLastAsk("notes");
    if (!editor) return;
    setMessage("");

    const notes = editor
      .getCurrentPageShapes()
      .filter((s) => s.type === "prompt-note" || s.type === "note")
      .map((s) => {
        const props = s.props as { authorName?: string; authorRole?: string };
        return {
          id: s.id,
          authorName: props.authorName || "unknown",
          authorRole: props.authorRole || "unknown",
          noteText: (editor.getShapeUtil(s).getText(s) ?? "").trim(),
        };
      })
      .filter((n) => n.noteText);

    if (notes.length === 0) {
      setMessage("No notes on the board yet. Add a prompt note from the toolbar and type in it first.");
      return;
    }

    const problem = await agent.runAgent(notes, draw);
    if (problem) setMessage(problem);
  }, [editor, agent, draw]);

  // ── "Frame your idea": run the agent on the typed idea alone ─────────────
  const handleIdea = useCallback(async (idea: string) => {
    setLastAsk({ idea });
    if (!editor) return;
    setMessage("");
    // Send the screens already drawn, so the agent can add, update or ask.
    const problem = await agent.runAgent([], draw, idea, readBoardScreens(editor));
    if (problem) setMessage(problem);
  }, [editor, agent, draw]);

  // ── "Make it real" (stage 2): wireframes → real mockups ──────────────────
  const design = useDesignPanel(identity.name);
  // The one design shape selected, if any: the panel then offers Regenerate.
  const pickedDesign = useValue("picked design", () => (editor ? selectedDesign(editor) : null), [editor]);
  const handleMakeReal = useCallback(async (instruction: string) => {
    if (!editor) return;
    setMessage("");
    const place = (designId: string, name: string) => placeDesign(editor, designId, name);
    let problem: string | null;
    if (pickedDesign) {
      problem = await design.regenerate(pickedDesign.props.designId, instruction, place);
    } else {
      // The selected wireframe frames, or every frame on the board.
      const picked = new Set(editor.getSelectedShapes().filter((s) => s.type === "frame").map((s) => (s.props as { name: string }).name));
      const board = readBoardScreens(editor).filter((s) => picked.size === 0 || picked.has(s.name));
      problem = await design.makeReal(board, (name) => designIdFor(editor, name), place);
    }
    if (problem) setMessage(problem);
  }, [editor, design, pickedDesign]);

  // Retry: redo only the designs that failed last time (same style guide).
  const handleRetryDesign = useCallback(async () => {
    if (!editor) return;
    setMessage("");
    const problem = await design.retryFailed((designId, name) => placeDesign(editor, designId, name));
    if (problem) setMessage(problem);
  }, [editor, design]);

  // ── "Undo last agent run": put the canvas back as it was before it ───────
  const handleUndo = useCallback(() => {
    if (!editor) return;
    const record = agent.takeUndo();
    if (record) undoWireframes(editor, record.created as TLShapeId[], JSON.parse(record.removed));
  }, [editor, agent]);

  return (
    <div className="relative flex h-screen w-screen flex-col">
      {/* ── Top bar: board name, Share, AI key, profile ─────────────────────── */}
      <RoomBar team={team} myId={identity.id} colorOf={colorOf} />
      <div className="flex min-h-0 flex-1">
      {/* ── The canvas (left) ─────────────────────────────────────────────── */}
      <div className="relative min-w-0 flex-1">
        <Tldraw
          store={store}
          shapeUtils={shapeUtils}
          tools={tools}
          overrides={uiOverrides}
          components={components}
          onMount={(ed) => {
            // Cyberpunk theme: run tldraw in its dark mode.
            ed.user.updateUserPreferences({ colorScheme: "dark" });
            // New rectangles/shapes start see-through (outline only), so you
            // can always see what's under them. People can still pick a fill.
            ed.setStyleForNextShapes(DefaultFillStyle, "none");
            setEditor(ed);
            // Old boards: fix wireframe labels drawn before they learned to fit.
            fitBoardLabels(ed);
            // Handy for debugging in the browser console (dev only).
            if (process.env.NODE_ENV === "development") {
              (window as unknown as { editor: Editor }).editor = ed;
            }

            // Stamp new prompt notes with who made them.
            return ed.sideEffects.registerBeforeCreateHandler("shape", (shape, source) => {
              if (source !== "user" || shape.type !== "prompt-note") return shape;
              const note = shape as TLPromptNoteShape;
              if (note.props.authorName) return shape;
              return {
                ...note,
                props: {
                  ...note.props,
                  authorName: identity.name,
                  authorRole: identity.role,
                  authorColor: identity.color,
                },
              };
            });
          }}
          autoFocus
        />

        {/* Empty board: tell people what to do first. Disappears as soon as
            anything is on the canvas. Clicks pass through to the canvas. */}
        {isEmpty && agent.run.status !== "working" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="glass pop-in max-w-sm rounded-2xl px-6 py-5 text-center">
              <p className="font-heading text-lg text-ink">Start your board</p>
              <ol className="mt-3 space-y-2 text-left text-sm text-muted">
                <li>
                  <span className="mr-2 font-mono text-wine-light">1</span>
                  Drop a <span className="text-ink">prompt note</span> (first button in the toolbar below) with what
                  you want. Teammates add theirs too.
                </li>
                <li>
                  <span className="mr-2 font-mono text-wine-light">2</span>
                  Press <span className="text-ink">Use canvas notes</span> in the panel on the right, and the agent
                  merges every note into wireframes.
                </li>
              </ol>
              <p className="mt-3 text-xs text-muted">Or just describe a screen in the panel →</p>
            </div>
          </div>
        )}

        {/* Orange scanning laser + status pill while the agent works. */}
        {agent.run.status === "working" && (
          <>
            <div className="agent-scan" />
            <div className="pop-in pointer-events-none absolute left-1/2 top-14 z-50 -translate-x-1/2 rounded-full border border-agent/40 bg-paper/80 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-agent backdrop-blur">
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-agent align-middle" />
              {agent.run.steps.find((s) => s.state === "working")?.label ?? "Agent is designing"} · started by {agent.run.startedBy}
            </div>
          </>
        )}
      </div>

      {/* ── The agent panel (right) ───────────────────────────────────────── */}
      <AgentPanel
        myName={identity.name}
        colorOf={colorOf}
        readOnly={viewer}
        agent={agent}
        editor={editor}
        message={message}
        onSend={handleSend}
        onIdea={handleIdea}
        // Retry the failed run with whatever AI key is set NOW (switch keys
        // in "Your AI key" first if one provider is down).
        onRetry={
          lastAsk === "design"
            ? design.failed
              ? handleRetryDesign
              : undefined
            : lastAsk
              ? () => (lastAsk === "notes" ? handleSend() : handleIdea(lastAsk.idea))
              : undefined
        }
        // Some designs failed but others worked: offer to redo just those.
        retryDesigns={lastAsk === "design" && agent.run.status === "done" ? design.failed : 0}
        onResume={() => agent.resume(draw)}
        onUndo={handleUndo}
        onMakeReal={handleMakeReal}
        pickedDesign={pickedDesign?.props.name ?? null}
      />
      </div>
    </div>
  );
}
