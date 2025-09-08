<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Topbar -->
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">A</div>
          <div class="text-slate-900 font-semibold">Grupos</div>
        </div>
        <div class="text-sm text-slate-600">
          Rol: <b>{{ me?.role || '—' }}</b>
        </div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <!-- Bloqueo por rol -->
      <div v-if="!isAllowed" class="card">
        <div class="card-body">
          <div class="text-red-600 font-medium">No autorizado</div>
          <p class="text-slate-600 text-sm">Tu rol no tiene acceso a esta sección.</p>
        </div>
      </div>

      <template v-else>
        <!-- Crear grupo (solo superadmin) -->
        <div v-if="isSuperadmin" class="card">
          <div class="card-body">
            <h3 class="font-semibold mb-3">Crear nuevo grupo</h3>
            <form @submit.prevent="createGroup" class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label class="label">Código</label>
                <input class="input" v-model.trim="newGroup.code" placeholder="Ej: A, B, C..." required />
              </div>
              <div>
                <label class="label">Nombre</label>
                <input class="input" v-model.trim="newGroup.name" placeholder="Nombre del grupo" required />
              </div>
              <div class="flex gap-2">
                <button class="btn-primary">Crear</button>
                <button type="button" class="btn-ghost" @click="resetNew">Limpiar</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Filtros -->
        <div class="card">
          <div class="card-body">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="label">Buscar</label>
                <input
                  class="input"
                  v-model.trim="q"
                  placeholder="Filtra por código o nombre..."
                />
              </div>
              <div class="flex items-end">
                <button class="btn-ghost" @click="reload" :disabled="loading">
                  Recargar
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabla -->
        <div class="card">
          <div class="card-body">
            <div class="overflow-auto">
              <table class="table w-full">
                <thead>
                  <tr>
                    <th class="w-24">Código</th>
                    <th>Nombre</th>
                    <th class="w-48 text-right">Unidades</th>
                    <th class="w-64 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="g in filtered" :key="g.id" class="align-top">
                    <!-- Código -->
                    <td>
                      <template v-if="editRow?.id === g.id">
                        <input class="input" v-model.trim="editRow.code" />
                      </template>
                      <template v-else>
                        <b>{{ g.code }}</b>
                      </template>
                    </td>

                    <!-- Nombre -->
                    <td>
                      <template v-if="editRow?.id === g.id">
                        <input class="input" v-model.trim="editRow.name" />
                      </template>
                      <template v-else>
                        {{ g.name }}
                      </template>
                    </td>

                    <!-- Unidades -->
                    <td class="text-right">
                      <span class="inline-flex items-center justify-end gap-2">
                        <span class="font-semibold">{{ unitsCountByGroup[g.id] || 0 }}</span>
                        <router-link
                          v-if="canSeeUnits"
                          class="btn-ghost text-xs"
                          :to="{ path: '/admin/units', query: { groupId: g.id } }"
                          title="Ver unidades de este grupo"
                        >
                          Ver unidades
                        </router-link>
                      </span>
                    </td>

                    <!-- Acciones -->
                    <td class="text-right">
                      <div class="inline-flex gap-2">
                        <!-- Supervisor: sin edición -->
                        <template v-if="isSupervisor">
                          <span class="text-xs text-slate-500">Solo lectura</span>
                        </template>

                        <!-- Superadmin: editar/eliminar -->
                        <template v-else-if="isSuperadmin">
                          <template v-if="editRow?.id === g.id">
                            <button class="btn-primary" @click="saveEdit">Guardar</button>
                            <button class="btn-ghost" @click="cancelEdit">Cancelar</button>
                          </template>
                          <template v-else>
                            <button class="btn-ghost" @click="startEdit(g)">Editar</button>
                            <button class="btn-ghost text-red-600" @click="removeGroup(g)">Eliminar</button>
                          </template>
                        </template>
                      </div>
                    </td>
                  </tr>

                  <tr v-if="!loading && filtered.length === 0">
                    <td colspan="4" class="text-center text-slate-500 py-6">Sin grupos.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="loading" class="text-sm text-slate-500 mt-3">Cargando…</div>
            <div v-if="msg" :class="msgClass" class="mt-2">{{ msg }}</div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const me = ref(null)
