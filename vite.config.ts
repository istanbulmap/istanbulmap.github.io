import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Build stamp shown in the Route panel footer. On GitHub Actions this is the
// commit that was built, so you can verify which version your browser runs.
const sha   = (process.env.GITHUB_SHA ?? '').slice(0, 7) || 'local'
const when  = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
const BUILD = `${sha} · ${when}`

export default defineConfig({
  base: '/',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The service worker is registered from src/main.tsx via virtual:pwa-register
      // so the page reloads itself when a new version is deployed.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Istanbul Navigator',
        short_name: 'IstNav',
        description: 'Offline map and navigator for Istanbul, Turkey',
        theme_color: '#050506',
        background_color: '#050506',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': '/src' }
  }
})
