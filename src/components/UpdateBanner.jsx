import { useEffect, useRef, useState } from 'react'

const CHECK_INTERVAL = 5 * 60 * 1000

function currentBundle() {
  const script = document.querySelector('script[type="module"][src*="/assets/"]')
  return script ? script.getAttribute('src') : null
}

async function latestBundle() {
  const res = await fetch('/index.html', { cache: 'no-store' })
  if (!res.ok) return null
  const html = await res.text()
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/)
  return match ? match[1] : null
}

export default function UpdateBanner() {
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const armed = useRef(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    armed.current = true

    let cancelled = false

    async function check() {
      if (!armed.current || cancelled) return
      try {
        const [here, there] = await Promise.all([currentBundle(), latestBundle()])
        if (!cancelled && here && there && here !== there) setReady(true)
      } catch {
        /* offline or transient — try again next time */
      }
    }

    const onFocus = () => check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, CHECK_INTERVAL)
    const first = setTimeout(check, 8000)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
      clearTimeout(first)
    }
  }, [])

  async function refresh() {
    setRefreshing(true)
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      const worker = reg?.active || navigator.serviceWorker?.controller
      if (worker) {
        await new Promise((resolve) => {
          const channel = new MessageChannel()
          channel.port1.onmessage = resolve
          worker.postMessage({ type: 'CLEAR_CACHES' }, [channel.port2])
          setTimeout(resolve, 1000)
        })
      }
    } catch {
      /* fall through to a plain reload */
    }
    window.location.reload()
  }

  if (!ready || dismissed) return null

  return (
    <div
      className="fixed inset-x-0 bottom-24 z-50 mx-auto max-w-[420px] px-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-card/95 px-3 py-2 shadow-xl backdrop-blur">
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-stone-300">
          <span className="font-semibold text-white">New version ready.</span> Refresh to update.
        </p>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="focus-ring h-11 shrink-0 rounded-lg bg-gold px-3 text-[13px] font-semibold text-ink disabled:opacity-70"
        >
          {refreshing ? 'Updating…' : 'Refresh'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update banner"
          className="focus-ring h-11 w-7 shrink-0 rounded-lg text-base text-stone-400"
        >
          ×
        </button>
      </div>
    </div>
  )
}
