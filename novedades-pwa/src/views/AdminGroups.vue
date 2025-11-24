<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- HEADER -->
    <div class="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 grid place-items-center text-white font-bold">C</div>
          <div>
            <h2 class="font-semibold text-slate-900">Grupos</h2>
            <p class="text-slate-500 text-xs">Gestión de grupos.</p>
          </div>
        </div>
        <div class="text-sm text-slate-600">
          Rol: <b>{{ me?.role || '—' }}</b>
        </div>
      </div>
    </div>
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
                <input class="input" v-model.trim="q" placeholder="Filtra por código o nombre..." />
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
              <table class="table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th class="w-24">Código</th>
                    <th>Nombre</th>
                    <th class="w-48 text-right">Unidades</th>
                    <th class="w-44 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="g in filtered" :key="g.id" class="align-top">
                    <td><b>{{ g.code }}</b></td>
                    <td>{{ g.name }}</td>

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
                    <td class="text-center">
                      <div class="inline-flex gap-2 items-center justify-center">
                        <!-- Supervisor: solo lectura -->
                        <template v-if="isSupervisor">
                          <span class="text-xs text-slate-500">Solo lectura</span>
                        </template>

                        <!-- Superadmin: editar / eliminar con iconos -->
                        <template v-else-if="isSuperadmin">
                          <button class="btn-ghost p-1" title="Editar" @click="openEdit(g)">
                            <!-- icon pencil -->
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M18 2a2.828 2.828 0 0 1 4 4L7 21l-4 1 1-4Z"></path><path d="m16 5 3 3"></path>
                            </svg>
                          </button>
                          <button class="btn-ghost p-1" title="Eliminar" @click="removeGroup(g)">
                            <!-- icon trash -->
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/>
                              <path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/>
                              <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                            </svg>
                          </button>
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

    <!-- Modal Edición -->
    <div v-if="editing" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" @click.self="closeEdit">
      <div class="bg-white rounded-xl shadow max-w-lg w-full">
        <div class="p-4 border-b flex items-center justify-between">
          <div class="font-semibold text-slate-800">
            Editar grupo — {{ editing.code }}
          </div>
          <button class="btn-ghost" @click="closeEdit">Cerrar</button>
        </div>

        <div class="p-4 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label">Código</label>
              <input class="input" v-model.trim="form.code" />
            </div>
            <div>
              <label class="label">Nombre</label>
              <input class="input" v-model.trim="form.name" />
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
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

/* ===== Auth / Rol ===== */
const me = ref(null)
async function loadMe () {
  try {
    me.value = await axios.get('/me', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    }).then(r => r.data)
  } catch {
    me.value = null
  }
}
const isSuperadmin = computed(() => (me.value?.role || '').toLowerCase() === 'superadmin')
const isSupervisor = computed(() => (me.value?.role || '').toLowerCase() === 'supervision')
const isAllowed = computed(() => isSuperadmin.value || isSupervisor.value)
const canSeeUnits = computed(() => isAllowed.value)

/* ===== UI Msg/Loading ===== */
const loading = ref(false)
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

/* ===== Data ===== */
const groups = ref([]) // {id, code, name}
const units  = ref([]) // {id, name, groupId, groupCode, ...}
const q = ref('')

/* ===== Crear ===== */
const newGroup = ref({ code: '', name: '' })
function resetNew () { newGroup.value = { code: '', name: '' } }

/* ===== Filtros/Ayudas ===== */
const unitsCountByGroup = computed(() => {
  const m = {}
  for (const u of units.value) m[u.groupId] = (m[u.groupId] || 0) + 1
  return m
})

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  const rows = groups.value.map(g => ({ ...g, unitsCount: unitsCountByGroup.value[g.id] || 0 }))
  if (!term) return rows
  return rows.filter(r =>
    String(r.code).toLowerCase().includes(term) ||
    String(r.name).toLowerCase().includes(term)
  )
})

/* ===== Modal edición ===== */
const editing = ref(null) // row original
const form = ref({ id: null, code: '', name: '' })

function openEdit (g) {
  if (!isSuperadmin.value) return
  editing.value = g
  form.value = { id: g.id, code: g.code, name: g.name }
}
function closeEdit () { editing.value = null }

/* ===== Cargas ===== */
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
    units.value  = un.data  || []
  } catch (e) {
    msg.value = e.response?.data?.error || 'Error al cargar datos'
  } finally {
    loading.value = false
  }
}

/* ===== Actions ===== */
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
  if (!form.value.id) return
  try {
    await axios.put(`/admin/groups/${form.value.id}`, {
      code: (form.value.code || '').trim().toUpperCase(),
      name: (form.value.name || '').trim()
    }, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') } })
    msg.value = 'Grupo actualizado ✅'
    closeEdit()
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

function reload () { loadData() }

/* ===== Init ===== */
onMounted(async () => {
  await loadMe()
  if (isAllowed.value) await loadData()
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
