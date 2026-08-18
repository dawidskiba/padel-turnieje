/**
 * The small set of building blocks every screen uses.
 *
 * Colours come from the tokens in src/index.css, never from Tailwind's own
 * palette — that is what keeps both themes correct without duplicating markup.
 */

import { useEffect, useState } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export { cx }

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  secondary: 'bg-surface-raised text-text border border-border hover:border-accent',
  ghost: 'text-text-muted hover:text-text hover:bg-surface',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  // Generous hit areas throughout: this is operated on a tablet, standing up,
  // by someone who is also talking to players.
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-6 py-4 text-lg font-medium',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('rounded-xl border border-border bg-surface p-4', className)}
      {...props}
    />
  )
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cx('rounded-xl border border-border bg-surface', className)}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-text-muted">{hint}</p> : null}
    </div>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'w-full rounded-lg border border-border bg-bg px-3 py-3 text-text',
        'placeholder:text-text-muted focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

/**
 * A number field that can be emptied.
 *
 * `value={n} onChange={Number(...)}` looks obvious and is unusable: clearing the
 * box parses to 0, the 0 comes straight back as the rendered value, and typing
 * the real number then reads 04. So the box keeps its own text while it is being
 * edited, and only tells the parent about text that is actually a number.
 *
 * An empty box leaves the parent on its last good value, so validation does not
 * flash an error mid-keystroke; blurring it empty restores the number, because
 * an empty numeric setting is not a state the rest of the app should have to
 * handle.
 */
export function NumberInput({
  value,
  onValue,
  className,
  ...props
}: {
  value: number
  onValue: (value: number) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onValue'>) {
  const [text, setText] = useState(String(value))

  // Follow the prop when it moves on its own — rest points tracking the game
  // points, say — but not while the text says the same number, or every
  // keystroke would fight the buffer.
  useEffect(() => {
    setText((current) => (Number(current) === value && current.trim() !== '' ? current : String(value)))
  }, [value])

  return (
    <TextInput
      type="number"
      {...props}
      className={className}
      value={text}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        if (next.trim() === '') return
        const parsed = Number(next)
        if (Number.isFinite(parsed)) onValue(parsed)
      }}
      onBlur={(event) => {
        if (text.trim() === '' || !Number.isFinite(Number(text))) setText(String(value))
        else setText(String(Number(text)))
        props.onBlur?.(event)
      }}
    />
  )
}

/** A removable entry in a list built by typing — participants, courts. */
export function Chip({
  label,
  onRemove,
  tone = 'default',
}: {
  label: string
  onRemove?: () => void
  tone?: 'default' | 'accent'
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm',
        tone === 'accent'
          ? 'bg-accent text-on-accent'
          : 'border border-border bg-surface-raised text-text',
      )}
    >
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Usuń ${label}`}
          className="opacity-60 transition-opacity hover:opacity-100"
        >
          ✕
        </button>
      ) : null}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export function Notice({
  tone,
  children,
}: {
  tone: 'warning' | 'danger' | 'info'
  children: ReactNode
}) {
  const tones = {
    warning: 'border-warning/40 text-warning',
    danger: 'border-danger/40 text-danger',
    info: 'border-border text-text-muted',
  }
  return (
    <p className={cx('rounded-lg border px-3 py-2 text-sm', tones[tone])}>
      {tone === 'warning' ? '⚠ ' : tone === 'danger' ? '✕ ' : ''}
      {children}
    </p>
  )
}

export function Spinner({ label = 'Ładowanie…' }: { label?: string }) {
  return (
    <p role="status" className="text-sm text-text-muted">
      {label}
    </p>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <p className="text-text">{title}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  )
}
