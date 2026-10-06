// ─────────────────────────────────────────────────────────────────────────────
// LOADER — the first thing a visitor sees on the landing page.
//
//   • Our 2D logo, centred on navy, turning slowly (one turn every 3.5 s).
//   • A thin wine line under it fills as the page really loads (fonts, the
//     nav logo image, the page itself). The line is smoothed, so it never
//     jumps or stalls. It shows for at least 1.2 s and is done by 2.5 s.
//   • Exit: no cut to black. The logo shrinks and flies into the top-left
//     nav logo spot (the <img id="nav-logo">) while the navy fades away.
//   • When it's finished it tells the page (window flag + "wfs:loaded"
//     event); the hero animation (app/HeroIntro.tsx) waits for that.
//
// Reduced motion: no spin, no flight — a plain fade.
// Only transform and opacity are animated.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState } from "react";

const MIN_MS = 1200; // never shorter than this
const MAX_MS = 2500; // always finished by this
const FLY_MS = 650; // the logo's flight into the nav

export function Loader() {
  const [gone, setGone] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLImageElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    document.documentElement.style.overflow = "hidden";

    // Real loading signals; each one done = a share of the progress.
    let doneCount = 0;
    const tasks = [
      document.fonts.ready,
      new Promise<void>((res) => (document.readyState === "complete" ? res() : addEventListener("load", () => res(), { once: true }))),
      new Promise<void>((res) => {
        const img = document.getElementById("nav-logo") as HTMLImageElement | null;
        if (!img || img.complete) res();
        else {
          img.addEventListener("load", () => res(), { once: true });
          img.addEventListener("error", () => res(), { once: true });
        }
      }),
    ];
    tasks.forEach((t) => t.then(() => doneCount++));

    // Smooth the bar: it eases toward the real target, and time alone also
    // pushes it forward, so it never stalls and is full by MAX_MS.
    let shown = 0;
    let frame = 0;
    let finished = false;
    const tick = (now: number) => {
      const t = now - start;
      const real = doneCount / tasks.length;
      const byTime = Math.min(1, t / MAX_MS);
      const target = Math.max(Math.min(real, t / MIN_MS), byTime);
      shown += (target - shown) * 0.12;
      if (bar.current) bar.current.style.transform = `scaleX(${shown})`;
      if (!finished && shown > 0.985 && t >= MIN_MS) {
        finished = true;
        if (bar.current) bar.current.style.transform = "scaleX(1)";
        exit();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const announce = () => {
      document.documentElement.style.overflow = "";
      (window as Window & { __wfsLoaded?: boolean }).__wfsLoaded = true;
      dispatchEvent(new Event("wfs:loaded"));
    };

    function exit() {
      const el = wrap.current;
      const from = logo.current;
      const to = document.getElementById("nav-logo");
      if (!el || !from) return;
      if (reduce || !to) {
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }).onfinish = () => setGone(true);
        announce();
        return;
      }
      // Fly the logo from the centre into the nav logo's exact box.
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const s = b.width / a.width;
      // Freeze the spin where it is, then ease it back upright on the way.
      const angle = getComputedStyle(from).transform;
      from.classList.remove("ld-spin");
      from.animate(
        [
          { transform: angle === "none" ? "none" : angle },
          { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)` },
        ],
        { duration: FLY_MS, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" },
      );
      el.querySelector(".ld-bg")?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: FLY_MS,
        easing: "ease-in",
        fill: "forwards",
      });
      bar.current?.parentElement?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      setTimeout(() => {
        announce(); // the nav logo appears exactly where ours landed
        setGone(true);
      }, FLY_MS);
    }

    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (gone) return null;

  return (
    <div ref={wrap} className="ld" role="status" aria-label="Loading Wireframe Studio">
      <div className="ld-bg" />
      {/* eslint-disable-next-line @next/next/no-img-element -- must be a plain img to measure and fly */}
      <img ref={logo} src="/logo-2d.png" alt="" width={96} height={96} className="ld-logo ld-spin" draggable={false} />
      <div className="ld-track" aria-hidden>
        <div ref={bar} className="ld-bar" />
      </div>
    </div>
  );
}
