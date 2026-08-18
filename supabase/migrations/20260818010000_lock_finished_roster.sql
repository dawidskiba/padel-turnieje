-- A finished tournament is a record, not a work in progress.
--
-- Adding a participant or a court to one changes nothing that can be played and
-- only makes the standings harder to trust: a name with no rounds against it, or
-- a court that hosted nothing. The desk hides those controls once a tournament
-- is finished; this is the half that does not depend on remembering to.
--
-- Reopening clears finished_at, so the escape hatch is to reopen, change, finish
-- again — which is a deliberate act rather than an accident.

create or replace function public.refuse_when_finished()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tournament uuid;
begin
  v_tournament := coalesce(new.tournament_id, old.tournament_id);

  if exists (
    select 1 from public.tournaments
    where id = v_tournament and finished_at is not null
  ) then
    raise exception 'tournament is finished — reopen it before changing the roster or courts'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger participants_locked_when_finished
  before insert or update or delete on public.participants
  for each row execute function public.refuse_when_finished();

create trigger courts_locked_when_finished
  before insert or update or delete on public.courts
  for each row execute function public.refuse_when_finished();
