/**
 * The share screen: a QR code big enough to point sixteen phones at, once, at
 * the start of the evening.
 *
 * Rendered client-side rather than through an image service — the slug is a
 * read capability for the tournament (ADR-0002) and should not be handed to a
 * third party just to draw squares.
 */

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

import { Button, Notice } from './primitives'

export function QrCode({ value, size = 320 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      // Fixed black on white regardless of theme: a QR code is scanned by a
      // camera, and tinting it to match the palette costs contrast for nothing.
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setDataUrl(url)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [value, size])

  if (failed) return <Notice tone="warning">Nie udało się wygenerować kodu QR.</Notice>
  if (!dataUrl) return <div style={{ width: size, height: size }} aria-hidden />

  return (
    <img
      src={dataUrl}
      alt={`Kod QR z adresem ${value}`}
      width={size}
      height={size}
      className="rounded-lg"
    />
  )
}

export function ShareBlock({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused; the link is on screen to be typed.
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-3">
        <QrCode value={url} />
      </div>

      <p className="break-all text-center text-sm text-text-muted">{url}</p>

      <Button variant="secondary" onClick={() => void copy()}>
        {copied ? '✓ Skopiowano' : 'Kopiuj link'}
      </Button>
    </div>
  )
}
