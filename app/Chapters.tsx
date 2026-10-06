// ─────────────────────────────────────────────────────────────────────────────
// CHAPTERS — the story after the hero, told in six screens. Each chapter
// sticks to the screen (is "pinned") while you scroll, and the scroll drives
// its little animation. One idea per screen:
//
//   01 The problem       three frames drift apart: unseen, half done, lost.
//   02 How it works      room link → team joins → everyone prompts →
//                        the AI draws → everyone sees it.
//   03 Live together     named cursors move; the activity feed fills up.
//   04 AI as teammate    clash found → merged → explained → you take over.
//   05 Bring your own AI Gemini, Claude, OpenAI or the free one.
//   06 Start the chat    the frames merge one last time; the final button.
//
// Each chapter opens like the AI drawing it: first a wireframe in an orange
// "drawing" frame, then the real design (same look as app/SiteBuilder.tsx).
//
// At the bottom: chapter pills (jump to any chapter) and "Skip the intro"
// (straight to the last chapter). Both work with the keyboard.
//
// GSAP + ScrollTrigger; smooth scrolling comes from app/SmoothScroll.tsx.
// Only transform, opacity and clip-path are animated.
// Reduced motion: no pinning, no movement — every chapter shows its final,
// finished picture.
// ORANGE = the AI only. People are wine tints.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollToEl } from "./SmoothScroll";
import { StartChat } from "./StartChat";

gsap.registerPlugin(ScrollTrigger);

const PILLS = ["Problem", "How", "Live", "Teammate", "Your AI", "Start"];

