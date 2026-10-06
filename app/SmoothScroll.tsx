// ─────────────────────────────────────────────────────────────────────────────
// SMOOTH SCROLL — gives the landing page soft, weighted scrolling (Lenis)
// and keeps GSAP's scroll animations (ScrollTrigger) in step with it.
//
//   • Waits for the loader to finish before letting the page scroll.
//   • Puts the Lenis instance on window.__lenis so buttons (chapter pills,
//     "Skip the intro") can glide to a section.
//   • Reduced motion: does nothing — normal browser scrolling.
// Landing page only (it's rendered from app/page.tsx). Draws nothing.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.1 });
    const w = window as Window & { __lenis?: Lenis; __wfsLoaded?: boolean };
    w.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Hold still while the loader is up.
    const start = () => lenis.start();
    if (!w.__wfsLoaded) {
      lenis.stop();
      addEventListener("wfs:loaded", start, { once: true });
    }
    return () => {
      removeEventListener("wfs:loaded", start);
      gsap.ticker.remove(raf);
      lenis.destroy();
      delete w.__lenis;
    };
  }, []);
  return null;
}

// Glide (or jump, without Lenis) to an element. Used by pills and buttons.
export function scrollToEl(el: Element | null) {
  if (!el) return;
  const lenis = (window as Window & { __lenis?: Lenis }).__lenis;
  if (lenis) lenis.scrollTo(el as HTMLElement, { duration: 1.4 });
  else el.scrollIntoView();
}
