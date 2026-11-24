import { supabase, isSupabaseConfigured } from './supabaseClient'
import { scheduleExpiryReminder } from './notifications'
import { rememberImage } from './format'

const LOCAL_PRODUCTS = 'merchant-products'
const LOCAL_SESSION = 'merchant-session'
const LOCAL_SEEDED = 'merchant-seeded'
const LOCAL_EVENTS = 'merchant-events'

/** Statuses that count as "on the shelf". */
export const ACTIVE_STATUSES = ['in-stock', 'active']
/** Statuses that count as "closed out" (history). */
export const CLOSED_STATUSES = ['sold', 'trashed', 'stock-out']

/* ------------------------------------------------------------------ */
/* local storage                                                       */
/* ------------------------------------------------------------------ */

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_PRODUCTS)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal(items) {
  try {
    localStorage.setItem(LOCAL_PRODUCTS, JSON.stringify(items))
  } catch {
    /* storage full or blocked — nothing useful to do here */
  }
}

/* ------------------------------------------------------------------ */
/* audit trail                                                          */
/* ------------------------------------------------------------------ */

function readLocalEvents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_EVENTS) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function pushLocalEvent(event) {
  try {
    const list = readLocalEvents()
    list.unshift({
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      ...event,
    })
    localStorage.setItem(LOCAL_EVENTS, JSON.stringify(list.slice(0, 200)))
  } catch {
    /* auditing is best-effort */
  }
}

/**
 * Append one audit event. Never throws: a missing product_events table or a
 * failed insert must not block closing, reopening or editing stock.
 */
async function recordEvent({ product_id = null, product_name = null, action, from_status = null, to_status = null }) {
  if (!isSupabaseConfigured) {
    pushLocalEvent({ product_id, product_name, action, from_status, to_status, actor_email: 'you' })
    return
  }
  try {
    const me = await currentIdentity()
    await supabase.from('product_events').insert({
      product_id,
      product_name,
      action,
      from_status,
      to_status,
      actor_id: me.id,
      actor_email: me.email,
    })
  } catch {
    /* audit is additive */
  }
}

