// ─────────────────────────────────────────────────────────────────────────────
// LIVE CURSORS — three teammates who travel with you through the whole site:
// Priya (wine light), Leo (rose) and the AI Agent (ORANGE, agent only).
//
// What happens, in plain words:
//   1. When the hero story ends, they JUMP OUT of the hero's window: each
//      in-window cursor hops, and a live cursor leaps from that exact spot
//      in an arc, grows to full size and lands on the page. From then on
//      they float over every page.
//   2. Each time you reach a new screen, they glide to its parts as if
//      they're building it: the people to the headline and the scene, the
//      Agent to the middle of the scene. The Agent's chip says what it's
//      drawing ("drawing: chapter 03").
//   3. They keep roaming across the page: move, pause a moment, move on.
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
      // Keep the whole cursor + name tag on screen.
      const x = Math.min(innerWidth - 170, Math.max(16, r.left - p.left + r.width * fx));
      const y = Math.min(innerHeight - 90, Math.max(16, r.top - p.top + r.height * fy));
      return { x, y };
    };
    const targets = (s: HTMLElement) => [
      point(s, ".ch-line, .hud-title, .ch6-line, .lp-big", 0.6, -0.12) ?? { x: innerWidth * 0.2, y: innerHeight * 0.3 },
      point(s, ".ch-scene, .hud-progress, .sc6, .lp-links", 0.85, 0.15) ?? { x: innerWidth * 0.75, y: innerHeight * 0.25 },
      point(s, ".ch-scene, .hi-scene, .sc6, .lp-links", 0.5, 0.55) ?? { x: innerWidth * 0.5, y: innerHeight * 0.5 },
    ];

    // 1. THE JUMP OUT (first landing screen only): each cursor inside the
    //    hero window hops up, and from that exact spot a live cursor leaps
    //    out of the window in an arc, grows into its full size and lands on
    //    its spot on the page. The in-window one fades as it leaves.
    const from = [".hi-g0", ".hi-g1", ".hi-agent"].map((s) => document.querySelector<HTMLElement>(s));
    // Land on the screen you're on right now (you may have skipped ahead).
    const here = Math.round((window as Window & { __wfsScreen?: number }).__wfsScreen ?? 0);
    const land = targets(screens()[here] ?? screens()[0]);
    // Where each cursor's base position is heading (roaming is measured from here).
    const anchor = land.map((p) => ({ ...p }));
    const jump = gsap.timeline({
      // A touch quicker than written, to keep the opening short.
      onStart() {
        this.timeScale(1.4);
      },
      // When everyone has landed, hide all in-window cursors for good.
      onComplete: () => {
        document.documentElement.classList.add("lc-on");
        setChip(`drawing: ${NAMES[last] ?? "the page"}`);
      },
    });
    [priya, leo, agent].forEach((c, i) => {
      const r = from[i]?.getBoundingClientRect() ?? { left: innerWidth / 2, top: innerHeight / 2 };
      const to = land[i];
      const peak = Math.min(r.top, to.y) - 110; // top of the arc
      const t = i * 0.14;
      gsap.set(c, { x: r.left, y: r.top, scale: 0.75, autoAlpha: 0, transformOrigin: "0 0" });
      if (from[i]) {
        jump.to(from[i], { y: "-=22", scale: 1.35, duration: 0.22, ease: "power2.out" }, t);
        jump.to(from[i], { autoAlpha: 0, duration: 0.18 }, t + 0.2);
      }
      jump.to(c, { autoAlpha: 1, duration: 0.15 }, t + 0.18);
      jump.to(c, { x: to.x, duration: 0.95, ease: "power1.inOut" }, t + 0.18);
      jump.to(c, { y: peak, scale: 1.25, duration: 0.45, ease: "power2.out" }, t + 0.18);
      jump.to(c, { y: to.y, scale: 1, duration: 0.5, ease: "power2.in" }, t + 0.63);
    });

    // 3. Roaming: each cursor keeps travelling across the page — it moves
    //    to a spot, pauses for a moment (like it's working there), then
    //    moves on. Done on an inner layer, so it adds to the screen-to-screen
    //    travel above. Every stop stays fully on screen.
    let alive = true;
    const roamers = [priya, leo, agent].map((c, i) => {
      const inner = c.firstElementChild as HTMLElement;
      const hop = () => {
        if (!alive) return;
        const { x: ax, y: ay } = anchor[i];
        const tx = gsap.utils.random(40, innerWidth - 220), ty = gsap.utils.random(90, innerHeight - 140);
        gsap.to(inner, {
          x: tx - ax,
          y: ty - ay,
          duration: gsap.utils.random(1.3, 2.4),
          ease: "power2.inOut",
          delay: gsap.utils.random(0.6, 1.8) + i * 0.3, // the short break
          onComplete: hop,
        });
      };
      hop();
      return inner;
    });

    // 2. Glide to the parts of the screen you're on.
    let last = here; // already standing on this screen after the jump
    const moveTo = (u: number) => {
      const s = screens()[u];
      if (!s || u === last) return;
      last = u;
      targets(s).forEach((p, i) => {
        anchor[i] = p;
        gsap.to([priya, leo, agent][i], { x: p.x, y: p.y, duration: 1.1 + i * 0.15, ease: "power3.inOut", overwrite: "auto" });
      });
      setChip(`drawing: ${NAMES[u] ?? "the page"}`);
    };
    const onScreen = (e: Event) => moveTo(Math.round((e as CustomEvent<number>).detail));
    addEventListener("wfs:screen", onScreen);
    return () => {
      jump.kill();
      removeEventListener("wfs:screen", onScreen);
      alive = false;
      gsap.killTweensOf(roamers);
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
