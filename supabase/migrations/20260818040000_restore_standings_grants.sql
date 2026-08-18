-- Restores the grants the initial schema set on `standings`.
--
-- `20260818030000` had to drop and recreate the view to insert `raw_points`
-- mid-column-list, and a freshly created view picks up Supabase's default
-- privileges for `anon` and `authenticated` on the public schema. That handed
-- `anon` select, insert, update and delete on `standings`, which the initial
-- schema had explicitly revoked.
--
-- Nothing leaked: the view is `security_invoker`, so an anon select runs with
-- anon's own rights and dies on the nested `participant_round_points`, which
-- kept its revoke. But relying on a second view's grants to hold the line is
-- not the design — this puts the first line of defence back.
--
-- PUBLIC is revoked as well as the named roles, since that is where the
-- default actually comes from and any future role inherits it.

revoke all on public.standings from public;
revoke all on public.standings from anon;
revoke all on public.standings from authenticated;

-- The organiser's desk reads the standings directly; RLS on the base tables
-- decides which rows they see.
grant select on public.standings to authenticated;
