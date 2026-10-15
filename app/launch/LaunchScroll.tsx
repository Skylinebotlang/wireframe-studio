// ─────────────────────────────────────────────────────────────────────────────
// SMOOTH SCROLL + CHAPTER PILLS
//
// LaunchScroll: soft, weighted scrolling (Lenis) kept in step with GSAP's
// scroll animations (ScrollTrigger). Held still until the loader is done.
// Puts the Lenis instance on window.__lenis. Reduced motion: normal scrolling.
//
// ChapterPills: the row of chapter buttons at the bottom of the screen, plus
// "Skip the intro" on the right (jumps to the live demo). Works with the
// keyboard (they are real buttons). The current chapter is marked, and the
// AI status in the top bar changes with it.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { onLoaded, prefersReducedMotion } from "./bus";
import { setAgentStatus } from "./LaunchNav";

gsap.registerPlugin(ScrollTrigger);

export function LaunchScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.1 });
    const w = window as Window & { __lenis?: Lenis };
    w.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
    const stop = onLoaded(() => {
      lenis.start();
      ScrollTrigger.refresh();
    });
    return () => {
      stop();
      gsap.ticker.remove(raf);
      lenis.destroy();
      delete w.__lenis;
    };
  }, []);
  return null;
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const lenis = (window as Window & { __lenis?: Lenis }).__lenis;
  if (lenis) lenis.scrollTo(el, { duration: 1.3, offset: el.id === "top" ? 0 : -64 });
  else el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  // Move keyboard focus to the chapter, so Tab continues from there.
  const heading = el.querySelector<HTMLElement>("h1, h2");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

const CHAPTERS = [
  { id: "top", label: "Start", status: "watching" },
  { id: "problem", label: "The problem", status: "listening" },
  { id: "how", label: "How it works", status: "drawing" },
  { id: "try", label: "Try it", status: "waiting for you" },
  { id: "start", label: "Join", status: "ready when you are" },
];

export function ChapterPills() {
  const [current, setCurrent] = useState("top");

  useLayoutEffect(() => {
    const triggers = CHAPTERS.map((c) =>
      ScrollTrigger.create({
        trigger: `#${c.id}`,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (st) => {
          if (!st.isActive) return;
          setCurrent(c.id);
          if (c.id !== "top") setAgentStatus(c.status);
        },
      })
    );
    return () => triggers.forEach((t) => t.kill());
  }, []);

  return (
    <nav className="ls-pills" aria-label="Chapters">
      <ul>
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="ls-pill ls-mono"
              aria-current={current === c.id ? "true" : undefined}
              onClick={() => scrollToId(c.id)}
            >
              {c.label}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ls-pill ls-pill--skip ls-mono" onClick={() => scrollToId("try")}>
        Skip the intro
      </button>
    </nav>
  );
}
