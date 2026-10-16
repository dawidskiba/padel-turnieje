---
status: accepted
---

# Four-digit join codes, guessable by design, live until a day after the tournament

On iPhone, round notifications need the public page on the Home Screen
([ADR-0004](./0004-round-push-notifications.md)), and the icon opens the tournament it
was added from. A QR scanned with the Camera app always opens Safari, never the Home
Screen app, and the two keep separate storage. So without another way in, every new
tournament would mean installing the app again.

Each tournament therefore gets a **join code**: four digits, no leading zero, shown on
the desk's share screen next to the QR. Every public page has an "Inny turniej" link to
a page where the player types the code, or scans the desk's QR with the camera from
inside the app. Either one takes them to the tournament, where they pick their name as
usual.

## Considered options

- **A permanent link per organiser** listing their running tournaments. Players install
  once and new tournaments simply appear, with no code to type. It needs an organiser
  profile and a second public listing, and it is more than this club needs today.
- **Scan only, no code.** No new database state, but it fails whenever the camera does —
  a denied permission, a dim hall, a QR on a tablet across the room.
- **Six digits, never reused.** Much harder to guess, but every past tournament stays
  reachable by guessing forever, and six digits is noticeably worse to read aloud.

## Decision details

- **Live from creation until 24 hours after finishing**, so players can still look up
  results that evening and the next day. After that the code may go to a new
  tournament. The full link keeps working forever.
- **Reuse is explicit.** A code is cleared from its old tournament when it is handed on,
  so a plain unique index guarantees no two tournaments carry it at once. Reopening a
  tournament whose code has been reused gives it a fresh one.
- **Lookups are throttled**: 20 wrong codes per client in 10 minutes, counted against a
  hash of the client address, never the address itself.
- **A scanned QR is reduced to its slug.** The app navigates only to its own
  `/t/<slug>` page, whatever host the QR names, so a foreign QR cannot send the app
  anywhere else.

## Consequences

This knowingly weakens the capability model of [ADR-0001](./0001-single-writer-organiser-public-read.md)
and [ADR-0002](./0002-public-read-via-rpc.md) for live tournaments. The slug is still
unguessable, but a live tournament can now also be reached by guessing among 9 000
codes. At the throttle's rate a single client needs days to try them all, and what it
finds is what the public page already shows: tournament name, participant names and
scores. That was judged acceptable for club padel. If it stops being acceptable, the
code can open only the identity picker, without standings, without changing how codes
are issued.

The anonymous API surface grows by `resolve_join_code`, which returns a slug and
nothing else.

At most 9 000 tournaments can be live at once — far beyond one club.
