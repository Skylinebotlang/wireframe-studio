// ─────────────────────────────────────────────────────────────────────────────
// AGENT DESIGN — stage 2, "Make it real": grey-box wireframes → real mockups.
//
// Stage 1 (the existing agent) draws grey-box wireframes. Stage 2 turns each
// wireframe into a polished mobile screen, as one self-contained HTML page:
//   1. ONE style guide per "Make it real" run (palette, font, type scale,
//      corner radius, spacing), chosen from the idea, so every screen looks
//      like the same product.
//   2. ONE HTML page per screen, built from the wireframe's boxes and that
//      style guide (given to the AI as CSS variables).
//   3. A REVIEW pass per screen: the AI checks its own page against a design
//      checklist and returns a fixed version (kept only if it passes the
//      same safety checks).
//
// The style guide is made strict in code, not trusted to the AI: contrast is
// fixed (WCAG), the type scale is forced in order, spacing snaps to 4 px.
//
// This file has the formats, the prompts, the safety checks and the mock.
// No secrets and no network: safe to import in the browser and the server.
//
// SAFETY: the HTML is checked here on the server (size, no scripts, no
// event handlers, no embeds, no outside addresses, no orange). The browser
// adds a second lock when it shows it (lib/design-shape.tsx): a sandboxed
// iframe with no scripts, plus a rule that blocks ALL network loading.
// Orange is reserved for the AI in this app, so designs can't use it.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_DESIGN_SCREENS = 6; // per "Make it real" run
export const MAX_HTML_BYTES = 60_000; // per screen
export const PHONE_CSS_W = 390; // the design's own width in CSS pixels
export const PHONE_CSS_H = 844;

// ── Style guide ──────────────────────────────────────────────────────────────

export const FONTS = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  mono: "ui-monospace, Menlo, Consolas, monospace",
} as const;
type FontId = keyof typeof FONTS;

const COLOR_KEYS = ["background", "surface", "text", "muted", "primary", "onPrimary", "accent", "border"] as const;

export type StyleGuide = {
  product: string; // short product name, e.g. "Pawtrail"
  mood: string; // a few words, e.g. "friendly, outdoorsy, calm"
  colors: Record<(typeof COLOR_KEYS)[number], string>; // "#rrggbb"
  font: FontId;
  radius: number; // corner radius, px
  spacing: number; // base spacing unit, px
  type: { display: number; title: number; body: number; caption: number }; // font sizes, px
};

const hexColor = { type: "string" } as const;
export const STYLE_GUIDE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["product", "mood", "colors", "font", "radius", "spacing", "type"],
  properties: {
    product: { type: "string" },
    mood: { type: "string" },
    colors: {
      type: "object",
      additionalProperties: false,
      required: [...COLOR_KEYS],
      properties: Object.fromEntries(COLOR_KEYS.map((k) => [k, hexColor])),
    },
    font: { type: "string", enum: Object.keys(FONTS) },
    radius: { type: "number" },
    spacing: { type: "number" },
    type: {
      type: "object",
      additionalProperties: false,
      required: ["display", "title", "body", "caption"],
      properties: { display: { type: "number" }, title: { type: "number" }, body: { type: "number" }, caption: { type: "number" } },
    },
  },
} as const;

export const SCREEN_HTML_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["html"],
  properties: { html: { type: "string" } },
} as const;

const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback;

