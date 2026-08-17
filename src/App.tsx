import { useEffect, useState } from 'react'

function App() {
  const [status, setStatus] = useState<'sprawdzam' | 'ok' | 'brak-konfiguracji'>('sprawdzam')

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    setStatus(url && key ? 'ok' : 'brak-konfiguracji')
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-slate-800">Turnieje Padlowe</h1>
        <p className="mt-2 text-slate-500">
          Szkielet projektu gotowy. Logika turniejowa (Americano / Mexicano) czeka na wymagania biznesowe.
        </p>

        <div className="mt-6 text-sm">
          {status === 'sprawdzam' && <span className="text-slate-400">Sprawdzam konfigurację Supabase…</span>}
          {status === 'ok' && (
            <span className="text-green-600">✓ Zmienne środowiskowe Supabase wykryte.</span>
          )}
          {status === 'brak-konfiguracji' && (
            <span className="text-amber-600">
              Brak VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — skopiuj .env.example do .env i uzupełnij dane
              swojego projektu Supabase.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
