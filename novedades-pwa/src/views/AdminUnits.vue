<template>
  <AdminMenuLayout :me="me" :logout="logout">
    <div class="max-w-3xl mx-auto py-6">
      <h1 class="text-xl font-bold mb-4">Unidades de mi Grupo</h1>
      <!-- Crear nueva unidad -->
      <form @submit.prevent="crearUnidad" class="flex gap-2 mb-4">
        <input class="input" v-model="nuevaUnidad.name" placeholder="Nombre de la unidad" required>
        <input class="input" v-model="nuevaUnidad.description" placeholder="Descripción (opcional)">
        <button class="btn-primary">Crear unidad</button>
      </form>
      <!-- Listado de unidades -->
      <div v-if="unidades.length">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in unidades" :key="u.id">
              <td>
                <input class="input" v-model="u.editName" @blur="editarUnidad(u)" />
              </td>
              <td>
                <input class="input" v-model="u.editDescription" @blur="editarUnidad(u)" />
              </td>
              <td>
                <!-- Solo muestra editar inline, sin eliminar para seguridad -->
                <span class="text-green-500" v-if="u.guardado">✓</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-slate-500">No tienes unidades aún.</div>
    </div>
  </AdminMenuLayout>
</template>

<script setup>
import AdminMenuLayout from './AdminMenuLayout.vue'
import { ref, onMounted } from 'vue'
import axios from 'axios'

const unidades = ref([])
const nuevaUnidad = ref({ name: '', description: '' })
const me = ref(JSON.parse(localStorage.getItem('me') || '{}'))

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}

async function cargarUnidades() {
  const { data } = await axios.get('/my/units', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  unidades.value = (data || []).map(u => ({
    ...u, editName: u.name, editDescription: u.description, guardado: false
  }))
}
async function crearUnidad() {
  if (!nuevaUnidad.value.name) return
  await axios.post('/my/units', nuevaUnidad.value, {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  nuevaUnidad.value = { name: '', description: '' }
  await cargarUnidades()
}
async function editarUnidad(u) {
  if (!u.editName) return
  await axios.put(`/my/units/${u.id}`, {
    name: u.editName,
    description: u.editDescription
  }, {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  u.guardado = true
  setTimeout(() => (u.guardado = false), 1000)
}

onMounted(cargarUnidades)
</script>
