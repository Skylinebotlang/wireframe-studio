-- ─────────────────────────────────────────────────────────────────────────────
-- DECISION LOG — every design decision made on a board, kept forever.
--
--   kind 'merge' → the agent resolved a clash between teammates' notes
--   kind 'pick'  → a person chose one teammate's version on a clash card
--
-- Written only by our server (app/api/agent records merges, app/api/
-- decisions records picks). The agent reads the latest ones before each run
-- so it doesn't undo what the team already agreed. RLS on, no browser
-- access; the server's secret key acts as service_role. Applied once to the
-- Supabase project; kept here as a record. (Needs boards.sql first.)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.boards (id) on delete cascade,
  kind text not null check (kind in ('merge', 'pick')),
  summary text not null check (char_length(summary) between 1 and 500),   -- what clashed
  decision text not null check (char_length(decision) between 1 and 1000), -- what was decided
  decided_by text not null check (char_length(decided_by) between 1 and 80), -- "Agent" or a person's name
  user_id text,             -- account that started the run / made the pick
  screens text[] not null default '{}', -- screens the decision shaped
  run_id text,
  created_at timestamptz not null default now()
);

create index decisions_board_recent on public.decisions (board_id, created_at desc);

alter table public.decisions enable row level security;
-- Decisions are a record: the server may add and read them, never edit them.
grant select, insert on public.decisions to service_role;
