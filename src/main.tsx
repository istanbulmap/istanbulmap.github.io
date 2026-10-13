import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// With registerType 'autoUpdate' this reloads the page as soon as a new
// service worker takes over, so a fresh deploy never leaves you on old code.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => { registration.update().catch(() => { /* offline */ }) }
    // Look for a new deploy when the tab/app comes back to the foreground, and hourly.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    setInterval(check, 60 * 60 * 1000)
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
