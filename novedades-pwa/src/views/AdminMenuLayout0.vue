<template>
  <div class="min-h-screen flex bg-slate-50">
    <!-- Sidebar desktop -->
    <aside
        :class="[
            'fixed top-0 left-0 h-screen z-30 border-r border-slate-800 hidden md:flex flex-col transition-all duration-200 ease-in-out',
            collapsed ? 'w-16' : 'w-64'
        ]"
        style="background-color: #19272D;"
        >
        <div class="flex-1 flex flex-col relative z-10">
            <!-- Brand -->
            <div class="h-14 px-3 flex items-center justify-between">
            <div class="flex items-center gap-2 overflow-hidden">
                <div class="w-8 h-8 rounded-xl bg-white text-[#19272D] flex items-center justify-center font-bold">N</div>
                <span v-if="!collapsed" class="font-semibold text-white truncate">Panel Admin</span>
            </div>
            </div>

            <nav class="mt-2 px-2 space-y-1 overflow-y-auto">

            <!-- Dashboard (NO acordeón) -->
            <router-link
                to="/admin/dashboard"
                class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                :class="route.path.startsWith('/admin/dashboard') && !openSection ? 'bg-white/10 text-sky-400' : 'text-white hover:bg-white/5'"
                @click="selectDashboard"
                >
                <Home class="w-5 h-5" />
                <span class="flex-1 text-left">Dashboard</span>
            </router-link>

            <!-- NOVEDADES -->
            <div>
                <button
                class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                @click="selectAccordion('novedades')"
                :class="openSection === 'novedades' ? 'bg-white/10 text-sky-400' : 'text-white hover:bg-white/5'"
                >
                <Newspaper class="w-5 h-5" />
                <span class="flex-1 text-left">Novedades</span>
                <svg :class="['size-4 transition-transform', openSection === 'novedades' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
                </button>
                <transition name="fade">
                <div v-if="openSection === 'novedades'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin" icon="dashboard" :collapsed="collapsed" label="Reporte" dark />
                </div>
                </transition>
            </div>

            <!-- FUNCIONARIOS -->
            <div>
                <button
                class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                @click="selectAccordion('funcionarios')"
                :class="openSection === 'funcionarios' ? 'bg-white/10 text-sky-400' : 'text-white hover:bg-white/5'"
                >
                <Users class="w-5 h-5" />
                <span class="flex-1 text-left">Funcionarios</span>
                <svg :class="['size-4 transition-transform', openSection === 'funcionarios' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
                </button>
                <transition name="fade">
                <div v-if="openSection === 'funcionarios'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin/agents" icon="agents" :collapsed="collapsed" label="Funcionarios" dark />
                </div>
                </transition>
            </div>

            <!-- VEHICULOS -->
            <div>
                <button
                class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                @click="selectAccordion('vehiculos')"
                :class="openSection === 'vehiculos' ? 'bg-white/10 text-sky-400' : 'text-white hover:bg-white/5'"
                >
                <Car class="w-5 h-5" />
                <span class="flex-1 text-left">Vehículos</span>
                <svg :class="['size-4 transition-transform', openSection === 'vehiculos' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
                </button>
                <transition name="fade">
                <div v-if="openSection === 'vehiculos'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin/vehicles" icon="vehicles" :collapsed="collapsed" label="Vehículos" dark />
                </div>
                </transition>
            </div>

            <!-- SERVICIOS -->
            <div>
                <button
                class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                @click="selectAccordion('servicios')"
                :class="openSection === 'servicios' ? 'bg-white/10 text-sky-400' : 'text-white hover:bg-white/5'"
                >
                <Wrench class="w-5 h-5" />
                <span class="flex-1 text-left">Servicios</span>
                <svg :class="['size-4 transition-transform', openSection === 'servicios' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
                </button>
                <transition name="fade">
                <div v-if="openSection === 'servicios'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin/services" icon="services" :collapsed="collapsed" label="Servicios" dark />
                </div>
                </transition>
            </div>

            <!-- GASTOS -->
            <div>
                <button
                class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                @click="selectAccordion('gastos')"
                :class="openSection === 'gastos' ? 'bg-white/10 text-sky-400' : 'text-white hover:bg-white/5'"
                >
                <Wallet class="w-5 h-5" />
                <span class="flex-1 text-left">Gastos</span>
                <svg :class="['size-4 transition-transform', openSection === 'gastos' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
                </button>
                <transition name="fade">
                <div v-if="openSection === 'gastos'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin/expenses" icon="expenses" :collapsed="collapsed" label="Gastos" dark />
                </div>
                </transition>
            </div>

            <!-- CONFIGURACIÓN (solo superadmin) -->
            <template v-if="canSee(['superadmin'])">
                <div>
                <button
                    class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                    @click="selectAccordion('configuracion')"
                    :class="openSection === 'configuracion' ? 'bg-white/10 text-sky-400' : 'text-white hover:bg-white/5'"
                >
                    <Settings class="w-5 h-5" />
                    <span class="flex-1 text-left">Configuración</span>
                    <svg :class="['size-4 transition-transform', openSection === 'configuracion' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <transition name="fade">
                    <div v-if="openSection === 'configuracion'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin/groups" icon="groups" :collapsed="collapsed" label="Grupos" dark />
                    <SidebarItem to="/admin/units" icon="units" :collapsed="collapsed" label="Unidades" dark />
                    <SidebarItem to="/admin/users" icon="users" :collapsed="collapsed" label="Usuarios" dark />
                    <SidebarItem to="/admin/audit" icon="settings" :collapsed="collapsed" label="Log de eventos" dark />
                    </div>
                </transition>
                </div>
            </template>
            </nav>

            <div class="mt-auto p-2 text-[11px] text-slate-300" v-if="!collapsed">
            TZ: America/Bogota
            </div>
        </div>
        </aside>

