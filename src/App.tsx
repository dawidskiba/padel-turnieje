import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useSession } from './data/auth'
import { NotFoundPage } from './screens/NotFoundPage'
import { SignInPage } from './screens/SignInPage'
import { AppLayout, PublicLayout } from './ui/AppLayout'
import { Spinner } from './ui/primitives'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <Spinner label="Sprawdzam sesję…" />
      </div>
    )
  }

  if (!session) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Placeholder until the screens land. */
function Soon({ what }: { what: string }) {
  return <p className="text-text-muted">{what} — w budowie.</p>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SignInPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/turnieje" element={<Soon what="Moje turnieje" />} />
        <Route path="/turnieje/nowy" element={<Soon what="Nowy turniej" />} />
        <Route path="/turnieje/:id" element={<Soon what="Widok stolika" />} />
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="/t/:slug" element={<Soon what="Widok publiczny" />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
