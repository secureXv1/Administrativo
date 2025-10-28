<!-- src/views/Perfil.vue -->
<template>
  <div class="min-h-screen bg-slate-50">
    <!-- HERO -->
    <div class="bg-gradient-to-r from-slate-800 to-slate-700">
      <div class="max-w-4xl mx-auto px-4 py-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-white text-2xl font-semibold">Perfil de usuario</h1>
            <p class="text-slate-300 text-sm mt-1">Gestiona tu cuenta y tu contraseña</p>
          </div>
        </div>
      </div>
    </div>

    <!-- CONTENIDO PRINCIPAL -->
    <main class="max-w-4xl mx-auto px-4 py-10 -mt-10 relative z-10">
      <section class="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
        <!-- Header -->
        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button
              @click="volver"
              class="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver al dashboard
            </button>
          </div>
          <span class="text-xs text-slate-500">Usuario: {{ me?.username || me?.email || '-' }}</span>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-6">
          <h3 class="font-semibold text-slate-900 mb-3">Cambiar contraseña</h3>

          <form @submit.prevent="onSubmitPassword" class="max-w-md space-y-3">
            <div>
              <label class="label">Contraseña actual</label>
              <div class="relative">
                <input
                  :type="showOld ? 'text' : 'password'"
                  v-model.trim="formPwd.old"
                  class="input pr-10"
                  autocomplete="current-password"
                  required
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                  @click="showOld=!showOld"
                >{{ showOld ? '🙈' : '👁️' }}</button>
              </div>
            </div>

            <div>
              <label class="label">Nueva contraseña</label>
              <div class="relative">
                <input
                  :type="showNew ? 'text' : 'password'"
                  v-model.trim="formPwd.new1"
                  class="input pr-10"
                  autocomplete="new-password"
                  required
                  @input="checkStrength"
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                  @click="showNew=!showNew"
                >{{ showNew ? '🙈' : '👁️' }}</button>
              </div>
              <p class="text-xs mt-1" :class="pwdStrengthClass">{{ pwdStrengthLabel }}</p>
              <ul class="text-xs text-slate-500 mt-1 list-disc pl-5">
                <li>Mínimo 8 caracteres</li>
                <li>Debe incluir mayúscula, minúscula, número y símbolo</li>
              </ul>
            </div>

            <div>
              <label class="label">Confirmar nueva contraseña</label>
              <div class="relative">
                <input
                  :type="showNew2 ? 'text' : 'password'"
                  v-model.trim="formPwd.new2"
                  class="input pr-10"
                  autocomplete="new-password"
                  required
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                  @click="showNew2=!showNew2"
                >{{ showNew2 ? '🙈' : '👁️' }}</button>
              </div>
              <p v-if="formPwd.new2 && formPwd.new1!==formPwd.new2" class="text-xs text-rose-600 mt-1">
                Las contraseñas no coinciden.
              </p>
            </div>

            <div class="pt-2 flex items-center gap-2">
              <button
                class="px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                type="submit"
                :disabled="submittingPwd || !canSubmitPwd"
              >
                {{ submittingPwd ? 'Guardando…' : 'Cambiar contraseña' }}
              </button>
              <button
                type="button"
                class="btn-ghost"
                @click="volver"
                :disabled="submittingPwd"
              >
                Cancelar
              </button>
            </div>

            <p
              v-if="pwdMsg"
              aria-live="polite"
              class="text-sm mt-2"
              :class="pwdMsgOk ? 'text-emerald-700' : 'text-rose-700'"
            >
              {{ pwdMsg }}
            </p>
          </form>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
function volver() {
  router.push('/admin') // <- redirige al dashboard principal
}

const me = ref(null)
async function loadMe() {
  try {
    const { data } = await axios.get('/me/profile', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    me.value = data
  } catch { me.value = null }
}

// ---- Cambio de contraseña ----
const formPwd = ref({ old: '', new1: '', new2: '' })
const showOld = ref(false)
const showNew = ref(false)
const showNew2 = ref(false)
const submittingPwd = ref(false)
const pwdMsg = ref('')
const pwdMsgOk = ref(false)

const strengthScore = ref(0)
const pwdStrengthLabel = computed(() => {
  if (!formPwd.value.new1) return 'Escribe una contraseña segura'
  if (strengthScore.value >= 4) return 'Fortaleza: alta'
  if (strengthScore.value === 3) return 'Fortaleza: media'
  return 'Fortaleza: baja'
})
const pwdStrengthClass = computed(() => {
  if (!formPwd.value.new1) return 'text-slate-500'
  if (strengthScore.value >= 4) return 'text-emerald-700'
  if (strengthScore.value === 3) return 'text-amber-700'
  return 'text-rose-700'
})

function checkStrength() {
  const s = formPwd.value.new1 || ''
  let score = 0
  if (s.length >= 8) score++
  if (/[A-Z]/.test(s)) score++
  if (/[a-z]/.test(s)) score++
  if (/\d/.test(s)) score++
  if (/[^A-Za-z0-9]/.test(s)) score++
  strengthScore.value = score
}

const canSubmitPwd = computed(() =>
  !!formPwd.value.old &&
  !!formPwd.value.new1 &&
  formPwd.value.new1 === formPwd.value.new2 &&
  strengthScore.value >= 4
)

async function onSubmitPassword() {
  pwdMsg.value = ''
  pwdMsgOk.value = false
  if (!canSubmitPwd.value) {
    pwdMsg.value = 'Revisa los requisitos de la nueva contraseña.'
    return
  }
  submittingPwd.value = true
  try {
    await axios.post('/me/change-password', {
      oldPassword: formPwd.value.old,
      newPassword: formPwd.value.new1
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    pwdMsg.value = 'Contraseña actualizada correctamente.'
    pwdMsgOk.value = true
    setTimeout(() => volver(), 1500)
  } catch (err) {
    const apiMsg =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      'Error al cambiar la contraseña.'
    pwdMsg.value = apiMsg
    pwdMsgOk.value = false
  } finally {
    submittingPwd.value = false
  }
}

onMounted(loadMe)
</script>

<style scoped>
.fade-enter-active,.fade-leave-active{ transition: opacity .15s ease; }
.fade-enter-from,.fade-leave-to{ opacity:0; }
</style>
