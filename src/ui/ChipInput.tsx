/**
 * Type a name, press Enter, it becomes a chip and the field clears for the
 * next. Pasting a multi-line list adds every line at once — an organiser with
 * the names in a WhatsApp message is finished in one paste.
 *
 * Duplicates are refused as they are typed rather than at submit, and
 * case-insensitively, because "ann" and "Ann" are the same player standing on
 * the same court.
 */

import { useState } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'

import { Chip, TextInput } from './primitives'

/** Newlines, commas, semicolons and tabs — however the list was copied. */
export function splitPasted(text: string): string[] {
  return text
    .split(/[\n,;\t]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function ChipInput({
  id,
  values,
  onChange,
  placeholder,
  emptyHint,
}: {
  id: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  emptyHint?: string
}) {
  const [draft, setDraft] = useState('')
  const [rejected, setRejected] = useState<string | null>(null)

  const existing = new Set(values.map((v) => v.toLowerCase()))

  function add(names: string[]) {
    const accepted: string[] = []
    let duplicate: string | null = null

    for (const name of names) {
      const key = name.toLowerCase()
      if (existing.has(key)) {
        duplicate = name
        continue
      }
      existing.add(key)
      accepted.push(name)
    }

    if (accepted.length) onChange([...values, ...accepted])
    setRejected(duplicate)
  }

  function commitDraft() {
    const name = draft.trim()
    if (!name) return
    add([name])
    setDraft('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitDraft()
      return
    }
    // Backspace on an empty field removes the last chip — the fastest way to
    // undo a mistyped name without reaching for the mouse.
    if (event.key === 'Backspace' && draft === '' && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text')
    if (!/[\n,;\t]/.test(text)) return
    event.preventDefault()
    add(splitPasted(text))
    setDraft('')
  }

  return (
    <div className="space-y-3">
      <TextInput
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value)
          setRejected(null)
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={commitDraft}
        autoComplete="off"
      />

      {rejected ? (
        <p className="text-sm text-warning">„{rejected}” już jest na liście.</p>
      ) : null}

      {values.length === 0 ? (
        emptyHint ? <p className="text-sm text-text-muted">{emptyHint}</p> : null
      ) : (
        <ul className="flex flex-wrap gap-2">
          {values.map((value, index) => (
            <li key={`${value}-${index}`}>
              <Chip
                label={value}
                onRemove={() => onChange(values.filter((_, i) => i !== index))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
