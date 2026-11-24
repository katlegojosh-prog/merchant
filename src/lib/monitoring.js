// Error monitoring (Sentry). Loaded lazily so the app shell stays small when
// VITE_SENTRY_DSN is unset, and so a blocked CDN never delays first paint.

const DSN = import.meta.env.VITE_SENTRY_DSN

export const isMonitoringConfigured = Boolean(DSN)

let sdk = null
let starting = null
let pendingUser = null

function applyUser() {
  if (!sdk) return
  sdk.setUser(pendingUser)
}

export function initMonitoring() {
  if (!isMonitoringConfigured || starting) return starting
  starting = import('@sentry/react')
    .then((mod) => {
      mod.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        // Errors only: no tracing, no replay, no PII beyond the signed-in email.
        tracesSampleRate: 0,
        sendDefaultPii: false,
      })
      sdk = mod
      applyUser()
      return mod
    })
    .catch(() => null)
  return starting
}

export function identifyUser(session) {
  pendingUser = session ? { email: session.email, role: session.role } : null
  applyUser()
}

export function reportError(error, context) {
  if (!sdk) return
  sdk.captureException(error, context ? { extra: context } : undefined)
}
