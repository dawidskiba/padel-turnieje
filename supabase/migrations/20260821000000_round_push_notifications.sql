-- Web Push: tell each subscribed player their court when a round is written.
-- See docs/adr/0004-round-push-notifications.md.
--
-- Three pieces:
--   push_subscriptions      one row per device per tournament, never readable by clients
--   subscribe_push / unsubscribe_push
--                           the only write path, anonymous, keyed on the slug like
--                           public_tournament (ADR-0002)
--   rounds_notify trigger   queues a call to the notify-round Edge Function; pg_net sends
--                           it only once the round's transaction has committed
--
-- One-time setup per project (secrets do not belong in migrations):
--
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/notify-round', 'notify_round_url');
--   select vault.create_secret('<random string>', 'notify_round_secret');
--
-- Without both secrets the trigger does nothing, so local databases and
-- projects without push configured keep working.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  endpoint       text not null,
  p256dh         text not null,
  auth           text not null,
  created_at     timestamptz not null default now(),

  -- One device follows one participant per tournament. Picking a different
  -- name moves the row rather than adding a second one.
  unique (tournament_id, endpoint)
);

create index push_subscriptions_participant on public.push_subscriptions (participant_id);

-- RLS with no policies: nobody but security-definer functions and the service
-- role touches this table. Not even the organiser needs to read it.
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- The endpoint is a URL the Edge Function will POST to. Accepting any URL would
-- let anyone holding a slug aim our server at an address of their choosing, so
-- only the browsers' own push services are allowed. The Edge Function checks
-- the same list before sending.
create or replace function public.is_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
     and length(p_endpoint) <= 1024;
$$;

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_allowed check (public.is_push_endpoint(endpoint));

-- ---------------------------------------------------------------------------
-- Anonymous write path
-- ---------------------------------------------------------------------------

