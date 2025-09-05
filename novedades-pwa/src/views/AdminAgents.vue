<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <!-- Header -->
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-slate-800">Listado de agentes</h2>
          <span v-if="msg" :class="msgClass" class="text-sm">{{ msg }}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body space-y-4">
        <!-- Filtros -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:items-end">
          <div class="sm:col-span-2">
            <label class="label">Buscar</label>
            <input class="input" v-model.trim="search" placeholder="Código, categoría (OF/ME/PT), grupo, unidad…" />
          </div>
          <div>
            <label class="label">Categoría</label>
            <select v-model="searchCat" class="input">
              <option value="ALL">Todas</option>
              <option value="OF">OF</option>
              <option value="ME">ME</option>
              <option value="PT">PT</option>
            </select>
          </div>
          <div>
            <label class="label">Grupo</label>
            <select v-model="searchGroupId" class="input">
              <option value="ALL">Todos</option>
              <option v-for="g in groups" :key="g.id" :value="String(g.id)">{{ g.code }}</option>
            </select>
          </div>
        </div>

        <!-- Crear/Editar (solo superadmin) -->
        <form v-if="isSuperAdmin" class="mt-2 flex flex-wrap gap-2 items-end" @submit.prevent="onSubmit">
          <input class="input" v-model="form.code" placeholder="Código (O101)" maxlength="8" required style="width:120px" />

          <!-- Visual ME, valor real SO -->
          <select class="input" v-model="form.category" required style="width:90px">
            <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <select class="input" v-model="form.groupId" style="width:150px">
            <option value="">Sin grupo</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.code }}</option>
          </select>

          <select class="input" v-model="form.unitId" style="width:220px">
            <option value="">Sin unidad</option>
            <option v-for="u in unitsByGroup[form.groupId] || []" :key="u.id" :value="u.id">
              {{ u.name }} ({{ groupCode(u.groupId) }})
            </option>
          </select>

          <select class="input" v-model="form.status" required style="width:190px">
            <option value="LABORANDO">LABORANDO</option>
            <option value="SIN NOVEDAD">SIN NOVEDAD</option>
            <option value="SERVICIO">SERVICIO</option>
            <option value="COMISIÓN DEL SERVICIO">COMISIÓN DEL SERVICIO</option>
            <option value="VACACIONES">VACACIONES</option>
            <option value="EXCUSA">EXCUSA</option>
            <option value="PERMISO">PERMISO</option>
          </select>

          <!-- Municipio autocompletado -->
          <input class="input" v-model="form.municipalityName" list="municipios-list" @input="onMunicipalityInput"
                 placeholder="Buscar municipio…" style="width:240px" autocomplete="off" />
          <datalist id="municipios-list">
            <option v-for="m in municipalities" :key="m.id" :value="m.dept + ' - ' + m.name" />
          </datalist>

          <button class="btn-primary" type="submit">{{ form.id ? 'Actualizar' : 'Crear agente' }}</button>
          <button v-if="form.id" class="btn-ghost" @click.prevent="resetForm">Cancelar</button>
        </form>

        <!-- Tabla -->
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th style="width:60px">ID</th>
                <th style="width:110px">Código</th>
                <th style="width:70px">Cat.</th>
                <th style="width:120px">Grupo</th>
                <th style="width:200px">Unidad</th>
                <th style="width:150px">Estado</th>
                <th style="width:220px">Municipio</th>
                <th style="width:90px" v-if="showActionsCol"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in filteredAndSorted" :key="a.id">
                <td>{{ a.id }}</td>
                <td>{{ a.code }}</td>
                <td>{{ displayCategory(a.category) }}</td>
                <td>{{ groupCode(a.groupId) }}</td>

                <!-- Unidad: selector para líder de grupo; texto para otros -->
                <td v-if="isLeaderGroup">
                  <select class="input" v-model="a.unitId" @change="moveUnitInsideMyGroup(a)">
                    <option value="">Sin unidad</option>
                    <option v-for="u in myUnits" :key="u.id" :value="u.id">{{ u.name }}</option>
                  </select>
                </td>
                <td v-else>
                  {{ unitName(a.unitId) }}
                </td>

                <td>{{ a.status }}</td>
                <td>{{ municipalityName(a.municipalityId) }}</td>

                <td v-if="showActionsCol">
                  <div class="flex gap-1 items-center justify-center">
                    <!-- Editar (supervisor y superadmin) -->
                    <button v-if="canEditAgent(a)" class="btn-ghost p-1" title="Editar" @click="openEditModal(a)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-pencil" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L8.5 18.1a2 2 0 0 1-.9.5l-4 1a1 1 0 0 1-1.2-1.2l1-4a2 2 0 0 1 .5-.9Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <!-- Eliminar (solo superadmin) -->
                    <button v-if="isSuperAdmin" class="btn-ghost p-1" title="Eliminar" @click="deleteAgent(a)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-trash-2" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/><path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredAndSorted.length === 0">
                <td :colspan="showActionsCol ? 8 : 7" class="text-center text-slate-500 py-6">Sin agentes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal editar (supervisor/superadmin) -->
    <div v-if="editOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeEdit"></div>
      <div class="absolute inset-x-0 top-10 mx-auto max-w-xl w-full">
        <div class="card">
          <div class="card-body space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-slate-800">Editar agente</h3>
              <button class="btn-ghost" @click="closeEdit">Cerrar</button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="label">Código</label>
                <div class="input bg-slate-100">{{ editForm.code }}</div>
              </div>
              <div>
                <label class="label">Categoría</label>
                <div class="input bg-slate-100">{{ displayCategory(editForm.category) }}</div>
              </div>

              <div>
                <label class="label">Grupo</label>
                <select v-model="editForm.groupId" class="input" @change="onEditGroupChange">
                  <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.code }}</option>
                </select>
              </div>
              <div>
                <label class="label">Unidad</label>
                <select v-model="editForm.unitId" class="input">
                  <option value="">Sin unidad</option>
                  <option v-for="u in unitsByGroup[editForm.groupId] || []" :key="u.id" :value="u.id">{{ u.name }}</option>
                </select>
              </div>

              <div>
                <label class="label">Estado (novedad)</label>
                <select v-model="editForm.status" class="input" @change="onEditStateChange">
                  <option value="LABORANDO">LABORANDO</option>
                  <option value="SIN NOVEDAD">SIN NOVEDAD</option>
                  <option value="SERVICIO">SERVICIO</option>
                  <option value="COMISIÓN DEL SERVICIO">COMISIÓN DEL SERVICIO</option>
                  <option value="VACACIONES">VACACIONES</option>
                  <option value="EXCUSA">EXCUSA</option>
                  <option value="PERMISO">PERMISO</option>
                </select>
              </div>

              <div>
                <label class="label">Municipio</label>
                <input class="input" v-model="editForm.municipalityName" list="municipios-list"
                       @input="onEditMunicipalityInput" placeholder="Buscar municipio…" autocomplete="off" />
              </div>

              <div>
                <label class="label">Fecha inicio</label>
                <input type="date" class="input" v-model="editForm.novelty_start"/>
              </div>
              <div>
                <label class="label">Fecha fin</label>
                <input type="date" class="input" v-model="editForm.novelty_end"/>
              </div>

              <div class="sm:col-span-2">
                <label class="label">Descripción</label>
                <textarea class="input" rows="2" v-model="editForm.novelty_description" placeholder="Descripción…"></textarea>
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <button class="btn-ghost" @click="closeEdit">Cancelar</button>
              <button class="btn-primary" @click="saveEdit">Guardar cambios</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

