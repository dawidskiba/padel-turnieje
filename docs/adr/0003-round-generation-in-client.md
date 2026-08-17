---
status: accepted
---

# Rounds are generated in client TypeScript and persisted by one transactional RPC

Round generation is the most intricate logic in the app — partner variety, opponent
history, rest balance, the Mexicano ladder, repeat avoidance — and the rules are still
settling. It is written as a pure TypeScript function, current state in and a proposed
round out, so all of it is unit-testable without a database and a rule change is an edit
rather than a migration. This is safe because [ADR-0001](./0001-single-writer-organiser-public-read.md)
establishes exactly one authenticated writer per tournament; there is no adversary to
keep honest and no race to lose.

Persisting a round touches four tables, and the Supabase client has no transactions. The
finished proposal is therefore handed to a single `create_round(tournament, jsonb)`
database function that inserts all of it in one transaction — so a connection dropped
mid-write leaves no half-built round.

## Consequences

The proposal exists only in client state until the organiser confirms it, which is what
lets them override the rest rota before anything is written. The database consequently
never holds an unconfirmed round, and no query needs a draft filter — but an organiser
who closes the tab mid-adjustment loses the proposal and regenerates it.

The algorithm is not authoritative. Should per-court score entry or co-organisers ever
arrive, generation would have to move server-side, because multiple writers could then
produce conflicting rounds.
