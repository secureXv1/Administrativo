<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
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
              <ul class="list-disc list-inside text-sm text-slate-700 max-h-40 overflow-auto"
                  v-if="groupsMissingLeader.length">
                <li v-for="g in groupsMissingLeader" :key="g.id">
                  {{ g.code }} — {{ g.name }}
                </li>
              </ul>
              <div v-else class="text-green-700 text-sm">Todos los grupos tienen líder asignado ✅</div>
            </div>

            <div class="p-3 rounded-lg border">
              <div class="font-semibold mb-2">Unidades sin <span class="uppercase">líder de unidad</span></div>
              <ul class="list-disc list-inside text-sm text-slate-700 max-h-40 overflow-auto"
                  v-if="unitsMissingLeader.length">
                <li v-for="u in unitsMissingLeader" :key="u.id">
                  {{ u.name }} <span class="text-slate-500">({{ groupCode(u.groupId) }})</span>
                </li>
              </ul>
              <div v-else class="text-green-700 text-sm">Todas las unidades tienen líder asignado ✅</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Listado + formulario -->
      <div class="card">
        <div class="card-body">
          <!-- Mensajes -->
          <div v-if="msg" :class="[msgClass, 'mb-4', 'text-base', 'font-semibold']">
            {{ msg }}
          </div>

          <!-- Formulario crear/editar -->
          <form class="mb-6 flex flex-wrap gap-3 items-end" @submit.prevent="onSubmit">
            <div>
              <label class="label">Username</label>
              <input class="input" v-model.trim="form.username" type="text" placeholder="username" required style="width:200px" />
            </div>

            <div>
              <label class="label">Rol</label>
              <select class="input" v-model="form.role" required style="width:190px">
                <option value="" disabled>Selecciona rol</option>
                <option value="superadmin">superadmin</option>
                <option value="supervision">supervision</option>
                <option value="leader_group">leader_group</option>
                <option value="leader_unit">leader_unit</option>
              </select>
            </div>

            <!-- Grupo (obligatorio para leader_group y leader_unit) -->
            <div v-if="showGroupSelect">
              <label class="label">Grupo</label>
              <select class="input" v-model="form.groupId" :required="groupRequired" style="width:220px" @change="onChangeGroup">
                <option value="">— Selecciona —</option>
                <option v-for="g in groups" :key="g.id" :value="String(g.id)">
                  {{ g.code }} ({{ g.name }})
                </option>
              </select>
            </div>

            <!-- Unidad (obligatorio para leader_unit) -->
            <div v-if="showUnitSelect">
              <label class="label">Unidad</label>
              <select class="input" v-model="form.unitId" :required="unitRequired" style="width:240px">
                <option value="">— Selecciona —</option>
                <option v-for="u in unitsOfSelectedGroup" :key="u.id" :value="String(u.id)">
                  {{ u.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="label">{{ form.id ? 'Nueva contraseña (opcional)' : 'Contraseña' }}</label>
              <input class="input" type="password" v-model="form.password" :required="!form.id" style="width:230px" />
            </div>

            <div class="flex gap-2">
              <button class="btn-primary" type="submit">
                {{ form.id ? 'Actualizar' : 'Crear usuario' }}
              </button>
              <button v-if="form.id" class="btn-ghost" @click.prevent="resetForm">Cancelar</button>
            </div>
          </form>

          <!-- Tabla -->
          <table class="table">
            <thead>
              <tr>
                <th style="width:70px">ID</th>
                <th>Username</th>
                <th style="width:160px">Rol</th>
                <th style="width:140px">Grupo</th>
                <th style="width:180px">Unidad</th>
                <th style="width:160px">Creado</th>
                <th style="width:140px"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>{{ u.id }}</td>
                <td class="font-mono">{{ u.username }}</td>
                <td class="uppercase">{{ u.role }}</td>
                <td>{{ groupCode(u.groupId) || '—' }}</td>
                <td>{{ unitName(u.unitId) || '—' }}</td>
                <td>{{ formatDate(u.createdAt) }}</td>
                <td>
                  <div class="flex gap-1 items-center justify-center">
                    <!-- Editar -->
                    <button class="btn-ghost p-1" title="Editar" @click="editUser(u)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L8.5 18.1a2 2 0 0 1-.9.5l-4 1a1 1 0 0 1-1.2-1.2l1-4a2 2 0 0 1 .5-.9Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <!-- Reset password -->
                    <button class="btn-ghost p-1" title="Restablecer contraseña" @click="resetPassword(u)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v4"/><path d="M12 12v8"/><path d="M8 8h8"/><path d="M8 16h8"/></svg>
                    </button>
                    <!-- Eliminar -->
                    <button class="btn-ghost p-1" title="Eliminar" @click="deleteUser(u)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/><path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
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
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

/* ===== state ===== */
const me = ref(JSON.parse(localStorage.getItem('me') || '{}'))
const isSuperadmin = computed(() => String(me.value?.role).toLowerCase() === 'superadmin')

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
  // Si cambia de grupo, limpiar unidad si ya no pertenece
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
  // Validaciones
  if (!form.value.username.trim()) { msg.value = 'El username es requerido'; return clearMsgAfterDelay() }
  if (!form.value.role) { msg.value = 'Selecciona el rol'; return clearMsgAfterDelay() }
  if (groupRequired.value && !form.value.groupId) { msg.value = 'Selecciona un grupo'; return clearMsgAfterDelay() }
  if (unitRequired.value && !form.value.unitId) { msg.value = 'Selecciona una unidad'; return clearMsgAfterDelay() }
  if (!form.value.id && !form.value.password) { msg.value = 'Contraseña requerida'; return clearMsgAfterDelay() }

  try {
    const headers = { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }

    if (!form.value.id) {
      // Crear
      await axios.post('/admin/users', {
        username: form.value.username.trim(),
        role: form.value.role,
        groupId: form.value.groupId ? Number(form.value.groupId) : null,
        unitId: form.value.unitId ? Number(form.value.unitId) : null,
        password: form.value.password
      }, { headers })
      msg.value = 'Usuario creado ✅'
    } else {
      // Actualizar
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
    clearMsgAfterDelay()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al guardar'
    clearMsgAfterDelay()
  }
}

function editUser(u) {
  form.value = {
    id: u.id,
    username: u.username || '',
    role: u.role || '',
    groupId: u.groupId ? String(u.groupId) : '',
    unitId: u.unitId ? String(u.unitId) : '',
    password: ''
  }
}

/* ===== actions per-row ===== */
async function resetPassword(u) {
  const pwd = prompt(`Nueva contraseña para ${u.username}:\n(Se guardará inmediatamente)`)
  if (!pwd) return
  try {
    const headers = { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    // Preferir endpoint dedicado si existe
    try {
      await axios.post(`/admin/users/${u.id}/reset-password`, { password: pwd }, { headers })
    } catch {
      // Fallback: usar PUT con password
      await axios.put(`/admin/users/${u.id}`, { password: pwd }, { headers })
    }
    msg.value = 'Contraseña restablecida ✅'
    clearMsgAfterDelay()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo restablecer'
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
onMounted(loadAll)
</script>
