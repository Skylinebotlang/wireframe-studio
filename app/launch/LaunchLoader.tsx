// ─────────────────────────────────────────────────────────────────────────────
// LOADER — the very first thing you see.
//
//   • Starts right after the drag splash (app/Splash.tsx) is let go.
//   • Deep navy screen. The AI character stands in the middle and its orange
//     outline draws in from the bottom up. How far it has drawn = how much of
//     the site has really loaded (fonts, logo, the 3D character, the page).
//   • A small label underneath counts up: "Waking up the agent 64%".
//   • The count is smoothed, so it never jumps or stalls. It shows for at
//     least 1.2 s and is always done by 2.5 s, even if something is slow.
//   • Hand-off (no cut to black): the character turns solid and waves, the
//     navy curtain fades away, and the character glides from the middle of
//     the screen into its spot next to the headline. Then the hero story
//     starts (it listens for "ls:loaded", see app/launch/bus.ts).
//   • Reduced motion: no gliding or drawing; a simple fade.
// Only transform and opacity are animated here.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { AGENT_READY_EVENT, LOADED_EVENT, prefersReducedMotion, tellAgent } from "./bus";

const MIN_MS = 1200;
const MAX_MS = 2500;

export function LaunchLoader() {
  const root = useRef<HTMLDivElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = root.current!;
    const reduced = prefersReducedMotion();
    const html = document.documentElement;

    // Always start at the top: the character's spot is measured there.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    html.classList.add("ls-lock");

    // ── Real loading tasks ──────────────────────────────────────────────────
    const tasks = { fonts: false, logo: false, agent: false, page: false };
    const total = Object.keys(tasks).length;
    const doneCount = () => Object.values(tasks).filter(Boolean).length;

    document.fonts?.ready.then(() => (tasks.fonts = true)).catch(() => (tasks.fonts = true));
    const img = new Image();
    img.src = "/logo-2d.png";
    img
      .decode()
      .catch(() => {})
      .finally(() => (tasks.logo = true));
    const onAgent = () => (tasks.agent = true);
    addEventListener(AGENT_READY_EVENT, onAgent, { once: true });
    const onPage = () => (tasks.page = true);
    if (document.readyState === "complete") tasks.page = true;
    else addEventListener("load", onPage, { once: true });

    // ── Put the character in the middle of the screen while loading ─────────
    const inner = document.querySelector<HTMLElement>(".ls-dock-in");
    const heroSpot = document.getElementById("ls-spot-hero");
    if (inner && heroSpot && !reduced) {
      const r = heroSpot.getBoundingClientRect();
      const big = window.innerWidth > 720 ? 1.15 : 1;
      gsap.set(inner, {
        x: window.innerWidth / 2 - (r.left + r.width / 2),
        y: window.innerHeight / 2 - (r.top + r.height / 2) - r.height * 0.08,
        scale: big,
        transformOrigin: "50% 50%",
      });
    }

    // ── Smoothed progress ───────────────────────────────────────────────────
    let start = performance.now();
    let shown = 0;
    let finished = false;
    let raf = 0;

    const tick = () => {
      const elapsed = performance.now() - start;
      const real = doneCount() / total;
      // A slow time-based floor keeps it moving even while waiting on a task;
      // the real progress pulls it ahead when things finish.
      const floor = Math.min(0.9, (elapsed / MAX_MS) * 0.95);
      const target = Math.max(real, floor);
      shown += (target - shown) * 0.12;
      const ready = (real >= 1 && elapsed >= MIN_MS) || elapsed >= MAX_MS;
      if (ready) shown += (1 - shown) * 0.35;

      const p = Math.min(1, shown);
      if (pct.current) pct.current.textContent = `${Math.round(p * 100)}%`;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      tellAgent({ type: "progress", p });

      if (ready && p > 0.995 && !finished) {
        finished = true;
        handOff();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    // Wait for the drag splash (app/Splash.tsx) to be gone before drawing,
    // so the visitor actually sees the robot draw itself in.
    const begin = () => {
      start = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const w = window as Window & { __wfsLoaded?: boolean };
    if (w.__wfsLoaded) begin();
    else addEventListener("wfs:loaded", begin, { once: true });

    // ── Hand-off into the hero ──────────────────────────────────────────────
    let tl: gsap.core.Timeline | null = null;
    function handOff() {
      tellAgent({ type: "solid" });
      const finish = () => {
        el.style.display = "none";
        html.classList.remove("ls-lock");
        html.classList.add("ls-ready");
        window.__lsLoaded = true;
        dispatchEvent(new Event(LOADED_EVENT));
      };
      if (reduced) {
        tl = gsap.timeline({ onComplete: finish });
        tl.to(el, { opacity: 0, duration: 0.4 }, 0.1).to(".ls-nav", { opacity: 1, duration: 0.3 }, 0.1);
        return;
      }
      tl = gsap.timeline({ onComplete: finish });
      tl.add(() => tellAgent({ type: "wave" }), 0.35)
        .to(".ls-loader-meta", { opacity: 0, y: 8, duration: 0.3, ease: "power2.in" }, 0.25)
        .to(el, { opacity: 0, duration: 0.7, ease: "power2.inOut" }, 0.55)
        .to(inner, { x: 0, y: 0, scale: 1, duration: 1.0, ease: "power3.inOut" }, 0.45)
        .to(".ls-nav", { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.9);
    }

    return () => {
      cancelAnimationFrame(raf);
      tl?.kill();
      removeEventListener(AGENT_READY_EVENT, onAgent);
      removeEventListener("load", onPage);
      removeEventListener("wfs:loaded", begin);
      html.classList.remove("ls-lock");
    };
  }, []);

  return (
    <div ref={root} className="ls-loader dots">
      <p className="sr-only" role="status">
        Loading Wireframe Studio
      </p>
      <div className="ls-loader-meta" aria-hidden>
        <p className="ls-mono ls-loader-label">
          <span>Waking up the agent</span>
          <span ref={pct} className="ls-loader-pct">
            0%
          </span>
        </p>
        <div className="ls-loader-track">
          <i ref={bar} />
        </div>
      </div>
    </div>
  );
}
