/**
 * REFINER × THE MERCHANT — Priority Close List
 * Manager-only. Ranked by risk_score so closing these items lifts Health Score fastest.
 */

import { useEffect, useState } from 'react'
import {
  fetchPriorityCloseList,
  type PriorityCloseItem,
} from '../lib/analytics'

type Props = {
  shopId?: string | null
  limit?: number
  onSelectProduct?: (productId: string) => void
  className?: string
}

export function PriorityCloseList({
  shopId,
  limit = 8,
  onSelectProduct,
  className = '',
}: Props) {
  const [items, setItems] = useState<PriorityCloseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const list = await fetchPriorityCloseList(limit, shopId)
      if (!cancelled) {
        setItems(list)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [shopId, limit])

  if (loading) {
    return (
      <div className={`rounded-xl border border-white/5 bg-white/[0.02] p-4 ${className}`}>
        <p className="text-xs text-stone-500">Loading priority list…</p>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className={`rounded-xl border border-white/5 bg-white/[0.02] p-4 ${className}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">
          Close first
        </p>
        <p className="mt-2 text-sm text-fresh">Nothing urgent — shelf is healthy.</p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-white/5 bg-white/[0.02] p-4 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">
        Close first
      </p>
      <p className="mt-0.5 text-[11px] text-stone-500">
        Highest impact on Shelf Health Score
      </p>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li key={item.product_id}>
            <button
              type="button"
              onClick={() => onSelectProduct?.(item.product_id)}
              className="focus-ring flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.04]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {item.name}
                </p>
                <p className="text-[11px] text-stone-500">{item.reason}</p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`text-xs font-semibold tabular-nums ${
                    item.days_left <= 0
                      ? 'text-urgent'
                      : item.days_left <= 2
                        ? 'text-amber-400'
                        : 'text-stone-400'
                  }`}
                >
                  {item.days_left <= 0
                    ? 'Expired'
                    : `${item.days_left}d left`}
                </p>
                <p className="text-[10px] text-stone-600">
                  ×{item.quantity}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
