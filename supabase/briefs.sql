-- ─────────────────────────────────────────────────────────────────────────────
-- DESIGN BRIEF — what the team wants its product to look like, one per board.
--
--   doc    the design document: brand, tone, rules, in the team's own words
--   dos    short rules every design must follow ("always a back button")
--   donts  short rules every design must avoid ("no gradients")
--
-- "Make it real" (app/api/design) reads it before every design call. Only
-- the owner and editors change it (app/api/boards/brief checks the role);
-- anyone on the board may read it. Written only by our server: RLS on, no
-- browser access; the server's secret key acts as service_role. Applied
-- once to the Supabase project; kept here as a record. (Needs boards.sql.)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.board_briefs (
  board_id text primary key references public.boards (id) on delete cascade,
  doc text not null default '' check (char_length(doc) <= 8000),
  dos text[] not null default '{}' check (cardinality(dos) <= 12),
  donts text[] not null default '{}' check (cardinality(donts) <= 12),
  updated_by_name text not null default '' check (char_length(updated_by_name) <= 80),
  updated_at timestamptz not null default now()
);

alter table public.board_briefs enable row level security;
grant select, insert, update on public.board_briefs to service_role;

-- ── Added for brand basics, the locked style and pictures (2026-11-03) ──────
--   brand_color   main colour "#rrggbb" ('' = none). REPLACED by brand_colors (below)
--   brand_font    sans / serif / rounded / mono ('' = none)
--   locked_style  a style guide the team locked (Make it real reuses it)
alter table public.board_briefs
  add column brand_color text not null default '' check (brand_color = '' or brand_color ~ '^#[0-9a-f]{6}$'),
  add column brand_font text not null default '' check (brand_font in ('', 'sans', 'serif', 'rounded', 'mono')),
  add column locked_style jsonb;

-- The logo and reference pictures, shrunk in the browser first (JPEG/PNG as
-- base64, ~100 KB each). At most 5 references + 1 logo per board (the
-- server checks). ponytail: kept in the table, not Storage; move to a
-- Storage bucket if pictures ever get big or many.
create table public.board_images (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.boards (id) on delete cascade,
  kind text not null check (kind in ('logo', 'reference')),
  note text not null default '' check (char_length(note) <= 200),
  mime text not null check (mime in ('image/jpeg', 'image/png')),
  data text not null check (char_length(data) <= 300000),
  created_at timestamptz not null default now()
);
create index board_images_board on public.board_images (board_id, created_at);
alter table public.board_images enable row level security;
grant select, insert, update, delete on public.board_images to service_role;

-- ── Full colour palette instead of one main colour (2026-11-04) ─────────────
--   brand_colors  { "primary": "#…", "background": "#…", … }: any of the 8
--                 style guide slots (lib/design/brief.ts PALETTE); the
--                 server checks each value. Replaces brand_color.
alter table public.board_briefs add column brand_colors jsonb not null default '{}'::jsonb;
update public.board_briefs set brand_colors = jsonb_build_object('primary', brand_color) where brand_color <> '';
alter table public.board_briefs drop column brand_color;
