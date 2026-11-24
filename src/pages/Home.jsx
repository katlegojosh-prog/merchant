import { useMemo, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import Badge from '../components/Badge'
import ProductThumb from '../components/ProductThumb'
import { copyText } from '../lib/clipboard'
import { shortDate } from '../lib/format'
import { buildDigestText, groupByUrgency, todayLabel } from '../lib/report'
import { closeProduct, daysLabel, daysLeft, expiryTone, updateProduct } from '../lib/store'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'today', label: 'Today' },
  { key: 'expired', label: 'Expired' },
]

/* Literal class names: Tailwind purges @layer classes that only exist in a
   template string, so the tone → class map must stay explicit. */
const CHIP_BY_TONE = {
  urgent: 'chip-urgent',
  warn: 'chip-warn',
  fresh: 'chip-fresh',
}

function matchesFilter(key, product) {
  const d = daysLeft(product.expiry_date)
  if (key === 'urgent') return d <= 2
  if (key === 'today') return d === 0
  if (key === 'expired') return d < 0
  return true
}

function filterClass(active) {
  return active
    ? 'bg-gold text-ink'
    : 'border border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
}

export default function Home({
  session,
  products,
  doneCount,
  loading,
  error,
  onAdd,
  onHistory,
  onDigest,
  onTeam,
  onActivity,
  onRefresh,
  onSignOut,
}) {
  const isManager = session?.role === 'Manager'
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const visible = useMemo(() => {
    return products
      .filter((p) => matchesFilter(filter, p))
      .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => daysLeft(a.expiry_date) - daysLeft(b.expiry_date))
  }, [products, filter, query])

  const counts = useMemo(() => {
    const base = { all: products.length, urgent: 0, today: 0, expired: 0 }
    for (const p of products) {
      const d = daysLeft(p.expiry_date)
      if (d <= 2) base.urgent += 1
      if (d === 0) base.today += 1
      if (d < 0) base.expired += 1
    }
    return base
  }, [products])

  function openProduct(product) {
    setDraft({
      id: product.id,
      name: product.name || '',
      quantity: product.quantity ?? 1,
      expiry_date: String(product.expiry_date || '').slice(0, 10),
      barcode: product.barcode || '',
      status: product.status === 'active' ? 'in-stock' : product.status || 'in-stock',
      size: product.size || '',
    })
  }

  async function copyReport() {
    const text = buildDigestText(groupByUrgency(products), todayLabel())
    const ok = await copyText(text)
    ok ? toast('Report copied') : toast.error('Could not copy the report.')
  }

  async function saveChanges() {
    if (!draft) return
    setBusy(true)
    try {
      await updateProduct(draft.id, {
        name: draft.name,
        size: draft.size,
        quantity: draft.quantity,
        expiry_date: draft.expiry_date,
        barcode: draft.barcode,
        status: draft.status,
      })
      setDraft(null)
      await onRefresh()
      toast('Product updated')
    } catch (err) {
      toast.error(err.message || 'Could not update the product.')
    } finally {
      setBusy(false)
    }
  }

  async function closeOut(status) {
    if (!draft) return
    setBusy(true)
    try {
      await closeProduct(draft, status)
      setDraft(null)
      await onRefresh()
      status === 'sold'
        ? toast('Marked as sold')
        : status === 'trashed'
          ? toast.error('Marked as trashed')
          : toast('Marked as out of stock')
    } catch (err) {
      toast.error(err.message || 'Could not update the product.')
    } finally {
      setBusy(false)
    }
  }

  const draftTone = draft ? expiryTone(draft.expiry_date) : 'fresh'

  return (
    <div className="app-shell pb-28">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-ink/95 px-5 pb-4 pt-6 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
              Expiry control
            </p>
            <h1 className="mt-1 font-display text-[22px] font-bold tracking-tight text-white">
              THE MERCHANT
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onSignOut}
              className="focus-ring rounded-lg px-1.5 py-1.5 text-[11px] font-medium text-stone-500 transition hover:text-stone-200"
            >
              Sign out
            </button>
            <button onClick={onAdd} className="btn-gold focus-ring !h-10 !w-auto !px-3.5 !text-[13px]">
              + Add
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-stone-400">
          <span>{session?.role || 'Signed in'}</span>
          
          {counts.urgent > 0 ? (
            <span className="font-semibold text-urgent">{counts.urgent} need attention</span>
          ) : (
            <span className="font-semibold text-fresh">All clear</span>
          )}
          {session?.demo && (
            <>
              
              <span className="demo-chip">demo workspace</span>
            </>
          )}
        </div>

        <nav className="mt-2 flex items-center gap-1" aria-label="Sections">
          {isManager && (
            <button onClick={onTeam} className="nav-link">
              Team
            </button>
          )}
          {isManager && (
            <button onClick={onActivity} className="nav-link">
              Activity
            </button>
          )}
          <button onClick={onDigest} className="nav-link">
            Digest
          </button>
          <button onClick={onHistory} className="nav-link">
            History{doneCount ? ` · ${doneCount}` : ''}
          </button>
        </nav>

        <div className="mt-4">
          <input
            type="search"
            className="field focus-ring"
            placeholder="Search products..."
            aria-label="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div
          className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label="Filter products"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`focus-ring h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition ${filterClass(filter === f.key)}`}
            >
              {f.label}
              <span
                className={`ml-1.5 tabular-nums ${filter === f.key ? 'text-ink/60' : 'text-stone-500'}`}
              >
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-5 pt-4">
        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-urgent/10 px-3 py-2 text-sm text-urgent">
            {error}
          </p>
        )}

        {loading && (
          <div className="space-y-3" aria-label="Loading products" role="status">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[74px] w-full" />
            ))}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="card mt-2 px-5 py-10 text-center">
            <p className="font-display text-base font-semibold text-stone-200">
              {filter === 'all' && !query ? 'Your shelf is empty' : 'Nothing matches'}
            </p>
            <p className="mx-auto mt-1 max-w-[30ch] text-sm text-stone-500">
              {filter === 'all' && !query
                ? 'Add your first product and the tracker will start warning you before things expire.'
                : 'Try another filter, or clear the search.'}
            </p>
            {filter === 'all' && !query && (
              <button onClick={onAdd} className="btn-primary focus-ring mx-auto mt-5 !h-11 !w-auto !px-5">
                Add your first product
              </button>
            )}
          </div>
        )}

        <ul className="space-y-3">
          {!loading &&
            visible.map((p) => {
              const tone = expiryTone(p.expiry_date)
              const accent =
                tone === 'urgent'
                  ? 'border-l-urgent'
                  : tone === 'warn'
                    ? 'border-l-warn'
                    : 'border-l-fresh'
              const sizeLabel = p.size ? ` · ${p.size}` : ''
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openProduct(p)}
                    className={`row-tap focus-ring ${accent}`}
                    aria-label={`${p.name}${p.size ? `, ${p.size}` : ''}, ${p.quantity} in stock, ${daysLabel(p.expiry_date)}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[16px] font-semibold text-white">
                        {p.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-500">
                        <span className="tabular-nums"><Minus className="h-3 w-3 text-stone-400" /> {p.quantity}</span>
                        {sizeLabel && (
                          <>
                            
                            <span className="truncate">{p.size}</span>
                          </>
                        )}
                        
                        <span>{shortDate(p.expiry_date)}</span>
                      </p>
                    </div>
                    <ProductThumb product={p} />
                    <Badge tone={tone}>{daysLabel(p.expiry_date)}</Badge>
                  </button>
                </li>
              )
            })}
        </ul>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[420px] bg-gradient-to-t from-ink via-ink to-transparent px-5 pb-6 pt-8">
        <div className="safe-bottom flex gap-2">
          <button type="button" onClick={copyReport} className="btn-ghost-inset focus-ring flex-1">
            Copy report
          </button>
          <button type="button" onClick={onAdd} className="btn-gold focus-ring flex-[1.4]">
            + Add product
          </button>
        </div>
      </div>

      {draft && (
        <div
          className="fixed inset-0 z-30 flex items-end bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${draft.name || 'Product'} details`}
          onClick={() => !busy && setDraft(null)}
        >
          <div
            className="mx-auto w-full max-w-[420px] rounded-t-3xl border-t border-white/10 bg-surface-elevated px-5 pb-8 pt-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gold/40" />

            <div className="flex items-start gap-3">
              <ProductThumb product={draft} size={44} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-xl font-semibold tracking-tight text-white">
                  {draft.name || 'Untitled product'}
                </h2>
                <p className="mt-0.5 text-sm text-stone-400">
                  {draft.quantity}
                  {draft.size ? ` · ${draft.size}` : ''} · Expiry {shortDate(draft.expiry_date)}
                </p>
              </div>
              <span className={`${CHIP_BY_TONE[draftTone]} shrink-0`}>
                {daysLabel(draft.expiry_date)}
              </span>
            </div>

            {isManager ? (
              <div className="mt-5 space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="edit-name" className="text-[11px] font-medium text-stone-400">
                    Name
                  </label>
                  <input
                    id="edit-name"
                    className="field focus-ring w-full"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="edit-size" className="text-[11px] font-medium text-stone-400">
                    Size
                  </label>
                  <input
                    id="edit-size"
                    className="field focus-ring w-full"
                    placeholder="e.g. 12oz, 500g"
                    value={draft.size}
                    onChange={(e) => setDraft({ ...draft, size: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="edit-quantity" className="text-[11px] font-medium text-stone-400">
                      Quantity
                    </label>
                    <input
                      id="edit-quantity"
                      type="number"
                      min="1"
                      className="field focus-ring w-full tabular-nums"
                      value={draft.quantity}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="edit-expiry" className="text-[11px] font-medium text-stone-400">
                      Expiry date
                    </label>
                    <input
                      id="edit-expiry"
                      type="date"
                      className="field focus-ring w-full"
                      value={draft.expiry_date}
                      onChange={(e) => setDraft({ ...draft, expiry_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-stone-400">Status</span>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Status">
                    {[
                      { key: 'in-stock', label: 'In stock' },
                      { key: 'stock-out', label: 'Stock out' },
                    ].map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setDraft({ ...draft, status: s.key })}
                        aria-pressed={draft.status === s.key}
                        className={`focus-ring h-12 rounded-xl border text-[15px] font-semibold transition ${
                          draft.status === s.key
                            ? 'border-gold bg-gold/15 text-gold'
                            : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] leading-relaxed text-stone-400">
                Staff accounts can mark products as sold, trashed, or out of stock. Ask a manager to change names, sizes, quantities, or dates.
              </p>
            )}

            <div className="mt-6 space-y-2">
              {isManager && (
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={busy}
                  className="btn-gold focus-ring disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => closeOut('sold')}
                  disabled={busy}
                  className="btn-fresh focus-ring !text-[14px] disabled:opacity-60"
                >
                  Mark sold
                </button>
                <button
                  type="button"
                  onClick={() => closeOut('trashed')}
                  disabled={busy}
                  className="btn-danger focus-ring !text-[14px] disabled:opacity-60"
                >
                  Mark trashed
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDraft(null)}
                disabled={busy}
                className="btn-ghost focus-ring"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-[420px] px-5">
          <div className="rounded-xl border border-white/10 bg-surface-elevated px-4 py-3 shadow-xl shadow-black/50 backdrop-blur">
            <p className="text-[13px] text-stone-200">{toast}</p>
          </div>
        </div>
      )}
    </div>
  )
}