const loading = ref(false)
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

const groups = ref([])   // [{id, code, name}]
const units = ref([])    // [{id, name, description, groupId, groupCode, groupName}]
const q = ref('')

// permisos
const isSuperadmin = computed(() => (me.value?.role || '').toLowerCase() === 'superadmin')
const isSupervisor = computed(() => (me.value?.role || '').toLowerCase() === 'supervision')
const isAllowed = computed(() => isSuperadmin.value || isSupervisor.value) // leader_group NO
const canSeeUnits = computed(() => isAllowed.value) // ambos pueden ver unidades

// creación
const newGroup = ref({ code: '', name: '' })
function resetNew () { newGroup.value = { code: '', name: '' } }

// edición inline
const editRow = ref(null) // { id, code, name }
function startEdit(g) {
  editRow.value = { id: g.id, code: g.code, name: g.name }
}
function cancelEdit() {
  editRow.value = null
}

// filtros
const unitsCountByGroup = computed(() => {
  const m = {}
  for (const u of units.value) {
    m[u.groupId] = (m[u.groupId] || 0) + 1
  }
  return m
})

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  const rows = groups.value.map(g => ({
    ...g,
    unitsCount: unitsCountByGroup.value[g.id] || 0
  }))
  if (!term) return rows
  return rows.filter(r =>
    String(r.code).toLowerCase().includes(term) ||
    String(r.name).toLowerCase().includes(term)
  )
})

async function loadMe () {
  try {
    me.value = await axios.get('/me', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    }).then(r => r.data)
  } catch {
    me.value = null
  }
}

async function loadData () {
  loading.value = true
  msg.value = ''
  try {
    const headers = { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    const [gr, un] = await Promise.all([
      axios.get('/admin/groups', { headers }),
      axios.get('/admin/units',  { headers }),
    ])
    groups.value = gr.data || []
    units.value = un.data || []
  } catch (e) {
    msg.value = e.response?.data?.error || 'Error al cargar datos'
  } finally {
    loading.value = false
  }
}

async function createGroup () {
  if (!newGroup.value.code || !newGroup.value.name) {
    msg.value = 'Falta código y/o nombre'
    return
  }
  try {
    await axios.post('/admin/groups', {
      code: newGroup.value.code.trim().toUpperCase(),
      name: newGroup.value.name.trim()
    }, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') } })
    msg.value = 'Grupo creado ✅'
    resetNew()
    await loadData()
  } catch (e) {
    msg.value = e.response?.data?.error || 'No se pudo crear el grupo'
  }
}

async function saveEdit () {
  if (!editRow.value?.id) return
  try {
    await axios.put(`/admin/groups/${editRow.value.id}`, {
      code: (editRow.value.code || '').trim().toUpperCase(),
      name: (editRow.value.name || '').trim()
    }, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') } })
    msg.value = 'Grupo actualizado ✅'
    editRow.value = null
    await loadData()
  } catch (e) {
    msg.value = e.response?.data?.error || 'No se pudo actualizar'
  }
}

async function removeGroup (g) {
  if (!confirm(`¿Eliminar el grupo ${g.code}? Esta acción no se puede deshacer.`)) return
  try {
    await axios.delete(`/admin/groups/${g.id}`, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    msg.value = 'Grupo eliminado ✅'
    await loadData()
  } catch (e) {
    msg.value = e.response?.data?.error || 'No se pudo eliminar'
  }
}

function reload () {
  loadData()
}

onMounted(async () => {
  await loadMe()
  if (isAllowed.value) await loadData()
})
</script>
