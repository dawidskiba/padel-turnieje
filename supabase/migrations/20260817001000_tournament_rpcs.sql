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
