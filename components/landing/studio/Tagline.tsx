// ─────────────────────────────────────────────────────────────────────────────
// TAGLINE REVEAL (landing page, /): the product's core promise in big
// type, the last chapter of the story (required by the landing-page-design
// skill: its own moment, not stacked under the hero).
//
// The words start faint (30% opacity) and light up one by one, in reading
// order, as each crosses a line 60% down the screen. One IntersectionObserver
// watches every word (no scroll listener). Once lit, a word stays lit.
// "Reduce motion" on: the whole line shows at full strength right away.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Each inner array is one line, broken where the thought breaks.
const LINES = [["Everybody", "at", "the", "table"], ["has", "the", "context,"], ["not", "just", "the", "AI."]];
const TEXT = LINES.flat().join(" ");
// Each word with its position in reading order (0, 1, 2, …).
let n = 0;
const NUMBERED = LINES.map((line) => line.map((word) => ({ word, i: n++ })));

export function Tagline() {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();
  const [lit, setLit] = useState(0); // how many words are lit, in reading order

  useEffect(() => {
    const el = ref.current;
    if (reduced || !el) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const i = Number((e.target as HTMLElement).dataset.i);
          setLit((k) => Math.max(k, i + 1));
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -40% 0px" },
    );
    el.querySelectorAll("[data-i]").forEach((w) => io.observe(w));
    return () => io.disconnect();
  }, [reduced]);

  return (
    <h2 ref={ref} className="heading-3 md:heading-2 max-w-[680px]" aria-label={TEXT}>
      {NUMBERED.map((line, l) => (
        <span key={l} className="block" aria-hidden>
          {line.map(({ word, i }) => (
            <span
              key={i}
              data-i={i}
              className={`transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                reduced || i < lit ? "opacity-100" : "opacity-30"
              } ${word === "context," ? "text-rose" : ""}`}
            >
              {word}{" "}
            </span>
          ))}
        </span>
      ))}
    </h2>
  );
}
