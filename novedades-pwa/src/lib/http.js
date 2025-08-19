// src/lib/http.js
import axios from 'axios'

export const http = axios.create({
  baseURL: '/',          // Vite proxy → backend
  timeout: 20000,
})

// Adjunta token en TODAS las requests
http.interceptors.request.use((config) => {
  const t = localStorage.getItem('token')
  if (t) config.headers.Authorization = 'Bearer ' + t
  return config
})

// Log de errores y propagación del mensaje útil
http.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.message ||
      'Network error'
    console.error('[HTTP ERROR]', err?.config?.method?.toUpperCase(), err?.config?.url, msg, err?.response)
    return Promise.reject(err)
  }
)
