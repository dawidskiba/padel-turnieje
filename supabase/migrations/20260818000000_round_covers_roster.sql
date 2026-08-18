-- Every active participant must be either playing or resting in a round.
--
-- A round was written that silently omitted one: the organiser added a player
-- while a proposed round was already on screen, and confirming it persisted the
-- round computed for the previous roster. The new player was active for that
-- round but had no row at all, so they scored nothing — no match, and no rest
-- points either. Nothing in the schema objected.
--
-- The client is fixed to regenerate a stale proposal, but this is the invariant
-- that actually guarantees it: a round that does not account for everyone is not
-- a round, and no client bug should be able to write one.

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
  v_number       int;
  v_unaccounted  text;
begin
  if not public.owns_tournament(p_tournament) then
    raise exception 'not the owner of this tournament' using errcode = '42501';
  end if;

  if exists (select 1 from public.tournaments where id = p_tournament and finished_at is not null) then
    raise exception 'tournament is finished' using errcode = 'P0001';
  end if;

  v_number := (p_round ->> 'number')::int;

  insert into public.rounds (tournament_id, number, is_final)
  values (p_tournament, v_number, coalesce((p_round ->> 'is_final')::boolean, false))
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

  -- Nobody active may be left out.
  select string_agg(p.name, ', ' order by p.entry_order) into v_unaccounted
  from public.participants p
  where p.tournament_id = p_tournament
    and p.joined_round <= v_number
    and (p.retired_after_round is null or v_number <= p.retired_after_round)
    and not exists (
      select 1 from public.round_participants rp
      where rp.round_id = v_round_id and rp.participant_id = p.id
    );

  if v_unaccounted is not null then
    raise exception
      'round % does not account for every active participant: %', v_number, v_unaccounted
      using errcode = 'P0001';
  end if;

  return v_round_id;
end;
$$;
