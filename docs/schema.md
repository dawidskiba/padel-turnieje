# Database schema

How the domain in [`CONTEXT.md`](../CONTEXT.md) is stored, and why. The requirements it
has to satisfy are in [`requirements-americano.md`](./requirements-americano.md) and
[`requirements-mexicano.md`](./requirements-mexicano.md).

Four requirements shape everything here: **any score is correctable at any time**, **the
most recent round can be undone**, **Mexicano reads the standings to build every round**,
and **both team formats share one model**.

---

## Tables

```
tournaments
  id                  uuid pk
  owner_id            uuid  -> auth.users
  slug                text unique          -- 10 chars, public link
  name                text
  format              americano | mexicano
  team_format         individual | teams
  game_points         int
  rest_points         int
  pairing_formula     text null            -- mexicano + individual only
  created_at          timestamptz
  finished_at         timestamptz null

courts
  id                  uuid pk
  tournament_id       uuid -> tournaments
  name                text
  position            int                  -- display order
  removed_from_round  int null             -- soft removal
  unique (tournament_id, name)

participants
  id                  uuid pk
  tournament_id       uuid -> tournaments
  name                text
  entry_order         int                  -- final tie-break, keeps rota deterministic
  joined_round        int default 1
  retired_after_round int null
  seed_court_id       uuid null -> courts  -- mexicano round-1 pinning
  seed_side           a | b | null
  unique (tournament_id, name)

rounds
  id                  uuid pk
  tournament_id       uuid -> tournaments
  number              int
  is_final            boolean
  created_at          timestamptz
  unique (tournament_id, number)

matches
  id                  uuid pk
  round_id            uuid -> rounds  on delete cascade
  court_id            uuid -> courts
  score_a             int null             -- null until entered
  score_b             int null
  unique (round_id, court_id)

match_participants
  match_id            uuid -> matches on delete cascade
  participant_id      uuid -> participants
  side                a | b
  primary key (match_id, participant_id)

round_participants
  round_id            uuid -> rounds on delete cascade
  participant_id      uuid -> participants
  status              playing | resting | credited
  primary key (round_id, participant_id)
```

Tournament state is derived, not stored: no rounds means Setup, `finished_at` set means
Finished, otherwise Running.

`score_a + score_b = game_points` is enforced by the application, not a constraint —
game points can differ per tournament and the check would have to reach across tables.

### Why `match_participants` rather than four columns

One row per participant per match, carrying their side. Individual matches produce four
rows, team matches two, and every query works on both without branching.

The pairing rules need partner and opponent history every single round, and this shape
makes both a plain join — a self-join on equal side for partners, on opposite side for
opponents. Four nullable columns on the match row would turn each of those into a
four-way OR.

### Why `round_participants` exists at all

Resting could be derived from the absence of a match row, but three things make it worth
storing:

- Rest Points attach to a real row, so the standings view sums one thing, not two.
- The rest count that drives the rota is a straight `count(*)`, with no need to
  reconstruct who was even eligible in a given round.
- An organiser's manual rest override is a decision, and decisions should be persisted
  rather than inferred.

The third status, `credited`, is the join credit for a late arrival. It is deliberately
**not** `resting`: it earns the same points, but must not count towards the rest rota —
otherwise a latecomer would look like the most-rested participant in the tournament and
be scheduled to play every remaining round.

### Soft removal

`courts.removed_from_round` and `participants.retired_after_round` mark things that
stopped being available without destroying history. Past matches keep real foreign keys
to real rows, a rained-out court can come back, and a retired participant stays in the
standings exactly as the requirements describe.

---

## Derived data

Standings are a view, never a stored column:

```sql
create view participant_round_points as
  -- points scored and conceded per participant per round,
  -- from matches for status 'playing',
  -- from tournaments.rest_points for 'resting' and 'credited'

create view standings as
  select participant_id,
         sum(scored)              as points,
         sum(scored - conceded)   as difference,
         count(*) filter (where scored > conceded) as wins,
         count(*) filter (where scored = conceded) as draws
  from participant_round_points
  group by participant_id;
```

A rested or credited round contributes its rest points to **both** `scored` and
`conceded`, so it adds to the total while leaving difference untouched. Crediting them to
`scored` alone would give everyone who sat out a large positive difference and corrupt
the tie-break. Wins, draws and losses are counted only for `playing` rows — otherwise a
rest, having equal scored and conceded, would register as a draw.

