import { daysWord, shortDate } from './format'
import { daysLeft } from './store'

/** Bucket products by urgency so Home and Digest agree on the numbers. */
export function groupByUrgency(products) {
  const buckets = { overdue: [], today: [], soon: [], later: [] }
  for (const product of products) {
    const d = daysLeft(product.expiry_date)
    if (d < 0) buckets.overdue.push(product)
    else if (d === 0) buckets.today.push(product)
    else if (d <= 2) buckets.soon.push(product)
    else buckets.later.push(product)
  }
  return buckets
}

export function countUrgent(products) {
  return products.filter((p) => daysLeft(p.expiry_date) <= 2).length
}

/** WhatsApp/email-ready digest text. One source of truth for both screens. */
export function buildDigestText(buckets, today) {
  const lines = ['*THE MERCHANT — morning digest*', today, '']

  const push = (title, items) => {
    if (!items.length) return
    lines.push(`*${title}*`)
    for (const p of items) {
      const d = daysLeft(p.expiry_date)
      const dot = d <= 0 ? '🔴' : d <= 2 ? '🟠' : '🟢'
      lines.push(`${dot} ${p.name} ×${p.quantity} — ${daysWord(d)} (${shortDate(p.expiry_date)})`)
    }
    lines.push('')
  }

  push('Needs attention today', [...buckets.overdue, ...buckets.today])
  push('Next two days', buckets.soon)
  push('Later this week', buckets.later)
  if (lines.length === 3) lines.push('Nothing expiring. All clear.')

  return lines.join('\n').trim()
}

export function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
