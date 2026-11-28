/**
 * REFINER × THE MERCHANT — Bulk multi-select action bar (M-005)
 *
 * Usage:
 *   const bulk = useBulkSelection()
 *   // long-press or "Select" on a product → bulk.enter(); bulk.toggle(id)
 *   // render <BulkActionBar ... /> when bulk.active
 */

import { useState } from 'react'
import { feedbackSuccess } from '../lib/haptics'
import { trackStatusChanged } from '../lib/track'

export type BulkCloseStatus = 'sold' | 'trashed' | 'out of stock'

type Props = {
  selectedIds: string[]
  /** Map id → { name, currentStatus, days_to_expiry } for tracking metadata */
  getMeta?: (id: string) => {
    name?: string
    from_status?: string
    days_to_expiry?: number
  }
  /** Your existing close API — called once per id */
  onClose: (id: string, status: BulkCloseStatus) => Promise<void>
  onDone?: () => void
  onCancel: () => void
  className?: string
}

const ACTIONS: { status: BulkCloseStatus; label: string; tone: string }[] = [
  { status: 'sold', label: 'Sold', tone: 'bg-fresh/20 text-fresh ring-fresh/30' },
  { status: 'trashed', label: 'Trashed', tone: 'bg-urgent/20 text-urgent ring-urgent/30' },
  {
    status: 'out of stock',
    label: 'Out of stock',
    tone: 'bg-stone-500/20 text-stone-300 ring-stone-500/30',
  },
]

export function BulkActionBar({
  selectedIds,
  getMeta,
  onClose,
  onDone,
  onCancel,
  className = '',
}: Props) {
  const [busy, setBusy] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<BulkCloseStatus | null>(
    null
  )

  const count = selectedIds.length
  const needsConfirm = count > 5

  async function run(status: BulkCloseStatus) {
    if (needsConfirm && confirmStatus !== status) {
      setConfirmStatus(status)
      return
    }
    setBusy(true)
    setConfirmStatus(null)
    try {
      for (const id of selectedIds) {
        await onClose(id, status)
        const meta = getMeta?.(id)
        await trackStatusChanged(id, {
          from_status: meta?.from_status,
          to_status: status,
          days_to_expiry: meta?.days_to_expiry,
        })
      }
      feedbackSuccess()
      onDone?.()
      onCancel()
    } catch (e) {
      console.warn('[BulkActionBar]', e)
    } finally {
      setBusy(false)
    }
  }

  if (count === 0) return null

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-ink/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur ${className}`}
    >
      <div className="mx-auto flex max-w-lg flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>
            <span className="font-semibold text-white">{count}</span> selected
          </span>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="font-medium text-stone-500 hover:text-stone-300"
          >
            Cancel
          </button>
        </div>

        {confirmStatus && (
          <p className="rounded-lg bg-urgent/10 px-3 py-2 text-center text-xs text-urgent">
            Close {count} items as “{confirmStatus}”? Tap again to confirm.
          </p>
        )}

        <div className="flex gap-2">
          {ACTIONS.map(({ status, label, tone }) => (
            <button
              key={status}
              type="button"
              disabled={busy}
              onClick={() => run(status)}
              className={`focus-ring flex-1 rounded-xl py-3 text-sm font-semibold ring-1 transition disabled:opacity-50 ${tone} ${
                confirmStatus === status ? 'ring-2' : ''
              }`}
            >
              {busy && confirmStatus === status ? '…' : label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
