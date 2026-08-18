# Requirements — Mexicano

Business requirements for the Mexicano format. Terms in **bold** are defined in
[`CONTEXT.md`](../CONTEXT.md).

Mexicano shares almost everything with Americano — setup fields, scoring, rest points,
standings, roster changes, access, reliability. See
[`requirements-americano.md`](./requirements-americano.md); only the differences are
specified here.

The one idea that separates the formats: **in Americano the schedule is decided in
advance of results, in Mexicano it is derived from them.** Every difference below
follows from that.

---

## 1. Extra setup

| Field | Rules |
|---|---|
| Pairing Formula | How the four players on a court are split into two sides, by rank within the group: `#1+#4 v #2+#3` (default, balanced), `#1+#2 v #3+#4`, `#1+#3 v #2+#4`. Individual format only — hidden in `Drużynowy`, where there is no pair to balance. Locks when round 1 is generated, alongside Game Points and Rest Points. |
| Round 1 seeding | Optional. The organiser may pin any number of players to a specific court and, if they wish, to a specific side of the net. Unpinned slots are drawn at random. Mexicano only. |

Pinning to a side is what lets an organiser put two strong players on the same court as
*opponents* rather than risking them being drawn as partners.

---

## 2. Generating a round

### 2.1 Round 1

No standings exist yet. Pairings are drawn at random, honouring any pins the organiser
set at setup.

### 2.2 Round 2 onward

1. Decide who rests, using the **Rest Rota** — the same balanced fewest-rests-first rule
   as Americano. Rest is independent of position: a leader is as likely to sit out as
   anyone else.
2. Rank the remaining active participants by the current **Standing**. Ties break by
   points, then difference, then wins, then entry order, so the ladder is deterministic.
3. Assign to courts as a ladder, filling `Kort 1` upward.

**Individual format** — participants taken four at a time, one group per court:

```
ranks  1– 4  ->  Kort 1
ranks  5– 8  ->  Kort 2
ranks  9–12  ->  Kort 3
```

Within each group the Pairing Formula decides the two sides. With the default:

```
Kort 1   #1 + #4   v   #2 + #3
```

**Teams format** — teams taken two at a time, adjacent ranks meeting:

```
Kort 1   #1  v  #2
Kort 2   #3  v  #4
Kort 3   #5  v  #6
```

The closest-matched teams always face each other, and the two leading teams settle it on
the top court.

### 2.3 The court ladder

Court number is meaningful in Mexicano: `Kort 1` hosts the leaders, and climbing courts
between rounds is how a player reads their evening. Ranks map to courts strictly and
always — 1–4 on the first court, 5–8 on the second, 9–12 on the third, and so on down.

Staying on the same court is therefore the *expected* outcome of playing well, not a
fault. A player who holds the top four holds Kort 1 all evening. This deliberately
contradicts the Americano rule that spreads participants across courts — the two formats
differ here, and the difference is the point. Nothing in the Americano court-spreading
logic touches Mexicano.

When fewer courts are available than the ranking would fill, the ladder simply occupies
the courts that remain, still from the top: with Kort 2 rained out, ranks 1–4 play Kort 1
and 5–8 play Kort 3.

### 2.4 Repeat avoidance

Strict rank grouping recreates partnerships. Before applying the Pairing Formula to a
group of four, check the immediately preceding round only, and only who partnered whom:

- If the formula's arrangement would recreate a partnership from last round, use another
  arrangement of that group instead.
- A group of four has exactly three possible arrangements. If all three would repeat a
  partnership, apply the formula as written.

Only the previous round is considered. A longer memory is exhausted after three rounds
and silently reverts to strict formula for the rest of the tournament, which looks like
a fault. Opponents are not considered — inside a group of four everyone faced everyone
last round, so including them would reject every arrangement.

Teams format applies the same idea to rematches: avoid an immediate repeat of last
round's fixture where the ladder allows it.

---

## 3. The final round

`Ostatnia runda` is generated exactly like any other Mexicano round — the ladder already
places the leaders together on `Kort 1`, so the format supplies its own finale.

Americano borrows this: its final round is seeded by the standings using
`#1+#4 v #2+#3`, applied literally with no repeat avoidance, so a tournament that spent
the evening maximising variety still ends with the contenders opposing each other on one
court. The partner-variety guarantee is waived for that round only.

---

## 4. Unchanged from Americano

Game Points and the fact that both sides' scores sum to it; Rest Points and the balanced
rest rota with organiser override; no fixed round count; undo of the most recent round
only; score correction at any time; late joins and retirements; court changes from the
next round; standings and tie-breaks; the settings that freeze at round 1; magic-link
organiser accounts and the public read-only view; resilient-online behaviour; Polish
interface.
