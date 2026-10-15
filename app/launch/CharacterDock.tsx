// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER DOCK — where the 3D AI character lives on the page.
//
//   • It is ONE floating layer above the page, so the same character can:
//       1. stand in the middle of the screen while the site loads,
//       2. glide into its spot in the hero (next to the headline),
//       3. and, as you scroll past the hero, shrink into the top bar,
//          where it keeps watching as the "AI status" mark.
//     The two empty placeholders it moves between are #ls-spot-hero
//     (app/launch/Hero.tsx) and #ls-spot-nav (app/launch/LaunchNav.tsx).
//   • The 3D code (app/launch/agent3d.ts) is downloaded on demand, so the
//     page paints first. When it's ready it tells the loader (ls:agent-ready).
//   • Reduced motion: the character stays put in the hero and scrolls away
//     with it; nothing glides.
// The outer box moves with scroll; the inner box is moved by the loader.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AGENT_EVENT, AGENT_READY_EVENT, agentMemory, prefersReducedMotion, type AgentCommand } from "./bus";

gsap.registerPlugin(ScrollTrigger);

// Where a placeholder is, in page coordinates (as if scrolled to the top).
function spot(id: string, fixed = false) {
  const el = document.getElementById(id);
  if (!el) return { x: 0, y: 0, w: 1, h: 1 };
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top + (fixed ? 0 : window.scrollY), w: r.width, h: r.height };
}

export function CharacterDock() {
  const outer = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);

  // Place the dock on the hero spot, and (with motion) glide it into the
  // top bar as the hero scrolls away.
  useLayoutEffect(() => {
    const el = outer.current!;
    const reduced = prefersReducedMotion();

    const sizeToHero = () => {
      const s = spot("ls-spot-hero");
      el.style.width = `${s.w}px`;
      el.style.height = `${s.h}px`;
      return s;
    };

    if (reduced) {
      el.classList.add("ls-dock--static");
      const place = () => {
        const s = sizeToHero();
        gsap.set(el, { x: s.x, y: s.y });
      };
      place();
      addEventListener("resize", place);
      return () => removeEventListener("resize", place);
    }

    sizeToHero();
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        {
          x: () => spot("ls-spot-hero").x,
          y: () => spot("ls-spot-hero").y,
          scale: 1,
        },
        {
          x: () => {
            const n = spot("ls-spot-nav", true);
            const h = spot("ls-spot-hero");
            return n.x + n.w / 2 - (h.w * (n.h / h.h)) / 2;
          },
          y: () => spot("ls-spot-nav", true).y,
          scale: () => spot("ls-spot-nav", true).h / spot("ls-spot-hero").h,
          ease: "none",
          scrollTrigger: {
            trigger: "#top",
            start: "top top",
            end: "bottom 35%",
            scrub: 0.6,
            invalidateOnRefresh: true,
            onRefreshInit: sizeToHero,
            onUpdate: (st) => el.classList.toggle("ls-dock--docked", st.progress > 0.98),
          },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  // Load the 3D character and pass it every command from the bus.
  useLayoutEffect(() => {
    let disposed = false;
    let handle: { command: (c: AgentCommand) => void; dispose: () => void } | null = null;
    const queue: AgentCommand[] = [];
    const onCmd = (e: Event) => {
      const cmd = (e as CustomEvent<AgentCommand>).detail;
      if (handle) handle.command(cmd);
      else queue.push(cmd);
    };
    addEventListener(AGENT_EVENT, onCmd);

    import("./agent3d")
      .then(({ createAgent }) => {
        if (disposed || !host.current) return;
        try {
          handle = createAgent(host.current, { reduced: prefersReducedMotion() });
        } catch {
          // No WebGL (very old device): the page works fine without the character.
          handle = null;
        }
        const mem = agentMemory();
        if (handle) {
          handle.command({ type: "progress", p: mem.progress });
          if (mem.solid) handle.command({ type: "solid" });
          for (const c of queue.splice(0)) handle.command(c);
        }
        dispatchEvent(new Event(AGENT_READY_EVENT));
      })
      .catch(() => dispatchEvent(new Event(AGENT_READY_EVENT)));

    return () => {
      disposed = true;
      removeEventListener(AGENT_EVENT, onCmd);
      handle?.dispose();
    };
  }, []);

  return (
    <div ref={outer} className="ls-dock" aria-hidden>
      <div className="ls-dock-in">
        <div ref={host} className="ls-dock-canvas" />
      </div>
    </div>
  );
}
