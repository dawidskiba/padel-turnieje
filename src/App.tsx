import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useSession } from './data/auth'
import { NotFoundPage } from './screens/NotFoundPage'
import { PublicPage } from './screens/PublicPage'
import { SignInPage } from './screens/SignInPage'
import { AppLayout, PublicLayout } from './ui/AppLayout'
import { Spinner } from './ui/primitives'

/**
 * The organiser's screens are loaded on demand.
 *
 * Sixteen phones open the public view at once on club wifi, and none of them
 * need the create form, the desk or the QR encoder — which together were most of
 * the bundle. Sign-in and the public view stay eager, because they are the two
 * entry points somebody actually waits on.
 */
const TournamentsPage = lazy(() =>
  import('./screens/TournamentsPage').then((m) => ({ default: m.TournamentsPage })),
)
const CreateTournamentPage = lazy(() =>
  import('./screens/CreateTournamentPage').then((m) => ({ default: m.CreateTournamentPage })),
)
const DeskPage = lazy(() => import('./screens/DeskPage').then((m) => ({ default: m.DeskPage })))

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
            <Suspense fallback={<Spinner label="Wczytuję…" />}>
              <AppLayout />
            </Suspense>
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
