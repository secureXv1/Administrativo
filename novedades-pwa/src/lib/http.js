// src/lib/http.js
import axios from 'axios'

export const http = axios.create({
  baseURL: '/',          // 👈 Usa el proxy de Vite
  timeout: 20000,
})

// Adjunta token
http.interceptors.request.use((config) => {
  const t = localStorage.getItem('token')
  if (t) config.headers.Authorization = 'Bearer ' + t
  return config
})

// Logs y manejo de error
http.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.message ||
      'Network error'
    console.error(
      '[HTTP ERROR]',
      err?.config?.method?.toUpperCase(),
      err?.config?.url,
      msg,
      err?.response
    )
    return Promise.reject(err)
  }
)
