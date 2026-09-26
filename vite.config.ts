import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const api = process.env.WASICHAI_API_URL ?? 'http://localhost:8090'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // @wasichai/* are symlinks into ../wasichai-ui, which has its own react & co. resolving their imports from
  // this node_modules (yarn installed their deps here) keeps one copy of each, or hooks break
  resolve: { preserveSymlinks: true },
  server: { port: 5180, strictPort: true, proxy: { '/api': api } },
  preview: { port: 5180, strictPort: true, proxy: { '/api': api } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.tsx'],
    // node itself would follow the symlinks: let vite load them, with preserveSymlinks
    server: { deps: { inline: [/@wasichai\//] } }
  }
})
