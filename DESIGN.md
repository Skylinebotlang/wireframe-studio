# Wireframe Studio — Design System

The rules behind the look of Wireframe Studio. They are taken from what is built in this repo (`app/globals.css`, `app/landing.css`, `lib/theme.ts`). If something here disagrees with the code, the code wins; update this file.

## 1. Idea

**The product is the visual language.** Frames, named cursors, prompts, and wireframes that assemble themselves are the decoration. There are no blobs, stock art or icon grids.

The core story told through color: **wine = people, orange = the AI working among them.**

Positioning line (use exactly): **"Three teams. One canvas. One answer."**
Second message: **"Everybody has the context, not just the AI."**

## 2. Color

Use only these tokens (`app/globals.css` `:root`, mirrored in `lib/theme.ts`). Never hard-code new colors.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#090719` | Page background (deepest navy) |
| `--surface` | `#131224` | Panels, cards, frames |
| `--raised` | `#191A2F` | Inputs, image placeholders, raised areas |
| `--line` | `#2B2A42` | Hairline borders |
| `--ink` | `#F8F4F5` | Main text (soft white) |
| `--muted` | `#9E99A8` | Secondary text, grey wireframe boxes (as `color-mix` tints) |
| `--accent` | `#681E2E` | **Wine: people.** Buttons, note headers, active pill |
| `--accent-bright` | `#C2475F` | Wine on dark: outlines, glows, labels |
| `--rose` | `#E0607E` | A person's cursor (bright wine tint) |
| `--wine-light` | `#D98A99` | A person's cursor (light wine tint) |
| `--agent` | `#FF6B2C` | **Orange: the AI only** |

**Hard rules**
- Orange (and amber) appears **only** for the AI: its cursor, its status, frames it is drawing, its lines in feeds. Never on a human action or a button a person presses.
- Orange disappears once the AI is done: a finished box turns grey, and a "Done" chip turns muted.
- One loud accent on deep navy. No purple-to-blue gradients and no rainbow.
- Glows only on wine buttons (`box-shadow` with `--accent-bright`) and on AI elements (`--agent`).

## 3. Type

Fonts are set up in `app/layout.tsx`. Don't add others.

| Font | Variable | Use |
|---|---|---|
| **Inter Tight** 600 | `--font-inter-tight` | Display: hero, chapter lines (`.lp-head`: line-height 0.9, letter-spacing −0.045em) |
| **Bulzing** | `--font-bulzing` | Wordmark, small headings. ⚠ Non-commercial licence: replace or license before launch |
| **IBM Plex Sans** | `--font-ibm-plex-sans` | Body text |
| **IBM Plex Mono** | `--font-ibm-plex-mono` | Labels, prompts, cursor names, status (`.lp-mono`: uppercase, 11px, letter-spacing 0.14em) |

**Scale (landing page)**
- Hero headline: `clamp(44px, 6.6vw, 112px)`, uppercase.
- Chapter line: `clamp(34px, 4.4vw, 72px)`, max 14 characters wide.
- Final CTA line: `clamp(40px, 6vw, 104px)`, uppercase.
- Message: `clamp(20px, 1.7vw, 26px)`, Inter Tight.
- Body: 17px, line-height 1.5, `--muted`.
- Mono labels: 9–11px.

**Treatments**
- Outlined words (`.lp-dim`): transparent fill, 1.5px `--muted` stroke. Used for "One canvas."
- Big type has real hierarchy: one huge line, then small mono labels around it.

## 4. Shapes and texture

- **Sharp corners.** Frames, cards and inputs have no radius. Cursor tags and dots are the only rounded things.
- **The wine button** (`.lp-btn`): solid `--accent`, 1px `--accent-bright` border, bottom-right corner clipped (`clip-path`), mono uppercase label + arrow.
- **Frames** (`.sc-frame`): `--surface` fill, 1px `--line` border, mono tag top-left (`TEAM_01 · PRIYA`).
- **HUD details:** corner ticks (`.lp-corner`), a blinking live square, mono stats in the top bar.
- **Background:** dotted grid (`.dot-grid`) plus fixed scanlines (`.lp::after`).
- **Cursors** (`.hi-cursor`): arrow + name tag in the person's color. The AI's tag has a blinking dot.

## 5. Wireframe language

Every part of the page can show three states (`[data-build][data-state]` in `landing.css`):

1. **drawing**: grey bars inside an **orange dashed frame**, with an orange scan line sweeping across.
2. **wire**: grey bars, grey dashed outline.
3. **real**: the finished design; colors fade in over 600ms.

The wireframe is the real content dressed as grey bars, so it always matches the final layout.

## 6. Motion

**Every animation must say something about the product:** frames merging, cursors moving, prompts typing, wireframes assembling. Don't use the same fade-up on everything.

- Animate only **transform, opacity, clip-path**.
- Easing: smooth ease-out (`expo.out`, `cubic-bezier(0.16, 1, 0.3, 1)`) for arrivals, and `power3.inOut` / `cubic-bezier(0.65, 0, 0.35, 1)` for moves. **No bounce or elastic.** The exception is the tiny "clash ✕" pop.
- Hovers: 150–250ms, slight lift or press, wine highlight.
- Tools: **GSAP + ScrollTrigger** for timelines, **Lenis** for smooth scroll (`app/SmoothScroll.tsx`).
- **Reduced motion:** no spin, no pinning, no movement. Every scene shows its finished picture, still complete and readable.

**Signature sequences**

| Where | File | What |
|---|---|---|
| Hero, first 8s | `app/HeroIntro.tsx` | Three team frames build mismatched screens → ✕ clashes → frames merge → orange AI assembles one screen → headline → message → Start the chat |
| Chapters | `app/Chapters.tsx` | Six pinned, scroll-driven screens; each clips open from a smaller frame and draws in as a wireframe |
| Cursor trail | `app/FluidCursor.tsx` | Wine fluid trail, landing page only |

## 7. Layout

- Laptop first (designed at 1440px), then 390px.
- Break the grid on purpose: copy and scene swap sides chapter to chapter, the headline sits bottom-left against a scene in the middle, the CTA sits bottom-right.
- One idea per screen. Short copy.
- Phones: stack copy above scene, hide decorative cursors that would cover text, show only the current chapter pill.

## 8. Voice

Polished startup, creative but clear. Short sentences, no buzzwords ("unleash", "seamless", "revolutionize").

**Honesty:** no invented stats, testimonials, customer logos or ratings.

## 9. Accessibility

- Text contrast at least 4.5:1 (`--ink` and `--muted` on navy pass).
- Real headings (`h1` hero, `h2` per chapter), alt text on the logo, decorative scenes `aria-hidden`.
- Everything works with the keyboard: chapter pills, "Skip the intro", and the "Start the chat" dialog (native `<dialog>`, Escape closes it).

## 10. Don't

Purple/blue gradients, glassmorphism everywhere, 3-column icon feature grids, stock illustrations, emoji as icons, floating blobs, fake numbers, centered sections with no tension, orange on anything human.
