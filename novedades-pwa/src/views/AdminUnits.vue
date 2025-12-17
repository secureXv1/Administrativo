<template>
  <div class="max-w-9xl mx-auto space-y-6">
    <!-- HEADER -->
    <div class="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-slate-200">
      <div class="max-w-9xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 grid place-items-center text-white font-bold">C</div>
          <div>
            <h2 class="font-semibold text-slate-900">Unidades</h2>
            <p class="text-slate-500 text-xs">Gestión de unidades.</p>
          </div>
        </div>
        <div class="text-sm text-slate-600">
          Rol: <b>{{ me?.role || '—' }}</b>
        </div>
      </div>
    </div>
    <main class="max-w-9xl mx-auto py-6 px-4 space-y-6">
      <!-- Encabezado + filtro por grupo -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 class="text-xl font-bold">
          Unidades <span v-if="isAdmin">(todas)</span><span v-else>de mi grupo</span>
        </h2>

        <div v-if="isAdmin" class="flex items-center gap-2">
          <label class="label">Grupo</label>
          <select v-model="selectedGroupId" class="input min-w-[200px]">
            <option value="all">Todas ({{ unidades.length }})</option>
            <option v-for="g in grupos" :key="g.id" :value="String(g.id)">
              {{ g.code }} ({{ g.name }}) — {{ groupCounts[g.id] || 0 }}
            </option>
          </select>
        </div>
      </div>

      <!-- Resumen de conteos por grupo -->
      <div v-if="isAdmin && unidades.length" class="text-xs text-slate-600 flex flex-wrap gap-2">
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

      <!-- Formulario de creación (solo superadmin) -->
      <div v-if="canCreate" class="card">
        <div class="card-body">
          <form @submit.prevent="crearUnidad" class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label class="label">Nombre</label>
              <input class="input" v-model="nuevaUnidad.name" placeholder="Nombre" required>
            </div>
            <div>
              <label class="label">Descripción</label>
              <input class="input" v-model="nuevaUnidad.description" placeholder="Descripción (opcional)">
            </div>
            <div v-if="isAdmin">
              <label class="label">Grupo</label>
              <select class="input" v-model="nuevaUnidad.groupId" required>
                <option value="" disabled>Selecciona</option>
                <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.code }} ({{ g.name }})</option>
              </select>
            </div>
            <div class="flex gap-2">
              <button class="btn-primary">Crear</button>
              <button type="button" class="btn-ghost" @click="nuevaUnidad = { name:'', description:'', groupId:'' }">Limpiar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Tabla -->
      <div class="card">
        <div class="card-body">
          <div v-if="filteredUnidades.length" class="overflow-x-auto">
            <table class="table w-full min-w-[860px]">
              <thead>
                <tr>
                  <th class="w-[28%]">Nombre</th>
                  <th class="w-[42%]">Descripción</th>
                  <th v-if="isAdmin" class="w-[20%]">Grupo</th>
                  <th v-if="isSuperadmin" class="w-[10%] text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in filteredUnidades" :key="u.id">
                  <td class="font-medium">{{ u.editName }}</td>
                  <td class="text-slate-700">{{ u.editDescription || '—' }}</td>
                  <td v-if="isAdmin">
                    <span class="text-slate-800">{{ u.groupCode }}</span>
                    <span v-if="u.groupName" class="text-slate-500"> ({{ u.groupName }})</span>
                  </td>
                  <td v-if="isSuperadmin" class="text-center">
                    <div class="inline-flex gap-2 items-center justify-center">
                      <button class="btn-ghost p-1" title="Editar" @click="openEdit(u)">
                        <!-- icon pencil -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M18 2a2.828 2.828 0 0 1 4 4L7 21l-4 1 1-4Z"></path><path d="m16 5 3 3"></path>
                        </svg>
                      </button>
                      <button class="btn-ghost p-1" title="Eliminar" @click="deleteUnidad(u)">
                        <!-- icon trash -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/>
                        <path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/>
                        <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                      </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="text-slate-500">No tienes unidades aún.</div>
        </div>
      </div>
    </main>

    <!-- Modal Edición -->
    <div v-if="editing" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" @click.self="closeEdit">
      <div class="bg-white rounded-xl shadow max-w-2xl w-full">
        <div class="p-4 border-b flex items-center justify-between">
          <div class="font-semibold text-slate-800">
            Editar unidad — {{ form.name }}
          </div>
          <button class="btn-ghost" @click="closeEdit">Cerrar</button>
        </div>

        <div class="p-4 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-1">
              <label class="label">Nombre</label>
              <input class="input" v-model="form.name" />
            </div>
            <div class="sm:col-span-1">
              <label class="label">Descripción</label>
              <input class="input" v-model="form.description" />
            </div>
            <div class="sm:col-span-1" v-if="isAdmin">
              <label class="label">Grupo</label>
              <select class="input" v-model="form.groupId">
                <option v-for="g in grupos" :key="g.id" :value="g.id">
                  {{ g.code }} ({{ g.name }})
                </option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button class="btn-ghost" @click="closeEdit">Cancelar</button>
            <button class="btn-primary" @click="saveEdit">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

