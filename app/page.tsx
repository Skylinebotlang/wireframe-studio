"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE — a friendly front door.
//
// Type a room name (or hit the button for "demo") and go straight to the
// shared canvas. This page does NOT connect to Liveblocks; rooms do.
// ─────────────────────────────────────────────────────────────────────────────

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openRoom() {
    const slug = (room || "demo").trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,64}$/.test(slug)) {
      setError("Use letters, numbers, dashes or underscores only.");
      return;
    }
    router.push(`/room/${slug}`);
  }

  return (
    <main className="dot-grid flex min-h-screen items-center justify-center p-6">
      <div className="glass pop-in w-full max-w-md rounded-xl p-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
          Multiplayer AI workspace
        </p>
        <h1 className="mt-2 neon-text font-heading text-3xl font-semibold leading-tight text-ink">
          Wireframe Studio
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A shared canvas for PMs, designers and developers. Drop prompt notes,
          and an AI teammate merges them into wireframes — live, together.
        </p>

        <div className="mt-6 flex gap-2">
          <input
            className="w-full rounded-md border border-line bg-raised px-3 py-2 text-ink outline-none placeholder:text-muted focus:border-accent"
            placeholder="room name (try: demo)"
            value={room}
            onChange={(e) => {
              setRoom(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && openRoom()}
          />
          <button
            onClick={openRoom}
            className="shrink-0 rounded-md bg-accent px-4 py-2 font-medium text-ink shadow-[0_0_18px_-4px_var(--accent-bright)] transition hover:brightness-110"
          >
            Open room →
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-agent">{error}</p>}

        <p className="mt-6 border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-muted">
          TIP — to test multiplayer: open this site in two browser windows,
          join the same room name, and watch the cursors.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          On the canvas: drop a <strong>Prompt note</strong> (toolbar → the yellow
          note tool, or press <code className="font-mono text-[11px]">N</code>),
          type your prompt, and everyone sees it live. Hit <strong>Send to agent</strong>
          (bottom-left) to collect every note for the AI (Milestone 3).
        </p>
      </div>
    </main>
  );
}
