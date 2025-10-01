<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <!-- Encabezado -->
    <div class="card-body flex items-center justify-between">
        <h2 class="font-semibold text-slate-800">Listado de agentes</h2>
        <div class="flex items-center gap-3">
          <span v-if="msg" :class="msgClass" class="text-sm">{{ msg }}</span>
          <button v-if="isSuperadmin" class="btn-primary" @click="openCreate">Nuevo agente</button>
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
                <th>#</th>
                <th>Código</th>
                <th>Agente</th> <!-- Apodo justo después de Código -->
                <th>Cat.</th>
                <th>Grupo</th>
                <th>Unidad</th>
                <th>Estado</th>
                <th>Municipio</th>
                <th class="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(a, idx) in itemsPagina" :key="a.id">
                <td :title="'ID: ' + a.id">{{ rowNumber(idx) }}</td>
                <td>{{ a.code }}</td>
                <td>{{ a.nickname || '—' }}</td> <!-- Apodo aquí -->
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 2a2.828 2.828 0 0 1 4 4L7 21l-4 1 1-4Z"></path><path d="m16 5 3 3"></path>
                    </svg>
                  </button>
                  <button v-if="isSuperadmin" class="btn-ghost p-1" title="Eliminar" @click="deleteAgent(a)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/>
                      <path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/>
                      <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                    </svg>
                  </button>
                </td>
              </tr>
              <tr v-if="itemsPagina.length === 0">
                <td colspan="9" class="text-center text-slate-500 py-6">Sin agentes</td>
              </tr>
            </tbody>
          </table>

                          <!-- Paginación (solo admin/supervisión) -->
                <div v-if="total > 0" class="mt-3 flex items-center gap-3 justify-between">
                  <div class="text-sm text-slate-600">
                    Mostrando
                    <b>{{ Math.min(((page-1)*pageSize)+1, total) }}</b>–
                    <b>{{ Math.min(page*pageSize, total) }}</b>
                    de <b>{{ total }}</b>
                  </div>

                  <div class="flex items-center gap-2">
                    <button class="btn-ghost" :disabled="page<=1" @click="gotoPage(1)">« Primero</button>
                    <button class="btn-ghost" :disabled="page<=1" @click="gotoPage(page-1)">‹ Anterior</button>
                    <span class="text-sm text-slate-700">Página {{ page }} / {{ totalPages }}</span>
                    <button class="btn-ghost" :disabled="page>=totalPages" @click="gotoPage(page+1)">Siguiente ›</button>
                    <button class="btn-ghost" :disabled="page>=totalPages" @click="gotoPage(totalPages)">Último »</button>

                    <select class="input !w-28" v-model.number="pageSize" @change="() => { page=1; loadAgents() }">
                      <option :value="50">50</option>
                      <option :value="100">100</option>
                      <option :value="200">200</option>
                      <option :value="500">500</option>
                      <option :value="1000">1000</option>
                    </select>
                  </div>
                </div>

        </div>
      </div>
    </div>

    <!-- Modal Edición -->
    <div v-if="editing" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
         @click.self="closeEdit">
      <div class="bg-white rounded-xl shadow max-w-2xl w-full">
        <div class="p-4 border-b flex items-center justify-between">
          <div class="font-semibold text-slate-800">
            <template v-if="isCreating">Crear agente</template>
            <template v-else>Editar agente — {{ editing.code }} ({{ catLabel(editing.category) }})</template>
          </div>

          <button class="btn-ghost" @click="closeEdit">Cerrar</button>
        </div>

        <div class="p-4 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div v-if="isSuperadmin">
              <label class="label">Código</label>
              <input class="input" v-model="form.code" />
            </div>
            <div>
              <label class="label">Agente</label>
              <input
                class="input"
                v-model="form.nickname"
                placeholder="Agente"
                maxlength="120"
              />
              <p class="text-xs text-slate-500 mt-1">
                Se almacena cifrado en la base de datos.
              </p>
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
            <!-- HOSPITALIZADO: solo INICIO -->
            <div v-else-if="form.state === 'HOSPITALIZADO'">
              <label class="label">Fecha inicio</label>
              <input type="date" class="input" v-model="form.novelty_start" />
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

                    <div v-if="
              form.state === 'SERVICIO' ||
              form.state === 'COMISIÓN DEL SERVICIO' ||
              otrosRequierenFechas.includes(form.state) ||
              form.state === 'HOSPITALIZADO'
            ">
              <label class="label">Descripción</label>
              <textarea class="input" rows="2" v-model="form.novelty_description" placeholder="Motivo / detalle..."></textarea>
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
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'


