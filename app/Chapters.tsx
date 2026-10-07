// ─────────────────────────────────────────────────────────────────────────────
// CHAPTERS — the whole landing page as ONE horizontal, parallax journey.
//
// Hero → 04: one scroll gesture (wheel, trackpad, swipe, arrow keys) = one
// screen, played as a single transition (paging). From 04 to the footer the
// scroll is continuous again: the falls follow the wheel smoothly.
//   hero → 01 → 02 → 03   slide SIDEWAYS (with parallax)
//   03 → 04 → 05 → 06 → footer   3D ZOOM into each next screen. These
//                                second-half pages are FLOATING 3D cards:
//                                angled, gently bobbing, tilting to the mouse.
// Inside each screen the layers move at different speeds (parallax): the
// scene drifts faster than the words, so the screens feel deep.
//
//   01 The problem       three frames drift apart: unseen, half done, lost.
//   02 How it works      room link → team joins → everyone prompts →
//                        the AI draws → everyone sees it.
//   03 Live together     named cursors move; the activity feed fills up.
//   04 AI as teammate    clash found → merged → explained → you take over.
//   05 Try it           the clickable demo room (public/demo/), usable right
//                        here: prompt the scripted agent, send notes, take over.
//   06 Start the chat    the frames merge one last time; the final button.
//
// Each chapter opens like the AI drawing it (wireframe in an orange
// "drawing" frame, then the real design) and plays its little story as it
// slides in. Chapter pills + "Skip the intro" sit at the bottom (keyboard
// friendly). The hero and footer are passed in from app/page.tsx.
//
// GSAP + ScrollTrigger: one pinned stage, one master timeline (1 unit = 1 screen);
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

const PILLS = ["Problem", "How", "Live", "Teammate", "Try it", "Start"];

// Scroll positions of every screen (0 = hero … last = footer), filled in by
// the effect below, so buttons elsewhere can jump to a chapter.
let stops: () => number[] = () => [];

// Glide to a scroll position (Lenis when present, else the browser).
function glide(y: number, onDone?: () => void) {
  const lenis = (window as Window & { __lenis?: Lenis }).__lenis;
  if (lenis) lenis.scrollTo(y, { duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4), lock: true, force: true, onComplete: onDone });
  else {
    scrollTo({ top: y, behavior: "smooth" });
    if (onDone) setTimeout(onDone, 900);
  }
}

/** Glide to chapter i (0–5). Works from anywhere on the page. */
export function goToChapter(i: number) {
  const s = stops();
  if (!s.length) return document.querySelectorAll<HTMLElement>(".ch")[i]?.scrollIntoView(); // reduced motion
  glide(s[i + 1]);
}

// transform-origin (in px) that points at the middle of `target` inside `box`,
// so zooming `box` dives straight into that scene.
function originOf(target: HTMLElement | null, box: HTMLElement) {
  if (!target) return "50% 50%";
  const t = target.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const sx = b.width / box.offsetWidth || 1; // undo any current scale
  return `${(t.left + t.width / 2 - b.left) / sx}px ${(t.top + t.height / 2 - b.top) / sx}px`;
}


