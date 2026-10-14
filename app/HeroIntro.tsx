// ─────────────────────────────────────────────────────────────────────────────
// HERO INTRO — the first screen: a "runtime HUD" layout (from papi's Stitch
// design) with the 6-second story playing in its central frame. It starts
// right after the splash hands off (app/Splash.tsx).
//
// Layout: top HUD bar (our logo, tabs, Initialize workspace), one big
// framed console card (story stage, WIREFRAME STUDIO, the positioning line,
// a progress panel + log that follow the story, Start the chat / Skip,
// the AI options row), and a bottom status bar.
//
//   0.0 s  THE PROBLEM  three separate frames draw in, one per team, each
//                       with its own named cursor (wine family = people).
//   0.4 s               each team builds its OWN screen; they don't match.
//   1.6 s               small "doesn't fit" marks flash on the clashes.
//   2.0 s  THE FIX      the three frames slide together and merge into ONE.
//   2.6 s               the AI's ORANGE cursor arrives and the merged screen
//                       assembles box by box; the people gather round.
//   3.2 s               headline lands: THREE TEAMS. ONE CANVAS. ONE ANSWER.
//   4.0 s               "Everybody has the context, not just the AI."
//   4.6 s               "Start the chat" + "Skip the intro", then a scroll hint.
//
// The merged frame is also the SPOT for a future screen recording of the
// app (see data-slot="recording"); the boxes inside are its stand-in.
//
// Built with GSAP. Only transform, opacity and clip-path are animated.
// Reduced motion: everything is shown in its final state, nothing moves.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { goToChapter } from "./Chapters";
import { PROVIDER_IDS, PROVIDERS } from "@/lib/ai-providers";
import { StartChat } from "./StartChat";

// The three teams. Cursor colors come from the people (wine) family.
const TEAMS = [
  { name: "Priya · PM", tag: "TEAM_01", color: "var(--rose)" },
  { name: "Leo · Design", tag: "TEAM_02", color: "var(--accent-bright)" },
  { name: "Sam · Dev", tag: "TEAM_03", color: "var(--wine-light)" },
];

