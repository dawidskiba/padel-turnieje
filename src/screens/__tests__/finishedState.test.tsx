// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { FinishedState } from '../desk/FinishedState'
import type { StandingRow } from '../../domain/types'

function row(
  name: string,
  position: number,
  points: number,
  extra: Partial<StandingRow> = {},
): StandingRow {
  return {
    participantId: name.toLowerCase(),
    name,
    entryOrder: position,
    retired: false,
    points,
    rawPoints: points,
    difference: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    rests: 0,
    position,
    ...extra,
  }
}

async function mount(standings: StandingRow[]): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.append(container)
  await act(async () => {
    createRoot(container).render(
      <FinishedState
        name="Test"
        standings={standings}
        onShare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    )
  })
  return container
}

/** The winner block is the bordered card at the top. */
function winnerCard(container: HTMLElement): HTMLElement {
  return container.querySelector('.border-accent') as HTMLElement
}

describe('the results screen names one winner unambiguously', () => {
  it('puts the winner alone, above the runners-up', async () => {
    const container = await mount([
      row('Ann', 1, 147),
      row('Bob', 2, 141),
      row('Cara', 3, 138),
      row('Dan', 4, 131),
    ])

    const card = winnerCard(container)
    expect(card.textContent).toContain('Zwycięzca')
    expect(card.textContent).toContain('Ann')
    // The runners-up must not be inside the winner card — that was the bug:
    // all three sat in one row and the eye landed on the leftmost.
    expect(card.textContent).not.toContain('Bob')
    expect(card.textContent).not.toContain('Cara')
  })

  it('reads in ranking order, so the first name on screen is the winner', async () => {
    const container = await mount([row('Ann', 1, 147), row('Bob', 2, 141), row('Cara', 3, 138)])
    const text = container.textContent ?? ''
    expect(text.indexOf('Ann')).toBeLessThan(text.indexOf('Bob'))
    expect(text.indexOf('Bob')).toBeLessThan(text.indexOf('Cara'))
  })

  it('shows only the top three on the podium', async () => {
    const container = await mount([
      row('Ann', 1, 147),
      row('Bob', 2, 141),
      row('Cara', 3, 138),
      row('Dan', 4, 131),
    ])
    // Dan appears in the full table below, but not among the medals.
    const medals = [...container.querySelectorAll('li')].map((li) => li.textContent ?? '')
    expect(medals.some((m) => m.includes('Dan'))).toBe(false)
  })

  it('declares a tie rather than crowning one of two equal leaders', async () => {
    // Equal on points, difference and wins: the standings share position 1, and
    // picking one of them would be wrong, not merely unclear.
    const container = await mount([
      row('Ann', 1, 147),
      row('Bob', 1, 147),
      row('Cara', 3, 138),
    ])

    const card = winnerCard(container)
    expect(card.textContent).toContain('Remis na 1. miejscu')
    expect(card.textContent).toContain('Ann')
    expect(card.textContent).toContain('Bob')
  })

  it('copes with a two-player result', async () => {
    const container = await mount([row('Ann', 1, 21), row('Bob', 2, 0)])
    expect(winnerCard(container).textContent).toContain('Ann')
    expect(container.textContent).toContain('Bob')
  })

  it('copes with a single participant', async () => {
    const container = await mount([row('Ann', 1, 11)])
    expect(winnerCard(container).textContent).toContain('Ann')
    expect(container.querySelectorAll('li')).toHaveLength(0)
  })

  it('renders nothing podium-shaped when there are no standings', async () => {
    const container = await mount([])
    expect(winnerCard(container)).toBeNull()
  })
})
