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
2. Click "Add New Project" and pick the `padel-turnieje` repo.
3. In the project settings (Environment Variables) add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` — the same values as in your local `.env`.
4. Deploy — from then on every `git push` to `main` automatically updates the live version.

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
