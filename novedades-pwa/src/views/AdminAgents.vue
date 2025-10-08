<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <!-- Encabezado -->
    <div class="card-body flex items-center justify-between">
        <h1 class="font-semibold text-slate-800">Listado de agentes</h1>
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
                <th>Agente</th>
                <th>Cat.</th>
                <th>Grupo</th>
                <th>Unidad</th>
                <th>Días Lab</th>
                <th v-if="isEditableRole" style="text-align: center">Acciones</th>
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
                  <span
                    :class="[
                      'inline-block min-w-[2.5em] text-center rounded px-1',
                      a.current_streak >= 45
                        ? 'bg-red-100 text-red-600 font-bold border border-red-200'
                        : a.current_streak >= 30
                          ? 'bg-orange-100 text-orange-700 font-semibold border border-orange-200'
                          : a.current_streak > 0
                            ? 'bg-green-50 text-green-700 font-semibold border border-green-200'
                            : 'text-slate-400'
                    ]"
                    :title="a.current_streak >= 45
                      ? '¡Alerta! Racha extremadamente prolongada'
                      : a.current_streak >= 30
                        ? 'Racha prolongada: recomienda revisión'
                        : 'Días consecutivos en servicio o sin novedad'"
                  >
                    {{ a.current_streak ?? 0 }}
                  </span>
                </td>

                <td class="text-center">
                  <button v-if="isEditableRole" class="btn-ghost p-1" title="Editar" @click="openEdit(a)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 2a2.828 2.828 0 0 1 4 4L7 21l-4 1 1-4Z"></path><path d="m16 5 3 3"></path>
                    </svg>
                  </button>
                  <button v-if="isSuperadmin" class="btn-ghost p-1" title="Eliminar" @click="requestDelete(a)">
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

    <!-- Modal -->
    <div v-if="editing" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" @click="closeEdit"></div>

      <!-- Card -->
      <form
        class="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[90vh]"
        @submit.prevent="saveEdit"
      >
        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800">
            {{ isCreating ? 'Crear agente' : 'Editar agente' }}
          </h3>
          <button type="button" class="btn-ghost" @click="closeEdit">✕</button>
        </div>

        <!-- Body -->
        <div class="p-5 overflow-auto">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="label">Código</label>
              <input class="input" v-model="form.code" :disabled="!isSuperadmin && isCreating" placeholder="EJ: A123" />
              <p class="text-[11px] text-slate-500 mt-1">Formato: LETRA + números</p>
            </div>

            <div>
              <label class="label">Nickname</label>
              <input class="input" v-model="form.nickname" maxlength="120" placeholder="Apodo del agente" />
            </div>

            <div>
              <label class="label">Categoría</label>
              <select class="input" v-model="form.categoryUi" :disabled="!isSuperadmin">
                <option value="OF">OF</option>
                <option value="ME">ME</option>
                <option value="PT">PT</option>
              </select>
            </div>

            <div>
              <label class="label">Grupo</label>
              <select class="input" v-model="form.groupId">
                <option :value="null">Sin grupo</option>
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.code }}</option>
              </select>
            </div>

            <div>
              <label class="label">Unidad</label>
              <select class="input" v-model="form.unitId">
                <option :value="null">Sin unidad</option>
                <option v-for="u in unitsForSelect" :key="u.id" :value="u.id">{{ u.name }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button type="button" class="btn-ghost" @click="closeEdit">Cancelar</button>

          <!-- Guardar SIEMPRE visible cuando tienes permiso para la acción -->
          <button
            v-if="canShowSave"
            type="submit"
            class="btn-primary"
            :disabled="!canSubmit"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  </div>
  <!-- Toasts -->
  <div class="fixed inset-x-0 top-3 z-[9999] flex justify-center pointer-events-none">
    <div class="w-full max-w-md space-y-2 px-3">
      <div v-for="t in toasts" :key="t.id"
          class="pointer-events-auto rounded-xl border p-3 shadow-lg
                  bg-white"
          :class="{
            'border-emerald-300': t.type==='success',
            'border-red-300'   : t.type==='error',
            'border-slate-200' : t.type==='info'
          }">
        <div class="flex items-start gap-2">
          <div class="text-lg leading-none">
            <span v-if="t.type==='success'">✅</span>
            <span v-else-if="t.type==='error'">⚠️</span>
            <span v-else>ℹ️</span>
          </div>
          <div class="flex-1">
            <div class="font-medium text-slate-800">{{ t.title }}</div>
            <div v-if="t.desc" class="text-sm text-slate-600 mt-0.5">{{ t.desc }}</div>
          </div>
          <button class="text-slate-500 hover:text-slate-800" @click="closeToast(t.id)">✕</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal Confirmar Eliminación -->
  <div
    v-if="pendingDelete"
    class="fixed inset-0 z-[9998] flex items-center justify-center"
    @keydown.esc="cancelDelete"
  >
    <div class="absolute inset-0 bg-black/40" @click="cancelDelete"></div>

    <div class="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-5">
      <h3 class="font-semibold text-slate-800 text-lg">Eliminar agente</h3>
      <p class="text-slate-600 mt-2">
        ¿Seguro que deseas eliminar al agente <b>{{ pendingDelete.code }}</b>?
        Esta acción no se puede deshacer.
      </p>

      <div class="mt-4 flex justify-end gap-2">
        <button class="btn-ghost" @click="cancelDelete" :disabled="deleting">Cancelar</button>
        <button
          class="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          @click="confirmDelete"
          :disabled="deleting"
        >
          <span v-if="!deleting">Sí, eliminar</span>
          <span v-else>Eliminando…</span>
        </button>
      </div>
    </div>
  </div>


