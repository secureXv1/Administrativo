<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Header: adaptativo -->
    <header class="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <!-- Logo + Título -->
        <div class="flex items-center gap-3">
          <!-- Botón hamburguesa solo móvil -->
          <button class="md:hidden p-2 -ml-2" @click="drawerOpen = true" aria-label="Abrir menú">
            <svg class="h-7 w-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>

          <div class="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-xl">N</div>
          <div>
            <h1 class="text-slate-900 font-semibold leading-tight text-base sm:text-lg">
              Dashboard de Novedades
              <template v-if="isLeaderGroup">- Grupo</template>
            </h1>
            <p class="text-slate-500 text-xs">
              <template v-if="isSuperadmin">Administrador</template>
              <template v-else-if="isSupervision">Supervisión</template>
              <template v-else-if="isLeaderGroup">Líder de Grupo</template>
              <template v-else-if="isLeaderUnit">Líder de Unidad</template>
            </p>
          </div>
        </div>

        <!-- Menú Desktop -->
        <nav class="hidden md:flex items-center gap-2">
          <!-- SOLO leader_unit -->
          <template v-if="isLeaderUnit">
            <router-link to="/report" class="btn-ghost" active-class="bg-slate-200">Reporte</router-link>
            <router-link to="/admin/perfil" class="btn-ghost" active-class="bg-slate-200">Perfil</router-link>
          </template>

          <!-- SOLO leader_group -->
          <template v-else-if="isLeaderGroup">
            <router-link to="/admin" class="btn-ghost" active-class="bg-slate-200">Dashboard</router-link>
            <router-link to="/admin/units" class="btn-ghost" active-class="bg-slate-200">Unidades</router-link>
            <router-link to="/admin/agents" class="btn-ghost" active-class="bg-slate-200">Agentes</router-link>
            <router-link to="/admin/perfil" class="btn-ghost" active-class="bg-slate-200">Perfil</router-link>
          </template>

          <!-- SUPERADMIN o SUPERVISION -->
          <template v-else-if="isSuperadmin || isSupervision">
            <router-link to="/admin" class="btn-ghost" active-class="bg-slate-200">Dashboard</router-link>
            <router-link to="/admin/groups" class="btn-ghost" active-class="bg-slate-200">Grupos</router-link>
            <router-link to="/admin/units" class="btn-ghost" active-class="bg-slate-200">Unidades</router-link>

            <!-- Usuarios: SOLO superadmin -->
            <router-link v-if="isSuperadmin" to="/admin/users" class="btn-ghost" active-class="bg-slate-200">
              Usuarios
            </router-link>

            <router-link to="/admin/agents" class="btn-ghost" active-class="bg-slate-200">Agentes</router-link>
            <router-link to="/admin/perfil" class="btn-ghost" active-class="bg-slate-200">Perfil</router-link>

            <!-- Log de eventos: SOLO superadmin -->
            <router-link v-if="isSuperadmin" to="/admin/audit" class="btn-ghost" active-class="bg-slate-200">
              Log de eventos
            </router-link>
          </template>

          <button @click="logout" class="btn-ghost">Cerrar sesión</button>
        </nav>
      </div>
    </header>

    <!-- Drawer mobile menu -->
    <transition name="fade">
      <div v-if="drawerOpen" class="fixed inset-0 z-[100] md:hidden">
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/40" @click="closeDrawer" aria-label="Cerrar menú"></div>

        <!-- Drawer -->
        <transition name="slide-in">
          <aside
            class="absolute top-0 left-0 h-full w-[84vw] max-w-[320px] bg-white shadow-2xl flex flex-col rounded-r-xl"
            role="dialog" aria-modal="true"
          >
            <!-- Header del drawer -->
            <div class="flex items-center justify-between px-4 py-3 border-b">
              <div class="flex items-center gap-2">
                <div class="h-8 w-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold">N</div>
                <span class="font-semibold text-slate-800">Menú</span>
              </div>
              <button class="p-2 rounded-lg hover:bg-slate-100" @click="closeDrawer" aria-label="Cerrar menú">
                <svg class="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Navegación -->
            <nav class="flex-1 overflow-y-auto p-2">
              <!-- SOLO leader_unit -->
              <template v-if="isLeaderUnit">
                <router-link to="/report" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Reporte</router-link>
                <router-link to="/admin/perfil" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Perfil</router-link>
              </template>

              <!-- SOLO leader_group -->
              <template v-else-if="isLeaderGroup">
                <router-link to="/admin" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Dashboard</router-link>
                <router-link to="/admin/units" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Unidades</router-link>
                <router-link to="/admin/agents" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Agentes</router-link>
                <router-link to="/admin/perfil" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Perfil</router-link>
              </template>

              <!-- SUPERADMIN o SUPERVISION -->
              <template v-else-if="isSuperadmin || isSupervision">
                <router-link to="/admin" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Dashboard</router-link>
                <router-link to="/admin/groups" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Grupos</router-link>
                <router-link to="/admin/units" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Unidades</router-link>

                <!-- Usuarios: SOLO superadmin -->
                <router-link v-if="isSuperadmin" to="/admin/users" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Usuarios</router-link>

                <router-link to="/admin/agents" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Agentes</router-link>
                <router-link to="/admin/perfil" class="btn-ghost w-full text-left" active-class="bg-slate-100" @click="closeDrawer">Perfil</router-link>

                <!-- Log de eventos: SOLO superadmin -->
                <router-link
                  v-if="isSuperadmin"
                  to="/admin/audit"
                  class="btn-ghost w-full text-left"
                  active-class="bg-slate-100"
                  @click="closeDrawer"
                >
                  Log de eventos
                </router-link>
              </template>
            </nav>

            <!-- Footer -->
            <div class="border-t p-2">
              <button @click="logout" class="btn-ghost w-full text-left">Cerrar sesión</button>
            </div>
          </aside>
        </transition>
      </div>
    </transition>

    <!-- MAIN universal para todas las vistas -->
    <main class="max-w-6xl mx-auto px-2 sm:px-4 py-4 space-y-5">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const drawerOpen = ref(false)
