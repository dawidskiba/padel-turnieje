/**
 * Overriding who sits out. The rota is balanced automatically; this exists for
 * the things it cannot know — someone arrived late, someone needs a breather,
 * someone has to leave at nine.
 *
 * Pairings are deliberately not editable here: a hand-made swap would break the
 * partner-variety guarantee. A round that is wrong as a whole gets undone and
 * regenerated instead.
 */

import { useState } from 'react'

import type { History } from '../../domain/history'
import type { Participant } from '../../domain/types'
import { Sheet } from '../../ui/Sheet'
import { Button, Notice, cx } from '../../ui/primitives'

export function RestPicker({
  open,
  onClose,
  participants,
  history,
  required,
  initial,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  participants: Participant[]
  history: History
  /** How many must rest — fixed by the roster and the courts. */
  required: number
  initial: string[]
  onConfirm: (resting: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(initial)

  if (!open) return null

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  const counts = participants.map(
    (p) => history.restCount(p.id) + (selected.includes(p.id) ? 1 : 0),
  )
  const spread = counts.length ? Math.max(...counts) - Math.min(...counts) : 0
  const balanced = spread <= 1
  const exact = selected.length === required

  return (
    <Sheet open onClose={onClose} title="Kto pauzuje?" size="lg">
      <p className="mb-4 text-sm text-text-muted">
        Wybierz {required} {required === 1 ? 'osobę' : 'osoby'}. Zaznaczonych: {selected.length}.
      </p>

      <ul className="mb-4 grid gap-2 sm:grid-cols-2">
        {participants.map((participant) => {
          const isResting = selected.includes(participant.id)
          const rests = history.restCount(participant.id)
          return (
            <li key={participant.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isResting}
                onClick={() => toggle(participant.id)}
                className={cx(
                  'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                  isResting
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-border bg-surface text-text hover:border-accent',
                )}
              >
                <span>{participant.name}</span>
                <span className={cx('text-xs', isResting ? '' : 'text-text-muted')}>
                  pauz: {rests}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {!exact ? (
        <Notice tone="warning">
          Musisz zaznaczyć dokładnie {required} — tyle osób nie zmieści się na kortach.
        </Notice>
      ) : !balanced ? (
        // Warned, never blocked: the organiser is standing there and knows why.
        <Notice tone="warning">
          Przy tym wyborze różnica w liczbie pauz wyniesie {spread}. Możesz zatwierdzić mimo to.
        </Notice>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Anuluj
        </Button>
        <Button
          variant="primary"
          disabled={!exact}
          onClick={() => {
            onConfirm(selected)
            onClose()
          }}
        >
          Zatwierdź pauzy
        </Button>
      </div>
    </Sheet>
  )
}
