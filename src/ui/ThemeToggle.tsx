import { cx } from './primitives'
import { useTheme } from './theme'
import type { ThemePreference } from './theme'

const OPTIONS: Array<{ value: ThemePreference; label: string; title: string }> = [
  { value: 'light', label: '☀', title: 'Jasny' },
  { value: 'system', label: '◐', title: 'Systemowy' },
  { value: 'dark', label: '☾', title: 'Ciemny' },
]

/**
 * Three states, not two. A plain light/dark switch cannot express "follow the
 * system", which is the default and what most people actually want — and once
 * you leave it you can never get back to it.
 */
export function ThemeToggle() {
  const { preference, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Motyw"
      className="inline-flex rounded-lg border border-border bg-surface p-1"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={preference === option.value}
          title={option.title}
          onClick={() => setTheme(option.value)}
          className={cx(
            'rounded px-3 py-1.5 text-sm transition-colors',
            preference === option.value
              ? 'bg-accent text-on-accent'
              : 'text-text-muted hover:text-text',
          )}
        >
          <span aria-hidden>{option.label}</span>
          <span className="sr-only">{option.title}</span>
        </button>
      ))}
    </div>
  )
}
