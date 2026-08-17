---
status: accepted
---

# One writing organiser per tournament, public read-only for everyone else

A tournament is edited from a single desk device by its signed-in owner, while players
watch a live read-only view through an unguessable public link and never authenticate.
Write access is enforced server-side in Supabase (row-level security keyed on the
owner), so read and write are separate paths from the database up, not merely different
screens.

## Considered options

- **Secret admin link, no accounts.** Zero sign-up friction, but losing the link makes a
  running tournament uneditable, and there is no way to list an organiser's past events
  across devices.
- **Shared club password.** Easy to hand to a co-organiser, but grants edit rights to
  every tournament at once, leaves no record of who changed what, and rotating it locks
  everyone out simultaneously.
- **Multiple concurrent editors** — co-organisers, or a device per court entering its own
  score. Faster in parallel, but two edits to the same match need conflict resolution,
  and the desk still has to chase whichever court forgot to submit.

## Consequences

Per-court score entry and co-organisers are both blocked by this decision, not merely
unbuilt. Adding either later means introducing conflict handling and a permission model
richer than "owner or not" — the reason the option is recorded here rather than
rediscovered.

The public link is a capability: anyone holding it can read the tournament. Tournament
identifiers must therefore be unguessable, and nothing private may be stored against a
tournament.
