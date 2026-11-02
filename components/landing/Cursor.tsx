// ─────────────────────────────────────────────────────────────────────────────
// CURSOR — a live cursor with a name tag, exactly like the ones in the app.
//
//   • People: wine arrow with a soft-white outline, wine tag, white text.
//   • The AI: orange arrow, orange tag, navy text. Orange = the AI only.
// Used by the hero story and the chapters. Purely visual (aria-hidden).
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties } from "react";

export function Cursor({
  name,
  ai = false,
  className = "",
  style,
  tagRef,
}: {
  name: string;
  ai?: boolean;
  className?: string;
  style?: CSSProperties;
  tagRef?: React.Ref<HTMLSpanElement>;
}) {
  return (
    <span className={`ls-cur ${ai ? "ls-cur--ai" : ""} ${className}`} style={style} aria-hidden>
      <svg width="18" height="20" viewBox="0 0 18 20" className="ls-cur-arrow">
        <path d="M1.5 1.5 L1.5 16.5 L5.6 12.6 L8.6 18.6 L11.4 17.3 L8.5 11.4 L14 11.2 Z" />
      </svg>
      <span ref={tagRef} className="ls-cur-tag ls-mono">
        {name}
      </span>
    </span>
  );
}
