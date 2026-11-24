import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { copyText } from '../lib/clipboard'
import { shortDate } from '../lib/format'
import { buildDigestText, groupByUrgency, todayLabel } from '../lib/report'
import { daysLabel, expiryTone } from '../lib/store'

export default function Digest({ products, onBack }) {
  const [toast, setToast] = useState('')
  const today = todayLabel()
  const buckets = groupByUrgency(products)
  const urgent = buckets.overdue.length + buckets.today.length
  const text = buildDigestText(buckets, today)

  function flash(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function copy() {
    const ok = await copyText(text)
    flash(ok ? 'Digest copied' : 'Could not copy the digest.')
  }

  async function share() {
    try {
      await navigator.share({ text })
    } catch {
      /* dismissed */
    }
  }

  const sections = [
    { key: 'overdue', title: 'Overdue', items: buckets.overdue },
    { key: 'today', title: 'Expires today', items: buckets.today },
    { key: 'soon', title: 'Next two days', items: buckets.soon },
    { key: 'later', title: 'Later', items: buckets.later },
  ].filter((s) => s.items.length)

  const stats = [
    { label: 'Overdue', value: buckets.overdue.length, cls: 'text-urgent' },
    { label: 'Today', value: buckets.today.length, cls: 'text-urgent' },
    { label: '1–2 days', value: buckets.soon.length, cls: 'text-warn' },
  ]

  const chartData = [
    { name: 'Urgent', count: buckets.overdue.length + buckets.today.length, color: '#ef4444' },
    { name: 'Warn', count: buckets.soon.length, color: '#f59e0b' },
    { name: 'Fresh', count: buckets.later.length, color: '#10b981' },
  ].filter((d) => d.count > 0)

  return (
    <div className="app-shell pb-32">
      <header className="flex items-center gap-2 px-5 pb-2 pt-6">
        <button
          onClick={onBack}
          className="focus-ring -ml-2 h-12 rounded-lg px-2 text-sm font-semibold text-stone-400"
        >
          ← Back
        </button>
        <h1 className="font-display text-base font-semibold text-white">Digest</h1>
      </header>

      <div className="px-5 pt-4">
        <p className="text-xs font-medium text-stone-500">{today}</p>
        <p className="mt-3 font-display text-[26px] font-bold leading-tight text-white">
          {urgent > 0 ? (
            <>
              {urgent} {urgent === 1 ? 'item needs' : 'items need'} you today
            </>
          ) : (
            <>Nothing urgent today</>
          )}
        </p>

        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} colors={['#ef4444', '#f59e0b', '#10b981']}>
          <XAxis dataKey="name" strokeDasharray="3 3" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip labelFormat={v => v} />
            <Legend verticalAlign="bottom" height={36} horizontalAlign="center" />
            <Bar dataKey="count" radius={4} />
        </BarChart>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="card px-3 py-3">
              <p className={`font-display text-xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
              <p className="mt-0.5 text-[11px] text-stone-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          {sections.length === 0 && (
            <div className="card px-5 py-8 text-center">
              <p className="font-display text-base font-semibold text-stone-200">Shelf is clear</p>
              <p className="mt-1 text-sm text-stone-500">Nothing is expiring any time soon.</p>
            </div>
          )}

          {sections.map((section) => (
            <section key={section.key}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                {section.title} · {section.items.length}
              </h2>
              <ul className="space-y-2">
                {section.items.map((p) => {
                  const tone = expiryTone(p.expiry_date)
                  return (
                    <li key={p.id} className="card flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-display text-[15px] font-semibold text-white">
                          {p.name}
                          <span className="ml-1.5 text-xs font-normal tabular-nums text-stone-500">
                            ×{p.quantity}
                          </span>
                        </p>
                        <p className="text-[11px] text-stone-500">{shortDate(p.expiry_date)}</p>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-semibold ${
                          tone === 'urgent'
                            ? 'text-urgent'
                            : tone === 'warn'
                              ? 'text-warn'
                              : 'text-fresh'
                        }`}
                      >
                        {daysLabel(p.expiry_date)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[420px] bg-gradient-to-t from-ink via-ink to-transparent px-5 pb-6 pt-8">
        <div className="flex gap-2">
          {typeof navigator !== 'undefined' && navigator.share && (
            <button onClick={share} className="btn-ghost-inset focus-ring flex-1">
              Share
            </button>
          )}
          <button onClick={copy} className="btn-gold focus-ring flex-[1.4]">
            Copy digest
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-44 z-40 mx-auto w-fit max-w-[320px] rounded-full border border-white/10 bg-surface-elevated px-4 py-2 text-center text-xs font-medium text-white backdrop-blur"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
