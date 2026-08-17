import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts on purpose — see the note there. Tests need no
// React plugin: esbuild handles the JSX transform from tsconfig's `jsx` setting,
// and fast refresh is meaningless in a test run.
export default defineConfig({
  test: {
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
