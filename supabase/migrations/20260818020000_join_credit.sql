-- A round credited to a late joiner is worth less than a rest.
--
-- Both were paying rest_points, which meant somebody who was not present for a
-- round earned exactly what somebody who turned up and found the courts full
-- earned. With a 21-point target that was 11 — the *winning* score — so a
-- latecomer arrived as though they had won every round they missed.
--
-- A missed round now pays half the game points rounded down (10 of 21), capped at
-- the rest value so a deliberately harsh rest setting cannot be beaten by not
-- turning up: with rest_points set to 3, a missed round is worth 3, not 10.
--
-- Rest points themselves are unchanged: still whatever the organiser configured,
-- defaulting to half the game points rounded up.

create or replace view public.participant_round_points
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

  -- Turned up, no court free: pays the configured rest points.
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
  where rp.status = 'resting'

  union all

  -- Was not there at all: pays the lesser of half the match, rounded down, and a
  -- rest.
  select
    rp.round_id,
    r.tournament_id,
    rp.participant_id,
    rp.status,
    least(t.rest_points, floor(t.game_points / 2.0)::int),
    least(t.rest_points, floor(t.game_points / 2.0)::int)
  from public.round_participants rp
    join public.rounds r on r.id = rp.round_id
    join public.tournaments t on t.id = r.tournament_id
  where rp.status = 'credited';
