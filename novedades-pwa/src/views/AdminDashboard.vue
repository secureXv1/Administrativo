<template>
  <!-- Filtros -->
  <div class="card mb-2">
    <div class="card-body">
      <div class="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:items-end">
        <div>
          <label class="label">Fecha</label>
          <input type="date" v-model="date" class="input" />
        </div>

        <!-- Selects SOLO para admin/supervisión -->
        <template v-if="isAdmin">
          <div>
            <label class="label">Grupo</label>
            <select v-model="selectedGroupId" class="input" @change="onChangeGrupo">
              <option value="all">Todas</option>
              <option v-for="g in grupos" :key="g.id" :value="String(g.id)">
                {{ g.code }} ({{ g.name }})
              </option>
            </select>
          </div>
          <div>
            <label class="label">Unidad</label>
            <select v-model="selectedUnitId" class="input">
              <option value="all">Todas</option>
              <option v-for="u in unitsOfSelectedGroup" :key="u.id" :value="String(u.id)">
                {{ u.name }}
              </option>
            </select>
          </div>
        </template>

        <!-- Acciones -->
        <div class="flex gap-2 sm:col-span-2">
          <button @click="applyFilters" class="btn-primary flex-1 sm:flex-none">Aplicar</button>
          <button @click="descargarExcel" class="btn-ghost flex-1 sm:flex-none">Descargar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div class="kpi"><div class="card-body">
      <h4>FE total (OF/SO/PT)</h4>
      <div class="value text-lg">{{ kpiFE }}</div>
    </div></div>
    <div class="kpi"><div class="card-body">
      <h4>FD total (OF/SO/PT)</h4>
      <div class="value text-lg">{{ kpiFD }}</div>
    </div></div>
    <div class="kpi"><div class="card-body">
      <h4>Novedades totales (OF/SO/PT)</h4>
      <div class="value text-lg">{{ kpiNOV }}</div>
    </div></div>
  </div>

  <!-- Agentes sin grupo + (los filtros de grupo ya están arriba) -->
  <div class="flex flex-col sm:flex-row gap-3">
    <div class="kpi bg-white flex-1">
      <div class="card-body">
        <h4>Agentes sin grupo</h4>
        <div class="value text-amber-600 font-bold text-xl">{{ agentesLibres }}</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-body">
      <h3 class="font-semibold mb-3 text-slate-700">Mapa de ubicación de agentes</h3>
      <div id="mapa-agentes"
        style="height:300px;min-height:200px;width:100%;border-radius:12px;box-shadow:0 2px 8px #0001;background:#eee;"
        class="relative z-0"
      ></div>
    </div>
  </div>

  <div class="card">
    <div class="card-body space-y-3">
      <div class="flex items-center justify-between flex-wrap">
        <h3 class="font-semibold text-slate-800">Cumplimiento ({{ checkpointLabel }})</h3>
        <button class="btn-ghost" @click="loadCompliance">Actualizar</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h4 class="text-slate-600 mb-2">✅ Actualizaron</h4>
          <div class="flex flex-wrap gap-2">
            <span v-for="g in compliance.done" :key="'d'+(g.groupCode || g.unitName)" class="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm">
              {{ g.unitName || g.groupCode }}
            </span>
            <span v-if="!compliance.done.length" class="text-slate-500 text-sm">Nadie aún</span>
          </div>
        </div>
        <div>
          <h4 class="text-slate-600 mb-2">⏳ Pendientes</h4>
          <div class="flex flex-wrap gap-2">
            <span v-for="g in compliance.pending" :key="'p'+(g.groupCode || g.unitName)" class="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm">
              {{ g.unitName || g.groupCode }}
            </span>
            <span v-if="!compliance.pending.length" class="text-slate-500 text-sm">Sin pendientes</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-body p-0">
      <div class="overflow-x-auto">
        <table class="table text-xs sm:text-sm">
          <thead>
            <tr>
              <th>{{ me && me.role === 'leader_group' ? 'Unidad' : 'Grupo' }}</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>FE (OF/SO/PT)</th>
              <th>FD (OF/SO/PT)</th>
              <th>Novedades (OF/SO/PT)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rowsDisplay" :key="r.id" class="hover:bg-slate-50">
              <td>
                <span class="inline-flex items-center gap-2 cursor-pointer hover:underline text-brand-700" @click="goToGroupDetail(r)">
                  <span class="h-2 w-2 rounded-full bg-brand-600"></span>
                  {{ r.unitName || r.groupCode }}
                </span>
              </td>
              <td>{{ r.date }}</td>
              <td>{{ formatTime(r.updatedAt) }}</td>
              <td class="font-medium text-slate-900">{{ r.FE }}</td>
              <td class="font-medium text-slate-900">{{ r.FD }}</td>
              <td class="font-medium text-slate-900">{{ r.NOV }}</td>
            </tr>
            <tr v-if="rowsDisplay.length===0">
              <td colspan="8" class="text-center text-slate-500 py-6">Sin datos</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import L from 'leaflet'
