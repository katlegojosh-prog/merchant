import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Preview hosts come from __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS (set by the
// Cloud preview environment) instead of a blanket `.style.dev` allowlist.
const allowedHosts = (process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    // public/ is the deploy root. Copying it into dist would re-import last
    // deploy's hashed bundles on the next build:deploy sync.
    copyPublicDir: false,
  },
})
