export function shortDate(iso) {
  if (!iso) return '—'
  return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

/** Compact phrasing for reports: "2d overdue" | "expires today" | "3d left". */
export function daysWord(days) {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'expires today'
  return `${days}d left`
}

/** "just now" · "12m ago" · "3h ago" · "4d ago" · "12 Nov" */
export function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  if (diff < 0) return 'just now'
  if (diff < 60000) return 'just now'
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Up to two initials for the image fallback tile. */
export function initials(name) {
  const words = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/* ------------------------------------------------------------------ */
/* product images                                                      */
/* ------------------------------------------------------------------ */

// OpenFoodFacts image paths contain a revision segment (front_en.879.400.jpg),
// so the URL can only be learned from the API. Resolved URLs are cached for a
// month per barcode, which keeps the shelf view to one request per new product.
const IMAGE_CACHE = 'merchant-image-cache'
const IMAGE_TTL = 30 * 86400000

function readImageCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(IMAGE_CACHE) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeImageCache(cache) {
  try {
    localStorage.setItem(IMAGE_CACHE, JSON.stringify(cache))
  } catch {
    /* quota — the image still renders this session */
  }
}

// A tiny external store so every thumbnail re-reads the cache the moment a new
// URL is learned, without per-component async state.
const imageListeners = new Set()
let imageVersion = 0

function notifyImages() {
  imageVersion += 1
  for (const listener of imageListeners) listener()
}

export function subscribeImages(listener) {
  imageListeners.add(listener)
  return () => imageListeners.delete(listener)
}

export function getImageVersion() {
  return imageVersion
}

const inflight = new Map()

/** Remember an image URL we already learned (e.g. from a barcode scan). */
export function rememberImage(barcode, url) {
  const code = String(barcode || '').replace(/\D/g, '')
  if (!code) return
  const cache = readImageCache()
  cache[code] = { url: url || '', at: Date.now() }
  writeImageCache(cache)
  notifyImages()
}

/** Cached image URL for a barcode, or null when unknown. */
export function cachedImageUrl(barcode) {
  const code = String(barcode || '').replace(/\D/g, '')
  if (code.length < 6) return null
  const hit = readImageCache()[code]
  if (!hit || Date.now() - hit.at > IMAGE_TTL) return null
  return hit.url || null
}

/** Resolve (and cache) the front image for a barcode. Null when unavailable. */
export function resolveProductImage(barcode) {
  const code = String(barcode || '').replace(/\D/g, '')
  if (code.length < 6) return Promise.resolve(null)

  const cached = readImageCache()[code]
  if (cached && Date.now() - cached.at <= IMAGE_TTL) return Promise.resolve(cached.url || null)

  // One request per barcode even when several rows share it.
  if (inflight.has(code)) return inflight.get(code)

  const request = fetch(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=image_front_small_url`,
  )
    .then(async (res) => {
      if (!res.ok) throw new Error('lookup failed')
      const data = await res.json()
      const url = data?.status === 1 ? data.product?.image_front_small_url || '' : ''
      rememberImage(code, url)
      return url || null
    })
    .catch(() => null)
    .finally(() => inflight.delete(code))

  inflight.set(code, request)
  return request
}
