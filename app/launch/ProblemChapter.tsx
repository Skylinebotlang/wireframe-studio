// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER: THE PROBLEM — three people, three setups, no shared picture.
//
// Three small "AI chat" windows, one per person, each with what they asked
// their own AI and the screen it gave back. As you scroll (the section is
// pinned), the windows drift apart and walls draw up between them: each
// person is building alone. The last line lands at the end.
//
// The other people's AIs are drawn in plain soft white: ORANGE is only ever
// Wireframe Studio's own agent.
// Reduced motion: no pinning, the finished layout (apart, walls up).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "./bus";

gsap.registerPlugin(ScrollTrigger);

const SETUPS = [
  { who: "Priya", role: "PM", ask: "Make checkout one step.", screen: "one big Pay button" },
  { who: "Leo", role: "Design", ask: "Show the products as cards.", screen: "a grid of cards" },
  { who: "Sam", role: "Dev", ask: "Use tabs, not one long list.", screen: "tabs and a list" },
];

export function ProblemChapter() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const el = root.current!;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const q = gsap.utils.selector(el);
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top top", end: "+=110%", pin: true, scrub: 0.6 },
      });
      tl.from(
        q(".ls-setup"),
        { x: (i: number) => [140, 0, -140][i], rotation: (i: number) => [4, 0, -4][i], ease: "none", duration: 1 },
        0
      )
        .from(q(".ls-wall"), { scaleY: 0, ease: "none", duration: 0.6, stagger: 0.1 }, 0.35)
        .from(q(".ls-setup-ai"), { opacity: 0, duration: 0.4, stagger: 0.15 }, 0.1)
        .from(q(".ls-problem-end"), { opacity: 0, y: 20, duration: 0.3 }, 0.8);
    });
    mm.add("(max-width: 899px)", () => {
      const q = gsap.utils.selector(el);
      gsap.from(q(".ls-setup"), {
        opacity: 0,
        y: 30,
        stagger: 0.12,
        duration: 0.6,
        ease: "power3.out",
        scrollTrigger: { trigger: q(".ls-setups")[0], start: "top 80%" },
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={root} id="problem" className="ls-chapter ls-problem" aria-labelledby="ls-problem-title">
      <div className="ls-chapter-text">
        <h2 id="ls-problem-title" className="ls-h2">
          Three people. Three AIs. Three different checkouts.
        </h2>
        <p className="ls-body">
          Everyone works in their own setup, prompting their own AI. Nobody sees what the others are building, what is
          finished, or what was decided.
        </p>
      </div>

      <div className="ls-setups" aria-label="Three separate setups">
        {SETUPS.map((s, i) => (
          <div key={s.who} className="ls-setup-wrap">
            {i > 0 && <span className="ls-wall" aria-hidden />}
            <article className="ls-setup">
              <header className="ls-setup-bar ls-mono">
                <span className="ls-dotrow" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                {s.who}’s AI chat
              </header>
              <p className="ls-setup-ask">
                <span className="ls-mono ls-setup-who">
                  {s.who} ({s.role})
                </span>
                {s.ask}
              </p>
              <div className="ls-setup-ai" aria-label={`Their AI made ${s.screen}`}>
                <span className="ls-mono ls-setup-who ls-setup-who--ai">Their AI</span>
                <span className="ls-skel" />
                <span className="ls-skel ls-skel--short" />
                <span className={`ls-thumb ls-thumb--${i + 1}`} aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </article>
          </div>
        ))}
      </div>

      <p className="ls-problem-end">You find out at the end, when the pieces don’t fit.</p>
    </section>
  );
}
