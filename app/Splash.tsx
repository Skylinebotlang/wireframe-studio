"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH SCREEN — covers the landing page until the visitor DRAGS (press,
// move, let go). Dragging spins the 3D logo (app/LogoCore3D.tsx); letting go
// lifts the splash away like a curtain while the logo keeps spinning.
// A plain click does nothing. Keyboard users can press Enter/Space.
//
// Behind the wordmark, three pretend cursors drift around: two people (rose,
// lavender) and the agent (ORANGE, agent only) — a preview of what the
// product feels like before anyone has signed in.
//
// It shows once per browser tab: coming back from /login skips it
// (remembered in sessionStorage, which is cleared when the tab closes).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LogoCore3D } from "./LogoCore3D";

const SEEN_KEY = "wireframe-studio-splash-seen";
const EXIT_MS = 700; // keep in sync with .splash-exit in app/globals.css
const DRAG_PX = 40; // how far a press must move to count as a drag

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
      {/* Pretend teammates drifting around */}
      <FakeCursor name="Priya · PM" color="#E0607E" className="splash-drift-a" />
      <FakeCursor name="Leo · Designer" color="#B9A7FF" className="splash-drift-b" />
      <FakeCursor name="Agent" color="var(--agent)" className="splash-drift-c" agent />

      {/* The spinning 3D core logo. Drags anywhere on the splash spin it. */}
      <LogoCore3D dragTarget={box} className="pop-in h-56 w-56 sm:h-72 sm:w-72" />

      <p className="pop-in font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
        Multiplayer AI workspace
      </p>
      <h1 className="pop-in neon-text mt-3 font-heading text-5xl font-semibold tracking-tight text-ink sm:text-7xl">
        Wireframe<span className="text-accent-bright">·</span>Studio
      </h1>

      <p className="splash-hint mt-16 font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
        Drag to spin · let go to enter
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