</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

// Confirmación borrar
const pendingDelete = ref(null)
const deleting = ref(false)

function requestDelete(a) {
  pendingDelete.value = { id: a.id, code: a.code }
}

function cancelDelete() {
  if (deleting.value) return
  pendingDelete.value = null
}

async function confirmDelete() {
  if (!pendingDelete.value || deleting.value) return
  deleting.value = true
  try {
    const id = pendingDelete.value.id
    await axios.delete(`/admin/agents/${id}`, authHeader())
    toast?.({ type:'success', title:'Agente eliminado', desc: pendingDelete.value.code })
    await loadAgents()
  } catch (e) {
    const detail = e?.response?.data?.detail || e?.response?.data?.error || e?.message || 'Error al eliminar'
    toast?.({ type:'error', title:'No se pudo eliminar', desc: detail })
  } finally {
    deleting.value = false
    pendingDelete.value = null
  }
}


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

async function loadAgents() {
  msg.value = ''
  try {
    if (isAdminLike.value || isLeaderGroup.value) {
      // Siempre usa server-side para ambos roles
      const params = {
        page: page.value,
        pageSize: pageSize.value
      }
      // Solo admins pueden filtrar por grupo (líder ve solo su grupo, el backend lo filtra)
      if (isAdminLike.value && filters.value.groupId !== 'ALL')
        params.groupId = Number(filters.value.groupId)
      if (filters.value.q && filters.value.q.trim())
        params.q = String(filters.value.q).trim()
      if (filters.value.cat !== 'ALL')
        params.category = filters.value.cat === 'ME' ? 'SO' : filters.value.cat

      const { data } = await axios.get('/admin/agents-streaks', {
        params: {
          ...params,
          date: today.value // <-- Agrega la fecha seleccionada
        },
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })


      items.value = normalizeAgents(data?.items || [])
      total.value = Number(data?.total || 0)

    } else {
      // Otros roles (si aplican, aquí vacía)
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
    id: a.id ?? a.agentId,        // Usa id si existe, si no agentId
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
      loadAgents()
    }, 300)
  }
})()

// Filtrado + orden (solo para líder de grupo; admin/supervisión ya filtran en backend)
const itemsFiltradosOrdenados = computed(() => {
  // Todos los roles: confiar en backend (ya viene filtrado/paginado); solo ordenamos por estética si quieres
  const arr = items.value.slice()
  const order = { 'OF':1, 'SO':2, 'PT':3 }
  arr.sort((a,b) => {
    const ca = order[String(a.category).toUpperCase()] || 9
    const cb = order[String(b.category).toUpperCase()] || 9
    if (ca !== cb) return ca - cb
    return String(a.code).localeCompare(String(b.code))
  })
  return arr
})

