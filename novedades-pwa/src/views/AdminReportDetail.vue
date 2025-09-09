<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold text-lg sm:text-2xl">
          {{ isGroupMode ? 'Detalle de reporte del grupo' : 'Detalle de reporte de unidad' }}
        </h1>
        <button @click="router.back()" class="btn-ghost">Volver</button>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-2 sm:px-4 py-6 space-y-4">
      <div v-if="loading" class="text-center py-12 text-brand-700 font-semibold">Cargando...</div>
      <div v-else-if="!headerOk" class="text-center py-12 text-red-500">No se encontró información para los parámetros.</div>

      <template v-else>
        <!-- Encabezado -->
        <div class="card">
          <div class="card-body">
            <div class="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-6 items-center text-base sm:text-lg">
              <div><b>Grupo:</b> <span class="text-brand-700">{{ head.groupCode || '—' }}</span></div>
              <div v-if="!isGroupMode"><b>Unidad:</b> <span class="text-brand-700">{{ head.unitName || 'N/A' }}</span></div>
              <div><b>Fecha:</b> {{ head.date }}</div>
              <div v-if="isGroupMode && unitsInGroup.length" class="flex items-center gap-2">
                <b>Unidades:</b> <span class="text-slate-700">{{ unitsInGroup.length }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="card">
          <div class="card-body">
            <div class="grid grid-cols-1 sm:grid-cols-6 gap-2 sm:items-end">
              <div>
                <label class="label">Búsqueda</label>
                <input v-model="filters.q" class="input" placeholder="Código o texto…" />
              </div>
              <div>
                <label class="label">Categoría</label>
                <select v-model="filters.category" class="input">
                  <option value="ALL">Todas</option>
                  <option value="OF">OF</option>
                  <option value="SO">ME</option>
                  <option value="PT">PT</option>
                </select>
              </div>
              <div>
                <label class="label">Estado</label>
                <select v-model="filters.state" class="input">
                  <option value="ALL">Todos</option>
                  <option v-for="s in estadosValidos" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
              <div v-if="isGroupMode">
                <label class="label">Unidad</label>
                <select v-model="filters.unitId" class="input">
                  <option value="ALL">Todas</option>
                  <option v-for="u in unitsInGroup" :key="u.id" :value="String(u.id)">
                    {{ u.name }}
                  </option>
                </select>
              </div>
              <div class="flex items-center gap-2 mt-2 sm:mt-0">
                <input id="solo-nov" type="checkbox" v-model="filters.onlyNovelties" class="h-4 w-4" />
                <label class="label cursor-pointer" for="solo-nov">Solo novedades</label>
              </div>
              <div class="flex gap-2">
                <button class="btn-primary flex-1 sm:flex-none" @click="reload">Aplicar</button>
                <button class="btn-ghost flex-1 sm:flex-none" @click="exportarExcel">Exportar</button>
              </div>
            </div>

            <!-- Resumen por estado -->
            <div class="mt-4 flex flex-wrap gap-2">
              <span v-for="chip in resumenChips" :key="chip.key"
                    class="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm"
                    :class="chip.cls">
                <span class="inline-block w-2.5 h-2.5 rounded-full" :class="chip.dot"></span>
                {{ chip.label }}: <b>{{ chip.count }}</b>
              </span>
            </div>
          </div>
        </div>

        <!-- Tabla -->
        <div class="card">
          <div class="card-body overflow-x-auto p-0">
            <table class="table min-w-full text-xs sm:text-sm">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Categoría</th>
                  <th v-if="isGroupMode">Unidad</th>
                  <th>Estado</th>
                  <th>Ubicación</th>
                  <th>Descripción</th>
                  <th>Novedad (inicio - fin)</th>
                  <th v-if="canEdit" style="width: 56px">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in agentesFiltrados" :key="a._key">
                  <td class="font-medium text-slate-900">{{ a.code }}</td>
                  <td>{{ displayCat(a.category) }}</td>
                  <td v-if="isGroupMode"><span class="text-slate-700">{{ a.unitName || '—' }}</span></td>
                  <td>
                    <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border"
                          :class="badgeClass(a.state)">
                      {{ a.state }}
                    </span>
                  </td>
                  <td>{{ a.municipality || 'N/A' }}</td>
                  <td>{{ a.novelty_description || '—' }}</td>
                  <td>
                    <template v-if="a.novelty_start && a.novelty_end">
                      {{ formatDate(a.novelty_start) }} – {{ formatDate(a.novelty_end) }}
                    </template>
                    <template v-else-if="a.novelty_start">
                      {{ formatDate(a.novelty_start) }}
                    </template>
                    <template v-else>
                      <span class="text-slate-300">—</span>
                    </template>
                  </td>
                  <td v-if="canEdit" class="text-right">
                    <button class="icon-btn" title="Editar" @click="openEdit(a)">
                      <!-- Lápiz -->
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L8.5 18.1a2 2 0 0 1-.9.5l-4 1a1 1 0 0 1-1.2-1.2l1-4a2 2 0 0 1 .5-.9Z"/>
                        <path d="m15 5 4 4"/>
                      </svg>
                    </button>
                  </td>
                </tr>
                <tr v-if="!agentesFiltrados.length">
                  <td :colspan="canEdit ? (isGroupMode ? 8 : 7) : (isGroupMode ? 7 : 6)"
                      class="text-center text-slate-500 py-6">Sin agentes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal edición -->
        <div v-if="editOpen" class="modal-backdrop" @click.self="closeEdit">
          <div class="modal">
            <div class="modal-header">
              <h3 class="font-semibold text-slate-800">Editar agente {{ editRow?.code }}</h3>
              <button class="btn-ghost" @click="closeEdit">Cerrar</button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="label">Estado</label>
                <select v-model="form.state" class="input">
                  <option v-for="s in estadosValidos" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>

              <!-- Autocomplete municipio (solo para Comisión del servicio) -->
              <div v-if="needsMunicipio" class="sm:col-span-2">
                <label class="label">Municipio</label>
                <Multiselect
                  v-model="form.municipio"
                  :options="muniOptions"
                  :loading="muniLoading"
                  :internal-search="false"
                  :clear-on-select="true"
                  :close-on-select="true"
                  :preserve-search="true"
                  :show-labels="false"
                  placeholder="Escribe para buscar…"
                  label="label"
                  track-by="id"
                  @search-change="searchMunicipios"
                  class="w-full"
                >
                  <template #noResult>Ningún municipio encontrado</template>
                  <template #option="{ option }">
                    <div class="flex items-center justify-between w-full">
                      <span>{{ option.label }}</span>
                      <span class="text-xs text-slate-400">id: {{ option.id }}</span>
                    </div>
                  </template>
                  <template #singleLabel="{ option }">
                    <span>{{ option.label }}</span>
                  </template>
                </Multiselect>
                <div class="text-xs text-slate-500 mt-1">Requerido para Comisión del servicio.</div>
              </div>

              <!-- Fechas + descripción según estado -->
              <div v-if="needsFechas" class="sm:col-span-1">
                <label class="label">Inicio</label>
                <input v-model="form.novelty_start" type="date" class="input" />
              </div>
              <div v-if="needsFechas" class="sm:col-span-1">
                <label class="label">Fin</label>
                <input v-model="form.novelty_end" type="date" class="input" />
              </div>
              <div v-if="needsDescripcion" class="sm:col-span-3">
                <label class="label">Descripción</label>
                <textarea v-model="form.novelty_description" class="input" rows="2" placeholder="Motivo / detalle..."></textarea>
              </div>

              <!-- Nota para SERVICIO -->
              <div v-if="form.state === 'SERVICIO'" class="sm:col-span-3 text-xs text-slate-500">
                Para “SERVICIO” el municipio se fija automáticamente en Bogotá (11001).
              </div>
            </div>

            <div class="mt-4 flex justify-end gap-2">
              <button class="btn-ghost" @click="closeEdit">Cancelar</button>
              <button class="btn-primary" @click="saveEdit" :disabled="saving">
                {{ saving ? 'Guardando...' : 'Guardar cambios' }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>



<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.css'

const route = useRoute()
const router = useRouter()

const BOGOTA_DC = {
  id: 11001,
  name: 'BOGOTÁ, D.C.',
  dept: 'BOGOTÁ, D.C.',
  label() { return `${this.name} (${this.dept})` }
}

// ===== user (permisos)
const me = ref(null)
async function loadMe() {
  try {
    const { data } = await axios.get('/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
    me.value = data
  } catch { me.value = null }
}
const canEdit = computed(() => {
  const r = String(me.value?.role || '').toLowerCase()
  return ['leader_group','superadmin','supervision','supervisor'].includes(r)
})

// ===== Parámetros
const reportId   = computed(() => route.params.id ? String(route.params.id) : null)
const dateParam  = computed(() => route.query.date ? String(route.query.date) : new Date().toISOString().slice(0,10))
const groupIdQ   = computed(() => route.query.groupId ? String(route.query.groupId) : null)
const isGroupMode = computed(() => !!groupIdQ.value)
const loading   = ref(true)

// ===== Estado UI
const head = ref({ groupCode:'', unitName:'', date:'—' })
const headerOk = ref(false)
const agentes = ref([])        // plano
const unitsInGroup = ref([])   // para selector unidad

// ===== Filtros
const filtrosBase = { q:'', category:'ALL', state:'ALL', unitId:'ALL', onlyNovelties:false }
const filters = ref({ ...filtrosBase })

// ===== Dominio
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
  'PERMISO',
  'COMISIÓN EN EL EXTERIOR'
]

// ===== Helpers
function formatDate(dateStr) {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }
  const d = new Date(dateStr)
  if (isNaN(d)) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}


function displayCat(cat) {
  const c = String(cat || '').toUpperCase()
  return c === 'SO' ? 'ME' : cat
}

//ORDENAR OF ME PT

const categoryOrder = { OF: 1, SO: 2, PT: 3 }

function categorySort(cat) {
  const c = String(cat || '').toUpperCase()
  return categoryOrder[c] || 99
}


function badgeClass(state){
  const s = String(state || '').toUpperCase()
  if (s === 'SIN NOVEDAD') return 'bg-green-50 text-green-700 border-green-200'
  if (s === 'SERVICIO' || s === 'COMISIÓN DEL SERVICIO') return 'bg-sky-50 text-sky-700 border-sky-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

// ===== Carga
async function loadSingleReport(id){
  const { data: ags } = await axios.get(`/admin/report-agents/${id}`, {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  const map = (row) => ({
    ...row,
    _key: `${row.code}-${row.unitName||''}-${row.state}-${row.novelty_start||''}-${row.novelty_end||''}`,
    municipality: row.municipalityName && row.dept ? `${row.municipalityName} (${row.dept})` : (row.municipalityName || ''),
    municipalityName: row.municipalityName || null,
    municipalityDept: row.dept || null,
    municipalityId: row.municipalityId ?? null,         // 👈 usa esto si el backend lo devuelve
    novelty_description: row.novelty_description || row.descripcion,
    reportId: id
  })
  const list = (Array.isArray(ags) ? ags : []).map(map)
  agentes.value = list
  const first = list[0]
  head.value = { groupCode: first?.groupCode || '', unitName: first?.unitName || '', date: dateParam.value }
  headerOk.value = true
}

async function loadGroupReports(date, groupId){
  const { data } = await axios.get('/dashboard/reports', {
    params: { date_from: date, date_to: date, groupId },
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  const items = Array.isArray(data?.items) ? data.items : []
  if (!items.length) { headerOk.value = false; return }

  head.value = { groupCode: items[0].groupCode, unitName: '', date }
  unitsInGroup.value = [...new Map(items.map(r => [String(r.unitName||''), { id: r.unitId, name: r.unitName }])).values()]
                      .filter(u => !!u.id)
                      .sort((a,b)=> (a.name||'').localeCompare(b.name||''))

  const all = []
  for (const r of items) {
    const { data: ags } = await axios.get(`/admin/report-agents/${r.id}`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    const list = (Array.isArray(ags) ? ags : []).map(a => ({
      ...a,
      _key: `${a.code}-${a.unitName||''}-${a.state}-${a.novelty_start||''}-${a.novelty_end||''}`,
      municipality: a.municipalityName && a.dept ? `${a.municipalityName} (${a.dept})` : (a.municipalityName || ''),
      municipalityName: a.municipalityName || null,
      municipalityDept: a.dept || null,
      municipalityId: a.municipalityId ?? null,         // 👈 usa esto si el backend lo devuelve
      novelty_description: a.novelty_description || a.descripcion,
      reportId: r.id
    }))
    all.push(...list)
  }
  agentes.value = all
  headerOk.value = true
}

// ===== Filtrado
const agentesFiltrados = computed(() => {
  let list = agentes.value.slice()
  const q = filters.value.q.trim().toUpperCase()
  if (q) {
    list = list.filter(a =>
      String(a.code||'').toUpperCase().includes(q) ||
      String(a.novelty_description||'').toUpperCase().includes(q) ||
      String(a.unitName||'').toUpperCase().includes(q)
    )
  }
  if (filters.value.category !== 'ALL') list = list.filter(a => String(a.category) === filters.value.category)
  if (filters.value.state !== 'ALL')    list = list.filter(a => String(a.state).toUpperCase() === filters.value.state)
  if (filters.value.onlyNovelties)      list = list.filter(a => String(a.state).toUpperCase() !== 'SIN NOVEDAD')
  if (isGroupMode.value && filters.value.unitId !== 'ALL') {
    const uName = unitsInGroup.value.find(u => String(u.id) === String(filters.value.unitId))?.name || ''
    list = list.filter(a => String(a.unitName||'') === uName)
  }

  // 👇 orden personalizado por categoría
  return list.sort((a, b) => {
    const ca = categorySort(a.category)
    const cb = categorySort(b.category)
    if (ca !== cb) return ca - cb
    return String(a.code).localeCompare(String(b.code)) // desempate por código
  })
})


// Resumen chips
const resumenChips = computed(() => {
  const cnt = { 'SIN NOVEDAD':0, 'SERVICIO':0, 'COMISIÓN DEL SERVICIO':0, otros:0 }
  for (const a of agentesFiltrados.value) {
    const s = String(a.state).toUpperCase()
    if (s === 'SIN NOVEDAD') cnt['SIN NOVEDAD']++
    else if (s === 'SERVICIO') cnt['SERVICIO']++
    else if (s === 'COMISIÓN DEL SERVICIO') cnt['COMISIÓN DEL SERVICIO']++
    else cnt.otros++
  }
  return [
    { key:'sn',  label:'Sin novedad',            count:cnt['SIN NOVEDAD'],            cls:'bg-green-50 text-green-700 border-green-200', dot:'bg-green-600' },
    { key:'srv', label:'Servicio',               count:cnt['SERVICIO'],               cls:'bg-sky-50 text-sky-700 border-sky-200',       dot:'bg-sky-600' },
    { key:'cds', label:'Comisión del servicio',  count:cnt['COMISIÓN DEL SERVICIO'],  cls:'bg-sky-50 text-sky-700 border-sky-200',       dot:'bg-sky-600' },
    { key:'oth', label:'Otros',                  count:cnt.otros,                     cls:'bg-amber-50 text-amber-800 border-amber-200', dot:'bg-amber-600' }
  ]
})

// ===== Modal edición
const editOpen = ref(false)
const editRow  = ref(null)
const saving   = ref(false)
const form     = ref({
  state:'SIN NOVEDAD',
  municipio: null,              // {id,label}
  novelty_start:'',
  novelty_end:'',
  novelty_description:''
})
const needsMunicipio   = computed(() => form.value.state === 'COMISIÓN DEL SERVICIO')
const needsFechas      = computed(() => ['SERVICIO','VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO','LICENCIA REMUNERADA','LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO','LICENCIA PATERNIDAD', 'PERMISO','COMISIÓN EN EL EXTERIOR' ].includes(form.value.state))
const needsDescripcion = computed(() => ['SERVICIO','VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO','LICENCIA REMUNERADA','LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO','LICENCIA PATERNIDAD', 'PERMISO','COMISIÓN EN EL EXTERIOR'].includes(form.value.state))

function openEdit(a){
  if (!canEdit.value) return
  editRow.value = a
  form.value = {
    state: a.state,
    municipio: a.municipalityId
      ? { id: a.municipalityId, label: a.municipalityName ? `${a.municipalityName} (${a.municipalityDept||''})` : `id ${a.municipalityId}` }
      : null,
    novelty_start: a.novelty_start || '',
    novelty_end: a.novelty_end || '',
    novelty_description: a.novelty_description || ''
  }
  editOpen.value = true
}
function closeEdit(){ editOpen.value = false; editRow.value = null }

// ===== Autocomplete municipios
const muniOptions = ref([])
const muniLoading = ref(false)
let muniTimer = null
async function searchMunicipios(term){
  if (muniTimer) clearTimeout(muniTimer)
  muniTimer = setTimeout(async () => {
    const q = String(term || '').trim()
    if (q.length < 2) { muniOptions.value = []; return }
    muniLoading.value = true
    try {
      const { data } = await axios.get('/catalogs/municipalities', {
        params: { q, limit: 15 },
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      muniOptions.value = (data || []).map(m => ({
        id: m.id,
        label: `${m.name} (${m.dept})`
      }))
    } catch {
      muniOptions.value = []
    } finally {
      muniLoading.value = false
    }
  }, 250)
}

// ===== Guardar
// ===== Guardar
async function saveEdit(){
  if (!editRow.value) return

  // Validaciones mínimas (igual que ya tenías)...
  if (form.value.state === 'COMISIÓN DEL SERVICIO' && !form.value.municipio?.id) {
    alert('Selecciona un municipio para Comisión del servicio')
    return
  }
  if (needsFechas.value) {
    if (!form.value.novelty_start || !form.value.novelty_end) {
      alert('Completa las fechas de la novedad')
      return
    }
  }
  if (needsDescripcion.value && !form.value.novelty_description?.trim()) {
    alert('La descripción es requerida para este estado')
    return
  }

  saving.value = true
  try {
    await axios.put(`/admin/report-agents/${editRow.value.reportId}/${editRow.value.agentId}`, {
      state: form.value.state,
      municipalityId:
        form.value.state === 'COMISIÓN DEL SERVICIO'
          ? (form.value.municipio?.id || null)
          : (['SERVICIO','SIN NOVEDAD'].includes(form.value.state) ? BOGOTA_DC.id : null),
      novelty_start: form.value.novelty_start || null,
      novelty_end: form.value.novelty_end || null,
      novelty_description: form.value.novelty_description || null
    }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })

    // 🔄 Refleja el cambio en la tabla SIN hardcodear "Bogotá (Cundinamarca)"
    let mId = null, mName = null, mDept = null, mLabel = ''

    if (form.value.state === 'COMISIÓN DEL SERVICIO') {
      mId = form.value.municipio?.id || null
      if (form.value.municipio?.label) {
        // label: "Nombre (Depto)"
        const parts = form.value.municipio.label.split(' (')
        mName = parts[0] || null
        mDept = parts[1] ? parts[1].replace(/\)$/, '') : null
        mLabel = form.value.municipio.label
      }
    } else if (['SERVICIO','SIN NOVEDAD'].includes(form.value.state)) {
      // En backend se fija a 11001; aquí mostramos el MISMO texto que hay en BD
      mId = BOGOTA_DC.id
      mName = BOGOTA_DC.name
      mDept = BOGOTA_DC.dept
      mLabel = BOGOTA_DC.label()
    } else {
      // Otros estados: municipio NULL
      mId = null
      mName = null
      mDept = null
      mLabel = ''
    }

    Object.assign(editRow.value, {
      state: form.value.state,
      municipalityId: mId,
      municipalityName: mName,
      municipalityDept: mDept,
      municipality: mLabel || (mName ? `${mName} (${mDept||''})` : 'N/A'),
      novelty_start: form.value.novelty_start || null,
      novelty_end: form.value.novelty_end || null,
      novelty_description: form.value.novelty_description || null
    })

    closeEdit()
  } catch (e) {
    alert(e?.response?.data?.detail || e?.response?.data?.error || 'No se pudo guardar')
  } finally {
    saving.value = false
  }
}


// ===== Acciones varias
async function reload(){ /* filtrado es client-side */ }

async function exportarExcel(){
  const rows = agentesFiltrados.value.map(a => ({
    codigo: a.code,
    categoria: a.category,
    unidad: a.unitName || '',
    estado: a.state,
    ubicacion: a.municipality || '',
    descripcion: a.novelty_description || '',
    fecha_inicio: a.novelty_start ? String(a.novelty_start).slice(0,10) : '',
    fecha_fin: a.novelty_end ? String(a.novelty_end).slice(0,10) : ''
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Detalle')
  const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' })
  saveAs(new Blob([wbout], { type:'application/octet-stream' }), `detalle_${head.value.groupCode}_${head.value.date}.xlsx`)
}

// ===== Init
onMounted(async () => {
  loading.value = true
  await loadMe()
  try {
    if (isGroupMode.value) {
      await loadGroupReports(dateParam.value, groupIdQ.value)
    } else if (reportId.value) {
      await loadSingleReport(reportId.value)
    } else {
      headerOk.value = false
    }
  } catch {
    headerOk.value = false
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.input { @apply w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500; }
.btn-ghost { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100; }
.btn-primary { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700; }
.card { @apply bg-white rounded-xl shadow; }
.card-body { @apply p-4; }
.table { min-width: 780px; }

/* Botón icono */
.icon-btn{
  @apply inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700;
  width: 32px; height: 32px;
}
.icon-btn:hover{ @apply bg-slate-100; }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.35); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
.modal { width: 100%; max-width: 720px; background: white; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.25); padding: 16px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }

@media (max-width: 640px) {
  .card-body { padding: 1rem !important; }
  .table th, .table td { padding: 6px 4px !important; font-size: 12px !important; }
}
</style>
