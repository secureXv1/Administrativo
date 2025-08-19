<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold">Grupos</h1>
        <nav class="flex items-center gap-3">
          <router-link to="/admin" class="btn-ghost">Dashboard</router-link>
          <router-link to="/admin/users" class="btn-ghost">Usuarios</router-link>
          <button @click="logout" class="btn-ghost">Cerrar sesión</button>
        </nav>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-slate-800">Listado de grupos</h2>
            <span v-if="msg" :class="msgClass" class="text-sm">{{ msg }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 80px">ID</th>
                <th style="width: 180px">Código</th>
                <th>Nombre</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in groups" :key="g.id">
                <td>{{ g.id }}</td>
                <td>{{ g.code }}</td>
                <td>{{ g.name || '—' }}</td>
              </tr>
              <tr v-if="groups.length === 0">
                <td colspan="3" class="text-center text-slate-500 py-6">Sin grupos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const groups = ref([])
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

async function load() {
  msg.value = ''
  try {
    const { data } = await axios.get('/admin/groups', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    groups.value = Array.isArray(data) ? data : []
    if (!groups.value.length) msg.value = 'No hay grupos para mostrar'
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al cargar grupos'
  }
}

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}

onMounted(load)
</script>
