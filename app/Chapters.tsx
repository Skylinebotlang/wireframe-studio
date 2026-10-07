// ─────────────────────────────────────────────────────────────────────────────
// CHAPTERS — the whole landing page as ONE horizontal, parallax journey.
//
// Scrolling down (wheel, trackpad, swipe, arrow keys) slides the page
// SIDEWAYS, ONE SCREEN PER GESTURE, as a single transition (paging, not a
// continuous scroll):  hero → 01 → 02 → 03 → 04 → 05 → 06 → footer.
// Inside each screen the layers move at different speeds (parallax): the
// scene drifts faster than the words, so the screens feel deep.
//
//   01 The problem       three frames drift apart: unseen, half done, lost.
//   02 How it works      room link → team joins → everyone prompts →
//                        the AI draws → everyone sees it.
//   03 Live together     named cursors move; the activity feed fills up.
//   04 AI as teammate    clash found → merged → explained → you take over.
//   05 Bring your own AI Gemini, Claude, OpenAI or the free one.
//   06 Start the chat    the frames merge one last time; the final button.
//
// Each chapter opens like the AI drawing it (wireframe in an orange
// "drawing" frame, then the real design) and plays its little story as it
// slides in. Chapter pills + "Skip the intro" sit at the bottom (keyboard
// friendly). The hero and footer are passed in from app/page.tsx.
//
// GSAP + ScrollTrigger (one pinned track, chapters use containerAnimation);
// smooth scrolling from app/SmoothScroll.tsx.
// Only transform, opacity and clip-path are animated.
// Reduced motion: a normal vertical page, every chapter in its final state.
// ORANGE = the AI only. People are wine tints.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
import { StartChat } from "./StartChat";

gsap.registerPlugin(ScrollTrigger);

const PILLS = ["Problem", "How", "Live", "Teammate", "Your AI", "Start"];

// The main sideways scroll, so buttons elsewhere can jump to a chapter.
let mainTween: gsap.core.Tween | null = null;

/** Glide to chapter i (0–5). Works from anywhere on the page. */
export function goToChapter(i: number) {
  const ch = document.querySelectorAll<HTMLElement>(".ch")[i];
  if (!ch) return;
  const st = mainTween?.scrollTrigger;
  const lenis = (window as Window & { __lenis?: Lenis }).__lenis;
  if (!st) return ch.scrollIntoView(); // reduced motion: normal page
  const track = ch.parentElement!;
  const dist = track.scrollWidth - innerWidth;
  const y = st.start + (ch.offsetLeft / dist) * (st.end - st.start);
  if (lenis) lenis.scrollTo(y, { duration: 1.4 });
  else scrollTo({ top: y, behavior: "smooth" });
}

