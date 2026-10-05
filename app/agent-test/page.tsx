"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AGENT TEST PAGE — localhost:3000/agent-test
//
// A plain developer page for trying the AI agent and the shared agent panel
// without the canvas. It joins a test Liveblocks room ("agent-test"), so
// opening it in TWO windows shows the multiplayer parts: the plan, the
// activity feed, steering, Pause / Resume / Take over and conflict picks.
//
// Notes: one per line, "Name | Role | note text".
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Room } from "../room/[roomId]/Room";
import { AiKeyButton } from "../AiKeyButton";
import { useAgentPanel } from "@/lib/agent-room";
import { loadIdentity } from "@/lib/user";

const EXAMPLE = `Asha | PM | Put a summary of the week at the top of the home screen
Ben | Designer | Keep the home screen minimal, just a greeting and one action
Dev | Developer | Need a login screen with email and password`;

export default function AgentTestPage() {
  return (
    <Room roomId="agent-test">
      <AgentTest />
    </Room>
  );
}

function AgentTest() {
  // Your name in the feed: from the room's join screen, or type one here.
  // (This only renders in the browser, inside the Room's loading screen.)
  const [name, setName] = useState(() => loadIdentity()?.name ?? "Guest");

  const agent = useAgentPanel(name);
  const { run, activity } = agent;
  const [text, setText] = useState(EXAMPLE);
  const [steerText, setSteerText] = useState("");
  const [error, setError] = useState("");

  async function send() {
    setError("");
    // Turn each line into a note the agent understands.
    const notes = text
      .split("\n")
      .map((line) => line.split("|").map((part) => part.trim()))
      .filter((parts) => parts.length >= 3 && parts[2])
      .map(([authorName, authorRole, ...rest], i) => ({
        id: `note-${i + 1}`,
        authorName,
        authorRole,
        noteText: rest.join(" | "),
      }));
    // On the canvas, `draw` would put the screens on the board. Here the
    // shared result below is enough, so it does nothing.
    const problem = await agent.runAgent(notes, () => {});
    if (problem) setError(problem);
  }

  const busy = run.status === "working" || run.status === "paused";
  const result = run.result;

  return (
    <main style={{ maxWidth: 820, margin: "32px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Agent test</h1>
        <label style={{ fontSize: 12, marginLeft: "auto" }}>
          Your name{" "}
          <input value={name} onChange={(e) => setName(e.target.value)} style={box} />
        </label>
        <AiKeyButton />
      </div>
      <p style={{ opacity: 0.7, fontSize: 13 }}>
        One note per line: <code>Name | Role | note text</code>. Open this page in two windows to see the shared panel.
      </p>

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} style={{ ...box, width: "100%", fontFamily: "monospace" }} />

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button onClick={send} disabled={busy} style={btn}>
          {run.status === "working" ? "Agent working…" : "Send to agent"}
        </button>
        <button onClick={agent.pause} disabled={run.status !== "working"} style={btn}>Pause</button>
        <button onClick={() => agent.resume(() => {})} disabled={run.status !== "paused"} style={btn}>Resume</button>
        <button onClick={agent.takeOver} disabled={!busy} style={btn}>Take over</button>
      </div>
      {error && <p style={{ color: "#f87171", marginTop: 8 }}>⚠ {error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
        {/* Plan + progress (shared) */}
        <section>
          <h2 style={h2}>Plan · {run.status}</h2>
          {run.startedBy && (
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              Started by {run.startedBy}
              {run.provider && ` · ${run.provider}`}
            </p>
          )}
          <ul style={{ listStyle: "none", padding: 0, fontSize: 13 }}>
            {run.steps.map((s) => (
              <li key={s.label}>
                {s.state === "done" ? "✓" : s.state === "working" ? "✱" : "○"} {s.label}
              </li>
            ))}
          </ul>
          {run.error && <p style={{ color: "#f87171", fontSize: 13 }}>⚠ {run.error}</p>}

          {/* Frame your idea (runs the agent on the typed idea) */}
          <h2 style={{ ...h2, marginTop: 16 }}>Frame your idea</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (steerText.trim()) agent.runAgent([], () => {}, steerText);
              setSteerText("");
            }}
            style={{ display: "flex", gap: 6 }}
          >
            <input
              value={steerText}
              onChange={(e) => setSteerText(e.target.value)}
              placeholder="e.g. add a settings screen"
              style={{ ...box, flex: 1 }}
            />
            <button style={btn}>Frame it</button>
          </form>
          <p style={{ fontSize: 11, opacity: 0.6 }}>Starts the agent right away.</p>
        </section>

        {/* Activity feed (shared) */}
        <section>
          <h2 style={h2}>Activity</h2>
          <ul style={{ listStyle: "none", padding: 0, fontSize: 12, maxHeight: 260, overflowY: "auto" }}>
            {activity.length === 0 && <li style={{ opacity: 0.6 }}>Nothing yet.</li>}
            {[...activity].reverse().map((a) => (
              <li key={a.id} style={{ marginBottom: 6 }}>
                <span style={{ opacity: 0.5 }}>{new Date(a.at).toLocaleTimeString()} </span>
                {a.kind === "steer" ? <b>{a.who}: </b> : null}
                {a.text}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {result && (
        <div style={{ marginTop: 24 }}>
          {/* Conflict cards (shared), with "use X's version" buttons */}
          <h2 style={h2}>Clashes ({result.conflicts.length})</h2>
          {result.conflicts.map((c, i) => {
            const authors = [...new Set(c.noteIds.map((id) => noteAuthor(text, id)).filter(Boolean))];
            return (
              <div key={i} style={{ ...box, marginBottom: 8 }}>
                <p style={{ margin: 0 }}>{c.summary}</p>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {authors.map((who) => (
                    <button key={who} onClick={() => agent.pick(c.summary, who!)} style={btn}>
                      Use {who}&apos;s version
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <h2 style={{ ...h2, marginTop: 16 }}>How it merged them</h2>
          <p>{result.resolution}</p>

          <h2 style={{ ...h2, marginTop: 16 }}>Screens</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {result.screens.map((s, i) => (
              <div key={i} style={{ width: 200, border: "2px solid #888", borderRadius: 16, padding: 10 }}>
                <strong>{s.name}</strong>
                {s.components.map((c, j) => (
                  <div key={j} style={{ background: "#2b2a42", margin: "6px 0", padding: 6, fontSize: 12 }}>
                    <code>{c.type}</code> · {c.label}
                    {c.notes && <div style={{ opacity: 0.6 }}>{c.notes}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// "note-2" → the name on line 2 of the notes box (test page only).
function noteAuthor(text: string, noteId: string) {
  const line = Number(noteId.replace("note-", "")) - 1;
  return text.split("\n").filter((l) => l.split("|").length >= 3)[line]?.split("|")[0].trim();
}

const box: React.CSSProperties = { padding: 6, border: "1px solid #444", background: "transparent", color: "inherit", borderRadius: 6 };
const btn: React.CSSProperties = { padding: "6px 12px", background: "#681e2e", color: "#fff", border: 0, borderRadius: 6, cursor: "pointer" };
const h2: React.CSSProperties = { fontWeight: 600, fontSize: 15 };
