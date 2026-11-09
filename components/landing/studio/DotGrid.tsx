// ─────────────────────────────────────────────────────────────────────────────
// DOT GRID (landing page, /): the canvas's dotted texture, drawn as an
// SVG pattern (the design rules ban CSS gradient backgrounds, which is how
// the app's .dot-grid class draws its dots). Fills its parent; decorative.
// ─────────────────────────────────────────────────────────────────────────────
import { useId } from "react";

export function DotGrid({ className = "", opacity = 0.12 }: { className?: string; opacity?: number }) {
  const id = useId();
  return (
    <svg aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <defs>
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="1.2" fill="#F8F4F5" fillOpacity={opacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
