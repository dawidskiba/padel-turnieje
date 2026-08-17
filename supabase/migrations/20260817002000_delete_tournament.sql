-- Deleting a tournament fails on its own: cascades reach `courts` and `rounds`
-- independently, and if courts go first the matches still referencing them
-- raise matches_court_id_fkey. Observed on real data.
--
-- The obvious fix — ON DELETE CASCADE on matches.court_id — is the wrong one.
-- That constraint is what stops a single court being hard-deleted out from under
-- its match history, which is the whole reason courts are removed *softly*
-- (courts.removed_from_round). Weakening it to make an unrelated operation work
-- would trade a real protection for convenience.
--
-- So delete in an order that respects it, inside one transaction.

create or replace function public.delete_tournament(p_tournament uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not public.owns_tournament(p_tournament) then
    raise exception 'not the owner of this tournament' using errcode = '42501';
  end if;

  -- Matches first, so nothing references a court by the time courts go.
  -- match_participants cascades from matches.
  delete from public.matches
  where round_id in (select id from public.rounds where tournament_id = p_tournament);

  -- The rest follows from the tournament: courts, participants, rounds, and
  -- round_participants via rounds.
  delete from public.tournaments where id = p_tournament;
end;
$$;

revoke all on function public.delete_tournament(uuid) from public, anon;
grant execute on function public.delete_tournament(uuid) to authenticated;
