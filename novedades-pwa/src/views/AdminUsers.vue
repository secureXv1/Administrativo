<template>
  <div class="max-w-6xl mx-auto px-2 sm:px-4 py-6 space-y-6">
    <!-- Guard de rol -->
    <div v-if="!isSuperadmin" class="card">
      <div class="card-body text-red-600 font-semibold">
        No autorizado: esta ventana es solo para SUPERADMIN.
      </div>
    </div>

    <template v-else>
      <!-- Resumen de cobertura de roles -->
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold text-slate-800">Cobertura de líderes</h2>
            <button class="btn-ghost" @click="loadAll">Actualizar</button>
          </div>

          <div class="grid md:grid-cols-2 gap-4">
            <div class="p-3 rounded-lg border">
              <div class="font-semibold mb-2">Grupos sin <span class="uppercase">líder de grupo</span></div>
              <ul
                class="list-disc list-inside text-sm text-slate-700 max-h-40 overflow-auto"
                v-if="groupsMissingLeader.length"
              >
                <li v-for="g in groupsMissingLeader" :key="g.id">
                  {{ g.code }} — {{ g.name }}
                </li>
              </ul>
              <div v-else class="text-green-700 text-sm">Todos los grupos tienen líder asignado ✅</div>
            </div>

            <div class="p-3 rounded-lg border">
              <div class="font-semibold mb-2">Unidades sin <span class="uppercase">líder de unidad</span></div>
              <ul
                class="list-disc list-inside text-sm text-slate-700 max-h-40 overflow-auto"
                v-if="unitsMissingLeader.length"
              >
                <li v-for="u in unitsMissingLeader" :key="u.id">
                  {{ u.name }} <span class="text-slate-500">({{ groupCode(u.groupId) }})</span>
                </li>
              </ul>
              <div v-else class="text-green-700 text-sm">Todas las unidades tienen líder asignado ✅</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Formulario crear/editar -->
      <div class="card">
        <div class="card-body">
          <div v-if="msg" :class="[msgClass, 'mb-4', 'text-base', 'font-semibold']">
            {{ msg }}
          </div>

          <form class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end mb-6" @submit.prevent="onSubmit">
            <div>
              <label class="label">Username</label>
              <input class="input w-full" v-model.trim="form.username" type="text" placeholder="username" required />
            </div>

            <div>
              <label class="label">Rol</label>
              <select class="input w-full" v-model="form.role" required>
                <option value="" disabled>Selecciona rol</option>
                <option value="superadmin">superadmin</option>
                <option value="supervision">supervision</option>
                <option value="leader_group">leader_group</option>
                <option value="leader_unit">leader_unit</option>
              </select>
            </div>

            <div v-if="showGroupSelect">
              <label class="label">Grupo</label>
              <select class="input w-full" v-model="form.groupId" :required="groupRequired" @change="onChangeGroup">
                <option value="">— Selecciona —</option>
                <option v-for="g in groups" :key="g.id" :value="String(g.id)">
                  {{ g.code }} ({{ g.name }})
                </option>
              </select>
            </div>

            <div v-if="showUnitSelect">
              <label class="label">Unidad</label>
              <select class="input w-full" v-model="form.unitId" :required="unitRequired">
                <option value="">— Selecciona —</option>
                <option v-for="u in unitsOfSelectedGroup" :key="u.id" :value="String(u.id)">
                  {{ u.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="label">{{ form.id ? 'Nueva contraseña (opcional)' : 'Contraseña' }}</label>
              <input class="input w-full" type="password" v-model="form.password" :required="!form.id" />
            </div>

            <div class="flex gap-2 sm:col-span-2 lg:col-span-1">
              <button class="btn-primary w-full sm:w-auto" type="submit">
                {{ form.id ? 'Actualizar' : 'Crear usuario' }}
              </button>
              <button v-if="form.id" class="btn-ghost w-full sm:w-auto" @click.prevent="resetForm">Cancelar</button>
            </div>
          </form>

          <!-- Tabla (desktop) -->
          <div class="overflow-x-auto hidden md:block">
            <table class="table min-w-[800px]">
              <thead>
                <tr>
                  <th class="w-[70px]">ID</th>
                  <th>Username</th>
                  <th class="w-[160px]">Rol</th>
                  <th class="w-[140px]">Grupo</th>
                  <th class="w-[180px]">Unidad</th>
                  <th class="w-[160px]">Creado</th>
                  <th class="w-[140px] text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in users" :key="u.id">
                  <td>{{ u.id }}</td>
                  <td class="font-mono break-all">{{ u.username }}</td>
                  <td class="uppercase">{{ u.role }}</td>
                  <td>{{ groupCode(u.groupId) || '—' }}</td>
                  <td>{{ unitName(u.unitId) || '—' }}</td>
                  <td>{{ formatDate(u.createdAt) }}</td>
                  <td class="text-center">
                    <div class="inline-flex gap-2 items-center justify-center">
                      <!-- Indicador de bloqueo -->
                      <span v-if="isHardLocked(u) || isTempLocked(u)"
                            class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"
                            :title="u.lock_until ? ('Hasta: ' + formatDate(u.lock_until)) : ''">
                        {{ lockedLabel(u) }}
                      </span>

                      <!-- Editar -->
                      <button class="btn-ghost p-1" title="Editar" @click="openEdit(u)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M18 2a2.828 2.828 0 0 1 4 4L7 21l-4 1 1-4Z"></path><path d="m16 5 3 3"></path>
                        </svg>
                      </button>

                      <!-- Reset pass -->
                      <button class="btn-ghost p-1" title="Restablecer contraseña" @click="resetPassword(u)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M12 4v4"/><path d="M12 12v8"/><path d="M8 8h8"/><path d="M8 16h8"/>
                        </svg>
                      </button>

                      <!-- Desbloquear (solo si está bloqueado) -->
                      <button v-if="isHardLocked(u) || isTempLocked(u)" class="btn-ghost p-1" title="Desbloquear" @click="unlockUser(u)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 11V7a5 5 0 0 1 10 0"/><rect x="3" y="11" width="18" height="10" rx="2"/>
                          <path d="M7 15h.01M11 15h6"/>
                        </svg>
                      </button>

                      <!-- Eliminar -->
                      <button class="btn-ghost p-1" title="Eliminar" @click="deleteUser(u)">
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
                <tr v-if="users.length===0">
                  <td colspan="7" class="text-center text-slate-500 py-6">Sin usuarios</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Lista móvil (cards) -->
          <div class="grid gap-3 md:hidden">
            <div v-for="u in users" :key="u.id" class="rounded-lg border p-3 bg-white">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-xs text-slate-500">ID {{ u.id }}</div>
                  <div class="font-mono break-all text-sm">{{ u.username }}</div>
                  <div class="text-xs uppercase mt-1">Rol: <span class="font-semibold">{{ u.role }}</span></div>
                  <div class="mt-2 text-xs text-slate-600">
                    <div>Grupo: <span class="font-medium">{{ groupCode(u.groupId) || '—' }}</span></div>
                    <div>Unidad: <span class="font-medium">{{ unitName(u.unitId) || '—' }}</span></div>
                    <div>Creado: <span class="font-medium">{{ formatDate(u.createdAt) }}</span></div>
                  </div>
                </div>
                <div class="flex gap-1">
                  <button class="btn-ghost p-1" title="Editar" @click="openEdit(u)">
                    <!-- pencil -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 2a2.828 2.828 0 0 1 4 4L7 21l-4 1 1-4Z"></path><path d="m16 5 3 3"></path>
                    </svg>
                  </button>
                  <button class="btn-ghost p-1" title="Reset pass" @click="resetPassword(u)">
                    <!-- plus/rows -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 4v4"/><path d="M12 12v8"/><path d="M8 8h8"/><path d="M8 16h8"/>
                    </svg>
                  </button>

                  <button v-if="isHardLocked(u) || isTempLocked(u)" class="btn-ghost p-1" title="Desbloquear" @click="unlockUser(u)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 11V7a5 5 0 0 1 10 0"/><rect x="3" y="11" width="18" height="10" rx="2"/>
                      <path d="M7 15h.01M11 15h6"/>
                    </svg>
                  </button>

                  <button class="btn-ghost p-1" title="Eliminar" @click="deleteUser(u)">
                    <!-- trash (unificado) -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/>
                      <path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/>
                      <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div v-if="users.length===0" class="text-center text-slate-500 py-6">Sin usuarios</div>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal Edición -->
    <div v-if="editing" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" @click.self="closeEdit">
      <div class="bg-white rounded-xl shadow max-w-2xl w-full">
        <div class="p-4 border-b flex items-center justify-between">
          <div class="font-semibold text-slate-800">Editar usuario — {{ editing.username }}</div>
          <button class="btn-ghost" @click="closeEdit">Cerrar</button>
        </div>

        <div class="p-4 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label">Username</label>
              <input class="input" v-model="form.username" />
            </div>
            <div>
              <label class="label">Rol</label>
              <select class="input" v-model="form.role">
                <option value="superadmin">superadmin</option>
                <option value="supervision">supervision</option>
                <option value="leader_group">leader_group</option>
                <option value="leader_unit">leader_unit</option>
              </select>
            </div>
            <div v-if="showGroupSelect">
              <label class="label">Grupo</label>
              <select class="input" v-model="form.groupId" @change="onChangeGroup">
                <option value="">— Selecciona —</option>
                <option v-for="g in groups" :key="g.id" :value="String(g.id)">{{ g.code }} ({{ g.name }})</option>
              </select>
            </div>
            <div v-if="showUnitSelect">
              <label class="label">Unidad</label>
              <select class="input" v-model="form.unitId">
                <option value="">— Selecciona —</option>
                <option v-for="u in unitsOfSelectedGroup" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
              </select>
            </div>
            <div>
              <label class="label">Contraseña</label>
              <input class="input" type="password" v-model="form.password" />
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button class="btn-ghost" @click="closeEdit">Cancelar</button>
            <button class="btn-primary" @click="onSubmit">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

/* ===== state ===== */
const me = ref(null)
const isSuperadmin = computed(() => String(me.value?.role || '').toLowerCase() === 'superadmin')

const users = ref([])
const groups = ref([])
const units = ref([])

const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

const form = ref({
  id: null,
  username: '',
  role: '',
  groupId: '',
  unitId: '',
  password: ''
})

const editing = ref(null)

/* ===== derived ===== */
const showGroupSelect = computed(() => ['leader_group','leader_unit'].includes(form.value.role))
const groupRequired  = computed(() => ['leader_group','leader_unit'].includes(form.value.role))
const showUnitSelect = computed(() => form.value.role === 'leader_unit')
const unitRequired   = computed(() => form.value.role === 'leader_unit')

const unitsOfSelectedGroup = computed(() => {
  if (!form.value.groupId) return []
  const gid = Number(form.value.groupId)
  return units.value.filter(u => Number(u.groupId) === gid)
})

/* ===== helpers ===== */
function clearMsgAfterDelay() { setTimeout(() => { msg.value = '' }, 2500) }

function groupCode(gid) {
  const g = groups.value.find(x => Number(x.id) === Number(gid))
  return g ? g.code : ''
}
function unitName(uid) {
  const u = units.value.find(x => Number(x.id) === Number(uid))
  return u ? u.name : ''
}
function formatDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString() } catch { return String(d) }
}

