<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-slate-800">Listado de usuarios</h2>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <!-- Bloque de mensaje -->
        <div v-if="msg" :class="[msgClass, 'mb-4', 'text-base', 'font-semibold']">
          {{ msg }}
        </div>
        <!-- Formulario crear/editar -->
        <form class="mb-6 flex flex-wrap gap-2 items-end" @submit.prevent="onSubmit">
          <input class="input" v-model="form.email" type="email" placeholder="Email" required style="width:190px" />
          <select class="input" v-model="form.role" required style="width:120px">
            <option value="" disabled>Rol</option>
            <option value="admin">Admin</option>
            <option value="leader">Leader</option>
            <option value="viewer">Viewer</option>
          </select>
          <select class="input" v-model="form.groupId" required style="width:170px">
            <option value="" disabled>Grupo</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.code }} ({{ g.name }})</option>
          </select>
          <input
            class="input"
            type="password"
            v-model="form.password"
            :placeholder="form.id ? 'Nueva contraseña (deja vacío para no cambiarla)' : 'Contraseña'"
            :required="!form.id"
            style="width:160px"
          />
          <button class="btn-primary" type="submit">
            {{ form.id ? 'Actualizar' : 'Crear usuario' }}
          </button>
          <button v-if="form.id" class="btn-ghost" @click.prevent="resetForm">Cancelar</button>
        </form>

        <table class="table">
          <thead>
            <tr>
              <th style="width:80px">ID</th>
              <th>Email</th>
              <th style="width:120px">Rol</th>
              <th style="width:140px">Grupo</th>
              <th style="width:80px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.id }}</td>
              <td>{{ u.email }}</td>
              <td class="uppercase">{{ u.role }}</td>
              <td>{{ u.groupCode || '—' }}</td>
              <td>
                <div class="flex gap-1 items-center justify-center">
                  <!-- Editar -->
                  <button class="btn-ghost p-1" title="Editar" @click="editUser(u)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-pencil" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L8.5 18.1a2 2 0 0 1-.9.5l-4 1a1 1 0 0 1-1.2-1.2l1-4a2 2 0 0 1 .5-.9Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <!-- Eliminar -->
                  <button class="btn-ghost p-1" title="Eliminar" @click="deleteUser(u)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-trash-2" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/><path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="users.length===0">
              <td colspan="5" class="text-center text-slate-500 py-6">Sin usuarios</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>


<script setup>
import AdminMenuLayout from './AdminMenuLayout.vue'
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const users = ref([])
const groups = ref([])
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')
const me = ref(JSON.parse(localStorage.getItem('me') || '{}'))

// Formulario reactivo
const form = ref({ id: null, email: '', role: '', groupId: '', password: '' })

function clearMsgAfterDelay() {
  setTimeout(() => { msg.value = '' }, 2500)
}

// Cargar grupos y usuarios
async function loadAll() {
  msg.value = ''
  try {
    const { data: usersData } = await axios.get('/admin/users', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    users.value = Array.isArray(usersData) ? usersData : []
    if (!users.value.length) msg.value = 'No hay usuarios para mostrar'
    const { data: groupsData } = await axios.get('/admin/groups', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    groups.value = Array.isArray(groupsData) ? groupsData : []
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al cargar datos'
    clearMsgAfterDelay()
  }
}

function resetForm() {
  form.value = { id: null, email: '', role: '', groupId: '', password: '' }
  msg.value = ''
}

// Crear o actualizar usuario
async function onSubmit() {
  if (!form.value.email.trim()) { msg.value = 'El email es requerido'; clearMsgAfterDelay(); return }
  if (!form.value.role) { msg.value = 'Selecciona el rol'; clearMsgAfterDelay(); return }
  if (!form.value.groupId) { msg.value = 'Selecciona un grupo'; clearMsgAfterDelay(); return }
  if (!form.value.id && !form.value.password) { msg.value = 'Contraseña requerida'; clearMsgAfterDelay(); return }
  try {
    if (!form.value.id) {
      // Crear
      await axios.post('/admin/users', {
        email: form.value.email.trim(),
        role: form.value.role,
        groupId: form.value.groupId,
        password: form.value.password
      }, {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
      })
      msg.value = 'Usuario creado ✅'
    } else {
      // Editar (si no cambia password no la manda)
      const payload = {
        email: form.value.email.trim(),
        role: form.value.role,
        groupId: form.value.groupId
      }
      if (form.value.password) payload.password = form.value.password
      await axios.put(`/admin/users/${form.value.id}`, payload, {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
      })
      msg.value = 'Usuario actualizado ✅'
    }
    await loadAll()
    resetForm()
    clearMsgAfterDelay()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al guardar'
    clearMsgAfterDelay()
  }
}

function editUser(u) {
  form.value = { ...u, password: '' }
}

async function deleteUser(u) {
  if (!confirm(`¿Eliminar usuario ${u.email}?`)) return
  try {
    await axios.delete(`/admin/users/${u.id}`, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    msg.value = 'Usuario eliminado ✅'
    await loadAll()
    resetForm()
    clearMsgAfterDelay()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo eliminar'
    clearMsgAfterDelay()
  }
}

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}

onMounted(loadAll)
</script>
