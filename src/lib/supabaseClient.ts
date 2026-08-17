import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Brak zmiennych VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Skopiuj .env.example do .env i uzupełnij dane swojego projektu Supabase.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
