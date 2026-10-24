import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // Polling: the native Windows watcher drops rapid back-to-back saves, which left stale modules in the dev server.
  server: { port: 5173, strictPort: true, watch: { usePolling: true, interval: 250 } },
})
