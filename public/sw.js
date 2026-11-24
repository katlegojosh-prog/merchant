/* THE MERCHANT service worker — instant repeat loads, safe updates. */
const VERSION = 'v2'
const SHELL = `merchant-shell-${VERSION}`
const ASSETS = `merchant-assets-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      // A failed precache must not block activation when offline.
      await cache.addAll(['/', '/index.html']).catch(() => {})
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k.startsWith('merchant-') && !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

// Lets the page drop stale caches before reloading into a new deploy.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'CLEAR_CACHES') return
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      event.ports[0]?.postMessage({ ok: true })
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never touch Supabase, OpenFoodFacts, analytics, or any other origin.
  if (url.origin !== self.location.origin) return
  // The Worker's API is never cached.
  if (url.pathname.startsWith('/api/')) return
  // Update checks must always hit the network.
  if (url.pathname === '/index.html') return

  if (request.mode === 'navigate') {
    event.respondWith(shellNetworkFirst(request))
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(networkFirst(request))
})

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res && res.ok) cache.put(request, res.clone())
  return res
}

/**
 * Network first: a deploy that deletes old hashed bundles must never be hidden
 * behind a cached shell. Cache is the offline fallback, not the default.
 */
async function shellNetworkFirst(request) {
  const cache = await caches.open(SHELL)
  try {
    const res = await fetch(request)
    if (res && res.ok) cache.put('/index.html', res.clone())
    return res
  } catch {
    const cached = (await cache.match(request)) || (await cache.match('/index.html'))
    return (
      cached ||
      new Response('<h1>Offline</h1><p>Reconnect to load THE MERCHANT.</p>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    )
  }
}

async function networkFirst(request) {
  const cache = await caches.open(ASSETS)
  try {
    const res = await fetch(request)
    if (res && res.ok) cache.put(request, res.clone())
    return res
  } catch (err) {
    const hit = await cache.match(request)
    if (hit) return hit
    throw err
  }
}
