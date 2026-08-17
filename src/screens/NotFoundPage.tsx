import { Link } from 'react-router-dom'

import { Button } from '../ui/primitives'

/**
 * Also what you get for a tournament you do not own. Ownership should not be
 * discoverable: "forbidden" would confirm the tournament exists.
 */
export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl text-text">Nie ma tu nic.</h1>
      <p className="mt-2 text-text-muted">
        Ten adres nie istnieje albo turniej został usunięty.
      </p>
      <Link to="/turnieje" className="mt-6 inline-block">
        <Button variant="secondary">Moje turnieje</Button>
      </Link>
    </div>
  )
}
