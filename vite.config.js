import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    // Restringido a src para que vitest NO tome los specs de Playwright en tests/e2e.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/services/**', 'src/utils/**', 'src/lib/**'],
      exclude: ['**/__tests__/**', '**/*.test.js'],
    },
  },
})
