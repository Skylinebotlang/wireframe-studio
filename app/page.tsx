// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE — the front door at "/". "Bold cyberpunk editorial" look.
// Styles live in app/landing.css.
//
//   0. Loader         our 2D logo turning on navy while the page loads; it
//                     flies into the nav logo spot (app/Loader.tsx).
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
// "Start the chat" goes to /login for now (sign-up choice comes later).
// Colors: wine = people, ORANGE = the AI only.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { Loader } from "./Loader";
import { HeroIntro } from "./HeroIntro";
import { FluidCursor } from "./FluidCursor";
import { SiteBuilder } from "./SiteBuilder";
import { Chapters } from "./Chapters";
import { SmoothScroll } from "./SmoothScroll";
import "./landing.css";

export default function LandingPage() {
  return (
    <main className="lp dot-grid select-none">
      {/* Logo loader; hands off into the nav logo (app/Loader.tsx). */}
      <Loader />
      {/* Smooth, weighted scrolling synced with the animations. */}
      <SmoothScroll />
      {/* Wine "ink" trail behind the mouse; above the page, below panels. */}
      <FluidCursor />
      {/* The agent "builds" this page live from a prompt (app/SiteBuilder.tsx).
          Parts marked data-build get drawn as wireframes, then turn real. */}
      <SiteBuilder />

      {/* ── 1. Hero: the 6-second problem → fix story (app/HeroIntro.tsx) ── */}
      <HeroIntro />

      {/* ── 2. Six pinned scroll chapters + pills (app/Chapters.tsx) ── */}
      <Chapters />

      {/* ── 4. Footer ────────────────────────────────────────────────── */}
      <footer className="lp-footer" data-build="scroll" data-label="the footer">
        <div className="lp-links lp-mono">
          <Link href="/signup">Start the chat</Link>
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
