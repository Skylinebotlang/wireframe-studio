// ─────────────────────────────────────────────────────────────────────────────
// HERO — the first 8 seconds. Starts the moment the loader hands off.
//
//   +0.0 s  THE PROBLEM  three frames draw in, one per person (Priya, PM;
//                        Leo, Design; Sam, Dev), each with a wine cursor.
//                        Each builds its OWN checkout screen. They don't match.
//   +1.5 s               "doesn't match" tags flag the clashing buttons.
//                        The AI character looks from frame to frame.
//   +2.0 s  THE FIX      the orange AI cursor arrives and the character starts
//                        drawing: the three frames slide together and MERGE
//                        into one. Headline lands:
//                        "Everybody has the context, not just the AI."
//   +2.7 s               the merged screen assembles box by box, each box
//                        edged in orange while the AI draws it.
//   +4.1 s               the orange fades: the wireframe now looks like any
//                        shape a person drew (same as in the app). The AI's
//                        decision note explains what it kept from whom.
//   +4.3 s               "Three teams. One canvas. One answer." + Start the
//                        chat + "Scroll to see how it works".
// With the loader (1.2–2.5 s) the whole story is done by about 7 seconds.
//
// The merged frame is the SPOT for a future screen recording of the real
// app (data-slot="recording"); its boxes are the stand-in until then.
//
// Every element's resting place is its normal CSS position, so the page is
// complete without JavaScript and with reduced motion (nothing moves; you
// see the finished, merged screen). The timeline only animates transform,
// opacity and clip-path. Scrolling during the story speeds it up.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Cursor } from "./Cursor";
import { StartChatButton } from "./StartChatButton";
import { onLoaded, prefersReducedMotion, tellAgent } from "./bus";
import { setAgentStatus } from "./LaunchNav";

// A box inside a wireframe: position and size in % of its frame.
type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "bar" | "img" | "btn" | "line" | "tab" | "row";
  label?: string;
  clash?: boolean;
};

const PEOPLE: { id: string; cursor: string; frame: string; boxes: Box[] }[] = [
  {
    id: "p1",
    cursor: "Priya (PM)",
    frame: "Priya’s checkout",
    boxes: [
      { x: 6, y: 5, w: 88, h: 8, kind: "bar" },
      { x: 6, y: 18, w: 88, h: 30, kind: "img" },
      { x: 6, y: 53, w: 62, h: 5, kind: "line" },
      { x: 6, y: 61, w: 40, h: 5, kind: "line" },
      { x: 6, y: 80, w: 88, h: 13, kind: "btn", label: "Pay now", clash: true },
    ],
  },
  {
    id: "p2",
    cursor: "Leo (Design)",
    frame: "Leo’s checkout",
    boxes: [
      { x: 6, y: 5, w: 88, h: 8, kind: "bar" },
      { x: 60, y: 17, w: 34, h: 8, kind: "btn", label: "Buy", clash: true },
      { x: 6, y: 30, w: 42, h: 28, kind: "img" },
      { x: 52, y: 30, w: 42, h: 28, kind: "img" },
      { x: 6, y: 62, w: 42, h: 28, kind: "img" },
      { x: 52, y: 62, w: 42, h: 28, kind: "img" },
    ],
  },
  {
    id: "p3",
    cursor: "Sam (Dev)",
    frame: "Sam’s checkout",
    boxes: [
      { x: 6, y: 5, w: 88, h: 8, kind: "bar" },
      { x: 6, y: 17, w: 27, h: 7, kind: "tab" },
      { x: 37, y: 17, w: 27, h: 7, kind: "tab" },
      { x: 68, y: 17, w: 26, h: 7, kind: "tab" },
      { x: 6, y: 30, w: 88, h: 9, kind: "row" },
      { x: 6, y: 42, w: 88, h: 9, kind: "row" },
      { x: 6, y: 54, w: 88, h: 9, kind: "row" },
      { x: 6, y: 81, w: 40, h: 11, kind: "btn", label: "Next", clash: true },
    ],
  },
];

