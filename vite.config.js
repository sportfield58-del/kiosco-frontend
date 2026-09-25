import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Kiosco POS',
        short_name: 'Kiosco',
        description: 'Sistema de punto de venta',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/productos') ||
                                     url.pathname.startsWith('/ventas') ||
                                     url.pathname.startsWith('/turnos'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              // Sin networkTimeoutSeconds: antes, si el servidor tardaba más de 4s (celular con mala
              // señal, servidor "dormido") se servía la respuesta cacheada y el stock aparecía viejo
              // (p. ej. 0). Ahora la caché solo se usa si NO hay conexión de verdad.
              expiration: { maxEntries: 300, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
})
