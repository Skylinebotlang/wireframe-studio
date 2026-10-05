# Wireframe Studio

A real-time shared canvas where a team (PMs, designers, developers) drops
"prompt notes", and an AI agent reads all the notes together, resolves the
conflicts between them, explains how it merged them, and draws phone-sized
wireframes live on the canvas for everyone at once.

Live site: https://wireframe-studio-theta.vercel.app

## Run it on your computer

```bash
npm install      # first time only
npm run dev      # opens at http://localhost:3000
npm run build    # production build check (what Vercel runs)
npm run lint
```

## Keys

Copy `.env.local.example` to `.env.local` and fill in your keys. The file
explains where to get each one.

- `LIVEBLOCKS_SECRET_KEY` (required)
- `GEMINI_API_KEY` (the default free AI agent)
- `ANTHROPIC_API_KEY` + `AGENT_PROVIDER=anthropic` (optional, to use Claude)

`.env.local` is never committed to Git.

## Folders

| Folder | What is in it |
|---|---|
| `app/` | The pages: landing page, login, the shared canvas room, and the API routes |
| `app/room/[roomId]/` | The shared canvas room: canvas, agent panel, live sync |
| `app/api/` | Server routes: the AI agent and Liveblocks sign-in |
| `app/fonts/` | Local fonts (Bulzing is non-commercial: replace or license before launch) |
| `lib/` | The logic: agent calls, JSON checks, drawing wireframes, theme colors |
| `public/` | Logos and images |

## Stack

Next.js, TypeScript, Tailwind CSS, tldraw (canvas), Liveblocks + Yjs
(real-time sync), Google Gemini by default (Claude and OpenAI supported),
three.js (3D logo). Deployed on Vercel.
