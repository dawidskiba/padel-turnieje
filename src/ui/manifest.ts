/**
 * Points the web app manifest at the current page while it is open.
 *
 * The static manifest starts at "/", the organiser's sign-in. A player who adds
 * the public page to their Home Screen — which iPhone requires before it will
 * deliver push notifications (ADR-0004) — must land back on their tournament,
 * not on a sign-in form they have no account for.
 *
 * The replacement is a blob URL, so every URL in it has to be absolute: relative
 * ones would resolve against "blob:" and break the icons.
 */

export function manifestFor(base: Record<string, unknown>, origin: string, path: string) {
  const icons = Array.isArray(base.icons)
    ? (base.icons as Array<Record<string, unknown>>).map((icon) => ({
        ...icon,
        src: new URL(String(icon.src), origin).href,
      }))
    : base.icons

  return {
    ...base,
    id: path,
    start_url: new URL(path, origin).href,
    scope: new URL('/', origin).href,
    icons,
  }
}

/** Returns a function that restores the original manifest. */
export function pointManifestAtCurrentPage(): () => void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link) return () => {}

  const original = link.getAttribute('href') ?? '/manifest.webmanifest'
  let blobUrl: string | null = null
  let cancelled = false

  fetch(original)
    .then((response) => response.json())
    .then((base: Record<string, unknown>) => {
      if (cancelled) return
      const manifest = manifestFor(base, location.origin, location.pathname)
      blobUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }))
      link.setAttribute('href', blobUrl)
    })
    .catch(() => {
      // Keep the static manifest: installing still works, it just opens on "/".
    })

  return () => {
    cancelled = true
    link.setAttribute('href', original)
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  }
}
