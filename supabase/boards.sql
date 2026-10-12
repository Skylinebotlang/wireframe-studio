-- ─────────────────────────────────────────────────────────────────────────────
-- SAVED BOARDS — the two tables behind the /boards page.
--
-- A "board" is a Liveblocks room (the canvas itself stays in Liveblocks).
-- Supabase only keeps the list: each board's name, who made it, and who has
-- opened it, so everyone sees "my boards".
--
-- Row Level Security is ON with no policies: nobody can read or write these
-- tables from a browser. Only our server (app/api/boards) can, with the
-- secret key. Applied once to the Supabase project; kept here as a record.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.boards (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'), -- the room id
  name text not null check (char_length(name) between 1 and 80),
  created_by text not null,  -- identity id from lib/user.ts (until real logins)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now() -- last opened by anyone
);

create table public.board_visits (
  board_id text not null references public.boards (id) on delete cascade,
  user_id text not null,
  last_opened_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- "My boards, most recent first".
create index board_visits_user_recent on public.board_visits (user_id, last_opened_at desc);

alter table public.boards enable row level security;
alter table public.board_visits enable row level security;

-- New Supabase projects don't grant table access automatically. Give it to
-- the server's role ONLY (the sb_secret_ key acts as service_role); the
-- browser roles (anon, authenticated) get nothing.
grant select, insert, update, delete on public.boards to service_role;
grant select, insert, update, delete on public.board_visits to service_role;
