/**
 * REFINER × THE MERCHANT — Engagement event tracker
 * Drop into src/lib/track.ts (or equivalent).
 * Non-blocking: never throws to the UI.
 */

import { supabase } from './supabase' // adjust import to your supabase client

export type EventType =
  | 'session_start'
  | 'session_end'
  | 'product_added'
  | 'product_edited'
  | 'status_changed'
  | 'digest_copied'
  | 'camera_opened'
  | 'barcode_success'
  | 'barcode_fail'
  | 'team_invite'

export type TrackOptions = {
  product_id?: string
  metadata?: Record<string, unknown>
}

export async function track(
  event_type: EventType,
  opts: TrackOptions = {}
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('engagement_events').insert({
      user_id: user.id,
      event_type,
      product_id: opts.product_id ?? null,
      metadata: opts.metadata ?? {},
    })
  } catch (err) {
    // Never break the main product flow
    console.warn('[REFINER track]', event_type, err)
  }
}

/** Convenience wrappers used at the exact call sites */
export const trackSessionStart = () => track('session_start')

export const trackSessionEnd = (duration_s: number, action_count: number) =>
  track('session_end', { metadata: { duration_s, action_count } })

export const trackProductAdded = (
  product_id: string,
  meta: { has_barcode?: boolean; via_camera?: boolean; name?: string } = {}
) => track('product_added', { product_id, metadata: meta })

export const trackStatusChanged = (
  product_id: string,
  meta: {
    from_status?: string
    to_status: string
    days_to_expiry?: number
  }
) => track('status_changed', { product_id, metadata: meta })

export const trackDigestCopied = (item_count: number, urgent_count: number) =>
  track('digest_copied', { metadata: { item_count, urgent_count } })

export const trackCameraOpened = () => track('camera_opened')

export const trackBarcodeSuccess = (
  barcode: string,
  openfoodfacts_hit: boolean
) =>
  track('barcode_success', {
    metadata: { barcode, openfoodfacts_hit },
  })

export const trackBarcodeFail = (barcode: string | null, reason?: string) =>
  track('barcode_fail', { metadata: { barcode, reason } })
