// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER: LIVE TOGETHER (brought over from the old landing page's chapter 03)
//
//   • Left: a shared canvas. Three named cursors (Priya, Leo, Sam, in people
//     colours) move across it while shapes appear.
//   • Right: the activity feed fills in, one change at a time: who did what,
//     people in wine, the AI's line in orange.
// Pinned and driven by scroll on laptops; a simple reveal on phones.
// Reduced motion: shown finished, nothing moves.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Cursor } from "./Cursor";
import { prefersReducedMotion } from "./bus";

gsap.registerPlugin(ScrollTrigger);

const FEED = [
  { who: "Priya", what: "added a note: “summary on top”" },
  { who: "Leo", what: "moved the hero image" },
  { who: "Agent", what: "drew 2 screens", ai: true },
  { who: "Sam", what: "renamed the button “Start”" },
];

export function LiveChapter() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const el = root.current!;
    const q = gsap.utils.selector(el);
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top top", end: "+=100%", pin: true, scrub: 0.6 },
        defaults: { ease: "none" },
      });
      tl.fromTo(q(".ls-live-c0"), { x: 20, y: 30 }, { x: 260, y: 150, duration: 1 }, 0)
        .fromTo(q(".ls-live-c1"), { x: 300, y: 40 }, { x: 80, y: 220, duration: 1 }, 0)
        .fromTo(q(".ls-live-c2"), { x: 160, y: 260 }, { x: 330, y: 60, duration: 1 }, 0)
        .from(q(".ls-live-shape"), { opacity: 0, scale: 0.9, stagger: 0.2, duration: 0.3 }, 0.1)
        .from(q(".ls-live-item"), { opacity: 0, x: 30, stagger: 0.2, duration: 0.25 }, 0.2);
    });
    mm.add("(max-width: 899px)", () => {
      gsap.from(q(".ls-live-item"), {
        opacity: 0,
        y: 20,
        stagger: 0.1,
        duration: 0.5,
        ease: "power3.out",
        scrollTrigger: { trigger: q(".ls-live-feed")[0], start: "top 85%" },
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={root} id="live" className="ls-chapter ls-live" aria-labelledby="ls-live-title">
      <div className="ls-chapter-text">
        <h2 id="ls-live-title" className="ls-h2">
          See who’s building what, as it happens.
        </h2>
        <p className="ls-body">Live cursors with names. A feed of every change, by person and by AI.</p>
      </div>

      <div className="ls-live-grid">
        <div className="ls-live-canvas" aria-hidden>
          <i className="ls-live-shape ls-live-s1" />
          <i className="ls-live-shape ls-live-s2" />
          <i className="ls-live-shape ls-live-s3" />
          <div className="ls-live-c0 ls-live-cur">
            <Cursor name="Priya" />
          </div>
          <div className="ls-live-c1 ls-live-cur">
            <Cursor name="Leo" />
          </div>
          <div className="ls-live-c2 ls-live-cur">
            <Cursor name="Sam" />
          </div>
        </div>
        <ol className="ls-live-feed" aria-label="Activity feed">
          {FEED.map((f) => (
            <li key={f.what} className={`ls-live-item ${f.ai ? "is-ai" : ""}`}>
              <span className="ls-mono">{f.who}</span> {f.what}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
