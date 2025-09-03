<template>
  <div class="min-h-screen bg-slate-50">
    <main class="max-w-3xl mx-auto py-6">
      <h2 class="text-xl font-bold mb-4">
        Unidades <span v-if="isAdmin">(todas)</span><span v-else>de mi grupo</span>
      </h2>
      <!-- Formulario de creación -->
      <form v-if="canCreate" @submit.prevent="crearUnidad" class="flex gap-2 mb-4">
        <input class="input" v-model="nuevaUnidad.name" placeholder="Nombre de la unidad" required>
        <input class="input" v-model="nuevaUnidad.description" placeholder="Descripción (opcional)">
        <select v-if="isAdmin" class="input" v-model="nuevaUnidad.groupId" required>
          <option value="" disabled selected>Grupo</option>
          <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.code }} ({{ g.name }})</option>
        </select>
        <button class="btn-primary">Crear unidad</button>
      </form>
      <!-- Listado de unidades -->
      <div v-if="unidades.length">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th v-if="isAdmin">Grupo</th>
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
              <td v-if="isAdmin">{{ u.groupCode }} ({{ u.groupName || '' }})</td>
              <td>
                <span class="text-green-500" v-if="u.guardado">✓</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-slate-500">No tienes unidades aún.</div>
    </main>
  </div>
</template>


<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

const me = ref(JSON.parse(localStorage.getItem('me') || '{}'))
const unidades = ref([])
const grupos = ref([])
const nuevaUnidad = ref({ name: '', description: '', groupId: '' })

const isAdmin = computed(() =>
  ['superadmin', 'supervision'].includes((me.value.role || '').toLowerCase())
)
const canCreate = computed(() =>
  isAdmin.value || (me.value.role === 'leader_group')
)

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}

async function cargarUnidades() {
  if (isAdmin.value) {
    const { data } = await axios.get('/admin/units', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    unidades.value = (data || []).map(u => ({
      ...u,
      editName: u.name,
      editDescription: u.description,
      groupCode: u.groupCode,
      groupName: u.groupName || '',
      groupId: u.groupId,
      guardado: false
    }))
    await cargarGrupos()
  } else {
    const { data } = await axios.get('/my/units', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    unidades.value = (data || []).map(u => ({
      ...u, editName: u.name, editDescription: u.description, guardado: false
    }))
  }
}
async function cargarGrupos() {
  const { data } = await axios.get('/admin/groups', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  grupos.value = data || []
}
async function crearUnidad() {
  if (!nuevaUnidad.value.name) return
  if (isAdmin.value) {
    await axios.post('/admin/units', nuevaUnidad.value, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
  } else {
    await axios.post('/my/units', nuevaUnidad.value, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
  }
  nuevaUnidad.value = { name: '', description: '', groupId: '' }
  await cargarUnidades()
}
async function editarUnidad(u) {
  if (!u.editName) return
  if (isAdmin.value) {
    await axios.put(`/admin/units/${u.id}`, {
      name: u.editName,
      description: u.editDescription,
      groupId: u.groupId
    }, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
  } else {
    await axios.put(`/my/units/${u.id}`, {
      name: u.editName,
      description: u.editDescription
    }, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
  }
  u.guardado = true
  setTimeout(() => (u.guardado = false), 1000)
}

onMounted(() => {
  console.log('me.value:', me.value)
  console.log('isAdmin:', isAdmin.value)
  cargarUnidades()
})

</script>
