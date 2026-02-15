import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Spotary',
        short_name: 'Spotary',
        description: 'Collect and organize places by vibe.',
        theme_color: '#FFF0F5',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    },
    host: true,
    allowedHosts: ['dev.spotary.place', 'localhost', '127.0.0.1', '100.69.194.28']
  },
  define: {
    // eslint-disable-next-line no-undef
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
  }
})