export function Chapters({ hero, footer }: { hero: React.ReactNode; footer: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1); // -1 = still in the hero

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const view = el.querySelector<HTMLElement>(".hs-view")!;
      const track = el.querySelector<HTMLElement>(".hs-track")!;
      const flat = [...track.children] as HTMLElement[]; // hero, 01, 02, 03
      const deep = gsap.utils.toArray<HTMLElement>(".dz-panel", el); // 04, 05, 06, footer
      const chapters = gsap.utils.toArray<HTMLElement>(".ch", el);
      const stageOf = (ch: HTMLElement) => ch.querySelector<HTMLElement>(".ch-stage")!;
      const STEPS = flat.length - 1 + deep.length; // screens after the hero (7)

      // Each chapter's own story (played by the master timeline below).
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

      // ── ONE master timeline, 1 unit = 1 screen ───────────────────────
      // Units 0→3: slide sideways (hero → 01 → 02 → 03).
      // Units 3→7: FALL INTO the screen (03 → 04 → 05 → 06 → footer).
      const master = gsap.timeline({ defaults: { ease: "none" } });
      const vw = () => innerWidth;
      const sv = innerWidth < 760 ? 6 : 14; // parallax strength (vw)

      // Sideways part + parallax (scene drifts faster than the words).
      for (let u = 1; u < flat.length; u++) master.to(track, { x: () => -u * vw(), duration: 1 }, u - 1);
      // Hero: its story stage leaves faster than the rest of the card.
      const heroScene = el.querySelector(".hi-scene");
      if (heroScene) master.to(heroScene, { x: "-22vw", duration: 1 }, 0);
      flat.slice(1).forEach((p, k) => {
        const scene = p.querySelector(".ch-scene");
        // The last sideways screen settles at 0 (its scene then morphs).
        const last = k === flat.length - 2;
        if (scene) master.fromTo(scene, { x: `${sv}vw` }, { x: last ? 0 : `${-sv}vw`, duration: last ? 1 : 2 }, k);
      });

      // The 3D zoom: you fly INTO the current screen's scene (it rushes
      // toward you and past), while the next screen comes forward out of
      // the depth, its layers arriving at different distances (scene from
      // further back than the words) so the space feels deep.
      gsap.set(deep, { autoAlpha: 0 });
      deep.forEach((p, k) => {
        const at = flat.length - 1 + k; // unit where this zoom starts
        const out = k === 0 ? view : deep[k - 1];
        const scene = (k === 0 ? flat[flat.length - 1] : deep[k - 1]).querySelector<HTMLElement>(".ch-scene, .sc6");
        master.set(out, { transformOrigin: () => originOf(scene, out) }, at);
        master.to(out, { scale: 3.4, z: 260, rotationX: -8, autoAlpha: 0, duration: 0.8, ease: "power2.in" }, at);
        master.fromTo(
          p,
          { autoAlpha: 0, z: -1600, rotationX: 14, rotationY: k % 2 ? 10 : -10, clipPath: "inset(30% 30% 30% 30%)" },
          { autoAlpha: 1, z: 0, rotationX: 0, rotationY: 0, clipPath: "inset(0% 0% 0% 0%)", duration: 0.8, ease: "power3.out" },
          at + 0.2,
        );
        // Depth layers inside the arriving screen.
        const pScene = p.querySelector(".ch-scene, .sc6");
        const pCopy = p.querySelector(".ch-copy");
        if (pScene) master.fromTo(pScene, { z: -700 }, { z: 0, duration: 0.8, ease: "power3.out" }, at + 0.28);
        if (pCopy) master.fromTo(pCopy, { z: -250 }, { z: 0, duration: 0.8, ease: "power3.out" }, at + 0.24);
      });

      // ── Floating 3D landing pages (permanent) ────────────────────────
      // Each second-half page is a card hovering in space: slightly smaller
      // than the screen, angled, softly bobbing up and down, and tilting
      // toward your mouse while you're on it.
      const cardOf = (p: HTMLElement) => p.querySelector<HTMLElement>(".ch-stage, .lp-footer") ?? p;
      const cards = deep.map(cardOf);
      cards.forEach((c, k) => {
        const lean = k % 2 ? 7 : -7;
        gsap.set(c, { scale: 0.84, rotationY: lean, rotationX: 5, transformPerspective: 1600 });
        gsap.to(c, { y: -14, duration: 3.2 + k * 0.3, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });
      const tilt = (e: PointerEvent) => {
        const u = Math.round(master.time());
        const k = u - flat.length;
        const c = cards[k];
        if (!c) return;
        const lean = k % 2 ? 7 : -7;
        gsap.to(c, {
          rotationY: lean + (e.clientX / innerWidth - 0.5) * 10,
          rotationX: 5 - (e.clientY / innerHeight - 0.5) * 8,
          duration: 0.9,
          ease: "power3.out",
          overwrite: "auto",
        });
      };
      addEventListener("pointermove", tilt);

      // Each chapter's story plays while it arrives.
      const arrival = (i: number) => i; // chapter i arrives during unit i → i+1
      chapters.forEach((_, i) => master.to(stories[i], { progress: 1, duration: 0.85 }, arrival(i) + 0.15));

      // Pin the whole thing and drive it with scroll.
      const st = ScrollTrigger.create({
        trigger: el,
        pin: true,
        scrub: 0.8,
        // Same scroll distance per screen as the original sideways scroll.
        end: () => "+=" + STEPS * innerWidth * 1.15,
        animation: master,
        invalidateOnRefresh: true,
      });
      // Runs on every animation frame of the master (not just on scroll
      // events), so fast jumps never leave a chapter stuck half-drawn.
      master.eventCallback("onUpdate", () => {
          const t = master.time();
          // Tell the travelling cursors (app/LiveCursors.tsx) where we are.
          (window as Window & { __wfsScreen?: number }).__wfsScreen = t;
          dispatchEvent(new CustomEvent("wfs:screen", { detail: t }));
          // Wireframe → real as each chapter arrives (like the AI drawing it).
          chapters.forEach((ch, i) => {
            const local = t - arrival(i);
            stageOf(ch).dataset.state = local < 0.2 ? "drawing" : local < 0.45 ? "wire" : "real";
          });
          // Only the screen you're on takes clicks (the deep ones overlap).
          const u = Math.round(t);
          deep.forEach((p, k) => (p.style.pointerEvents = u === flat.length + k ? "auto" : "none"));
          view.style.pointerEvents = u < flat.length ? "auto" : "none";
          setActive(u >= 1 && u <= chapters.length ? u - 1 : -1);
      });
      stops = () => [...Array(STEPS + 1)].map((_, u) => st.start + (u / STEPS) * (st.end - st.start));

      // ── Paging: one scroll gesture = one screen ──────────────────────
      let busy = false;
      const current = () => {
        const s = stops();
        let best = 0;
        s.forEach((y, i) => Math.abs(y - scrollY) < Math.abs(s[best] - scrollY) && (best = i));
        return best;
      };
      const step = (dir: 1 | -1) => {
        if (busy || document.querySelector("dialog[open]")) return;
        const from = current();
        const next = Math.min(STEPS, Math.max(0, from + dir));
        if (next === from) return;
        busy = true;
        glide(stops()[next], () => setTimeout(() => (busy = false), 250)); // swallow trackpad inertia
      };
      // From chapter 04 on (screen index FREE_FROM) scrolling is continuous:
      // the falls into 05, 06 and the footer follow the wheel smoothly.
      const FREE_FROM = flat.length; // 04
      const free = (dir: number) => {
        const y = stops()[FREE_FROM];
        return dir > 0 ? scrollY >= y - 2 : scrollY > y + 2;
      };
      const onWheel = (e: WheelEvent) => {
        if (free(e.deltaY + e.deltaX)) return; // let smooth scroll handle it
        e.preventDefault();
        e.stopImmediatePropagation(); // keep Lenis from scrolling continuously
        if (Math.abs(e.deltaY) + Math.abs(e.deltaX) < 8) return;
        step(e.deltaY + e.deltaX > 0 ? 1 : -1);
      };
      const onKey = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, dialog")) return;
        if (e.key === " " && t.closest("button, a")) return; // Space still presses buttons
        const fwd = ["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key);
        if (free(fwd ? 1 : -1)) return; // normal key scrolling in the free part
        if (fwd) {
          e.preventDefault();
          step(1);
        } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
          e.preventDefault();
          step(-1);
        }
      };
      let touchY = 0;
      const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0].clientY);
      const onTouchMove = (e: TouchEvent) => {
        if (!free(touchY - e.touches[0].clientY)) e.preventDefault();
      };
      const onTouchEnd = (e: TouchEvent) => {
        const dy = touchY - e.changedTouches[0].clientY;
        if (Math.abs(dy) > 40 && !free(dy)) step(dy > 0 ? 1 : -1);
      };
      // Wheel scrolling over the demo (in its iframe) is passed up to here.
      const onMsg = (e: MessageEvent) => {
        if (e.origin !== location.origin || typeof e.data?.wfsWheel !== "number") return;
        const lenis = (window as Window & { __lenis?: Lenis }).__lenis;
        if (lenis) lenis.scrollTo(lenis.scroll + e.data.wfsWheel);
        else scrollBy(0, e.data.wfsWheel);
      };
      addEventListener("message", onMsg);
      addEventListener("wheel", onWheel, { passive: false, capture: true });
      addEventListener("keydown", onKey);
      addEventListener("touchstart", onTouchStart, { passive: true });
      addEventListener("touchmove", onTouchMove, { passive: false });
      addEventListener("touchend", onTouchEnd);
      return () => {
        removeEventListener("pointermove", tilt);
        removeEventListener("message", onMsg);
        removeEventListener("wheel", onWheel, { capture: true });
        removeEventListener("keydown", onKey);
        removeEventListener("touchstart", onTouchStart);
        removeEventListener("touchmove", onTouchMove);
        removeEventListener("touchend", onTouchEnd);
      };
    }, el);
    return () => {
      ctx.revert();
      stops = () => [];
    };
  }, []);

  const go = goToChapter;

  return (
    <>
    {/* Extra wrapper: GSAP slips a "pin spacer" around .hs while pinning,
        so .hs must not sit next to React-managed siblings. */}
    <div>
    <div ref={root} id="chapters" className="hs">
      <div className="hs-view">
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

      </div>
      </div>

      {/* ── From here on you FALL INTO each screen (depth stack) ──────── */}
      <div className="dz">
      {/* ── 04 The AI as a teammate ────────────────────────────────── */}
      <Chapter deep n={4} title="The AI as a teammate" line="It merges, explains, and steps aside when you say so." sub="Clashes are found and merged out loud. Pause it or take over any time." flip>
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

      {/* ── 05 Try it: the clickable demo room (public/demo/index.html) ── */}
      <Chapter
        deep
        live
        n={5}
        title="Try it"
        line="Try it yourself."
        sub="Sam and Maya already disagree. Type an idea, or send their notes and watch the agent merge them. Scripted demo: no account, no AI key."
      >
        <div className="sc5-demo">
          <iframe src="/demo/index.html" title="Wireframe Studio demo room: try the agent" loading="lazy" />
        </div>
      </Chapter>

      {/* ── 06 Start the chat ──────────────────────────────────────── */}
      <section className="ch ch-final dz-panel" aria-labelledby="ch6">
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

      <div className="dz-panel hs-foot">{footer}</div>
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
function Chapter({ n, title, line, sub, flip, cta, deep, live, children }: { deep?: boolean; live?: boolean; n: number; title: string; line: string; sub: string; flip?: boolean; cta?: boolean; children: React.ReactNode }) {
  return (
    <section className={`ch ${flip ? "ch-flip" : ""} ${deep ? "dz-panel" : ""} ${live ? "ch-live" : ""}`} aria-labelledby={`ch${n}`}>
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
        <div className="ch-scene" aria-hidden={live ? undefined : true}>
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
  // 05: the demo window opens like a frame being drawn.
  (tl, q) => {
    tl.from(q(".sc5-demo"), { clipPath: "inset(0 100% 0 0)", duration: 0.25 }, 0.12);
  },
  // 06: three frames slide together into one, behind the final line.
  (tl, q) => {
    tl.from(q(".sc6-f0"), { xPercent: -120, opacity: 0, duration: 0.4 }, 0.1);
    tl.from(q(".sc6-f2"), { xPercent: 120, opacity: 0, duration: 0.4 }, 0.1);
    tl.from(q(".sc6-f1"), { yPercent: 60, opacity: 0, duration: 0.4 }, 0.1);
  },
];
