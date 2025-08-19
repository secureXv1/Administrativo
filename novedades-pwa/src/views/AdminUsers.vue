<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold">Usuarios</h1>
        <nav class="flex items-center gap-3">
          <router-link to="/admin" class="btn-ghost">Dashboard</router-link>
          <router-link to="/admin/groups" class="btn-ghost">Grupos</router-link>
          <button @click="logout" class="btn-ghost">Cerrar sesión</button>
        </nav>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-slate-800">Listado de usuarios</h2>
            <span v-if="msg" :class="msgClass" class="text-sm">{{ msg }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <table class="table">
            <thead>
              <tr>
                <th style="width:80px">ID</th>
                <th>Email</th>
                <th style="width:120px">Rol</th>
                <th style="width:140px">Grupo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>{{ u.id }}</td>
                <td>{{ u.email }}</td>
                <td class="uppercase">{{ u.role }}</td>
                <td>{{ u.groupCode || '—' }}</td>
              </tr>
              <tr v-if="users.length===0">
                <td colspan="4" class="text-center text-slate-500 py-6">Sin usuarios</td>
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

const users = ref([])
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

async function load() {
  msg.value = ''
  try {
    const { data } = await axios.get('/admin/users', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    users.value = Array.isArray(data) ? data : []
    if (!users.value.length) msg.value = 'No hay usuarios para mostrar'
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al cargar usuarios'
  }
}

function logout(){
  localStorage.removeItem('token')
  window.location.href = '/login'
}

onMounted(load)
</script>