/* ===== Helpers UI ===== */
const catLabel = (c) => (String(c).toUpperCase()==='SO' ? 'ME' : c)
const uiToApiCategory = (ui) => (ui==='ME' ? 'SO' : ui)

// ===== Paginación común (admin/supervisión: server-side | líder grupo: client-side) =====
const page = ref(1)
const pageSize = ref(200)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil((total.value || 0) / (pageSize.value || 1))))

function gotoPage(n){
  const t = totalPages.value
  const p = Math.min(Math.max(1, Number(n) || 1), t)
  if (p !== page.value) {
    page.value = p
    if (isAdminLike.value) loadAgents()     // 👈 recarga server-side
  }
}

function onChangePageSize(){
  page.value = 1 // client-side: el computed se recalcula solo
}



function rowNumber(idx){
  // Admin/Supervisión (server-side): numeración absoluta con offset del backend
  if (isAdminLike.value) {
    return (page.value - 1) * pageSize.value + idx + 1
  }
  // Líder de grupo (client-side): numeración por página tras filtrar & paginar en cliente
  return (page.value - 1) * pageSize.value + idx + 1
}





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

const itemsBase = ref([])
const items = ref([])
const groups = ref([])         // grupos (admin)
const units = ref([])          // todas las unidades (admin)
const myUnits = ref([])        // unidades de mi grupo (líder grupo)
const municipalities = ref([]) // catálogo
/* ===== Fecha por defecto (mañana) ===== */
function formatDateISO(d) {
  return d.toISOString().slice(0,10)
}
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const today = ref(formatDateISO(tomorrow))

/* ===== Filtros ===== */
const filters = ref({ q:'', cat:'ALL', groupId:'ALL' })
watch(filters, () => { page.value = 1; reloadAdminDebounced() }, { deep: true })


