/**
 * REFINER × THE MERCHANT — Shelf Health Score header card
 * Place in the sticky header next to role / urgent count.
 */

import { useEffect, useState } from 'react'
import {
  fetchHealthScore,
  fetchHealthTrend,
  healthScoreTone,
  type HealthScore,
  type HealthTrendPoint,
} from '../lib/analytics'

type Props = {
  shopId?: string | null
  onOpenAnalytics?: () => void
  className?: string
}

export function HealthScoreCard({
  shopId,
  onOpenAnalytics,
  className = '',
}: Props) {
  const [score, setScore] = useState<HealthScore | null>(null)
  const [trend, setTrend] = useState<HealthTrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [s, t] = await Promise.all([
        fetchHealthScore(shopId),
        fetchHealthTrend(7),
      ])
      if (!cancelled) {
        setScore(s)
        setTrend(t)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [shopId])

  const tone = healthScoreTone(score?.health_score)
  const toneClass =
    tone === 'fresh'
      ? 'text-fresh ring-fresh/30 bg-fresh/10'
      : tone === 'warn'
        ? 'text-amber-400 ring-amber-400/30 bg-amber-400/10'
        : 'text-urgent ring-urgent/30 bg-urgent/10'

  if (loading && !score) {
    return (
      <div
        className={`rounded-xl px-3 py-2 text-xs text-stone-500 ${className}`}
      >
        Health…
      </div>
    )
  }

  if (!score) return null

  const points = trend.map((p) => p.health_score)
  const spark = buildSparkline(points)

  return (
    <button
      type="button"
      onClick={onOpenAnalytics}
      className={`focus-ring flex flex-col items-end rounded-xl px-3 py-1.5 ring-1 transition hover:brightness-110 ${toneClass} ${className}`}
      title="Shelf Health Score — tap for details"
    >
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-lg font-bold tabular-nums leading-none">
          {Number(score.health_score).toFixed(0)}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">
          Health
        </span>
      </div>
      {spark && (
        <svg
          width="56"
          height="16"
          viewBox="0 0 56 16"
          className="mt-0.5 opacity-80"
          aria-hidden
        >
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={spark}
          />
        </svg>
      )}
      <div className="mt-0.5 flex gap-2 text-[10px] opacity-70">
        <span>{Math.round((score.urgent_ratio || 0) * 100)}% urgent</span>
        <span>
          {Math.round((score.resolution_rate || 0) * 100)}% resolved
        </span>
      </div>
    </button>
  )
}

/** Simple 0–100 series → SVG polyline points */
function buildSparkline(values: number[]): string | null {
  if (!values.length) return null
  const w = 56
  const h = 16
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 100)
  const range = max - min || 1
  return values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
