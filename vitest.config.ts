import { defineConfig } from 'vitest/config'
import path from 'path'
export default defineConfig({
  test: { 
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // This file must NOT be imported by next.config — keep it standalone
})
