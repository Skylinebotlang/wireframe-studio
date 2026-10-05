"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TUBES CURSOR — glowing 3D tubes that follow the mouse, behind the landing
// page content. Loaded at runtime from the CDN (threejs-components), so it
// isn't bundled. Click anywhere to randomize the colors.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";

const TUBES_URL = "https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js";

type TubesApp = {
  tubes: { setColors: (c: string[]) => void; setLightsColors: (c: string[]) => void };
  dispose?: () => void;
};

export function TubesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let app: TubesApp | null = null;
    let cancelled = false;

    const randomColors = (count: number) =>
      Array(count)
        .fill(0)
        .map(() => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"));
    const onDown = () => {
      app?.tubes.setColors(randomColors(3));
      app?.tubes.setLightsColors(randomColors(4));
    };

    import(/* webpackIgnore: true */ TUBES_URL)
      .then(({ default: TubesCursor }) => {
        if (cancelled || !canvasRef.current) return;
        app = TubesCursor(canvasRef.current, {
          tubes: {
            // Tube colors: Deep Burgundy, Deep Navy, Off-White
            colors: ["#6B1E2E", "#191A2F", "#F8F4F5"],
            lights: {
              intensity: 220,
              // Light colors: Burgundy accents with navy and off-white
              colors: ["#6B1E2E", "#191A2F", "#F8F4F5", "#090719"],
            },
          },
        });
        window.addEventListener("mousedown", onDown);
      })
      .catch(() => {
        /* CDN unreachable: the page just has no tubes */
      });

    return () => {
      cancelled = true;
      window.removeEventListener("mousedown", onDown);
      app?.dispose?.();
    };
  }, []);

  // Fixed, viewport-sized box: the library sizes the canvas to its parent.
  // The canvas paints black; "screen" blending drops the black so the page's
  // navy dot grid shows through and only the glowing tubes are added.
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 mix-blend-screen">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
