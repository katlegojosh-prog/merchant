import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  changePassword,
  createStaff,
  getMyPlan,
  listStaff,
  removeStaff,
  startCheckout,
} from '../lib/store'

function friendly(err) {
  const code = err?.code || err?.message || ''
  if (code.includes('not_authorized')) return 'Only managers can manage staff.'
  if (code.includes('email_taken')) return 'That email already has an account.'
  if (code.includes('weak_password')) return 'Use at least 6 characters for the password.'
  if (code.includes('cannot_remove_self')) return 'You cannot remove your own account.'
  if (code.includes('staff_not_configured')) return 'Team management needs Supabase and the service role key.'
  if (code.includes('billing_not_configured')) return 'Billing is not configured for this deployment.'
  if (code.includes('unauthorized')) return 'Sign in again to manage the team.'
  return code || 'Something went wrong.'
}

export default function Team({ session, onBack }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [adding, setAdding] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState('free')
  const [billing, setBilling] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'Staff' })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)

  const myEmail = session?.email
  const isManager = session?.role === 'Manager'

  async function load() {
    try {
      setStaff(await listStaff())
      setError('')
    } catch (err) {
      setError(friendly(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    getMyPlan().then(setPlan)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function upgrade() {
    setBilling(true)
    setError('')
    try {
      await startCheckout()
    } catch (err) {
      setError(friendly(err))
      setBilling(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.fullName.trim() || !form.email.trim() || form.password.length < 6) {
      setError('Fill in a name, an email and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      await createStaff({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      setForm({ fullName: '', email: '', password: '', role: 'Staff' })
      setAdding(false)
      await load()
      toast.success('Staff account created')
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id) {
    setBusy(true)
    try {
      await removeStaff(id)
      setConfirmId(null)
      await load()
      toast.error('Account removed')
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setError('')
    if (!pw.current) {
      setError('Enter your current password.')
      return
    }
    if (pw.next.length < 6) {
      setError('The new password needs at least 6 characters.')
      return
    }
    if (pw.next !== pw.confirm) {
      setError('The new passwords do not match.')
      return
    }
    setPwBusy(true)
    try {
      await changePassword(pw.current, pw.next)
      setPw({ current: '', next: '', confirm: '' })
      toast('Password updated')
    } catch (err) {
      setError(friendly(err))
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="app-shell pb-12">
      <header className="flex items-center justify-between px-5 pb-2 pt-6">
        <button
          type="button"
          onClick={onBack}
          className="focus-ring -ml-2 h-12 rounded-lg px-2 text-sm font-semibold text-stone-400"
        >
          ← Back
        </button>
        <h1 className="font-display text-base font-semibold text-white">Team</h1>
        <span className="w-12" aria-hidden="true" />
      </header>

      <div className="px-5 pt-4">
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-urgent/10 px-3 py-2 text-sm text-urgent">
            {error}
          </p>
        )}

        {isManager && (
          <div className="card mb-4 flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-white">Plan</p>
              <p className="text-[11px] text-stone-500">
                {plan === 'pro' ? 'Merchant Pro is active' : 'Free — expiry reminders included'}
              </p>
            </div>
            {plan === 'pro' ? (
              <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-semibold text-gold ring-1 ring-inset ring-gold/30">
                Pro
              </span>
            ) : (
              <button
                type="button"
                onClick={upgrade}
                disabled={billing}
                className="btn-gold focus-ring shrink-0 !h-10 !w-auto !px-3 !text-[13px] disabled:opacity-60"
              >
                {billing ? 'Opening…' : 'Upgrade'}
              </button>
            )}
          </div>
        )}

        {isManager && (
          !adding ? (
            <button type="button" onClick={() => setAdding(true)} className="btn-gold focus-ring">
              + Add staff
            </button>
          ) : (
            <form onSubmit={handleAdd} className="card space-y-3 p-4">
              <p className="font-display text-sm font-semibold text-white">New staff account</p>
              <input
                className="field focus-ring"
                placeholder="Full name"
                aria-label="Full name"
                autoComplete="off"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              <input
                className="field focus-ring"
                type="email"
                inputMode="email"
                placeholder="Email"
                aria-label="Email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                className="field focus-ring"
                type="password"
                autoComplete="new-password"
                placeholder="Temporary password (6+ characters)"
                aria-label="Temporary password"
                spellCheck={false}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Role">
                {['Staff', 'Manager'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={form.role === r}
                    onClick={() => setForm({ ...form, role: r })}
                    className={`focus-ring h-12 rounded-xl border text-[15px] font-semibold transition ${
                      form.role === r
                        ? 'border-gold bg-gold/15 text-gold'
                        : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="btn-ghost focus-ring flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-gold focus-ring flex-1 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Create account'}
                </button>
              </div>
            </form>
          )
        )}

        <form onSubmit={handlePasswordChange} className="card mt-4 space-y-3 p-4">
          <p className="font-display text-sm font-semibold text-white">Change your password</p>
          <input
            type="password"
            autoComplete="current-password"
            className="field focus-ring"
            placeholder="Current password"
            aria-label="Current password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
          <input
            type="password"
            autoComplete="new-password"
            className="field focus-ring"
            placeholder="New password (6+ characters)"
            aria-label="New password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
          <input
            type="password"
            autoComplete="new-password"
            className="field focus-ring"
            placeholder="Confirm new password"
            aria-label="Confirm new password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
          <button type="submit" disabled={pwBusy} className="btn-gold focus-ring disabled:opacity-60">
            {pwBusy ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <h2 className="mb-2 mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          Staff <span className="section-count">{staff.length}</span>
        </h2>

        {loading ? (
          <div className="space-y-2" role="status" aria-label="Loading staff">
            <div className="skeleton h-[64px]" />
            <div className="skeleton h-[64px]" />
          </div>
        ) : staff.length === 0 ? (
          <div className="card px-5 py-8 text-center">
            <p className="font-display text-sm font-semibold text-stone-200">No staff yet</p>
            <p className="mt-1 text-[12px] text-stone-500">Add a teammate to share the shelf.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {staff.map((person) => {
              const isMe = person.email === myEmail
              const manager = person.role === 'Manager'
              return (
                <li key={person.id} className="card flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-semibold text-white">
                      {person.full_name || person.email.split('@')[0]}
                      {isMe && (
                        <span className="ml-1.5 text-[11px] font-normal text-stone-500">you</span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-stone-500">{person.email}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                      manager
                        ? 'bg-gold/12 text-gold ring-gold/30'
                        : 'bg-white/[0.06] text-stone-300 ring-white/12'
                    }`}
                  >
                    {person.role}
                  </span>
                  {isManager && !isMe && (
                    <button
                      type="button"
                      onClick={() =>
                        confirmId === person.id ? handleRemove(person.id) : setConfirmId(person.id)
                      }
                      disabled={busy}
                      className={`focus-ring h-9 shrink-0 rounded-lg px-2 text-[11px] font-semibold transition ${
                        confirmId === person.id
                          ? 'bg-urgent/15 text-urgent ring-1 ring-inset ring-urgent/30'
                          : 'text-stone-500 hover:text-stone-200'
                      }`}
                    >
                      {confirmId === person.id ? 'Confirm' : 'Remove'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

}
    </div>
  )
}
