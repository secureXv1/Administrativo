<template>
  <div class="min-h-screen bg-slate-50">
    <main class="max-w-3xl mx-auto py-6 px-3 sm:px-0">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 class="text-xl font-bold">
          Unidades <span v-if="isAdmin">(todas)</span><span v-else>de mi grupo</span>
        </h2>

        <!-- Filtro por grupo: superadmin/supervision -->
        <div v-if="isAdmin" class="flex items-center gap-2">
          <label class="text-sm text-slate-600">Grupo:</label>
          <select v-model="selectedGroupId" class="input min-w-[180px]">
            <option value="all">Todas ({{ unidades.length }})</option>
            <option
              v-for="g in grupos"
              :key="g.id"
              :value="String(g.id)"
            >
              {{ g.code }} ({{ g.name }}) — {{ groupCounts[g.id] || 0 }}
            </option>
          </select>
        </div>
      </div>

      <!-- Resumen de conteos por grupo -->
      <div v-if="isAdmin && unidades.length" class="text-xs text-slate-600 mb-3 flex flex-wrap gap-2">
        <span class="inline-flex items-center gap-1 bg-white rounded-full px-2 py-1 border">
          Total: <strong>{{ unidades.length }}</strong>
        </span>
        <span
          v-for="g in grupos"
          :key="g.id"
          class="inline-flex items-center gap-1 bg-white rounded-full px-2 py-1 border"
        >
          {{ g.code }}: <strong>{{ groupCounts[g.id] || 0 }}</strong>
        </span>
      </div>

      <!-- Formulario de creación: SOLO superadmin -->
      <form v-if="canCreate" @submit.prevent="crearUnidad" class="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
        <input class="input sm:col-span-1" v-model="nuevaUnidad.name" placeholder="Nombre" required>
        <input class="input sm:col-span-1" v-model="nuevaUnidad.description" placeholder="Descripción (opcional)">
        <select v-if="isAdmin" class="input sm:col-span-1" v-model="nuevaUnidad.groupId" required>
          <option value="" disabled>Grupo</option>
          <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.code }} ({{ g.name }})</option>
        </select>
        <button class="btn-primary sm:col-span-1">Crear unidad</button>
      </form>

      <!-- Listado -->
      <div v-if="filteredUnidades.length">
        <table class="table w-full text-sm">
          <thead>
            <tr>
              <th class="w-[35%]">Nombre</th>
              <th class="w-[45%]">Descripción</th>
              <th v-if="isAdmin" class="w-[20%]">Grupo</th>
              <!-- Acciones SOLO si superadmin -->
              <th v-if="isSuperadmin" class="w-[10%] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filteredUnidades" :key="u.id">
              <!-- Nombre -->
              <td>
                <template v-if="isSuperadmin && u._editing">
                  <input class="input" v-model="u.editName" />
                </template>
                <template v-else>
                  {{ u.editName }}
                </template>
              </td>

              <!-- Descripción -->
              <td>
                <template v-if="isSuperadmin && u._editing">
                  <input class="input" v-model="u.editDescription" />
                </template>
                <template v-else>
                  {{ u.editDescription }}
                </template>
              </td>

              <!-- Grupo -->
              <td v-if="isAdmin">
                <template v-if="isSuperadmin && u._editing">
                  <select class="input" v-model="u.groupId">
                    <option v-for="g in grupos" :key="g.id" :value="g.id">
                      {{ g.code }} ({{ g.name }})
                    </option>
                  </select>
                </template>
                <template v-else>
                  {{ u.groupCode }} <span v-if="u.groupName">({{ u.groupName }})</span>
                </template>
              </td>

              <!-- Acciones SOLO superadmin -->
            
                <td v-if="isSuperadmin" class="text-right">
                  <div class="flex justify-end gap-2">
                    <span class="text-green-600" v-if="u.guardado">✓</span>

                    <!-- Modo normal -->
                    <template v-if="!u._editing">
                      <button
                        type="button"
                        @click="startEdit(u)"
                        class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        title="Editar"
                        aria-label="Editar"
                      >
                        <!-- lápiz -->
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <path d="M4 21h4l11-11a2.828 2.828 0 10-4-4L4 17v4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                       
                      </button>

                      <button
                        type="button"
                        @click="deleteUnidad(u)"
                        class="inline-flex items-center gap-1 rounded-lg border border-red-600 bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                        title="Eliminar"
                        aria-label="Eliminar"
                      >
                        <!-- papelera -->
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <path d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 01-2 2H9a2 2 0 01-2-2V6h10z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        
                      </button>
                    </template>

                    <!-- Modo edición -->
                    <template v-else>
                      <button
                        type="button"
                        @click="saveUnidad(u)"
                        class="inline-flex items-center gap-1 rounded-lg border border-blue-600 bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        title="Guardar"
                        aria-label="Guardar"
                      >
                        <!-- check -->
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>Guardar</span>
                      </button>

                      <button
                        type="button"
                        @click="cancelEdit(u)"
                        class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        title="Cancelar"
                        aria-label="Cancelar"
                      >
                        <!-- X -->
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>Cancelar</span>
                      </button>
                    </template>
                  </div>
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
const selectedGroupId = ref('all') // 'all' o id en string
const nuevaUnidad = ref({ name: '', description: '', groupId: '' })

