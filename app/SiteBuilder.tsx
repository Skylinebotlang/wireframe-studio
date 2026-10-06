// ─────────────────────────────────────────────────────────────────────────────
// SITE BUILDER — makes the landing page look like the agent is designing it
// live, right in front of the visitor.
//
// What happens, in plain words:
//   1. After the splash, the page is LOCKED (no scrolling). A prompt card,
//      like the app's "Frame your idea" box, types itself:
//      "Design the Wireframe Studio landing page", then sends itself.
//   2. The agent builds the top of the page (the hero) on its own: each part
//      is first drawn as a grey WIREFRAME inside an orange "agent is drawing"
//      frame, then it turns into the real design. Then scrolling unlocks.
//   3. As the visitor scrolls, every further part (the three steps, the
//      footer) goes through the same wireframe → real build, tied to scroll.
//   4. A small agent chip in the corner says what it's doing.
//
// Which parts get built: anything in page.tsx marked data-build="…". The
// wireframe look is pure CSS (landing.css, "Site builder"): the real content
// is shown as grey bars and boxes, so the wireframe always matches the page.
//
// Shown once per browser tab. Skipped entirely for reduced motion.
// ORANGE = the agent only: the drawing frame, the scan line, the chip.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const PROMPT = "Design the Wireframe Studio landing page";
const BUILT_KEY = "wireframe-studio-site-built";

// Timings (ms) for the auto prompt and the hero build.
const TYPE_MS = 1600; // typing the prompt
const SEND_AT = 2300; // presses "Frame it" by itself
const HERO_GAP = 650; // between hero parts
const DRAW_MS = 450; // orange "drawing" stage
const WIRE_MS = 500; // grey wireframe stage before turning real

type Phase = "prompt" | "building" | "scroll" | "done" | "off";

export function SiteBuilder() {
  const [phase, setPhase] = useState<Phase>("off");
  const [started, setStarted] = useState(false); // flips once; runs the timed intro
  const [typed, setTyped] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState("Reading the prompt…");

  // Before the first paint: decide whether to run, and hide the parts.
  useLayoutEffect(() => {
    let skip = matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      skip ||= !!sessionStorage.getItem(BUILT_KEY);
    } catch {}
    if (skip) return;
    parts().forEach((el) => (el.dataset.state = "hidden"));
    document.documentElement.style.overflow = "hidden";
    // Wait for the splash to finish (it raises a flag + event when gone).
    const w = window as Window & { __wfsSplashDone?: boolean };
    const go = () => {
      setPhase("prompt");
      setStarted(true);
    };
    if (w.__wfsSplashDone) requestAnimationFrame(go);
    else addEventListener("wfs:splash-done", go, { once: true });
    return () => removeEventListener("wfs:splash-done", go);
  }, []);

  // 1 + 2: type the prompt, send it, build the hero, then unlock scroll.
  // (Keyed on `started`, not `phase`, so changing the phase mid-way doesn't
  // cancel the remaining timers.)
  useEffect(() => {
    if (!started) return;
    document.documentElement.style.overflow = "hidden";
    const t: number[] = [];
    const at = (ms: number, fn: () => void) => t.push(window.setTimeout(fn, ms));
    at(100, () => setTyped(true));
    at(SEND_AT, () => setSent(true));
    at(SEND_AT + 500, () => {
      setPhase("building");
      setStatus("Designing the hero…");
    });
    const hero = parts().filter((el) => el.dataset.build === "hero");
    hero.forEach((el, i) => {
      const start = SEND_AT + 700 + i * HERO_GAP;
      at(start, () => (el.dataset.state = "drawing"));
      at(start + DRAW_MS, () => (el.dataset.state = "wire"));
      at(start + DRAW_MS + WIRE_MS, () => (el.dataset.state = "real"));
    });
    at(SEND_AT + 700 + hero.length * HERO_GAP + DRAW_MS + WIRE_MS, () => {
      document.documentElement.style.overflow = "";
      setPhase("scroll");
      setStatus("Scroll to keep building ↓");
    });
    return () => t.forEach(clearTimeout);
  }, [started]);

  // 3: the rest of the page builds as it scrolls into view.
  useEffect(() => {
    if (phase !== "scroll") return;
    const rest = parts().filter((el) => el.dataset.build === "scroll");
    let frame = 0;
    const update = () => {
      frame = 0;
      let drawing = "";
      // At the very bottom, the last parts can't climb any higher: finish them.
      const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
      for (const el of rest) {
        const r = el.getBoundingClientRect();
        // 0 when the part's top reaches the bottom of the screen,
        // 1 when it has climbed 55% of the screen height.
        const p = (innerHeight - r.top) / (innerHeight * 0.55);
        const state = atBottom || p >= 0.75 ? "real" : p < 0.1 ? "hidden" : p < 0.45 ? "drawing" : "wire";
        el.dataset.state = state;
        if (state === "drawing" || state === "wire") drawing = el.dataset.label ?? "the page";
      }
      if (rest.every((el) => el.dataset.state === "real")) {
        setStatus("Done · built from one prompt");
        setPhase("done");
        try {
          sessionStorage.setItem(BUILT_KEY, "1");
        } catch {}
      } else setStatus(drawing ? `Designing ${drawing}…` : "Scroll to keep building ↓");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [phase]);

  if (phase === "off") return null;

  return (
    <>
      {/* The prompt card, centered while the page is locked */}
      <div className="sb-prompt" data-out={phase !== "prompt"} aria-live="polite">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <span className="font-heading text-sm text-ink">Agent</span>
          <span className={`lp-mono ${sent ? "text-agent" : "text-muted"}`}>{sent ? "Designing…" : "Idle"}</span>
        </div>
        <div className="lp-mono mt-4 text-muted">Frame your idea</div>
        <div className="sb-box">
          <span className="sb-type" data-on={typed} style={{ "--ms": `${TYPE_MS}ms` } as React.CSSProperties}>
            {PROMPT}
          </span>
        </div>
        <div className="sb-go" data-on={sent}>
          Frame it
        </div>
      </div>

      {/* Small status chip while the page builds (orange = the agent) */}
      {phase !== "prompt" && (
        <div className="sb-chip lp-mono" data-done={phase === "done"}>
          <span className="sb-dot" />
          {status}
        </div>
      )}
    </>
  );
}

// Everything on the page that the agent "builds".
function parts() {
  return [...document.querySelectorAll<HTMLElement>("[data-build]")];
}
