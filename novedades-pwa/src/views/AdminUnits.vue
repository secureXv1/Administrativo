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

// Si en tu BD hay usuarios con 'supervisor' en vez de 'supervision', inclúyelo.
const isAdmin = computed(() =>
  ['superadmin', 'supervision', 'supervisor'].includes((me.value.role || '').toLowerCase())
)
const canCreate = computed(() =>
  isAdmin.value || (me.value.role === 'leader_group')
)

function authHeader() {
  return { Authorization: 'Bearer ' + localStorage.getItem('token') }
}

async function ensureMe() {
  try {
    const { data } = await axios.get('/me', { headers: authHeader() })
    me.value = data
    localStorage.setItem('me', JSON.stringify(data))
  } catch (e) {
    console.error('No se pudo cargar /me:', e?.response?.status, e?.response?.data)
  }
}

async function cargarUnidades() {
  // Estrategia: probar admin primero; si 403, probar my/units.
  try {
    if (isAdmin.value) {
      const { data } = await axios.get('/admin/units', { headers: authHeader() })
      unidades.value = (data || []).map(u => ({
        ...u,
        editName: u.name,
        editDescription: u.description,
        groupCode: u.groupCode,
        groupName: u.groupName || '', // lo mandaremos desde backend
        groupId: u.groupId,
        guardado: false
      }))
      await cargarGrupos()
      return
    }
  } catch (e) {
    if (e?.response?.status !== 403) {
      console.error('Error /admin/units:', e?.response?.status, e?.response?.data)
    }
  }

  // Fallback para líderes de grupo:
  try {
    const { data } = await axios.get('/my/units', { headers: authHeader() })
    unidades.value = (data || []).map(u => ({
      ...u,
      editName: u.name,
      editDescription: u.description,
      guardado: false
    }))
  } catch (e) {
    console.error('Error /my/units:', e?.response?.status, e?.response?.data)
    unidades.value = []
  }
}

async function cargarGrupos() {
  try {
    const { data } = await axios.get('/admin/groups', { headers: authHeader() })
    grupos.value = data || []
  } catch (e) {
    console.error('Error /admin/groups:', e?.response?.status, e?.response?.data)
  }
}

async function crearUnidad() {
  if (!nuevaUnidad.value.name) return
  try {
    if (isAdmin.value) {
      await axios.post('/admin/units', nuevaUnidad.value, { headers: authHeader() })
    } else {
      await axios.post('/my/units', nuevaUnidad.value, { headers: authHeader() })
    }
    nuevaUnidad.value = { name: '', description: '', groupId: '' }
    await cargarUnidades()
  } catch (e) {
    console.error('crearUnidad error:', e?.response?.status, e?.response?.data)
  }
}

async function editarUnidad(u) {
  if (!u.editName) return
  try {
    if (isAdmin.value) {
      await axios.put(`/admin/units/${u.id}`, {
        name: u.editName,
        description: u.editDescription,
        groupId: u.groupId
      }, { headers: authHeader() })
    } else {
      await axios.put(`/my/units/${u.id}`, {
        name: u.editName,
        description: u.editDescription
      }, { headers: authHeader() })
    }
    u.guardado = true
    setTimeout(() => (u.guardado = false), 1000)
  } catch (e) {
    console.error('editarUnidad error:', e?.response?.status, e?.response?.data)
  }
}

onMounted(async () => {
  await ensureMe()
  console.log('me.value:', me.value)
  console.log('isAdmin:', isAdmin.value)
  await cargarUnidades()
})
</script>
