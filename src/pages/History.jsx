import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ProductThumb from '../components/ProductThumb'
import { shortDate, timeAgo } from '../lib/format'
import { listProductEvents, reopenProduct } from '../lib/store'

const ACTION_LABEL = {
  created: 'added to the shelf',
  updated: 'edited',
  sold: 'marked sold',
  trashed: 'marked trashed',
  'stock-out': 'marked out of stock',
  reopened: 'restored to stock',
}

const ACTION_TONE = {
  sold: 'text-fresh',
  reopened: 'text-gold',
  trashed: 'text-urgent',
  'stock-out': 'text-urgent',
}

export default function History({ items, onBack, onRefresh }) {
  const [events, setEvents] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState('')

  async function loadEvents() {
    setEvents(await listProductEvents(10))
  }

  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  async function undo(item) {
    setBusyId(item.id)
    try {
      await reopenProduct(item)
      await onRefresh()
      await loadEvents()
      setToast(`${item.name} is back on the shelf`)
    } catch (err) {
      setToast(err.message || 'Could not restore the product.')
    } finally {
      setBusyId(null)
      setTimeout(() => setToast(''), 2600)
    }
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
        <h1 className="font-display text-base font-semibold text-white">History</h1>
      </header>

      <main className="px-5 pt-4">
        {items.length === 0 ? (
          <div className="card px-5 py-10 text-center">
            <p className="font-display text-base font-semibold text-stone-200">Nothing closed yet</p>
            <p className="mt-1 text-sm text-stone-500">
              Products you mark sold or trashed will appear here, with an undo if you change your
              mind.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((p) => {
              const sold = p.status === 'sold'
              const actor = p.closed_by || p.updated_by
              const when = timeAgo(p.closed_at)
              return (
                <li key={p.id} className="card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[16px] font-semibold text-stone-300">
                        {p.name}{p.size !== undefined && p.size !== null ? ' ××× ' + p.size : ''}
                        <span className="ml-1.5 text-xs font-normal tabular-nums text-stone-500">
                          ×{p.quantity}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        Expiry {shortDate(p.expiry_date)}
                      </p>
                      {actor && actor !== 'system' && actor !== 'demo' && (
                        <p className="mt-1 text-[10px] text-stone-400">
                          by {actor}
                          {when ? <span className="text-stone-600"> · {when}</span> : null}
                        </p>
                      )}
                    </div>
                    <ProductThumb product={p} />
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                        sold
                          ? 'bg-fresh/15 text-fresh ring-fresh/30'
                          : 'bg-urgent/15 text-urgent ring-urgent/30'
                      }`}
                    >
                      {sold ? 'Sold' : p.status === 'stock-out' ? 'Out' : 'Trashed'}
                    </span>
                  </div>

                  <button
                    onClick={() => undo(p)}
                    disabled={busyId === p.id}
                    className="focus-ring mt-3 h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] text-[12px] font-semibold text-stone-300 transition hover:border-gold/40 hover:text-gold disabled:opacity-60"
                  >
                    {busyId === p.id ? 'Restoring…' : '↺ Undo — put back on the shelf'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <h2 className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          Recent activity
        </h2>

        {events.length === 0 ? (
          <p className="text-[12px] text-stone-600">
            Every add, edit, close-out and undo will be recorded here.
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li key={event.id} className="card px-4 py-2.5">
                <p className="text-[13px] leading-snug text-stone-200">
                  <span className="font-semibold">{event.product_name || 'Product'}</span>{' '}
                  <span className={ACTION_TONE[event.action] || 'text-stone-400'}>
                    {ACTION_LABEL[event.action] || event.action}
                  </span>
                </p>
                <p className="mt-0.5 text-[10px] text-stone-500">
                  {event.actor_email || 'unknown'}
                  {event.created_at ? ` · ${timeAgo(event.created_at)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-40 mx-auto max-w-[420px] px-5">
          <div className="rounded-xl border border-white/10 bg-surface-elevated px-4 py-3 text-center text-[13px] text-stone-200 shadow-xl shadow-black/50">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
