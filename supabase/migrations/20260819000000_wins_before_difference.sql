-- Matches won now outrank point difference — for new tournaments only.
--
-- Winning is what the evening is for; a single demolition should not lift a
-- player above someone who won more often. But standings are computed live, so
-- flipping the order everywhere would quietly re-rank finished tournaments and
-- could hand someone holding a public link a different winner than they saw on
-- the night. So the order is a per-tournament setting:
--
--   wins        points, wins, difference, raw_points, entry_order   (new default)
--   difference  points, difference, wins, raw_points, entry_order   (existing rows)
--
-- The column is added with 'difference' so every existing row is backfilled with
-- the order it was played under, then the default moves to 'wins'.
-- create_tournament never names the column, so new tournaments pick it up.
--
-- raw_points also joins the public order. The desk has broken ties on it since
-- court scoring arrived and the public page never did, so rows sharing a
-- position could be listed differently on each. Positions do not change.

alter table public.tournaments
  add column tiebreak text not null default 'difference'
    check (tiebreak in ('wins', 'difference'));

alter table public.tournaments
  alter column tiebreak set default 'wins';

comment on column public.tournaments.tiebreak is
  'Which of matches won and point difference ranks first after points. Existing
   tournaments keep difference, so no finished event changes its winner.';

comment on view public.standings is
  'Order by points desc, then wins and difference in the order tournaments.tiebreak
   gives, then raw_points desc, entry_order asc. Equal on points, wins and
   difference means a shared position.';

-- create or replace keeps the existing grants (anon + authenticated execute).
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
        order by s.points desc,
                 case when t.tiebreak = 'wins' then s.wins else s.difference end desc,
                 case when t.tiebreak = 'wins' then s.difference else s.wins end desc,
                 s.raw_points desc,
                 s.entry_order
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
