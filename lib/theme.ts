// ─────────────────────────────────────────────────────────────────────────────
// THEME — the single place where our design tokens live.
// If you want to change a color, change it HERE and it updates everywhere.
//
// Design direction (from the product spec):
//   • White surfaces, near-black text
//   • BLUE  = humans (cursors, avatars, accents)
//   • ORANGE = the AI agent ONLY (its cursor, status, frames) — never use
//     orange for anything human. This makes it obvious at a glance what the
//     AI is doing versus people.
// ─────────────────────────────────────────────────────────────────────────────

export const THEME = {
  ink: "#16181D", // near-black text
  paper: "#FFFFFF", // white surfaces
  muted: "#8A9099", // secondary text
  line: "#E4E7EC", // hairline borders
  blue: "#2F6BFF", // the "people" accent
  agent: "#FF6B2C", // the agent accent (do NOT use for humans)
  dots: "#E4E7EC", // canvas dotted background
} as const;

// The palette humans can pick their cursor color from.
// Blue tones + a few distinct hues; NO orange (reserved for the agent).
export const PEOPLE_COLORS = [
  "#2F6BFF", // blue (the primary accent)
  "#7C3AED", // violet
  "#0E9F6E", // green
  "#D97706", // amber (dark enough to read apart from agent orange)
  "#DB2777", // pink
  "#0891B2", // cyan
] as const;

// Team roles shown on the identity screen (Milestone 2 prints them on notes).
export const ROLES = ["PM", "Designer", "Developer"] as const;
export type Role = (typeof ROLES)[number];