/* ===== Estado / Auth ===== */
const me = ref(JSON.parse(localStorage.getItem('me') || '{}'))
function authHeader () { return { Authorization: 'Bearer ' + localStorage.getItem('token') } }
async function ensureMe () {
  try {
    const { data } = await axios.get('/me', { headers: authHeader() })
    me.value = data
    localStorage.setItem('me', JSON.stringify(data))
  } catch {}
}

const isAdmin = computed(() =>
  ['superadmin', 'supervision', 'supervisor'].includes((me.value.role || '').toLowerCase())
)
const isSuperadmin = computed(() => (me.value.role || '').toLowerCase() === 'superadmin')
const canCreate = computed(() => isSuperadmin.value)

/* ===== Datos ===== */
const unidades = ref([])
const grupos = ref([])
const selectedGroupId = ref('all')
const nuevaUnidad = ref({ name: '', description: '', groupId: '' })

/* ===== Cargas ===== */
async function cargarUnidades () {
  try {
    if (isAdmin.value) {
      const { data } = await axios.get('/admin/units', { headers: authHeader() })
      unidades.value = (data || []).map(u => ({
        ...u,
        editName: u.name,
        editDescription: u.description
      }))
      await cargarGrupos()
      return
    }
  } catch (e) {}

  try {
    const { data } = await axios.get('/my/units', { headers: authHeader() })
    unidades.value = (data || []).map(u => ({
      ...u,
      editName: u.name,
      editDescription: u.description
    }))
  } catch (e) {
    unidades.value = []
  }
}

async function cargarGrupos () {
  try {
    const { data } = await axios.get('/admin/groups', { headers: authHeader() })
    grupos.value = data || []
  } catch (e) {}
}

/* ===== Filtros / Conteos ===== */
const filteredUnidades = computed(() => {
  if (!isAdmin.value) return unidades.value
  if (selectedGroupId.value === 'all') return unidades.value
  return unidades.value.filter(u => String(u.groupId) === String(selectedGroupId.value))
})

const groupCounts = computed(() => {
  const counts = {}
  for (const u of unidades.value) counts[u.groupId] = (counts[u.groupId] || 0) + 1
  return counts
})

/* ===== Crear ===== */
async function crearUnidad () {
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
  } catch (e) {}
}

/* ===== Modal edición ===== */
const editing = ref(null)
const form = ref({ id:null, name:'', description:'', groupId:null })

function openEdit (u) {
  if (!isSuperadmin.value) return
  editing.value = u
  form.value = {
    id: u.id,
    name: u.editName,
    description: u.editDescription || '',
    groupId: u.groupId
  }
}
function closeEdit () { editing.value = null }

/* Guardar edición (misma lógica de endpoints) */
async function saveEdit () {
  if (!isSuperadmin.value || !form.value.id) return
  try {
    await axios.put(`/admin/units/${form.value.id}`, {
      name: (form.value.name || '').trim(),
      description: (form.value.description || '').trim(),
      groupId: form.value.groupId
    }, { headers: authHeader() })

    // Actualiza fila local (sin cambiar la lógica de datos)
    const u = unidades.value.find(x => x.id === form.value.id)
    if (u) {
      u.editName = form.value.name
      u.name = form.value.name
      u.editDescription = form.value.description
      u.description = form.value.description
      u.groupId = form.value.groupId
      const g = grupos.value.find(g => g.id === form.value.groupId)
      if (g) {
        u.groupCode = g.code
        u.groupName = g.name
      }
    }
    closeEdit()
  } catch (e) {}
}

/* Eliminar (igual endpoints) */
async function deleteUnidad (u) {
  if (!isSuperadmin.value) return
  const ok = window.confirm(`¿Eliminar la unidad "${u.name}"? Esta acción no se puede deshacer.`)
  if (!ok) return
  try {
    await axios.delete(`/admin/units/${u.id}`, { headers: authHeader() })
    const idx = unidades.value.findIndex(x => x.id === u.id)
    if (idx >= 0) unidades.value.splice(idx, 1)
  } catch (e) {}
}

/* Init */
onMounted(async () => {
  await ensureMe()
  await cargarUnidades()
})
</script>

<style scoped>
.input { @apply w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500; }
.btn-primary { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700; }
.btn-ghost { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100; }
.label { @apply text-sm text-slate-600; }
.card { @apply bg-white rounded-xl shadow; }
.card-body { @apply p-4; }
.table th, .table td { @apply whitespace-nowrap; }
</style>