const itemsPagina = computed(() => {
  // Ya está paginado por backend, simplemente retorna los items
  return itemsFiltradosOrdenados.value
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

/* ===== Modal edición (solo tabla agent) ===== */
const isEditableRole = computed(() => !!(isSuperadmin.value || isAdminLike.value)) // excluye leader_group

const canShowSave = computed(() => {
  // Crear: solo Superadmin
  if (isCreating.value) return !!isSuperadmin.value
  // Editar: Admin/Supervisión o Líder de grupo
  return !!(isAdminLike.value || isLeaderGroup.value)
})

// Validación mínima para habilitar "Guardar"
const canSubmit = computed(() => {
  const codeOk = /^[A-Z][0-9]+$/.test(String(form.value.code || '').trim())
  const catOk  = ['OF','ME','PT'].includes(String(form.value.categoryUi))
  // Crear requiere superadmin + code válido
  if (isCreating.value) return isSuperadmin.value && codeOk && catOk
  // Editar: con code válido (aunque no lo cambies) + categoría válida
  return codeOk && catOk
})

const isCreating = ref(false)
const editing = ref(null) // fila original cargada del backend
const form = ref({
  id: null,
  code: '',
  categoryUi: 'OF',   // UI: OF/ME/PT
  groupId: null,
  unitId: null,
  nickname: ''
})

function openCreate () {
  isCreating.value = true
  editing.value = { id: null } // muestra el modal en modo crear
  form.value = {
    id: null,
    code: '',
    categoryUi: 'OF',
    groupId: null,
    unitId: null,
    nickname: '' // 👈 evita usar a.nickname (no existe aquí)
  }
}

async function openEdit (a) {
  editing.value = null
  try {
    // Siempre pide el objeto REAL del backend
    const { data } = await axios.get(`/admin/agents/${a.id}`, authHeader())

    form.value = {
      id: data.id,
      code: data.code,
      categoryUi: catLabel(data.category), // OF/ME/PT
      groupId: data.groupId ?? null,
      unitId: data.unitId ?? null,
      nickname: data.nickname || ''
    }

    editing.value = data
  } catch (e) {
    msg.value = e?.response?.data?.detail || e?.message || 'No se pudo cargar el agente'
  }

  // ❌ Quitado: onStateChange(true) y cualquier lógica de novedad
}

function closeEdit () {
  editing.value = null
  isCreating.value = false
}

async function saveEdit () {
  msg.value = ''
  const id = form.value.id

  try {
    // === Crear (solo superadmin) ===
    if (isCreating.value) {
      if (!isSuperadmin.value) { msg.value = 'No autorizado'; return }

      const code = String(form.value.code || '').toUpperCase().trim()
      if (!/^[A-Z][0-9]+$/.test(code)) {
        msg.value = 'Código inválido (LETRA+números)'
        return
      }

      await axios.post('/admin/agents', {
        code,
        category: uiToApiCategory(form.value.categoryUi), // OF/ME/PT -> API
        groupId: form.value.groupId || null,
        unitId: form.value.unitId || null,
        nickname: (form.value.nickname || '').trim() || null
      }, authHeader())

      msg.value = 'Agente creado ✅'
      toast({ type:'success', title:'Agente creado', desc:`${form.value.code} guardado.` })
      closeEdit()
      await loadAgents()
      return;
    }

    // === Editar: SOLO campos de agent ===
    if (isLeaderGroup.value) {
      // Líder de grupo: solo mover de unidad (si cambió)
      if ((editing.value.unitId || null) !== (form.value.unitId || null)) {
        await axios.put(
          `/my/agents/${id}/unit`,
          { unitId: form.value.unitId || null },
          authHeader()
        )
      }
    } else if (isAdminLike.value) {
      // Admin/supervisión: code/category (si superadmin), groupId, unitId, nickname
      const payload = {
        // Solo superadmin puede cambiar code/category
        code: isSuperadmin.value ? String(form.value.code || '').toUpperCase().trim() : undefined,
        category: isSuperadmin.value ? uiToApiCategory(form.value.categoryUi) : undefined,
        groupId: form.value.groupId || null,
        unitId: form.value.unitId || null,
        nickname: (form.value.nickname ?? '').trim() || null
      }

      // Limpia undefined para no enviar claves vacías
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

      await axios.put(`/admin/agents/${id}`, payload, authHeader())
    }

    msg.value = 'Cambios guardados ✅'
    toast({ type:'success', title:'Agente actualizado', desc:`${form.value.code} actualizado.` })
    closeEdit()
    await loadAgents()
  } catch (e) {
    const data = e?.response?.data
    console.error('saveEdit error →', {
      status: e?.response?.status,
      data
    })
    toast({ type:'error', title:'No se pudo guardar', desc: msg.value })
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
watch(today, () => {
  page.value = 1
  loadAgents()
})

// TOASTS
const toasts = ref([]) // {id, type: 'success'|'error'|'info', title, desc}
let toastSeq = 0

function toast({ type = 'info', title = '', desc = '', timeout = 4000 } = {}) {
  const id = ++toastSeq
  toasts.value.push({ id, type, title, desc })
  if (timeout) setTimeout(() => closeToast(id), timeout)
}
function closeToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
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