export function Chapters() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1); // -1 = still in the hero

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const chapters = gsap.utils.toArray<HTMLElement>(".ch", el);
      chapters.forEach((ch, i) => {
        const q = gsap.utils.selector(ch);
        const tl = gsap.timeline({ defaults: { ease: "none" } });

        // Opening: the chapter frame clips open from a smaller frame.
        tl.fromTo(ch.querySelector(".ch-stage"), { clipPath: "inset(10% 14% 10% 14%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.12 }, 0);
        tl.from(q(".ch-copy > *"), { opacity: 0, y: 24, stagger: 0.03, duration: 0.08 }, 0.06);
        SCENES[i](tl, q);
        tl.to({}, { duration: 0.1 }); // a short rest before the next chapter

        if (reduce) {
          tl.progress(1);
          ch.querySelector<HTMLElement>(".ch-stage")!.dataset.state = "real";
          ScrollTrigger.create({ trigger: ch, start: "top 60%", end: "bottom 40%", onToggle: (s) => s.isActive && setActive(i) });
          return;
        }

        ch.querySelector<HTMLElement>(".ch-stage")!.dataset.state = "wire";
        ScrollTrigger.create({
          trigger: ch,
          start: "top top",
          end: "+=160%",
          pin: true,
          scrub: 0.6,
          animation: tl,
          onToggle: (s) => s.isActive && setActive(i),
          // Wireframe → real, like the AI drawing this chapter.
          onUpdate: (s) => {
            const stage = ch.querySelector<HTMLElement>(".ch-stage")!;
            stage.dataset.state = s.progress < 0.04 ? "drawing" : s.progress < 0.09 ? "wire" : "real";
          },
        });
      });
      // Pills hide while you're still in the hero.
      ScrollTrigger.create({ trigger: el, start: "top 80%", onLeaveBack: () => setActive(-1) });
    }, el);
    return () => ctx.revert();
  }, []);

  const go = (i: number) => scrollToEl(root.current?.querySelectorAll(".ch")[i] ?? null);

  return (
    <div ref={root} id="chapters" className="chs">
      {/* ── 01 The problem ─────────────────────────────────────────── */}
      <Chapter n={1} title="The problem" line="Three teams. Three setups. No shared picture." sub="Everyone builds with their own AI. Nobody sees the rest until the end.">
        <div className="sc1">
          {[
            ["Priya", "unseen"],
            ["Leo", "half done"],
            ["Sam", "decision lost"],
          ].map(([who, tag], i) => (
            <div key={who} className={`sc-frame sc1-f sc1-f${i}`}>
              <div className="sc-tag lp-mono">{who}’s setup</div>
              <div className="sc-bar" style={{ width: "70%" }} />
              <div className="sc-bar" style={{ width: "45%" }} />
              <div className="sc-box" />
              <span className="sc1-flag lp-mono">{tag}</span>
            </div>
          ))}
        </div>
      </Chapter>

      {/* ── 02 How it works ────────────────────────────────────────── */}
      <Chapter n={2} title="How it works" line="One room. Everyone prompts. Everyone sees it." sub="Create a room, invite your team, prompt. The AI draws on the shared canvas, live." flip cta>
        <div className="sc-frame sc2">
          <div className="sc2-url lp-mono">
            <span className="sc2-type">wireframe.studio/room/launch-week</span>
          </div>
          <div className="sc2-people">
            {["Priya", "Leo", "Sam"].map((p, i) => (
              <span key={p} className={`sc-chip sc2-join sc-p${i} lp-mono`}>
                {p} joined
              </span>
            ))}
          </div>
          <div className="sc2-prompt">
            <span className="lp-mono sc-label">Leo · prompt</span>
            <span className="sc2-ptype">A pricing page with two plans</span>
          </div>
          <div className="sc2-canvas">
            {["a", "b", "c", "d"].map((k) => (
              <div key={k} className={`sc2-box sc2-${k}`}>
                <span className="sc-draw" />
              </div>
            ))}
            <Cur cls="sc2-agent" name="Agent" agent />
          </div>
          <div className="sc2-seen lp-mono">Seen by Priya · Leo · Sam · live</div>
        </div>
      </Chapter>

      {/* ── 03 Live together ───────────────────────────────────────── */}
      <Chapter n={3} title="Live together" line="See who’s building what, as it happens." sub="Live cursors with names. A feed of every change, by person and by AI.">
        <div className="sc3">
          <div className="sc-frame sc3-canvas">
            <div className="sc3-shape sc3-s1" />
            <div className="sc3-shape sc3-s2" />
            <div className="sc3-shape sc3-s3" />
            <Cur cls="sc3-c0" name="Priya" color="var(--rose)" />
            <Cur cls="sc3-c1" name="Leo" color="var(--accent-bright)" />
            <Cur cls="sc3-c2" name="Sam" color="var(--wine-light)" />
          </div>
          <ol className="sc3-feed">
            {[
              ["Priya", "added a note: “summary on top”", ""],
              ["Leo", "moved the hero image", ""],
              ["Agent", "drew 2 screens", "ai"],
              ["Sam", "renamed the button “Start”", ""],
            ].map(([who, what, ai]) => (
              <li key={what} className={`sc3-item ${ai ? "is-ai" : ""}`}>
                <span className="lp-mono">{who}</span> {what}
              </li>
            ))}
          </ol>
        </div>
      </Chapter>

      {/* ── 04 The AI as a teammate ────────────────────────────────── */}
      <Chapter n={4} title="The AI as a teammate" line="It merges, explains, and steps aside when you say so." sub="Clashes are found and merged out loud. Pause it or take over any time." flip>
        <div className="sc4">
          <div className="sc4-notes">
            <div className="sc-note">
              <div className="sc-note-who lp-mono">Priya · PM</div>
              Put the summary at the top.
            </div>
            <div className="sc-note sc-note-b">
              <div className="sc-note-who lp-mono">Leo · Design</div>
              Keep it minimal. Nothing extra.
            </div>
          </div>
          <div className="sc4-clash lp-mono">● 1 clash found</div>
          <div className="sc4-merged">
            <span className="lp-mono sc-label">How I merged it</span>
            Kept the summary on top, as one short line. Minimal stays.
          </div>
          <div className="sc4-controls">
            <span className="sc4-btn lp-mono">Pause</span>
            <span className="sc4-btn sc4-take lp-mono">Take over</span>
          </div>
          <div className="sc4-you lp-mono">You’re driving · AI paused</div>
        </div>
      </Chapter>

      {/* ── 05 Bring your own AI ───────────────────────────────────── */}
      <Chapter n={5} title="Bring your own AI" line="Use your AI. Or ours, for free." sub="Gemini, Claude or OpenAI with your own key — or the built-in one.">
        <div className="sc-frame sc5">
          <span className="lp-mono sc-label">Run by</span>
          <div className="sc5-roll">
            <div className="sc5-list">
              {["Gemini", "Claude", "OpenAI", "Free built-in"].map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
          <p className="sc5-lock lp-mono">Your key stays in your browser. Never shared with the room.</p>
        </div>
      </Chapter>

      {/* ── 06 Start the chat ──────────────────────────────────────── */}
      <section className="ch ch-final" aria-labelledby="ch6">
        <div className="ch-stage" data-build="chapter">
          <div className="sc6" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className={`sc-frame sc6-f sc6-f${i}`} />
            ))}
          </div>
          <div className="ch-copy ch6-copy">
            <span className="ch-num lp-mono">06 / Start the chat</span>
            <h2 id="ch6" className="lp-head ch6-line">
              Your team, one canvas.
              <br />
              <span className="lp-dim">Starting now.</span>
            </h2>
            <div className="hi-actions">
              <StartChat />
              <Link href="/login" className="hi-skip lp-mono">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Chapter pills + skip ───────────────────────────────────── */}
      <nav className="ch-pills" data-on={active >= 0} aria-label="Chapters">
        <ol>
          {PILLS.map((p, i) => (
            <li key={p}>
              <button type="button" className="lp-mono" aria-current={active === i ? "step" : undefined} onClick={() => go(i)}>
                <span>0{i + 1}</span> {p}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="ch-skip lp-mono" onClick={() => go(5)}>
          Skip the intro →
        </button>
      </nav>
    </div>
  );
}

// One chapter: number + title, one big line, a short sub line, the scene.
// `flip` puts the scene on the left for some tension between screens.
function Chapter({ n, title, line, sub, flip, cta, children }: { n: number; title: string; line: string; sub: string; flip?: boolean; cta?: boolean; children: React.ReactNode }) {
  return (
    <section className={`ch ${flip ? "ch-flip" : ""}`} aria-labelledby={`ch${n}`}>
      <div className="ch-stage" data-build="chapter">
        <div className="ch-copy">
          <span className="ch-num lp-mono">
            0{n} / {title}
          </span>
          <h2 id={`ch${n}`} className="lp-head ch-line">
            {line}
          </h2>
          <p className="ch-sub">{sub}</p>
          {cta && (
            <StartChat className="ch-cta" />
          )}
        </div>
        <div className="ch-scene" aria-hidden>
          {children}
        </div>
      </div>
    </section>
  );
}

// A multiplayer cursor with a name tag (orange only for the agent).
function Cur({ cls, name, color = "var(--agent)", agent }: { cls: string; name: string; color?: string; agent?: boolean }) {
  return (
    <div className={`hi-cursor ${cls}`} style={{ "--c": color } as React.CSSProperties}>
      <svg width="16" height="16" viewBox="0 0 18 18">
        <path d="M2 1 L16 8 L9 10 L6 17 Z" fill={color} stroke="var(--paper)" strokeWidth="1.2" />
      </svg>
      <span className="lp-mono">
        {agent && <i className="hi-dot" />}
        {name}
      </span>
    </div>
  );
}

type Q = (s: string) => Element[];

// Each chapter's scroll animation, added to its timeline (0 → ~1).
const SCENES: ((tl: gsap.core.Timeline, q: Q) => void)[] = [
  // 01: frames drift apart, flags appear on each.
  (tl, q) => {
    tl.from(q(".sc1-f"), { opacity: 0, y: 40, stagger: 0.05, duration: 0.15 }, 0.12);
    // Drift less on phones so the frames stay on screen.
    const far = () => (innerWidth < 760 ? 6 : 18);
    tl.to(q(".sc1-f0"), { xPercent: () => -far(), rotate: -3, duration: 0.5 }, 0.3);
    tl.to(q(".sc1-f2"), { xPercent: () => far(), rotate: 3, duration: 0.5 }, 0.3);
    tl.to(q(".sc1-f1"), { y: 30, duration: 0.5 }, 0.3);
    tl.from(q(".sc1-flag"), { opacity: 0, scale: 0.6, stagger: 0.1, duration: 0.1 }, 0.5);
  },
  // 02: url types → people join → prompt types → AI draws → seen by all.
  (tl, q) => {
    tl.from(q(".sc2-type"), { clipPath: "inset(0 100% 0 0)", duration: 0.15 }, 0.12);
    tl.from(q(".sc2-join"), { opacity: 0, x: -14, stagger: 0.05, duration: 0.08 }, 0.27);
    tl.from(q(".sc2-ptype"), { clipPath: "inset(0 100% 0 0)", duration: 0.15 }, 0.42);
    tl.from(q(".sc2-agent"), { opacity: 0, x: 60, y: -20, duration: 0.06 }, 0.56);
    q(".sc2-box").forEach((b, i) => {
      const at = 0.6 + i * 0.07;
      tl.from(b, { clipPath: "inset(0 100% 0 0)", duration: 0.06 }, at);
      tl.to(q(".sc2-agent"), { x: (b as HTMLElement).offsetLeft + 40, y: (b as HTMLElement).offsetTop + 10, duration: 0.06 }, at - 0.03);
      tl.to(b.querySelector(".sc-draw"), { opacity: 0, duration: 0.08 }, at + 0.08);
    });
    tl.from(q(".sc2-seen"), { opacity: 0, y: 10, duration: 0.08 }, 0.92);
  },
  // 03: cursors move across the canvas; the feed fills in.
  (tl, q) => {
    tl.fromTo(q(".sc3-c0"), { x: 20, y: 30 }, { x: 260, y: 150, duration: 0.6 }, 0.15);
    tl.fromTo(q(".sc3-c1"), { x: 300, y: 40 }, { x: 80, y: 220, duration: 0.6 }, 0.15);
    tl.fromTo(q(".sc3-c2"), { x: 160, y: 260 }, { x: 330, y: 60, duration: 0.6 }, 0.15);
    tl.from(q(".sc3-shape"), { opacity: 0, scale: 0.9, stagger: 0.15, duration: 0.1 }, 0.2);
    tl.from(q(".sc3-item"), { opacity: 0, x: 30, stagger: 0.13, duration: 0.08 }, 0.25);
  },
  // 04: clash → merged → explanation → take over (orange steps back).
  (tl, q) => {
    tl.from(q(".sc-note"), { opacity: 0, y: 20, stagger: 0.06, duration: 0.1 }, 0.12);
    tl.to(q(".sc-note"), { x: (i: number) => (i ? -24 : 24), duration: 0.12 }, 0.3);
    tl.from(q(".sc4-clash"), { opacity: 0, scale: 0.8, duration: 0.06 }, 0.36);
    tl.from(q(".sc4-merged"), { clipPath: "inset(0 100% 0 0)", duration: 0.14 }, 0.48);
    tl.from(q(".sc4-controls"), { opacity: 0, y: 10, duration: 0.08 }, 0.66);
    tl.to(q(".sc4-take"), { scale: 0.94, duration: 0.03 }, 0.78);
    tl.to(q(".sc4-take"), { scale: 1, duration: 0.03 }, 0.81);
    tl.to(q(".sc4-clash, .sc4-merged"), { opacity: 0.35, duration: 0.06 }, 0.82);
    tl.from(q(".sc4-you"), { opacity: 0, y: 10, duration: 0.06 }, 0.84);
  },
  // 05: the AI name rolls through the four options.
  (tl, q) => {
    tl.from(q(".sc5"), { y: 30, opacity: 0, duration: 0.1 }, 0.12);
    tl.to(q(".sc5-list"), { yPercent: -25, duration: 0.12 }, 0.3);
    tl.to(q(".sc5-list"), { yPercent: -50, duration: 0.12 }, 0.5);
    tl.to(q(".sc5-list"), { yPercent: -75, duration: 0.12 }, 0.7);
    tl.from(q(".sc5-lock"), { opacity: 0, y: 10, duration: 0.08 }, 0.82);
  },
  // 06: three frames slide together into one, behind the final line.
  (tl, q) => {
    tl.from(q(".sc6-f0"), { xPercent: -120, opacity: 0, duration: 0.4 }, 0.1);
    tl.from(q(".sc6-f2"), { xPercent: 120, opacity: 0, duration: 0.4 }, 0.1);
    tl.from(q(".sc6-f1"), { yPercent: 60, opacity: 0, duration: 0.4 }, 0.1);
  },
];