function dayStart(date) {
  if (!date) return null
  const d = new Date(`${date}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function dayEnd(date) {
  if (!date) return null
  const d = new Date(`${date}T23:59:59.999`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function matchesFilters(event, { actor, action, from, to }) {
  if (actor && actor !== 'all' && event.actor_email !== actor) return false
  if (action && action !== 'all' && event.action !== action) return false
  if (from && new Date(event.created_at) < new Date(`${from}T00:00:00`)) return false
  if (to && new Date(event.created_at) > new Date(`${to}T23:59:59.999`)) return false
  return true
}

/**
 * Audit events, newest first. Accepts a number (legacy) or an options object:
 * { limit, actor, action, from, to } — from/to are YYYY-MM-DD in local time.
 */
export async function listProductEvents(options = {}) {
  const opts = typeof options === 'number' ? { limit: options } : options
  const limit = Math.min(Math.max(Number(opts.limit) || 12, 1), 1000)
  const actor = opts.actor || 'all'
  const action = opts.action || 'all'
  const from = opts.from || ''
  const to = opts.to || ''

  if (!isSupabaseConfigured) {
    return readLocalEvents()
      .filter((event) => matchesFilters(event, { actor, action, from, to }))
      .slice(0, limit)
  }

  let query = supabase
    .from('product_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (actor !== 'all') query = query.eq('actor_email', actor)
  if (action !== 'all') query = query.eq('action', action)
  const start = dayStart(from)
  const end = dayEnd(to)
  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)

  const { data, error } = await query
  if (error) return []
  return data ?? []
}

/** Distinct actors seen recently, for the activity filter. */
export async function listEventActors() {
  if (!isSupabaseConfigured) {
    const actors = readLocalEvents().map((e) => e.actor_email).filter(Boolean)
    return [...new Set(actors)].sort()
  }
  const { data, error } = await supabase
    .from('product_events')
    .select('actor_email')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return []
  return [...new Set((data ?? []).map((e) => e.actor_email).filter(Boolean))].sort()
}

function readLocalSession() {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isDemoMode() {
  return !isSupabaseConfigured
}

/* ------------------------------------------------------------------ */
/* expiry maths — local calendar days, never milliseconds              */
/* ------------------------------------------------------------------ */

/** Whole days from today to the expiry date. Negative means overdue. */
export function daysLeft(expiryDate) {
  if (!expiryDate) return 0
  const [y, m, d] = String(expiryDate).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return 0
  const expiry = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((expiry.getTime() - today.getTime()) / 86400000)
}

export function daysLabel(expiryDate) {
  const d = daysLeft(expiryDate)
  if (d < 0) return `${Math.abs(d)}d overdue`
  if (d === 0) return 'Expires today'
  if (d === 1) return 'Tomorrow'
  if (d <= 7) return `${d} days left`
  return `${d} days left`
}

/** urgent = overdue or today · warn = next two days · fresh = later */
export function expiryTone(expiryDate) {
  const d = daysLeft(expiryDate)
  if (d <= 0) return 'urgent'
  if (d <= 2) return 'warn'
  return 'fresh'
}

function isoFromOffset(offsetDays) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* demo workspace (no Supabase configured)                             */
/* ------------------------------------------------------------------ */

const DEMO_SEED = [
  { name: 'Whole Milk 1L', barcode: '3178530402957', quantity: 6, offset: -1 },
  { name: 'Nutella 400g', barcode: '3017620422003', quantity: 4, offset: 0 },
  { name: 'Sourdough Loaf', barcode: '', quantity: 2, offset: 0 },
  { name: 'Chicken Breast 1kg', barcode: '3760020507350', quantity: 3, offset: 1 },
  { name: 'Coca-Cola 1L', barcode: '5449000000996', quantity: 5, offset: 2 },
  { name: 'Greek Yogurt 500g', barcode: '5201057001036', quantity: 2, offset: 9 },
  { name: 'Barilla Spaghetti 500g', barcode: '8076800105735', quantity: 8, offset: 120 },
]

function seedDemoIfEmpty() {
  if (isSupabaseConfigured) return
  try {
    if (localStorage.getItem(LOCAL_SEEDED)) return
    const items = readLocal()
    if (items.length === 0) {
      writeLocal(
        DEMO_SEED.map((p, i) => ({
          id: `demo-${i + 1}`,
          name: p.name,
          barcode: p.barcode,
          quantity: p.quantity,
          expiry_date: isoFromOffset(p.offset),
          status: 'in-stock',
          updated_by: 'demo',
        })),
      )
    }
    localStorage.setItem(LOCAL_SEEDED, '1')
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* identity                                                            */
/* ------------------------------------------------------------------ */

async function fetchProfile(userId) {
  if (!isSupabaseConfigured || !userId) return null
  // select('*'): profile tables vary between deployments (name vs full_name).
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) return null
  return data || null
}

async function normaliseSession(user, fallbackRole) {
  if (!user) return null
  const profile = await fetchProfile(user.id)
  const email = user.email || profile?.email || ''
  const role = profile?.role || (isSupabaseConfigured ? 'Staff' : fallbackRole || 'Staff')
  return {
    id: user.id,
    email,
    role,
    name: profile?.name || profile?.full_name || (email ? email.split('@')[0] : ''),
    plan: profile?.plan || 'free',
  }
}

async function currentIdentity() {
  if (!isSupabaseConfigured) {
    const s = readLocalSession()
    return { id: s?.id ?? null, email: s?.email ?? null }
  }
  const { data } = await supabase.auth.getUser()
  return { id: data?.user?.id ?? null, email: data?.user?.email ?? null }
}

/* ------------------------------------------------------------------ */
/* products                                                            */
/* ------------------------------------------------------------------ */

export async function listActiveProducts() {
  if (!isSupabaseConfigured) {
    seedDemoIfEmpty()
    return readLocal()
      .filter((p) => ACTIVE_STATUSES.includes(p.status))
      .sort((a, b) => daysLeft(a.expiry_date) - daysLeft(b.expiry_date))
  }
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('status', ACTIVE_STATUSES)
    .order('expiry_date', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listDoneProducts() {
  if (!isSupabaseConfigured) {
    return readLocal()
      .filter((p) => CLOSED_STATUSES.includes(p.status))
      .sort((a, b) => String(b.closed_at || '').localeCompare(String(a.closed_at || '')))
  }

  const query = (orderBy) =>
    supabase.from('products').select('*').in('status', CLOSED_STATUSES).order(orderBy, { ascending: false })

  // Newest close-out first; older databases have no closed_at column yet.
  let { data, error } = await query('closed_at')
  if (error) ({ data, error } = await query('expiry_date'))
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Insert a new product. */
export async function addProduct(product) {
  const item = {
    name: String(product?.name || '').trim().slice(0, 120),
    size: String(product?.size || '').trim().slice(0, 60),
    quantity: Math.max(1, Number(product?.quantity) || 1),
    expiry_date: String(product?.expiry_date || '').slice(0, 10),
    barcode: String(product?.barcode || '').trim().slice(0, 32),
  }
  if (!item.name) throw new Error('Enter a product name.')
  if (!item.expiry_date) throw new Error('Pick an expiry date.')

  if (!isSupabaseConfigured) {
    const items = readLocal()
    const id = `local-${Date.now()}`
    items.push({
      id,
      ...item,
      status: 'in-stock',
      updated_by: 'you',
    })
    writeLocal(items)
    pushLocalEvent({
      product_id: id,
      product_name: item.name,
      action: 'created',
      to_status: 'in-stock',
      actor_email: 'you',
    })
    return
  }

  const me = await currentIdentity()
  if (!me.id) throw new Error('Sign in again to save products.')

  const payload = { ...item, status: 'in-stock', created_by: me.id, updated_by: me.email }
  let { error } = await supabase.from('products').insert(payload)

  // Schema drift guard: older databases have no updated_by column.
  if (error && /updated_by/i.test(error.message)) {
    const { updated_by, ...rest } = payload
    ;({ error } = await supabase.from('products').insert(rest))
  }
  if (error) throw new Error(error.message)

  await recordEvent({
    product_name: item.name,
    action: 'created',
    to_status: 'in-stock',
  })

  scheduleExpiryReminder({
    name: item.name,
    quantity: item.quantity,
    expiry_date: item.expiry_date,
  })
}

/** Update every editable field of a product. */
export async function updateProduct(id, { name, size, quantity, expiry_date, barcode, status }) {
  const patch = {
    name: String(name || '').trim().slice(0, 120),
    size: String(size || '').trim().slice(0, 60),
    quantity: Math.max(1, Number(quantity) || 1),
    expiry_date: String(expiry_date || '').slice(0, 10),
  }
  if (barcode !== undefined) patch.barcode = String(barcode || '').trim().slice(0, 32)
  if (status) patch.status = status
  if (!patch.name) throw new Error('Enter a product name.')
  if (!patch.expiry_date) throw new Error('Pick an expiry date.')

  if (!isSupabaseConfigured) {
    writeLocal(readLocal().map((p) => (p.id === id ? { ...p, ...patch } : p)))
    return
  }

  const me = await currentIdentity()
  const withAuthor = { ...patch, updated_by: me.email }
  let { error } = await supabase.from('products').update(withAuthor).eq('id', id)

  if (error && /updated_by/i.test(error.message)) {
    const { updated_by, ...rest } = withAuthor
    ;({ error } = await supabase.from('products').update(rest).eq('id', id))
  }
  if (error) throw new Error(error.message)

  await recordEvent({
    product_id: id,
    product_name: patch.name,
    action: 'updated',
    to_status: patch.status || null,
  })

  if (!patch.status || ACTIVE_STATUSES.includes(patch.status)) {
    scheduleExpiryReminder({
      name: patch.name,
      quantity: patch.quantity,
      expiry_date: patch.expiry_date,
    })
  }
}

/**
 * Close a product out (sold, trashed, or stock-out) and record who/when.
 * Accepts a product object (preferred, for the audit name) or a bare id.
 */
export async function closeProduct(product, status) {
  if (!CLOSED_STATUSES.includes(status)) throw new Error('Unknown status.')

  const id = typeof product === 'string' ? product : product?.id
  const name = typeof product === 'object' ? product?.name || null : null
  const fromStatus = typeof product === 'object' ? product?.status || null : null
  if (!id) throw new Error('Missing product.')
  const closedAt = new Date().toISOString()

  if (!isSupabaseConfigured) {
    writeLocal(
      readLocal().map((p) =>
        p.id === id ? { ...p, status, closed_at: closedAt, closed_by: 'you', updated_by: 'you' } : p,
      ),
    )
    pushLocalEvent({
      product_id: id,
      product_name: name,
      action: status,
      from_status: fromStatus,
      to_status: status,
      actor_email: 'you',
    })
    return
  }

  const me = await currentIdentity()
  const patch = { status, updated_by: me.email, closed_by: me.email, closed_at: closedAt }
  let { error } = await supabase.from('products').update(patch).eq('id', id)

  // Older schemas lack closed_by/closed_at — keep the app working on them.
  if (error && /(closed_at|closed_by|updated_by)/i.test(error.message)) {
    ;({ error } = await supabase.from('products').update({ status, updated_by: me.email }).eq('id', id))
  }
  if (error) throw new Error(error.message)

  await recordEvent({
    product_id: id,
    product_name: name,
    action: status,
    from_status: fromStatus,
    to_status: status,
  })
}

/** Put a closed-out product back on the shelf. */
export async function reopenProduct(product) {
  const id = typeof product === 'string' ? product : product?.id
  const name = typeof product === 'object' ? product?.name || null : null
  const fromStatus = typeof product === 'object' ? product?.status || null : null
  if (!id) throw new Error('Missing product.')

  if (!isSupabaseConfigured) {
    writeLocal(
      readLocal().map((p) =>
        p.id === id ? { ...p, status: 'in-stock', closed_at: null, closed_by: null, updated_by: 'you' } : p,
      ),
    )
    pushLocalEvent({
      product_id: id,
      product_name: name,
      action: 'reopened',
      from_status: fromStatus,
      to_status: 'in-stock',
      actor_email: 'you',
    })
    return
  }

  const me = await currentIdentity()
  let { error } = await supabase
    .from('products')
    .update({ status: 'in-stock', updated_by: me.email, closed_by: null, closed_at: null })
    .eq('id', id)

  if (error && /(closed_at|closed_by|updated_by)/i.test(error.message)) {
    ;({ error } = await supabase.from('products').update({ status: 'in-stock' }).eq('id', id))
  }
  if (error) throw new Error(error.message)

  await recordEvent({
    product_id: id,
    product_name: name,
    action: 'reopened',
    from_status: fromStatus,
    to_status: 'in-stock',
  })
}

/** Backwards-compatible alias for a bare id. */
export async function markDone(id, status) {
  return closeProduct(id, status)
}

/** Look a product up by barcode on OpenFoodFacts. */
export async function lookupBarcode(barcode) {
  const code = String(barcode || '').replace(/\D/g, '')
  if (code.length < 6) throw new Error('That barcode looks incomplete.')

  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_en,brands,image_front_small_url,quantity`,
  )
  if (!res.ok) throw new Error('Barcode lookup failed.')
  const data = await res.json()
  const product = data?.product
  if (data?.status !== 1 || !product) throw new Error('Product not found.')

  // Warm the thumbnail cache with the exact versioned image URL.
  rememberImage(code, product.image_front_small_url)

  return {
    barcode: code,
    name: product.product_name || product.product_name_en || '',
    brands: product.brands || '',
    image: product.image_front_small_url || '',
    packSize: product.quantity || '',
  }
}

