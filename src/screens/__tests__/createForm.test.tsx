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

/**
 * React tracks an input's value, so assigning `.value` directly never reaches
 * onChange. The native setter is the only way to type in a test.
 */
async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function blur(input: HTMLInputElement) {
  // React maps onBlur onto focusout, which bubbles to its root listener; a
  // plain non-bubbling 'blur' event never reaches the handler.
  await act(async () => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
}

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
    await type(field, '0')

    expect(container.textContent).toContain('szczęśliwy los w pierwszej rundzie')
  })

  it('lets a number field be emptied and retyped without a leading zero', async () => {
    const container = await mount()
    await click(buttonWithText(container, 'Mexicano'))
    await click(buttonWithText(container, 'Z wagą kortu — wygrana na Korcie 1 warta więcej'))
    const field = container.querySelector<HTMLInputElement>('#neutralRounds')!

    // The bug this replaces: clearing parsed to 0, the 0 came back as the
    // rendered value, and typing 4 read "04".
    await type(field, '')
    expect(field.value).toBe('')
    await type(field, '4')
    expect(field.value).toBe('4')
  })

  it('keeps the last good number while the box is empty', async () => {
    const container = await mount()
    // Rest points start at 11; emptying the box must not flash a validation
    // error for 0, which is a legal but different setting.
    const field = restPointsInput(container)
    await type(field, '')

    expect(field.value).toBe('')
    expect(container.textContent).not.toContain('Punkty za pauzę nie mogą')
  })

  it('restores the number when an empty box loses focus', async () => {
    const container = await mount()
    const field = restPointsInput(container)
    await type(field, '')
    await blur(field)

    expect(field.value).toBe('11')
  })

  it('sends what was typed, not what was rendered', async () => {
    const container = await mount()
    await click(buttonWithText(container, 'Mexicano'))
    await click(buttonWithText(container, 'Z wagą kortu — wygrana na Korcie 1 warta więcej'))
    const field = container.querySelector<HTMLInputElement>('#neutralRounds')!

    await type(field, '')
    await type(field, '3')
    await blur(field)
    expect(field.value).toBe('3')
  })

  it('clears the custom points box when a preset is picked', async () => {
    const container = await mount()
    const custom = [...container.querySelectorAll<HTMLInputElement>('input[type=number]')].find(
      (i) => i.placeholder === '—',
    )!

    await type(custom, '24')
    expect(custom.value).toBe('24')

    await click(buttonWithText(container, '16'))
    expect(custom.value).toBe('')
  })
})