A corrected score is reflected everywhere the instant it is written, and an undone round
simply stops contributing. A stored total would have to be recomputed on score
correction, round undo, participant addition and retirement — four paths, each of which
is silently wrong forever if missed.

Ordering is points, then difference, then wins, then `entry_order` as a final
deterministic tie-break so the Mexicano ladder never depends on row order.

---

## Undo

Deleting the round row cascades to its matches, `match_participants` and
`round_participants`. Standings become correct with no filtering, round numbers stay
contiguous, and nothing downstream needs to know that discarded rounds could exist.

Only the newest round is ever undoable, so nothing can be left dangling.

A `discarded` flag was rejected: every standings, rest-count and pairing-history query
would have to filter it out correctly, forever, and missing the filter once puts phantom
matches into partner history and inflates rest counts.

---

## Access

Anonymous clients have **no table access at all**. Public reads go through one
security-definer function:

```sql
create function public_tournament(p_slug text) returns json
  security definer
```

It returns exactly one tournament: its settings, the round in progress, and the
standings. Without the slug there is nothing to read — which is what makes the link a
capability rather than a decoration. See
[ADR-0002](./adr/0002-public-read-via-rpc.md).

Writes are owner-only, enforced by row-level security keyed on `owner_id`, not by hiding
buttons in the UI.

Revoking privileges from `anon` is not sufficient on its own: PostgreSQL grants `EXECUTE`
on every new function to `PUBLIC`, so a migration that only revokes from named roles
leaves every function anonymously callable. The migration revokes from `PUBLIC` as well
and then grants back exactly what each role needs — including `generate_slug` and the
`owns_*` helpers, which are evaluated as the calling role in a column default and in RLS
policies respectively.

The public page polls `public_tournament` every few seconds while its tab is visible.
Realtime `postgres_changes` was not available to us: it respects RLS, and a client with
no table access receives no events.

---

## Writes

Round generation is a pure TypeScript function — current standings and history in, a
proposed round out — which makes partner variety, rest balance, the Mexicano ladder and
repeat avoidance all unit-testable with no database at all.

The proposal lives in client state while the organiser adjusts who rests. Only on
confirm is it persisted, through a single function that writes all four tables in one
transaction:

```sql
create function create_round(p_tournament uuid, p_round jsonb) returns uuid
```

So the database never contains an unconfirmed or half-written round, and no reader needs
a status filter. See [ADR-0003](./adr/0003-round-generation-in-client.md).

Two other writes span more than one table and get the same treatment:

```sql
create function create_tournament(p_tournament jsonb) returns table (id uuid, slug text)
create function add_participant(p_tournament uuid, p_name text, p_credit boolean) returns uuid
```

`create_tournament` writes the tournament, its courts and its roster together. A
participant pinned for a Mexicano draw references its court by **index into the courts
array**, because the courts do not exist yet when the client builds the payload.

`add_participant` writes the participant and, when the organiser leaves the credit box
ticked, one `credited` row per round already played.

`create_round` also enforces an invariant the tables cannot express: **every active
participant must be either playing or resting.** A round was once written that omitted
one — the organiser added a player while a proposed round was already on screen, and
confirming persisted the round computed for the previous roster. The new player was active
for that round but had no row at all, so they scored nothing: no match, and no rest points
either. Nothing objected. The client now regenerates a stale proposal, but this is the
check that makes such a round impossible to write.

### Idempotency

Retries on flaky wifi are made harmless by the constraints themselves:

- `unique (tournament_id, number)` on rounds — a replayed round insert raises a unique
  violation, which the client treats as "already done" and refetches.
- Score entry is an update to a known match row, so replaying it writes the same values.

No request-id table, no deduplication bookkeeping.

---

## Indexes

Beyond the primary keys and unique constraints:

```
match_participants (participant_id)      -- partner/opponent history
round_participants (participant_id, status)  -- rest counts
matches            (round_id)
rounds             (tournament_id, number desc)  -- "the current round"
tournaments        (owner_id)            -- "moje turnieje"
```

---

## Open

`participants.seed_court_id` / `seed_side` assume Mexicano round-1 pins are stored at
setup rather than held in memory until the first round is generated. Storing them means
an organiser can seed the draw and close the tab. Revisit if pinning turns out to be
something people only ever do immediately before starting.
