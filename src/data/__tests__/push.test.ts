import { describe, expect, it } from 'vitest'

import { pushSupport, urlBase64ToUint8Array } from '../push'

const android = {
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  maxTouchPoints: 5,
  standalone: false,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  vapidKey: 'BExampleKey',
}

const iphoneSafari = {
  ...android,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  // Safari outside a Home Screen app exposes no Push API at all.
  hasPushManager: false,
  hasNotification: false,
}

describe('pushSupport', () => {
  it('works in a plain Android browser tab', () => {
    expect(pushSupport(android)).toBe('supported')
  })

  it('asks an iPhone to add the page to the Home Screen first', () => {
    expect(pushSupport(iphoneSafari)).toBe('needs-home-screen')
  })

  it('recognises an iPad, which reports itself as a Mac', () => {
    expect(pushSupport({ ...iphoneSafari, userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel' })).toBe(
      'needs-home-screen',
    )
  })

  it('works on an iPhone once opened from the Home Screen', () => {
    expect(pushSupport({ ...iphoneSafari, standalone: true, hasPushManager: true, hasNotification: true })).toBe(
      'supported',
    )
  })

  it('hides the feature when the deployment has no VAPID key', () => {
    expect(pushSupport({ ...android, vapidKey: undefined })).toBe('unsupported')
  })

  it('hides the feature in a browser without the Push API', () => {
    expect(pushSupport({ ...android, hasPushManager: false })).toBe('unsupported')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url without padding', () => {
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([0xfb, 0xff])
  })
})