/* ------------------------------------------------------------------ */
/* auth                                                                */
/* ------------------------------------------------------------------ */

export async function signIn(email, password, role) {
  const cleanEmail = String(email || '').trim()

  if (!isSupabaseConfigured) {
    if (!cleanEmail || !password) throw new Error('Enter an email and a password.')
    if (password.length < 4) throw new Error('Use at least 4 characters for the demo password.')
    const session = {
      id: `demo-${cleanEmail}`,
      email: cleanEmail,
      role: role === 'Manager' ? 'Manager' : 'Staff',
      name: cleanEmail.split('@')[0],
      plan: 'free',
      demo: true,
    }
    try {
      localStorage.setItem(LOCAL_SESSION, JSON.stringify(session))
    } catch {
      /* ignore */
    }
    seedDemoIfEmpty()
    return session
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  })
  if (error) throw error
  return normaliseSession(data.user, role)
}

export async function getSession() {
  if (!isSupabaseConfigured) return readLocalSession()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return null
  return normaliseSession(session.user)
}

export async function signOut() {
  try {
    localStorage.removeItem(LOCAL_SESSION)
  } catch {
    /* ignore */
  }
  if (!isSupabaseConfigured) return
  try {
    await supabase.auth.signOut()
  } catch {
    /* already signed out */
  }
}

