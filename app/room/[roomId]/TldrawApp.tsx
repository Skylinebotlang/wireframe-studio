"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TLDRAW APP — the whiteboard, now with our custom Prompt Note shape.
//
// The flow:
//   1. useYjsStore builds the synced tldraw store (the bridge to Liveblocks).
//   2. We pass our PromptNoteShapeUtil into that store so tldraw knows about
//      the new shape — this is what makes the "Prompt note" tool appear in
//      the toolbar and the "+" insert menu.
//   3. On top of the canvas we render a small panel with the "Send to agent"
//      button. It reads every prompt-note shape from the store and collects
//      them into a payload. (Milestone 3 will POST that payload to Claude.)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useCallback, useEffect, useState } from "react";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { useYjsStore } from "./useYjsStore";
import { PromptNoteShapeUtil } from "@/lib/prompt-note";
import type { UserIdentity } from "@/lib/user";

export function TldrawApp({ identity }: { identity: UserIdentity }) {
  // Memoize so the bridge only restarts when the identity actually changes.
  const user = useMemo(
    () => ({ id: identity.id, color: identity.color, name: identity.name }),
    [identity.id, identity.color, identity.name]
  );

  // The synced store, now with our custom shape util included.
  const store = useYjsStore({
    shapeUtils: [PromptNoteShapeUtil],
    user,
  });

  // The editor instance, once tldraw has mounted.
  const [editor, setEditor] = useState<any>(null);

  // Expose the editor globally so Milestone 3 (wireframe drawing) and any
  // future tool can grab it without another mount callback.
  useEffect(() => {
    if (editor) {
      (window as any).__tldrawEditor = editor;
    }
  }, [editor]);

  // ── "Send to agent" — collect every prompt note on the board ────────────
  //
  // What it does today (Milestone 2): gather every shape whose type is
  // "prompt-note", read each one's author + role + body text, and hand the
  // list off to a small onSend handler. Right now that handler just logs and
  // shows a friendly confirmation — Milestone 3 replaces it with a real call
  // to our /api/agent route.
  //
  // Why we read directly from the store (not tldraw's editor.findShapes):
  // the store is the source of truth that's already synced via Liveblocks,
  // so we always get the latest set including other people's notes.

  const handleSendToAgent = useCallback(() => {
    if (!store) return;

    // Collect every prompt-note shape currently on the board.
    const notes: Array<{
      id: string;
      authorName: string;
      authorRole: string;
      noteText: string;
    }> = [];

    // Iterate every record in the store; keep the ones that are our note type.
    // `store` is a TLStoreWithStatus — the real TLStore lives on `.store`.
    // (The type doesn't expose allRecords() publicly, but it's there at runtime.)
    const realStore = (store as any).store ?? store;
    for (const record of realStore.allRecords()) {
      if (record.type === "prompt-note") {
        const props = (record as any).props as PromptNoteProps;
        const bodyText = props.richText?.characters || "";
        if (bodyText.trim()) {
          notes.push({
            id: record.id,
            authorName: props.authorName || "unknown",
            authorRole: props.authorRole || "PM",
            noteText: bodyText.trim(),
          });
        }
      }
    }

    if (notes.length === 0) {
      // Friendly nudge: there are no notes yet.
      alert("No prompt notes on the board yet. Drop a Prompt note first!");
      return;
    }

    // For now: log the payload and confirm to the user.
    // Milestone 3 replaces this block with a POST to /api/agent.
    console.log("Send to agent — prompt note payload:", JSON.stringify(notes, null, 2));
    alert(
      `Found ${notes.length} prompt note${notes.length === 1 ? "" : "s"} on the board.\n\n` +
      "That payload is ready to send to the agent — Milestone 3 will wire it up."
    );
  }, [store]);

  return (
    <div className="relative h-screen w-screen">
      {/* The canvas. We hand it our synced store (with the custom shape util
          included) instead of letting tldraw create its own local one — that's
          the whole multiplayer trick. */}
      <Tldraw
        store={store}
        onMount={(editor) => setEditor(editor)}
        autoFocus
      />

      {/* ── Our floating action panel (outside tldraw's chrome) ────────────
          
          This sits in the bottom-left, above the room label, so it's clearly
          ours and always visible. We style it in our design language
          (white surface, hairline border, mono label, blue accent accent).
          
          It only appears once the store is ready and there's an editor.
      */}
      {store && (
        <div
          className="pointer-events-auto absolute bottom-16 left-3 z-50 rounded-lg border border-line bg-paper/95 py-2 px-3 shadow-sm backdrop-blur"
          style={{
            fontFamily: "var(--font-ibm-plex-mono)",
          }}
        >
          {/* Label — mono, uppercase, muted (our technical-look labels). */}
          <div
            className="mb-1.5 text-[10px] uppercase tracking-widest text-muted"
            style={{ letterSpacing: "0.08em" }}
          >
            Agent panel — Milestone 2
          </div>

          {/* The button — blue accent for the action (it's human-initiated).
              Orange is reserved for the agent itself and only appears in
              Milestone 3+ when the agent is actually running. */}
          <button
            onClick={handleSendToAgent}
            className="w-full rounded-md bg-accent py-1.5 font-medium text-white text-xs transition-colors hover:bg-black"
            style={{ fontFamily: "var(--font-ibm-plex-sans)" }}
            disabled={!editor}
          >
            Send to agent
          </button>

          {/* A tiny hint line so it's clear what this does. */}
          <div
            className="mt-1 text-[10px] text-muted"
            style={{
              fontFamily: "var(--font-ibm-plex-mono)",
              letterSpacing: "0.02em",
            }}
          >
            Collects every Prompt note on the board
          </div>
        </div>
      )}

      {/* Room label (existing) — keep it on top so it's always readable. */}
      <div
        className="pointer-events-none fixed bottom-3 left-3 z-50 rounded-md border border-line bg-paper/90 px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-muted backdrop-blur"
      >
        Room:
        <span className="ml-1">{identity ? identity.name : "…"}</span>
        · <a
          href="/"
          className="pointer-events-auto underline hover:text-ink"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/";
          }}
        >
          home
        </a>
      </div>
    </div>
  );
}

// The shape of a prompt note's custom fields, for the collector above.
interface PromptNoteProps {
  authorName: string;
  authorRole: string;
  richText?: { type: string; characters?: string } | null;
}