/* ========== Auth / roles ========== */
const me = ref(JSON.parse(localStorage.getItem('me') || '{}'))
const role = computed(() => String(me.value.role || '').toLowerCase())
const isSuperAdmin   = computed(() => role.value === 'superadmin')
const isSupervisor   = computed(() => role.value === 'supervision' || role.value === 'supervisor')
const isLeaderGroup  = computed(() => role.value === 'leader_group')
const showActionsCol = computed(() => isSuperAdmin.value || isSupervisor.value)

/* ========== State ========== */
const items = ref([])
const groups = ref([])
const units  = ref([])
const municipalities = ref([])
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

/* ========== Helpers visuales ========== */
const categoryOptions = [
  { label:'OF', value:'OF' },
  { label:'ME', value:'SO' }, // ME visual, guarda SO
  { label:'PT', value:'PT' }
]
function displayCategory(c){ return String(c||'') === 'SO' ? 'ME' : c }
const CATEG_ORDER = { 'OF':1, 'SO':2, 'PT':3 } // SO se imprime como ME
function groupCode(id){ if(!id) return '—'; const g=groups.value.find(x=>x.id==id); return g?g.code:id }
function unitName(id){ if(!id) return '—'; const u=units.value.find(x=>x.id==id); return u?u.name:id }
function municipalityName(id){ if(!id) return '—'; const m=municipalities.value.find(x=>x.id==id); return m?`${m.dept} - ${m.name}`:id }

const unitsByGroup = computed(() => {
  const map = {}
  for (const u of units.value) {
    if (!map[u.groupId]) map[u.groupId] = []
    map[u.groupId].push(u)
  }
  return map
})
const myUnits = computed(() => units.value.filter(u => u.groupId === me.value.groupId))

/* ========== Filtros ========== */
const search = ref('')
const searchCat = ref('ALL')
const searchGroupId = ref('ALL')

