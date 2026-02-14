import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    allowedHosts: ['dev.firstdraft.sh', 'localhost', '127.0.0.1', '100.69.194.28',]
  },
  define: {
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
  }
})