export function HeroIntro() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      // Start state (set before first paint so nothing flashes).
      gsap.set(q(".hi-frame"), { clipPath: "inset(0 100% 0 0)" });
      gsap.set(q(".hi-frame .hi-b, .hi-note, .hi-cur, .hi-agent, .hi-gather"), { opacity: 0 });
      gsap.set(q(".hi-x"), { opacity: 0, scale: 0.3 });
      gsap.set(q(".hi-merged"), { opacity: 0, scale: 0.92 });
      gsap.set(q(".hi-mb"), { clipPath: "inset(0 100% 0 0)" });
      gsap.set(q(".hi-line > span"), { yPercent: 105 });
      gsap.set(q(".hi-msg, .hi-cta, .hi-skip, .hi-hint, .hud-top > :not(.hud-brand), .hud-brand-name, .hud-log li, .hud-pool, .hud-progress, .hud-bottom"), { opacity: 0, y: 12 });
      gsap.set(q(".hud-title"), { clipPath: "inset(0 100% 0 0)" });

      const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });

      // ── THE PROBLEM ──────────────────────────────────────────────────
      tl.to(q(".hud-top > :not(.hud-brand), .hud-brand-name, .hud-bottom"), { opacity: 1, y: 0, duration: 0.5, stagger: 0.04 }, 0);
      tl.to(q(".hud-progress"), { opacity: 1, y: 0, duration: 0.5 }, 0.2);
      // The log follows the story: teams in → canvas shared → AI merging.
      tl.to(q(".hud-log li")[0], { opacity: 1, y: 0, duration: 0.3 }, 0.6);
      tl.to(q(".hud-log li")[1], { opacity: 1, y: 0, duration: 0.3 }, 2.1);
      tl.to(q(".hud-log li")[2], { opacity: 1, y: 0, duration: 0.3 }, 2.65);
      tl.to(q(".hi-frame"), { clipPath: "inset(0 0% 0 0)", duration: 0.5, stagger: 0.12, ease: "power3.inOut" }, 0);
      q(".hi-frame").forEach((frame, i) => {
        const boxes = frame.querySelectorAll(".hi-b");
        const cur = frame.querySelector(".hi-cur");
        const t = 0.4 + i * 0.1;
        tl.fromTo(cur, { opacity: 0, x: 10, y: 80 }, { opacity: 1, x: 30, y: 20, duration: 0.4 }, t);
        tl.to(boxes, { opacity: 1, duration: 0.25, stagger: 0.18, ease: "power2.out" }, t + 0.15);
        tl.to(cur, { x: 70, y: 110, duration: 0.5, ease: "power2.inOut" }, t + 0.45);
        tl.to(cur, { x: 40, y: 160, duration: 0.5, ease: "power2.inOut" }, t + 0.95);
      });
      tl.to(q(".hi-x"), { opacity: 1, scale: 1, duration: 0.3, stagger: 0.08, ease: "back.out(3)" }, 1.6);
      tl.to(q(".hi-note"), { opacity: 1, duration: 0.3 }, 1.65);

      // ── THE FIX: frames slide together and merge into one ───────────
      tl.addLabel("merge", 2.0);
      const toCenter = (i: number) => () => {
        const scene = el.querySelector(".hi-scene")!.getBoundingClientRect();
        const f = q(".hi-frame")[i].getBoundingClientRect();
        return scene.left + scene.width / 2 - (f.left + f.width / 2);
      };
      q(".hi-frame").forEach((_, i) => {
        tl.to(q(".hi-frame")[i], { x: toCenter(i), scale: 0.9, opacity: 0, duration: 0.6, ease: "power3.inOut" }, "merge");
      });
      tl.to(q(".hi-x, .hi-note"), { opacity: 0, duration: 0.2 }, "merge");
      tl.to(q(".hi-merged"), { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" }, "merge+=0.35");
      // People cursors gather around the merged frame.
      tl.to(q(".hi-gather"), { opacity: 1, duration: 0.3, stagger: 0.08 }, "merge+=0.6");

      // The AI's orange cursor assembles the merged screen, box by box.
      tl.addLabel("ai", 2.6);
      tl.fromTo(q(".hi-agent"), { opacity: 0, x: 220, y: -30 }, { opacity: 1, x: 150, y: 10, duration: 0.3 }, "ai");
      q(".hi-mb").forEach((box, i) => {
        const at = 2.75 + i * 0.16;
        const r = box as HTMLElement;
        tl.to(q(".hi-agent"), { x: r.offsetLeft + r.offsetWidth * 0.7, y: r.offsetTop + r.offsetHeight * 0.6, duration: 0.18, ease: "power2.inOut" }, at - 0.1);
        tl.to(box, { clipPath: "inset(0 0% 0 0)", duration: 0.22, ease: "power2.out" }, at);
        tl.to(box.querySelector(".hi-mb-o"), { opacity: 0, duration: 0.4 }, at + 0.25);
      });
      // Rest beside the finished button, inside the frame.
      tl.to(q(".hi-agent"), { x: "+=50", y: "-=6", duration: 0.5, ease: "power2.out" }, ">");

      // ── The headline lands, line by line ────────────────────────────
      tl.to(q(".hud-title"), { clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "power3.inOut" }, 3.1);
      tl.to(q(".hi-line > span"), { yPercent: 0, duration: 0.8, stagger: 0.1 }, 3.5);

      // ── Message, buttons, scroll hint ───────────────────────────────
      tl.to(q(".hi-msg"), { opacity: 1, y: 0, duration: 0.7 }, 4.0);
      tl.to(q(".hi-cta, .hi-skip"), { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }, 4.6);
      tl.to(q(".hud-pool"), { opacity: 1, y: 0, duration: 0.6 }, 5.0);
      // Story done: the cursors step out of the frame (app/LiveCursors.tsx).
      tl.call(() => {
        (window as Window & { __wfsHeroDone?: boolean }).__wfsHeroDone = true;
        dispatchEvent(new Event("wfs:hero-done"));
      }, undefined, 5.8);
      tl.to(q(".hi-hint"), { opacity: 1, y: 0, duration: 0.6 }, 5.4);
      // The progress bar + % follow the story, finishing when the AI is done.
      const bar = q(".hud-bar-fill")[0] as HTMLElement;
      const pct = q(".hud-pct")[0];
      const status = q(".hud-state")[0];
      tl.eventCallback("onUpdate", () => {
        const p = Math.min(1, tl.time() / 3.8);
        bar.style.transform = `scaleX(${p})`;
        pct.textContent = `${Math.round(p * 100)}%`;
        status.textContent = p < 1 ? "Agent merging 3 screens" : "Canvas ready · 1 shared screen";
        status.previousElementSibling!.textContent = p < 1 ? "[Active]" : "[Done]";
        status.parentElement!.dataset.done = String(p >= 1);
      });

      if (reduce) {
        tl.progress(1); // the final picture, no motion
        return;
      }
      // Played 1.8× faster than written, so the whole story takes about
      // 3.3 s (button visible at about 2.6 s) and visitors don't wait.
      tl.timeScale(1.8);
      const w = window as Window & { __wfsLoaded?: boolean };
      const play = () => tl.play();
      if (w.__wfsLoaded) play();
      else addEventListener("wfs:loaded", play, { once: true });
      return () => removeEventListener("wfs:loaded", play);
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="hi hud" aria-labelledby="hero-title">
      {/* ── Top HUD bar ─────────────────────────────────────────────── */}
      <nav className="hud-top lp-mono" aria-label="Main">
        <Link href="/" className="hud-brand" aria-label="Wireframe Studio home">
          {/* Our logo sits here. */}
          <Image id="nav-logo" src="/logo-2d.png" alt="" width={26} height={26} priority draggable={false} />
          <span className="hud-brand-name">
            Wireframe_Studio //
            <br />
            Runtime_HUD
          </span>
        </Link>
        <ul className="hud-tabs lp-hide-sm">
          <li className="is-on">Canvas_01</li>
          <li>Collab_feed</li>
          <li>Terminal</li>
          <li>System_metrics</li>
        </ul>
        <Link href="/login" className="hud-sign lp-hide-sm">
          Sign in
        </Link>
        <Link href="/signup" className="hud-init">
          Initialize_workspace
        </Link>
      </nav>

      {/* ── The console card ────────────────────────────────────────── */}
      <div className="hud-card">
        <span className="hud-tick hud-t1" />
        <span className="hud-tick hud-t2" />
        <span className="hud-tick hud-t3" />
        <span className="hud-tick hud-t4" />

        <div className="hud-head lp-mono">
          <span className="hud-chip">Canvas_core // Room_orchestrator</span>
          <span className="hud-ai lp-hide-sm">
            <i /> Runtime agent synthesis in progress
          </span>
        </div>

        {/* The animated story: three frames → one frame (orange = the AI).
            The merged frame is the slot for a future screen recording. */}
        <div className="hi-scene" aria-hidden>
          <div className="hi-frames">
            {TEAMS.map((t, i) => (
              <div key={t.tag} className="hi-frame" style={{ "--c": t.color } as React.CSSProperties}>
                <div className="hi-tag lp-mono">
                  {t.tag} · <span style={{ color: t.color }}>{t.name.split(" · ")[0]}</span>
                </div>
                <Screen kind={i} />
                <Cursor className="hi-cur" name={t.name} color={t.color} />
              </div>
            ))}
          </div>
          <div className="hi-note lp-mono">3 setups · 0 shared context</div>
          <div className="hi-merged" data-slot="recording">
            <div className="hi-tag lp-mono">ROOM_01 · everyone</div>
            <div className="hi-mscreen">
              {["head", "hero", "l1", "l2", "img", "btn"].map((k) => (
                <div key={k} className={`hi-mb hi-mb-${k}`}>
                  <span className="hi-mb-o" />
                </div>
              ))}
              <Cursor className="hi-agent" name="Agent" color="var(--agent)" agent />
            </div>
            {TEAMS.map((t, i) => (
              <Cursor key={t.tag} className={`hi-gather hi-g${i}`} name={t.name.split(" · ")[0]} color={t.color} />
            ))}
          </div>
        </div>

        <h1 id="hero-title" className="hud-h1">
          <span className="lp-head hud-title">Wireframe Studio</span>
          <span className="hi-line hud-line">
            <span>
              Three teams. <span className="lp-dim">One canvas.</span> One answer.
            </span>
          </span>
        </h1>
        <p className="hi-msg hud-msg">Everybody has the context, not just the AI.</p>

        {/* Progress panel: follows the story above, not a fake number. */}
        <div className="hud-progress lp-mono" aria-hidden>
          <div className="hud-prow">
            <span>
              <i className="hud-sq" /> Initializing multiplayer canvas // <span className="hud-pct">0%</span>
            </span>
          </div>
          <div className="hud-bar">
            <div className="hud-bar-fill" />
          </div>
          <ul className="hud-log">
            <li>
              <b>[OK]</b> 3 teammates joined · Priya, Leo, Sam
            </li>
            <li>
              <b>[OK]</b> Shared canvas ready
            </li>
            <li className="hud-live">
              <b>[Active]</b> <span className="hud-state">Agent merging 3 screens</span>
              <em>Streaming</em>
            </li>
          </ul>
        </div>

        <div className="hud-actions">
          <StartChat className="hi-cta hud-cta" />
          <button type="button" className="hi-skip hud-skip lp-mono" onClick={() => goToChapter(5)}>
            Skip intro / Enter workspace <span aria-hidden>→</span>
          </button>
        </div>

        <div className="hud-pool lp-mono">
          <span className="hud-pool-k">Bring your own AI, or use ours:</span>
          <ul>
            {PROVIDER_IDS.map((id) => (
              <li key={id}>{PROVIDERS[id].label}</li>
            ))}
            <li className="is-free">Free built-in</li>
          </ul>
        </div>
      </div>

      {/* ── Bottom status bar ───────────────────────────────────────── */}
      <div className="hud-bottom lp-mono" aria-hidden>
        <span>Sys_core // Multiplayer AI canvas</span>
        <span className="hi-hint">Scroll · see how it works →</span>
        <span className="hud-ai">
          <i /> Agent_status: on the canvas
        </span>
      </div>
    </section>
  );
}


