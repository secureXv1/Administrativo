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
      <!-- Loading / Empty -->
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
                  <option value="SO">SO</option>
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
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in agentesFiltrados" :key="a._key">
                  <td class="font-medium text-slate-900">{{ a.code }}</td>
                  <td>{{ a.category }}</td>
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
                </tr>
                <tr v-if="!agentesFiltrados.length">
                  <td :colspan="isGroupMode ? 7 : 6" class="text-center text-slate-500 py-6">Sin agentes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

const route = useRoute()
const router = useRouter()

// ===== Parámetros
const reportId   = computed(() => route.params.id ? String(route.params.id) : null)
const dateParam  = computed(() => route.query.date ? String(route.query.date) : new Date().toISOString().slice(0,10))
const groupIdQ   = computed(() => route.query.groupId ? String(route.query.groupId) : null)
const isGroupMode = computed(() => !!groupIdQ.value)   // admin/supervisor
const loading   = ref(true)

// ===== Estado UI
const head = ref({ groupCode:'', unitName:'', date:'—' })
const headerOk = ref(false)
const agentes = ref([])        // plano, viene de 1..n reportes
const unitsInGroup = ref([])   // para selector de unidad (modo grupo)

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
  'LICENCIA PATERNIDAD'
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

function badgeClass(state){
  const s = String(state || '').toUpperCase()
  if (s === 'SIN NOVEDAD') return 'bg-green-50 text-green-700 border-green-200'
  if (s === 'SERVICIO' || s === 'COMISIÓN DEL SERVICIO') return 'bg-sky-50 text-sky-700 border-sky-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

// ===== Carga
async function loadSingleReport(id){
  // Trae agentes del detalle
  const { data: ags } = await axios.get(`/admin/report-agents/${id}`, {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  const map = (row) => ({
    ...row,
    _key: `${row.code}-${row.unitName||''}-${row.state}-${row.novelty_start||''}-${row.novelty_end||''}`,
    municipality: row.municipalityName && row.dept ? `${row.municipalityName} (${row.dept})` : (row.municipalityName || ''),
    novelty_description: row.novelty_description || row.descripcion
  })
  const list = (Array.isArray(ags) ? ags : []).map(map)
  agentes.value = list
  // Encabezado
  const first = list[0]
  head.value = {
    groupCode: first?.groupCode || '',
    unitName : first?.unitName || '',
    date     : dateParam.value
  }
  headerOk.value = true
}

async function loadGroupReports(date, groupId){
  // 1) Lista de reportes (uno por unidad)
  const { data } = await axios.get('/dashboard/reports', {
    params: { date_from: date, date_to: date, groupId },
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  const items = Array.isArray(data?.items) ? data.items : []
  if (!items.length) {
    headerOk.value = false
    return
  }
  // Encabezado y unidades
  head.value = { groupCode: items[0].groupCode, unitName: '', date }
  unitsInGroup.value = [...new Map(items.map(r => [String(r.unitName||''), { id: r.unitId, name: r.unitName }])).values()]
                      .filter(u => !!u.id)
                      .sort((a,b)=> (a.name||'').localeCompare(b.name||''))

  // 2) Cargar cada detalle de agentes
  const all = []
  for (const r of items) {
    const { data: ags } = await axios.get(`/admin/report-agents/${r.id}`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    const list = (Array.isArray(ags) ? ags : []).map(a => ({
      ...a,
      _key: `${a.code}-${a.unitName||''}-${a.state}-${a.novelty_start||''}-${a.novelty_end||''}`,
      municipality: a.municipalityName && a.dept ? `${a.municipalityName} (${a.dept})` : (a.municipalityName || ''),
      novelty_description: a.novelty_description || a.descripcion
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
  if (filters.value.category !== 'ALL') {
    list = list.filter(a => String(a.category) === filters.value.category)
  }
  if (filters.value.state !== 'ALL') {
    list = list.filter(a => String(a.state).toUpperCase() === filters.value.state)
  }
  if (filters.value.onlyNovelties) {
    list = list.filter(a => String(a.state).toUpperCase() !== 'SIN NOVEDAD')
  }
  if (isGroupMode.value && filters.value.unitId !== 'ALL') {
    list = list.filter(a => String(a.unitName||'') === (unitsInGroup.value.find(u => String(u.id) === String(filters.value.unitId))?.name || ''))
  }
  return list
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
    { key:'sn', label:'Sin novedad', count:cnt['SIN NOVEDAD'], cls:'bg-green-50 text-green-700 border-green-200', dot:'bg-green-600' },
    { key:'srv', label:'Servicio', count:cnt['SERVICIO'], cls:'bg-sky-50 text-sky-700 border-sky-200', dot:'bg-sky-600' },
    { key:'cds', label:'Comisión del servicio', count:cnt['COMISIÓN DEL SERVICIO'], cls:'bg-sky-50 text-sky-700 border-sky-200', dot:'bg-sky-600' },
    { key:'oth', label:'Otros', count:cnt.otros, cls:'bg-amber-50 text-amber-800 border-amber-200', dot:'bg-amber-600' }
  ]
})

// ===== Acciones
async function reload(){
  // El filtrado es client-side; este botón sirve por si en el futuro vuelves a cargar.
  // Aquí lo mantenemos simple: no recargamos desde servidor salvo que quieras.
}

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
  try {
    if (isGroupMode.value) {
      await loadGroupReports(dateParam.value, groupIdQ.value)
    } else if (reportId.value) {
      await loadSingleReport(reportId.value)
    } else {
      headerOk.value = false
    }
  } catch (e) {
    headerOk.value = false
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/* utilidades base */
.input { @apply w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500; }
.btn-ghost { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100; }
.card { @apply bg-white rounded-xl shadow; }
.card-body { @apply p-4; }
.table { min-width: 780px; }

/* móvil */
@media (max-width: 640px) {
  .card-body { padding: 1rem !important; }
  .table th, .table td { padding: 6px 4px !important; font-size: 12px !important; }
}
</style>
