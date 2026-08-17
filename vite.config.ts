import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Test configuration lives in vitest.config.ts, not here: Vitest bundles its
// own rollup-based Vite, whose plugin types conflict with Vite 8's rolldown
// ones, so a single shared config cannot type-check.
export default defineConfig({
  plugins: [react()],
  server: {
    // Lets the app be opened from another device on the same network — a tablet
    // at the club desk — while developing.
    host: true,
  },
})