const filteredAndSorted = computed(() => {
  let list = items.value.slice()

  const q = search.value.trim().toUpperCase()
  if (q) {
    list = list.filter(a =>
      String(a.code||'').toUpperCase().includes(q) ||
      String(displayCategory(a.category)).toUpperCase().includes(q) ||
      String(groupCode(a.groupId)).toUpperCase().includes(q) ||
      String(unitName(a.unitId)).toUpperCase().includes(q)
    )
  }
  if (searchCat.value !== 'ALL') {
    const val = searchCat.value === 'ME' ? 'SO' : searchCat.value
    list = list.filter(a => a.category === val)
  }
  if (searchGroupId.value !== 'ALL') {
    list = list.filter(a => String(a.groupId) === String(searchGroupId.value))
  }

  // Orden: OF -> ME(SO) -> PT, luego código
  list.sort((a,b) => {
    const ca = CATEG_ORDER[a.category] || 99
    const cb = CATEG_ORDER[b.category] || 99
    if (ca !== cb) return ca - cb
    return String(a.code||'').localeCompare(String(b.code||''))
  })
  return list
})

/* ========== Form crear/editar (superadmin) ========== */
const form = ref({
  id:null, code:'', category:'OF', groupId:'', unitId:'',
  status:'LABORANDO', municipalityId:'', municipalityName:''
})
function resetForm(){
  form.value = { id:null, code:'', category:'OF', groupId:'', unitId:'', status:'LABORANDO', municipalityId:'', municipalityName:'' }
}
function onMunicipalityInput(){
  const q = form.value.municipalityName?.trim().toLowerCase()
  const m = municipalities.value.find(mm => (`${mm.dept} - ${mm.name}`.toLowerCase() === q))
  form.value.municipalityId = m ? m.id : ''
}

/* Validación simple de “novedades” */
function validateNoveltyLike(status, municipalityId, municipalityName){
  const BOGOTA = 11001
  if (status === 'SERVICIO') {
    if (Number(municipalityId) !== BOGOTA) { msg.value = 'En SERVICIO el municipio debe ser Bogotá (11001)'; return false }
  }
  if (status === 'COMISIÓN DEL SERVICIO') {
    if (!municipalityId || !municipalityName) { msg.value = 'En COMISIÓN DEL SERVICIO seleccione un municipio válido'; return false }
  }
  return true
}

async function onSubmit(){
  if (!form.value.code.trim()) { msg.value='El código es requerido'; return }
  if (!form.value.category) { msg.value='La categoría es requerida'; return }
  if (!validateNoveltyLike(form.value.status, form.value.municipalityId, form.value.municipalityName)) return

  try {
    if (!form.value.id) {
      await axios.post('/admin/agents', {               // <-- ajusta si usas otro endpoint
        code: form.value.code.trim().toUpperCase(),
        category: form.value.category,                  // SO real en DB
        groupId: form.value.groupId || null,
        unitId : form.value.unitId || null,
        status : form.value.status || 'LABORANDO',
        municipalityId: form.value.municipalityId || null
      }, { headers:{ Authorization:'Bearer '+localStorage.getItem('token') } })
      msg.value = 'Agente creado ✅'
    } else {
      await axios.put(`/admin/agents/${form.value.id}`, {
        code: form.value.code.trim().toUpperCase(),
        category: form.value.category,
        groupId: form.value.groupId || null,
        unitId : form.value.unitId || null,
        status : form.value.status || 'LABORANDO',
        municipalityId: form.value.municipalityId || null
      }, { headers:{ Authorization:'Bearer '+localStorage.getItem('token') } })
      msg.value = 'Agente actualizado ✅'
    }
    await load()
    resetForm()
  } catch(e){
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo guardar'
  }
}

/* ========== Acciones fila ========== */
function canEditAgent(){ return isSuperAdmin.value || isSupervisor.value }

async function deleteAgent(a){
  if (!confirm('¿Eliminar este agente?')) return
  try {
    await axios.delete(`/admin/agents/${a.id}`, { headers:{ Authorization:'Bearer '+localStorage.getItem('token') } })
    msg.value = 'Agente eliminado ✅'
    await load()
    resetForm()
  } catch(e){
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo eliminar'
  }
}

/* Mover unidad (solo líder de grupo) */
async function moveUnitInsideMyGroup(a){
  try {
    await axios.put(`/admin/agents/${a.id}`, {
      groupId: me.value.groupId,
      unitId: a.unitId || null
    }, { headers:{ Authorization:'Bearer '+localStorage.getItem('token') } })
    msg.value = 'Unidad actualizada ✅'
  } catch(e){
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo mover de unidad'
  }
}

