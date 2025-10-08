<template>
  <router-view />
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'

const IDLE_MS = 5 * 60 * 1000 // 5 minutos 
let idleTimer = null

function resetIdleTimer() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    logout()
  }, IDLE_MS)
}

function bindActivityListeners() {
  const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
  events.forEach(ev => window.addEventListener(ev, resetIdleTimer, { passive: true }))
  resetIdleTimer() // arranca el timer
}

function unbindActivityListeners() {
  const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
  events.forEach(ev => window.removeEventListener(ev, resetIdleTimer))
  clearTimeout(idleTimer)
}

// Opcional: cada request reinicia el contador
axios.interceptors.request.use(cfg => {
  resetIdleTimer()
  return cfg
})

onMounted(() => {
  bindActivityListeners()
})

onBeforeUnmount(() => {
  unbindActivityListeners()
})

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login/'
}
</script>

