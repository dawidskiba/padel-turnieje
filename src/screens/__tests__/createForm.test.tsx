// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { CreateTournamentPage } from '../CreateTournamentPage'

async function mount(): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.append(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  await act(async () => {
    createRoot(container).render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CreateTournamentPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
  return container
}

function buttonWithText(container: HTMLElement, text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  )
  if (!found) throw new Error(`no button labelled "${text}"`)
  return found as HTMLButtonElement
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click()
  })
}

const restPointsInput = (c: HTMLElement) =>
  c.querySelector<HTMLInputElement>('#restPoints')!

describe('create form', () => {
  it('starts on the documented defaults: 21 points, 11 for a rest', async () => {
    const container = await mount()
    expect(buttonWithText(container, '21').getAttribute('aria-pressed')).toBe('true')
    expect(restPointsInput(container).value).toBe('11')
  })

  it('tracks rest points at half the target until the organiser sets them', async () => {
    const container = await mount()

    await click(buttonWithText(container, '16'))
    expect(restPointsInput(container).value).toBe('8')

    await click(buttonWithText(container, '11'))
    expect(restPointsInput(container).value).toBe('6')
  })

  it('refuses to submit an empty form', async () => {
    const container = await mount()
    expect(buttonWithText(container, 'Stwórz turniej').disabled).toBe(true)
  })

  it('shows the pairing formula only for an individual Mexicano', async () => {
    const container = await mount()
    expect(container.textContent).not.toContain('Formuła par')

    await click(buttonWithText(container, 'Mexicano'))
    expect(container.textContent).toContain('Formuła par')

    // Teams have no pair to balance, so the formula has nothing to arrange.
    await click(buttonWithText(container, 'Drużynowy'))
    expect(container.textContent).not.toContain('Formuła par')
  })

  it('offers round-1 seeding for Mexicano only', async () => {
    const container = await mount()
    expect(container.textContent).not.toContain('Rozstawienie pierwszej rundy')

    await click(buttonWithText(container, 'Mexicano'))
    expect(container.textContent).toContain('Rozstawienie pierwszej rundy')
  })

  it('relabels the roster section for teams', async () => {
    const container = await mount()
    expect(container.textContent).toContain('Uczestnicy (0)')

    await click(buttonWithText(container, 'Drużynowy'))
    expect(container.textContent).toContain('Drużyny (0)')
  })

  it('starts with two courts named in order', async () => {
    const container = await mount()
    expect(container.textContent).toContain('Kort 1')
    expect(container.textContent).toContain('Kort 2')
    expect(container.textContent).toContain('Korty (2)')
  })

  it('offers the scoring choice for Mexicano only', async () => {
    const container = await mount()
    // Americano spreads players across courts deliberately, so which court
    // somebody is on says nothing about the opposition.
    expect(container.textContent).not.toContain('Liczenie punktów')

    await click(buttonWithText(container, 'Mexicano'))
    expect(container.textContent).toContain('Liczenie punktów')
    expect(container.textContent).toContain('Z wagą kortu')
  })

  it('defaults to raw points, so nothing changes unless asked', async () => {
    const container = await mount()
    await click(buttonWithText(container, 'Mexicano'))

    const raw = buttonWithText(container, 'Zdobyte punkty — klasycznie, suma wyników')
    expect(raw.getAttribute('aria-checked')).toBe('true')
    // The neutral-rounds field is meaningless until court weighting is on.
    expect(container.querySelector('#neutralRounds')).toBeNull()
  })

  it('reveals the neutral-rounds field once court weighting is chosen', async () => {
    const container = await mount()
    await click(buttonWithText(container, 'Mexicano'))
    await click(buttonWithText(container, 'Z wagą kortu — wygrana na Korcie 1 warta więcej'))

    const field = container.querySelector<HTMLInputElement>('#neutralRounds')!
    expect(field).not.toBeNull()
    // One by default: round 1 of a Mexicano is a blind draw.
    expect(field.value).toBe('1')
  })

  it('warns when court weighting starts from the very first round', async () => {
    const container = await mount()
    await click(buttonWithText(container, 'Mexicano'))
    await click(buttonWithText(container, 'Z wagą kortu — wygrana na Korcie 1 warta więcej'))

    const field = container.querySelector<HTMLInputElement>('#neutralRounds')!
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(field, '0')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(container.textContent).toContain('szczęśliwy los w pierwszej rundzie')
  })
})