/* ------------------------------------------------------------------ */
/* team + billing (Worker endpoints, manager-only)                     */
/* ------------------------------------------------------------------ */

async function authedFetch(path, options = {}) {
  if (!isSupabaseConfigured) {
    const err = new Error('staff_not_configured')
    err.code = 'staff_not_configured'
    throw err
  }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    const err = new Error('unauthorized')
    err.code = 'unauthorized'
    throw err
  }

  const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  if (options.body) headers['Content-Type'] = 'application/json'

  const res = await fetch(path, { ...options, headers })
  let body = null
  try {
    body = await res.json()
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const code = body?.error || `http_${res.status}`
    const err = new Error(code)
    err.code = code
    err.status = res.status
    throw err
  }
  return body
}

export async function listStaff() {
  if (!isSupabaseConfigured) {
    return [
      { id: 'demo-1', email: 'manager@merchant.app', full_name: 'Demo Manager', role: 'Manager' },
      { id: 'demo-2', email: 'staff@merchant.app', full_name: 'Demo Staff', role: 'Staff' },
    ]
  }
  const data = await authedFetch('/api/staff')
  return Array.isArray(data?.staff) ? data.staff : []
}

export async function createStaff({ fullName, email, password, role }) {
  return authedFetch('/api/staff', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password, role }),
  })
}

export async function removeStaff(id) {
  return authedFetch(`/api/staff?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function changePassword(currentPassword, newPassword) {
  if (!isSupabaseConfigured) {
    if (String(newPassword).length < 6) throw new Error('Use at least 6 characters.')
    return
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) throw new Error('Sign in again to change your password.')

  // Supabase requires a recent session for password changes; prove it.
  const { error: reauth } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (reauth) throw new Error('Current password does not match.')

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

export async function getMyPlan() {
  if (!isSupabaseConfigured) return 'free'
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const profile = await fetchProfile(user?.id)
  return profile?.plan || 'free'
}

export async function startCheckout() {
  const data = await authedFetch('/api/checkout', { method: 'POST' })
  if (!data?.url) throw new Error('billing_not_configured')
  window.location.assign(data.url)
  return true
}
