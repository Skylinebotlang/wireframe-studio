"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TLDRAW APP — the whiteboard, with our custom Prompt Note shape.
//
// The flow:
//   1. useYjsStore builds the synced tldraw store (the bridge to Liveblocks).
//   2. We pass our PromptNoteShapeUtil into that store so tldraw knows about
//      the new shape.
//   3. On top of the canvas we render a small glass panel with the
//      "Send to agent" button. It collects every note on the board.
//   4. While the agent works, an orange scanning laser sweeps the canvas in
//      EVERY window in the room (shared via a Liveblocks broadcast).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useCallback, useEffect, useState } from "react";
import { Editor, Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { useBroadcastEvent, useEventListener } from "@liveblocks/react/suspense";
import { useYjsStore } from "./useYjsStore";
import { PromptNoteShapeUtil } from "@/lib/prompt-note";
import { useTilt } from "@/lib/tilt";
import type { UserIdentity } from "@/lib/user";

// How long the preview scan runs. Milestone 3 replaces this with the real
// agent call: busy = true when the request starts, false when it finishes.
const PREVIEW_SCAN_MS = 3500;

export function TldrawApp({ identity }: { identity: UserIdentity }) {
  // Memoize so the bridge only restarts when the identity actually changes.
  const user = useMemo(
    () => ({ id: identity.id, color: identity.color, name: identity.name }),
    [identity.id, identity.color, identity.name]
  );

  // The synced store, with our custom shape util included.
  const store = useYjsStore({
    shapeUtils: [PromptNoteShapeUtil],
    user,
  });

  // The editor instance, once tldraw has mounted.
  const [editor, setEditor] = useState<Editor | null>(null);

  // Toolbar buttons and our panel lean toward the pointer (see lib/tilt.ts).
  useTilt();

  // Expose the editor globally so Milestone 3 (wireframe drawing) and any
  // future tool can grab it without another mount callback.
  useEffect(() => {
    if (editor) (window as unknown as { __tldrawEditor: Editor }).__tldrawEditor = editor;
  }, [editor]);

  // ── Agent status, shared with everyone in the room ──────────────────────
  // We set it locally AND broadcast it, so every window shows the laser.
  // (Someone who joins mid-run won't see it until the next run; Milestone 4's
  // agent panel will keep this in shared storage instead.)
  const [agent, setAgent] = useState({ busy: false, by: "" });
  const broadcast = useBroadcastEvent();
  useEventListener(({ event }) => {
    if (event.type === "agent-status") setAgent({ busy: event.busy, by: event.by });
  });
  const setAgentStatus = useCallback(
    (busy: boolean) => {
      const status = { busy, by: identity.name };
      setAgent(status);
      broadcast({ type: "agent-status", ...status });
    },
    [broadcast, identity.name]
  );

  // ── "Send to agent" — collect every note on the board ───────────────────
  // We read both our Prompt notes and tldraw's regular sticky notes, since
  // the regular note tool (press N) is what people can drop today.
  const handleSendToAgent = useCallback(() => {
    if (!editor || agent.busy) return;

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
      alert("No notes on the board yet. Drop a note (press N) and type a prompt first!");
      return;
    }

    // Milestone 3 replaces this block with a POST to /api/agent.
    console.log("Send to agent — note payload:", JSON.stringify(notes, null, 2));
    setAgentStatus(true);
    setTimeout(() => setAgentStatus(false), PREVIEW_SCAN_MS);
  }, [editor, agent.busy, setAgentStatus]);

  return (
    <div className="relative h-screen w-screen">
      {/* The canvas. We hand it our synced store instead of letting tldraw
          create its own local one — that's the whole multiplayer trick. */}
      <Tldraw
        store={store}
        onMount={(ed) => {
          // Cyberpunk theme: run tldraw in its dark mode.
          ed.user.updateUserPreferences({ colorScheme: "dark" });
          setEditor(ed);
        }}
        autoFocus
      />

      {/* Orange scanning laser + status pill while the agent works. */}
      {agent.busy && (
        <>
          <div className="agent-scan" />
          <div className="pop-in pointer-events-none absolute left-1/2 top-14 z-50 -translate-x-1/2 rounded-full border border-agent/40 bg-paper/80 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-agent backdrop-blur">
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-agent align-middle" />
            Agent is reading the board · started by {agent.by}
          </div>
        </>
      )}

      {/* ── Our floating action panel (outside tldraw's chrome) ────────────
          Glass surface, springs in on load, tilts toward the pointer. */}
      <div className="glass pop-in tilt pointer-events-auto absolute bottom-16 left-3 z-50 rounded-lg px-3 py-2">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
          Agent
        </div>

        {/* Cyan = a human action. Orange appears only while the agent works. */}
        <button
          onClick={handleSendToAgent}
          disabled={!editor || agent.busy}
          className={`w-full rounded-md px-3 py-1.5 text-xs font-medium text-paper transition-colors ${
            agent.busy ? "bg-agent" : "bg-accent hover:brightness-110"
          }`}
        >
          {agent.busy ? "Agent working…" : "Send to agent"}
        </button>

        <div className="mt-1 font-mono text-[10px] text-muted">
          Collects every note on the board
        </div>
      </div>
    </div>
  );
}
