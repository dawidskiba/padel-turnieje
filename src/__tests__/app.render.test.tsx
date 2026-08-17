// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import App from '../App'

/**
 * A mount test, not a UI test. Routing, providers and the auth guard all
 * type-check happily while still throwing on first render, and nothing else in
 * the suite would catch that.
 */
async function render(path: string): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.append(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  await act(async () => {
    createRoot(container).render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })

  return container
}

describe('app mounts', () => {
  it('shows the sign-in form at the root', async () => {
    const container = await render('/')
    expect(container.textContent).toContain('Wyślij link')
    expect(container.querySelector('input[type="email"]')).not.toBeNull()
  })

  it('offers all three theme choices, not just a light/dark switch', async () => {
    const container = await render('/')
    const radios = container.querySelectorAll('[role="radio"]')
    expect(radios).toHaveLength(3)
    // Each has a decorative glyph plus a screen-reader label; check the label.
    expect([...radios].map((r) => r.querySelector('.sr-only')?.textContent)).toEqual([
      'Jasny',
      'Systemowy',
      'Ciemny',
    ])
    // System is the default, so nothing is stamped on the document yet.
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('sends an unauthenticated visitor away from the desk', async () => {
    const container = await render('/turnieje/whatever')
    expect(container.textContent).toContain('Wyślij link')
  })

  it('renders the not-found page for an unknown path', async () => {
    const container = await render('/nie-ma-takiej-strony')
    expect(container.textContent).toContain('Nie ma tu nic')
  })
})
