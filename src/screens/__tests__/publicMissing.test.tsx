// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { PublicPage } from '../PublicPage'

// public_tournament returns null for a slug that no longer exists.
vi.mock('../../data/tournaments', () => ({ fetchPublicTournament: vi.fn(async () => null) }))

describe('public page for a deleted tournament', () => {
  it('offers the way to another tournament, since a Home Screen icon still opens it', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await act(async () => {
      createRoot(container).render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/t/k7m2xq9p4v']}>
            <Routes>
              <Route path="/t/:slug" element={<PublicPage />} />
              <Route path="/kod" element={<p>join page</p>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )
    })
    // Let the mocked fetch settle and the query re-render.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(container.textContent).toContain('Nie ma takiego turnieju.')
    const button = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Dołącz do innego turnieju'),
    )!

    await act(async () => button.click())
    expect(container.textContent).toContain('join page')
  })
})
