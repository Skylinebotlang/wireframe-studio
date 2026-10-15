// ─────────────────────────────────────────────────────────────────────────────
// WORLD LAYER — puts the 3D canvas world (app/launch/world3d.ts) behind the
// whole landing page and tells it where the scroll is.
//
//   • Each section is a "stop": hero 0, problem 1, how 2, live 3, try 4,
//     start 5, the very bottom 6. Between two stops the number goes up
//     smoothly with the scroll, so the camera flies from one to the next.
//   • Pinned sections are measured by their pin spacer, so the long pinned
//     scenes (problem, how) give the camera more road.
//   • The 3D code loads only after the loader is done, so the first seconds
//     stay fast. If WebGL is missing, the page simply keeps its dotted look.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef } from "react";
import { onLoaded, prefersReducedMotion } from "./bus";

const STOPS = ["top", "problem", "how", "live", "try", "start"];

export function World() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    let dispose = () => {};
    let cancelled = false;

    const stop = onLoaded(() => {
      import("./world3d").then(({ createWorld }) => {
        if (cancelled) return;
        let world;
        try {
          world = createWorld(el, { reduced: prefersReducedMotion(), small: innerWidth < 720 });
        } catch {
          return; // no WebGL: keep the plain dotted page
        }
        document.documentElement.classList.add("ls-has-world");

        // Document top of each stop (pin spacer when pinned).
        const tops = () => {
          const t = STOPS.map((id) => {
            const s = document.getElementById(id);
            if (!s) return 0;
            const box = s.parentElement?.classList.contains("pin-spacer") ? s.parentElement : s;
            return box.getBoundingClientRect().top + scrollY;
          });
          t.push(document.documentElement.scrollHeight - innerHeight);
          return t;
        };
        let t = tops();
        const onResize = () => (t = tops());
        addEventListener("resize", onResize);
        const re = setInterval(onResize, 1500); // pins settle after load

        let raf = 0;
        const tick = () => {
          const y = scrollY;
          let u = 0;
          for (let i = 0; i < t.length - 1; i++) {
            if (y >= t[i]) u = i + Math.min(1, (y - t[i]) / Math.max(1, t[i + 1] - t[i]));
          }
          world!.setStop(u);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        dispose = () => {
          cancelAnimationFrame(raf);
          clearInterval(re);
          removeEventListener("resize", onResize);
          world!.dispose();
          document.documentElement.classList.remove("ls-has-world");
        };
      });
    });

    return () => {
      cancelled = true;
      stop();
      dispose();
    };
  }, []);

  return <div ref={host} className="ls-world" aria-hidden />;
}
