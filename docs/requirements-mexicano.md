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

## 3. Scoring

Two schemes, chosen per tournament. Existing tournaments and every Americano use
`points`; only a Mexicano may use `courts`.

### 3.1 Why raw points are wrong here

Every match hands out Game Points between the two sides. The Pairing Formula balances the
top court tightly, so it lands 11–10 and pays its winner 11. A lower court spans a wider
spread, lands 18–3, and pays 18. Measured on a real 8-player tournament: **Kort 1 paid its
winner 11.2 on average, Kort 2 paid 14.0** — margins on Kort 1 were 1 or 3 every round,
while Kort 2 produced 11-point blowouts. A player who spent all five rounds on Kort 2
finished **second**, ahead of one who spent all five on Kort 1 with the same number of wins.

The irony is that this is caused by the balancing working: the better the top court is
matched, the closer its scores and the less it pays.

### 3.2 Court-weighted scoring

```
loss(court) = 2 + (courts_in_round − court) × 4        win = loss + 6
margin      = round(2 × (scored − conceded) / GamePoints), clamped to ±2
rest        = 2 × courts_in_round + 3                 credit = rest − 1
```

With two courts: Kort 1 pays 12 for a win and 6 for a loss, Kort 2 pays 8 and 2, a rest 7.
A 21–0 on Kort 1 pays 14, an 11–10 pays 12.

Two inequalities hold the design together, and neither is a free parameter:

- **win gap (6) > court step (4)** — a win one court down beats a loss one court up, so a
  strong player dealt a bad opening draw climbs by winning. Reverse it and the ladder
  becomes a caste system: whoever starts high stays high, and fixing one unfairness
  introduces another.
- **margin cap (2) < court step (4)** — a demolition on a weak court cannot catch a tight
  win on a strong one. Raise the cap and the original problem returns.

A multiplicative weight on the whole score cannot work, and it is worth recording why: a
winner on *any* court scores anywhere between just over half the target and all of it, so
the spread *within* a court is wider than the gap *between* courts. Removing the bias needs
a weight below 0.52; letting a lower-court winner outrank an upper-court loser needs one
above 0.48. Nothing satisfies both.

The court count comes from **that round's own match count**, so removing a court later never
re-prices a round already played.

### 3.3 Neutral opening rounds

Round 1 of a Mexicano is a blind draw, so the court says nothing about anybody's level, and
weighting it banks the luck of that draw. During the configured number of opening rounds
every court pays the middle of the scale and only the margin counts.

Default 1. On the real tournament above, neutralising round 1 alone changed the order —
a player who drew Kort 1 in round 1 had been banking top-court points for a coin flip.
Neutralising round 2 as well changed nothing further, because by then the courts had been
earned.

Note that a very short tournament feels the weighting less: over two rounds the margin
bonus from the neutral round can offset a whole round of court advantage. It separates as
the evening goes on.

### 3.4 Ranking

Ordered by scheme points, then point difference, then matches won, then raw match points,
then entry order. Difference and raw points stay in match points under both schemes, so the
tie-breaks mean the same thing either way — and under court scoring the integers are small,
so ties are common and the tie-breaks earn their keep.

---

## 4. The final round

`Ostatnia runda` is generated exactly like any other Mexicano round — the ladder already
places the leaders together on `Kort 1`, so the format supplies its own finale.

Americano borrows this: its final round is seeded by the standings using
`#1+#4 v #2+#3`, applied literally with no repeat avoidance, so a tournament that spent
the evening maximising variety still ends with the contenders opposing each other on one
court. The partner-variety guarantee is waived for that round only.

---

## 5. Unchanged from Americano

Game Points and the fact that both sides' scores sum to it; Rest Points and the balanced
rest rota with organiser override; no fixed round count; undo of the most recent round
only; score correction at any time; late joins and retirements; court changes from the
next round; standings and tie-breaks; the settings that freeze at round 1; magic-link
organiser accounts and the public read-only view; resilient-online behaviour; Polish
interface.
