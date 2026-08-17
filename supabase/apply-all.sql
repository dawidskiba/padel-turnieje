-- ---------------------------------------------------------------------------
-- Garden Padel — full schema, for pasting into the Supabase SQL editor.
--
-- Generated from supabase/migrations/. Use this when the CLI is not to hand:
-- it applies every migration and then records them in the same table
-- `supabase db push` uses, so a later push sees them as already applied
-- instead of trying to run them again.
--
-- Safe to run once on an empty project. Running it twice will fail on the
-- first `create type` — that is the intended protection, not a bug.
-- ---------------------------------------------------------------------------

begin;

-- The CLI creates this itself on first push; we need it up front so the
-- history rows at the bottom have somewhere to go.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

-- ===========================================================================
-- 20260817000000_initial_schema.sql
-- ===========================================================================

-- Initial schema for padel tournaments.
--
-- See docs/schema.md for the reasoning behind these choices, and
-- docs/requirements-americano.md / docs/requirements-mexicano.md for the rules
-- this structure has to support.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.tournament_format as enum ('americano', 'mexicano');
create type public.team_format as enum ('individual', 'teams');
create type public.pairing_formula as enum ('1+4v2+3', '1+2v3+4', '1+3v2+4');
create type public.match_side as enum ('a', 'b');

-- 'credited' earns rest points exactly like 'resting', but must never count
-- towards the rest rota: a participant who joined late would otherwise look
-- like the most-rested player and be scheduled to play every remaining round.
create type public.round_participant_status as enum ('playing', 'resting', 'credited');

-- ---------------------------------------------------------------------------
-- Public slug
-- ---------------------------------------------------------------------------

-- 10 characters from a 31-symbol alphabet with no visually ambiguous glyphs
-- (no 0/o, 1/l/i). ~49 bits of entropy: unguessable, but short enough to read
-- aloud at the desk. Cryptographic randomness, not random().
create or replace function public.generate_slug()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  bytes bytea := gen_random_bytes(10);
  result text := '';
  i int;
begin
  for i in 0..9 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.tournaments (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  slug            text not null unique default public.generate_slug(),
  name            text not null check (length(btrim(name)) > 0),
  format          public.tournament_format not null,
  team_format     public.team_format not null,
  game_points     int not null check (game_points between 1 and 99),
  rest_points     int not null check (rest_points >= 0),
  pairing_formula public.pairing_formula,
  created_at      timestamptz not null default now(),
  finished_at     timestamptz,

  -- The pairing formula only means something when four individuals share a
  -- court and have to be split into two sides.
  constraint pairing_formula_only_for_mexicano_individual check (
    pairing_formula is null
    or (format = 'mexicano' and team_format = 'individual')
  )
);

comment on column public.tournaments.finished_at is
  'Tournament state is derived: no rounds = setup, finished_at set = finished, otherwise running.';

create table public.courts (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid not null references public.tournaments (id) on delete cascade,
  name               text not null check (length(btrim(name)) > 0),
  position           int not null,
  -- Soft removal: past matches keep a real foreign key to a real court, and a
  -- rained-out court can come back.
  removed_from_round int check (removed_from_round >= 1)
);

create unique index courts_unique_name on public.courts (tournament_id, lower(name));
create index courts_tournament on public.courts (tournament_id, position);

create table public.participants (
  id                  uuid primary key default gen_random_uuid(),
  tournament_id       uuid not null references public.tournaments (id) on delete cascade,
  name                text not null check (length(btrim(name)) > 0),
  -- Final tie-break, and what keeps the rest rota and the Mexicano ladder
  -- deterministic rather than dependent on row order.
  entry_order         int not null,
  joined_round        int not null default 1 check (joined_round >= 1),
  retired_after_round int check (retired_after_round >= 1),
  -- Mexicano round-1 pinning. Side is optional: pinning only a court still
  -- allows two pinned players to come out as partners.
  seed_court_id       uuid references public.courts (id) on delete set null,
  seed_side           public.match_side
);

create unique index participants_unique_name on public.participants (tournament_id, lower(name));
create unique index participants_unique_order on public.participants (tournament_id, entry_order);

create table public.rounds (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  number        int not null check (number >= 1),
  is_final      boolean not null default false,
  created_at    timestamptz not null default now(),

  -- Makes a retried "next round" on flaky wifi raise a unique violation
  -- instead of creating a second round five.
  unique (tournament_id, number)
);