// Quien ve "todas" (columna grupo y GET /admin/units)
const isAdmin = computed(() =>
  ['superadmin', 'supervision', 'supervisor'].includes((me.value.role || '').toLowerCase())
)
// Quien puede CREAR/EDITAR/ELIMINAR
const isSuperadmin = computed(() =>
  (me.value.role || '').toLowerCase() === 'superadmin'
)
const canCreate = computed(() => isSuperadmin.value)

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
  try {
    if (isAdmin.value) {
      const { data } = await axios.get('/admin/units', { headers: authHeader() })
      unidades.value = (data || []).map(u => ({
        ...u,
        editName: u.name,
        editDescription: u.description,
        groupCode: u.groupCode,
        groupName: u.groupName || '',
        groupId: u.groupId,
        _editing: false,
        _original: null,
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

  // Fallback líder de grupo (solo lectura)
  try {
    const { data } = await axios.get('/my/units', { headers: authHeader() })
    unidades.value = (data || []).map(u => ({
      ...u,
      editName: u.name,
      editDescription: u.description,
      _editing: false,
      _original: null,
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

// --- Filtro por grupo (cliente) ---
const filteredUnidades = computed(() => {
  if (!isAdmin.value) return unidades.value
  if (selectedGroupId.value === 'all') return unidades.value
  return unidades.value.filter(u => String(u.groupId) === String(selectedGroupId.value))
})

// Conteo por grupo
const groupCounts = computed(() => {
  const counts = {}
  for (const u of unidades.value) {
    counts[u.groupId] = (counts[u.groupId] || 0) + 1
  }
  return counts
})

// --- Crear: SOLO superadmin ---
async function crearUnidad() {
  if (!isSuperadmin.value) return
  if (!nuevaUnidad.value.name || !nuevaUnidad.value.groupId) return
  try {
    await axios.post('/admin/units', {
      name: nuevaUnidad.value.name.trim(),
      description: (nuevaUnidad.value.description || '').trim(),
      groupId: nuevaUnidad.value.groupId
    }, { headers: authHeader() })
    nuevaUnidad.value = { name: '', description: '', groupId: '' }
    await cargarUnidades()
  } catch (e) {
    console.error('crearUnidad error:', e?.response?.status, e?.response?.data)
  }
}

// --- Edición por fila: SOLO superadmin ---
function startEdit(u) {
  if (!isSuperadmin.value) return
  u._original = {
    name: u.editName,
    description: u.editDescription,
    groupId: u.groupId
  }
  u._editing = true
}

function cancelEdit(u) {
  if (!u._original) { u._editing = false; return }
  u.editName = u._original.name
  u.editDescription = u._original.description
  u.groupId = u._original.groupId
  u._editing = false
  u._original = null
}

async function saveUnidad(u) {
  if (!isSuperadmin.value) return
  if (!u.editName) return
  try {
    await axios.put(`/admin/units/${u.id}`, {
      name: u.editName.trim(),
      description: (u.editDescription || '').trim(),
      groupId: u.groupId
    }, { headers: authHeader() })
    // Actualiza datos base
    u.name = u.editName
    u.description = u.editDescription
    // Refresca etiquetas de grupo si cambió
    const g = grupos.value.find(g => g.id === u.groupId)
    if (g) {
      u.groupCode = g.code
      u.groupName = g.name
    }
    u.guardado = true
    setTimeout(() => (u.guardado = false), 1000)
    u._editing = false
    u._original = null
  } catch (e) {
    console.error('saveUnidad error:', e?.response?.status, e?.response?.data)
  }
}

// --- Eliminar por fila: SOLO superadmin (con confirmación) ---
async function deleteUnidad(u) {
  if (!isSuperadmin.value) return
  const ok = window.confirm(`¿Eliminar la unidad "${u.name}"? Esta acción no se puede deshacer.`)
  if (!ok) return
  try {
    await axios.delete(`/admin/units/${u.id}`, { headers: authHeader() })
    // Quitar localmente
    const idx = unidades.value.findIndex(x => x.id === u.id)
    if (idx >= 0) unidades.value.splice(idx, 1)
  } catch (e) {
    console.error('deleteUnidad error:', e?.response?.status, e?.response?.data)
  }
}

onMounted(async () => {
  await ensureMe()
  await cargarUnidades()
})
</script>

<style scoped>
.input {
  @apply w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500;
}
.btn-primary {
  @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700;
}
.table thead th {
  @apply text-left text-slate-600 font-semibold;
}
.table tbody td {
  @apply align-middle;
}

/* Botones con ícono */
.icon-btn {
  @apply inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 hover:bg-slate-100 text-slate-700;
}
.icon-btn.primary { @apply border-blue-600 bg-blue-600 text-white hover:bg-blue-700; }
.icon-btn.danger  { @apply border-red-600  bg-red-600  text-white hover:bg-red-700; }
.icon {
  width: 18px; height: 18px;
}
</style>
