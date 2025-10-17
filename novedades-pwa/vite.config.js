// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  base: '/login/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  server: {
  proxy: {
    '/auth': 'http://localhost:8080',
    '/me': 'http://localhost:8080',
    '/admin': 'http://localhost:8080',
    '/my': 'http://localhost:8080',
    '/catalogs': 'http://localhost:8080',
    '/reports': 'http://localhost:8080',
    '/dashboard': 'http://localhost:8080',
    '/debug': 'http://localhost:8080',

    // 👇 AGREGA ESTAS LÍNEAS
    '/vehicles': 'http://localhost:8080',
    '/uploads': 'http://localhost:8080', // si sirves fotos desde backend
  },
},
})

