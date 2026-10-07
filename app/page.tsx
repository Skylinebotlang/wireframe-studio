// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE — the front door at "/". "Bold cyberpunk editorial" look.
// Styles live in app/landing.css.
//
//   0. Splash         drag the 3D logo to enter; letting go lifts it away
//                     and starts the hero story (app/Splash.tsx).
//   The page scrolls SIDEWAYS with parallax (app/Chapters.tsx):
//   1. Hero           the first 8 seconds: three teams building alone, then
//                     their frames merge into one and the AI (orange)
//                     assembles the shared screen; headline, message,
//                     "Start the chat" (app/HeroIntro.tsx).
//   2. Chapters       six pinned, scroll-driven screens: problem, how it
//                     works, live together, AI teammate, your own AI,
//                     start the chat; pills + "Skip the intro" at the
//                     bottom (app/Chapters.tsx, app/SmoothScroll.tsx).
//   3. Footer         links + a giant outlined wordmark.
//
// "Start the chat" opens the Sign in / Sign up choice (app/StartChat.tsx).
// Colors: wine = people, ORANGE = the AI only.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { Splash } from "./Splash";
import { HeroIntro } from "./HeroIntro";
import { FluidCursor } from "./FluidCursor";
import { Chapters } from "./Chapters";
import { SmoothScroll } from "./SmoothScroll";
import { LiveCursors } from "./LiveCursors";
import "./landing.css";

export default function LandingPage() {
  return (
    <main className="lp dot-grid select-none">
      {/* Interactive splash: drag the 3D logo to enter (app/Splash.tsx). */}
      <Splash />
      {/* Smooth, weighted scrolling synced with the animations. */}
      <SmoothScroll />
      {/* Wine "ink" trail behind the mouse; above the page, below panels. */}
      <FluidCursor />
      {/* Priya, Leo and the Agent travel with you, building each page. */}
      <LiveCursors />

      {/* ── The whole page slides sideways (app/Chapters.tsx):
             hero (app/HeroIntro.tsx) → 6 chapters → footer ───────────── */}
      <Chapters
        hero={<HeroIntro />}
        footer={
          <footer className="lp-footer">
            <div className="lp-links lp-mono">
              <Link href="/signup">Start the chat</Link>
              <Link href="/login">Sign in</Link>
              <span>© {new Date().getFullYear()}</span>
            </div>
            <div className="lp-big lp-head" aria-hidden>
              Wireframe Studio
            </div>
          </footer>
        }
      />
    </main>
  );
}
