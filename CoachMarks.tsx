/**
 * REFINER × THE MERCHANT — First-run progressive coach marks (M-004)
 * Shows once per device (localStorage). Three sequential tips.
 */

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'merchant_coach_v1'

type Step = {
  id: string
  title: string
  body: string
  /** CSS selector or data attribute target — position tooltip near this */
  anchor?: string
}

const STEPS: Step[] = [
  {
    id: 'camera',
    title: 'Scan with the camera',
    body: 'Point at a barcode. We look up the product and start tracking expiry.',
    anchor: '[data-coach="camera"]',
  },
  {
    id: 'urgency',
    title: 'Colours mean urgency',
    body: 'Red = expired or today. Amber = next two days. Green = fine for now.',
    anchor: '[data-coach="urgency"]',
  },
  {
    id: 'add',
    title: 'Add anything',
    body: 'No barcode? Tap + Add and type the name and expiry date.',
    anchor: '[data-coach="add"]',
  },
]

type Props = {
  enabled?: boolean
  onComplete?: () => void
}

export function CoachMarks({ enabled = true, onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
      setStepIndex(0)
    } catch {
      // private mode etc.
    }
  }, [enabled])

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
    setStepIndex(null)
    onComplete?.()
  }

  function next() {
    if (stepIndex == null) return
    if (stepIndex >= STEPS.length - 1) {
      finish()
    } else {
      setStepIndex(stepIndex + 1)
    }
  }

  if (stepIndex == null) return null
  const step = STEPS[stepIndex]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink p-5 shadow-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
          Tip {stepIndex + 1} of {STEPS.length}
        </p>
        <h2 id="coach-title" className="mt-2 font-display text-lg font-bold text-white">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-400">{step.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-stone-500 hover:text-stone-300"
          >
            Skip
          </button>
          <button type="button" onClick={next} className="btn-gold focus-ring !h-9 !px-4 !text-sm">
            {stepIndex >= STEPS.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
