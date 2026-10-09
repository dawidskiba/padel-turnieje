// @vitest-environment jsdom
/**
 * The stage between configuring a tournament and starting it: the organiser
 * sees the configuration and edits the roster and the courts in place, and
 * nothing is played until they press start.
 */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { SetupState } from '../desk/SetupState'
import type { SetupActions } from '../desk/SetupState'
import { courts, makeState, roster } from '../../domain/__tests__/factory'

function actions(): SetupActions {
  return {
    addParticipant: vi.fn(),
    retireParticipant: vi.fn(),
    unretireParticipant: vi.fn(),
    removeParticipant: vi.fn(),
    addCourt: vi.fn(),
    renameCourt: vi.fn(),
    removeCourt: vi.fn(),
    restoreCourt: vi.fn(),
    deleteCourt: vi.fn(),
    updateScoring: vi.fn(),
    updateSeed: vi.fn(),
    start: vi.fn(),
    deleteTournament: vi.fn(),
  }
}

async function mount(spy: SetupActions): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.append(container)
  const state = makeState({
    format: 'mexicano',
    pairingFormula: '1+4v2+3',
    participants: roster('Ann', 'Bob', 'Cara', 'Dan', 'Ewa', 'Filip', 'Gosia', 'Hubert'),
    courts: courts(2),
  })
  await act(async () => {
    createRoot(container).render(<SetupState state={state} actions={spy} />)
  })
  return container
}

function button(container: HTMLElement, text: string, within?: string): HTMLButtonElement {
  const scope = within
    ? [...container.querySelectorAll('li')].find((li) => li.textContent?.includes(within)) ??
      [...container.querySelectorAll('li')].find((li) =>
        li.querySelector<HTMLInputElement>('input')?.value === within,
      )
    : container
  if (!scope) throw new Error(`no row for ${within}`)
  const found = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  if (!found) throw new Error(`no button "${text}"${within ? ` in ${within}` : ''}`)
  return found as HTMLButtonElement
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click()
  })
}

describe('setup screen', () => {
  it('summarises the configuration', async () => {
    const container = await mount(actions())
    expect(container.textContent).toContain('Mexicano · indywidualny')
    expect(container.textContent).toContain('#1+#4 v #2+#3')
  })

  it('lists every participant and court with a way to remove it', async () => {
    const spy = actions()
    const container = await mount(spy)

    await click(button(container, 'Usuń', 'Cara'))
    expect(spy.removeParticipant).toHaveBeenCalledWith('cara')

    // Nothing has been played on a court yet, so it is deleted, not switched off.
    await click(button(container, 'Usuń', 'Kort 2'))
    expect(spy.deleteCourt).toHaveBeenCalledWith('kort2')
    expect(spy.removeCourt).not.toHaveBeenCalled()
  })

  it('adds a court under the next free name', async () => {
    const spy = actions()
    const container = await mount(spy)
    await click(button(container, '+ Dodaj Kort 3'))
    expect(spy.addCourt).toHaveBeenCalledWith('Kort 3', 3)
  })

  it('asks before deleting the tournament', async () => {
    const spy = actions()
    const container = await mount(spy)

    await click(button(container, 'Usuń turniej'))
    expect(spy.deleteTournament).not.toHaveBeenCalled()

    await click(button(container, 'Tak, usuń turniej'))
    expect(spy.deleteTournament).toHaveBeenCalledOnce()
  })

  it('starts only when asked', async () => {
    const spy = actions()
    const container = await mount(spy)
    expect(spy.start).not.toHaveBeenCalled()

    await click(button(container, 'Rozpocznij turniej'))
    expect(spy.start).toHaveBeenCalledOnce()
  })
})
