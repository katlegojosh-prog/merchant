import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { csvFilename, downloadCsv, eventsToCsv } from '../lib/csv'
import { timeAgo } from '../lib/format'
import { listEventActors, listProductEvents } from '../lib/store'

const ACTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'created', label: 'Added' },
  { value: 'updated', label: 'Edited' },
  { value: 'sold', label: 'Sold' },
  { value: 'trashed', label: 'Trashed' },
  { value: 'stock-out', label: 'Out of stock' },
  { value: 'reopened', label: 'Restored' },
]

const ACTION_TEXT = {
  created: 'added',
  updated: 'edited',
  sold: 'marked sold',
  trashed: 'marked trashed',
  'stock-out': 'marked out of stock',
  reopened: 'restored to stock',
}

const ACTION_CHIP = {
  created: 'chip-gold',
  updated: 'chip-neutral',
  sold: 'chip-fresh',
  trashed: 'chip-urgent',
  'stock-out': 'chip-urgent',
  reopened: 'chip-gold',
}

const PAGE_LIMIT = 200
const EXPORT_LIMIT = 1000

export default function Activity({ session, onBack }) {
  const isManager = session?.role === 'Manager'

  const [actor, setActor] = useState('all')
  const [action, setAction] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [events, setEvents] = useState([])
  const [actors, setActors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState('')

  const filters = useMemo(() => ({ actor, action, from, to }), [actor, action, from, to])
  const rangeInvalid = Boolean(from && to && from > to)

  useEffect(() => {
    if (!isManager) return
    listEventActors().then(setActors)
  }, [isManager])

  useEffect(() => {
    if (!isManager) return
    if (rangeInvalid) {
      setEvents([])
      setLoading(false)
      setError('The “from” date is after the “to” date.')
      return
    }
    let alive = true
    setLoading(true)
    setError('')
    listProductEvents({ ...filters, limit: PAGE_LIMIT })
      .then((rows) => {
        if (alive) setEvents(rows)
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load activity.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [filters, isManager, rangeInvalid])

  async function exportCsv() {
    if (rangeInvalid) return
    setExporting(true)
    try {
      const rows = await listProductEvents({ ...filters, limit: EXPORT_LIMIT })
      if (!rows.length) {
        toast.error('Nothing to export for these filters.')
        return
      }
      downloadCsv(csvFilename(), eventsToCsv(rows))
      toast(`${rows.length} ${rows.length === 1 ? 'event' : 'events'} exported`)
    } catch (err) {
      toast.error(err.message || 'Could not export the audit trail.')
    } finally {
      setExporting(false)
    }
  }

  function clearFilters() {
    setActor('all')
    setAction('all')
    setFrom('')
    setTo('')
  }

  const hasFilters = actor !== 'all' || action !== 'all' || from || to

  if (!isManager) {
    return (
      <div className="app-shell pb-12">
        <header className="flex items-center gap-2 px-5 pb-2 pt-6">
          <button
            onClick={onBack}
            className="focus-ring -ml-2 h-12 rounded-lg px-2 text-sm font-semibold text-stone-400"
          >
            ← Back
          </button>
          <h1 className="font-display text-base font-semibold text-white">Activity</h1>
        </header>
        <div className="px-5 pt-6">
          <div className="card px-5 py-10 text-center">
            <p className="font-display text-base font-semibold text-stone-200">Managers only</p>
            <p className="mx-auto mt-1 max-w-[32ch] text-sm text-stone-500">
              The full audit trail is restricted to manager accounts.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell pb-12">
      <header className="flex items-center gap-2 px-5 pb-2 pt-6">
        <button
          onClick={onBack}
          className="focus-ring -ml-2 h-12 rounded-lg px-2 text-sm font-semibold text-stone-400"
        >
          ← Back
        </button>
        <h1 className="font-display text-base font-semibold text-white">Activity</h1>
      </header>

      <div className="px-5 pt-4">
        <div className="card space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-stone-400">Actor</span>
              <select
                className="field focus-ring !h-11 !text-[14px]"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
              >
                <option value="all">Everyone</option>
                {actors.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-stone-400">Action</span>
              <select
                className="field focus-ring !h-11 !text-[14px]"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                {ACTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-stone-400">From</span>
              <input
                type="date"
                className="field focus-ring !h-11 !text-[14px]"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-stone-400">To</span>
              <input
                type="date"
                className="field focus-ring !h-11 !text-[14px]"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="btn-ghost focus-ring !h-10 !text-[13px]">
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-stone-500">
            {loading ? 'Loading…' : `${events.length}${events.length === PAGE_LIMIT ? '+' : ''} ${events.length === 1 ? 'event' : 'events'}`}
          </p>
          <button
            onClick={exportCsv}
            disabled={exporting || loading || events.length === 0}
            className="btn-gold focus-ring !h-10 !w-auto !px-3.5 !text-[13px] disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-urgent/10 px-3 py-2 text-sm text-urgent">
            {error}
          </p>
        )}

        {loading ? (
          <div className="mt-3 space-y-2" role="status" aria-label="Loading activity">
            <div className="skeleton h-[64px]" />
            <div className="skeleton h-[64px]" />
            <div className="skeleton h-[64px]" />
          </div>
        ) : events.length === 0 && !error ? (
          <div className="card mt-3 px-5 py-10 text-center">
            <p className="font-display text-base font-semibold text-stone-200">No events</p>
            <p className="mx-auto mt-1 max-w-[32ch] text-sm text-stone-500">
              {hasFilters
                ? 'Nothing matches these filters. Widen the dates or clear them.'
                : 'Add, edit or close out a product and it will appear here.'}
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {events.map((event) => (
              <li key={event.id} className="card px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-semibold text-white">
                      {event.product_name || 'Product'}
                    </p>
                    <p className="mt-0.5 text-[12px] text-stone-400">
                      {event.actor_email || 'unknown'}
                    </p>
                  </div>
                  <span className={`${ACTION_CHIP[event.action] || 'chip-neutral'} shrink-0`}>
                    {ACTION_TEXT[event.action] || event.action}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-stone-500">
                  {event.created_at && (
                    <>
                      <span>
                        {new Date(event.created_at).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden="true" />
                      <span>{timeAgo(event.created_at)}</span>
                    </>
                  )}
                  {event.from_status && event.to_status && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden="true" />
                      <span className="tabular-nums">
                        {event.from_status} → {event.to_status}
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      </div>
  )
}
