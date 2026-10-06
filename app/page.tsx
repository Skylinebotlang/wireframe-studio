// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE — the front door at "/". "Bold cyberpunk editorial" look,
// built from mockups/landing-cyberpunk.html. Styles live in app/landing.css.
//
//   1. Title screen   HUD-style top bar, huge headline
//                     "Three teams. One canvas. One answer.", wine button.
//   * Live build      after the splash the page is locked on a prompt that
//                     sends itself; the agent then "builds" this very page:
//                     each part marked data-build is drawn as a wireframe,
//                     then turns real. The hero at once, the rest as you
//                     scroll (app/SiteBuilder.tsx). Orange = agent only.
//   3. Three steps    01 Drop notes / 02 Agent merges / 03 Screens appear.
//   4. Footer         links + a giant outlined wordmark.
//
// "Start a room" goes to /login, which asks for a name, then opens a room.
// The splash with the 3D logo still covers the page first (app/Splash.tsx).
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import Image from "next/image";
import { Splash } from "./Splash";
import { FluidCursor } from "./FluidCursor";
import { SiteBuilder } from "./SiteBuilder";
import "./landing.css";

export default function LandingPage() {
  return (
    <main className="lp dot-grid select-none">
      <Splash />
      {/* Wine "ink" trail behind the mouse; above the page, below panels. */}
      <FluidCursor />
      {/* The agent "builds" this page live from a prompt (app/SiteBuilder.tsx).
          Parts marked data-build get drawn as wireframes, then turn real. */}
      <SiteBuilder />

      {/* ── 1. Title screen ──────────────────────────────────────────── */}
      <section className="lp-title">
        <span className="lp-corner lp-c1" />
        <span className="lp-corner lp-c2" />
        <span className="lp-corner lp-c3" />
        <span className="lp-corner lp-c4" />

        <div className="lp-hud lp-mono" data-build="hero">
          <span className="lp-brand">
            <Image src="/logo-2d.png" alt="" draggable={false} width={26} height={26} />
            Wireframe Studio
          </span>
          <span className="lp-live lp-hide-sm">ROOM_01 · LIVE</span>
          <span className="lp-hide-sm">3 humans · 1 agent</span>
          <Link href="/login" className="text-ink">Sign in →</Link>
        </div>

        <h1 className="lp-head" data-build="hero">
          Three teams.
          <br />
          <span className="lp-dim">One canvas.</span>
          <br />
          One{" "}
          <span className="lp-glitch" data-t="answer.">
            answer.
          </span>
        </h1>

        <div className="lp-row" data-build="hero">
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

      {/* ── 3. Three huge steps ──────────────────────────────────────── */}
      <section className="lp-steps">
        {STEPS.map((s, i) => (
          <div key={s.title} className="lp-step" data-build="scroll" data-label={`step 0${i + 1}`}>
            <span className="lp-step-n lp-mono">0{i + 1}</span>
            <h3 className="lp-head">{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </section>

      {/* ── 4. Footer ────────────────────────────────────────────────── */}
      <footer className="lp-footer" data-build="scroll" data-label="the footer">
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
