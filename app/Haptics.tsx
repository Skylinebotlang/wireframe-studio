// ─────────────────────────────────────────────────────────────────────────────
// HAPTICS + BUTTON FEEL — one small listener for the whole site.
//
//   • A short buzz when you press any button or link (and checkbox, radio,
//     or anything with role="button"). Disabled controls stay silent.
//       - Android / Chrome: navigator.vibrate.
//       - iPhone (Safari 18+): has no vibrate, but tapping a native "switch"
//         checkbox gives a system tick, so we click a hidden one.
//       - Laptops have no motor: nothing happens, and nothing breaks.
//   • A soft light that follows the pointer on wine buttons: it sets
//     --mx / --my on the hovered .ls-btn (the CSS draws the glow).
// People who turn on "reduce motion" get no buzz and no moving light.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect } from "react";

const PRESSABLE = 'button, a[href], [role="button"], summary, input[type="checkbox"], input[type="radio"], label[for]';

export function Haptics() {
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");

    // iPhone fallback: a hidden native switch; clicking its label ticks.
    let iosTick: HTMLLabelElement | null = null;
    if (!("vibrate" in navigator)) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.id = "wfs-haptic";
      input.tabIndex = -1;
      input.setAttribute("aria-hidden", "true");
      iosTick = document.createElement("label");
      iosTick.htmlFor = input.id;
      iosTick.setAttribute("aria-hidden", "true");
      for (const el of [input, iosTick]) el.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9px;top:-9px";
      document.body.append(input, iosTick);
    }

    const buzz = () => {
      if (reduce.matches) return;
      if ("vibrate" in navigator) navigator.vibrate(8);
      else if (iosTick) {
        const keep = document.activeElement as HTMLElement | null;
        iosTick.click();
        keep?.focus?.({ preventScroll: true }); // the hidden switch must not steal focus
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = (e.target as Element | null)?.closest?.(PRESSABLE) as HTMLElement | null;
      if (!t || t.id === "wfs-haptic" || t === iosTick) return;
      if (t.matches(":disabled, [aria-disabled='true']")) return;
      buzz();
    };

    const onMove = (e: PointerEvent) => {
      if (reduce.matches) return;
      const b = (e.target as Element | null)?.closest?.(".ls-btn") as HTMLElement | null;
      if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty("--mx", `${e.clientX - r.left}px`);
      b.style.setProperty("--my", `${e.clientY - r.top}px`);
    };

    addEventListener("pointerdown", onDown, { passive: true });
    addEventListener("pointermove", onMove, { passive: true });
    return () => {
      removeEventListener("pointerdown", onDown);
      removeEventListener("pointermove", onMove);
      iosTick?.previousElementSibling?.remove();
      iosTick?.remove();
    };
  }, []);

  return null;
}
