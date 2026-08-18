# Padel Tournaments

Web app for creating and managing padel tournaments (Americano, Mexicano).
Runs in the browser — on a laptop and on an Android tablet.

**Stack:** React + Vite + TypeScript + Tailwind CSS (frontend) · Supabase / PostgreSQL (database) · Vercel/Netlify (hosting)

## Requirements

- [Node.js](https://nodejs.org/) 22 or newer (check: `node -v`). The repo pins the version in `.nvmrc` — run `nvm use` to switch.
- A [supabase.com](https://supabase.com) account (free)
- A [GitHub](https://github.com) account and [Vercel](https://vercel.com) or [Netlify](https://netlify.com) (for deployment)

## 1. Install dependencies

```bash
npm install
```

## 2. Supabase setup

1. Create a new project at [supabase.com](https://supabase.com/dashboard).
2. Go to **Project Settings → API** and copy the `Project URL` and the `anon public` key.
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Paste your URL and key into `.env`.

The table structure (tournaments, players, matches) will be added in `supabase/migrations` once the
Americano/Mexicano scoring rules are settled — see `supabase/README.md`.

## 3. Running locally

```bash
npm run dev
```

The app starts at `http://localhost:5173`. Thanks to `host: true` in `vite.config.ts` you can also
open it from a tablet on the same Wi-Fi network, at the address Vite prints in the console
(something like `http://192.168.x.x:5173`) — handy for testing on a tablet before you deploy
to Vercel/Netlify.

## 4. Git versioning

```bash
git init
git add .
git commit -m "Project skeleton: React + Vite + Supabase"
```

Then create an empty repository on GitHub and connect it to your local folder:

```bash
git remote add origin https://github.com/YOUR-USERNAME/padel-turnieje.git
git branch -M main
git push -u origin main
```

## 5. Deployment (hosting)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click "Add New Project" and pick the `padel-turnieje` repo. Framework detection picks
   up Vite; build command `npm run build`, output directory `dist`.
3. In the project settings (Environment Variables) add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` — the same values as in your local `.env`. **The URL is the
   project URL, not the REST endpoint**: `https://<ref>.supabase.co`, with no `/rest/v1`.
4. Deploy — from then on every `git push` to `main` automatically updates the live version.

`vercel.json` (and `netlify.toml`, if you host there instead) routes every path to
`index.html`. This is not optional: the app does its own routing, so without it only `/`
would work and every shared tournament link would 404.

### After the first deploy

Add the production URL to Supabase, or sign-in will fail. **Authentication → URL
Configuration**:

- Site URL: `https://<your-domain>`
- Redirect URLs: `https://<your-domain>/**`

Keep `http://localhost:5173/**` there too if you still develop locally.

Nothing else needs configuring. The database migrations are already applied, and the anon
key is safe to expose — it grants no table access at all, and the only function it can call
is the read-only `public_tournament` (see `docs/adr/0002-public-read-via-rpc.md`).

### Signing in

Two ways in, and neither creates an account:

- **Password** — the default. No email round trip, so it works at the club desk when the
  tournament is about to start and nobody wants to go hunting through an inbox.
- **Magic link** — a one-time email link, kept as the route for a forgotten password.

Set an organiser's password from **Authentication → Users → …→ Reset password**, or create
the user there with one. The built-in mailer allows only a couple of messages an hour,
which is the reason password sign-in exists at all: hitting that limit while logged out
otherwise means waiting.

### Restricting who can sign in

Magic-link auth is open by default: any address can request a link and gets its own
account. Such a stranger could not see or change your tournaments — ownership is enforced
in the database — but they could create their own inside your project.

To close it, in **Authentication → Sign In / Providers → Email**, turn off *Allow new users
to sign up*. Existing accounts keep working; unknown addresses are refused. Add an
organiser later from **Authentication → Users → Invite**.

That dashboard setting is the actual gate. The app also passes `shouldCreateUser: false`,
which stops it creating an account as a side effect of typing an address, but that is
convenience rather than security: the anon key is public, so the API can be called
directly.

For several named organisers without toggling settings each time, Supabase's *before user
created* auth hook can check an allowlist table and reject anyone else. Not implemented —
one owner per tournament is deliberate, see `docs/adr/0001-single-writer-organiser-public-read.md`.

## Project structure

```
padel-turnieje/
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # main component (placeholder for now)
│   ├── index.css              # styles + Tailwind
│   └── lib/
│       └── supabaseClient.ts  # Supabase client initialization
├── supabase/
│   ├── migrations/            # database schema as SQL (to be filled in)
│   └── README.md
├── .env.example
└── package.json
```

## What's next

This skeleton deliberately contains no tournament logic yet — that's the next step, once the
business requirements are settled (Americano/Mexicano format, number of rounds, pair rotation, scoring).
