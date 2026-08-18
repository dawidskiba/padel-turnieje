-- Court-weighted scoring for Mexicano.
--
-- Raw points systematically favour the weaker courts. Every match hands out
-- game_points between the two sides, and the pairing formula balances the top
-- court so it lands 11–10, while a wide-spread lower court lands 18–3. Measured
-- on a real tournament, the second court paid its winner nearly three points a
-- round more than the first, and a player who never left it finished second.
--
-- Under 'courts', a round pays a base for where you played and whether you won,
-- plus a bonus for the margin:
--
--   loss(court) = 2 + (courts_in_round - court) * 4      win = loss + 6
--   margin      = clamp(round(2 * (scored - conceded) / game_points), -2, 2)
--
-- Two inequalities make it work, and neither is arbitrary:
--
--   win gap (6) > court step (4)   a win one court down beats a loss one court
--                                  up, so a bad opening draw is recoverable
--   margin cap (2) < court step    a demolition on a weak court cannot catch a
--                                  tight win on a strong one
--
-- neutral_rounds covers the opening rounds, where the Mexicano draw is still
-- random and the court says nothing about strength: every court pays the middle
-- of the scale, so only the margin counts.
--
-- The court count comes from the round's own match count, so removing a court
-- later never re-prices a round already played.

alter table public.tournaments
  add column scoring text not null default 'points'
    check (scoring in ('points', 'courts')),
  add column neutral_rounds int not null default 1
    check (neutral_rounds >= 0);

comment on column public.tournaments.scoring is
  'points = raw match score (correct for Americano, which spreads players across
   courts deliberately). courts = weighted by the court played on, for Mexicano,
   where the court is a statement about the opposition.';

-- Existing tournaments keep raw points, so no finished event re-ranks itself and
-- nobody holding a public link sees a different winner than they did on the night.

create or replace view public.participant_round_points
with (security_invoker = true)
as
  with round_shape as (
    select r.id as round_id,
           r.tournament_id,
           r.number,
           count(m.id) as court_count
    from public.rounds r
      left join public.matches m on m.round_id = r.id
    group by r.id, r.tournament_id, r.number
  ),
  court_rank as (
    select m.id as match_id,
           dense_rank() over (partition by m.round_id order by c.position) as rank
    from public.matches m
      join public.courts c on c.id = m.court_id
  )
  -- Played a match.
  select
    rp.round_id,
    r.tournament_id,
    rp.participant_id,
    rp.status,
    (case mp.side when 'a' then m.score_a else m.score_b end) as scored,
    (case mp.side when 'a' then m.score_b else m.score_a end) as conceded,
    case
      when t.scoring = 'points'
        then (case mp.side when 'a' then m.score_a else m.score_b end)::numeric
      else
        -- base: court-neutral while the draw is still settling, tiered after
        (case
           when rs.number <= t.neutral_rounds
             then 2 + (greatest(rs.court_count, 1) - 1) * 4 / 2.0
           else 2 + (greatest(rs.court_count, 1) - cr.rank) * 4
         end)
        -- winning, losing, or level
        + (case
             when (case mp.side when 'a' then m.score_a else m.score_b end)
                > (case mp.side when 'a' then m.score_b else m.score_a end) then 6
             when (case mp.side when 'a' then m.score_a else m.score_b end)
                = (case mp.side when 'a' then m.score_b else m.score_a end) then 3
             else 0
           end)
        -- capped margin
        + greatest(-2, least(2, round(
            2.0 * ((case mp.side when 'a' then m.score_a else m.score_b end)
                 - (case mp.side when 'a' then m.score_b else m.score_a end))
            / nullif(t.game_points, 0))))
    end as value
  from public.round_participants rp
    join public.rounds r on r.id = rp.round_id
    join public.tournaments t on t.id = r.tournament_id
    join round_shape rs on rs.round_id = rp.round_id
    join public.match_participants mp on mp.participant_id = rp.participant_id
    join public.matches m on m.id = mp.match_id and m.round_id = rp.round_id
    join court_rank cr on cr.match_id = m.id
  where rp.status = 'playing'
    and m.score_a is not null

  union all

  -- Turned up, no court free.
  select
    rp.round_id, r.tournament_id, rp.participant_id, rp.status,
    t.rest_points, t.rest_points,
    case when t.scoring = 'points' then t.rest_points::numeric
         else 2 * greatest(rs.court_count, 1) + 3 end
  from public.round_participants rp
    join public.rounds r on r.id = rp.round_id
    join public.tournaments t on t.id = r.tournament_id
    join round_shape rs on rs.round_id = rp.round_id
  where rp.status = 'resting'

  union all

  -- Was not there at all: one less than a rest under either scheme.
  select
    rp.round_id, r.tournament_id, rp.participant_id, rp.status,
    least(t.rest_points, floor(t.game_points / 2.0)::int),
    least(t.rest_points, floor(t.game_points / 2.0)::int),
    case when t.scoring = 'points'
           then least(t.rest_points, floor(t.game_points / 2.0)::int)::numeric
         else 2 * greatest(rs.court_count, 1) + 3 - 1 end
  from public.round_participants rp
    join public.rounds r on r.id = rp.round_id
    join public.tournaments t on t.id = r.tournament_id
    join round_shape rs on rs.round_id = rp.round_id
  where rp.status = 'credited';

