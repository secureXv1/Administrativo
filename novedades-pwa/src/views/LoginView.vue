<!-- frontend/src/views/LoginView.vue -->
<template>
  <div
    class="min-h-screen w-full flex items-center justify-center bg-black bg-cover bg-center bg-no-repeat relative px-4 py-8"
    style="background-image: url('/login/fondo.jpg');"
  >
    <!-- Overlay -->
    <div class="absolute inset-0 bg-black/25 backdrop-blur-[2px] z-0"></div>

    <!-- Card -->
    <div
      class="relative z-10 w-full max-w-md rounded-3xl shadow-2xl
      bg-white/55 backdrop-blur-xl border border-white/25
      p-6 sm:p-8 md:p-10 flex flex-col items-center"
    >
      <!-- Logo + encabezado -->
      <div class="flex flex-col items-center gap-4 mb-8">
        <img
          src="/login/logo.png"
          alt="Logo Novedades"
          class="w-24 h-24 rounded-full shadow-xl object-cover"
        />

        <div class="text-center">
          <p class="text-xs text-slate-600 mt-2 max-w-xs leading-relaxed">
            Está ingresando a un sistema de información privado, su uso no autorizado
            incurre en el incumplimiento de las políticas de seguridad de la información
            y puede acarrear sanciones penales, disciplinarias y/o administrativas.
          </p>
        </div>
      </div>

      <!-- Formulario -->
      <form @submit.prevent="login" class="w-full flex flex-col gap-5">
        <!-- Usuario -->
        <div>
          <div class="relative">
            <span
              v-if="!username"
              class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 8a3 3 0 116 0 3 3 0 01-6 0zm8 9a5 5 0 10-10 0h10z"
                />
              </svg>
            </span>

            <input
              v-model="username"
              type="text"
              class="w-full pl-10 py-3 rounded-xl border border-white/40 bg-white/80 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-300 transition shadow-sm"
              placeholder="Usuario"
              autocomplete="username"
            />
          </div>
        </div>

        <!-- Clave -->
        <div>
          <div class="relative">
            <span
              v-if="!password"
              class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 11c0-1.104.896-2 2-2s2 .896 2 2-.896 2-2 2-2-.896-2-2z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 16v-2c0-2.761-2.239-5-5-5s-5 2.239-5 5v2"
                />
              </svg>
            </span>

            <input
              v-model="password"
              :type="show ? 'text' : 'password'"
              class="w-full pl-10 pr-10 py-3 rounded-xl border border-white/40 bg-white/80 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-300 transition shadow-sm"
              placeholder="Clave"
              autocomplete="current-password"
            />

            <button
              type="button"
              @click="show = !show"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition"
              tabindex="-1"
            >
              <svg
                v-if="!show"
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0c0 4-4.03 7-9 7s-9-3-9-7 4.03-7 9-7 9 3 9 7z"
                />
              </svg>

              <svg
                v-else
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.97 0-9-3-9-7 0-1.295.482-2.525 1.354-3.557m2.016-2.57C7.91 5.735 9.898 5 12 5c4.97 0 9 3 9 7 0 1.194-.407 2.318-1.137 3.287M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Botón -->
        <div class="flex items-center justify-center">
          <button
            type="submit"
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition text-white font-semibold py-3 rounded-xl shadow-lg"
            :disabled="loading"
          >
            {{ loading ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </div>

        <!-- Mensaje -->
        <p v-if="msg" :class="msgClass" class="text-center text-xs mt-1">
          {{ msg }}
        </p>
      </form>

      <!-- Footer -->
      <div class="flex justify-center items-center mt-8 w-full text-xs text-slate-500">
        <span>© {{ currentYear }} ITSNVDS</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import router from '../router'

const username = ref('')
const password = ref('')
const show = ref(false)
const loading = ref(false)
const msg = ref('')

const currentYear = new Date().getFullYear()

const msgClass = computed(() =>
  msg.value.includes('✅')
    ? 'text-green-600'
    : 'text-red-600'
)

async function login() {
  msg.value = ''
  loading.value = true

  try {
    const { data } = await axios.post('/auth/login', {
      username: username.value,
      password: password.value
    })

    localStorage.setItem('token', data.token)

    const me = await axios
      .get('/me', {
        headers: { Authorization: 'Bearer ' + data.token }
      })
      .then(r => r.data)

    if (me?.role === 'superadmin') {
      router.push('/admin/dashboard')
    } else if (me?.role === 'leader_vehicles') {
      router.push('/admin/vehicles')
    } else if (me?.role === 'supervision') {
      router.push('/admin/')
    } else if (me?.role === 'leader_group') {
      router.push('/admin/')
    } else if (me?.role === 'leader_unit') {
      router.push('/report')
    } else if (me?.role === 'agent') {
      router.push('/agent')
    } else {
      msg.value = 'Rol de usuario no reconocido.'
    }
  } catch (e) {
    const err = e?.response?.data || {}

    if (e?.response?.status === 429 && err.detail) {
      msg.value = err.detail
    } else if (e?.response?.status === 423) {
      msg.value = err.detail || 'Cuenta bloqueada. Contacte al administrador.'
    } else {
      msg.value = err.detail || 'Problema de conexión con el servidor'
    }
  } finally {
    loading.value = false
  }
}
</script>