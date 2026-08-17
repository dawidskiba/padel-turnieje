# Turnieje Padlowe

Aplikacja webowa do tworzenia i zarządzania turniejami padlowymi (Americano, Mexicano).
Działa w przeglądarce — na laptopie i na tablecie z Androidem.

**Stack:** React + Vite + TypeScript + Tailwind CSS (frontend) · Supabase / PostgreSQL (baza danych) · Vercel/Netlify (hosting)

## Wymagania

- [Node.js](https://nodejs.org/) w wersji 18 lub nowszej (sprawdź: `node -v`)
- Konto na [supabase.com](https://supabase.com) (darmowe)
- Konto na [GitHub](https://github.com) i [Vercel](https://vercel.com) lub [Netlify](https://netlify.com) (do wdrożenia)

## 1. Instalacja zależności

```bash
npm install
```

## 2. Konfiguracja Supabase

1. Załóż nowy projekt na [supabase.com](https://supabase.com/dashboard).
2. Wejdź w **Project Settings → API** i skopiuj `Project URL` oraz klucz `anon public`.
3. Skopiuj plik `.env.example` do `.env`:
   ```bash
   cp .env.example .env
   ```
4. Wklej do `.env` swój URL i klucz.

Struktura tabel (turnieje, gracze, mecze) zostanie dodana w `supabase/migrations` po ustaleniu
zasad punktacji Americano/Mexicano — patrz `supabase/README.md`.

## 3. Uruchomienie lokalne

```bash
npm run dev
```

Aplikacja wystartuje pod `http://localhost:5173`. Dzięki opcji `host: true` w `vite.config.ts`
możesz ją też otworzyć z tabletu w tej samej sieci Wi-Fi, pod adresem, który Vite wypisze
w konsoli (coś w stylu `http://192.168.x.x:5173`) — przydatne do testowania na tablecie
zanim jeszcze wdrożysz aplikację na Vercel/Netlify.

## 4. Wersjonowanie w Git

```bash
git init
git add .
git commit -m "Szkielet projektu: React + Vite + Supabase"
```

Następnie załóż puste repozytorium na GitHubie i połącz je z lokalnym folderem:

```bash
git remote add origin https://github.com/TWOJ-LOGIN/padel-turnieje.git
git branch -M main
git push -u origin main
```

## 5. Wdrożenie (hosting)

1. Wejdź na [vercel.com](https://vercel.com), zaloguj się przez GitHub.
2. Kliknij "Add New Project", wybierz repo `padel-turnieje`.
3. W ustawieniach projektu (Environment Variables) dodaj `VITE_SUPABASE_URL` i
   `VITE_SUPABASE_ANON_KEY` — te same wartości co w Twoim lokalnym `.env`.
4. Deploy — od tej pory każdy `git push` na `main` automatycznie aktualizuje wersję online.

## Struktura projektu

```
padel-turnieje/
├── src/
│   ├── main.tsx              # punkt wejściowy React
│   ├── App.tsx                # główny komponent (na razie placeholder)
│   ├── index.css              # style + Tailwind
│   └── lib/
│       └── supabaseClient.ts  # inicjalizacja klienta Supabase
├── supabase/
│   ├── migrations/            # schemat bazy danych jako SQL (do uzupełnienia)
│   └── README.md
├── .env.example
└── package.json
```

## Co dalej

Ten szkielet celowo nie zawiera jeszcze logiki turniejowej — to następny krok, po ustaleniu
wymagań biznesowych (format Americano/Mexicano, liczba rund, sposób rotacji par, punktacja).
