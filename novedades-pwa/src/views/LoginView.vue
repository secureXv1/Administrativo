<template>
  <div class="w-screen h-screen flex items-center justify-center bg-black bg-cover bg-center bg-no-repeat relative"
     style="background-image: url('/src/assets/fondo.jpg');">
  <!-- Overlay oscuro -->
  <div class="absolute inset-0 bg-black/10 z-0"></div>
    <!-- Marca agua SVG -->
    <div class="absolute inset-0 opacity-10 pointer-events-none z-0 flex items-center justify-center">
      <!-- Puedes poner aquí un SVG, íconos, o background pattern si quieres -->
      <!-- <img src="ruta/tu_marca_agua.svg" class="w-4/5 mx-auto" /> -->
    </div>
    <!-- Card central -->
    <div class="relative z-10 w-full max-w-md rounded-3xl shadow-xl bg-white/65 border border-slate-200 p-8 flex flex-col items-center">
      <!-- Logo + título -->
      <div class="flex flex-col items-center gap-2 mb-8">
        <div class="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-600 to-blue-500 shadow-lg flex items-center justify-center text-white text-3xl font-extrabold">
          <svg class="w-10 h-10" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="url(#grad1)"/><text x="50%" y="60%" text-anchor="middle" fill="#fff" font-size="26" font-family="Arial" dy=".3em">N</text><defs><linearGradient id="grad1" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop stop-color="#0ea5e9"/><stop offset="1" stop-color="#1e40af"/></linearGradient></defs></svg>
        </div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight mt-1">Novedades</h1>
        <p class="text-xs text-slate-500">Accede a tu panel institucional</p>
      </div>
      <!-- Login form -->
      <form @submit.prevent="login" class="w-full flex flex-col gap-5">
        <!-- Usuario -->
        <div>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition"
              v-if="!username">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M5 8a3 3 0 116 0 3 3 0 01-6 0zm8 9a5 5 0 10-10 0h10z"/>
              </svg>
            </span>
            <input
              class="input w-full pl-10 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-300 transition"
              v-model="username"
              placeholder="    Usuario"
              autocomplete="username"
            />
          </div>
        </div>
        <!-- Clave -->
        <div>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition"
              v-if="!password">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 11c0-1.104.896-2 2-2s2 .896 2 2-.896 2-2 2-2-.896-2-2z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M17 16v-2c0-2.761-2.239-5-5-5s-5 2.239-5 5v2"/>
              </svg>
            </span>
            <input
              :type="show ? 'text' : 'password'"
              class="input w-full pl-10 pr-10 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-300 transition"
              v-model="password"
              placeholder="     Clave"
              autocomplete="current-password"
            />
            <button type="button" @click="show = !show"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600 transition"
              tabindex="-1"
            >
              <svg v-if="!show" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0c0 4-4.03 7-9 7s-9-3-9-7 4.03-7 9-7 9 3 9 7z"/>
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.97 0-9-3-9-7 0-1.295.482-2.525 1.354-3.557m2.016-2.57C7.91 5.735 9.898 5 12 5c4.97 0 9 3 9 7 0 1.194-.407 2.318-1.137 3.287M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </button>
          </div>
        </div>
        <!-- Recordar y botón -->
        <div class="flex items-center justify-between">
          <label class="inline-flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" class="form-checkbox rounded text-brand-600" v-model="remember" />
            Recordarme
          </label>
          <button
            type="submit"
            class="bg-brand-600 hover:bg-brand-700 transition text-white font-bold px-8 py-2 rounded-full shadow-lg text-base"
            :disabled="loading"
          >
            {{ loading ? 'Ingresando…' : 'LOGIN' }}
          </button>
        </div>
        <p v-if="msg" :class="msgClass" class="text-center text-xs mt-2">{{ msg }}</p>
      </form>
      <!-- Footer -->
      <div class="flex justify-between items-center mt-8 w-full text-xs text-slate-400">
        <div class="flex gap-3">
          <a href="https://www.tusitio.com" target="_blank" class="hover:text-brand-600 transition"><svg class="w-5 h-5" fill="currentColor"><circle cx="12" cy="12" r="12" fill="#0ea5e9"/></svg></a>
          <a href="#" class="hover:text-brand-600 transition"><svg class="w-5 h-5" fill="currentColor"><rect width="20" height="20" x="2" y="2" rx="5" fill="#1e40af"/></svg></a>
        </div>
        <span>© {{ new Date().getFullYear() }} Sistema Novedades</span>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import router from '../router'

const username = ref('')      // cambia si quieres iniciar como otro usuario demo
const password = ref('')
const show = ref(false)
const loading = ref(false)
const msg = ref('')
const remember = ref(false)


const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600 text-center' : 'text-red-600 text-center')

async function login () {
  msg.value = ''
  loading.value = true
  try {
    const { data } = await axios.post('/auth/login', { username: username.value, password: password.value })
    localStorage.setItem('token', data.token)

    const me = await axios.get('/me', { headers: { Authorization: 'Bearer ' + data.token } }).then(r => r.data)

    if (me?.role === 'superadmin' || me?.role === 'supervision') {
      router.push('/admin/dashboard')
    } else if (me?.role === 'leader_group') {
      router.push('/admin/dashboard')
    } else if (me?.role === 'leader_unit') {
      router.push('/report')
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
      msg.value = err.detail || 'Credenciales inválidas'
    }
  } finally {
    loading.value = false
  }
}

</script>

