<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md card">
      <div class="card-body space-y-6">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold">N</div>
          <div>
            <h1 class="text-lg font-semibold text-slate-900 leading-tight">Ingresar a Novedades</h1>
            <p class="text-xs text-slate-500">Usa tu correo y clave</p>
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <label class="label">Correo</label>
            <input class="input" v-model="email" placeholder="tucorreo@empresa.com" />
          </div>
          <div>
            <label class="label">Clave</label>
            <div class="relative">
              <input :type="show ? 'text' : 'password'" class="input pr-10" v-model="password" placeholder="••••••••" />
              <button type="button" @click="show = !show"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-sm">
                {{ show ? 'Ocultar' : 'Ver' }}
              </button>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Demo: <b>admin@demo.com</b> / <b>Demo2025*+</b> ó <b>liderA@demo.com</b> / <b>Demo2025*+</b>
            </p>
          </div>
        </div>

        <div class="space-y-3">
          <button @click="login" class="btn-primary w-full" :disabled="loading">
            {{ loading ? 'Ingresando…' : 'Entrar' }}
          </button>
          <p v-if="msg" :class="msgClass">{{ msg }}</p>
        </div>

        <p class="text-[11px] text-slate-400 text-center">
          Al continuar aceptas las políticas internas de uso de la app.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import router from '../router'

const email = ref('admin@demo.com')       // cambia si quieres iniciar como líder
const password = ref('Demo2025*+')
const show = ref(false)
const loading = ref(false)
const msg = ref('')

const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600 text-center' : 'text-red-600 text-center')

async function login () {
  msg.value = ''
  loading.value = true
  try {
    // 1) obtener token
    const { data } = await axios.post('/auth/login', { email: email.value, password: password.value })
    localStorage.setItem('token', data.token)

    // 2) preguntar rol y redirigir (admin -> /admin, leader -> /report)
    const me = await axios.get('/me', { headers: { Authorization: 'Bearer ' + data.token } }).then(r => r.data)
    if (me?.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/report')
    }
  } catch (e) {
    msg.value = 'Credenciales inválidas'
  } finally {
    loading.value = false
  }
}
</script>
