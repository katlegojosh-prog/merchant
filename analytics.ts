/**
 * REFINER × THE MERCHANT — Analytics data access
 * Uses the SQL objects from Event_Schema + Advanced_Analytics.
 */

import { supabase } from './supabase'

export type HealthScore = {
  urgent_ratio: number
  resolution_rate: number
  avg_freshness_days: number
  health_score: number
}

export type HealthTrendPoint = {
  snapshot_date: string
  health_score: number
  delta?: number | null
}

export type PriorityCloseItem = {
  product_id: string
  name: string
  days_left: number
  quantity: number
  risk_score: number
  reason: string
}

/** Live Shelf Health Score (0–100) */
export async function fetchHealthScore(
  shopId?: string | null
): Promise<HealthScore | null> {
  const { data, error } = await supabase.rpc('shelf_health_score', {
    p_shop_id: shopId ?? null,
  })
  if (error) {
    console.warn('[analytics] shelf_health_score', error)
    return null
  }
  // rpc returns a set; take first row
  const row = Array.isArray(data) ? data[0] : data
  return row ?? null
}

/** Last N days of Health Score for sparkline */
export async function fetchHealthTrend(
  days = 7
): Promise<HealthTrendPoint[]> {
  const { data, error } = await supabase
    .from('v_health_score_trend')
    .select('snapshot_date, health_score, delta')
    .order('snapshot_date', { ascending: true })
    .limit(days)
  if (error) {
    console.warn('[analytics] health trend', error)
    return []
  }
  return data ?? []
}

/** Ranked list of products to close first */
export async function fetchPriorityCloseList(
  limit = 8,
  shopId?: string | null
): Promise<PriorityCloseItem[]> {
  const { data, error } = await supabase.rpc('priority_close_list', {
    p_shop_id: shopId ?? null,
    p_limit: limit,
  })
  if (error) {
    console.warn('[analytics] priority_close_list', error)
    return []
  }
  return data ?? []
}

/** Colour helper for Health Score */
export function healthScoreTone(
  score: number | null | undefined
): 'fresh' | 'warn' | 'urgent' {
  if (score == null) return 'warn'
  if (score >= 75) return 'fresh'
  if (score >= 50) return 'warn'
  return 'urgent'
}
