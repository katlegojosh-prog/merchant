import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import Login from './pages/Login'
import Home from './pages/Home'
import AddProduct from './pages/AddProduct'
import History from './pages/History'
import Digest from './pages/Digest'
import Team from './pages/Team'
import Activity from './pages/Activity'
import UpdateBanner from './components/UpdateBanner'
import { getSession, listActiveProducts, listDoneProducts, signOut } from './lib/store'
import { identifyUser, reportError } from './lib/monitoring'

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState('home')
  const [products, setProducts] = useState([])
  const [done, setDone] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Stripe returns here after Checkout; show it once, then drop the param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    if (!checkout) return
    toast.success(checkout === 'success' ? 'Payment received — thank you!' : 'Checkout cancelled')
    params.delete('checkout')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [active, history] = await Promise.all([listActiveProducts(), listDoneProducts()])
      setProducts(Array.isArray(active) ? active : [])
      setDone(Array.isArray(history) ? history : [])
    } catch (err) {
      reportError(err, { scope: 'load-products' })
      setError(err.message || 'Could not load products.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    getSession()
      .then((s) => setSession(s))
      .catch(() => setSession(null))
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    identifyUser(session)
  }, [session])

  useEffect(() => {
    if (session) refresh()
  }, [session, refresh])

  // Android/desktop back closes a sub-page instead of leaving the app.
  useEffect(() => {
    const onPop = () => setView('home')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((next) => {
    if (next !== 'home') window.history.pushState({ view: next }, '')
    setView(next)
  }, [])

  async function handleSignOut() {
    await signOut()
    setSession(null)
    setView('home')
    setProducts([])
    setDone([])
  }

  let content

  if (!ready) {
    content = (
      <div className="app-shell items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-gold" />
      </div>
    )
  } else if (!session) {
    content = <Login onSignedIn={setSession} />
  } else if (view === 'add') {
    content = (
      <AddProduct
        onCancel={() => setView('home')}
        onSaved={async (name) => {
          await refresh()
          setView('home')
          toast.success(name ? `Product saved: ${name}` : 'Product saved')
        }}
      />
    )
  } else if (view === 'history') {
    content = <History items={done} onBack={() => setView('home')} onRefresh={refresh} />
  } else if (view === 'digest') {
    content = <Digest products={products} onBack={() => setView('home')} />
  } else if (view === 'team') {
    content = <Team session={session} onBack={() => setView('home')} />
  } else if (view === 'activity') {
    content = <Activity session={session} onBack={() => setView('home')} />
  } else {
    content = (
      <Home
        session={session}
        products={products}
        doneCount={done.length}
        loading={loading}
        error={error}
        onAdd={() => navigate('add')}
        onHistory={() => navigate('history')}
        onDigest={() => navigate('digest')}
        onTeam={() => navigate('team')}
        onActivity={() => navigate('activity')}
        onRefresh={refresh}
        onSignOut={handleSignOut}
      />
    )
  }

  return (
    <>
      {content}
      <UpdateBanner />
    </>
  )
}