-- Expected p_subscription shape is PushSubscription.toJSON():
--   { "endpoint": "https://…", "expirationTime": null, "keys": { "p256dh": "…", "auth": "…" } }
create or replace function public.subscribe_push(p_slug text, p_name text, p_subscription jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament  uuid;
  v_participant uuid;
  v_endpoint    text := p_subscription ->> 'endpoint';
  v_p256dh      text := p_subscription #>> '{keys,p256dh}';
  v_auth        text := p_subscription #>> '{keys,auth}';
begin
  select t.id into v_tournament
  from public.tournaments t
  where t.slug = p_slug and t.finished_at is null;

  if v_tournament is null then
    raise exception 'no running tournament for this link' using errcode = 'P0002';
  end if;

  select p.id into v_participant
  from public.participants p
  where p.tournament_id = v_tournament
    and lower(p.name) = lower(btrim(p_name))
    and p.retired_after_round is null;

  if v_participant is null then
    raise exception 'no such participant' using errcode = 'P0002';
  end if;

  if v_endpoint is null or not public.is_push_endpoint(v_endpoint) then
    raise exception 'unsupported push endpoint' using errcode = '22023';
  end if;

  if v_p256dh is null or v_auth is null or length(v_p256dh) > 256 or length(v_auth) > 64 then
    raise exception 'malformed push subscription' using errcode = '22023';
  end if;

  -- A tournament has at most a few dozen phones around it. The cap only stops
  -- someone with the link filling the table.
  if (select count(*) from public.push_subscriptions where tournament_id = v_tournament) >= 100
     and not exists (
       select 1 from public.push_subscriptions
       where tournament_id = v_tournament and endpoint = v_endpoint
     ) then
    raise exception 'too many subscriptions for this tournament' using errcode = '54000';
  end if;

  insert into public.push_subscriptions (tournament_id, participant_id, endpoint, p256dh, auth)
  values (v_tournament, v_participant, v_endpoint, v_p256dh, v_auth)
  on conflict (tournament_id, endpoint) do update
    set participant_id = excluded.participant_id,
        p256dh         = excluded.p256dh,
        auth           = excluded.auth,
        created_at     = now();
end;
$$;

create or replace function public.unsubscribe_push(p_slug text, p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions s
  using public.tournaments t
  where t.id = s.tournament_id and t.slug = p_slug and s.endpoint = p_endpoint;
$$;

-- ---------------------------------------------------------------------------
-- What the Edge Function sends
-- ---------------------------------------------------------------------------

-- One row per subscription for a round: where that participant plays and with
-- whom, or that they rest. The Edge Function turns each row into a message.
-- Callable by the service role only.
create or replace function public.round_notifications(p_round uuid)
returns table (
  subscription_id uuid,
  endpoint        text,
  p256dh          text,
  auth            text,
  slug            text,
  tournament      text,
  team_format     public.team_format,
  round_number    int,
  is_final        boolean,
  participant     text,
  status          public.round_participant_status,
  court           text,
  partners        text[],
  opponents       text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.endpoint,
    s.p256dh,
    s.auth,
    t.slug,
    t.name,
    t.team_format,
    r.number,
    r.is_final,
    p.name,
    rp.status,
    c.name,
    coalesce((
      select array_agg(op.name order by op.entry_order)
      from public.match_participants omp
        join public.participants op on op.id = omp.participant_id
      where omp.match_id = mp.match_id and omp.side = mp.side and omp.participant_id <> p.id
    ), '{}'),
    coalesce((
      select array_agg(op.name order by op.entry_order)
      from public.match_participants omp
        join public.participants op on op.id = omp.participant_id
      where omp.match_id = mp.match_id and omp.side <> mp.side
    ), '{}')
  from public.rounds r
    join public.tournaments t on t.id = r.tournament_id
    join public.push_subscriptions s on s.tournament_id = t.id
    join public.participants p on p.id = s.participant_id
    join public.round_participants rp on rp.round_id = r.id and rp.participant_id = p.id
    -- Resting participants have no match: the court and both name lists stay empty.
    left join (
      public.match_participants mp
        join public.matches m on m.id = mp.match_id
    ) on mp.participant_id = p.id and m.round_id = r.id
    left join public.courts c on c.id = m.court_id
  where r.id = p_round;
$$;

-- ---------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------

-- Fires inside create_round's transaction, after the rounds row only — the
-- matches are inserted later in the same transaction. That is fine: pg_net
-- queues the request in a table and its worker sends it after commit, by which
-- time the whole round exists. A round that fails create_round's invariants
-- rolls back and takes the queued request with it.
create or replace function public.notify_round_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'notify_round_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'notify_round_secret';

  if v_url is null or v_secret is null then
    return new;
  end if;

  if not exists (select 1 from public.push_subscriptions where tournament_id = new.tournament_id) then
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('round_id', new.id),
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-notify-secret', v_secret
    )
  );

  return new;
end;
$$;

create trigger rounds_notify
  after insert on public.rounds
  for each row execute function public.notify_round_created();

-- Subscriptions end with the tournament (ADR-0004).
create or replace function public.forget_push_on_finish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_subscriptions where tournament_id = new.id;
  return new;
end;
$$;

create trigger tournaments_forget_push
  after update of finished_at on public.tournaments
  for each row
  when (old.finished_at is null and new.finished_at is not null)
  execute function public.forget_push_on_finish();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.is_push_endpoint(text) from public, anon, authenticated;
revoke all on function public.subscribe_push(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.unsubscribe_push(text, text) from public, anon, authenticated;
revoke all on function public.round_notifications(uuid) from public, anon, authenticated;
revoke all on function public.notify_round_created() from public, anon, authenticated;
revoke all on function public.forget_push_on_finish() from public, anon, authenticated;

grant execute on function public.subscribe_push(text, text, jsonb) to anon, authenticated;
grant execute on function public.unsubscribe_push(text, text) to anon, authenticated;
grant execute on function public.round_notifications(uuid) to service_role;

-- The Edge Function deletes subscriptions the push service reports gone. New
-- tables are not exposed to the API roles by default, service_role included.
grant select, delete on public.push_subscriptions to service_role;
