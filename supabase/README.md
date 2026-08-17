# Supabase — schema and migrations

This folder keeps the database definition as code (SQL), so it is versioned together with the app.

It is empty for now — the table schema (tournaments, players, matches, results) will be added once the
business requirements are settled (Americano/Mexicano rules, how scoring is calculated).

## How to hook it up (one-time)

1. Install the Supabase CLI: `npm install -g supabase`
2. Log in: `supabase login`
3. Link this folder to the Supabase project you create on supabase.com:
   `supabase link --project-ref YOUR_PROJECT_REF`
4. Create new migrations with: `supabase migration new migration_name`
   — this creates an SQL file in `supabase/migrations/` where you describe the table changes.
5. Push the migrations to the live database: `supabase db push`

This way the whole database structure lives in Git, not just "in your head" or in the dashboard.
