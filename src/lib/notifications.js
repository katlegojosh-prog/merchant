// Expiry reminders via Knock, orchestrated by the Worker at /api/notify.
// The Knock secret key never reaches the browser: the client only forwards its
// Supabase access token, and the Worker verifies it before triggering a workflow.
import { supabase, isSupabaseConfigured } from './supabaseClient'

/**
 * Ask the backend to schedule an expiry reminder for a saved product.
 * Fire-and-forget: reminders are an enhancement, never a blocker for saving.
 */
export async function scheduleExpiryReminder(product) {
  if (!isSupabaseConfigured || !product) return { skipped: true }

  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return { skipped: true }

    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: product.name,
        quantity: product.quantity,
        expiryDate: product.expiry_date,
      }),
    })

    // 501 = reminders not configured for this deployment. Stay silent.
    if (!res.ok) return { skipped: true }
    return { ok: true }
  } catch {
    return { skipped: true }
  }
}