create index rounds_current on public.rounds (tournament_id, number desc);

create table public.matches (
  id       uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  court_id uuid not null references public.courts (id),
  score_a  int check (score_a >= 0),
  score_b  int check (score_b >= 0),

  unique (round_id, court_id),

  -- Either both scores are in, or neither is.
  constraint scores_entered_together check ((score_a is null) = (score_b is null))
);

create index matches_round on public.matches (round_id);

comment on constraint scores_entered_together on public.matches is
  'score_a + score_b = game_points is enforced by the application: game points live on
   another table, so a CHECK cannot reach them.';

create table public.match_participants (
  match_id       uuid not null references public.matches (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  side           public.match_side not null,

  primary key (match_id, participant_id)
);

-- Partner and opponent history is read every round by the pairing rules.
create index match_participants_participant on public.match_participants (participant_id);

create table public.round_participants (
  round_id       uuid not null references public.rounds (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  status         public.round_participant_status not null,

  primary key (round_id, participant_id)
);

-- Rest counts driving the rota.
create index round_participants_participant on public.round_participants (participant_id, status);

-- ---------------------------------------------------------------------------
-- Locked settings
-- ---------------------------------------------------------------------------

-- Scoring, format and team format freeze once the first round exists: changing
-- them would make already-recorded matches incomparable. Name, roster and
-- courts stay editable.
create or replace function public.enforce_locked_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.rounds where tournament_id = old.id) then
    if new.format          is distinct from old.format
    or new.team_format     is distinct from old.team_format
    or new.game_points     is distinct from old.game_points
    or new.rest_points     is distinct from old.rest_points
    or new.pairing_formula is distinct from old.pairing_formula then
      raise exception 'scoring settings are locked once the first round is generated'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger tournaments_locked_settings
  before update on public.tournaments
  for each row execute function public.enforce_locked_settings();

-- ---------------------------------------------------------------------------
-- Derived standings
-- ---------------------------------------------------------------------------

-- One row per participant per round they took part in, however they took part.
--
-- A rested round contributes rest points to BOTH scored and conceded, so its
-- contribution to point difference is zero. Crediting the points to "scored"
-- alone would hand every resting participant a large positive difference and
-- distort the tie-break that difference exists to settle.
create view public.participant_round_points
with (security_invoker = true)
as
  select
    rp.round_id,
    r.tournament_id,
    rp.participant_id,
    rp.status,
    (case mp.side when 'a' then m.score_a else m.score_b end) as scored,
    (case mp.side when 'a' then m.score_b else m.score_a end) as conceded
  from public.round_participants rp
    join public.rounds r on r.id = rp.round_id
    join public.match_participants mp on mp.participant_id = rp.participant_id
    join public.matches m on m.id = mp.match_id and m.round_id = rp.round_id
  where rp.status = 'playing'
    and m.score_a is not null

  union all

  select
    rp.round_id,
    r.tournament_id,
    rp.participant_id,
    rp.status,
    t.rest_points,
    t.rest_points
  from public.round_participants rp
    join public.rounds r on r.id = rp.round_id
    join public.tournaments t on t.id = r.tournament_id
  where rp.status in ('resting', 'credited');

-- Never a stored column: a correction or an undone round is reflected the
-- instant it is written, with no invalidation step to forget.
create view public.standings
with (security_invoker = true)
as
  select
    p.tournament_id,
    p.id                                     as participant_id,
    p.name,
    p.entry_order,
    p.retired_after_round is not null        as retired,
    coalesce(sum(prp.scored), 0)::int        as points,
    coalesce(sum(prp.scored - prp.conceded), 0)::int as difference,
    count(*) filter (where prp.status = 'playing' and prp.scored > prp.conceded)::int as wins,
    count(*) filter (where prp.status = 'playing' and prp.scored = prp.conceded)::int as draws,
    count(*) filter (where prp.status = 'playing' and prp.scored < prp.conceded)::int as losses,
    -- 'credited' deliberately excluded: it is not a rest for rota purposes.
    count(*) filter (where prp.status = 'resting')::int as rests
  from public.participants p
    left join public.participant_round_points prp on prp.participant_id = p.id
  group by p.id;

comment on view public.standings is
  'Order by points desc, difference desc, wins desc, entry_order asc. Equal on the
   first three means a shared position.';

-- ---------------------------------------------------------------------------
-- Ownership helpers
-- ---------------------------------------------------------------------------

-- security definer so that policies on child tables do not re-enter RLS on
-- tournaments.

create or replace function public.owns_tournament(p_tournament uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tournaments t
    where t.id = p_tournament and t.owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_round(p_round uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rounds r
      join public.tournaments t on t.id = r.tournament_id
    where r.id = p_round and t.owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_match(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
      join public.rounds r on r.id = m.round_id
      join public.tournaments t on t.id = r.tournament_id
    where m.id = p_match and t.owner_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.tournaments        enable row level security;
alter table public.courts             enable row level security;
alter table public.participants       enable row level security;
alter table public.rounds             enable row level security;
alter table public.matches            enable row level security;
alter table public.match_participants enable row level security;
alter table public.round_participants enable row level security;

create policy tournaments_owner on public.tournaments
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy courts_owner on public.courts
  for all to authenticated
  using (public.owns_tournament(tournament_id))
  with check (public.owns_tournament(tournament_id));

create policy participants_owner on public.participants
  for all to authenticated
  using (public.owns_tournament(tournament_id))
  with check (public.owns_tournament(tournament_id));

create policy rounds_owner on public.rounds
  for all to authenticated
  using (public.owns_tournament(tournament_id))
  with check (public.owns_tournament(tournament_id));

create policy matches_owner on public.matches
  for all to authenticated
  using (public.owns_round(round_id))
  with check (public.owns_round(round_id));

create policy match_participants_owner on public.match_participants
  for all to authenticated
  using (public.owns_match(match_id))
  with check (public.owns_match(match_id));

create policy round_participants_owner on public.round_participants
  for all to authenticated
  using (public.owns_round(round_id))
  with check (public.owns_round(round_id));

-- ---------------------------------------------------------------------------
-- Writing a round
-- ---------------------------------------------------------------------------

-- The pairing algorithm runs in client TypeScript (ADR-0003) and hands the
-- finished proposal here, so that four tables' worth of inserts land in one
-- transaction. security invoker: the RLS policies above do the authorisation.
--
-- Expected shape:
--   {
--     "number": 5,
--     "is_final": false,
--     "matches": [
--       { "court_id": "uuid", "side_a": ["uuid", ...], "side_b": ["uuid", ...] }
--     ],
--     "resting": ["uuid", ...]
--   }
create or replace function public.create_round(p_tournament uuid, p_round jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_round_id     uuid;
  v_match        jsonb;
  v_match_id     uuid;
  v_participant  uuid;
  v_side         public.match_side;
begin
  if not public.owns_tournament(p_tournament) then
    raise exception 'not the owner of this tournament' using errcode = '42501';
  end if;

  if exists (select 1 from public.tournaments where id = p_tournament and finished_at is not null) then
    raise exception 'tournament is finished' using errcode = 'P0001';
  end if;

  insert into public.rounds (tournament_id, number, is_final)
  values (
    p_tournament,
    (p_round ->> 'number')::int,
    coalesce((p_round ->> 'is_final')::boolean, false)
  )
  returning id into v_round_id;

  for v_match in select * from jsonb_array_elements(coalesce(p_round -> 'matches', '[]'::jsonb))
  loop
    insert into public.matches (round_id, court_id)
    values (v_round_id, (v_match ->> 'court_id')::uuid)
    returning id into v_match_id;

    foreach v_side in array array['a', 'b']::public.match_side[]
    loop
      for v_participant in
        select (value #>> '{}')::uuid
        from jsonb_array_elements(coalesce(v_match -> ('side_' || v_side::text), '[]'::jsonb))
      loop
        insert into public.match_participants (match_id, participant_id, side)
        values (v_match_id, v_participant, v_side);

        insert into public.round_participants (round_id, participant_id, status)
        values (v_round_id, v_participant, 'playing');
      end loop;
    end loop;
  end loop;

  for v_participant in
    select (value #>> '{}')::uuid
    from jsonb_array_elements(coalesce(p_round -> 'resting', '[]'::jsonb))
  loop
    insert into public.round_participants (round_id, participant_id, status)
    values (v_round_id, v_participant, 'resting');
  end loop;

  -- Foreign keys cannot express "belongs to THIS tournament", so check it here.
  -- The function is atomic, so raising undoes every insert above.
  if exists (
    select 1
    from public.round_participants rp
      join public.participants p on p.id = rp.participant_id
    where rp.round_id = v_round_id and p.tournament_id <> p_tournament
  ) then
    raise exception 'participant belongs to a different tournament' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.matches m
      join public.courts c on c.id = m.court_id
    where m.round_id = v_round_id and c.tournament_id <> p_tournament
  ) then
    raise exception 'court belongs to a different tournament' using errcode = 'P0001';
  end if;

  return v_round_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public read path
-- ---------------------------------------------------------------------------

-- The entire anonymous API surface (ADR-0002). Anonymous roles have no table
-- access at all, so without the slug there is nothing to read. Everything a
-- viewer may see has to be added here deliberately.
create or replace function public.public_tournament(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'tournament', json_build_object(
      'name',        t.name,
      'format',      t.format,
      'team_format', t.team_format,
      'game_points', t.game_points,
      'rest_points', t.rest_points,
      'finished',    t.finished_at is not null
    ),
    'standings', coalesce((
      select json_agg(
        json_build_object(
          'name',       s.name,
          'points',     s.points,
          'difference', s.difference,
          'wins',       s.wins,
          'draws',      s.draws,
          'losses',     s.losses,
          'retired',    s.retired
        )
        order by s.points desc, s.difference desc, s.wins desc, s.entry_order
      )
      from public.standings s
      where s.tournament_id = t.id
    ), '[]'::json),
    'current_round', (
      select json_build_object(
        'number',   r.number,
        'is_final', r.is_final,
        'matches',  coalesce((
          select json_agg(json_build_object(
            'court',   c.name,
            'side_a',  (select json_agg(p.name order by p.entry_order)
                        from public.match_participants mp
                          join public.participants p on p.id = mp.participant_id
                        where mp.match_id = m.id and mp.side = 'a'),
            'side_b',  (select json_agg(p.name order by p.entry_order)
                        from public.match_participants mp
                          join public.participants p on p.id = mp.participant_id
                        where mp.match_id = m.id and mp.side = 'b'),
            'score_a', m.score_a,
            'score_b', m.score_b
          ) order by c.position)
          from public.matches m
            join public.courts c on c.id = m.court_id
          where m.round_id = r.id
        ), '[]'::json),
        'resting', coalesce((
          select json_agg(p.name order by p.entry_order)
          from public.round_participants rp
            join public.participants p on p.id = rp.participant_id
          where rp.round_id = r.id and rp.status = 'resting'
        ), '[]'::json)
      )
      from public.rounds r
      where r.tournament_id = t.id
      order by r.number desc
      limit 1
    )
  )
  from public.tournaments t
  where t.slug = p_slug;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Supabase grants broadly by default. Take it all back, then hand out exactly
-- what each role needs.
--
-- Revoking from PUBLIC matters as much as revoking from anon: PostgreSQL grants
-- EXECUTE on every new function to PUBLIC, so revoking from anon alone leaves
-- all of them callable by anonymous clients anyway.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select, insert, update, delete on
  public.tournaments,
  public.courts,
  public.participants,
  public.rounds,
  public.matches,
  public.match_participants,
  public.round_participants
to authenticated;

grant select on public.standings, public.participant_round_points to authenticated;

-- Needed by the tournaments column default and by the RLS policies above:
-- both are evaluated as the calling role.
grant execute on function public.generate_slug() to authenticated;
grant execute on function public.owns_tournament(uuid) to authenticated;
grant execute on function public.owns_round(uuid) to authenticated;
grant execute on function public.owns_match(uuid) to authenticated;

grant execute on function public.create_round(uuid, jsonb) to authenticated;

-- The only thing anonymous clients can do.
grant execute on function public.public_tournament(text) to anon, authenticated;


-- ===========================================================================
-- 20260817001000_tournament_rpcs.sql
-- ===========================================================================

-- Two more multi-table writes that must not half-succeed on flaky wifi, for
-- the same reason create_round exists: the Supabase client has no transactions.
--
--   create_tournament  -> tournaments + courts + participants
--   add_participant    -> participant + a credited row per round they missed

-- ---------------------------------------------------------------------------
-- create_tournament
-- ---------------------------------------------------------------------------

-- Courts do not exist yet when the client builds the payload, so a participant
-- pins to a court by its index in the courts array rather than by id.
--
--   {
--     "name": "Środa Americano",
--     "format": "americano",
--     "team_format": "individual",
--     "game_points": 21,
--     "rest_points": 11,
--     "pairing_formula": null,
--     "courts": ["Kort 1", "Kort 2"],
--     "participants": [
--       {"name": "Ann", "seed_court_index": 0, "seed_side": "a"},
--       {"name": "Bob"}
--     ]
--   }
create or replace function public.create_tournament(p_tournament jsonb)
returns table (id uuid, slug text)
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_court_ids uuid[] := '{}';
  v_court text;
  v_court_id uuid;
  v_participant jsonb;
  v_index int;
  v_seed_index int;
begin
  insert into public.tournaments (
    owner_id, name, format, team_format, game_points, rest_points, pairing_formula
  )
  values (
    (select auth.uid()),
    p_tournament ->> 'name',
    (p_tournament ->> 'format')::public.tournament_format,
    (p_tournament ->> 'team_format')::public.team_format,
    (p_tournament ->> 'game_points')::int,
    (p_tournament ->> 'rest_points')::int,
    nullif(p_tournament ->> 'pairing_formula', '')::public.pairing_formula
  )
  returning tournaments.id into v_id;

  v_index := 0;
  for v_court in select jsonb_array_elements_text(coalesce(p_tournament -> 'courts', '[]'::jsonb))
  loop
    v_index := v_index + 1;
    insert into public.courts (tournament_id, name, position)
    values (v_id, v_court, v_index)
    returning courts.id into v_court_id;
    v_court_ids := v_court_ids || v_court_id;
  end loop;

  v_index := 0;
  for v_participant in
    select jsonb_array_elements(coalesce(p_tournament -> 'participants', '[]'::jsonb))
  loop
    v_index := v_index + 1;
    v_seed_index := (v_participant ->> 'seed_court_index')::int;

    insert into public.participants (
      tournament_id, name, entry_order, seed_court_id, seed_side
    )
    values (
      v_id,
      v_participant ->> 'name',
      v_index,
      case
        when v_seed_index is null then null
        -- jsonb indexes are 0-based, Postgres arrays are 1-based
        else v_court_ids[v_seed_index + 1]
      end,
      nullif(v_participant ->> 'seed_side', '')::public.match_side
    );
  end loop;

  return query
    select t.id, t.slug from public.tournaments t where t.id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- add_participant
-- ---------------------------------------------------------------------------

-- Joins from the next round. When credited, every round already played gets a
-- 'credited' row: it earns rest points through the standings view without
-- counting towards the rest rota, which is what keeps a latecomer from looking
-- like the most-rested participant in the tournament.
create or replace function public.add_participant(
  p_tournament uuid,
  p_name text,
  p_credit_missed_rounds boolean default true
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_rounds_played int;
begin
  if not public.owns_tournament(p_tournament) then
    raise exception 'not the owner of this tournament' using errcode = '42501';
  end if;

  select coalesce(max(number), 0) into v_rounds_played
  from public.rounds where tournament_id = p_tournament;

  insert into public.participants (tournament_id, name, entry_order, joined_round)
  values (
    p_tournament,
    p_name,
    (select coalesce(max(entry_order), 0) + 1 from public.participants where tournament_id = p_tournament),
    v_rounds_played + 1
  )
  returning id into v_id;

  if p_credit_missed_rounds then
    insert into public.round_participants (round_id, participant_id, status)
    select r.id, v_id, 'credited'
    from public.rounds r
    where r.tournament_id = p_tournament;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_tournament(jsonb) from public, anon;
revoke all on function public.add_participant(uuid, text, boolean) from public, anon;

grant execute on function public.create_tournament(jsonb) to authenticated;
grant execute on function public.add_participant(uuid, text, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- Record these migrations as applied.
-- ---------------------------------------------------------------------------

insert into supabase_migrations.schema_migrations (version, name)
values ('20260817000000', 'initial_schema')
on conflict (version) do nothing;

insert into supabase_migrations.schema_migrations (version, name)
values ('20260817001000', 'tournament_rpcs')
on conflict (version) do nothing;

commit;
