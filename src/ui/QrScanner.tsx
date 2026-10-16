/**
 * Reads a QR code through the rear camera.
 *
 * iOS Safari has no BarcodeDetector, so frames are decoded with jsQR. Loaded
 * on demand from the join page: most visitors never open the camera, and the
 * decoder is not small.
 */

import jsQR from 'jsqr'
import { useEffect, useRef, useState } from 'react'

import { Notice } from './primitives'

/** Decoding every frame drains a phone's battery for no faster result. */
const SCAN_INTERVAL_MS = 200

export default function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })

    function scan() {
      const video = videoRef.current
      if (stopped || !video || !context) return

      if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
        if (code?.data) {
          onResultRef.current(code.data)
          return
        }
      }
      timer = window.setTimeout(scan, SCAN_INTERVAL_MS)
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((media) => {
        if (stopped) {
          media.getTracks().forEach((track) => track.stop())
          return
        }
        stream = media
        const video = videoRef.current
        if (!video) return
        video.srcObject = media
        void video.play().then(scan)
      })
      .catch(() => setProblem('Brak dostępu do aparatu. Wpisz kod turnieju albo zezwól na aparat w ustawieniach.'))

    if (!navigator.mediaDevices) setProblem('Ta przeglądarka nie daje dostępu do aparatu. Wpisz kod turnieju.')

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  if (problem) return <Notice tone="warning">{problem}</Notice>

  return (
    // playsInline and muted: without them iOS opens the stream in its own
    // full-screen player instead of in the page.
    <video
      ref={videoRef}
      className="aspect-square w-full rounded-xl bg-black object-cover"
      playsInline
      muted
      aria-label="Podgląd z aparatu"
    />
  )
}
