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

import { useMemo, useCallback, useState } from "react";
import {
  DefaultToolbar,
  DefaultToolbarContent,
  Editor,
  Tldraw,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
  type TLComponents,
  type TLShapeId,
  type TLUiOverrides,
} from "tldraw";
import "tldraw/tldraw.css";
import { useYjsStore } from "./useYjsStore";
import { AgentPanel } from "./AgentPanel";
import { PromptNoteShapeUtil, PromptNoteTool, type TLPromptNoteShape } from "@/lib/prompt-note";
import { drawWireframes, readBoardScreens, undoWireframes } from "@/lib/draw-wireframes";
import { useAgentPanel } from "@/lib/agent-room";
import type { AgentResult } from "@/lib/agent-schema";
import { useTilt } from "@/lib/tilt";
import type { UserIdentity } from "@/lib/user";

// Defined once, outside the component, so tldraw doesn't rebuild them.
const shapeUtils = [PromptNoteShapeUtil];
const tools = [PromptNoteTool];

// Add the "Prompt note" button to tldraw's toolbar (first in the row).
const uiOverrides: TLUiOverrides = {
  tools(editor, toolItems) {
    toolItems["prompt-note"] = {
      id: "prompt-note",
      icon: "tool-note",
      label: "tool.prompt-note",
      onSelect: () => editor.setCurrentTool("prompt-note"),
    };
    return toolItems;
  },
  translations: { en: { "tool.prompt-note": "Prompt note" } },
};

const components: TLComponents = {
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

  // The shared agent: run status, plan, activity feed and actions.
  const agent = useAgentPanel(identity.name);

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
  const handleSend = useCallback(async () => {
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
    if (!editor) return;
    setMessage("");
    // Send the screens already drawn, so the agent can add, update or ask.
    const problem = await agent.runAgent([], draw, idea, readBoardScreens(editor));
    if (problem) setMessage(problem);
  }, [editor, agent, draw]);

  // ── "Undo last agent run": put the canvas back as it was before it ───────
  const handleUndo = useCallback(() => {
    if (!editor) return;
    const record = agent.takeUndo();
    if (record) undoWireframes(editor, record.created as TLShapeId[], JSON.parse(record.removed));
  }, [editor, agent]);

  return (
    <div className="flex h-screen w-screen">
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
            setEditor(ed);
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
        agent={agent}
        editor={editor}
        message={message}
        onSend={handleSend}
        onIdea={handleIdea}
        onResume={() => agent.resume(draw)}
        onUndo={handleUndo}
      />
    </div>
  );
}
