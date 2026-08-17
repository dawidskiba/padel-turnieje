---
status: accepted
---

# Anonymous clients read through an RPC, not the tables

[ADR-0001](./0001-single-writer-organiser-public-read.md) makes a tournament's public
link a capability: holding it grants read access, and it must therefore be unguessable.
Row-level security cannot deliver that on its own — RLS filters rows, it cannot force a
client to supply a `WHERE` clause, so a policy permissive enough to serve the public view
(`for select to anon using (true)`) also lets any anonymous client list every tournament
and every participant name in the database.

So anonymous roles are granted no table access whatsoever. Public reads go through a
single security-definer function taking the slug and returning one tournament's settings,
current round and standings. Without the slug there is nothing to read at all.

## Consequences

Supabase realtime `postgres_changes` is unavailable to the public view, because it
respects RLS and a client with no table access receives no events. The public page
therefore polls the function every few seconds while its tab is visible. A lag of a few
seconds on a standings table is imperceptible; the alternative — realtime broadcast on a
slug-named channel — was rejected as a second delivery path that can drift from the
database and has no way to self-correct after a missed event.

The function is the entire public API surface. Anything a viewer should see has to be
added to its payload deliberately, which is a feature: there is one place to audit what
leaves the database.
