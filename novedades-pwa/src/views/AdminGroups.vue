<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <!-- Bloqueo para roles no permitidos -->
    <div v-if="isLeaderGroup" class="card">
      <div class="card-body">
        <h2 class="font-semibold text-slate-800">Listado de grupos</h2>
        <p class="text-slate-600 mt-2">No autorizado.</p>
      </div>
    </div>

    <template v-else>
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold text-slate-800">
              Listado de grupos
              <span v-if="isSupervisor" class="text-xs font-normal text-slate-500">(solo lectura)</span>
            </h2>
            <span v-if="msg" :class="msgClass" class="text-sm">{{ msg }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <!-- Formulario: SOLO superadmin -->
          <form v-if="isSuperadmin" class="mb-6 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end" @submit.prevent="onSubmit">
            <input class="input sm:col-span-1" v-model="form.code" placeholder="Código" maxlength="20" required />
            <input class="input sm:col-span-3" v-model="form.name" placeholder="Nombre" maxlength="80" required />
            <div class="flex gap-2 sm:col-span-1">
              <button class="btn-primary flex-1" type="submit">
                {{ form.id ? 'Actualizar' : 'Crear grupo' }}
              </button>
              <button v-if="form.id" class="btn-ghost" @click.prevent="resetForm">Cancelar</button>
            </div>
          </form>

          <table class="table w-full">
            <thead>
              <tr>
                <th class="w-[90px]">ID</th>
                <th class="w-[180px]">Código</th>
                <th>Nombre</th>
                <th v-if="isSuperadmin" class="w-[120px] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in groups" :key="g.id">
                <td>{{ g.id }}</td>
                <td>
                  <template v-if="isSuperadmin && g._editing">
                    <input class="input" v-model="g.editCode" />
                  </template>
                  <template v-else>{{ g.code }}</template>
                </td>
                <td>
                  <template v-if="isSuperadmin && g._editing">
                    <input class="input" v-model="g.editName" />
                  </template>
                  <template v-else>{{ g.name || '—' }}</template>
                </td>

                <!-- Acciones SOLO superadmin -->
                <td v-if="isSuperadmin" class="text-right">
                  <div class="flex justify-end gap-2">
                    <template v-if="!g._editing">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        title="Editar" @click="editGroup(g)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <path d="M4 21h4l11-11a2.828 2.828 0 10-4-4L4 17v4z"
                                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-lg border border-red-600 bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                        title="Eliminar" @click="deleteGroup(g)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <path d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 01-2 2H9a2 2 0 01-2-2V6h10z"
                                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>Eliminar</span>
                      </button>
                    </template>

                    <template v-else>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-lg border border-blue-600 bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        title="Guardar" @click="saveGroup(g)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>Guardar</span>
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        title="Cancelar" @click="cancelEdit(g)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>Cancelar</span>
                      </button>
                    </template>
                  </div>
                </td>
              </tr>

              <tr v-if="groups.length === 0">
                <td :colspan="isSuperadmin ? 4 : 3" class="text-center text-slate-500 py-6">Sin grupos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const groups = ref([])
const msg = ref('')
const me = ref(JSON.parse(localStorage.getItem('me') || '{}'))

const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')
const isSuperadmin = computed(() => (me.value.role || '').toLowerCase() === 'superadmin')
const isSupervisor  = computed(() => (me.value.role || '').toLowerCase() === 'supervision' || (me.value.role || '').toLowerCase() === 'supervisor')
const isLeaderGroup = computed(() => (me.value.role || '').toLowerCase() === 'leader_group')

// Formulario reactivo
const form = ref({ id: null, code: '', name: '' })

function authHeader() {
  return { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
}

async function ensureMe() {
  try {
    const { data } = await axios.get('/me', { headers: authHeader() })
    me.value = data
    localStorage.setItem('me', JSON.stringify(data))
  } catch (e) {
    // si falla, igual intentamos pintar mensaje
  }
}

async function load() {
  msg.value = ''
  try {
    const { data } = await axios.get('/admin/groups', { headers: authHeader() })
    groups.value = (Array.isArray(data) ? data : []).map(g => ({
      ...g,
      editCode: g.code,
      editName: g.name,
      _editing: false,
      _original: null
    }))
    if (!groups.value.length) msg.value = 'No hay grupos para mostrar'
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al cargar grupos'
  }
}

function resetForm() {
  form.value = { id: null, code: '', name: '' }
  msg.value = ''
}

function editGroup(g) {
  if (!isSuperadmin.value) return
  g._original = { code: g.editCode, name: g.editName }
  g._editing = true
}

function cancelEdit(g) {
  if (!g._original) { g._editing = false; return }
  g.editCode = g._original.code
  g.editName = g._original.name
  g._editing = false
  g._original = null
}

// Crear o actualizar (SOLO superadmin)
async function onSubmit() {
  if (!isSuperadmin.value) return
  if (!form.value.code.trim()) { msg.value = 'El código es requerido'; return }
  if (!form.value.name.trim()) { msg.value = 'El nombre es requerido'; return }
  try {
    if (!form.value.id) {
      await axios.post('/admin/groups',
        { code: form.value.code.trim(), name: form.value.name.trim() },
        { headers: authHeader() }
      )
      msg.value = 'Grupo creado ✅'
    } else {
      await axios.put(`/admin/groups/${form.value.id}`,
        { code: form.value.code.trim(), name: form.value.name.trim() },
        { headers: authHeader() }
      )
      msg.value = 'Grupo actualizado ✅'
    }
    await load()
    resetForm()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al guardar'
  }
}

// Guardar fila (SOLO superadmin)
async function saveGroup(g) {
  if (!isSuperadmin.value) return
  if (!g.editCode?.trim() || !g.editName?.trim()) { msg.value = 'Código y nombre requeridos'; return }
  try {
    await axios.put(`/admin/groups/${g.id}`,
      { code: g.editCode.trim(), name: g.editName.trim() },
      { headers: authHeader() }
    )
    g.code = g.editCode
    g.name = g.editName
    g._editing = false
    g._original = null
    msg.value = 'Grupo actualizado ✅'
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo actualizar'
  }
}

// Eliminar (SOLO superadmin)
async function deleteGroup(g) {
  if (!isSuperadmin.value) return
  if (!confirm(`¿Eliminar grupo ${g.code}?`)) return
  try {
    await axios.delete(`/admin/groups/${g.id}`, { headers: authHeader() })
    groups.value = groups.value.filter(x => x.id !== g.id)
    msg.value = 'Grupo eliminado ✅'
    // si estabas editando el mismo, limpia form
    if (form.value.id === g.id) resetForm()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo eliminar'
  }
}

onMounted(async () => {
  await ensureMe()
  // si es líder de grupo, no cargamos nada (no autorizado)
  if (!isLeaderGroup.value) await load()
})
</script>

<style scoped>
.input { @apply w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500; }
.btn-primary { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700; }
.btn-ghost { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100; }
.table thead th { @apply text-left text-slate-600 font-semibold; }
.table tbody td { @apply align-middle; }
.card { @apply bg-white rounded-xl shadow; }
.card-body { @apply p-4; }
</style>
