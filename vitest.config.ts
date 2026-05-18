import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Unit tests run in a node env with no CSS. Override project PostCSS
  // discovery so Vite does not load postcss.config.mjs (Tailwind 4 plugin).
  css: { postcss: {} },
})
