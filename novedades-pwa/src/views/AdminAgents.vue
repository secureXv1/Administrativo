<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <!-- Encabezado -->
    <div class="card">
      <div class="card-body flex items-center justify-between">
        <h2 class="font-semibold text-slate-800">Listado de agentes</h2>
        <span v-if="msg" :class="msgClass" class="text-sm">{{ msg }}</span>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card">
      <div class="card-body">
        <div class="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:items-end">
          <div class="sm:col-span-2">
            <label class="label">Buscar</label>
            <input class="input" v-model="filters.q"
                   placeholder="Código, categoría (OF/ME/PT), grupo, unidad..." />
          </div>

          <div>
            <label class="label">Categoría</label>
            <select class="input" v-model="filters.cat">
              <option value="ALL">Todas</option>
              <option value="OF">OF</option>
              <option value="ME">ME</option>
              <option value="PT">PT</option>
            </select>
          </div>

          <div v-if="isAdminLike">
            <label class="label">Grupo</label>
            <select class="input" v-model="filters.groupId">
              <option value="ALL">Todos</option>
              <option v-for="g in groups" :key="g.id" :value="String(g.id)">
                {{ g.code }}
              </option>
            </select>
          </div>

          <div>
            <label class="label">Fecha (para novedad)</label>
            <input type="date" class="input" v-model="today" />
          </div>
        </div>

        <!-- Tabla -->
        <div class="mt-4 overflow-x-auto">
          <table class="table min-w-[860px]">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Cat.</th>
                <th>Grupo</th>
                <th>Unidad</th>
                <th>Estado</th>
                <th>Municipio</th>
                <th class="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in itemsFiltradosOrdenados" :key="a.id">
                <td>{{ a.id }}</td>
                <td>{{ a.code }}</td>
                <td>{{ catLabel(a.category) }}</td>
                <td>{{ a.groupCode || groupCode(a.groupId) || '—' }}</td>
                <td>{{ a.unitName || unitName(a.unitId) || '—' }}</td>
                <td>
                  <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border"
                        :class="badgeClass(a.status)">
                    {{ a.status }}
                  </span>
                </td>
                <td>
                  <span v-if="a.municipalityName">{{ a.municipalityName }}</span>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td class="text-center">
                  <button class="btn-ghost p-1" title="Editar" @click="openEdit(a)">
                    <!-- icon pencil -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 2a2.828 2.828 0 0 1 4 4L7 21l-4 1 1-4Z"></path><path d="m16 5 3 3"></path>
                    </svg>
                  </button>
                  <button v-if="isSuperadmin" class="btn-ghost p-1" title="Eliminar" @click="deleteAgent(a)">
                    <!-- icon trash -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/>
                      <path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/>
                      <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                    </svg>
                  </button>
                </td>
              </tr>
              <tr v-if="itemsFiltradosOrdenados.length === 0">
                <td colspan="8" class="text-center text-slate-500 py-6">Sin agentes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Edición -->
    <div v-if="editing" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
         @click.self="closeEdit">
      <div class="bg-white rounded-xl shadow max-w-2xl w-full">
        <div class="p-4 border-b flex items-center justify-between">
          <div class="font-semibold text-slate-800">
            Editar agente — {{ editing.code }} ({{ catLabel(editing.category) }})
          </div>
          <button class="btn-ghost" @click="closeEdit">Cerrar</button>
        </div>

        <div class="p-4 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div v-if="isSuperadmin">
              <label class="label">Código</label>
              <input class="input" v-model="form.code" />
            </div>
            <div v-if="isSuperadmin">
              <label class="label">Categoría</label>
              <select class="input" v-model="form.categoryUi">
                <option value="OF">OF</option>
                <option value="ME">ME</option>
                <option value="PT">PT</option>
              </select>
            </div>
            <div v-if="isAdminLike">
              <label class="label">Grupo</label>
              <select class="input" v-model="form.groupId">
                <option :value="null">Sin grupo</option>
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.code }}</option>
              </select>
            </div>
            <div v-if="isAdminLike || isLeaderGroup">
              <label class="label">Unidad</label>
              <select class="input" v-model="form.unitId">
                <option :value="null">Sin unidad</option>
                <option v-for="u in unitsForSelect" :key="u.id" :value="u.id">
                  {{ u.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="label">Estado / Novedad</label>
              <select class="input" v-model="form.state" @change="onStateChange()">
                <option v-for="s in estadosValidos" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <div v-if="form.state === 'SERVICIO' || otrosRequierenFechas.includes(form.state)">
              <label class="label">Fecha inicio</label>
              <input type="date" class="input" v-model="form.novelty_start" />
            </div>
            <div v-if="form.state === 'SERVICIO' || otrosRequierenFechas.includes(form.state)">
              <label class="label">Fecha fin</label>
              <input type="date" class="input" v-model="form.novelty_end" />
            </div>
          </div>

          <div v-if="form.state === 'COMISIÓN DEL SERVICIO'">
            <label class="label">Municipio</label>
            <input class="input"
                   v-model="form.municipalityName"
                   list="municipios-list"
                   @input="onMunicipalityInput"
                   placeholder="Depto - Municipio (escribe para buscar)"
                   autocomplete="off" />
            <datalist id="municipios-list">
              <option v-for="m in municipalities" :key="m.id" :value="m.dept + ' - ' + m.name" />
            </datalist>
            <p v-if="form.municipalityName && !form.municipalityId" class="text-xs text-red-600 mt-1">
              Selecciona un municipio válido de la lista.
            </p>
          </div>

          <div v-if="form.state === 'SERVICIO' || otrosRequierenFechas.includes(form.state)">
            <label class="label">Descripción</label>
            <textarea class="input" rows="2" v-model="form.novelty_description"
                      placeholder="Motivo / detalle..."></textarea>
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

/* ===== Helpers UI ===== */
const catLabel = (c) => (String(c).toUpperCase()==='SO' ? 'ME' : c)
const uiToApiCategory = (ui) => (ui==='ME' ? 'SO' : ui)

function badgeClass(state){
  const s = String(state || '').toUpperCase()
  if (s === 'SIN NOVEDAD') return 'bg-green-50 text-green-700 border-green-200'
  if (s === 'SERVICIO' || s === 'COMISIÓN DEL SERVICIO') return 'bg-sky-50 text-sky-700 border-sky-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

/* ===== Auth / Rol ===== */
const me = ref(null)
async function loadMe(){
  try{
    const { data } = await axios.get('/me', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    me.value = data
  } catch { me.value = null }
}
const role = computed(() => String(me.value?.role || '').toLowerCase())
const isLeaderGroup = computed(() => role.value === 'leader_group')
const isAdminLike   = computed(() => ['superadmin','supervision'].includes(role.value))
const isSuperadmin  = computed(() => role.value === 'superadmin')

/* ===== Data ===== */
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

const items = ref([])          // agentes
const groups = ref([])         // grupos (admin)
const units = ref([])          // todas las unidades (admin)
const myUnits = ref([])        // unidades de mi grupo (líder grupo)
const municipalities = ref([]) // catálogo
const today = ref(new Date().toISOString().slice(0,10))

/* ===== Filtros ===== */
const filters = ref({ q:'', cat:'ALL', groupId:'ALL' })

/* ===== Estados ===== */
const estadosValidos = [
  'SIN NOVEDAD',
  'SERVICIO',
  'COMISIÓN DEL SERVICIO',
  'FRANCO FRANCO',
  'VACACIONES',
  'LICENCIA DE MATERNIDAD',
  'LICENCIA DE LUTO',
  'LICENCIA REMUNERADA',
  'LICENCIA NO REMUNERADA',
  'EXCUSA DEL SERVICIO',
  'LICENCIA PATERNIDAD',
  // nuevos
  'PERMISO',
  'COMISIÓN EXTERIOR'
]
const otrosRequierenFechas = [
  'VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO',
  'LICENCIA REMUNERADA','LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO',
  'LICENCIA PATERNIDAD','PERMISO','COMISIÓN EXTERIOR'
]

/* ===== Cargas ===== */
async function loadGroups(){
  if (!isAdminLike.value) return
  const { data } = await axios.get('/admin/groups', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  groups.value = data || []
}
async function loadUnits(){
  if (isAdminLike.value) {
    const { data } = await axios.get('/admin/units', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    units.value = data || []
  } else if (isLeaderGroup.value) {
    const { data } = await axios.get('/my/units', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    myUnits.value = data || []
  }
}
async function loadMunicipalities(q=''){
  const params = q && q.length>=2 ? { q, limit: 50 } : { limit: 50 }
  const { data } = await axios.get('/catalogs/municipalities', {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  municipalities.value = data || []
}
async function loadAgents(){
  msg.value = ''
  try {
    if (isAdminLike.value) {
      const params = {}
      if (filters.value.groupId !== 'ALL') params.groupId = filters.value.groupId
      const { data } = await axios.get('/admin/agents', {
        params,
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      items.value = normalizeAgents(data || [])
    } else if (isLeaderGroup.value) {
      const { data } = await axios.get('/my/agents', {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      items.value = normalizeAgents(data || [])
    } else {
      items.value = []
      msg.value = 'No tiene permisos suficientes.'
    }
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al cargar'
  }
}
function normalizeAgents(list){
  return list.map(a => ({
    ...a,
    groupCode: a.groupCode || null,
    unitName: a.unitName || null,
    municipalityName: a.municipalityName || (a.municipalityId ? '' : '')
  }))
}

/* ===== Filtro + Orden ===== */
const itemsFiltradosOrdenados = computed(() => {
  let arr = items.value.slice()

  const q = filters.value.q.trim().toUpperCase()
  if (q) {
    arr = arr.filter(a =>
      String(a.code||'').toUpperCase().includes(q) ||
      catLabel(a.category).includes(q) ||
      String(a.groupCode||'').toUpperCase().includes(q) ||
      String(a.unitName||'').toUpperCase().includes(q)
    )
  }
  if (filters.value.cat !== 'ALL') {
    const target = filters.value.cat === 'ME' ? 'SO' : filters.value.cat
    arr = arr.filter(a => String(a.category).toUpperCase() === target)
  }
  if (isAdminLike.value && filters.value.groupId !== 'ALL') {
    arr = arr.filter(a => String(a.groupId) === String(filters.value.groupId))
  }

  const order = { 'OF':1, 'SO':2, 'PT':3 }
  arr.sort((a,b) => {
    const ca = order[String(a.category).toUpperCase()] || 9
    const cb = order[String(b.category).toUpperCase()] || 9
    if (ca !== cb) return ca - cb
    return String(a.code).localeCompare(String(b.code))
  })
  return arr
})

/* ===== Catálogos helpers ===== */
function groupCode(id){
  const g = groups.value.find(x => x.id == id)
  return g ? g.code : null
}
function unitName(id){
  if (isAdminLike.value){
    const u = units.value.find(x => x.id == id)
    return u ? u.name : null
  } else {
    const u = myUnits.value.find(x => x.id == id)
    return u ? u.name : null
  }
}
const unitsForSelect = computed(() => {
  if (isLeaderGroup.value) return myUnits.value
  if (isAdminLike.value && form.value.groupId){
    return units.value.filter(u => String(u.groupId) === String(form.value.groupId))
  }
  return isAdminLike.value ? units.value : []
})

/* ===== Modal edición ===== */
const editing = ref(null) // row original
const form = ref({
  id:null, code:'', categoryUi:'OF', groupId:null, unitId:null,
  state:'SIN NOVEDAD',
  municipalityId:null, municipalityName:'',
  novelty_start:'', novelty_end:'', novelty_description:''
})

function openEdit(a){
  editing.value = a
  form.value = {
    id: a.id,
    code: a.code,
    categoryUi: catLabel(a.category),
    groupId: a.groupId ?? null,
    unitId: a.unitId ?? null,
    state: a.status || 'SIN NOVEDAD',
    municipalityId: a.municipalityId || null,
    municipalityName: a.municipalityName || '',
    novelty_start: a.novelty_start ? String(a.novelty_start).slice(0,10) : '',
    novelty_end:   a.novelty_end ? String(a.novelty_end).slice(0,10) : '',
    novelty_description: a.novelty_description || ''
  }
  onStateChange()
}
function closeEdit(){ editing.value = null }

function onStateChange(){
  const s = form.value.state
  if (s === 'SIN NOVEDAD') {
    form.value.municipalityId = 11001
    form.value.municipalityName = 'CUNDINAMARCA - Bogotá'
    form.value.novelty_start = ''
    form.value.novelty_end = ''
    form.value.novelty_description = ''
  } else if (s === 'SERVICIO') {
    form.value.municipalityId = 11001
    form.value.municipalityName = 'CUNDINAMARCA - Bogotá'
    // Fechas y descripción las llena el usuario
  } else if (s === 'COMISIÓN DEL SERVICIO') {
    form.value.municipalityId = null
    form.value.municipalityName = ''
    form.value.novelty_start = ''
    form.value.novelty_end = ''
    form.value.novelty_description = ''
  } else if (s === 'FRANCO FRANCO') {
    form.value.municipalityId = null
    form.value.municipalityName = ''
    form.value.novelty_start = ''
    form.value.novelty_end = ''
    form.value.novelty_description = ''
  } else {
    // VACACIONES / LICENCIAS / EXCUSA / PERMISO / COMISIÓN EXTERIOR
    form.value.municipalityId = null
    form.value.municipalityName = ''
    // fechas/descr requeridas, usuario completa
  }
}

function onMunicipalityInput(e){
  const q = (form.value.municipalityName || '').trim().toLowerCase()
  if (!q) { form.value.municipalityId = null; return }
  // carga dinámica si escribe
  loadMunicipalities(q)
  const m = municipalities.value.find(m => (`${m.dept} - ${m.name}`.toLowerCase() === q))
  form.value.municipalityId = m ? m.id : null
}

async function saveEdit(){
  msg.value = ''
  const id = form.value.id

  try {
    // 1) Cambio de grupo/unidad/código/categoría (según rol)
    if (isSuperadmin.value) {
      await axios.put(`/admin/agents/${id}`, {
        code: form.value.code,
        category: uiToApiCategory(form.value.categoryUi),
        groupId: form.value.groupId || null,
        unitId: form.value.unitId || null
      }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
    } else if (isAdminLike.value) {
      await axios.put(`/admin/agents/${id}`, {
        groupId: form.value.groupId || null,
        unitId: form.value.unitId || null
      }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
    } else if (isLeaderGroup.value) {
      // sólo unidad dentro de mi grupo
      if ((editing.value.unitId || null) !== (form.value.unitId || null)) {
        await axios.put(`/my/agents/${id}/unit`, {
          unitId: form.value.unitId || null
        }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
      }
    }

    // 2) Guardar novedad del día (misma validación que reporte)
    // IMPORTANTE: este endpoint debe permitir leader_group en backend.
    const payload = {
      date: today.value,
      state: form.value.state,
      municipalityId: form.value.state === 'COMISIÓN DEL SERVICIO' ? form.value.municipalityId : null,
      novelty_start: (form.value.state === 'SERVICIO' || otrosRequierenFechas.includes(form.value.state)) ? form.value.novelty_start : null,
      novelty_end:   (form.value.state === 'SERVICIO' || otrosRequierenFechas.includes(form.value.state)) ? form.value.novelty_end   : null,
      novelty_description: (form.value.state === 'SERVICIO' || otrosRequierenFechas.includes(form.value.state)) ? form.value.novelty_description : null
    }
    await axios.put(`/admin/agents/${id}/novelty`, payload, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })

    msg.value = 'Cambios guardados ✅'
    closeEdit()
    await loadAgents()
  } catch (e) {
    // Si backend aún no permite leader_group en /admin/agents/:id/novelty, verás 403 aquí.
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo guardar'
  }
}

async function deleteAgent(a){
  if (!confirm('¿Eliminar este agente?')) return
  try{
    await axios.delete(`/admin/agents/${a.id}`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    msg.value = 'Agente eliminado ✅'
    await loadAgents()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo eliminar'
  }
}

/* ===== Init ===== */
onMounted(async () => {
  await loadMe()
  await Promise.all([loadGroups(), loadUnits(), loadMunicipalities()])
  await loadAgents()
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
