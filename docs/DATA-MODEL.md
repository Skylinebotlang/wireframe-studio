# Wireframe Studio: where the data lives

A short map of every place the app stores something, what is in it, and who
can read it. Keep it up to date when you add a table or a storage field.

## 1. Supabase (Postgres + Auth). Kept forever

Server only: every table has row-level security ON and is granted to
`service_role` only. The browser never reads tables directly; it goes through
our `/api/*` routes, which check the sign-in first (`lib/auth-server.ts`).

| Table | One row per | Key columns | Used by |
|---|---|---|---|
| `auth.users` (Supabase Auth) | account | email, password hash, `user_metadata.name` | sign-up / sign-in / forgot password (`lib/auth.ts`, `app/AccountForm.tsx`, `app/forgot-password`, `app/reset-password`) |
| `boards` | board (= Liveblocks room) | `id` (room id), `name`, `created_by` (account id), `updated_at` | `/boards` list, delete (creator only). `lib/boards-db.ts` |
| `board_visits` | person × board | `board_id`, `user_id`, `user_name`, `last_opened_at` | "my boards, most recent first", "With Alice, Bob". Deleted with the board (cascade) |
| `decisions` | design decision | `board_id`, `kind` (merge / pick), `summary`, `decision`, `decided_by`, `screens` | Decision log tab. `lib/decisions-db.ts`. Deleted with the board (cascade) |
| `agent_usage` | person × day (UTC) | `user_id`, `day`, `runs` | per-person daily limit (50). Functions `claim_agent_run` / `refund_agent_run`. `lib/user-limit.ts` |

SQL for each table: `supabase/*.sql` (already applied; kept as a record).

## 2. Liveblocks. Live, shared by everyone in a board

Everything here is visible to **every person in the room**. Never put an API
key or anything private in it.

**Canvas (Yjs document)**: every shape: wireframe phone frames and boxes,
prompt notes, sticky notes, design cards (only their id; the HTML lives in
Storage), drawings. Synced by `app/room/[roomId]/useYjsStore.ts`.

**Presence (Yjs awareness, not saved)**: each person's cursor, selection,
name and cursor colour.

**Storage** (types in `liveblocks.config.ts`, logic in `lib/agent-room.ts`
and `lib/agent-design-room.ts`):

| Field | What | Size limit |
|---|---|---|
| `agentRun` | the current / last agent run: status, plan steps, who started it, result, error | one |
| `activity` | the activity feed lines | newest 100 |
| `agentUndo` | what the last run drew, for "Undo last run" | one |
| `designs` | "Make it real" HTML mockups by design id | newest 12 |
| `colors` | each person's cursor colour by name, for the feed and decision log | one per person |

**Room metadata (server-written only)**: the per-room limit:
`agentLastRunAt` (10 s cooldown) and `agentRuns` (50 per day).
`lib/rate-limit.ts`.

## 3. The person's own browser (localStorage). Never leaves their computer

| Key | What |
|---|---|
| `wireframe-studio-identity` | name, role, cursor colour picked on "Who's drawing?" (`lib/user.ts`) |
| `wireframe-studio-ai-key` | their own AI key, if they added one. Sent to our server for one request, then forgotten (`lib/byok.ts`) |
| `sb-…-auth-token` | the Supabase sign-in session (managed by Supabase) |

## 4. Server settings (Vercel environment variables / `.env.local`)

Secret keys: Liveblocks secret, Supabase secret, the app's AI keys. Server only;
never `NEXT_PUBLIC_`, never in code. The only public ones are the Supabase URL
and publishable key (they can sign people in, not read tables).

## Deleting a board

`DELETE /api/boards` (creator only) removes the `boards` row, which also
removes its `board_visits` and `decisions` (cascade), then deletes the
Liveblocks room (canvas, Storage, metadata).
