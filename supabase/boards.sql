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

-- Who opened a board, by name (shown on /boards as "With Alice, Bob").
alter table public.board_visits add column user_name text check (char_length(user_name) <= 80);

-- Roles per board (Owner / Editor / Viewer). New visitors join as viewer.
-- Applied 2026-10-15: everyone who had already opened a board became editor,
-- each board's creator became owner.
alter table public.board_visits add column role text not null default 'viewer' check (role in ('owner','editor','viewer'));
update public.board_visits set role = 'editor';
update public.board_visits v set role = 'owner' from public.boards b where b.id = v.board_id and b.created_by = v.user_id;

-- ── ONE OWNER PER BOARD (2026-10-15) ────────────────────────────────────────
-- Boards could end up with several owners: the role dropdown let an owner
-- make others owner, and two people opening a board at the same moment could
-- both be made owner. From now on the database allows exactly one owner per
-- board; handing it over is one atomic step (the old owner becomes editor).
--
-- 1. Clean up: keep ONE owner per board. Preference: a real (signed-in)
--    account over an old "user-…" browser identity, then the board's creator,
--    then whoever has been away longest (opened it earliest). The others
--    become editors.
with ranked as (
  select v.board_id, v.user_id,
    row_number() over (
      partition by v.board_id
      order by (v.user_id like 'user-%') asc, (v.user_id = b.created_by) desc, v.last_opened_at asc, v.user_id asc
    ) as n
  from public.board_visits v join public.boards b on b.id = v.board_id
  where v.role = 'owner'
)
update public.board_visits v set role = 'editor'
from ranked r
where r.board_id = v.board_id and r.user_id = v.user_id and r.n > 1;

-- 2. The rule itself: at most one 'owner' row per board.
create unique index board_visits_one_owner on public.board_visits (board_id) where role = 'owner';

-- 3. Hand the board to another member: the current owner becomes editor.
--    Returns false (and changes nothing) if p_from isn't the owner or p_to
--    hasn't opened the board.
create function public.transfer_board_owner(p_board text, p_from text, p_to text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from board_visits where board_id = p_board and user_id = p_to) then
    return false;
  end if;
  update board_visits set role = 'editor' where board_id = p_board and user_id = p_from and role = 'owner';
  if not found then return false; end if;
  update board_visits set role = 'owner' where board_id = p_board and user_id = p_to;
  return true;
end;
$$;

-- 4. Owner for a board that has no real owner yet (new board, or an old
--    board owned only by a "user-…" browser identity). If two people try at
--    the same moment, the unique index lets exactly one win; the other
--    stays as they were and gets false.
create function public.claim_board_owner(p_board text, p_user text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from board_visits where board_id = p_board and role = 'owner' and user_id not like 'user-%') then
    return false;
  end if;
  update board_visits set role = 'editor' where board_id = p_board and role = 'owner'; -- an old identity steps aside
  update board_visits set role = 'owner' where board_id = p_board and user_id = p_user;
  return found;
exception when unique_violation then
  return false;
end;
$$;

revoke all on function public.transfer_board_owner(text, text, text) from public, anon, authenticated;
revoke all on function public.claim_board_owner(text, text) from public, anon, authenticated;
grant execute on function public.transfer_board_owner(text, text, text) to service_role;
grant execute on function public.claim_board_owner(text, text) to service_role;

-- ── CONTRIBUTOR ROLE (2026-10-16) ───────────────────────────────────────────
-- A fourth role between editor and viewer: contributors draw, add notes and
-- pick clash winners, but can't run the AI (agent, Make it real), so the
-- AI limits stay with the people driving the design. Nothing else changes:
-- existing roles stay as they are, and new visitors still join as viewers.
-- (Drops the old role check by looking it up, whatever its name.)
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.board_visits'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%role%'
  loop
    execute format('alter table public.board_visits drop constraint %I', c);
  end loop;
end $$;
alter table public.board_visits add constraint board_visits_role_check
  check (role in ('owner', 'editor', 'contributor', 'viewer'));
