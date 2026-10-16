---
status: accepted
---

# Players are told their court by Web Push, sent from the database when a round is written

Between rounds a player's phone is in a pocket. The public page polls only while its tab
is visible ([ADR-0002](./0002-public-read-via-rpc.md)), so nobody learns that a round has
started, or where they play, until they unlock the phone and look. At a club with four
courts that is the organiser shouting names across the hall.

A player opts in on the public page, after picking their name: the browser hands over a
Web Push subscription, which is stored against that Participant. When `create_round`
commits, the database asks an Edge Function to send every subscribed Participant their
Court, partner and opponents — or that they are Resting.

## Considered options

- **An alert inside the page** — vibration, a sound, a full-screen "Kort 2" — driven by
  the polling the page already does. No backend at all, but mobile browsers suspend
  hidden tabs, so it only reaches a phone that is awake with the page in front. That is
  exactly the phone that does not need it.
- **SMS or WhatsApp.** Reaches every phone, but needs a phone number per player. That is
  personal data stored against a tournament, which [ADR-0001](./0001-single-writer-organiser-public-read.md)
  rules out, and it costs per message.
- **A Telegram bot.** Free, and needs nothing installed from the page, but only reaches
  players who use Telegram. Kept in reserve: the subscription table and the trigger
  below would carry it unchanged if iPhone uptake of Web Push turns out to be poor.
- **The desk calls the Edge Function after confirming a round.** Simpler to wire, with
  no secrets in the database, but it is one more thing the desk has to remember to do
  after the write succeeds — and a desk that drops off the wifi in between leaves the
  round written and nobody told. A trigger cannot forget.

## Decision details

- **Trigger.** An `after insert` trigger on `rounds` queues the call with `pg_net`.
  `pg_net` sends only after the transaction commits, so the function never sees a
  half-written round, and a round that fails `create_round`'s invariants rolls back and
  sends nothing. The URL and a shared secret live in Supabase Vault, not in migrations.
- **Identity is a name.** The public payload carries no ids, so the subscribe RPC takes
  the slug, the Participant's name and the subscription. It is the second thing
  anonymous clients may call, and it is write-only: subscriptions never appear in
  `public_tournament`.
- **One subscription per device per tournament.** Re-subscribing under a different name
  ("To nie ja") moves the device rather than adding a second row.
- **Only real push services.** A subscription endpoint is a URL the Edge Function will
  POST to. Accepting any URL would let anyone holding a slug point our server at an
  address of their choosing, so endpoints are restricted to the hosts of the browser
  push services, both when stored and when sent.
- **A corrected round replaces the old notification.** Undoing a round and generating it
  again sends a second push. It carries the same notification tag, so the phone shows
  the new court in place of the old one instead of both.
- **Subscriptions end with the tournament.** Setting `finished_at` deletes them, and the
  push service's `404`/`410` deletes any it reports gone.

## Consequences

The anonymous API surface grows from one function to three. Anyone with the link can
subscribe a device under any Participant's name. That grants nothing the link does not
already show — the notification says only what the public page says — so it stays
inside the capability model of ADR-0001.

A push endpoint is an opaque URL plus two keys, not personal data in the ADR-0001 sense,
but it is still a device identifier. It is never returned to any client and is deleted
when the tournament finishes.

On iPhone, Web Push works only for a page added to the Home Screen (iOS 16.4 and later),
and the Home Screen app keeps its own storage, separate from Safari's. The manifest
therefore has no `start_url`: by the manifest spec the installed app then opens on the
page it was added from — the tournament, not the organiser's sign-in — and the player
picks their name once more inside it. Swapping in a per-page manifest at runtime was
tried first and does not work on iOS, which keeps the `start_url` of the manifest the
page loaded with. `id` stays `"/"`, so the organiser's already-installed desk app keeps
its identity. Expect fewer iPhone users to opt in than Android users.

Delivery is best effort. Push services may delay or drop messages, so the public page
stays the source of truth, and nothing in the tournament depends on a push arriving.

A VAPID key pair becomes deployment configuration: the public key is a build-time
variable, the private key an Edge Function secret. Rotating it invalidates every
existing subscription.