// One team's own little screen. Each one is built differently on purpose:
// different layout, different button — that's the problem.
function Screen({ kind }: { kind: number }) {
  if (kind === 0)
    return (
      <div className="hi-screen hi-s0">
        <div className="hi-b hi-side-nav" />
        <div className="hi-b hi-bar" style={{ width: "70%" }} />
        <div className="hi-b hi-bar" style={{ width: "50%" }} />
        <div className="hi-b hi-block" />
        <div className="hi-b hi-btn hi-round">
          <span className="hi-x" />
        </div>
      </div>
    );
  if (kind === 1)
    return (
      <div className="hi-screen hi-s1">
        <div className="hi-b hi-card">
          <div className="hi-bar" style={{ width: "60%", margin: "0 auto" }} />
          <div className="hi-bar" style={{ width: "80%", margin: "8px auto 0" }} />
        </div>
        <div className="hi-b hi-btn hi-square">
          <span className="hi-x" />
        </div>
      </div>
    );
  return (
    <div className="hi-screen hi-s2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="hi-b hi-row" />
      ))}
      <div className="hi-b hi-tabs">
        <span className="hi-x" />
      </div>
    </div>
  );
}

// A multiplayer cursor with a name tag.
function Cursor({ className, name, color, agent }: { className: string; name: string; color: string; agent?: boolean }) {
  return (
    <div className={`hi-cursor ${className}`} style={{ "--c": color } as React.CSSProperties}>
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
