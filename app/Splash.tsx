"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH SCREEN — covers the landing page until the visitor DRAGS (press,
// move, let go). Dragging spins the 3D logo (app/LogoCore3D.tsx); letting go
// lifts the splash away like a curtain while the logo keeps spinning.
// A plain click does nothing. Keyboard users can press Enter/Space.
//
// First load is staged: the logo, then the label, then the wordmark letter
// by letter, then the hint (CSS only: .splash-in / .splash-letter in
// globals.css). Two pretend cursors drift near the edges: a person (rose) and
// the agent (ORANGE, agent only) — a preview of the product.
//
// It shows once per browser tab: coming back from /login skips it
// (remembered in sessionStorage, which is cleared when the tab closes).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LogoCore3D } from "./LogoCore3D";
import { FluidCursor } from "./FluidCursor";

const SEEN_KEY = "wireframe-studio-splash-seen";
const EXIT_MS = 700; // keep in sync with .splash-exit in app/globals.css
const DRAG_PX = 40; // how far a press must move to count as a drag
// The wordmark, one letter per item, so the letters can arrive one by one.
const WORDMARK = [..."Wireframe·Studio"];

export function Splash() {
  // "show" → visible, "leaving" → playing the exit animation, "gone" → removed.
  const [state, setState] = useState<"show" | "leaving" | "gone">("show");
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false); // did this press move far enough?
  const box = useRef<HTMLDivElement>(null);

  // Already seen in this tab? Hide before the first paint (no flash).
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) setState("gone");
    } catch {
      /* storage blocked: just show the splash */
    }
  }, []);

  // Focus the splash so Enter/Space work straight away.
  useEffect(() => box.current?.focus(), []);

  // While the splash is up, stop the page underneath from scrolling.
  useEffect(() => {
    if (state === "gone") return;
    document.documentElement.style.overflow = "hidden";
    // Belt and braces: block text selection anywhere while the splash is up.
    const noSelect = (e: Event) => e.preventDefault();
    document.addEventListener("selectstart", noSelect);
    return () => {
      document.documentElement.style.overflow = "";
      document.removeEventListener("selectstart", noSelect);
    };
  }, [state]);

  // Tell the page the splash is gone (app/HeroIntro.tsx + app/SmoothScroll.tsx wait for this).
  // Runs after the scroll-lock cleanup above, so the page can lock again.
  useEffect(() => {
    if (state !== "gone") return;
    // The hero story + smooth scroll start on "wfs:loaded".
    (window as Window & { __wfsLoaded?: boolean }).__wfsLoaded = true;
    dispatchEvent(new Event("wfs:loaded"));
  }, [state]);

  function enter() {
    if (state !== "show") return;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setState("leaving");
    setTimeout(() => setState("gone"), EXIT_MS);
  }

  if (state === "gone") return null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Enter Wireframe Studio"
      ref={box}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && enter()}
      // Drag = press, move more than DRAG_PX, let go. Enter on release, so the
      // visitor sees the logo spin while the curtain lifts.
      onPointerDown={(e) => {
        e.preventDefault(); // stop the browser starting a text selection
        box.current?.focus(); // (preventDefault also skips the usual focus)
        pressStart.current = { x: e.clientX, y: e.clientY };
        dragged.current = false;
      }}
      onPointerMove={(e) => {
        const s = pressStart.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > DRAG_PX) dragged.current = true;
      }}
      onPointerUp={() => {
        pressStart.current = null;
        if (dragged.current) enter();
      }}
      className={`dot-grid fixed inset-0 z-[100] flex cursor-grab touch-none select-none active:cursor-grabbing flex-col items-center justify-center overflow-hidden outline-none ${
        state === "leaving" ? "splash-exit" : ""
      }`}
    >
      {/* Wine "ink" trail behind the mouse (app/FluidCursor.tsx). Lives inside
          the splash so it shows on top of it; never blocks the logo drag. */}
      <FluidCursor />

      {/* Two pretend teammates drifting near the edges (never over the
          wordmark; hidden on phones): a person (rose) and the agent (ORANGE). */}
      <FakeCursor name="Priya · PM" color="#E0607E" className="splash-drift-a max-sm:hidden" />
      <FakeCursor name="Agent" color="var(--agent)" className="splash-drift-c max-sm:hidden" agent />

      {/* One centered stack. Each piece rises in after the one before
          (--d = delay), so the screen "assembles" on first load. */}
      <LogoCore3D dragTarget={box} className="splash-logo-in h-52 w-52 sm:h-64 sm:w-64" />

      <p
        className="splash-in mt-6 font-mono text-[11px] uppercase tracking-[0.3em] text-muted"
        style={{ "--d": "450ms" } as React.CSSProperties}
      >
        Multiplayer AI workspace
      </p>
      <h1
        aria-label="Wireframe Studio"
        className="neon-text mt-3 font-heading text-5xl font-semibold tracking-tight text-ink sm:text-7xl"
      >
        {WORDMARK.map((ch, i) => (
          <span
            key={i}
            aria-hidden
            className={`splash-letter ${ch === "·" ? "text-accent-bright" : ""}`}
            style={{ "--d": `${600 + i * 35}ms` } as React.CSSProperties}
          >
            {ch}
          </span>
        ))}
      </h1>

      {/* Quiet hint pinned near the bottom; fades in last, then breathes. */}
      <p className="splash-hint absolute bottom-10 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
        <span aria-hidden className="h-px w-8 bg-line" />
        Drag to spin · let go to enter
        <span aria-hidden className="h-px w-8 bg-line" />
      </p>
    </div>
  );
}

// One drifting cursor with a name tag, drawn like a real multiplayer cursor.
function FakeCursor({
  name,
  color,
  className,
  agent = false,
}: {
  name: string;
  color: string;
  className: string;
  agent?: boolean;
}) {
  return (
    <div aria-hidden className={`pointer-events-none absolute left-0 top-0 ${className}`}>
      <svg width="18" height="18" viewBox="0 0 18 18" style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
        <path d="M2 1 L16 8 L9 10 L6 17 Z" fill={color} stroke="#090719" strokeWidth="1.2" />
      </svg>
      <span
        className="ml-4 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
        style={{ background: color, color: "#090719" }}
      >
        {agent && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-paper align-middle" />}
        {name}
      </span>
    </div>
  );
}