/** Check a style guide (from the AI, or sent back by a browser). */
export function checkStyleGuide(data: unknown): { ok: true; guide: StyleGuide } | { ok: false; error: string } {
  const d = (data ?? {}) as Record<string, unknown>;
  const c = (d.colors ?? {}) as Record<string, unknown>;
  const colors = {} as StyleGuide["colors"];
  for (const k of COLOR_KEYS) {
    const v = c[k];
    if (typeof v !== "string" || !/^#[0-9a-f]{6}$/i.test(v)) return { ok: false, error: `The style guide's "${k}" color isn't a #rrggbb color.` };
    if (isOrange(v)) return { ok: false, error: `The style guide used orange (${v}), which is reserved for the AI. Please try again.` };
    colors[k] = v.toLowerCase();
  }
  fixContrast(colors);
  const t = (d.type ?? {}) as Record<string, unknown>;
  // Clamp each size, then force display > title > body > caption.
  const caption = clamp(t.caption, 10, 14, 12);
  const body = Math.max(clamp(t.body, 13, 18, 15), caption + 1);
  const title = Math.max(clamp(t.title, 17, 28, 20), body + 2);
  const display = Math.max(clamp(t.display, 24, 44, 32), title + 4);
  return {
    ok: true,
    guide: {
      product: typeof d.product === "string" ? d.product.trim().slice(0, 40) : "",
      mood: typeof d.mood === "string" ? d.mood.trim().slice(0, 80) : "",
      colors,
      font: typeof d.font === "string" && d.font in FONTS ? (d.font as FontId) : "sans",
      radius: clamp(d.radius, 0, 28, 12),
      spacing: Math.round(clamp(d.spacing, 4, 12, 8) / 4) * 4, // 4, 8 or 12
      type: { display, title, body, caption },
    },
  };
}

// ── Contrast (WCAG 2) ────────────────────────────────────────────────────────

function luminance(hex: string) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors (1 to 21). */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const DARK = "#111318";
const LIGHT = "#ffffff";
const readableOn = (bg: string) => (contrast(DARK, bg) >= contrast(LIGHT, bg) ? DARK : LIGHT);

// Mix two #rrggbb colors: t = 0 → a, 1 → b.
function mix(a: string, b: string, t: number) {
  const c = [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

// Make the guide readable whatever the AI picked (fixing beats rejecting:
// a rejection costs a whole retry).
function fixContrast(c: StyleGuide["colors"]) {
  if (contrast(c.text, c.background) < 4.5 || contrast(c.text, c.surface) < 4.5) c.text = readableOn(c.background);
  if (contrast(c.onPrimary, c.primary) < 4.5) c.onPrimary = readableOn(c.primary);
  for (let t = 0.2; contrast(c.muted, c.background) < 3 && t <= 1; t += 0.2) c.muted = mix(c.muted, c.text, t);
}

/** The style guide as CSS variables (what every screen is built on). */
export function styleCss(g: StyleGuide) {
  const c = g.colors;
  const s = g.spacing;
  const space = [1, 2, 3, 4, 6, 8].map((m, i) => `--space-${i + 1}:${s * m}px`).join(";");
  return `:root{--bg:${c.background};--surface:${c.surface};--text:${c.text};--muted:${c.muted};--primary:${c.primary};--on-primary:${c.onPrimary};--accent:${c.accent};--border:${c.border};--radius:${g.radius}px;--radius-sm:${Math.round(g.radius / 2)}px;--radius-lg:${Math.min(32, Math.round(g.radius * 1.5))}px;--space:${s}px;${space};--shadow-1:0 1px 2px rgba(16,18,27,.06),0 1px 3px rgba(16,18,27,.08);--shadow-2:0 4px 12px rgba(16,18,27,.08),0 12px 32px rgba(16,18,27,.10);--font:${FONTS[g.font]};--fs-display:${g.type.display}px;--fs-title:${g.type.title}px;--fs-body:${g.type.body}px;--fs-caption:${g.type.caption}px;--lh-tight:1.2;--lh-body:1.5;--weight-regular:400;--weight-strong:600}`;
}

// ── What a screen request carries ────────────────────────────────────────────

// columns 2/3 = sits side by side with neighbours that have the same number
// (rows and grids from the wireframe layout); tabbar label = "A | B | C".
export type DesignComponent = { type: string; label: string; notes?: string; columns?: number };
export type DesignScreen = { name: string; components: DesignComponent[] };

// ── Prompts ──────────────────────────────────────────────────────────────────

const NO_ORANGE = "Never use orange, amber, or orange-brown colors (hues around 15-45 degrees) anywhere: orange is reserved for the AI in this tool.";

export const STYLE_SYSTEM_PROMPT = `You are a senior product designer. From a product idea, choose a small, coherent visual style guide for its mobile app: a short product name, a mood, 8 colors, a font family, a corner radius, a spacing unit and a type scale.
- Colors are #rrggbb. "text" must read clearly on "background" and "surface"; "onPrimary" must read clearly on "primary"; "muted" is for secondary text; "border" is a subtle line color.
- font is one of: sans, serif, rounded, mono. radius 0-28 px, spacing 4-12 px; type sizes in px: display 24-44, title 17-28, body 13-18, caption 10-14.
- ${NO_ORANGE}`;

export const SCREEN_SYSTEM_PROMPT = `You are a senior mobile UI designer. Turn ONE grey-box wireframe into a polished, realistic, high-fidelity mobile app screen, like a finished design mockup.

Output ONE complete HTML document ("<!doctype html><html>…</html>") for a ${PHONE_CSS_W}x${PHONE_CSS_H} px phone screen:
- Put all CSS in one <style> in <head>. Start it with the given :root CSS variables and use them (var(--primary), var(--radius), var(--font)…) so every screen matches the style guide. body: margin 0, width ${PHONE_CSS_W}px, min-height ${PHONE_CSS_H}px, background var(--bg), font-family var(--font).
- Follow the wireframe: same parts, same order, same labels. Turn each box into a real UI element (header → app bar or title area; input → styled text field; button → real button; card/list/summary → designed content with realistic sample data; image → placeholder made of CSS gradients or shapes). "×2 per row" / "×3 per row" means those neighbours sit side by side (a row of buttons, a grid of cards). tabbar → a bottom navigation bar with one tab per "|"-separated label and an icon each. You may add small details a real app would have (status bar, icons) if they fit.
- Design like a top product studio:
  - Use ONLY the variables for colours, spacing (var(--space-1)…var(--space-6)), corner radius (--radius-sm/--radius/--radius-lg), shadows (--shadow-1/2), font sizes and weights. No other hex colours or pixel spacing except 1px borders.
  - 4/8 px grid; consistent side margins (var(--space-4)); generous whitespace; clear hierarchy (one large title, then sections).
  - Exactly one primary action per screen, in var(--primary); everything else quieter.
  - Tap targets at least 44 px tall; text never smaller than var(--fs-caption); max two font weights.
  - One icon style everywhere: simple inline SVG, stroke 1.75, stroke="currentColor", no fill, 20–24 px.
  - Realistic, specific sample content (real-sounding names, prices, times, counts). Never "Lorem ipsum", "Item 1" or "Text here".
  - Nothing may overflow or be cut off at ${PHONE_CSS_W}px wide; long text wraps or uses ellipsis.
- Self-contained: NO <script>, NO event handlers (onclick…), NO <iframe>/<object>/<embed>/<link>/<form>, NO external URLs of any kind (no web fonts, no image links, no http/https anywhere). Inline SVG and data: URLs are fine.
- ${NO_ORANGE}
- Keep it compact: under 25 KB. Return it in the "html" field.`;

export const REVIEW_SYSTEM_PROMPT = `You are a design director reviewing ONE mobile screen (an HTML page, ${PHONE_CSS_W}px wide) made by a junior designer. Find every problem on this checklist and FIX it in the page. Change nothing that is already good, and keep the same content, parts and order.

Checklist:
1. Contrast: all text clearly readable on its background.
2. Grid and spacing: everything aligned to a 4/8 px rhythm, consistent side margins, even gaps between related items, more space between sections than within them.
3. Hierarchy: one clear title, one clear primary action (var(--primary)); secondary things visibly quieter.
4. Fit: nothing overflows, overlaps or is cut off at ${PHONE_CSS_W}px; long text wraps or uses ellipsis; tap targets at least 44 px.
5. Consistency: only the style guide's CSS variables for colours, spacing, radius, shadows and type; one icon style; max two font weights.
6. Content: realistic, specific sample data; no placeholders like "Lorem ipsum", "Item 1", "Text".
7. Polish: balanced density (not cramped, not empty), subtle depth with --shadow-1/2 or borders, considered empty space.

Same rules as before: one complete HTML document, CSS in one <style> starting with the given :root variables, NO <script>, NO event handlers, NO <iframe>/<object>/<embed>/<link>/<form>, NO external URLs (inline SVG and data: URLs are fine), under 25 KB.
- ${NO_ORANGE}
Return the improved page in the "html" field.`;

export function reviewUserMessage(opts: { idea: string; guide: StyleGuide; screen: DesignScreen; html: string }) {
  const { idea, guide, screen, html } = opts;
  return [
    idea && `The product idea:\n<idea>\n${idea}\n</idea>`,
    `Style guide for "${guide.product || "the app"}" (mood: ${guide.mood || "clean"}). The page must use these CSS variables:\n<style_guide>\n${styleCss(guide)}\n</style_guide>`,
    `The screen "${screen.name}" to review and fix:\n<page>\n${html}\n</page>`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function styleUserMessage(idea: string, resolution: string, screenNames: string[]) {
  return [
    idea && `The product idea:\n<idea>\n${idea}\n</idea>`,
    resolution && `How the team's ideas were merged:\n<resolution>\n${resolution}\n</resolution>`,
    `Its screens: ${screenNames.join(", ")}.`,
    "Choose the style guide.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function screenUserMessage(opts: {
  idea: string;
  resolution: string;
  guide: StyleGuide;
  screen: DesignScreen;
  otherScreens: string[];
  instruction: string;
}) {
  const { idea, resolution, guide, screen, otherScreens, instruction } = opts;
  const boxes = screen.components
    .map((c, i) => `${i + 1}. ${c.type}${c.columns && c.columns > 1 ? ` ×${c.columns} per row` : ""}: "${c.label}"${c.notes ? ` (${c.notes})` : ""}`)
    .join("\n");
  return [
    idea && `The product idea:\n<idea>\n${idea}\n</idea>`,
    resolution && `How the team's ideas were merged:\n<resolution>\n${resolution}\n</resolution>`,
    `Style guide for "${guide.product || "the app"}" (mood: ${guide.mood || "clean"}). Use these CSS variables:\n<style_guide>\n${styleCss(guide)}\n</style_guide>`,
    otherScreens.length ? `Other screens in this app (for navigation labels): ${otherScreens.join(", ")}.` : "",
    `The wireframe to design, "${screen.name}", top to bottom:\n<wireframe>\n${boxes}\n</wireframe>`,
    instruction && `The team asked for this change:\n<instruction>\n${instruction}\n</instruction>`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── Safety checks for the HTML ───────────────────────────────────────────────

// Removed outright (with their contents where they have any).
const STRIP: RegExp[] = [
  /<script\b[\s\S]*?<\/script\s*>/gi,
  /<iframe\b[\s\S]*?<\/iframe\s*>/gi,
  /<object\b[\s\S]*?<\/object\s*>/gi,
  /<(script|iframe|object|embed|link|base|frame|frameset|applet)\b[^>]*>/gi, // unclosed / void ones
  /<meta\b[^>]*http-equiv[^>]*>/gi,
  /<\/?form\b[^>]*>/gi, // keep a form's contents, drop the form itself
  /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, // onclick=… and friends
];

// Still there after cleaning → the page is rejected.
const FORBIDDEN: [RegExp, string][] = [
  [/<\s*\/?\s*(script|iframe|object|embed|link|base|frame|applet)\b/i, "an embedded or script element"],
  [/\son[a-z]+\s*=/i, "an event handler"],
  [/javascript\s*:/i, "a javascript: link"],
  [/\b(src|href|srcset|action|poster|data)\s*=\s*["']?\s*(https?:|\/\/|ftp:)/i, "an outside link"],
  [/url\(\s*["']?\s*(https?:|\/\/|ftp:)/i, "an outside url()"],
  [/@import/i, "a CSS @import"],
];

/** Clean and check one screen's HTML. Returns the cleaned page or why it was rejected. */
export function checkDesignHtml(raw: unknown): { ok: true; html: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "The design came back empty." };
  if (new TextEncoder().encode(raw).length > MAX_HTML_BYTES) {
    return { ok: false, error: `The design was too big (over ${MAX_HTML_BYTES / 1000} KB). Please try again.` };
  }
  let html = raw.trim();
  for (const pattern of STRIP) html = html.replace(pattern, "");
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
    return { ok: false, error: "The design wasn't a complete HTML page. Please try again." };
  }
  // The AI can stop mid-page and still hand back valid JSON; a cut-off page
  // never reaches the canvas.
  if (!/<\/body\s*>[\s\S]*<\/html\s*>\s*$/i.test(html)) {
    return { ok: false, error: "The design got cut off before it was finished. Please try again." };
  }
  for (const [pattern, what] of FORBIDDEN) {
    if (pattern.test(html)) return { ok: false, error: `The design contained ${what}, so it was rejected. Please try again.` };
  }
  const orange = orangeInCss(html);
  if (orange) return { ok: false, error: `The design used orange (${orange}), which is reserved for the AI. Please try again.` };
  return { ok: true, html };
}

/** The words a person would see on the page (no CSS, no tags). */
export function visibleText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Orange detection ─────────────────────────────────────────────────────────
// ponytail: a hue/saturation band check on the colors written in the CSS. It
// can miss colors made some other way (gradients of two non-orange colors
// blending, filters); good enough to keep obvious orange out.

const ORANGE_NAMES = /\b(orange|darkorange|orangered|coral|tomato|sandybrown|chocolate|peru|goldenrod|darkgoldenrod)\b/i;

function isOrangeHsl(h: number, s: number, l: number) {
  return h >= 15 && h <= 45 && s >= 0.45 && l >= 0.3 && l <= 0.8;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Is this #rgb / #rrggbb color orange? */
export function isOrange(hex: string) {
  let m = hex.replace("#", "");
  if (m.length === 3 || m.length === 4) m = m.slice(0, 3).split("").map((x) => x + x).join("");
  if (!/^[0-9a-f]{6}/i.test(m)) return false;
  const [h, s, l] = rgbToHsl(parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16));
  return isOrangeHsl(h, s, l);
}

// The first orange color found in the page's CSS (<style> blocks and style=""), or null.
function orangeInCss(html: string): string | null {
  const css = [
    ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]),
    ...[...html.matchAll(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi)].map((m) => m[1]),
    ...[...html.matchAll(/\s(fill|stroke|stop-color|color)\s*=\s*("[^"]*"|'[^']*')/gi)].map((m) => m[2]), // SVG
  ].join("\n");
  const name = css.match(ORANGE_NAMES);
  if (name) return name[0];
  for (const m of css.matchAll(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi)) if (isOrange(m[0])) return m[0];
  for (const m of css.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/gi)) {
    if (isOrangeHsl(...rgbToHsl(+m[1], +m[2], +m[3]))) return m[0];
  }
  for (const m of css.matchAll(/hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/gi)) {
    if (isOrangeHsl(((+m[1] % 360) + 360) % 360, +m[2] / 100, +m[3] / 100)) return m[0];
  }
  return null;
}

// ── Mock (AGENT_PROVIDER=mock): fixed sample answers, no AI ──────────────────

export const MOCK_STYLE_GUIDE: StyleGuide = {
  product: "Sample App",
  mood: "calm, modern, friendly",
  colors: {
    background: "#f6f7fb",
    surface: "#ffffff",
    text: "#1b1d2a",
    muted: "#6b7085",
    primary: "#4f46e5",
    onPrimary: "#ffffff",
    accent: "#14b8a6",
    border: "#e3e5ee",
  },
  font: "sans",
  radius: 14,
  spacing: 8,
  type: { display: 30, title: 20, body: 15, caption: 12 },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** A fixed, real-looking design built from the wireframe's own boxes. */
export function mockScreenHtml(screen: DesignScreen, guide: StyleGuide, instruction = "") {
  const part = (c: DesignComponent) => {
    const label = esc(c.label);
    switch (c.type) {
      case "header":
        return `<header class="bar"><span class="dot"></span><h1>${label}</h1></header>`;
      case "input":
        return `<div class="field"><span class="hint">${label}</span></div>`;
      case "button":
        return `<div class="btn">${label}</div>`;
      case "image":
        return `<div class="img"><span>${label}</span></div>`;
      case "list":
        return `<div class="card"><h3>${label}</h3>${[1, 2, 3].map((i) => `<div class="row"><span class="av"></span><div><b>Item ${i}</b><small>Sample detail</small></div></div>`).join("")}</div>`;
      case "summary":
        return `<div class="card sum"><h3>${label}</h3><div class="stats"><div><b>12</b><small>This week</small></div><div><b>4.8</b><small>Rating</small></div><div><b>86%</b><small>Done</small></div></div></div>`;
      case "card":
        return `<div class="card"><h3>${label}</h3><p>${esc(c.notes || "A short, realistic description goes here.")}</p></div>`;
      default:
        return `<p class="text">${label}</p>`;
    }
  };
  return `<!doctype html><html><head><meta charset="utf-8"><style>${styleCss(guide)}
*{box-sizing:border-box}body{margin:0;width:${PHONE_CSS_W}px;min-height:${PHONE_CSS_H}px;background:var(--bg);color:var(--text);font-family:var(--font);font-size:var(--fs-body)}
.status{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 22px;font-size:var(--fs-caption);font-weight:600}
main{padding:calc(var(--space)*2);display:flex;flex-direction:column;gap:calc(var(--space)*1.5)}
.bar{display:flex;align-items:center;gap:10px}.bar h1{margin:0;font-size:var(--fs-display)}.dot{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent))}
.field{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;color:var(--muted)}
.btn{background:var(--primary);color:var(--on-primary);border-radius:var(--radius);padding:15px;text-align:center;font-weight:600}
.img{height:150px;border-radius:var(--radius);background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:flex-end;padding:12px;color:var(--on-primary);font-weight:600}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px}.card h3{margin:0 0 8px;font-size:var(--fs-title)}.card p{margin:0;color:var(--muted)}
.row{display:flex;gap:12px;align-items:center;padding:8px 0;border-top:1px solid var(--border)}.row small,.stats small{display:block;color:var(--muted);font-size:var(--fs-caption)}
.av{width:34px;height:34px;border-radius:50%;background:var(--accent);opacity:.8}
.stats{display:flex;justify-content:space-between}.stats b{font-size:var(--fs-title)}.text{margin:0;color:var(--muted)}
.tabs{position:fixed;bottom:0;width:${PHONE_CSS_W}px;height:72px;background:var(--surface);border-top:1px solid var(--border);display:flex;justify-content:space-around;align-items:center;color:var(--muted);font-size:var(--fs-caption)}
.tabs .on{color:var(--primary);font-weight:600}
</style></head><body><div class="status"><span>9:41</span><span>●●● ▮</span></div>
<main>${screen.components.map(part).join("\n")}${instruction ? `<p class="text">Mock change: ${esc(instruction)}</p>` : ""}</main>
<nav class="tabs"><span class="on">${esc(screen.name)}</span><span>Search</span><span>Profile</span></nav></body></html>`;
}
