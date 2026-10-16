-- Four-digit join codes: a player already holding the Home Screen app types the
-- next tournament's code instead of installing it again. See
-- docs/adr/0005-four-digit-join-codes.md.
--
-- A code is live from creation until 24 hours after the tournament finishes.
-- After that it may be handed to a new tournament; the old one keeps working
-- through its full link. Codes are guessable by design, so lookups are
-- throttled per client.

-- ---------------------------------------------------------------------------
-- Column and allocation
-- ---------------------------------------------------------------------------

alter table public.tournaments add column join_code text check (join_code ~ '^[1-9][0-9]{3}$');

-- A code is cleared from its previous holder before it is handed on, so a plain
-- unique index is enough: no two tournaments ever carry the same code at once.
create unique index tournaments_join_code on public.tournaments (join_code);

create or replace function public.join_code_is_live(p_finished_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_finished_at is null or p_finished_at > now() - interval '24 hours';
$$;

-- No leading zero: "0482" is too easily typed as "482".
create or replace function public.allocate_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  -- Two tournaments created at the same moment must not draw the same code.
  perform pg_advisory_xact_lock(hashtext('public.allocate_join_code'));

  select code into v_code
  from (select g::text as code from generate_series(1000, 9999) g) codes
  where not exists (
    select 1 from public.tournaments t
    where t.join_code = codes.code and public.join_code_is_live(t.finished_at)
  )
  order by random()
  limit 1;

  if v_code is null then
    raise exception 'no free join code' using errcode = 'P0001';
  end if;

  -- Take it off whichever long-finished tournament still carries it.
  update public.tournaments set join_code = null where join_code = v_code;

  return v_code;
end;
$$;

-- On creation, and on reopening a tournament whose code has meanwhile gone to
-- someone else.
create or replace function public.assign_join_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.join_code := public.allocate_join_code();
  elsif new.join_code is null and new.finished_at is null then
    new.join_code := public.allocate_join_code();
  end if;
  return new;
end;
$$;

create trigger tournaments_join_code_on_create
  before insert on public.tournaments
  for each row execute function public.assign_join_code();

create trigger tournaments_join_code_on_reopen
  before update of finished_at on public.tournaments
  for each row
  when (old.finished_at is not null and new.finished_at is null)
  execute function public.assign_join_code();

-- Existing tournaments that are still live get a code now; older ones never
-- need one.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.tournaments
    where join_code is null and public.join_code_is_live(finished_at)
    order by created_at
  loop
    update public.tournaments set join_code = public.allocate_join_code() where id = v_id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lookup, throttled
-- ---------------------------------------------------------------------------

-- Failed lookups only, keyed on a hash of the client address: enough to slow a
-- script walking all 9 000 codes, without keeping anyone's IP.
create table public.join_code_misses (
  client_hash text not null,
  missed_at   timestamptz not null default now()
);

create index join_code_misses_client on public.join_code_misses (client_hash, missed_at);

alter table public.join_code_misses enable row level security;
revoke all on public.join_code_misses from anon, authenticated;

-- Returns the tournament's slug, or null when no live tournament has the code.
create or replace function public.resolve_join_code(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_client  text;
  v_slug    text;
begin
  v_client := encode(digest(coalesce(
    v_headers ->> 'cf-connecting-ip',
    btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)),
    'unknown'
  ), 'sha256'), 'hex');

  -- 20 wrong codes in 10 minutes is far past any typo.
  if (select count(*) from public.join_code_misses
      where client_hash = v_client and missed_at > now() - interval '10 minutes') >= 20 then
    raise exception 'too many attempts' using errcode = '54000';
  end if;

  select t.slug into v_slug
  from public.tournaments t
  where t.join_code = btrim(p_code) and public.join_code_is_live(t.finished_at);

  if v_slug is null then
    delete from public.join_code_misses where missed_at < now() - interval '1 hour';
    insert into public.join_code_misses (client_hash) values (v_client);
  end if;

  return v_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.join_code_is_live(timestamptz) from public, anon, authenticated;
revoke all on function public.allocate_join_code() from public, anon, authenticated;
revoke all on function public.assign_join_code() from public, anon, authenticated;
revoke all on function public.resolve_join_code(text) from public, anon, authenticated;

grant execute on function public.resolve_join_code(text) to anon, authenticated;
-- The tournaments triggers run as the organiser creating or reopening one.
grant execute on function public.allocate_join_code() to authenticated;
