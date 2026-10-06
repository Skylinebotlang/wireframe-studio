// ─────────────────────────────────────────────────────────────────────────────
// SITE BUILDER — makes the landing page look like the AI is designing it
// live while you scroll.
//
// What happens, in plain words:
//   • Every part of the page marked data-build="scroll" starts hidden.
//   • As you scroll it into view it is first drawn as a grey WIREFRAME
//     inside an orange "agent is drawing" frame, then it turns into the
//     real design. Scroll back up and it un-builds.
//   • A small agent chip in the corner says what it's drawing; it shows
//     "Done" when the page is complete, then fades away.
//
// It starts after the loader (app/Loader.tsx) has handed off. The hero has
// its own story (app/HeroIntro.tsx), so it isn't built here.
// The wireframe look is pure CSS (landing.css, "Site builder"): the real
// content is shown as grey bars, so the wireframe always matches the page.
//
// Shown once per browser tab. Skipped for reduced motion.
// ORANGE = the agent only: the drawing frame, the scan line, the chip.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const BUILT_KEY = "wireframe-studio-site-built";

export function SiteBuilder() {
  const [on, setOn] = useState(false); // running?
  const [status, setStatus] = useState(""); // chip text ("" = no chip)
  const [done, setDone] = useState(false);

  // Before the first paint: decide whether to run, and hide the parts.
  useLayoutEffect(() => {
    let skip = matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      skip ||= !!sessionStorage.getItem(BUILT_KEY);
    } catch {}
    if (skip) return;
    parts().forEach((el) => (el.dataset.state = "hidden"));
    const w = window as Window & { __wfsLoaded?: boolean };
    const go = () => setOn(true);
    if (w.__wfsLoaded) requestAnimationFrame(go);
    else addEventListener("wfs:loaded", go, { once: true });
    return () => removeEventListener("wfs:loaded", go);
  }, []);

  useEffect(() => {
    if (!on) return;
    const rest = parts();
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
        setDone(true);
        try {
          sessionStorage.setItem(BUILT_KEY, "1");
        } catch {}
      } else if (drawing) setStatus(`Designing ${drawing}…`);
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
  }, [on]);

  if (!status) return null;
  return (
    <div className="sb-chip lp-mono" data-done={done} aria-live="polite">
      <span className="sb-dot" />
      {status}
    </div>
  );
}

// Everything on the page that the agent "builds" while you scroll.
function parts() {
  return [...document.querySelectorAll<HTMLElement>('[data-build="scroll"]')];
}
