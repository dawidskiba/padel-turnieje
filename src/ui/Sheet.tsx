/**
 * A modal sheet — the settings panel, the score popup, the QR screen.
 *
 * Deliberately small rather than a dependency: what the app needs is Escape to
 * close, a click on the backdrop to close, focus moved inside on open and
 * returned on close, and a title the screen reader announces.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { cx } from './primitives'

export function Sheet({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'md' | 'lg' | 'full'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  const close = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    // The page behind must not scroll while a sheet is over it — on a tablet
    // that reads as the whole app sliding around under your thumb.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused.current?.focus()
    }
  }, [open, close])

  if (!open) return null

  const widths = {
    md: 'max-w-md',
    lg: 'max-w-2xl',
    full: 'max-w-5xl',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-border bg-surface-raised p-6 shadow-2xl outline-none',
          widths[size],
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-medium text-text">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Zamknij"
            className="rounded-lg px-2 py-1 text-text-muted transition-colors hover:bg-surface hover:text-text"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
