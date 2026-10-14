"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AGENT PANEL — the right-hand column of the workspace. Everyone in the room
// sees the same thing, because it all reads from the shared agent state in
// Liveblocks (lib/agent-room.ts).
//
// Top to bottom:
//   1. Header: "Agent", its status, and the "Your AI key" button.
//   2. Composer: type an idea and press Enter (chat style). Under it, two
//      quieter actions: "Use canvas notes" and "Make it real".
//   3. Run card (only while something is happening): plan progress,
//      Pause / Resume / Take over, Undo last run, errors + Retry.
//   4. Clash cards from the last run, with "Use X's version" buttons.
//   5. Two tabs: Activity (who did what) and Decisions (kept forever).
//
// Colors: wine = people. ORANGE only when the agent itself is working or
// speaking (its avatar, its status, its question, "How I merged it").
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { Editor } from "tldraw";
import type { useAgentPanel } from "@/lib/agent-room";
import { AiKeyButton } from "../../AiKeyButton";
import { DecisionLog, dayLabel } from "./DecisionLog";

type Agent = ReturnType<typeof useAgentPanel>;

export function AgentPanel({
  agent,
  editor,
  message,
  onSend,
  onIdea,
  onResume,
  onUndo,
  onRetry,
  onMakeReal,
  pickedDesign,
  myName,
}: {
  agent: Agent;
  editor: Editor | null;
  message: string; // a note for this person only (e.g. "No notes yet")
  onSend: () => void;
  onIdea: (idea: string) => void;
  onResume: () => void;
  onUndo: () => void;
  onRetry?: () => void; // set when this person started the run that failed
  onMakeReal: (instruction: string) => void;
  pickedDesign: string | null; // name of the one design selected (Regenerate), or null
  myName: string; // this person's display name (their own lines say "You")
}) {
  const { run, activity } = agent;
  const [idea, setIdea] = useState("");
  const [instruction, setInstruction] = useState("");
  const [tab, setTab] = useState<"activity" | "decisions">("activity");
  const working = run.status === "working";
  const paused = run.status === "paused";
  const busy = !editor || working || paused;
  const asking = run.status === "done" && run.result?.action === "ask";
  const showRunCard = working || paused || run.status === "error" || !!message || !!agent.undo;

  // Who wrote each clashing note, read from the notes on the canvas.
  const authorOf = (noteId: string) => {
    const shape = editor?.getShape(noteId as Parameters<Editor["getShape"]>[0]);
    const name = (shape?.props as { authorName?: string } | undefined)?.authorName;
    return name || null;
  };

  const sendIdea = () => {
    if (!idea.trim() || busy) return;
    onIdea(idea);
    setIdea("");
  };

  const makeReal = () => {
    if (busy) return;
    onMakeReal(pickedDesign ? instruction : "");
    setInstruction("");
  };

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-line bg-surface text-ink max-md:w-full max-md:rounded-t-2xl max-md:border-l-0 max-md:border-t max-md:shadow-2xl">
      {/* ── 1. Header ───────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <AgentAvatar active={working || paused} />
          <div>
            <h2 className="font-heading text-sm leading-none tracking-wide">Agent</h2>
            <StatusLine run={run} />
          </div>
        </div>
        <AiKeyButton />
      </header>

      {/* pb-16: room at the bottom so the "Powered by Liveblocks" badge
          (bottom-right, free plan) never covers the last lines. */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-16">
        {/* ── 2. Composer ───────────────────────────────────────────────── */}
        <section>
          {/* The agent wasn't sure: its question (the agent speaking). */}
          {asking && (
            <div className="mb-2 flex gap-2">
              <AgentAvatar small />
              <p className="rounded-lg rounded-tl-sm bg-raised px-3 py-2 text-xs leading-relaxed">
                {run.result?.question}
              </p>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendIdea();
            }}
            className="rounded-xl border border-line bg-paper/60 transition-colors focus-within:border-accent-bright/70"
          >
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter makes a new line.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendIdea();
                }
              }}
              rows={3}
              maxLength={1000}
              aria-label="Describe what to design"
              placeholder={asking ? "Type your answer…" : "Describe a screen or flow… e.g. a sign-up flow for a dog-walking app"}
              className="block w-full resize-none bg-transparent px-3 pt-3 text-[13px] leading-relaxed text-ink outline-none placeholder:text-muted/70"
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="pl-1 font-mono text-[10px] text-muted/80" title="Shift+Enter for a new line">
                Enter ↵ to send
              </span>
              <button
                type="submit"
                aria-label="Frame it"
                title="Frame it"
                disabled={busy || !idea.trim()}
                className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent px-3 text-xs font-medium text-ink transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Frame it
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>

          {/* Two quieter ways in. */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <QuietButton onClick={onSend} disabled={busy} title="Read every note on the canvas, settle clashes, and draw">
              <NotesIcon /> Use canvas notes
            </QuietButton>
            <QuietButton
              onClick={makeReal}
              disabled={busy}
              title={pickedDesign ? `Redo the ${pickedDesign} design` : "Turn the wireframes (or the selected frames) into real designs"}
            >
              <SparkIcon /> {pickedDesign ? `Redo ${pickedDesign}` : "Make it real"}
            </QuietButton>
          </div>
          {pickedDesign && (
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              // Enter = same as clicking "Redo" (unless a run is going).
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  makeReal();
                }
              }}
              maxLength={300}
              aria-label={`What to change in ${pickedDesign}`}
              placeholder={`What to change? e.g. make ${pickedDesign} darker`}
              className="mt-2 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-xs text-ink outline-none placeholder:text-muted/70 focus:border-accent-bright/70"
            />
          )}
        </section>

        {/* ── 3. Run card: only while something is happening ─────────────── */}
        {showRunCard && (
          <section className="space-y-3 rounded-xl border border-line bg-raised/60 p-3">
            {(working || paused) && (
              <>
                <ol className="space-y-1.5 text-xs">
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
                <div className="grid grid-cols-2 gap-2">
                  {paused ? (
                    <QuietButton onClick={onResume}>Resume</QuietButton>
                  ) : (
                    <QuietButton onClick={agent.pause}>Pause</QuietButton>
                  )}
                  <QuietButton onClick={agent.takeOver}>Take over</QuietButton>
                </div>
              </>
            )}
            {agent.undo && !working && !paused && (
              <QuietButton onClick={onUndo} full>
                <UndoIcon /> Undo last run · {agent.undo.screens} screen{agent.undo.screens === 1 ? "" : "s"} by {agent.undo.by}
              </QuietButton>
            )}
            {message && <p className="text-xs leading-relaxed text-wine-light">{message}</p>}
            {run.status === "error" && run.error && (
              <div className="space-y-2">
                <p className="flex gap-2 text-xs leading-relaxed text-ink">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-bright" aria-hidden />
                  {run.error}
                </p>
                {onRetry && (
                  <>
                    <QuietButton onClick={onRetry} full>Retry</QuietButton>
                    <p className="font-mono text-[10px] text-muted">Tip: switch AI under “Key” if one keeps failing.</p>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── 4. Clash cards + how it merged ─────────────────────────────── */}
        {run.result && run.result.action !== "ask" && run.result.conflicts.length > 0 && (
          <section className="space-y-2">
            <Label>Clashes in the last run · {run.result.conflicts.length}</Label>
            {run.result.conflicts.map((c, i) => {
              const authors = [...new Set(c.noteIds.map(authorOf).filter((a): a is string => !!a))];
              return (
                <div key={i} className="rounded-xl border border-line bg-raised/60 p-3 text-xs">
                  <p className="leading-relaxed">{c.summary}</p>
                  {authors.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {authors.map((who) => (
                        <button
                          key={who}
                          onClick={() => agent.pick(c.summary, who)}
                          className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink transition-colors hover:border-accent-bright hover:bg-accent/40"
                        >
                          Use {who}&apos;s version
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2 pt-1">
              <AgentAvatar small />
              <p className="rounded-lg rounded-tl-sm bg-raised px-3 py-2 text-xs leading-relaxed">
                <span className="mb-0.5 block font-mono text-[10px] uppercase tracking-widest text-agent">How I merged it</span>
                {run.result.resolution}
              </p>
            </div>
          </section>
        )}

        {/* ── 5. Activity / Decisions tabs ───────────────────────────────── */}
        <section>
          <div role="tablist" className="mb-3 flex gap-1 rounded-lg bg-paper/60 p-1">
            {(["activity", "decisions"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-1.5 text-xs capitalize transition-colors ${
                  tab === t ? "bg-raised text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "activity" ? (
            <ActivityFeed activity={activity} myName={myName} />
          ) : (
            <DecisionLog
              trigger={activity.filter((a) => a.kind === "result" || a.kind === "pick").at(-1)?.id ?? ""}
            />
          )}
        </section>
      </div>
    </aside>
  );
}

// ── Activity: what people asked for, what the agent made, and housekeeping,
// each with its own weight so the feed is easy to scan when you join late:
//   - People's ideas and picks: a bubble with the words they wrote.
//   - The agent's results (and errors): a line with the orange star.
//   - Housekeeping (started, paused, took over, undo): one small grey line.
// Grouped by day (Today / Yesterday / date). Filter: All, Ideas, Mine.
const IDEA_KINDS = new Set(["prompt", "steer", "pick", "question"]);
const AGENT_KINDS = new Set(["result", "error", "design"]);
type Filter = "all" | "ideas" | "mine";

function ActivityFeed({ activity, myName }: { activity: Agent["activity"]; myName: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  if (activity.length === 0) {
    return <p className="py-6 text-center text-xs text-muted">Nothing yet. Frame an idea to get started.</p>;
  }
  const shown = [...activity].reverse().filter((a) =>
    filter === "ideas" ? IDEA_KINDS.has(a.kind) : filter === "mine" ? a.who === myName : true
  );
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {(["all", "ideas", "mine"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize transition-colors ${
              filter === f ? "border-accent-bright/50 bg-accent/40 text-ink" : "border-line text-muted hover:text-ink"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="py-6 text-center text-xs text-muted">
          {filter === "mine" ? "You haven't done anything on this board yet." : "No ideas written yet."}
        </p>
      )}
      <ol className="space-y-2.5">
        {shown.map((a, i, all) => {
          const day = dayLabel(a.at);
          const divider = i === 0 || dayLabel(all[i - 1].at) !== day;
          const mine = a.who === myName;
          const name = mine ? "You" : a.who;
          const time = new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const clamp = open.has(a.id) ? "" : "line-clamp-3";
          const isAgentLine = a.who === "Agent";
          // The name is already shown above the text, so drop it from the
          // start of the line ("papi asked the agent to..." -> "asked the agent to...").
          const text = a.text.startsWith(a.who + " ") ? a.text.slice(a.who.length + 1) : a.text;
          let row: React.ReactNode;

          // A person asking for designs ("Make it real") counts as their idea.
          if (IDEA_KINDS.has(a.kind) || (a.kind === "design" && !isAgentLine)) {
            // A person's own words: the thing you most want to find again.
            const isAgent = a.who === "Agent"; // the agent's questions
            row = (
              <div className="flex gap-2.5">
                {isAgent ? <AgentAvatar small /> : <PersonAvatar name={a.who} />}
                <button onClick={() => toggle(a.id)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-baseline gap-2 text-[11px]">
                    <span className={`font-medium ${isAgent ? "text-agent" : "text-ink"}`}>{name}</span>
                    <span className="text-muted">
                      {a.kind === "pick" ? "" : a.kind === "question" ? "asked" : a.kind === "design" ? "" : "wrote"}
                    </span>
                    <time className="ml-auto shrink-0 font-mono text-[10px] text-muted">{time}</time>
                  </span>
                  <span
                    className={`mt-1 block rounded-lg rounded-tl-sm border px-2.5 py-1.5 text-xs leading-relaxed text-ink ${clamp} ${
                      isAgent ? "border-agent/25 bg-agent/5" : mine ? "border-accent-bright/30 bg-accent/25" : "border-line bg-raised/60"
                    }`}
                  >
                    {a.kind === "prompt" || a.kind === "question" ? a.text : text}
                  </span>
                </button>
              </div>
            );
          } else if (AGENT_KINDS.has(a.kind) && isAgentLine) {
            row = (
              <div className="flex gap-2.5">
                <AgentAvatar small />
                <button onClick={() => toggle(a.id)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-baseline gap-2 text-[11px]">
                    <span className="font-medium text-agent">Agent</span>
                    <time className="ml-auto shrink-0 font-mono text-[10px] text-muted">{time}</time>
                  </span>
                  <span className={`mt-0.5 block text-xs leading-relaxed ${a.kind === "error" ? "text-wine-light" : "text-ink/85"} ${clamp}`}>
                    {text}
                  </span>
                </button>
              </div>
            );
          } else {
            // Housekeeping: small and quiet, lined up with the text above.
            row = (
              <p className="flex items-baseline gap-2 pl-[34px] text-[11px] leading-snug text-muted/80">
                <span className="min-w-0 flex-1">{mine && a.text.startsWith(myName + " ") ? "You " + text : a.text}</span>
                <time className="shrink-0 font-mono text-[10px]">{time}</time>
              </p>
            );
          }

          return (
            <li key={a.id}>
              {divider && (
                <div className="mb-2.5 mt-1 flex items-center gap-2 text-[10px] text-muted">
                  <span className="h-px flex-1 bg-line" />
                  {day}
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              {row}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StatusLine({ run }: { run: Agent["run"] }) {
  const text: Record<Agent["run"]["status"], string> = {
    idle: "Ready",
    working: `Designing · ${run.startedBy}`,
    paused: `Paused · ${run.startedBy}`,
    done: `Done${run.provider ? ` · ${run.provider}` : ""}`,
    error: "Last run failed",
  };
  const agentActive = run.status === "working" || run.status === "paused";
  return (
    <p className={`mt-1 font-mono text-[10px] uppercase tracking-widest ${agentActive ? "text-agent" : "text-muted"}`}>
      {text[run.status]}
    </p>
  );
}

// The agent's avatar: an orange star (orange = the agent only).
function AgentAvatar({ small, active }: { small?: boolean; active?: boolean }) {
  const size = small ? "h-6 w-6" : "h-8 w-8";
  return (
    <span
      className={`relative flex ${size} shrink-0 items-center justify-center rounded-full bg-agent/15 text-agent ring-1 ring-agent/30`}
      aria-hidden
    >
      <svg width={small ? 11 : 14} height={small ? 11 : 14} viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0l1.9 6.1L16 8l-6.1 1.9L8 16l-1.9-6.1L0 8l6.1-1.9z" />
      </svg>
      {active && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-agent" />}
    </span>
  );
}

// A person's avatar: their initial on wine.
function PersonAvatar({ name }: { name: string }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-medium uppercase text-ink"
      aria-hidden
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">{children}</h3>;
}

function QuietButton({
  children,
  onClick,
  disabled,
  title,
  full,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  full?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center gap-1.5 rounded-lg border border-line bg-raised/40 px-2.5 py-2 text-xs text-ink transition-colors hover:border-accent-bright/70 hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40 ${
        full ? "w-full" : ""
      }`}
    >
      {children}
    </button>
  );
}

// Small line icons (inline so there's nothing extra to install).
function NotesIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <path d="M5 6h6M5 8.5h6M5 11h3" strokeLinecap="round" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" strokeLinecap="round" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M5 4L2 7l3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 7h7.5a4 4 0 010 8H7" strokeLinecap="round" />
    </svg>
  );
}
