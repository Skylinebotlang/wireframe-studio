// ─────────────────────────────────────────────────────────────────────────────
// TILT ON HOVER — makes toolbar buttons and panels lean toward the pointer.
//
// One listener for the whole page (cheap): when the pointer is over an element
// matching TILT_SELECTOR, we write two CSS variables on it (--rx, --ry).
// app/globals.css turns those into a 3D rotation and springs it back on leave.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";

// Keep in sync with the "Tilt on hover" block in app/globals.css.
const TILT_SELECTOR =
  ".tilt, .tlui-toolbar__tools .tlui-button, .tlui-style-panel .tlui-button";
const MAX_DEGREES = 14;

export function useTilt() {
  useEffect(() => {
    // Respect the OS "reduce motion" setting.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let current: HTMLElement | null = null;

    const reset = () => {
      current?.style.removeProperty("--rx");
      current?.style.removeProperty("--ry");
      current = null;
    };

    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(TILT_SELECTOR) as HTMLElement | null;
      if (el !== current) reset();
      if (!el) return;
      current = el;
      // Pointer position inside the element, from -0.5 (left/top) to 0.5.
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--ry", `${x * MAX_DEGREES * 2}deg`);
      el.style.setProperty("--rx", `${-y * MAX_DEGREES * 2}deg`);
    };

    document.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", reset);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", reset);
      reset();
    };
  }, []);
}
