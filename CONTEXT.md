# Domain Context — Padel Tournaments

Glossary for the tournament domain. Terms only — no implementation detail.

## Tournament

A single organised event with a name, a roster of Participants, a set of Courts, a
Format (Americano / Mexicano), a Team Format (individual / teams) and a scoring
configuration. Produces a final Standing.

A Tournament is in one of three states:

- **Setup** — nothing played yet; every setting is editable.
- **Running** — the first Round has been generated. Scoring settings, Format and Team
  Format are frozen, because changing them would make already-recorded Matches
  incomparable. Name, roster and Courts stay editable.
- **Finished** — closed by the Final Round. Read-only, reopenable by the Organiser.

## Format

The rule set that decides how Matches are generated each Round.

- **Americano** — pairings rotate so Participants meet as many different partners and
  opponents as possible; pairings are decided independently of results.
- **Mexicano** — pairings for the next Round are derived from the current Standing
  (leaders play leaders).

## Team Format

- **Individual** — a Participant is one player. Partners change between Rounds, so a
  Match has four Participants.
- **Teams** — a Participant is a named team that stays together for the whole
  Tournament. The Tournament knows only the team's name, not who is in it. A Match has
  two Participants.

## Participant

A named entrant in a Tournament — a player in Individual format, a team in Teams
format. Names are unique within a Tournament.

A Participant may join after the Tournament has started, in which case the Organiser
chooses whether they are credited Rest Points for the Rounds they missed (the default)
or start from zero. A Participant may also retire: they keep the points they earned,
stay in the Standing marked as retired, earn nothing further, and are excluded from
later Rounds.

## Round

One synchronised slice of the Tournament. Every Court hosts at most one Match per
Round. Participants not assigned to a Match are Resting.

The number of Matches in a Round is limited by both the roster and the Courts —
whichever runs out first. Leftover Participants Rest; surplus Courts stay idle.

A Tournament has no predetermined number of Rounds. The Organiser advances it with two
actions: **Next Round** generates another Round, **Final Round** generates a Round that
also closes the Tournament once its results are in. Only the most recent Round can be
undone; earlier Rounds keep their schedule, though their scores stay correctable.

## Match

One game on one Court during one Round, between two sides. Ends when the Game Points
target is reached. An even Game Points target can end level, which is a legitimate
result — a draw.

## Game Points

The target score of a single Match. The two sides' scores always sum to this number
(e.g. with Game Points = 21, a Match ends 15–6 or 11–10). Presets 11, 16, 21; custom
values allowed; default 21.

## Rest Points

Points credited to a Participant for a Round in which they do not play, so that sitting
out is not a penalty. Defaults to half the Game Points, rounded up, until the Organiser
sets it explicitly.

## Rest Rota

The rule deciding who Rests in a Round: those who have Rested fewest times so far, ties
broken by who Rested longest ago, then by entry order. Rest counts never differ by more
than one across the roster. The Organiser may override an individual Rest assignment;
the Tournament warns when an override unbalances the counts.

The Rest Rota is the only part of a generated Round the Organiser can change. Pairings
themselves are not editable — a hand-made swap would break the partner-variety
guarantee. A Round that is wrong as a whole is undone and regenerated instead.

## Court

A named playing surface, unique by name within a Tournament. Default names are
generated as "Kort 1", "Kort 2", … in order. Courts may be added or removed while the
Tournament is Running; the change takes effect from the next Round.

Court assignment spreads Participants across the available Courts, so nobody spends the
whole Tournament on the same one.

## Standing

The ranking of Participants by points accumulated across all Rounds, Rest Points
included. Ordered by total points, then point difference (scored minus conceded), then
Matches won — draws count towards neither wins nor losses. Participants still equal
after all three share a position.

## Organiser

The signed-in owner of a Tournament and the only actor who may change it — entering
results, advancing Rounds, editing the roster, overriding the Rest Rota.

## Viewer

Anyone holding a Tournament's public link. Sees the Standing, the Round in progress and
their own next Match, live. Changes nothing.
