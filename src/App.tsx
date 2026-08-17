import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useSession } from './data/auth'
import { CreateTournamentPage } from './screens/CreateTournamentPage'
import { DeskPage } from './screens/DeskPage'
import { NotFoundPage } from './screens/NotFoundPage'
import { PublicPage } from './screens/PublicPage'
import { SignInPage } from './screens/SignInPage'
import { TournamentsPage } from './screens/TournamentsPage'
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
        <Route path="/turnieje" element={<TournamentsPage />} />
        <Route path="/turnieje/nowy" element={<CreateTournamentPage />} />
        <Route path="/turnieje/:id" element={<DeskPage />} />
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="/t/:slug" element={<PublicPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
