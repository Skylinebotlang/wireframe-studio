# Landing page design record (the homepage, /)

Read this before changing anything in `components/landing/studio/` or `app/page.tsx`.
Source of truth for the rules: the landing-page-design skill
(`~/.claude/skills/landing-page-design/SKILL.md`). Where it clashes with older
project rules (CLAUDE.md), the skill wins (papi's call, 2026-11-09).
Tokens live in `app/globals.css` under "Landing page design system".

## Approved

**Font**
- Geist only (one typeface), weights 400 / 500 / 600. No italics, nothing above semibold.
- Text only through the named styles: `heading-1…6`, `title-1…4`, `body-2`,
  `body-3`, `body-6`, `body-7`, `button-md`, `button-sm`, `caption-1/2/4`.
  Need a new one? Add the next number in its group, built from a Tailwind scale step.
- Headings `text-balance`, body copy `text-pretty`. No hyphens in copy. Sentence case.

**Colors**
- Backgrounds: our navy palette (papi 2026-11-09, overrides the skill's
  black list): `void` #090719 (page), `panel` #131224, `panel-2` #191A2F,
  `panel-3` #22213A. Hairlines: `edge` #2B2A42. The 3D room is navy too.
- Text: `ink` #F8F4F5, `soft` #CFCAD6 (13:1), `faint` #9E99A8 (6:1 on panel-2).
- Accent: wine `accent` #681E2E (fills: buttons, notes, outlines of the cards
  that matter), `rose` #E0607E (icons, decisions, highlights).
- Orange #FF6B2C = the AI, and ONLY inside the 3D story scene (the ember, its
  threads, the decision card, the screens being drawn). Never in HTML/UI.
- Hero heading only: #F8F4F5 → #9E99A8 text gradient. No other gradients.

**Spacing**: 0 2 4 8 12 16 24 32 40 48 64 80 96 px only
(Tailwind 0 · 0.5 · 1 · 2 · 3 · 4 · 6 · 8 · 10 · 12 · 16 · 20 · 24).
Sections `py-20 md:py-24`; heading → content `mt-12`; content max width 1200px,
gutters 24px phone / 48px desktop.

**Corners**: Tailwind radii. Nested: inner = outer − gap when gap < 32px and
result > 2 (card `rounded-3xl` + p-2 → `rounded-2xl` → `rounded-lg`).

**Buttons**
- ONE primary action, ONE label everywhere: **"Start your first board"** → `/signup`.
  Wine fill, `rounded-xl`, 8 × 12px padding, `button-md` (`button-sm` in the nav).
- Hover: color shift 300ms. Press: scale 0.98. Focus: rose outline ring.
- Loading: thin bar along the bottom while the next page loads (no spinners).
- Only one wine button visible at a time above the fold: the nav button stays
  quiet (outlined) while the hero button is on screen.

**Icons**: Phosphor (`@phosphor-icons/react`, `/ssr` in server components), 16 or 20px.

**Motion**: one curve `cubic-bezier(0.22, 1, 0.36, 1)`; 500ms for movement,
300ms for color/opacity; only transform + opacity; reveals rise 32px once;
skeletons for loading; `prefers-reduced-motion` respected everywhere.

**Story (the page's spine, papi 2026-11-09)**: "a page you couldn't put
another product's name on". One round table (3D, `table3d.ts`, driven by
scroll in `Story.tsx`): hero → the mess → one table → the clash → the screens
→ "Everybody at the table has the context, not just the AI." Then the same
story on the real board (`RealBoard`), then the visitor settles the clash
(`TryIt`). Everything after that stays plain (pricing, FAQ, final CTA).
New sections must continue this story (the checkout clash, the three
people, the AI), not add generic feature grids.

**Content**: only true facts. No free AI claims (BYOK only). Missing facts use
marked placeholders, and a section made only of placeholders stays hidden.

## Rejected (don't bring back)

- Chakra Petch, IBM Plex, Bulzing (licence) on this page; two-font pairings.
- Neutral black backgrounds (#000/#181818 family, replaced by navy); orange in HTML/UI.
- CSS gradient backgrounds (incl. the radial-gradient dot grid; use `DotGrid`).
- Spinners; height/width/top/left animations; browser default easings.
- One-sided card borders; corner-bracket hover; giant outlined footer wordmark.
- Badges like "Placeholder", "01–04" numbers, redundant labels.
- Invented testimonials, logos, stats, seat limits, prices.
- Two CTA labels for the same action ("Start a board" vs "Start your first board").
- Two wine buttons on screen at once above the fold.
- Colored glow shadows (read as decorative gradients).
- A section made only of placeholders (Proof stays hidden until real quotes).
- Generic stacks of feature cards / "how it works" grids that any product could
  use (removed: Problem, Features small cards, Steps).
- The tethered 2D hero background (replaced by the 3D table, whose orange
  threads are the tethers now).

## Change log

- 2026-11-09: rebuilt to the skill (Geist, skill blacks, Phosphor, skeletons,
  tagline reveal, How it works, floating nav).
- 2026-11-09: audit round 1, Hero + CTA: one CTA label everywhere; nav button
  outlined while the hero button is visible; product mock shortened on phones
  (1,064 → 928px; hero 1,696 → 1,522px); PM note shortened to one line; agent
  panel text no longer overlaps while swapping; wine glow under the mock removed.
  Proof hidden until real quotes.
- 2026-11-09: story rebuild. Round table 3D scene + 6 scroll chapters replace
  hero/Problem/Features/Steps/Tagline section; RealBoard + TryIt follow.
  Nav: The story · The board · Pricing · FAQ. Canvas sized with CSS (fixes
  phones), camera steps back on tall screens.
- 2026-11-09: the three people rebuilt in code (`people3d.ts`): real seated
  proportions in metres, IK arms with hands and fingers, stylised faces,
  skull-hugging hair with a real hairline, role outfits (PM blazer + white
  shirt, Designer rose turtleneck + glasses + bun, Developer grey hoodie +
  headphones), office chairs. They look at whoever talks, their own note, the
  AI, the screens, then their copy of the decision; the speaker gestures; PM
  and Developer argue in the clash. Lamp shadows + filmic tone mapping.
  Close-up debug camera: `/?debug3d`, then `window.__tableCam([x,y,z],[x,y,z])`.
- 2026-11-09: switched to our navy palette (page + 3D room) and moved the
  page from /new to the homepage /. The launch site v2 homepage is in git history.
- Next in the audit queue: Benefits hierarchy (stacked headings, picker wrap on
  phones), card overload + repeated Steps section, half empty Team card, legal
  links / 404 / og:image (need papi's content).
