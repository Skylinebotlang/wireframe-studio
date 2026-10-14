// ─────────────────────────────────────────────────────────────────────────────
// THEME — the single place where our design tokens live.
// If you want to change a color, change it HERE and it updates everywhere.
//
// Design direction — the project palette (dark, cyberpunk feel):
//   #090719 · #131224 · #191A2F  deep navies (background, panels, inputs)
//   #F8F4F5                      soft white text
//   #681E2E                      WINE = humans (buttons, note headers)
//   ORANGE = the AI agent ONLY (its cursor, status, frames) — deliberately
//     NOT in the palette, so it's obvious at a glance what the AI is doing
//     versus people. Never use orange for anything human.
// The same values live as CSS variables at the top of app/globals.css.
// ─────────────────────────────────────────────────────────────────────────────

export const THEME = {
  ink: "#F8F4F5", // main text (soft white)
  paper: "#090719", // background (deepest navy)
  surface: "#131224", // panels and cards
  raised: "#191A2F", // inputs, raised areas
  muted: "#9E99A8", // secondary text
  line: "#2B2A42", // hairline borders
  wine: "#681E2E", // the "people" accent
  agent: "#FF6B2C", // the agent accent (do NOT use for humans)
  dots: "#F8F4F517", // canvas dotted background (faint soft white)
} as const;

// The palette humans can pick their cursor color from.
// Wine is too dark to see as a cursor on navy, so these are bright tints
// that sit well with the palette; NO orange or amber (reserved for the agent).
export const PEOPLE_COLORS = [
  "#E0607E", // rose (a bright tint of the wine accent)
  "#F8F4F5", // soft white
  "#B9A7FF", // lavender
  "#6EE7C5", // mint
  "#6CB8FF", // sky
  "#F5E663", // lemon (clearly lighter than agent orange)
] as const;

// Team roles shown on the identity screen (Milestone 2 prints them on notes).
export const ROLES = ["PM", "Designer", "Developer"] as const;
export type Role = (typeof ROLES)[number];
