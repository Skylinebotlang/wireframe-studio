// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER: HOW IT WORKS + LIVE TOGETHER — five steps, played on a canvas.
//
// Left: the five steps, in order. Right: a small Wireframe Studio room.
// The section is pinned; as you scroll, each step lights up and the room
// shows it happening:
//   1. Create a room       the canvas opens with its room name
//   2. Invite your team    Priya, Leo and Sam join; their cursors appear
//   3. Everyone prompts    three prompt notes land on the board
//   4. The AI draws        the orange agent cursor draws one wireframe
//   5. Everyone sees it    the activity feed shows who asked for what and
//                          what the AI did; the orange fades when it's done
// Then: "Ready when your team is." + Start the chat.
// Reduced motion / phones: no pinning; everything is shown finished.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Cursor } from "./Cursor";
import { StartChatButton } from "./StartChatButton";
import { prefersReducedMotion } from "./bus";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { t: "Create a room", d: "One board for the screens you are planning." },
  { t: "Invite your team", d: "Share the link. Everyone gets a name and a cursor." },
  { t: "Everyone prompts", d: "Drop a note with what you want, in your own words." },
  { t: "The AI draws", d: "It reads every note, merges the clashes and draws the wireframes." },
  { t: "Everyone sees it live", d: "Each change, and who asked for it, shows up for the whole room." },
];

const NOTES = [
  { who: "Priya", text: "Checkout in one step" },
  { who: "Leo", text: "Products as cards" },
  { who: "Sam", text: "Tabs for categories" },
];

const FEED = [
  { who: "Priya", what: "added a note" },
  { who: "Leo", what: "added a note" },
  { who: "Sam", what: "added a note" },
  { who: "Agent", what: "merged 3 notes into one checkout", ai: true },
  { who: "Agent", what: "drew Checkout", ai: true },
];

export function HowChapter() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(4); // finished state until the scroll story runs

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const el = root.current!;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const q = gsap.utils.selector(el);
      setActive(0);
      const tl = gsap.timeline({
        defaults: { ease: "power2.out", duration: 0.5 },
        scrollTrigger: {
          trigger: q(".ls-how-pin")[0],
          start: "top top",
          end: "+=260%",
          pin: true,
          scrub: 0.6,
          onUpdate: (st) => setActive(Math.min(4, Math.floor(st.progress * 5.2))),
        },
      });
      // 1. Room opens
      tl.from(q(".ls-room"), { clipPath: "inset(0% 0% 100% 0%)", duration: 0.8 }, 0)
        .from(q(".ls-room-name"), { opacity: 0, y: 8 }, 0.3)
        // 2. Team joins
        .from(q(".ls-avatar"), { opacity: 0, scale: 0.6, stagger: 0.15 }, 1)
        .from(q(".ls-room .ls-cur--person"), { opacity: 0, x: -30, y: 20, stagger: 0.15 }, 1.1)
        // 3. Notes land
        .from(q(".ls-note"), { opacity: 0, y: -40, rotation: (i: number) => [-8, 6, -4][i], stagger: 0.2 }, 2)
        .from(q(".ls-feed-row:not(.ls-feed-row--ai)"), { opacity: 0, x: 16, stagger: 0.2 }, 2.1)
        // 4. The AI draws
        .from(q(".ls-room .ls-cur--ai"), { opacity: 0, x: 60, y: 30 }, 3)
        .from(q(".ls-room-frame"), { clipPath: "inset(0% 0% 100% 0%)", duration: 0.6 }, 3.1)
        .from(q(".ls-room-frame .ls-box"), { clipPath: "inset(0% 100% 0% 0%)", stagger: 0.08, duration: 0.3 }, 3.3)
        .from(q(".ls-feed-row--ai"), { opacity: 0, x: 16, stagger: 0.25 }, 3.6)
        // 5. Done: the orange fades, everyone sees the result
        .fromTo(
          q(".ls-room-frame .ls-frame-ai, .ls-room-frame .ls-box-ai"),
          { opacity: 1 },
          { opacity: 0, duration: 0.4 },
          4.4
        )
        .to(q(".ls-room .ls-cur--ai"), { x: 40, y: 50, duration: 0.5 }, 4.4)
        .to({}, { duration: 0.6 }, 4.8);
    });
    return () => {
      mm.revert();
      setActive(4);
    };
  }, []);

  return (
    <section ref={root} id="how" className="ls-chapter ls-how" aria-labelledby="ls-how-title">
      <div className="ls-how-pin">
        <div className="ls-how-text">
          <h2 id="ls-how-title" className="ls-h2">
            How it works
          </h2>
          <ol className="ls-steps">
            {STEPS.map((s, i) => (
              <li key={s.t} className={`ls-step ${i === active ? "is-active" : ""} ${i < active ? "is-done" : ""}`}>
                <span className="ls-step-n ls-mono" aria-hidden>
                  {i + 1}
                </span>
                <span>
                  <span className="ls-step-t">{s.t}</span>
                  <span className="ls-step-d">{s.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="ls-room dots" aria-hidden>
          <div className="ls-room-top">
            <span className="ls-room-name ls-mono">Room: checkout-v2</span>
            <span className="ls-avatars">
              {NOTES.map((n) => (
                <span key={n.who} className="ls-avatar ls-mono">
                  {n.who[0]}
                </span>
              ))}
            </span>
          </div>

          <div className="ls-room-board">
            <div className="ls-notes">
              {NOTES.map((n) => (
                <div key={n.who} className="ls-note">
                  <span className="ls-note-who ls-mono">{n.who}</span>
                  <span className="ls-note-text">{n.text}</span>
                </div>
              ))}
            </div>

            <div className="ls-room-frame">
              <span className="ls-frame-name ls-mono">Checkout</span>
              <span className="ls-frame-ai" />
              {[
                [5, 4, 90, 8, "bar"],
                [5, 16, 28, 7, "tab"],
                [36, 16, 28, 7, "tab"],
                [67, 16, 28, 7, "tab"],
                [5, 28, 28, 26, "img"],
                [36, 28, 28, 26, "img"],
                [67, 28, 28, 26, "img"],
                [5, 60, 60, 6, "line"],
                [5, 78, 90, 14, "btn"],
              ].map(([x, y, w, h, k], i) => (
                <i
                  key={i}
                  className={`ls-box ls-box--${k}`}
                  style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
                >
                  <b className="ls-box-ai" />
                </i>
              ))}
            </div>

            <ul className="ls-feed">
              <li className="ls-feed-head ls-mono">Activity</li>
              {FEED.map((f, i) => (
                <li key={i} className={`ls-feed-row ${f.ai ? "ls-feed-row--ai" : ""}`}>
                  <span className={`ls-feed-who ls-mono ${f.ai ? "is-ai" : ""}`}>{f.who}</span> {f.what}
                </li>
              ))}
            </ul>

            <Cursor name="Priya" className="ls-cur--person ls-room-c1" />
            <Cursor name="Leo" className="ls-cur--person ls-room-c2" />
            <Cursor name="Sam" className="ls-cur--person ls-room-c3" />
            <Cursor name="Agent: drawing" ai className="ls-room-c4" />
          </div>
        </div>
      </div>

      <div className="ls-how-cta">
        <p className="ls-h3">Ready when your team is.</p>
        <StartChatButton />
      </div>
    </section>
  );
}