<!-- Drawer móvil -->
        <transition name="fade">
        <div v-if="mobileOpen" class="fixed inset-0 z-40 md:hidden">
            <div class="absolute inset-0 bg-black/30" @click="mobileOpen = false"></div>
            <aside class="absolute inset-y-0 left-0 w-64 bg-white border-r border-slate-200 p-2 z-50">
            <div class="h-14 px-1 flex items-center justify-between">
                <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-slate-900"></div>
                <span class="font-semibold text-slate-900">Panel Admin</span>
                </div>
                <button class="btn-ghost p-2 rounded-lg hover:bg-slate-100" @click="mobileOpen = false">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                </button>
            </div>
            <!-- Menú móvil -->

            <nav class="mt-2 px-2 space-y-1 overflow-y-auto">

                <!-- Dashboard -->
                <router-link
                to="/admin/dashboard"
                class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                :class="route.path.startsWith('/admin/dashboard') && !openMobileSection ? 'bg-slate-100 text-brand-600' : 'text-slate-700 hover:bg-slate-100'"
                @click="selectMobileDashboard"
                >
                 <Home class="w-5 h-5" />
                <span class="flex-1 text-left">Dashboard</span>
                </router-link>

                <!-- NOVEDADES -->
                <div>
                <button class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                        @click="selectMobileAccordion('novedades')"
                        :class="openMobileSection === 'novedades' ? 'bg-slate-100 text-brand-600' : 'text-slate-700 hover:bg-slate-100'">
                    <Newspaper class="w-5 h-5" />
                    <span class="flex-1 text-left">Novedades</span>
                    <svg :class="['size-4 transition-transform', openMobileSection === 'novedades' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <transition name="fade">
                    <div v-if="openMobileSection === 'novedades'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin" icon="dashboard" :collapsed="collapsed" label="Reporte" :exact="true" />
                    </div>
                </transition>
                </div>

                <!-- FUNCIONARIOS -->
                <div>
                <button class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                        @click="selectMobileAccordion('funcionarios')"
                        :class="openMobileSection === 'funcionarios' ? 'bg-slate-100 text-brand-600' : 'text-slate-700 hover:bg-slate-100'">
                    <Users class="w-5 h-5" />
                    <span class="flex-1 text-left">Funcionarios</span>
                    <svg :class="['size-4 transition-transform', openMobileSection === 'funcionarios' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <transition name="fade">
                    <div v-if="openMobileSection === 'funcionarios'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin/agents" icon="agents" :collapsed="collapsed" label="Funcionarios" />
                    </div>
                </transition>
                </div>

                <!-- VEHICULOS -->
                <div>
                <button class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                        @click="selectMobileAccordion('vehiculos')"
                        :class="openMobileSection === 'vehiculos' ? 'bg-slate-100 text-brand-600' : 'text-slate-700 hover:bg-slate-100'">
                    <Car class="w-5 h-5" />
                    <span class="flex-1 text-left">Vehículos</span>
                    <svg :class="['size-4 transition-transform', openMobileSection === 'vehiculos' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <transition name="fade">
                    <div v-if="openMobileSection === 'vehiculos'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin/vehicles" icon="vehicles" :collapsed="collapsed" label="Vehículos" />
                    </div>
                </transition>
                </div>

                <!-- SERVICIOS -->
                <div>
                <button class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                        @click="selectMobileAccordion('servicios')"
                        :class="openMobileSection === 'servicios' ? 'bg-slate-100 text-brand-600' : 'text-slate-700 hover:bg-slate-100'">
                    <Wrench class="w-5 h-5" />
                    <span class="flex-1 text-left">Servicios</span>
                    <svg :class="['size-4 transition-transform', openMobileSection === 'servicios' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <transition name="fade">
                    <div v-if="openMobileSection === 'servicios'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin/services" icon="services" :collapsed="collapsed" label="Servicios" />
                    </div>
                </transition>
                </div>

                <!-- GASTOS -->
                <div>
                <button class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                        @click="selectMobileAccordion('gastos')"
                        :class="openMobileSection === 'gastos' ? 'bg-slate-100 text-brand-600' : 'text-slate-700 hover:bg-slate-100'">
                    <Wallet class="w-5 h-5" />
                    <span class="flex-1 text-left">Gastos</span>
                    <svg :class="['size-4 transition-transform', openMobileSection === 'gastos' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <transition name="fade">
                    <div v-if="openMobileSection === 'gastos'" class="pl-4 flex flex-col gap-0.5 mt-1">
                    <SidebarItem to="/admin/expenses" icon="expenses" :collapsed="collapsed" label="Gastos" />
                    </div>
                </transition>
                </div>

                <!-- CONFIGURACIÓN (solo superadmin) -->
                <template v-if="canSee(['superadmin'])">
                <div>
                    <button class="w-full flex items-center gap-2 px-2 py-2 rounded-lg font-semibold transition group"
                            @click="selectMobileAccordion('configuracion')"
                            :class="openMobileSection === 'configuracion' ? 'bg-slate-100 text-brand-600' : 'text-slate-700 hover:bg-slate-100'">
                    <Settings class="w-5 h-5" />
                    <span class="flex-1 text-left">Configuración</span>
                    <svg :class="['size-4 transition-transform', openMobileSection === 'configuracion' ? 'rotate-180' : '']" viewBox="0 0 24 24" fill="none">
                        <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    </button>
                    <transition name="fade">
                    <div v-if="openMobileSection === 'configuracion'" class="pl-4 flex flex-col gap-0.5 mt-1">
                        <SidebarItem to="/admin/groups" icon="groups" :collapsed="collapsed" label="Grupos" />
                        <SidebarItem to="/admin/units" icon="units" :collapsed="collapsed" label="Unidades" />
                        <SidebarItem to="/admin/users" icon="users" :collapsed="collapsed" label="Usuarios" />
                        <SidebarItem to="/admin/audit" icon="settings" :collapsed="collapsed" label="Log de eventos" />
                    </div>
                    </transition>
                </div>
                </template>

            </nav>
            </aside>
        </div>
        </transition>



    <!-- Main -->
    <div :class="[collapsed ? 'md:ml-16' : 'md:ml-64', 'min-h-screen flex flex-col w-full transition-all duration-200']">
      <!-- Topbar -->
      <header class="h-14 sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
        <div class="h-full px-3 md:px-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button class="md:hidden btn-ghost p-2 rounded-lg hover:bg-slate-100" @click="mobileOpen = true">
              <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <h1 class="font-semibold text-slate-900 text-base md:text-lg">
              {{ pageTitle }}
            </h1>
          </div>

          <!-- Si quieres tu menú superior existente, impórtalo y colócalo aquí -->
          <div class="flex items-center gap-2">
            <router-link to="/perfil" class="btn-ghost text-sm">Perfil</router-link>
            <button @click="logout" class="btn-ghost text-sm">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <!-- Contenido -->
    <main class="flex-1 p-3 md:p-4 overflow-y-auto w-full">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SidebarItem from '../components/SidebarItem.vue'
