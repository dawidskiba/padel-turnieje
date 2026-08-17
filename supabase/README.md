# Supabase — schemat i migracje

Ten folder trzyma definicję bazy danych jako kod (SQL), żeby była wersjonowana razem z aplikacją.

Na razie jest pusty — schemat tabel (turnieje, gracze, mecze, wyniki) dodamy po ustaleniu
wymagań biznesowych (zasady Americano/Mexicano, sposób liczenia punktacji).

## Jak to podłączyć (jednorazowo)

1. Zainstaluj Supabase CLI: `npm install -g supabase`
2. Zaloguj się: `supabase login`
3. Połącz ten folder z projektem Supabase, który założysz na supabase.com:
   `supabase link --project-ref TWOJ_PROJECT_REF`
4. Nowe migracje twórz komendą: `supabase migration new nazwa_migracji`
   — utworzy plik SQL w `supabase/migrations/`, w którym opisujesz zmiany w tabelach.
5. Wypchnij migracje na żywą bazę: `supabase db push`

Dzięki temu cała struktura bazy danych jest w Git, a nie tylko "w głowie" albo w dashboardzie.