function isHardLocked(u) { return Number(u?.hard_locked || 0) === 1 }
function isTempLocked(u) { 
  if (!u?.lock_until) return false
  try { return new Date(u.lock_until) > new Date() } catch { return false }
}
function lockedLabel(u) {
  if (isHardLocked(u)) return 'Bloqueado'
  if (isTempLocked(u)) {
    const secs = Math.max(1, Math.ceil((new Date(u.lock_until) - new Date())/1000))
    return `Bloqueada (${secs}s)`
  }
  return ''
}


/* ===== cobertura de roles ===== */
const groupsMissingLeader = computed(() => {
  return groups.value.filter(g => {
    const hasLeader = users.value.some(u => u.role === 'leader_group' && Number(u.groupId) === Number(g.id))
    return !hasLeader
  })
})
const unitsMissingLeader = computed(() => {
  return units.value.filter(u => {
    const hasLeader = users.value.some(x => x.role === 'leader_unit' && Number(x.unitId) === Number(u.id))
    return !hasLeader
  })
})

/* ===== load ===== */
async function loadMe() {
  try {
    const { data } = await axios.get('/me', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    me.value = data
  } catch {
    me.value = null
  }
}

async function loadAll() {
  if (!isSuperadmin.value) return
  msg.value = ''
  try {
    const headers = { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }

    const [{ data: usersData }, { data: groupsData }, { data: unitsData }] = await Promise.all([
      axios.get('/admin/users',  { headers }),
      axios.get('/admin/groups', { headers }),
      axios.get('/admin/units',  { headers })
    ])

    users.value  = Array.isArray(usersData)  ? usersData  : []
    groups.value = Array.isArray(groupsData) ? groupsData : []
    units.value  = Array.isArray(unitsData)  ? unitsData  : []

    if (!users.value.length) msg.value = 'No hay usuarios para mostrar'
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al cargar datos'
    clearMsgAfterDelay()
  }
}

/* ===== form ===== */
function resetForm() {
  form.value = { id: null, username: '', role: '', groupId: '', unitId: '', password: '' }
  msg.value = ''
}
function onChangeGroup() {
  if (form.value.unitId) {
    const found = unitsOfSelectedGroup.value.find(u => String(u.id) === String(form.value.unitId))
    if (!found) form.value.unitId = ''
  }
}
watch(() => form.value.role, (r) => {
  if (r === 'supervision') { form.value.groupId = ''; form.value.unitId = '' }
  if (r === 'leader_group') { form.value.unitId = '' }
})

async function onSubmit() {
  if (!form.value.username.trim()) { msg.value = 'El username es requerido'; return clearMsgAfterDelay() }
  if (!form.value.role) { msg.value = 'Selecciona el rol'; return clearMsgAfterDelay() }
  if (groupRequired.value && !form.value.groupId) { msg.value = 'Selecciona un grupo'; return clearMsgAfterDelay() }
  if (unitRequired.value && !form.value.unitId) { msg.value = 'Selecciona una unidad'; return clearMsgAfterDelay() }
  if (!form.value.id && !form.value.password) { msg.value = 'Contraseña requerida'; return clearMsgAfterDelay() }

  try {
    const headers = { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }

    if (!form.value.id) {
      await axios.post('/admin/users', {
        username: form.value.username.trim(),
        role: form.value.role,
        groupId: form.value.groupId ? Number(form.value.groupId) : null,
        unitId: form.value.unitId ? Number(form.value.unitId) : null,
        password: form.value.password
      }, { headers })
      msg.value = 'Usuario creado ✅'
    } else {
      const payload = {
        username: form.value.username.trim(),
        role: form.value.role,
        groupId: form.value.groupId ? Number(form.value.groupId) : null,
        unitId: form.value.unitId ? Number(form.value.unitId) : null
      }
      if (form.value.password) payload.password = form.value.password
      await axios.put(`/admin/users/${form.value.id}`, payload, { headers })
      msg.value = 'Usuario actualizado ✅'
    }

    await loadAll()
    resetForm()
    closeEdit()
    clearMsgAfterDelay()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al guardar'
    clearMsgAfterDelay()
  }
}

function openEdit(u) {
  editing.value = u
  form.value = {
    id: u.id,
    username: u.username || '',
    role: u.role || '',
    groupId: u.groupId ? String(u.groupId) : '',
    unitId: u.unitId ? String(u.unitId) : '',
    password: ''
  }
}
function closeEdit() { editing.value = null }

/* ===== actions per-row ===== */
async function resetPassword(u) {
  const pwd = prompt(`Nueva contraseña para ${u.username}:\n(Se guardará inmediatamente)`)
  if (!pwd) return
  try {
    const headers = { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    try {
      await axios.post(`/admin/users/${u.id}/reset-password`, { password: pwd }, { headers })
    } catch {
      await axios.put(`/admin/users/${u.id}`, { password: pwd }, { headers })
    }
    msg.value = 'Contraseña restablecida ✅'
    clearMsgAfterDelay()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo restablecer'
    clearMsgAfterDelay()
  }
}

async function unlockUser(u) {
  if (!confirm(`¿Desbloquear la cuenta de ${u.username}?`)) return
  try {
    const headers = { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    await axios.post(`/admin/users/${u.id}/unlock`, {}, { headers })
    msg.value = 'Cuenta desbloqueada ✅'
    await loadAll()
    clearMsgAfterDelay()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo desbloquear'
    clearMsgAfterDelay()
  }
}


async function deleteUser(u) {
  if (!confirm(`¿Eliminar usuario ${u.username}?`)) return
  try {
    const headers = { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    await axios.delete(`/admin/users/${u.id}`, { headers })
    msg.value = 'Usuario eliminado ✅'
    await loadAll()
    resetForm()
    clearMsgAfterDelay()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo eliminar'
    clearMsgAfterDelay()
  }
}

/* ===== init ===== */
onMounted(async () => {
  await loadMe()
  if (isSuperadmin.value) {
    await loadAll()
  }
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
