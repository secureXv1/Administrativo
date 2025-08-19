// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8080',
      '/me': 'http://localhost:8080',
      '/admin': 'http://localhost:8080',
      '/catalogs': 'http://localhost:8080',
      '/reports': 'http://localhost:8080',
      '/dashboard': 'http://localhost:8080',
      '/debug': 'http://localhost:8080',
    },
  },
})
