# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small product teams (a PM, a designer and a developer) planning a feature
together on one shared board. Each person drops their own "prompt notes"
with what they want; the notes often disagree. They work on laptops and
desktops, often at the same time in the same room (a Liveblocks room).

The owner (papi) is not a programmer, and the people using it are often
not technical either (PMs, founders).

## Product Purpose

A real-time shared canvas where an AI agent reads ALL the notes on the
board together, resolves the conflicts between them, explains how it merged
them, and draws phone-sized wireframes live on the canvas for everyone at
once. "Make it real" then turns a wireframe into a finished-looking design.

Success: a team leaves the board with one agreed set of screens, and every
person can see why each decision was made. Being built for a Y Combinator
application ("Multiplayer AI").

## Positioning

**Everybody has the context, not just the AI.** The shared history (the
activity feed of who asked for what, and the permanent decision log of how
each clash was settled, by the agent or by a person's pick) is the core of
the product, not a side panel. Anyone joining a board late can see what
was asked, what was decided, and why.

Positioning line: "Three teams. One canvas. One answer."

## Operating Context

- Rooms: `/room/<id>`, one board per room, listed under `/boards`.
- Sign-in: Supabase accounts. Name, role and color are chosen per person.
- People write prompt notes on the canvas or type an idea in the agent
  panel; "Use canvas notes" sends the whole board to the agent.
- The agent can add screens, update existing ones, or ask the room a
  question. People can pause it, take over, undo its last run, or pick one
  person's version of a clash instead of the agent's merge.
- AI provider: Google Gemini free tier by default; Claude and OpenAI also
  supported. People can bring their own key (kept only in their browser).

## Capabilities and Constraints

- Desktop and laptop only for now. **No phone / mobile layout work** until
  papi says otherwise.
- Next.js 16, React 19, Tailwind v4, tldraw 3 (canvas), Liveblocks (sync,
  presence, shared agent state), Supabase (auth, saved boards, decisions).
- Never put an API key in Liveblocks presence, storage or events (all room
  members can see them). Keys only in `.env.local`, never `NEXT_PUBLIC_`.
- The agent's JSON is validated before anything is drawn; failures show a
  friendly error.
- Before a paid launch: tldraw licence (watermark), Liveblocks paid plan
  (badge), and a commercial licence or replacement for the Bulzing font.
- Open: pricing and plans are not decided.

## Brand Commitments

- Name: Wireframe Studio. Logo: papi's triangle mark in the wine palette.
- **Wine = people, orange = the AI only.** Orange is never used for
  anything a person does.
- Second message: "Everybody has the context, not just the AI."
- **Plain language everywhere.** Copy must be readable by non-technical
  people (PMs, founders): no jargon, short sentences.

## Evidence on Hand

- A working live product (https://wireframe-studio-theta.vercel.app) and an
  offline demo (`public/demo/index.html`).
- No customers, testimonials, logos, usage numbers or press yet. Never
  invent them, and never show fake stats or made-up model versions.

## Product Principles

1. Shared context first: every person must be able to see what was asked,
   what the agent did, and why, without asking a teammate.
2. The AI is a visible teammate, never a hidden one: its work is always
   labelled, colored orange, and can be paused, taken over or undone.
3. People stay in charge: a person's pick beats the agent's merge, and
   nothing the agent does is permanent.
4. Plain words over clever ones.

## Accessibility & Inclusion

No product-specific requirement set yet. Current practice: WCAG AA contrast,
visible keyboard focus, labelled controls, and a calm version for people
who turn on "reduce motion".
