// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE — the front door at "/". "Bold cyberpunk editorial" look,
// built from mockups/landing-cyberpunk.html. Styles live in app/landing.css.
//
//   1. Title screen   HUD-style top bar, huge headline
//                     "Three teams. One canvas. One answer.", wine button.
//   2. Agent moment   the agent's orange cursor (with a brush streak) merges
//                     two notes and a phone wireframe snaps in. The ONLY
//                     orange on the page, because orange = the agent.
//   3. Three steps    01 Drop notes / 02 Agent merges / 03 Screens appear.
//   4. Footer         links + a giant outlined wordmark.
//
// "Start a room" goes to /login, which asks for a name, then opens a room.
// The splash with the 3D logo still covers the page first (app/Splash.tsx).
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import Image from "next/image";
import { Splash } from "./Splash";
import "./landing.css";

// The curve the agent's cursor and its streak both follow (see landing.css).
const ROUTE = "M 60 60 C 260 260, 420 -40, 560 140 S 820 260, 940 90";

export default function LandingPage() {
  return (
    <main className="lp dot-grid select-none">
      <Splash />

      {/* ── 1. Title screen ──────────────────────────────────────────── */}
      <section className="lp-title">
        <span className="lp-corner lp-c1" />
        <span className="lp-corner lp-c2" />
        <span className="lp-corner lp-c3" />
        <span className="lp-corner lp-c4" />

        <div className="lp-hud lp-mono">
          <span className="lp-brand">
            <Image src="/logo-2d.png" alt="" draggable={false} width={26} height={26} />
            Wireframe Studio
          </span>
          <span className="lp-live lp-hide-sm">ROOM_01 · LIVE</span>
          <span className="lp-hide-sm">3 humans · 1 agent</span>
          <Link href="/login" className="text-ink">Sign in →</Link>
        </div>

        <h1 className="lp-head">
          Three teams.
          <br />
          <span className="lp-dim">One canvas.</span>
          <br />
          One{" "}
          <span className="lp-glitch" data-t="answer.">
            answer.
          </span>
        </h1>

        <div className="lp-row">
          <p>
            PMs, designers and developers drop notes on one live canvas. The
            agent reads every one, settles the fights, tells you why, and draws
            the wireframes. For everyone, at once.
          </p>
          <Link href="/login" className="lp-btn lp-mono">
            Start a room <span>→</span>
          </Link>
        </div>
      </section>

      {/* ── 2. The one orange moment ─────────────────────────────────── */}
      <section className="lp-demo" aria-label="The agent merging two notes">
        <div className="lp-mono text-muted">{"// Live — agent resolving 1 conflict"}</div>
        <div className="lp-stage">
          <div className="lp-notes">
            <Note who="Priya · PM" text="Put the summary at the top." />
            <Note who="Leo · Designer" text="Keep it minimal. Nothing extra." b />
          </div>

          <div className="lp-agentbox lp-mono">
            Agent ▸ 1 conflict found
            <br />
            <span className="lp-typed">Merged: summary on top, as one short line.</span>
          </div>

          {/* The wireframe the agent draws (grey boxes) */}
          <div className="lp-phone" aria-hidden>
            <div style={{ height: 10 }} />
            <div style={{ height: 14, width: "70%", background: "var(--muted)" }} />
            <div style={{ height: 90, background: "none", border: "1px dashed var(--muted)" }} />
            <div style={{ height: 8, width: "80%" }} />
            <div style={{ height: 8, width: "55%" }} />
            <div style={{ height: 22, marginTop: 14 }} />
          </div>

          {/* Agent cursor + brush streak (3 layers: soft, medium, sharp) */}
          <div className="lp-trail" aria-hidden>
            <svg width="1000" height="300">
              <path className="lp-s1" pathLength={100} d={ROUTE} />
              <path className="lp-s2" pathLength={100} d={ROUTE} />
              <path className="lp-s3" pathLength={100} d={ROUTE} />
            </svg>
            {/* PLACEHOLDER cursor shape: angular pointer. Final look TBD. */}
            <div className="lp-cursor lp-mono">
              <svg width="22" height="22" viewBox="0 0 22 22">
                <path d="M2 2 L20 9 L12 11 L9 20 Z" fill="none" stroke="var(--agent)" strokeWidth="1.5" />
                <path d="M5 5 L14 9 L10 10 L9 14 Z" fill="var(--agent)" />
              </svg>
              <span>Agent</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Three huge steps ──────────────────────────────────────── */}
      <section className="lp-steps">
        {STEPS.map((s, i) => (
          <div key={s.title} className="lp-step">
            <span className="lp-step-n lp-mono">0{i + 1}</span>
            <h3 className="lp-head">{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </section>

      {/* ── 4. Footer ────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-links lp-mono">
          <Link href="/login">Start a room</Link>
          <Link href="/login">Sign in</Link>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="lp-big lp-head" aria-hidden>
          Wireframe Studio
        </div>
      </footer>
    </main>
  );
}

const STEPS = [
  { title: "Drop notes", text: "Everyone writes on the same canvas. Your name, your cursor, your colour." },
  { title: "Agent merges", text: "It reads all the notes together, finds where you disagree, and shows its reasoning." },
  { title: "Screens appear", text: "Grey-box phone wireframes land on the canvas, live, for the whole team." },
];

// A person's prompt note (wine header = a human).
function Note({ who, text, b }: { who: string; text: string; b?: boolean }) {
  return (
    <div className={`lp-note ${b ? "lp-note-b" : ""}`}>
      <div className="lp-note-who lp-mono">{who}</div>
      <div className="lp-note-txt">{text}</div>
    </div>
  );
}
