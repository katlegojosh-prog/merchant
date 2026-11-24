import { useState } from 'react'
import { isDemoMode, signIn } from '../lib/store'

export default function Login({ onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Manager')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const demo = isDemoMode()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const session = await signIn(email.trim(), password, demo ? role : undefined)
      onSignedIn(session || { email, role: demo ? role : 'Staff' })
    } catch (err) {
      const msg = err.message?.includes('Invalid login')
        ? 'That email and password do not match.'
        : err.message || 'Could not sign in.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell justify-center px-5 pb-10 pt-16">
      <div className="mb-10">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold text-2xl font-bold text-ink shadow-lg shadow-gold/20">
          M
        </div>
        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white">
          THE
          <br />
          MERCHANT
        </h1>
        <p className="mt-3 max-w-[30ch] text-[15px] leading-relaxed text-stone-400">
          Know what is about to expire before it costs you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-stone-400">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            spellCheck={false}
            className="field focus-ring"
            placeholder="you@shop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-stone-400">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            spellCheck={false}
            className="field focus-ring"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {demo ? (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-stone-400">Demo role</span>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Demo role">
              {['Staff', 'Manager'].map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={role === r}
                  onClick={() => setRole(r)}
                  className={`focus-ring h-12 rounded-xl border text-[15px] font-semibold transition ${
                    role === r
                      ? 'border-gold bg-gold/15 text-gold'
                      : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-stone-600">
              Demo workspace: any email and password opens the app, and the data stays in this browser. The selected role applies only to this local demo.
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-stone-500">
            Your access level is determined by your account profile after sign-in.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-urgent/10 px-3 py-2 text-sm text-urgent">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-gold focus-ring mt-2 disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-stone-600">
        Accounts are created by your manager.
      </p>
    </div>
  )
}
