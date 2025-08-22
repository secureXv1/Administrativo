<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold">Grupos</h1>
        <nav class="flex items-center gap-3">
          <router-link to="/admin" class="btn-ghost">Dashboard</router-link>
          <router-link to="/admin/groups" class="btn-ghost">Grupos</router-link>
          <router-link to="/admin/users" class="btn-ghost">Usuarios</router-link>
          <router-link to="/admin/agents" class="btn-ghost">Agentes</router-link>

          <router-link to="/perfil" class="btn-ghost flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A10.97 10.97 0 0112 15c2.21 0 4.266.714 5.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Perfil
          </router-link>
          
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
          <!-- Formulario para crear/editar -->
          <form class="mb-6 flex flex-wrap gap-2 items-end" @submit.prevent="onSubmit">
            <input class="input" v-model="form.code" placeholder="Código" maxlength="20" required style="width:120px" />
            <input class="input" v-model="form.name" placeholder="Nombre" maxlength="80" required style="width:260px" />
            <button class="btn-primary" type="submit">
              {{ form.id ? 'Actualizar' : 'Crear grupo' }}
            </button>
            <button v-if="form.id" class="btn-ghost" @click.prevent="resetForm">Cancelar</button>
          </form>

          <table class="table">
            <thead>
              <tr>
                <th style="width: 80px">ID</th>
                <th style="width: 180px">Código</th>
                <th>Nombre</th>
                <th style="width:90px"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in groups" :key="g.id">
                <td>{{ g.id }}</td>
                <td>{{ g.code }}</td>
                <td>{{ g.name || '—' }}</td>
                <td>
                  <div class="flex gap-1 items-center justify-center">
                    <!-- Editar -->
                    <button class="btn-ghost p-1" title="Editar" @click="editGroup(g)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-pencil" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L8.5 18.1a2 2 0 0 1-.9.5l-4 1a1 1 0 0 1-1.2-1.2l1-4a2 2 0 0 1 .5-.9Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <!-- Eliminar -->
                    <button class="btn-ghost p-1" title="Eliminar" @click="deleteGroup(g)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-trash-2" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/><path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="groups.length === 0">
                <td colspan="4" class="text-center text-slate-500 py-6">Sin grupos</td>
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

// Formulario reactivo
const form = ref({ id: null, code: '', name: '' })

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

function resetForm() {
  form.value = { id: null, code: '', name: '' }
  msg.value = ''
}

// Crear o actualizar
async function onSubmit() {
  if (!form.value.code.trim()) { msg.value = 'El código es requerido'; return }
  if (!form.value.name.trim()) { msg.value = 'El nombre es requerido'; return }
  try {
    if (!form.value.id) {
      // Crear
      await axios.post('/admin/groups', {
        code: form.value.code.trim(),
        name: form.value.name.trim()
      }, {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
      })
      msg.value = 'Grupo creado ✅'
    } else {
      // Editar
      await axios.put(`/admin/groups/${form.value.id}`, {
        code: form.value.code.trim(),
        name: form.value.name.trim()
      }, {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
      })
      msg.value = 'Grupo actualizado ✅'
    }
    await load()
    resetForm()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al guardar'
  }
}

function editGroup(g) {
  form.value = { ...g }
}

async function deleteGroup(g) {
  if (!confirm(`¿Eliminar grupo ${g.code}?`)) return
  try {
    await axios.delete(`/admin/groups/${g.id}`, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    msg.value = 'Grupo eliminado ✅'
    await load()
    resetForm()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo eliminar'
  }
}

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}

onMounted(load)
</script>
