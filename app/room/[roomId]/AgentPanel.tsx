"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AGENT PANEL — the right-hand column of the workspace. Everyone in the room
// sees the same thing, because it all reads from the shared agent state in
// Liveblocks (lib/agent-room.ts):
//
//   • status + "Send to agent" / Pause / Resume / Take over / Undo last run
//   • the plan, with progress ticks
//   • clash cards: what clashed, how the agent merged it, and buttons to use
//     one person's version instead (applied on the next run)
//   • "Frame your idea": type an idea and the agent draws it right away
//   • "Make it real": turn the wireframes into real designs (stage 2), or
//     redo one selected design with a short instruction
//   • the activity feed: who did what, and which AI ran ("Run by papi using Gemini")
//
// Colors: wine = people's actions. ORANGE only when the agent itself is
// working or speaking.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { Editor } from "tldraw";
import type { useAgentPanel } from "@/lib/agent-room";
import { AiKeyButton } from "../../AiKeyButton";

type Agent = ReturnType<typeof useAgentPanel>;

export function AgentPanel({
  agent,
  editor,
  message,
  onSend,
  onIdea,
  onResume,
  onUndo,
  onMakeReal,
  pickedDesign,
}: {
  agent: Agent;
  editor: Editor | null;
  message: string; // a note for this person only (e.g. "No notes yet")
  onSend: () => void;
  onIdea: (idea: string) => void;
  onResume: () => void;
  onUndo: () => void;
  onMakeReal: (instruction: string) => void;
  pickedDesign: string | null; // name of the one design selected (Regenerate), or null
}) {
  const { run, activity } = agent;
  const [idea, setIdea] = useState("");
  const [instruction, setInstruction] = useState("");
  const working = run.status === "working";
  const paused = run.status === "paused";
  const asking = run.status === "done" && run.result?.action === "ask";

  // Who wrote each clashing note, read from the notes on the canvas.
  const authorOf = (noteId: string) => {
    const shape = editor?.getShape(noteId as Parameters<Editor["getShape"]>[0]);
    const name = (shape?.props as { authorName?: string } | undefined)?.authorName;
    return name || null;
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-line bg-surface text-ink">
      {/* ── Header: title, status, key button ─────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="font-heading text-sm tracking-wide">Agent</h2>
          <StatusLine run={run} />
        </div>
        <AiKeyButton />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* ── Frame your idea: the main way to make mockups ────────────────── */}
        <section>
          <Label>Frame your idea</Label>
          {/* The agent wasn't sure: its question, in orange (the agent speaking). */}
          {asking && (
            <p className="mb-2 border-l-2 border-agent pl-2.5 text-xs leading-relaxed text-ink">
              <span className="font-mono text-[10px] uppercase tracking-widest text-agent">Agent asks · </span>
              {run.result?.question}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!idea.trim()) return;
              onIdea(idea);
              setIdea("");
            }}
            className="space-y-1.5"
          >
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter makes a new line.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={3}
              maxLength={1000}
              placeholder={asking ? "Type your answer…" : "e.g. a sign-up flow for a dog-walking app"}
              className="w-full resize-none rounded-md border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none focus:border-accent-bright"
            />
            <button
              disabled={!editor || working || paused || !idea.trim()}
              className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Frame it
            </button>
          </form>
        </section>

        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <button
            onClick={onSend}
            disabled={!editor || working || paused}
            className={`w-full rounded-md px-3 py-2 text-sm text-ink transition-colors disabled:cursor-not-allowed ${
              working ? "bg-agent" : "border border-line bg-raised hover:border-accent-bright disabled:opacity-50"
            }`}
          >
            {working ? "Agent working…" : "Send notes to agent"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            {paused ? (
              <SmallButton onClick={onResume}>Resume</SmallButton>
            ) : (
              <SmallButton onClick={agent.pause} disabled={!working}>
                Pause
              </SmallButton>
            )}
            <SmallButton onClick={agent.takeOver} disabled={!working && !paused}>
              Take over
            </SmallButton>
          </div>
          {agent.undo && !working && !paused && (
            <SmallButton onClick={onUndo}>
              Undo last agent run ({agent.undo.screens} screen{agent.undo.screens === 1 ? "" : "s"} by {agent.undo.by})
            </SmallButton>
          )}
          {message && <p className="text-xs text-accent-bright">{message}</p>}
          {run.status === "error" && run.error && <p className="text-xs text-accent-bright">⚠ {run.error}</p>}
        </section>

        {/* ── Make it real: wireframes → real designs (stage 2) ─────────────── */}
        <section className="space-y-1.5">
          <Label>Make it real</Label>
          <p className="text-[11px] leading-snug text-muted">
            {pickedDesign
              ? `Redo the ${pickedDesign} design. Say what to change, or leave it empty.`
              : "Turns the wireframes (or the frames you select) into real designs. Select a design to redo it."}
          </p>
          {pickedDesign && (
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={300}
              placeholder={`e.g. make ${pickedDesign} darker`}
              className="w-full rounded-md border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none focus:border-accent-bright"
            />
          )}
          <button
            onClick={() => {
              onMakeReal(pickedDesign ? instruction : "");
              setInstruction("");
            }}
            disabled={!editor || working || paused}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pickedDesign ? `Regenerate ${pickedDesign}` : "Make it real"}
          </button>
        </section>

        {/* ── Plan + progress ──────────────────────────────────────────────── */}
        <section>
          <Label>Plan</Label>
          <ol className="space-y-1 text-xs">
            {run.steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${
                    s.state === "done"
                      ? "border-accent-bright bg-accent text-ink"
                      : s.state === "working"
                        ? "animate-pulse border-agent text-agent"
                        : "border-line text-muted"
                  }`}
                >
                  {s.state === "done" ? "✓" : ""}
                </span>
                <span className={s.state === "todo" ? "text-muted" : "text-ink"}>{s.label}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Clash cards + how it merged ──────────────────────────────────── */}
        {run.result && run.result.action !== "ask" && (
          <section>
            <Label>Clashes ({run.result.conflicts.length})</Label>
            {run.result.conflicts.length === 0 && <p className="text-xs text-muted">No clashes between the notes.</p>}
            <div className="space-y-2">
              {run.result.conflicts.map((c, i) => {
                const authors = [...new Set(c.noteIds.map(authorOf).filter((a): a is string => !!a))];
                return (
                  <div key={i} className="rounded-md border border-line bg-raised p-2.5 text-xs">
                    <p className="leading-relaxed">{c.summary}</p>
                    {authors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {authors.map((who) => (
                          <button
                            key={who}
                            onClick={() => agent.pick(c.summary, who)}
                            className="rounded border border-accent-bright/60 px-2 py-0.5 text-[11px] text-ink hover:bg-accent"
                          >
                            Use {who}&apos;s version
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 border-l-2 border-agent pl-2.5 text-xs leading-relaxed text-ink">
              <span className="font-mono text-[10px] uppercase tracking-widest text-agent">How I merged it · </span>
              {run.result.resolution}
            </div>
          </section>
        )}

        {/* ── Activity feed ────────────────────────────────────────────────── */}
        <section>
          <Label>Activity</Label>
          {activity.length === 0 && <p className="text-xs text-muted">Nothing yet.</p>}
          <ul className="space-y-1.5">
            {[...activity].reverse().map((a) => (
              <li key={a.id} className="text-xs leading-snug">
                <span className="mr-1.5 font-mono text-[10px] text-muted">
                  {new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {/* Orange = the agent speaking; everything else is people. */}
                <span className={a.who === "Agent" ? "text-agent" : "text-ink"}>
                  {(a.kind === "steer" || a.kind === "prompt") && <b className="font-medium">{a.who}: </b>}
                  {a.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}

function StatusLine({ run }: { run: Agent["run"] }) {
  const text: Record<Agent["run"]["status"], string> = {
    idle: "Idle",
    working: `Working · started by ${run.startedBy}`,
    paused: `Paused · started by ${run.startedBy}`,
    done: `Done · ${run.startedBy}${run.provider ? ` using ${run.provider}` : ""}`,
    error: "Last run failed",
  };
  const agentActive = run.status === "working" || run.status === "paused";
  return (
    <p className={`font-mono text-[10px] uppercase tracking-widest ${agentActive ? "text-agent" : "text-muted"}`}>
      {agentActive && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-agent align-middle" />}
      {text[run.status]}
    </p>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">{children}</h3>;
}

function SmallButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-line bg-raised px-2 py-1.5 text-xs text-ink transition-colors hover:border-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
