# Requirements — Americano

Business requirements for the Americano format, settled in the requirements interview.
Terms in **bold** are defined in [`CONTEXT.md`](../CONTEXT.md).

Scope: Americano only, both Team Formats. Mexicano is specified separately.
Interface language is Polish; identifiers, data and code stay English.

---

## 1. Creating a tournament

The create form collects:

| Field | Rules |
|---|---|
| Name | Required, free text. |
| Team Format | `Indywidualny` (default) or `Drużynowy`. |
| Participants | Unique names within the tournament. In `Indywidualny` a participant is a player; in `Drużynowy` it is a team entered as a single name — the app does not know who is in the team. |
| Game Points | Presets 11 / 16 / 21 plus a custom number. **21 selected by default.** Allowed range 1–99. |
| Rest Points | Number input, defaults to `floor(GamePoints / 2)` — 21→10, 16→8, 11→5. Rounded **down**: with a 21-point target 11 is the winning score, so rounding up paid a rested round like a narrow win, and a late joiner credited for missed rounds arrived as though they had won every one. Follows Game Points until the organiser types a value, then stops tracking. |
| Courts | Unique names within the tournament. Defaults generated as `Kort 1`, `Kort 2`, … incrementing from 1. |

### 1.1 Validation

Rejected:

- fewer than 4 participants (`Indywidualny`) or fewer than 2 (`Drużynowy`)
- zero courts
- duplicate participant names, or duplicate court names
- empty tournament name
- Game Points outside 1–99

Warned, but allowed:

- a whole match's worth of participants resting each round — 4 individuals or 2 teams.
  That is precisely the point at which another court would put more of them on it, which
  a percentage threshold does not tell the organiser. (An earlier draft said "more than a
  third"; its own worked example — 22 players on 4 courts, 6 resting — is 27% and could
  never have fired.)
- more courts than the roster can ever fill

---

## 2. Running a round

### 2.1 How many matches

```
participants_per_match = 4  (Indywidualny)  |  2  (Drużynowy)
matches_this_round     = min( floor(active_participants / participants_per_match),
                              courts )
```

Participants left over **rest** for that round. Surplus courts stay idle. Retired
participants are not active and are excluded from the count.

### 2.2 Pairing rules

Applied in priority order:

1. No repeated partner while an unused partner exists (`Indywidualny` only).
2. Among valid options, prefer opponents faced least often.
3. Spread participants across courts so nobody spends the tournament on one court.
4. Respect the rest rota.

In `Drużynowy` only rule 2 applies to the teams — partners never change.

Rules 1 and 2 are guarantees: a partnership or fixture is never repeated while a fresh one
is available. Rule 3 is best-effort, and how well it does depends on how many courts there
are. Courts are assigned a whole match at a time, and by the time that happens the
foursomes are already fixed by rules 1 and 2 — so with four or more courts nobody is ever
confined to one court and imbalance stays within three appearances, while with **two
courts** the entire freedom is a single binary swap per round and a player can sit on the
same court for the first few rounds before it corrects itself.

Closing that gap would mean letting court spread override partner variety, which the
priority order deliberately forbids.

Rule 2 is applied optimally **per round**: among every possible way of pairing the sides
available, the round chosen has the fewest repeats there are. Verified by exhaustive
comparison against all possible arrangements.

Per-round optimality is not the same as an optimal *schedule*, though, and the difference
shows up with small even rosters. Six teams on three courts admits a perfect five-round
round robin, but only if the first three rounds are chosen as part of that plan; each
round taken on its own merits leaves round four with no rematch-free option at all. Eight
teams on four courts happens to reach the full seven rounds; six on three does not reach
five.

A guaranteed round robin would mean planning every round up front, which a tournament
cannot do: the roster and the courts can both change between rounds, and the schedule
would be invalidated the first time somebody arrived late or a court was rained off.

Pairings are **not** hand-editable. A round whose schedule is wrong is undone and
regenerated.

### 2.3 Rest rota

Resting participants are those who have rested fewest times so far. Ties break by who
rested longest ago, then by entry order. Rest counts never differ by more than one
across the roster.

The organiser may swap a resting participant for a playing one before the round is
confirmed. If the swap makes rest counts differ by more than one, the app warns and
asks for confirmation; it does not block.

### 2.4 Entering results