import { useRouter } from 'vue-router'

const router = useRouter()

// ===== Auth/User
const me = ref(null)
async function loadMe() {
  try {
    const { data } = await axios.get('/me', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    me.value = data
  } catch { me.value = null }
}
const isAdmin = computed(() =>
  ['superadmin','supervision','supervisor'].includes((me.value?.role || '').toLowerCase())
)

// ===== Filtros
const today = new Date().toISOString().slice(0,10)
const date = ref(today)
const selectedGroupId = ref('all')   // 'all' | groupId (string)
const selectedUnitId  = ref('all')   // 'all' | unitId  (string)

// ===== Datos
const grupos = ref([])
const units = ref([]) // todas las unidades (admin/supervision)
const unitsOfSelectedGroup = computed(() => {
  if (selectedGroupId.value === 'all') return []
  return units.value.filter(u => String(u.groupId) === String(selectedGroupId.value))
})

async function loadGrupos() {
  const { data } = await axios.get('/admin/groups', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  grupos.value = Array.isArray(data) ? data : []
}

async function loadUnits() {
  // Solo admin/supervision tiene acceso a /admin/units
  if (!isAdmin.value) return
  const { data } = await axios.get('/admin/units', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  units.value = Array.isArray(data) ? data : []
}

function onChangeGrupo() {
  // Al cambiar grupo, resetea unidad
  selectedUnitId.value = 'all'
}

// ===== KPIs / Tabla
const rows = ref([])
const tot = ref({ OF_FE:0,SO_FE:0,PT_FE:0, OF_FD:0,SO_FD:0,PT_FD:0, OF_N:0,SO_N:0,PT_N:0 })
const kpiFE  = computed(() => `${tot.value.OF_FE}/${tot.value.SO_FE}/${tot.value.PT_FE}`)
const kpiFD  = computed(() => `${tot.value.OF_FD}/${tot.value.SO_FD}/${tot.value.PT_FD}`)
const kpiNOV = computed(() => `${tot.value.OF_N}/${tot.value.SO_N}/${tot.value.PT_N}`)
const rowsDisplay = computed(() =>
  rows.value.map(r => ({
    ...r,
    FE:  `${r.OF_effective||0}/${r.SO_effective||0}/${r.PT_effective||0}`,
    FD:  `${r.OF_available||0}/${r.SO_available||0}/${r.PT_available||0}`,
    NOV: `${r.OF_nov||0}/${r.SO_nov||0}/${r.PT_nov||0}`
  }))
)

function recalcTotals() {
  tot.value = { OF_FE:0,SO_FE:0,PT_FE:0, OF_FD:0,SO_FD:0,PT_FD:0, OF_N:0,SO_N:0,PT_N:0 }
  for (const r of rows.value) {
    tot.value.OF_FE += r.OF_effective||0
    tot.value.SO_FE += r.SO_effective||0
    tot.value.PT_FE += r.PT_effective||0

    tot.value.OF_FD += r.OF_available||0
    tot.value.SO_FD += r.SO_available||0
    tot.value.PT_FD += r.PT_available||0

    tot.value.OF_N  += r.OF_nov||0
    tot.value.SO_N  += r.SO_nov||0
    tot.value.PT_N  += r.PT_nov||0
  }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toISOString().substring(11, 16)
}

function goToGroupDetail(r) {
  router.push(`/admin/report/${r.id}`)
}

// ===== Mapa
const municipalitiesMap = ref([])

async function loadMapData() {
  const params = { date: date.value }

  if (me.value?.role === 'leader_group') {
    // backend ya fuerza su groupId
    // no pasamos groups/units
  } else {
    // Admin / Supervisión
    if (selectedGroupId.value !== 'all') {
      params.groups = selectedGroupId.value
    }
    if (selectedUnitId.value !== 'all') {
      params.units = selectedUnitId.value
    }
  }

  const { data } = await axios.get('/admin/agent-municipalities', {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  municipalitiesMap.value = data || []
  setTimeout(drawMap, 100)
}

function drawMap() {
  if (window.myMap) {
    window.myMap.remove()
    window.myMap = null
  }

  window.myMap = L.map('mapa-agentes').setView([6.25, -75.6], 7)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 15,
    attribution: 'Map data © OpenStreetMap contributors'
  }).addTo(window.myMap)

  municipalitiesMap.value.forEach(m => {
    if (m.lat && m.lon) {
      L.marker([m.lat, m.lon], {
        icon: L.icon({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41]
        })
      })
      .addTo(window.myMap)
      .bindPopup(`
        <b>${m.name}</b> <br>
        <span style="font-size:13px">${m.dept}</span><br>
        <span>Agentes: <b>${m.agent_count}</b></span><br>
        <span>${m.groupCode}${m.unitName ? ' — ' + m.unitName : ''}</span>
      `)
    }
  })
}

// ===== Agentes libres
const agentesLibres = ref(0)
async function loadAgentesLibres() {
  let params = { limit: 9999 }

  if (me.value?.role === 'leader_group' && me.value.groupId) {
    params.groupId = me.value.groupId
  }

  const { data } = await axios.get('/admin/agents', {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })

  if (me.value?.role === 'leader_group') {
    agentesLibres.value = (data || []).filter(a => !a.unitId).length
  } else {
    agentesLibres.value = (data || []).filter(a => a.groupId == null || a.groupId === 0).length
  }
}

// ===== Cumplimiento
const compliance = ref({ done: [], pending: [] })
const checkpointLabel = 'diario'

async function loadCompliance() {
  let url = '/dashboard/compliance'
  const params = { date: date.value }

  if (me.value?.role === 'leader_group' && me.value.groupId) {
    url = '/dashboard/compliance-units'
    params.groupId = me.value.groupId
  }

  const { data } = await axios.get(url, {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  compliance.value = { done: data.done || [], pending: data.pending || [] }
}

// ===== Tabla/KPIs load
async function load() {
  const params = { date_from: date.value, date_to: date.value }

  if (me.value?.role === 'leader_group' && me.value.groupId) {
    params.groupId = me.value.groupId
  } else {
    if (selectedGroupId.value !== 'all') params.groupId = selectedGroupId.value
    if (selectedUnitId.value  !== 'all') params.unitId  = selectedUnitId.value
  }

  const { data } = await axios.get('/dashboard/reports', {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  rows.value = data.items || []
  recalcTotals()
}

// ===== Descargar Excel (respeta filtros)
async function descargarExcel() {
  const params = { date: date.value }

  if (me.value?.role === 'leader_group') {
    params.groupId = me.value.groupId
  } else {
    if (selectedGroupId.value !== 'all') params.groupId = selectedGroupId.value
    if (selectedUnitId.value  !== 'all') params.unitId  = selectedUnitId.value
  }

  const { data } = await axios.get('/reports/export', {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })

  const normalizado = data.map(row => {
    const out = {}
    for (const k in row) {
      let v = row[k]
      if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) v = 'N/A'
      out[k] = v
    }
    return out
  })

  const ws = XLSX.utils.json_to_sheet(normalizado)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'DatosNovedades')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([wbout], { type: "application/octet-stream" }), `novedades_${params.date}.xlsx`)
}

// ===== Botón "Aplicar"
async function applyFilters() {
  await load()
  await loadCompliance()
  await loadMapData()
  await loadAgentesLibres()
}

// ===== Init
onMounted(async () => {
  await loadMe()
  await loadGrupos()
  if (isAdmin.value) await loadUnits()

  // Líder de grupo no necesita selects; admin empieza en "Todas"
  selectedGroupId.value = 'all'
  selectedUnitId.value  = 'all'

  await load()
  await loadCompliance()
  await loadMapData()
  await loadAgentesLibres()
})

// Logout util (si lo usas en el layout)
function logout(){
  localStorage.removeItem('token')
  window.location.href = '/login'
}
</script>

<style scoped>
.input { @apply w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500; }
.btn-primary { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700; }
.btn-ghost { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100; }
.label { @apply text-sm text-slate-600; }
.card { @apply bg-white rounded-xl shadow; }
.card-body { @apply p-4; }
.kpi { @apply bg-white rounded-xl shadow; }
</style>