-- points is the ranking currency; raw_points and difference stay in match points
-- so the tie-break means the same thing under either scheme.
--
-- Dropped rather than replaced: `create or replace view` can only append columns,
-- and raw_points belongs beside points rather than tacked on the end. The grant
-- goes with the view, so it is reinstated below.
drop view if exists public.standings;

create view public.standings
with (security_invoker = true)
as
  select
    p.tournament_id,
    p.id                                     as participant_id,
    p.name,
    p.entry_order,
    p.retired_after_round is not null        as retired,
    coalesce(sum(prp.value), 0)::int         as points,
    coalesce(sum(prp.scored), 0)::int        as raw_points,
    coalesce(sum(prp.scored - prp.conceded), 0)::int as difference,
    count(*) filter (where prp.status = 'playing' and prp.scored > prp.conceded)::int as wins,
    count(*) filter (where prp.status = 'playing' and prp.scored = prp.conceded)::int as draws,
    count(*) filter (where prp.status = 'playing' and prp.scored < prp.conceded)::int as losses,
    count(*) filter (where prp.status = 'resting')::int as rests
  from public.participants p
    left join public.participant_round_points prp on prp.participant_id = p.id
  group by p.id;

comment on view public.standings is
  'Order by points desc, difference desc, wins desc, raw_points desc, entry_order asc.
   Equal on the first four means a shared position.';

grant select on public.standings to authenticated;

-- create_tournament has to accept the two new settings, or a tournament created
-- as court-scored silently falls back to the column default and ranks on raw
-- points. Absent keys keep the defaults, so older clients are unaffected.
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
    owner_id, name, format, team_format, game_points, rest_points, pairing_formula,
    scoring, neutral_rounds
  )
  values (
    (select auth.uid()),
    p_tournament ->> 'name',
    (p_tournament ->> 'format')::public.tournament_format,
    (p_tournament ->> 'team_format')::public.team_format,
    (p_tournament ->> 'game_points')::int,
    (p_tournament ->> 'rest_points')::int,
    nullif(p_tournament ->> 'pairing_formula', '')::public.pairing_formula,
    coalesce(nullif(p_tournament ->> 'scoring', ''), 'points'),
    coalesce((p_tournament ->> 'neutral_rounds')::int, 1)
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

revoke all on function public.create_tournament(jsonb) from public, anon;
grant execute on function public.create_tournament(jsonb) to authenticated;
