<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Header: adaptativo -->
    <header class="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <!-- Logo + Título -->
        <div class="flex items-center gap-3">
          <!-- Botón hamburguesa solo móvil -->
          <button class="md:hidden p-2 -ml-2" @click="drawerOpen = true">
            <svg class="h-7 w-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div class="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-xl">N</div>
          <div>
            <h1 class="text-slate-900 font-semibold leading-tight text-base sm:text-lg">
              Dashboard de Novedades
              <template v-if="me && me.role === 'leader_group'">- Grupo</template>
            </h1>
            <p class="text-slate-500 text-xs">
              <template v-if="me && me.role === 'superadmin'">Administrador</template>
              <template v-else-if="me && me.role === 'supervision'">Supervisión</template>
              <template v-else-if="me && me.role === 'leader_group'">Líder de Grupo</template>
              <template v-else-if="me && me.role === 'leader_unit'">Líder de Unidad</template>
            </p>
          </div>
        </div>
        <!-- Menú Desktop -->
        <nav class="hidden md:flex items-center gap-2">
          <!-- SOLO leader_unit -->
          <template v-if="me && me.role === 'leader_unit'">
            <router-link to="/report" class="btn-ghost" active-class="bg-slate-200">Reporte</router-link>
            <router-link to="/admin/perfil" class="btn-ghost" active-class="bg-slate-200">Perfil</router-link>
          </template>
          <!-- SOLO leader_group -->
          <template v-else-if="me && me.role === 'leader_group'">
            <router-link to="/admin" class="btn-ghost" active-class="bg-slate-200">Dashboard</router-link>
            <router-link to="/admin/units" class="btn-ghost" active-class="bg-slate-200">Unidades</router-link>
            <router-link to="/admin/users" class="btn-ghost" active-class="bg-slate-200">Usuarios</router-link>
            <router-link to="/admin/agents" class="btn-ghost" active-class="bg-slate-200">Agentes</router-link>
            <router-link to="/admin/perfil" class="btn-ghost" active-class="bg-slate-200">Perfil</router-link>
          </template>
          <!-- SUPERADMIN o SUPERVISION -->
          <template v-else-if="me && (me.role === 'superadmin' || me.role === 'supervision')">
            <router-link to="/admin" class="btn-ghost" active-class="bg-slate-200">Dashboard</router-link>
            <router-link to="/admin/groups" class="btn-ghost" active-class="bg-slate-200">Grupos</router-link>
            <router-link to="/admin/units" class="btn-ghost" active-class="bg-slate-200">Unidades</router-link>
            <router-link to="/admin/users" class="btn-ghost" active-class="bg-slate-200">Usuarios</router-link>
            <router-link to="/admin/agents" class="btn-ghost" active-class="bg-slate-200">Agentes</router-link>
            <router-link to="/admin/perfil" class="btn-ghost" active-class="bg-slate-200">Perfil</router-link>
          </template>
          <button @click="logout" class="btn-ghost">Cerrar sesión</button>
        </nav>
      </div>
    </header>
    <!-- Drawer mobile menu -->
    <transition name="fade">
      <div v-if="drawerOpen" class="fixed inset-0 z-[100] md:hidden">
        <!-- Overlay -->
        <div class="fixed inset-0 bg-black/40" @click="drawerOpen = false" aria-label="Cerrar menú"></div>
        <!-- Drawer -->
        <nav class="fixed top-0 left-0 h-full w-64 max-w-[80vw] bg-white shadow-xl flex flex-col py-6 px-4 gap-2 z-[110]"
             style="min-width: 220px; overflow-y:auto; max-height:100vh;" @click.stop>
          <button class="self-end mb-4" @click="drawerOpen = false" aria-label="Cerrar menú">
            <svg class="h-7 w-7 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <!-- SOLO leader_unit -->
          <template v-if="me && me.role === 'leader_unit'">
            <router-link to="/report" class="btn-ghost w-full text-left" active-class="bg-slate-100">Reporte</router-link>
            <router-link to="/admin/perfil" class="btn-ghost w-full text-left" active-class="bg-slate-100">Perfil</router-link>
          </template>
          <!-- SOLO leader_group -->
          <template v-else-if="me && me.role === 'leader_group'">
            <router-link to="/admin" class="btn-ghost w-full text-left" active-class="bg-slate-100">Dashboard</router-link>
            <router-link to="/admin/units" class="btn-ghost w-full text-left" active-class="bg-slate-100">Unidades</router-link>
            <router-link to="/admin/users" class="btn-ghost w-full text-left" active-class="bg-slate-100">Usuarios</router-link>
            <router-link to="/admin/agents" class="btn-ghost w-full text-left" active-class="bg-slate-100">Agentes</router-link>
            <router-link to="/admin/perfil" class="btn-ghost w-full text-left" active-class="bg-slate-100">Perfil</router-link>
          </template>
          <!-- SUPERADMIN o SUPERVISION -->
          <template v-else-if="me && (me.role === 'superadmin' || me.role === 'supervision')">
            <router-link to="/admin" class="btn-ghost w-full text-left" active-class="bg-slate-100">Dashboard</router-link>
            <router-link to="/admin/groups" class="btn-ghost w-full text-left" active-class="bg-slate-100">Grupos</router-link>
            <router-link to="/admin/units" class="btn-ghost w-full text-left" active-class="bg-slate-100">Unidades</router-link>
            <router-link to="/admin/users" class="btn-ghost w-full text-left" active-class="bg-slate-100">Usuarios</router-link>
            <router-link to="/admin/agents" class="btn-ghost w-full text-left" active-class="bg-slate-100">Agentes</router-link>
            <router-link to="/admin/perfil" class="btn-ghost w-full text-left" active-class="bg-slate-100">Perfil</router-link>
          </template>
          <button @click="logout" class="btn-ghost w-full text-left">Cerrar sesión</button>
        </nav>
      </div>
    </transition>
    <!-- MAIN universal para todas las vistas -->
    <main class="max-w-6xl mx-auto px-2 sm:px-4 py-4 space-y-5">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const drawerOpen = ref(false)
const me = ref(null)

// ==== Cargar usuario global para menú ====
async function loadMe() {
  try {
    const { data } = await axios.get('/me', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    me.value = data
  } catch {
    me.value = null
  }
}
onMounted(loadMe)

// ==== Logout global y confiable ====
function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}
</script>
