-- ─────────────────────────────────────────────────────────────────────────────
-- PER-PERSON DAILY LIMIT — agent runs per account per day (UTC), on the app's
-- own AI key. Used by lib/user-limit.ts. Applied once; kept as a record.
-- Server only: RLS on, functions executable by service_role only.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.agent_usage (
  user_id text not null,
  day date not null,
  runs integer not null default 0 check (runs >= 0),
  primary key (user_id, day)
);
alter table public.agent_usage enable row level security;
grant select, insert, update on public.agent_usage to service_role;

-- Add one run for this person today, unless they're at the limit.
-- Atomic: returns true if the run may go ahead, false if the limit is reached.
create function public.claim_agent_run(p_user text, p_limit integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  ok integer;
begin
  insert into agent_usage (user_id, day, runs)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set runs = agent_usage.runs + 1
    where agent_usage.runs < p_limit
  returning 1 into ok;
  return ok is not null;
end;
$$;

-- Give a run back (the AI failed).
create function public.refund_agent_run(p_user text)
returns void
language sql
set search_path = public
as $$
  update agent_usage set runs = greatest(runs - 1, 0)
  where user_id = p_user and day = (now() at time zone 'utc')::date;
$$;

revoke all on function public.claim_agent_run(text, integer) from public, anon, authenticated;
revoke all on function public.refund_agent_run(text) from public, anon, authenticated;
grant execute on function public.claim_agent_run(text, integer) to service_role;
grant execute on function public.refund_agent_run(text) to service_role;
