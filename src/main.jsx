import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initMonitoring } from './lib/monitoring'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Fire-and-forget: error reporting must never block the first paint.
initMonitoring()

// Production only: dev keeps unhashed module URLs that must never be cached.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* caching is an enhancement, never a blocker */
    })
  })
}