export function Chapters({ hero, footer }: { hero: React.ReactNode; footer: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1); // -1 = still in the hero

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const track = el.querySelector<HTMLElement>(".hs-track")!;
      const chapters = gsap.utils.toArray<HTMLElement>(".ch", el);
      const stageOf = (ch: HTMLElement) => ch.querySelector<HTMLElement>(".ch-stage")!;

      // Each chapter's own story (built now, played by scroll below).
      const stories = chapters.map((ch, i) => {
        const q = gsap.utils.selector(ch);
        const tl = gsap.timeline({ defaults: { ease: "none" }, paused: true });
        // Opening: the chapter frame clips open from a smaller frame.
        tl.fromTo(stageOf(ch), { clipPath: "inset(10% 14% 10% 14%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.12 }, 0);
        tl.from(q(".ch-copy > *"), { opacity: 0, y: 24, stagger: 0.03, duration: 0.08 }, 0.06);
        SCENES[i](tl, q);
        return tl;
      });

      if (reduce) {
        stories.forEach((tl) => tl.progress(1));
        chapters.forEach((ch, i) => {
          stageOf(ch).dataset.state = "real";
          ScrollTrigger.create({ trigger: ch, start: "top 60%", end: "bottom 40%", onToggle: (s) => s.isActive && setActive(i) });
        });
        return;
      }

      // ── The sideways scroll: pin the page, slide the track left ────────
      const dist = () => track.scrollWidth - innerWidth;
      mainTween = gsap.to(track, {
        x: () => -dist(),
        ease: "none",
        scrollTrigger: {
          trigger: el,
          pin: true,
          scrub: 0.8,
          end: () => "+=" + dist() * 1.15,
          invalidateOnRefresh: true,
        },
      });
      const along = (trigger: Element, start: string, end: string) => ({
        containerAnimation: mainTween!,
        trigger,
        start,
        end,
        scrub: true,
      });

      // ── Parallax: scene layers travel faster than the words ───────────
      chapters.forEach((ch) => {
        const scene = ch.querySelector(".ch-scene, .sc6");
        const copy = ch.querySelector(".ch-copy");
        // Smaller drift on phones, so text never slides off the edge.
        const sv = innerWidth < 760 ? 6 : 14;
        const cv = innerWidth < 760 ? 0 : 5;
        if (scene) gsap.fromTo(scene, { x: `${sv}vw` }, { x: `${-sv}vw`, ease: "none", scrollTrigger: along(ch, "left right", "right left") });
        if (copy && cv) gsap.fromTo(copy, { x: `${cv}vw` }, { x: `${-cv}vw`, ease: "none", scrollTrigger: along(ch, "left right", "right left") });
      });
      // The hero's scene leaves faster than its headline.
      gsap.to(el.querySelector(".hi-scene"), { x: "-22vw", ease: "none", scrollTrigger: along(el.querySelector(".hs-hero")!, "left left", "right left") });
      gsap.to(el.querySelector(".hi-bottom"), { x: "-6vw", ease: "none", scrollTrigger: along(el.querySelector(".hs-hero")!, "left left", "right left") });
      // The giant footer wordmark slides in slower than the page.
      const big = el.querySelector(".lp-big");
      if (big) gsap.fromTo(big, { x: "30vw" }, { x: "0vw", ease: "none", scrollTrigger: along(el.querySelector(".hs-foot")!, "left right", "left left") });

      // ── Each chapter plays its story as it slides into view ──────────
      chapters.forEach((ch, i) => {
        stageOf(ch).dataset.state = "wire";
        ScrollTrigger.create({
          ...along(ch, "left 85%", "left 5%"),
          scrub: 0.6,
          animation: stories[i],
          // Wireframe → real, like the AI drawing this chapter.
          onUpdate: (s) => (stageOf(ch).dataset.state = s.progress < 0.06 ? "drawing" : s.progress < 0.14 ? "wire" : "real"),
        });
        ScrollTrigger.create({ ...along(ch, "left center", "right center"), onToggle: (s) => s.isActive && setActive(i) });
      });
      // Pills hide on the hero and the footer.
      ScrollTrigger.create({ ...along(el.querySelector(".hs-hero")!, "left left", "right center"), onToggle: (s) => s.isActive && setActive(-1) });
      ScrollTrigger.create({ ...along(el.querySelector(".hs-foot")!, "left center", "right right"), onToggle: (s) => s.isActive && setActive(-1) });

      // ── Paging: one scroll gesture = one screen ──────────────────────
      // Instead of scrolling continuously, every wheel flick, swipe or arrow
      // key glides to the NEXT (or previous) screen as one transition, and
      // ignores further input until it lands.
      const panels = [...track.children] as HTMLElement[];
      const posOf = (p: HTMLElement) => {
        const st = mainTween!.scrollTrigger!;
        return st.start + (p.offsetLeft / dist()) * (st.end - st.start);
      };
      const current = () => {
        let best = 0;
        panels.forEach((p, i) => {
          if (Math.abs(posOf(p) - scrollY) < Math.abs(posOf(panels[best]) - scrollY)) best = i;
        });
        return best;
      };
      let busy = false;
      const step = (dir: 1 | -1) => {
        if (busy || document.querySelector("dialog[open]")) return;
        const next = Math.min(panels.length - 1, Math.max(0, current() + dir));
        if (next === current()) return;
        busy = true;
        const lenis = (window as Window & { __lenis?: Lenis }).__lenis;
        const done = () => setTimeout(() => (busy = false), 250); // swallow trackpad inertia
        if (lenis) lenis.scrollTo(posOf(panels[next]), { duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4), lock: true, force: true, onComplete: done });
        else {
          scrollTo({ top: posOf(panels[next]), behavior: "smooth" });
          setTimeout(done, 900);
        }
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation(); // keep Lenis from scrolling continuously
        if (Math.abs(e.deltaY) + Math.abs(e.deltaX) < 8) return;
        step(e.deltaY + e.deltaX > 0 ? 1 : -1);
      };
      const onKey = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, dialog")) return;
        if (e.key === " " && t.closest("button, a")) return; // Space still presses buttons
        if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) {
          e.preventDefault();
          step(1);
        } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
          e.preventDefault();
          step(-1);
        }
      };
      let touchY = 0;
      const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0].clientY);
      const onTouchMove = (e: TouchEvent) => e.preventDefault();
      const onTouchEnd = (e: TouchEvent) => {
        const dy = touchY - e.changedTouches[0].clientY;
        if (Math.abs(dy) > 40) step(dy > 0 ? 1 : -1);
      };
      addEventListener("wheel", onWheel, { passive: false, capture: true });
      addEventListener("keydown", onKey);
      addEventListener("touchstart", onTouchStart, { passive: true });
      addEventListener("touchmove", onTouchMove, { passive: false });
      addEventListener("touchend", onTouchEnd);
      return () => {
        removeEventListener("wheel", onWheel, { capture: true });
        removeEventListener("keydown", onKey);
        removeEventListener("touchstart", onTouchStart);
        removeEventListener("touchmove", onTouchMove);
        removeEventListener("touchend", onTouchEnd);
      };
    }, el);
    return () => {
      ctx.revert();
      mainTween = null;
    };
  }, []);

  const go = goToChapter;

  return (
    <>
    {/* Extra wrapper: GSAP slips a "pin spacer" around .hs while pinning,
        so .hs must not sit next to React-managed siblings. */}
    <div>
    <div ref={root} id="chapters" className="hs">
      <div className="hs-track">
      <div className="hs-panel hs-hero">{hero}</div>
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

      <div className="hs-panel hs-foot">{footer}</div>
      </div>
    </div>
    </div>

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
    </>
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
