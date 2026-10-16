/**
 * Service worker for round notifications (ADR-0004). It does nothing else: no
 * caching, no offline shell. The public page polls the database and should
 * never be served stale.
 *
 * The push payload is a PushMessage from supabase/functions/notify-round.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let message
  try {
    message = event.data ? event.data.json() : null
  } catch {
    message = null
  }
  if (!message) return

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      // A regenerated round reuses the tag. Without renotify it would replace
      // the old notification silently, and the player would miss the change.
      renotify: true,
      icon: '/icon-192.png',
      badge: '/favicon-32.png',
      data: { url: message.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url === url)
      if (open) return open.focus()
      return self.clients.openWindow(url)
    }),
  )
})