/* ===== Estados ===== */
 const estadosValidos = [
  'SIN NOVEDAD','SERVICIO','COMISIÓN DEL SERVICIO','FRANCO FRANCO',
  'VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO',
  'LICENCIA REMUNERADA','LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO',
  'LICENCIA PATERNIDAD','PERMISO','COMISIÓN EN EL EXTERIOR', 'COMISIÓN DE ESTUDIO', 'SUSPENDIDO','HOSPITALIZADO'
 ]
 const otrosRequierenFechas = [
  'VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO',
  'LICENCIA REMUNERADA','LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO',
  'LICENCIA PATERNIDAD','PERMISO','COMISIÓN EN EL EXTERIOR', 'COMISIÓN DE ESTUDIO', 'SUSPENDIDO'
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


async function loadAgentNovelty(agentId){
  const { data } = await axios.get(`/admin/agents/${agentId}/novelty`, {
    params: { date: today.value },   // usa la fecha seleccionada en el filtro
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  return data || null
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
      // Server-side pagination + filtros enviados
      const params = {
        page: page.value,
        pageSize: pageSize.value
      }
      if (filters.value.groupId !== 'ALL') params.groupId = Number(filters.value.groupId)
      if (filters.value.q && filters.value.q.trim()) params.q = String(filters.value.q).trim()
      if (filters.value.cat !== 'ALL') {
        params.category = filters.value.cat === 'ME' ? 'SO' : filters.value.cat
      }

      const { data } = await axios.get('/admin/agents', {
        params,
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })

      items.value = normalizeAgents(data?.items || [])
      // total y página los dicta el backend
      total.value = Number(data?.total || 0)

    } else if (isLeaderGroup.value) {
      // Client-side pagination (trae todo de su grupo y paginamos/filtramos localmente)
      const { data } = await axios.get('/my/agents', {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      itemsBase.value = normalizeAgents(data || [])
      // total se calcula en computed (itemsFiltradosOrdenados) → aquí no tocamos total
    } else {
      items.value = []
      itemsBase.value = []
      total.value = 0
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
    municipalityName: a.municipalityName || (a.municipalityId ? '' : ''),
    nickname: a.nickname || null
  }))
}

// ===== Recarga con debounce (evita bombardear la API al escribir) =====
const reloadAdminDebounced = (() => {
  let t = null
  return () => {
    clearTimeout(t)
    t = setTimeout(() => {
      if (isAdminLike.value) loadAgents()
    }, 300) // 300ms cómodo para escribir
  }
})()




// Filtrado + orden (solo para líder de grupo; admin/supervisión ya filtran en backend)
const itemsFiltradosOrdenados = computed(() => {
  if (isAdminLike.value) {
    // Admin/Supervisión: confiar en backend (ya viene filtrado/paginado); solo ordenamos por estética
    const arr = items.value.slice()
    const order = { 'OF':1, 'SO':2, 'PT':3 }
    arr.sort((a,b) => {
      const ca = order[String(a.category).toUpperCase()] || 9
      const cb = order[String(b.category).toUpperCase()] || 9
      if (ca !== cb) return ca - cb
      return String(a.code).localeCompare(String(b.code))
    })
    return arr
  }

  // Líder de grupo: filtrar/ordenar en cliente
  let arr = itemsBase.value.slice()

  const q = filters.value.q.trim().toUpperCase()
  if (q) {
    arr = arr.filter(a =>
      String(a.code||'').toUpperCase().includes(q) ||
      catLabel(a.category).includes(q) ||
      String(a.groupCode||'').toUpperCase().includes(q) ||
      String(a.unitName||'').toUpperCase().includes(q) ||
      String(a.nickname||'').toUpperCase().includes(q)
    )
  }
  if (filters.value.cat !== 'ALL') {
    const target = filters.value.cat === 'ME' ? 'SO' : filters.value.cat
    arr = arr.filter(a => String(a.category).toUpperCase() === target)
  }
  // groupId no aplica a líder de grupo (solo ve su grupo)

  const order = { 'OF':1, 'SO':2, 'PT':3 }
  arr.sort((a,b) => {
    const ca = order[String(a.category).toUpperCase()] || 9
    const cb = order[String(b.category).toUpperCase()] || 9
    if (ca !== cb) return ca - cb
    return String(a.code).localeCompare(String(b.code))
  })
  return arr
})

// Página actual para pintar en la tabla
const itemsPagina = computed(() => {
  if (isAdminLike.value) {
    // Admin/Supervisión: backend ya paginó → usar tal cual
    return itemsFiltradosOrdenados.value
  }
  // Líder de grupo: paginar en cliente
  total.value = itemsFiltradosOrdenados.value.length
  const start = (page.value - 1) * pageSize.value
  return itemsFiltradosOrdenados.value.slice(start, start + pageSize.value)
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

const isCreating = ref(false)
const editing = ref(null) // row original
const form = ref({
  id:null, code:'', categoryUi:'OF', groupId:null, unitId:null,
  state:'SIN NOVEDAD',
  municipalityId:null, municipalityName:'',
  novelty_start:'', novelty_end:'', novelty_description:'',
  nickname:'' 
})

function openCreate(){
  isCreating.value = true
  editing.value = { id: null } // solo para mostrar el modal
  form.value = {
    id: null,
    code: '',
    categoryUi: 'OF',
    groupId: null,
    unitId: null,
    state: 'SIN NOVEDAD',
    municipalityId: null,
    municipalityName: '',
    novelty_start: '',
    novelty_end: '',
    novelty_description: '',
    nickname: a.nickname || '' 
  }
}





async function openEdit(a){
  editing.value = a
  // valores base (por si no hay novedad previa)
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
    novelty_end:   a.novelty_end ? String(a.novelty_end).slice(0,10)   : '',
    novelty_description: a.novelty_description || ''
  }

  try {
    // 👉 pide la última novedad (o la válida hasta la fecha seleccionada)
    const det = await loadAgentNovelty(a.id)
    if (det) {
      form.value.state = det.state || form.value.state
      form.value.novelty_start = det.novelty_start || ''
      form.value.novelty_end   = det.novelty_end   || ''
      form.value.novelty_description = det.novelty_description || ''

      // municipio mostrado en el input tipo datalist
      if (det.municipalityId) {
        form.value.municipalityId = det.municipalityId
        // el datalist usa formato "Depto - Municipio"
        form.value.municipalityName = det.dept && det.municipalityName
          ? `${det.dept} - ${det.municipalityName}`
          : form.value.municipalityName
      } else if (['SERVICIO','SIN NOVEDAD'].includes(form.value.state)) {
        // coherente con tu UI actual
        form.value.municipalityId = 11001
        form.value.municipalityName = 'CUNDINAMARCA - Bogotá'
      } else {
        form.value.municipalityId = null
        form.value.municipalityName = ''
      }
    }
  } catch(e) {
    msg.value = e?.response?.data?.detail || e?.message || 'No se pudo cargar la novedad'
  }

  onStateChange(true)  // ajusta reglas (fechas/descr/muni) según estado final
}

function closeEdit(){ editing.value = null; isCreating.value = false }


function onStateChange(preserve = false){
  const s = form.value.state
  if (s === 'SIN NOVEDAD') {
    form.value.municipalityId = 11001
    form.value.municipalityName = 'CUNDINAMARCA - Bogotá'
    if (!preserve) {
      form.value.novelty_start = ''
      form.value.novelty_end = ''
      form.value.novelty_description = ''
    }
  } else if (s === 'SERVICIO') {
    form.value.municipalityId = 11001
    form.value.municipalityName = 'CUNDINAMARCA - Bogotá'
  } else if (s === 'COMISIÓN DEL SERVICIO') {
    form.value.municipalityId = null
    form.value.municipalityName = ''
    if (!preserve) {
      form.value.novelty_start = ''
      form.value.novelty_end = ''
      form.value.novelty_description = ''
    }
  } else if (s === 'FRANCO FRANCO') {
    form.value.municipalityId = null
    form.value.municipalityName = ''
    if (!preserve) {
      form.value.novelty_start = ''
      form.value.novelty_end = ''
      form.value.novelty_description = ''
    }
  } else if (s === 'HOSPITALIZADO') {
    // 👇 importante: sin fin
    if (!preserve) form.value.novelty_end = ''
    form.value.municipalityId = null
    form.value.municipalityName = ''
  } else {
    // VACACIONES / LICENCIAS / EXCUSA / PERMISO / COMISIÓN EXTERIOR / SUSPENDIDO ...
    form.value.municipalityId = null
    form.value.municipalityName = ''
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

async function saveEdit () {
  msg.value = ''
  const id = form.value.id

  try {
    // --- Crear nuevo agente (solo superadmin) ---
    if (isCreating.value) {
      if (!isSuperadmin.value) { msg.value = 'No autorizado'; return }
      const code = String(form.value.code || '').toUpperCase().trim()
      if (!/^[A-Z][0-9]+$/.test(code)) { msg.value = 'Código inválido (LETRA+números)'; return }

      await axios.post('/admin/agents', {
        code,
        category: uiToApiCategory(form.value.categoryUi),
        groupId: form.value.groupId || null,
        unitId: form.value.unitId || null,
        nickname: (form.value.nickname || '').trim() || null
      }, authHeader())

      msg.value = 'Agente creado ✅'
      closeEdit()
      await loadAgents()
      return
    }

    const requiereFechasYDescr = (s) => s === 'SERVICIO' || otrosRequierenFechas.includes(s)

          // Comisión del servicio (igual que tenías)
          if (form.value.state === 'COMISIÓN DEL SERVICIO' && !form.value.municipalityId) {
            msg.value = 'Selecciona un municipio válido para Comisión del servicio'
            return
          }
          if (form.value.state === 'COMISIÓN DEL SERVICIO' && !String(form.value.novelty_description||'').trim()) {
            msg.value = 'La descripción es obligatoria para Comisión del servicio'
            return
          }

          // HOSPITALIZADO: inicio + descripción, sin fin
          if (form.value.state === 'HOSPITALIZADO') {
            if (!form.value.novelty_start) { msg.value = 'Falta fecha inicio (HOSPITALIZADO)'; return }
            if (!String(form.value.novelty_description||'').trim()) { msg.value = 'La descripción es obligatoria (HOSPITALIZADO)'; return }
          }

          // Estados con inicio+fin+descr (incluye SUSPENDIDO)
          if (requiereFechasYDescr(form.value.state)) {
            if (!form.value.novelty_start || !form.value.novelty_end) { msg.value = 'Completa fecha inicio y fin'; return }
            if (!String(form.value.novelty_description||'').trim()) { msg.value = 'La descripción es obligatoria'; return }
          }


    // Actualizar grupo/unidad/código/categoría según rol
    if (isLeaderGroup.value) {
      if ((editing.value.unitId || null) !== (form.value.unitId || null)) {
        await axios.put(`/my/agents/${id}/unit`, { unitId: form.value.unitId || null }, authHeader())
      }
    } else if (isAdminLike.value) {
      await axios.put(`/admin/agents/${id}`, {
        code: isSuperadmin.value ? form.value.code : undefined,
        category: isSuperadmin.value ? uiToApiCategory(form.value.categoryUi) : undefined,
        groupId: form.value.groupId || null,
        unitId: form.value.unitId || null,
        nickname: (form.value.nickname ?? '').trim() 
      }, authHeader())
    }

    // ¿Cambió la novedad?
    const novChanged =
      String(editing.value.status||'') !== String(form.value.state||'') ||
      String(editing.value.municipalityId||'') !== String(form.value.municipalityId||'') ||
      (editing.value.novelty_start||'') !== (form.value.novelty_start||'') ||
      (editing.value.novelty_end||'')   !== (form.value.novelty_end||'') ||
      (editing.value.novelty_description||'') !== (form.value.novelty_description||'')

    if (novChanged) {
      const state = String(form.value.state || '').toUpperCase()
      const isHosp = state === 'HOSPITALIZADO'
      const requiresDates = (s) => s === 'SERVICIO' || otrosRequierenFechas.includes(s)

      // municipalityId: number o se omite
      let municipalityId = null
      if (state === 'COMISIÓN DEL SERVICIO') {
        municipalityId = form.value.municipalityId ? Number(form.value.municipalityId) : null
      } else if (state === 'SERVICIO' || state === 'SIN NOVEDAD') {
        municipalityId = 11001
      }

      // Fechas y descripción (solo agrega si aplica y hay valor)
      const payload = {
        date: today.value,
        state
      }

      if (municipalityId !== null) payload.municipalityId = municipalityId

      const start = (requiresDates(state) || isHosp) ? (form.value.novelty_start || '').trim() : ''
      const end   =  requiresDates(state)            ? (form.value.novelty_end   || '').trim() : ''
      const descNeeded = (state === 'COMISIÓN DEL SERVICIO') || (state === 'SERVICIO') || requiresDates(state) || isHosp
      const desc  = descNeeded ? (form.value.novelty_description || '').trim() : ''

      if (start) payload.novelty_start = start
      if (end && !isHosp) payload.novelty_end = end   // 👈 nunca para HOSPITALIZADO
      if (desc) payload.novelty_description = desc

      // Debug útil: ver exactamente qué enviamos
      console.log('[PUT] /admin/agents/:id/novelty payload →', payload)

      await axios.put(`/admin/agents/${id}/novelty`, payload, authHeader())
    }


    msg.value = 'Cambios guardados ✅'
    closeEdit()
    await loadAgents()

  } catch (e) {
        const data = e?.response?.data
        console.error('saveEdit error →', {
          status: e?.response?.status,
          data,
          payloadHint: {
            state: form.value.state,
            municipalityId: form.value.municipalityId,
            start: form.value.novelty_start,
            end: form.value.novelty_end,
          }
        })
        msg.value = data?.detail || data?.error || e?.message || 'Error al guardar'
      }

}



function authHeader(){
  return { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }
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
