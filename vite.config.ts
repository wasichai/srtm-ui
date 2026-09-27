import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const api = process.env.WASICHAI_API_URL ?? 'http://localhost:8090'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5180, strictPort: true, proxy: { '/api': api } },
  preview: { port: 5180, strictPort: true, proxy: { '/api': api } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.tsx'],
    server: { deps: { inline: ['@wasichai/gis'] } }
  }
})