const me = ref(null)
const router = useRouter()

// Roles comodín
const isSuperadmin   = computed(() => me.value?.role === 'superadmin')
const isSupervision  = computed(() => me.value?.role === 'supervision')
const isLeaderGroup  = computed(() => me.value?.role === 'leader_group')
const isLeaderUnit   = computed(() => me.value?.role === 'leader_unit')

// Cerrar drawer tras cualquier navegación
router.afterEach(() => { drawerOpen.value = false })

function closeDrawer() { drawerOpen.value = false }

// Bloquear scroll del fondo cuando el drawer está abierto
watch(drawerOpen, (open) => {
  const el = document.documentElement
  if (open) el.classList.add('overflow-hidden')
  else el.classList.remove('overflow-hidden')
})

// Cargar usuario para menú
async function loadMe() {
  try {
    const token = localStorage.getItem('token') || ''
    const { data } = await axios.get('/me', {
      headers: { Authorization: 'Bearer ' + token }
    })
    me.value = data
  } catch {
    me.value = null
  }
}
onMounted(loadMe)

// Logout con auditoría (POST /auth/logout) y luego limpiar token
async function logout() {
  try {
    const token = localStorage.getItem('token') || ''
    if (token) {
      await axios.post('/auth/logout', {}, { headers: { Authorization: 'Bearer ' + token } })
    }
  } catch {
    // continuar de todos modos
  } finally {
    localStorage.removeItem('token')
    window.location.href = '/login/'
  }
}
</script>

<style scoped>
/* Botones base usados en enlaces del menú */
.btn-ghost {
  @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 w-auto;
}

/* Transición de fondo */
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Slide del drawer */
.slide-in-enter-active, .slide-in-leave-active { transition: transform .22s ease; }
.slide-in-enter-from, .slide-in-leave-to { transform: translateX(-100%); }
</style>
