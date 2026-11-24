const COLUMNS = [
  ['created_at', 'Timestamp (UTC)'],
  ['product_name', 'Product'],
  ['action', 'Action'],
  ['from_status', 'From'],
  ['to_status', 'To'],
  ['actor_email', 'Actor'],
]

function cell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Serialise audit events to spreadsheet-safe CSV (BOM so Excel reads UTF-8). */
export function eventsToCsv(events) {
  const lines = [COLUMNS.map(([, label]) => cell(label)).join(',')]
  for (const event of events) {
    lines.push(COLUMNS.map(([key]) => cell(event[key])).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}`
}

export function csvFilename(prefix = 'merchant-activity') {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
  return `${prefix}-${stamp}.csv`
}

/** Trigger a client-side download of the given CSV text. */
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
