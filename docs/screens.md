# Screens

Interface design settled in the screens interview. Interface language is Polish;
identifiers and code stay English. Terms in **bold** are in [`CONTEXT.md`](../CONTEXT.md).

The design target is a tablet on the desk at the club, in landscape, operated by one
person who is also talking to players. Everything below follows from that: few taps,
big targets, nothing important hidden behind navigation.

---

## Routes

```
/                sign-in / landing
/turnieje        moje turnieje          (auth)
/turnieje/nowy   create form            (auth)
/turnieje/:id    desk view              (auth, owner only)
/t/:slug         public live view       (no auth)
```

---

## Create form — `/turnieje/nowy`

One scrolling page, no wizard. The whole configuration is visible at once and any part
of it can be revisited before creating.

```
Nowy turniej

  Nazwa turnieju    [ Środa Americano                    ]
  Format            (●) Americano      ( ) Mexicano
  Skład             (●) Indywidualny   ( ) Drużynowy
  Punkty w meczu    (11) (16) (●21)  własne [ __ ]
  Punkty za pauzę   [ 11 ]

  Liczenie punktów  (●) Zdobyte punkty        (Mexicano only)
                    ( ) Z wagą kortu
  Rundy bez wagi    [ 1 ]                     (only when weighted)
  Uczestnicy (16)   [ Iga|                               ]
                    ⓧAnn ⓧBob ⓧCara ⓧDan ⓧEwa ⓧFred …
  Korty (4)         ⓧKort 1 ⓧKort 2 ⓧKort 3 ⓧKort 4

                                        [ stwórz turniej ]
```

The Mexicano-only sections — **Pairing Formula**, **Scoring** and round-1 **Seeding** —
appear when Mexicano is selected and are absent otherwise. Scoring defaults to raw points,
so an organiser who ignores it gets the behaviour they had before; picking court weighting
reveals the neutral-rounds field, which is meaningless otherwise. Setting it to 0 warns:
weighting round 1 banks the luck of a blind draw. See
[`requirements-mexicano.md`](./requirements-mexicano.md) §3.

### Roster entry

A single input: type a name, press Enter, it becomes a removable chip and the field
clears for the next. Pasting a multi-line list adds every line at once, so an organiser
with the names in a WhatsApp message is finished in one paste.

Duplicates are flagged as they are added rather than at submit — case-insensitively, so
`ann` is refused when `Ann` exists.

Courts behave the same way, pre-filled with `Kort 1`…`Kort n` and freely renameable.

Validation follows [`requirements-americano.md`](./requirements-americano.md) §1.1:
impossible configurations block, awkward ones warn and can be overridden.

---

## Desk view — `/turnieje/:id`

Three states, following the tournament's own lifecycle.

### Setup — before round 1

Skipped on arrival. Creating a tournament lands on the first round's proposal
instead: the organiser has just typed the configuration and has no interest in
re-reading it. Discarding the proposal reveals this screen, for the cases where
something genuinely needs changing before play starts.

```
Środa Americano — przed startem                        [⚙]

  Uczestnicy 18                                [zarządzaj]
  Korty 4                                      [zarządzaj]
  Punkty w meczu 21  ·  Punkty za pauzę 11      (edytowalne)
  Liczenie punktów: z wagą kortu, 1 runda bez wagi   (read-only)

  ⚠ 2 osoby pauzują co rundę

  Rozstawienie (tylko Mexicano)                     [ustaw]

                              [ rozpocznij turniej ]
```

Scoring settings are still editable here and nowhere later, so this state makes them
visible rather than burying them. Mexicano seeding lives here too, which is what allows
an organiser to pin the draw and close the tab before play starts.

### Running — the split

```
Środa Americano — Runda 4                              [⚙]
┌─ KORTY ──────────────────────┐┌─ [Tabela] [Rundy] ──┐
│  Kort 1   Ann & Dan          ││  1  Ann      88     │
│           15  :  6      ✓    ││  2  Bob      81     │
│           Bob & Cara         ││  3  Cara     74     │
│                              ││  4  Dan      70     │
│  Kort 2   Ewa & Hana         ││  5  Ewa      66     │
│           __  :  __          ││  6  Fred     61     │
│           Fred & Gus         ││  …                  │
│                              ││                     │
│  Pauza:  Iga, Jan            ││                     │
└──────────────────────────────┘└─────────────────────┘
        [następna runda]   [ostatnia runda]   [udostępnij]
```

Courts take two thirds, the table one third. The two questions players walk up and ask —
*what court am I on* and *where am I* — are both answerable without touching the tablet.
On a phone the two panels stack into one scrolling column.

`następna runda` is disabled until every court has a score.

The right panel has a segmented control: **Tabela** (default) and **Rundy**, the latter
listing finished rounds newest first. Correcting an old score happens there, with the
same interaction as a live one.

### Finished

```
Środa Americano — zakończony

┌──────────────────────────────────────┐
│                 🥇                   │
│             ZWYCIĘZCA                │
│               Ann                    │
│              147 pkt                 │
└──────────────────────────────────────┘

┌─ 🥈 2. Bob      141 ─┐┌─ 🥉 3. Cara  138 ─┐

  4  Dan   131      5  Ewa   127   …

        [udostępnij wyniki]            [⚙]
```

The winner reads first, alone, and much larger than anyone else. An earlier version was a
literal podium — second, first, third across a row with the winner raised slightly — and
it read as a row of three equals: the eye lands on whoever is leftmost, and the offsets
were far too subtle to say otherwise. Reading order is now ranking order.

Joint first place is possible, since positions are shared when points, difference and
matches won all tie. The card says `Remis na 1. miejscu` and names everyone tied, rather
than crowning one of them.