import { http } from '../lib/http'
import {
  Home,
  Newspaper,
  Users,
  Car,
  Wrench,
  Wallet,
  Map,
  Settings,
  UserCircle,
  FileText
} from 'lucide-vue-next'



const openMobileSection = ref(''); // '', 'novedades', 'funcionarios', 'vehiculos', etc.

function selectMobileAccordion(section) {
  openMobileSection.value = (openMobileSection.value === section) ? '' : section;
}
function selectMobileDashboard() {
  openMobileSection.value = '';
  mobileOpen.value = false; // Cierra el drawer al navegar (opcional)
}

const openSection = ref(''); // puede ser: '', 'novedades', 'funcionarios', ...

function selectAccordion(section) {
  openSection.value = (openSection.value === section) ? '' : section;
}

// Para Dashboard (fuera de acordeón)
function selectDashboard() {
  openSection.value = '';
}

const me = ref(null)
onMounted(async () => {
  try {
    const { data } = await http.get('/me')
    me.value = data
  } catch {
    me.value = null
  }
})

function canSee(roles) {
  if (!me.value || !me.value.role) return false
  return roles.map(r => r.toLowerCase()).includes(String(me.value.role).toLowerCase())
}

// Estados de acordeón para cada sección
const openNovedades = ref(true)
const openFuncionarios = ref(false)
const openServicios = ref(false)
const openGastos = ref(false)
const openDespliegue = ref(false)
const openConfiguracion = ref(false) // solo para superadmin

const route = useRoute()
const router = useRouter()

const collapsed = ref(false)
const mobileOpen = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('admin_sidebar_collapsed')
  if (saved === '1') collapsed.value = true
})

watch(collapsed, v => {
  localStorage.setItem('admin_sidebar_collapsed', v ? '1' : '0')
})

function toggleCollapse () {
  collapsed.value = !collapsed.value
}

function logout () {
  localStorage.removeItem('token')
  router.push('/login')
}

const pageTitle = computed(() => {
  return route.meta?.title || route.matched?.[route.matched.length - 1]?.meta?.title || ''
})
</script>


<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.btn-ghost { color: #0f172a; }
.btn-ghost:hover { background-color: rgba(15, 23, 42, 0.06); }
</style>
