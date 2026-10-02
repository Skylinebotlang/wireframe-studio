// ─────────────────────────────────────────────────────────────────────────────
// THEME — the single place where our design tokens live.
// If you want to change a color, change it HERE and it updates everywhere.
//
// Design direction — CYBERPUNK (night city, neon):
//   • Night-black surfaces, light text
//   • CYAN   = humans (cursors, avatars, accents)
//   • ORANGE = the AI agent ONLY (its cursor, status, frames) — never use
//     orange for anything human. This makes it obvious at a glance what the
//     AI is doing versus people.
// The same values live as CSS variables at the top of app/globals.css.
// ─────────────────────────────────────────────────────────────────────────────

export const THEME = {
  ink: "#E6F1FF", // main text (light, on dark)
  paper: "#0A0B14", // surfaces (night black)
  muted: "#7D88A8", // secondary text
  line: "#262B47", // hairline borders
  blue: "#00E5FF", // the "people" accent (neon cyan)
  agent: "#FF6B2C", // the agent accent (do NOT use for humans)
  dots: "#00E5FF29", // canvas dotted background (dim cyan)
} as const;

// The palette humans can pick their cursor color from.
// Neon hues that glow on black; NO orange or amber (reserved for the agent).
export const PEOPLE_COLORS = [
  "#00E5FF", // neon cyan (the primary accent)
  "#FF2BD6", // hot pink
  "#B6FF3B", // acid lime
  "#9D7BFF", // ultraviolet
  "#3D8BFF", // electric blue
  "#F8F32B", // laser yellow (clearly lighter than agent orange)
] as const;

// Team roles shown on the identity screen (Milestone 2 prints them on notes).
export const ROLES = ["PM", "Designer", "Developer"] as const;
export type Role = (typeof ROLES)[number];
