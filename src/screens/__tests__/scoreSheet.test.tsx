// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { ScoreSheet } from '../desk/ScoreSheet'
import type { ScoreTarget } from '../desk/ScoreSheet'

const target: ScoreTarget = {
  matchId: 'm1',
  courtName: 'Kort 2',
  sideLabel: 'Ewa + Hana',
  opponentLabel: 'Fred + Gus',
  current: null,
}

async function mount(gamePoints: number, onSave = vi.fn(), onClose = vi.fn()) {
  const container = document.createElement('div')
  document.body.append(container)

  await act(async () => {
    createRoot(container).render(
      <ScoreSheet
        target={target}
        gamePoints={gamePoints}
        onClose={onClose}
        onSave={onSave}
      />,
    )
  })

  return { container, onSave, onClose }
}

function gridButtons(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll('button')].filter((b) => /^\d+$/.test(b.textContent ?? ''))
}

describe('score sheet', () => {
  it('names the side being scored and who gets the remainder', async () => {
    const { container } = await mount(21)
    expect(container.textContent).toContain('Ewa + Hana')
    expect(container.textContent).toContain('Fred + Gus')
    expect(container.textContent).toContain('resztę do 21')
  })

  it('offers every score from 0 to the target inclusive', async () => {
    const { container } = await mount(21)
    const labels = gridButtons(container).map((b) => b.textContent)
    expect(labels).toHaveLength(22)
    expect(labels[0]).toBe('0')
    expect(labels[21]).toBe('21')
  })

  it('saves the tapped number and closes in one gesture', async () => {
    const { container, onSave, onClose } = await mount(21)
    const thirteen = gridButtons(container).find((b) => b.textContent === '13')!

    await act(async () => {
      thirteen.click()
    })

    expect(onSave).toHaveBeenCalledWith(13)
    expect(onClose).toHaveBeenCalled()
  })

  it('switches to a keypad above the grid limit', async () => {
    // A hundred fingertip-sized buttons is slower and less accurate than
    // typing two digits.
    const { container } = await mount(60)
    expect(gridButtons(container).length).toBeLessThan(15)
    expect(container.textContent).toContain('Zapisz')
  })

  it('keypad refuses a score above the target', async () => {
    const { container, onSave } = await mount(60)
    const digit = (d: string) =>
      [...container.querySelectorAll('button')].find((b) => b.textContent === d)!

    await act(async () => digit('9').click())
    await act(async () => digit('9').click())

    const save = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Zapisz',
    ) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    await act(async () => save.click())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('renders nothing when no side is selected', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    await act(async () => {
      createRoot(container).render(
        <ScoreSheet target={null} gamePoints={21} onClose={vi.fn()} onSave={vi.fn()} />,
      )
    })
    expect(container.textContent).toBe('')
  })
})
