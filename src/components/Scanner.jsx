import { useEffect, useRef, useState } from 'react'

const ELEMENT_ID = 'merchant-scanner-region'

export default function Scanner({ onResult, onClose }) {
  const [error, setError] = useState('')
  const onResultRef = useRef(onResult)
  const handled = useRef(false)

  onResultRef.current = onResult

  useEffect(() => {
    let cancelled = false
    let scanner = null

    async function stop() {
      try {
        if (scanner && scanner.isScanning) await scanner.stop()
        scanner?.clear()
      } catch {
        /* already stopped */
      }
    }

    ;(async () => {
      try {
        const mod = await import('html5-qrcode')
        const Html5Qrcode = mod.Html5Qrcode
        if (cancelled) return
        scanner = new Html5Qrcode(ELEMENT_ID, { verbose: false })
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 160 } },
          (decoded) => {
            if (handled.current) return
            handled.current = true
            onResultRef.current(decoded)
            stop()
          },
          () => {},
        )
      } catch {
        if (!cancelled) {
          setError('Camera unavailable. Type the barcode instead, or allow camera access.')
        }
      }
    })()

    return () => {
      cancelled = true
      stop()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black">
      <div className="flex items-center justify-between px-5 pb-3 pt-6">
        <h2 className="font-display text-lg font-semibold text-white">Scan barcode</h2>
        <button
          onClick={onClose}
          className="focus-ring h-12 rounded-lg px-4 text-sm font-semibold text-stone-300"
        >
          Close
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        <div
          id={ELEMENT_ID}
          className="aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-card"
        />
      </div>

      <p className="px-6 pb-10 pt-4 text-center text-sm text-stone-400">
        {error || 'Point the camera at the product barcode.'}
      </p>
    </div>
  )
}
