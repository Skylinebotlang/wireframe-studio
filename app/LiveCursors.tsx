// ─────────────────────────────────────────────────────────────────────────────
// LIVE CURSORS — three teammates who travel with you through the whole site:
// Priya (wine light), Leo (rose) and the AI Agent (ORANGE, agent only).
//
// What happens, in plain words:
//   1. When the hero story ends, they come OUT of the hero's frame (they
//      start exactly where the hero's own cursors are) into a layer that
//      floats over every page.
//   2. Each time you reach a new screen, they glide to its parts as if
//      they're building it: the people to the headline and the scene, the
//      Agent to the middle of the scene. The Agent's chip says what it's
//      drawing ("drawing: chapter 03").
//   3. In between, they wander gently, like real people thinking.
//
// The screen you're on comes from app/Chapters.tsx ("wfs:screen" event).
// The layer never catches clicks. Hidden for reduced motion.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const NAMES = ["the hero", "chapter 01", "chapter 02", "chapter 03", "chapter 04", "chapter 05", "chapter 06", "the footer"];

export function LiveCursors() {
  const root = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [chip, setChip] = useState("joining the canvas");

  // Appear when the hero story is done.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const w = window as Window & { __wfsHeroDone?: boolean };
    const go = () => setOn(true);
    if (w.__wfsHeroDone) requestAnimationFrame(go);
    else addEventListener("wfs:hero-done", go, { once: true });
    return () => removeEventListener("wfs:hero-done", go);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!on || !el) return;
    const [priya, leo, agent] = [...el.querySelectorAll<HTMLElement>(".lc")];
    const screens = () => [...document.querySelectorAll<HTMLElement>(".hs-track > *, .dz > .dz-panel")];

    // A point inside `sel` on screen `s`, measured as if the screen sat at
    // the top-left of the window (where every screen is when you're on it).
    const point = (s: HTMLElement, sel: string, fx: number, fy: number) => {
      const t = s.querySelector<HTMLElement>(sel);
      if (!t) return null;
      const r = t.getBoundingClientRect();
      const p = s.getBoundingClientRect();
      return { x: r.left - p.left + r.width * fx, y: r.top - p.top + r.height * fy };
    };
    const targets = (s: HTMLElement) => [
      point(s, ".ch-line, .hud-title, .ch6-line, .lp-big", 0.6, -0.12) ?? { x: innerWidth * 0.2, y: innerHeight * 0.3 },
      point(s, ".ch-scene, .hud-progress, .sc6, .lp-links", 0.85, 0.15) ?? { x: innerWidth * 0.75, y: innerHeight * 0.25 },
      point(s, ".ch-scene, .hi-scene, .sc6, .lp-links", 0.5, 0.55) ?? { x: innerWidth * 0.5, y: innerHeight * 0.5 },
    ];

    // 1. Start where the hero's own cursors are, then hide those.
    const from = [".hi-g0", ".hi-g1", ".hi-agent"].map((s) => document.querySelector<HTMLElement>(s));
    [priya, leo, agent].forEach((c, i) => {
      const r = from[i]?.getBoundingClientRect();
      gsap.set(c, { x: r ? r.left : innerWidth / 2, y: r ? r.top : innerHeight / 2, autoAlpha: 1 });
    });
    gsap.to(from, { autoAlpha: 0, duration: 0.3 });
    // Only one orange Agent on screen: hide the ones drawn inside scenes.
    document.documentElement.classList.add("lc-on");

    // 3. Gentle wandering on an inner layer (so it adds to the travel).
    const wander = [priya, leo, agent].map((c, i) => {
      const inner = c.firstElementChild!;
      const r = (n: number) => (i % 2 ? -n : n);
      return gsap
        .timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut", duration: 1.8 + i * 0.2 } })
        .to(inner, { x: r(26), y: -14 })
        .to(inner, { x: r(-12), y: 22 })
        .to(inner, { x: r(18), y: 6 });
    });

    // 2. Glide to the parts of the screen you're on.
    let last = -1;
    const moveTo = (u: number) => {
      const s = screens()[u];
      if (!s || u === last) return;
      last = u;
      targets(s).forEach((p, i) =>
        gsap.to([priya, leo, agent][i], { x: p.x, y: p.y, duration: 1.1 + i * 0.15, ease: "power3.inOut", overwrite: "auto" }),
      );
      setChip(`drawing: ${NAMES[u] ?? "the page"}`);
    };
    const onScreen = (e: Event) => moveTo(Math.round((e as CustomEvent<number>).detail));
    addEventListener("wfs:screen", onScreen);
    const first = setTimeout(() => moveTo(0), 400);
    return () => {
      clearTimeout(first);
      removeEventListener("wfs:screen", onScreen);
      wander.forEach((t) => t.kill());
      gsap.killTweensOf([priya, leo, agent]);
      document.documentElement.classList.remove("lc-on");
    };
  }, [on]);

  if (!on) return null;
  return (
    <div ref={root} className="lc-layer" aria-hidden>
      <Cur name="Priya · PM" color="var(--wine-light)" />
      <Cur name="Leo · Design" color="var(--rose)" />
      <Cur name="Agent" color="var(--agent)" agent chip={chip} />
    </div>
  );
}

function Cur({ name, color, agent, chip }: { name: string; color: string; agent?: boolean; chip?: string }) {
  return (
    <div className="lc" style={{ "--c": color } as React.CSSProperties}>
      <div className="lc-in">
        {agent ? (
          // The Agent's cursor: a four-point star, so it never looks human.
          <svg width="22" height="22" viewBox="0 0 24 24">
            <polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" fill={color} stroke="var(--paper)" strokeWidth="1.5" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.35-4.35a1 1 0 0 1 .71-.29h6.12c.45 0 .67-.54.35-.85L5.5 3.21z" fill={color} stroke="var(--paper)" strokeWidth="1.5" />
          </svg>
        )}
        <div className="lc-tags">
          <span className="lc-name lp-mono">
            {agent && <i className="hi-dot" />}
            {name}
          </span>
          {chip && <span className="lc-chip lp-mono">[{chip}]</span>}
        </div>
      </div>
    </div>
  );
}
