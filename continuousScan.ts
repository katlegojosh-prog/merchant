/**
 * REFINER × THE MERCHANT — Continuous scan helpers (M-006)
 *
 * Integration notes (apply inside your existing camera / barcode component):
 *
 * 1. After a successful barcode lookup + product create:
 *    - Call feedbackSuccess() from haptics.ts
 *    - Call trackBarcodeSuccess + trackProductAdded
 *    - Do NOT tear down the camera stream
 *    - Show a brief toast (“Added · keep scanning”) then return focus to the live view
 *
 * 2. Name suggestion:
 *    - When OpenFoodFacts returns product_name (or product_name_en), pre-fill the name field
 *    - User can still edit before confirming
 *
 * 3. Recent barcodes:
 *    - Keep last 10 successful barcodes in memory or localStorage key `merchant_recent_barcodes`
 *    - Render as small chips above the camera; tap chip re-runs lookup
 */

const RECENT_KEY = 'merchant_recent_barcodes'
const MAX_RECENT = 10

export function pushRecentBarcode(barcode: string): string[] {
  if (!barcode) return getRecentBarcodes()
  try {
    const prev = getRecentBarcodes().filter((b) => b !== barcode)
    const next = [barcode, ...prev].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    return next
  } catch {
    return [barcode]
  }
}

export function getRecentBarcodes(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function clearRecentBarcodes(): void {
  try {
    localStorage.removeItem(RECENT_KEY)
  } catch {}
}
