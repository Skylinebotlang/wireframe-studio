# Launch site v2 — brief (from the /launch-site interview, 2026-10-15)

## Product (do not change)
- Wireframe Studio: one live multiplayer canvas. Everyone prompts, the AI reads ALL
  the notes, finds clashes, merges them, explains how, and draws wireframes live
  for everyone. Live cursors, activity feed, decision log, pause / take over / undo,
  "Make it real", bring your own Gemini / Claude / OpenAI key or the free AI.
- Problem: PMs, designers and builders each want different things for the same
  screens, and nobody sees the others' requests until the end.

## Message
- Headline: "Everybody has the context, not just the AI."
- Second line: "Three teams. One canvas. One answer."
- Button: "Start the chat" -> choice of Sign in (/login) or Sign up (/signup).

## Audience
- Product teams (PM, designer, dev) and hackathon teams. Laptop first (1440 px),
  phone must work (390 px).

## Existing site
- REBUILD FROM SCRATCH on git branch `launch-site-v2`. Current site and live site
  untouched. Nothing pushed or deployed until the owner says "deploy".

## Brand (hard)
- Colours exactly: navies #090719 #131224 #191A2F, text #F8F4F5,
  wine #681E2E = people, orange #FF6B2C = the AI only. No other colours.
- Fonts: Inter Tight (display / big type), IBM Plex Sans (body),
  IBM Plex Mono (labels, prompts, cursor names). Bulzing dropped (licence).
- Logo: public/logo-2d.png, app/icon.png exactly as given.
- No invented stats, testimonials, customer logos or ratings.

## Loader / first component = the 3D AI character
- The AI agent as a small orange-glowing 3D figure, built in code (Three.js).
- Eyes / head follow the cursor. It draws the first frame, which becomes the hero.
- Replaces the old drag-the-3D-logo splash.

## Chapters after the hero
1. The problem  2. How it works + live together
3. Try it live + bring your own AI  4. Start the chat (+ footer)

## Motion
- GSAP + ScrollTrigger + Lenis (already installed). Only transform, opacity,
  clip-path. prefers-reduced-motion = static, still beautiful version.

## Delivery
- Storyboard first, then: loader + first 8 s -> chapters -> Start the chat ->
  phone polish. After each: 1440 + 390, reduced motion on/off, npm run build,
  npm run lint, plain-words report, stop.
- Commits as Yadhush bansal <155626509+Skylinebotlang@users.noreply.github.com>.

## Decisions taken while building (2026-10-15, "build all")
- Clickable demo: reused public/demo/index.html (loads on click).
- "AI as teammate" chapter left out; clash merging shows in the hero and How it works.
- Wine is used for fills only (too dark for text on navy); white text on wine.
- 3D character uses the installed three@0.128 (no new packages).
- Old landing files (Splash, LogoCore3D, HeroIntro, Chapters, LiveCursors,
  SmoothScroll, StartChat, FluidCursor, SplashCursor, landing.css) are no longer
  used by "/" but are kept until the owner decides.