/* ========== Modal edición (supervisor/superadmin) ========== */
const editOpen = ref(false)
const editForm = ref({
  id:null, code:'', category:'', groupId:'', unitId:'',
  status:'LABORANDO', municipalityId:null, municipalityName:'',
  novelty_start:'', novelty_end:'', novelty_description:''
})
function openEditModal(a){
  if (!canEditAgent(a)) return
  const m = municipalities.value.find(m => m.id === a.municipalityId)
  editForm.value = {
    id:a.id, code:a.code, category:a.category,
    groupId:a.groupId || '', unitId:a.unitId || '',
    status:a.status || 'LABORANDO',
    municipalityId:a.municipalityId || null,
    municipalityName:m ? `${m.dept} - ${m.name}` : '',
    novelty_start: a.novelty_start ? String(a.novelty_start).slice(0,10) : '',
    novelty_end:   a.novelty_end   ? String(a.novelty_end).slice(0,10)   : '',
    novelty_description: a.novelty_description || ''
  }
  editOpen.value = true
}
function closeEdit(){ editOpen.value=false }
function onEditGroupChange(){ editForm.value.unitId='' }
function onEditStateChange(){
  const BOGOTA=11001
  if (editForm.value.status === 'SIN NOVEDAD' || editForm.value.status === 'SERVICIO') {
    editForm.value.municipalityId = BOGOTA
    const b = municipalities.value.find(m => m.id === BOGOTA)
    editForm.value.municipalityName = b ? `${b.dept} - ${b.name}` : 'CUNDINAMARCA - Bogotá'
  }
  if (editForm.value.status === 'COMISIÓN DEL SERVICIO') {
    editForm.value.municipalityId = null
    editForm.value.municipalityName = ''
  }
}
function onEditMunicipalityInput(){
  const q = editForm.value.municipalityName?.trim().toLowerCase()
  const m = municipalities.value.find(mm => (`${mm.dept} - ${mm.name}`.toLowerCase() === q))
  editForm.value.municipalityId = m ? m.id : null
}
async function saveEdit(){
  if (!validateNoveltyLike(editForm.value.status, editForm.value.municipalityId, editForm.value.municipalityName)) return
  try {
    // Cambios de grupo/unidad
    await axios.put(`/admin/agents/${editForm.value.id}`, {
      groupId: editForm.value.groupId || null,
      unitId : editForm.value.unitId  || null
    }, { headers:{ Authorization:'Bearer '+localStorage.getItem('token') } })

    // Cambios de estado/novedad (ajusta si tu API usa PUT en lugar de PATCH)
    await axios.patch(`/admin/agents/${editForm.value.id}/status`, {
      status: editForm.value.status,
      municipalityId: editForm.value.municipalityId,
      novelty_start: editForm.value.novelty_start || null,
      novelty_end:   editForm.value.novelty_end   || null,
      novelty_description: editForm.value.novelty_description || null
    }, { headers:{ Authorization:'Bearer '+localStorage.getItem('token') } })

    msg.value = 'Agente actualizado ✅'
    closeEdit()
    await load()
  } catch(e){
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo actualizar'
  }
}

/* ========== Loaders ========== */
async function load(){
  msg.value = ''
  try {
    const params = {}
    if (isLeaderGroup.value) params.groupId = me.value.groupId   // restringe a su grupo
    const { data } = await axios.get('/admin/agents', {          // <-- ajusta si tienes endpoint /my/agents para líderes
      params, headers:{ Authorization:'Bearer '+localStorage.getItem('token') }
    })
    items.value = (data || []).map(x => ({ ...x, unitId: x.unitId || '' }))
  } catch(e){
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al cargar agentes'
  }
}
async function loadGroups(){
  const { data } = await axios.get('/admin/groups', { headers:{ Authorization:'Bearer '+localStorage.getItem('token') } })
  groups.value = data || []
}
async function loadUnits(){
  try {
    // admin/supervisor
    const { data } = await axios.get('/admin/units', { headers:{ Authorization:'Bearer '+localStorage.getItem('token') } })
    units.value = data || []
  } catch {
    // líder de grupo (fallback)
    try {
      const { data } = await axios.get('/my/units', { headers:{ Authorization:'Bearer '+localStorage.getItem('token') } })
      units.value = data || []
    } catch { units.value = [] }
  }
}
async function loadMunicipalities(q=''){
  const params = q && q.length>=2 ? { q } : {}
  const { data } = await axios.get('/catalogs/municipalities', {
    params, headers:{ Authorization:'Bearer '+localStorage.getItem('token') }
  })
  municipalities.value = data || []
}

onMounted(async () => {
  // refresca /me
  try {
    const { data } = await axios.get('/me', { headers:{ Authorization:'Bearer '+localStorage.getItem('token') } })
    me.value = data
    localStorage.setItem('me', JSON.stringify(data))
  } catch {}
  await Promise.all([loadGroups(), loadUnits(), loadMunicipalities()])
  await load()
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
