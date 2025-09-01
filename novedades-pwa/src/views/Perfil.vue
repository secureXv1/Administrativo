<template>
  <AdminMenuLayout :me="me" :logout="logout">
    <main class="max-w-xl mx-auto my-10 bg-white rounded-xl shadow-md p-8">
      <h2 class="text-2xl font-bold mb-4 text-brand-700">Perfil de Usuario</h2>

      <div v-if="loading" class="py-8 text-center text-brand-700">Cargando...</div>
      <div v-else>
        <div class="mb-4">
          <label class="font-semibold text-slate-700">Usuario:</label>
          <div class="bg-slate-100 rounded px-3 py-2">{{ profile.email }}</div>
        </div>
        <div class="mb-4">
          <label class="font-semibold text-slate-700">Rol:</label>
          <div class="bg-slate-100 rounded px-3 py-2 capitalize">{{ profile.role }}</div>
        </div>
        <div class="mb-4">
          <label class="font-semibold text-slate-700">Grupo:</label>
          <div class="bg-slate-100 rounded px-3 py-2">{{ profile.groupCode || 'Sin grupo' }}</div>
        </div>
        <div class="mb-4">
          <label class="font-semibold text-slate-700">Fecha de creación:</label>
          <div class="bg-slate-100 rounded px-3 py-2">
            {{ formatDate(profile.createdAt) }}
          </div>
        </div>

        <hr class="my-6" />

        <!-- Cambio de contraseña -->
        <h3 class="font-semibold mb-3 text-brand-700">Cambiar contraseña</h3>
        <form @submit.prevent="cambiarPassword" class="space-y-4">
          <div>
            <label class="label">Contraseña actual</label>
            <input v-model="oldPassword" type="password" class="input" required autocomplete="current-password"/>
          </div>
          <div>
            <label class="label">Nueva contraseña</label>
            <input v-model="newPassword" type="password" class="input" required autocomplete="new-password"/>
          </div>
          <div>
            <label class="label">Repetir nueva contraseña</label>
            <input v-model="repeatPassword" type="password" class="input" required autocomplete="new-password"/>
          </div>
          <button class="btn-primary">Cambiar contraseña</button>
          <div v-if="msg" :class="msgClass" class="mt-2">{{ msg }}</div>
        </form>
      </div>
    </main>
  </AdminMenuLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import AdminMenuLayout from './AdminMenuLayout.vue'

const router = useRouter()
function volver() {
  router.back()
}

const loading = ref(true)
const profile = ref({})
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')
const oldPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')

// Si tienes datos del usuario autenticado (me/propiedades globales)
const me = ref(JSON.parse(localStorage.getItem('me') || '{}'))

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

async function loadProfile() {
  loading.value = true
  try {
    const { data } = await axios.get('/me/profile', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    profile.value = data
  } catch {
    profile.value = {}
  }
  loading.value = false
}

async function cambiarPassword() {
  msg.value = ''
  if (newPassword.value !== repeatPassword.value) {
    msg.value = 'Las nuevas contraseñas no coinciden'
    return
  }
  if (!oldPassword.value || !newPassword.value) {
    msg.value = 'Completa todos los campos'
    return
  }
  try {
    await axios.post('/me/change-password', {
      oldPassword: oldPassword.value,
      newPassword: newPassword.value
    }, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    msg.value = 'Contraseña cambiada ✅'
    oldPassword.value = ''
    newPassword.value = ''
    repeatPassword.value = ''
  } catch (e) {
    msg.value = e.response?.data?.error || 'Error al cambiar contraseña'
  }
}

// Si quieres seguir permitiendo volver atrás en el navegador:
// function volver() { router.back() }

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}

onMounted(loadProfile)
</script>
