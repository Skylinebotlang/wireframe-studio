// ─────────────────────────────────────────────────────────────────────────────
// FLUID CURSOR — the ready-to-use version of app/SplashCursor.tsx.
//
// It loads the effect only in the browser (never on the server), with our
// color and settings already chosen, so pages just write <FluidCursor />.
// Used on the landing page and the splash ONLY — not in rooms, /login or
// /agent-test.
//
// Color: the wine accent from lib/theme.ts (THEME.wine = #681E2E) — a quiet,
// subtle red smoke on navy.
// NEVER orange: orange is the AI's color.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import dynamic from "next/dynamic";
import { THEME } from "@/lib/theme";

const SplashCursor = dynamic(() => import("./SplashCursor"), { ssr: false });

// zIndex: the landing page passes 55 (above the page, below panels at 60+).
export function FluidCursor({ zIndex = 55 }: { zIndex?: number }) {
  return <SplashCursor RAINBOW_MODE={false} COLOR={THEME.wine} zIndex={zIndex} />;
}