One organiser device shows every court in the current round. The organiser types one
side's score and the other auto-fills to reach the Game Points target. A round is
complete when every court has a result.

- Both sides' scores always sum to Game Points.
- An even Game Points target may end level — a draw is a valid result.
- Any already-entered score can be corrected at any time, in any round; standings
  recompute.

### 2.5 Advancing

Two controls:

- **`Następna runda`** — generates another round.
- **`Ostatnia runda`** — generates a round and closes the tournament once its results
  are in.

There is no configured round count. Only the most recent round can be undone; earlier
rounds keep their schedule, though their scores remain correctable.

The final round is the one exception to the pairing rules above: it is seeded by the
standings instead, grouping participants four at a time in rank order and splitting each
group `#1+#4 v #2+#3`, so the contenders end up opposing each other on `Kort 1` rather
than scattered across courts. Applied literally — no repeat avoidance — and the
partner-variety guarantee is waived for that round only. In teams format the final round
pairs adjacent ranks: `#1 v #2` on `Kort 1`, `#3 v #4` on `Kort 2`.

---

## 3. Scoring and standings

A participant's total is the sum of points scored in matches played, plus Rest Points
for each round rested.

Standings order:

1. total points
2. point difference (scored − conceded)
3. matches won — draws count towards neither wins nor losses

A rested round contributes its Rest Points to *both* scored and conceded, so it moves a
participant's total but leaves their difference unchanged. Counting rest points as
scored alone would hand everyone who sat out a large positive difference and corrupt the
tie-break that difference exists to settle. A rest is likewise neither a win, a draw nor
a loss.

Participants still equal after all three share a position (`=3`, `=3`).

The table shows position, name, points, difference and a W–D–L (`Z–R–P`) column.

---

## 4. Changes during a tournament

| Change | Behaviour |
|---|---|
| Correct a score | Any match, any round. Standings recompute. |
| Add a participant | Joins from the next round. Organiser chooses: credit Rest Points for rounds missed (default, pre-ticked) or start from zero. |
| Retire a participant | Keeps points earned, stays in the standings marked `RET`, earns nothing further, excluded from later rounds and from the rest rota. |
| Add / remove / rename a court | Takes effect from the next round; the current round keeps its assignments. Court count changes how many participants rest. |
| Undo a round | Most recent round only. Discards its schedule and results; the tournament returns to the end of the previous round. |

Locked once the first round is generated: Game Points, Rest Points, Format, Team
Format. Editable while the tournament is running: name, roster, courts.

Once **finished**, the roster and the courts are locked too. A finished tournament is a
record, and adding a participant or a court to one changes nothing that can be played
while making the standings harder to trust — a name with no rounds against it, or a court
that hosted nothing. Scores stay correctable, because a mistyped result is worth fixing
whenever it is noticed. Reopening the tournament unlocks everything again, which makes
changing a finished event a deliberate act rather than an accident.

Both halves are enforced: the desk hides the controls, and the database refuses the write
regardless of what any client attempts.

---

## 5. Access

- The organiser signs in with a password, or a magic link if the password has been
  forgotten, and owns their tournaments. `Moje turnieje` lists their past and active events
  across devices.

  Magic links alone were the original decision, and running the app proved it wrong: the
  built-in mailer allows a couple of emails an hour, so being logged out at the club with a
  tournament due to start meant waiting. Neither method creates an account — organisers are
  added from the Supabase dashboard.
- Every tournament has a public link. Anyone holding it sees a live read-only view and
  needs no account.
- Only the owner can write. Write access is enforced server-side, not just hidden in
  the UI.

### 5.1 Public view

Shows, live:

- the standings table
- the round in progress, with scores appearing as they are entered
- once a viewer taps their own name, a pinned card: which court they are on next, with
  whom, against whom

---

## 6. Reliability

The app requires a connection, but must never lose typed input. Scores entered while
offline are held locally, shown as pending, and retried automatically until they save.
A connection banner tells the organiser what is unsaved.

Full offline play is out of scope.

---

## 7. Out of scope for v1

- A saved club roster of players reused across tournaments — every tournament's roster
  is typed fresh.
- Duplicating a past tournament.
- Cross-tournament statistics or a season ranking.
- Multiple simultaneous editors, or per-court score entry devices.
- Live point-by-point scoring.
- Skill ratings and rating-balanced pairing.