// The one screen the AI merges them into: Sam's tabs, Leo's cards,
// Priya's one-step "Pay now".
const MERGED: Box[] = [
  { x: 5, y: 4, w: 90, h: 7, kind: "bar" },
  { x: 5, y: 14, w: 28, h: 6, kind: "tab" },
  { x: 36, y: 14, w: 28, h: 6, kind: "tab" },
  { x: 67, y: 14, w: 28, h: 6, kind: "tab" },
  { x: 5, y: 25, w: 28, h: 25, kind: "img" },
  { x: 36, y: 25, w: 28, h: 25, kind: "img" },
  { x: 67, y: 25, w: 28, h: 25, kind: "img" },
  { x: 5, y: 56, w: 62, h: 5, kind: "line" },
  { x: 5, y: 64, w: 42, h: 5, kind: "line" },
  { x: 5, y: 78, w: 90, h: 13, kind: "btn", label: "Pay now" },
];

function Boxes({ boxes, ai = false }: { boxes: Box[]; ai?: boolean }) {
  return (
    <>
      {boxes.map((b, i) => (
        <i
          key={i}
          className={`ls-box ls-box--${b.kind}`}
          style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
          data-clash={b.clash ? "" : undefined}
        >
          {b.label && <span className="ls-mono">{b.label}</span>}
          {ai && <b className="ls-box-ai" />}
        </i>
      ))}
    </>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const aiTag = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      setAgentStatus("watching");
      return;
    }
    const el = root.current!;
    const q = gsap.utils.selector(el);
    let tl: gsap.core.Timeline | null = null;
    let cleanupSpeed = () => {};

    const ctx = gsap.context(() => {
      const stage = q(".ls-stage")[0] as HTMLElement;
      const frames = q(".ls-frame--person") as HTMLElement[];
      const merged = q(".ls-frame--merged")[0] as HTMLElement;
      const peopleCur = q(".ls-cur--person") as HTMLElement[];
      const aiCur = q(".ls-cur--ai")[0] as HTMLElement;

      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const fw = frames[0].offsetWidth;
      const fh = frames[0].offsetHeight;
      const spread = fw * 1.12;
      const spreads = [-spread, 0, spread];
      const tilts = [-3, 1.5, 3];
      const cx = W / 2;
      const cy = H * 0.46;

      // Where a box's centre is on the stage, for frame i at its spread place.
      const boxPoint = (i: number, b: Box) => ({
        x: cx + spreads[i] - fw / 2 + ((b.x + b.w / 2) / 100) * fw,
        y: cy - fh / 2 + ((b.y + b.h / 2) / 100) * fh,
      });
      const mw = merged.offsetWidth;
      const mh = merged.offsetHeight;
      const mergedPoint = (b: Box) => ({
        x: cx - mw / 2 + ((b.x + b.w * 0.7) / 100) * mw,
        y: cy - mh / 2 + ((b.y + b.h * 0.7) / 100) * mh,
      });
      // Offset a cursor from its resting spot so its tip lands on (x, y).
      const off = (c: HTMLElement, p: { x: number; y: number }) => ({ x: p.x - c.offsetLeft, y: p.y - c.offsetTop });
      // Screen point of a stage point (for the character's gaze).
      const screen = (p: { x: number; y: number }) => {
        const r = stage.getBoundingClientRect();
        return { x: r.left + p.x, y: r.top + p.y };
      };

      // ── Starting state (hidden behind the loader) ───────────────────────
      frames.forEach((f, i) =>
        gsap.set(f, { autoAlpha: 1, x: spreads[i], rotation: tilts[i], clipPath: "inset(0% 0% 100% 0%)" })
      );
      gsap.set(q(".ls-frame--person .ls-box"), { opacity: 0, scale: 0.86 });
      gsap.set(q(".ls-frame--person .ls-frame-name"), { opacity: 0 });
      peopleCur.forEach((c, i) => gsap.set(c, { opacity: 0, ...off(c, boxPoint(i, PEOPLE[i].boxes[0])) }));
      gsap.set(q(".ls-clash"), { autoAlpha: 0, y: 6 });
      gsap.set(merged, { opacity: 0, scale: 0.94 });
      gsap.set(q(".ls-frame--merged .ls-box"), { clipPath: "inset(0% 100% 0% 0%)" });
      gsap.set(q(".ls-box-ai, .ls-frame-ai"), { opacity: 1 });
      gsap.set(q(".ls-frame--merged .ls-frame-name, .ls-decision"), { opacity: 0, y: 6 });
      gsap.set(aiCur, { opacity: 0, x: 80, y: 40 });
      gsap.set(q(".ls-line-in"), { yPercent: 108 });
      gsap.set(q(".ls-sub, .ls-lede, .ls-actions"), { opacity: 0, y: 16 });
      if (aiTag.current) aiTag.current.textContent = "Agent";

      // ── The story ───────────────────────────────────────────────────────
      tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
      tl.add(() => setAgentStatus("watching"), 0);

      // THE PROBLEM: three frames, three people, three different screens.
      tl.to(frames, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.6, stagger: 0.12, ease: "power2.inOut" }, 0);
      tl.to(q(".ls-frame--person .ls-frame-name"), { opacity: 1, duration: 0.3, stagger: 0.12 }, 0.2);
      tl.to(peopleCur, { opacity: 1, duration: 0.25, stagger: 0.12 }, 0.15);

      PEOPLE.forEach((p, i) => {
        const start = 0.3 + i * 0.12;
        const boxEls = frames[i].querySelectorAll(".ls-box");
        tl!.to(boxEls, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.1, ease: "power3.out" }, start);
        p.boxes.forEach((b, j) => {
          if (j === 0) return;
          tl!.to(
            peopleCur[i],
            { ...off(peopleCur[i], boxPoint(i, b)), duration: 0.22, ease: "power2.inOut" },
            start + j * 0.1
          );
        });
      });
      // The character glances at each person's frame.
      [0, 1, 2].forEach((i) =>
        tl!.add(
          () => {
            const pt = screen({ x: cx + spreads[i], y: cy });
            tellAgent({ type: "look", ...pt, ms: 520 });
          },
          0.25 + i * 0.5
        )
      );
      // The clash.
      tl.to(q(".ls-clash"), { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.08 }, 1.5);
      tl.to(
        q(".ls-frame--person [data-clash]"),
        { scale: 1.06, duration: 0.15, yoyo: true, repeat: 1, stagger: 0.08 },
        1.5
      );

      // THE FIX: the AI arrives, the frames merge into one.
      tl.add(() => {
        if (aiTag.current) aiTag.current.textContent = "Agent: merging 3 requests";
        tellAgent({ type: "draw", on: true });
        tellAgent({ type: "mood", mood: "focus" });
        tellAgent({ type: "look", ...screen({ x: cx, y: cy }), ms: 2200 });
        setAgentStatus("merging 3 requests");
      }, 2.0);
      tl.to(aiCur, { opacity: 1, ...off(aiCur, { x: cx + mw * 0.2, y: cy - mh * 0.3 }), duration: 0.5 }, 2.0);
      tl.to(q(".ls-clash"), { autoAlpha: 0, duration: 0.2 }, 2.0);
      tl.to(frames, { x: 0, rotation: 0, duration: 0.7, ease: "power3.inOut" }, 2.05);
      tl.to(frames, { opacity: 0, duration: 0.3, ease: "power1.in" }, 2.5);
      tl.to(merged, { opacity: 1, scale: 1, duration: 0.4 }, 2.5);
      tl.to(peopleCur, { x: 0, y: 0, duration: 0.9, stagger: 0.06, ease: "power2.inOut" }, 2.15);
      tl.to(q(".ls-line-in"), { yPercent: 0, duration: 0.9, stagger: 0.15, ease: "expo.out" }, 2.3);

      // The AI draws the merged screen, box by box.
      const mergedBoxes = q(".ls-frame--merged .ls-box");
      MERGED.forEach((b, j) => {
        const at = 2.7 + j * 0.1;
        tl!.to(mergedBoxes[j], { clipPath: "inset(0% 0% 0% 0%)", duration: 0.32, ease: "power2.out" }, at);
        tl!.to(aiCur, { ...off(aiCur, mergedPoint(b)), duration: 0.12, ease: "power1.inOut" }, at);
      });

      // Done: the orange fades, the decision is explained, the ask appears.
      tl.add(() => {
        if (aiTag.current) aiTag.current.textContent = "Agent: done";
        tellAgent({ type: "draw", on: false });
        tellAgent({ type: "mood", mood: "idle" });
        setAgentStatus("watching");
      }, 4.1);
      tl.to(q(".ls-box-ai, .ls-frame-ai"), { opacity: 0, duration: 0.5, stagger: 0.015, ease: "power1.out" }, 4.1);
      tl.to(aiCur, { x: 0, y: 0, duration: 0.6, ease: "power2.inOut" }, 4.1);
      tl.to(
        q(".ls-frame--merged .ls-frame-name, .ls-decision"),
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 },
        4.2
      );
      tl.to(q(".ls-sub"), { opacity: 1, y: 0, duration: 0.5 }, 4.3);
      tl.to(q(".ls-lede"), { opacity: 1, y: 0, duration: 0.5 }, 4.42);
      tl.to(q(".ls-actions"), { opacity: 1, y: 0, duration: 0.5 }, 4.5);
    }, el);

    // Start when the loader hands off. Scrolling or a key press during the
    // story speeds it up instead of leaving it half-played.
    const stopWaiting = onLoaded(() => {
      tl?.play(0);
      const hurry = () => {
        if (tl && tl.isActive()) tl.timeScale(4);
      };
      addEventListener("wheel", hurry, { passive: true, once: true });
      addEventListener("touchmove", hurry, { passive: true, once: true });
      addEventListener("keydown", hurry, { once: true });
      cleanupSpeed = () => {
        removeEventListener("wheel", hurry);
        removeEventListener("touchmove", hurry);
        removeEventListener("keydown", hurry);
      };
    });

    return () => {
      stopWaiting();
      cleanupSpeed();
      ctx.revert();
    };
  }, []);

  return (
    <section ref={root} id="top" className="ls-hero" aria-labelledby="ls-hero-title">
      <div className="ls-hero-top">
        {/* The 3D character lands here (app/launch/CharacterDock.tsx). */}
        <div id="ls-spot-hero" className="ls-spot-hero" aria-hidden />

        <div className="ls-stage" aria-hidden>
          {PEOPLE.map((p) => (
            <div key={p.id} className={`ls-frame ls-frame--person ls-frame--${p.id}`}>
              <span className="ls-frame-name ls-mono">{p.frame}</span>
              <Boxes boxes={p.boxes} />
              <span className="ls-clash ls-mono">doesn’t match</span>
            </div>
          ))}

          <div className="ls-frame ls-frame--merged" data-slot="recording">
            <span className="ls-frame-name ls-mono">Checkout, merged</span>
            <span className="ls-frame-ai" />
            <Boxes boxes={MERGED} ai />
            <p className="ls-decision ls-mono">Agent: one checkout. Sam’s tabs, Leo’s cards, Priya’s one-step pay.</p>
          </div>

          {PEOPLE.map((p, i) => (
            <Cursor key={p.id} name={p.cursor} className={`ls-cur--person ls-cur--r${i + 1}`} />
          ))}
          <Cursor name="Agent" ai className="ls-cur--rest-ai" tagRef={aiTag} />
        </div>
      </div>

      <div className="ls-hero-copy">
        <h1 id="ls-hero-title" className="ls-h1">
          <span className="ls-line">
            <span className="ls-line-in">Everybody has the context,</span>
          </span>
          <span className="ls-line ls-line--2">
            <span className="ls-line-in">not just the AI.</span>
          </span>
        </h1>
        <div className="ls-hero-foot">
          <div className="ls-hero-text">
            <p className="ls-sub">Three teams. One canvas. One answer.</p>
            <p className="ls-lede">
              Your whole team prompts one AI on one live canvas. It reads every request, merges the clashes, and draws
              the screens where everyone can see them.
            </p>
          </div>
          <div className="ls-actions">
            <StartChatButton />
            <a href="#problem" className="ls-scrollhint">
              <span>Scroll to see how it works</span>
              <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden>
                <path d="M6 1v13M1 9l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
