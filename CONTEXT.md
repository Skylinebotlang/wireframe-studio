# Wireframe Studio — handoff context (frontend)

Snapshot: 2026-10-08. Use this to continue work in a new chat.
See also `CLAUDE.md` (project rules), `canvas-team/DESIGN.md` (design system).

## Where things are
- App: `canvas-team/` (Next.js 16, App Router, Tailwind 4, tldraw 3, Liveblocks).
- Live: https://wireframe-studio-theta.vercel.app (auto-deploys on push to GitHub `Skylinebotlang/wireframe-studio`, branch `main`).
- Local: `npm run dev` inside `canvas-team` → http://localhost:3000.
- Git author MUST be `Yadhush bansal <155626509+Skylinebotlang@users.noreply.github.com>` (already set in the repo's local git config). Any other email → Vercel blocks the deploy.
- Last commit: `ad55cc5` (chapter 05 demo) — **committed but NOT pushed/deployed**. Live site is at `7a1657d`.

## Owner and working style
- Owner "papi" is not a programmer: explain in plain words, stop after each milestone, show screenshots.
- Deploy ONLY when papi says "deploy". Commit locally after each change.
- This chat handles the FRONTEND only (no API routes, `lib/agent-brains.ts`, Liveblocks auth).

## Brand rules (hard)
- Colors only from `app/globals.css` / `lib/theme.ts`: navies `#090719 #131224 #191A2F`, ink `#F8F4F5`, wine `#681E2E` (people), wine-bright `#C2475F`, rose `#E0607E`, wine-light `#D98A99`, **orange `#FF6B2C` = AI only**.
- Fonts: Inter Tight (display), Bulzing (wordmark; non-commercial licence — replace before launch), IBM Plex Sans (body), IBM Plex Mono (labels).
- Logo: `public/logo-2d.png`, `public/logo-full.png`, `app/icon.png` only.
- No fake stats/testimonials/logos/model versions. Positioning line: "Three teams. One canvas. One answer." Second line: "Everybody has the context, not just the AI."
- Animate only transform / opacity / clip-path. Respect reduced motion (static finished versions).

## Landing page (`/`) — how it works now
Files in `canvas-team/app/`:
| File | Role |
|---|---|
| `page.tsx` | Assembles everything below |
| `Splash.tsx` + `LogoCore3D.tsx` | Drag-the-3D-logo splash (shown once per tab). Fires `wfs:loaded` when gone |
| `Loader.tsx` | Old spinning-logo loader — NOT used (kept) |
| `HeroIntro.tsx` | HUD hero (from papi's Stitch design): 6 s story — 3 team frames build mismatched screens → merge → orange AI assembles one screen → "WIREFRAME STUDIO" + line + progress log + Start the chat / Skip + AI row. Fires `wfs:hero-done` |
| `Chapters.tsx` | The whole page as one pinned GSAP master timeline (1 unit = 1 screen): hero → 01 → 02 → 03 → 04 slide sideways (parallax), **one screen per scroll gesture (paging)**. 04 → 05 → 06 → footer: **continuous smooth scroll, 3D zoom transitions, pages are floating angled 3D cards (bob + mouse tilt)**. Chapter pills + "Skip the intro". Exports `goToChapter(i)`. Broadcasts `wfs:screen` (window.__wfsScreen) |
| `LiveCursors.tsx` | Priya (wine-light), Leo (rose), Agent (orange star + `[drawing: …]` chip). After hero they JUMP OUT of the hero window, then roam across every page with short pauses; head to each new screen. In-window cursors hidden once out (`html.lc-on`) |
| `SmoothScroll.tsx` | Lenis + ScrollTrigger sync; `window.__lenis`; waits for `wfs:loaded` |
| `FluidCursor.tsx` + `SplashCursor.tsx` | Wine fluid mouse trail (landing only, off on touch / reduced motion) |
| `StartChat.tsx` | "Start the chat" → dialog: Sign in (`/login`) or Sign up (`/signup`) |
| `SiteBuilder.tsx` | Old scroll wireframe builder — NOT used (its wireframe CSS is reused by chapters) |
| `TubesBackground.tsx` | Unused; ask papi before deleting |
| `landing.css` | All landing styles (prefixes `lp-`, `hi-`, `hud-`, `ch-`, `sc*`, `hs-`, `dz-`, `lc-`, `sb-`) |

Chapters: 01 Problem · 02 How it works (has Start the chat) · 03 Live together · 04 AI teammate · **05 Try it = live clickable demo** (`public/demo/index.html` in an iframe; scripted agent; wheel over it is forwarded to the page via postMessage) · 06 Start the chat · footer.

## Auth (demo mode)
- `/login` and `/signup` use `app/AccountForm.tsx`: fully interactive validation, no backend, nothing stored except the display name in sessionStorage. Then `/login` shows "Who's drawing?" (`app/login/LoginIdentity.tsx` → `LoginCard`).
- A friend will add real OAuth: replace the `submit` body in `AccountForm.tsx` (comment marks the spot). Supabase was tried and removed.

## Known leftovers / next steps
1. Push + deploy `ad55cc5` when papi says so.
2. Bug stage (planned, not done): canvas color menu offers orange to humans; color menu hidden behind agent panel; phone agent panel covers canvas; Liveblocks badge covers activity feed; wireframes land under the panel; 10 old lint problems (`LogoCore3D`, `Splash`, room page, `useYjsStore`, plus 2 backend files); 4 bouncy easings in `globals.css` (canvas room).
3. Then an Impeccable audit.
4. Unused files to clean up with papi's OK: `Loader.tsx`, `SiteBuilder.tsx`, `TubesBackground.tsx`.
5. OneDrive sometimes locks `.next` → `npm run build` EPERM; delete the locked folder and rerun (or exclude `canvas-team/.next` from OneDrive).

## Testing notes
- Playwright MCP works; the built-in browser pane is often hidden (screenshots blank, animations paused) — prefer Playwright.
- To skip the splash in tests: `sessionStorage.setItem('wireframe-studio-splash-seen','1')`.
- Jump to screen u (0–7): `__lenis.scrollTo((scrollHeight-innerHeight)*u/7, {immediate:true})`.

---

# AGENT LAYER: "Make it real" (stage 2: wireframes → real UI mockups)

Added 2026-10-13 on branch `agent-v2`. This is the agent work this chat owns.
Goal: the agent turns the generic grey-box wireframes into real, high-fidelity
mobile UI mockups (like Google Stitch), on the shared canvas, for everyone.
Not part of this work: sign-in / Supabase / boards (friend's code).

## Two stages
1. **Stage 1, wireframes (friend's design, unchanged):** "Frame your idea" /
   "Send notes to agent" → ONE streamed AI call (`app/api/agent/route.ts`,
   `lib/agent-brains.ts`, `lib/stream-scan.ts`) → grey-box phone frames drawn
   live (`lib/draw-wireframes.ts`), with clash merging, add/update/ask, undo.
2. **Stage 2, Make it real (new):** the panel's "Make it real" button turns
   the wireframes (the selected frames, or all frames, max 6) into real designs.
   Selecting one design turns the button into "Regenerate <name>" with a short
   instruction box ("make Home darker").

## How a Make-it-real run works
The browser of the person who clicked drives it (`lib/agent-design-room.ts`),
ONE server call per AI call, so no call hits the 120 s limit:
1. Claim the shared agent run (same `agentRun` as stage 1, so only one thing
   runs at once and Pause / Resume / Take over work the same). Plan ticks:
   "Pick a style → Design screens → Place on canvas".
2. `POST /api/design {kind:"style"}` → ONE style guide for the whole app:
   product name, mood, 8 colors, font (sans/serif/rounded/mono, system fonts
   only), corner radius, spacing, type scale. Every screen is built on it, so
   the screens look like one product.
3. For each screen: `POST /api/design {kind:"screen"}` with the idea (last
   "prompt" in the feed), the merge paragraph (stage 1's `resolution`), the
   style guide (as CSS variables), the wireframe's boxes (types from stage 1's
   last answer when names match; else box text only), the other screen names,
   and the instruction (Regenerate only) → one self-contained HTML page.
4. The page is saved in the room's `designs` map and a design shape is put
   on the canvas below its wireframe. The feed says "Agent designed Home".
   One failed screen doesn't stop the others.
- Pause: no new call starts; a design that finishes while paused waits in the
  browser until Resume. Take over: the call in flight is cancelled in the
  browser, and nothing more is saved or drawn.
- Regenerate reuses the design's saved style guide + wireframe, and overwrites
  the same design id, so its canvas shape updates in every window.

## Files
| File | Role |
|---|---|
| `app/api/design/route.ts` | POST /api/design: one AI call (style or one screen), checks the answer |
| `lib/agent-design.ts` | Formats, prompts, style-guide check, HTML safety check, orange check, mock samples |
| `lib/agent-design-room.ts` | Browser side: `useDesignPanel` → `makeReal()`, `regenerate()` |
| `lib/design-shape.tsx` | tldraw "design" shape: sandboxed iframe, orange outline; `placeDesign`, `designIdFor`, `selectedDesign` |
| `lib/agent-brains.ts` | Shared provider code. Now takes a "job" (instructions + JSON format); stage 1 uses the default job. `pickBrain()` = whose key |
| `lib/rate-limit.ts` | Design calls count 1 each against the room's 50/day, with no cooldown |
| `lib/agent-room-types.ts` / `liveblocks.config.ts` | `DesignRecord`, Storage `designs: LiveMap` |
| `TldrawApp.tsx` / `AgentPanel.tsx` | Wiring: shape registered, `handleMakeReal`, the "Make it real" section |
| `lib/agent-design.check.ts` | Self-check: safety rules, orange rule, mock |

## Request / response
- `{kind:"style", roomId, idea, resolution, screens:[names], aiKey?}` → `{styleGuide, providerLabel, usedOwnKey}`
- `{kind:"screen", roomId, idea, resolution, styleGuide, screen:{name, components:[{type,label,notes?}]}, otherScreens, instruction?, aiKey?}` → `{html, providerLabel, usedOwnKey}`
- Errors → `{error: "plain sentence"}`. No sign-in check on this route (the
  room's rate limit guards it).

## Safety (designs are AI-written HTML)
- Server (`checkDesignHtml`): ≤ 60 KB; strips `<script>`, `on*=` handlers,
  `<iframe>/<object>/<embed>/<link>/<base>/<frame>`, `<meta http-equiv>`,
  `<form>` tags; then REJECTS if any remain, or any outside address in
  src/href/srcset/url()/@import, `javascript:`, or no `<html>/<body>`.
- Orange is AI-only in this app: style guides and page CSS (hex, rgb, hsl,
  color names, SVG fill/stroke) in the orange band (hue 15-45°) are rejected.
- Browser (`design-shape.tsx`): checks the page AGAIN (anyone can edit room
  Storage), then shows it in `<iframe sandbox="">` via `srcdoc` (no scripts,
  no same-origin, no navigation) with a CSP meta added that blocks ALL network
  loading. The iframe ignores the mouse, so the canvas drags it like a shape.
- Keys: only ever in the request (own key, one call) or `.env.local`. Never in
  room storage, presence, events, or the HTML.

## Where designs are stored, and limits
- NOT in the Yjs canvas (Yjs keeps history: deleted designs would still
  count, and rooms would fill up). The canvas shape holds only the design id.
- In Liveblocks Storage `designs` map (current state only: deleting frees
  space). Newest `MAX_SAVED_DESIGNS` = 12 per room are kept (about 1 MB of
  Storage per room on the free plan; designs are ~20-60 KB). An evicted
  design's shape says so; make it real again.
- Cost: a run of N screens = N + 1 AI calls (Regenerate = 1), each counted
  against the room's 50/day on the built-in key. Each screen takes ~10-60 s.

## Mock (testing without AI)
`AGENT_PROVIDER=mock` (ignored in production): fixed indigo style guide and a
sample page built from the wireframe's own boxes, ~1.2 s per screen, no rate
limit. Start with `AGENT_PROVIDER=mock npm run dev`.

## Known issues / next
- Without Supabase settings, `lib/auth.ts` crashes on load ("supabaseUrl is
  required"): `npm run build` fails on /agent-test, and rooms may not open in
  dev. Stage 1 also needs sign-in (401 "Please sign in" otherwise).
- Stage 1 ported fixes NOT on this branch (were on `agent-layer`): stuck-run
  timeout, agent-tagged frames, zoom once, visible orange frame outline.
- Ideas: export a design as HTML/PNG; a stream for designs (show the page
  as it's written); let designs follow hand edits to the wireframe.