The evening gets an ending rather than merely stopping. Reopening the tournament is in
the gear sheet, deliberately out of the way.

---

## Entering a score

Sides are written with an ampersand — "Ann & Bob" reads as a partnership where
"Ann + Bob" reads as arithmetic, on a screen otherwise full of numbers.

The two **sides** of a match are tappable, not the court. Tapping one opens a popup for
that side; choosing a number sets it and computes the opponent's score, since the two
always sum to **Game Points**.

```
┌─ Kort 2  ·  Ewa & Hana ──────────────┐
│                                      │
│    0   1   2   3   4   5   6         │
│    7   8   9  10  11  12  13         │
│   14  15  16  17  18  19  20         │
│   21                                 │
│                                      │
│   Fred & Gus dostaną 21 − x          │
└──────────────────────────────────────┘
```

One tap saves and closes. A mistake costs the same one tap to fix — score correction is
supported everywhere already, so a confirmation step would guard something trivially
reversible.

Above roughly 30 game points the grid becomes a numeric keypad: a hundred fingertip-sized
buttons is slower and less accurate than typing two digits.

---

## Advancing a round

Pressing `następna runda` (or `ostatnia runda`) renders the proposal **in place**, in the
courts panel, dimmed, with a sticky bar underneath:

```
┌─ KORTY  (propozycja rundy 5) ────────┐
│  Kort 1   Ann & Dan                  │
│           vs  Bob & Cara             │
│  Kort 2   Ewa & Hana                 │
│           vs  Fred & Gus             │
└──────────────────────────────────────┘
  Pauza:  Iga, Jan            [zmień]
        [odrzuć]  [przetasuj]  [zatwierdź rundę]
```

`przetasuj` produces a different arrangement of the same round. Generation is
deterministic, so without it "discard and generate again" returned the identical
pairings — the variant only changes how ties are broken, leaving the pairing
priorities untouched, so every reshuffle is equally valid. In practice five or
six distinct arrangements are available.

What the organiser approves is literally what they will see for the next twenty minutes —
no translating a dialog into the real thing. Nothing reaches the database until
`zatwierdź`, per [ADR-0003](./adr/0003-round-generation-in-client.md).

`[zmień]` opens the rest picker. Individual pairings are not editable — a hand-made swap
would break the partner-variety guarantee — so a round that is wrong as a whole gets
reshuffled or discarded instead. Swapping a resting participant for a playing one warns
if it unbalances the rest counts, and allows it anyway; the round is then regenerated
around the new set of players rather than leaving pairings computed for the old one.

---

## Settings sheet — the gear

Everything that is not scoring lives behind one gear icon:

```
┌─ Ustawienia ─────────────────────────┐
│  Uczestnicy (18)          [zarządzaj]│
│  Korty (4)                [zarządzaj]│
│  Punkty  🔒 21  ·  pauza 🔒 11        │
│                                      │
│  [cofnij rundę 4]                    │
│  [zakończ turniej]                   │
└──────────────────────────────────────┘
```

Off the main surface, so nothing destructive is a stray tap during play, but one gesture
away when someone twists an ankle. Locked settings are shown, not hidden — an organiser
who wonders why they cannot change the target gets an answer.

The participants editor handles adding (with the rest-credit choice, pre-ticked) and
retiring. The courts editor handles adding, renaming and removing.

Once the tournament is **finished**, both editors become read-only and say so. Scores can
still be corrected; reopening restores everything else.

---

## Sharing

`[udostępnij]` fills the tablet screen with a QR code:

```
        ██▄▄██▄██▄▄██
        █▄██▄▄█▄▄██▄
        ██▄█▄██▄█▄██

     padel.app/t/k7m2xq9p4v
          [kopiuj link]
```

Everyone points a phone at it once at the start of the evening — no typing, no dependency
on a group chat, and it still works for whoever arrives at round three. The link is
copyable for anyone who prefers to paste it.

The QR code is rendered client-side; no image service is involved, since the slug should
not leave the app.

---

## Public view — `/t/:slug`

First visit asks who the viewer is:

```
Kto jesteś?
  [Ann]  [Bob]  [Cara]  [Dan]
  [Ewa]  [Fred] [Gus]   [Hana]

  [pomiń — tylko oglądam]
```

The answer is kept in that browser's local storage, per tournament. No account, no server
state, and changing it is one tap. Every later visit opens straight onto:

```
Środa Americano — Runda 4

▶ TY:  Kort 2,  z Bobem,  przeciw Cara & Dan

  Kort 1   Ann & Ewa    15 : 6    Fred & Cara   ✓
  Kort 2   — w trakcie —
  Pauza:   Iga, Jan

  1  Ann   88     2  Bob   81     3  Cara  74
  …
```

The page polls `public_tournament(slug)` every few seconds while its tab is visible, per
[ADR-0002](./adr/0002-public-read-via-rpc.md). It is read-only in the strongest sense:
anonymous clients have no write path at all.

---

## Connection state

The app requires a connection but must never lose typed input. A banner reports the
state; scores entered while offline show as pending on their court and retry
automatically.

```
⚠ Brak połączenia — zapiszę, gdy wróci
   Kort 1   15 : 6    ⏳ oczekuje
   Kort 2   12 : 9    ⏳ oczekuje
```

---

## Assumed, not interviewed

- Sign-in is a single email field and a "wyślij link" button; the magic link returns to
  `/turnieje`.
- `/turnieje` lists tournaments newest first, showing name, date and state, with a
  prominent `nowy turniej` action.
- Visiting `/turnieje/:id` for a tournament you do not own gives a not-found, not a
  permission error — ownership should not be discoverable.
