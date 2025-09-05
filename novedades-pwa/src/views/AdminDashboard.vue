<template>
  <!-- Filtros -->
  <div class="card mb-2">
    <div class="card-body">
      <div class="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:items-end">
        <div>
          <label class="label">Fecha</label>
          <input type="date" v-model="date" class="input" />
        </div>

        <!-- Admin/Supervisión: Grupo + Unidad -->
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

        <!-- Líder de grupo: filtro de UNIDAD (para el mapa) -->
        <template v-else-if="isLeaderGroup">
          <div class="sm:col-span-2">
            <label class="label">Unidad</label>
            <select v-model="selectedLeaderUnitId" class="input">
              <option value="all">Todas</option>
              <option v-for="u in myUnits" :key="u.id" :value="String(u.id)">
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

  <!-- Agentes sin grupo -->
  <div class="flex flex-col sm:flex-row gap-3">
    <div class="kpi bg-white flex-1">
      <div class="card-body">
        <h4>Agentes sin grupo</h4>
        <div class="value text-amber-600 font-bold text-xl">{{ agentesLibres }}</div>
      </div>
    </div>
  </div>

  <!-- Mapa -->
  <div class="card">
    <div class="card-body">
      <h3 class="font-semibold mb-3 text-slate-700">Mapa de ubicación de agentes</h3>

      <div class="relative">
        <div
          id="mapa-agentes"
          class="relative z-0"
          style="height:300px;min-height:200px;width:100%;border-radius:12px;box-shadow:0 2px 8px #0001;background:#eee;"
        ></div>

        <!-- Botón overlay Pantalla Completa (visible y cuadrado) -->
        <button
          class="map-fs-btn"
          type="button"
          title="Pantalla completa"
          aria-label="Pantalla completa del mapa"
          @click="toggleFullscreen"
        >
          <!-- Ícono expand (SVG) -->
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 3H3v6M3 3l6 6M15 21h6v-6M21 21l-6-6M21 9V3h-6M15 9l6-6M3 15v6h6M9 15l-6 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Cumplimiento -->
  <div class="card" ref="complianceBox">
    <div class="card-body space-y-3">
      <div class="flex items-center justify-between flex-wrap">
        <h3 class="font-semibold text-slate-800">
          Cumplimiento ({{ checkpointLabel }})
          <span v-if="isAdmin" class="text-slate-500 font-normal text-sm">– grupos completos (todas sus unidades)</span>
        </h3>
        <button class="btn-ghost" @click="reloadCompliance">Actualizar</button>
      </div>

      <!-- Vista líder de grupo (igual que ya tenías) -->
      <template v-if="isLeaderGroup">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 class="text-slate-600 mb-2">✅ Actualizaron</h4>
            <div class="flex flex-wrap gap-2">
              <span v-for="g in compliance.done" :key="'d'+(g.groupCode || g.unitName)" class="chip chip-green">
                {{ g.unitName || g.groupCode }}
              </span>
              <span v-if="!compliance.done.length" class="text-slate-500 text-sm">Nadie aún</span>
            </div>
          </div>
          <div>
            <h4 class="text-slate-600 mb-2">⏳ Pendientes</h4>
            <div class="flex flex-wrap gap-2">
              <span v-for="g in compliance.pending" :key="'p'+(g.groupCode || g.unitName)" class="chip chip-amber">
                {{ g.unitName || g.groupCode }}
              </span>
              <span v-if="!compliance.pending.length" class="text-slate-500 text-sm">Sin pendientes</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Vista admin/supervisión: grupos completos y pendientes con popover de unidades faltantes -->
      <template v-else-if="isAdmin">
        <div class="space-y-3">
          <div>
            <h4 class="text-slate-600 mb-2">✅ Grupos completos</h4>
            <div class="flex flex-wrap gap-2">
              <span v-for="g in compAdmin.complete" :key="'cg'+g.groupId" class="chip chip-green">
                {{ g.groupCode }}
              </span>
              <span v-if="!compAdmin.complete.length" class="text-slate-500 text-sm">Ninguno aún</span>
            </div>
          </div>

          <div>
            <h4 class="text-slate-600 mb-2">⏳ Grupos con unidades pendientes</h4>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="g in compAdmin.pending"
                :key="'pg'+g.groupId"
                class="relative"
              >
                <button class="chip chip-amber with-caret" @click="togglePendingPopover(g.groupId)">
                  {{ g.groupCode }} · {{ g.missingUnits.length }}
                </button>

                <!-- Popover de unidades faltantes -->
                <div
                  v-if="openGroupId === g.groupId"
                  class="popover"
                >
                  <div class="popover-arrow"></div>
                  <div class="popover-body">
                    <div class="font-medium text-slate-700 mb-2">
                      Unidades pendientes ({{ g.missingUnits.length }})
                    </div>
                    <ul class="space-y-1 max-h-56 overflow-auto pr-1">
                      <li v-for="u in g.missingUnits" :key="u" class="text-slate-700 text-sm">
                        • {{ u }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <span v-if="!compAdmin.pending.length" class="text-slate-500 text-sm">Sin pendientes</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- Tabla -->
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
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
const isLeaderGroup = computed(() =>
  (me.value?.role || '').toLowerCase() === 'leader_group'
)

// ===== Filtros
const today = new Date().toISOString().slice(0,10)
const date = ref(today)
const selectedGroupId = ref('all')        // admin/supervisión
const selectedUnitId  = ref('all')        // admin/supervisión
const selectedLeaderUnitId = ref('all')   // líder (mapa)

// ===== Datos grupos/unidades
const grupos = ref([])
const units = ref([])   // admin/supervisión
const myUnits = ref([]) // líder grupo

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
  if (!isAdmin.value) return
  const { data } = await axios.get('/admin/units', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  units.value = Array.isArray(data) ? data : []
}
async function loadMyUnits() {
  if (!isLeaderGroup.value) return
  const { data } = await axios.get('/my/units', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  myUnits.value = Array.isArray(data) ? data : []
}
function onChangeGrupo() { selectedUnitId.value = 'all' }

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
function formatTime(ts) { if (!ts) return ''; const d = new Date(ts); return d.toISOString().substring(11, 16) }
function goToGroupDetail(r) { router.push(`/admin/report/${r.id}`) }

// ===== Mapa
const municipalitiesMap = ref([])

async function loadMapData() {
  const params = { date: date.value }

  if (isLeaderGroup.value) {
    const { data } = await axios.get('/admin/agent-municipalities', {
      params,
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    let list = data || []
    if (selectedLeaderUnitId.value !== 'all') {
      list = list.filter(m => String(m.unitId) === String(selectedLeaderUnitId.value))
    }
    municipalitiesMap.value = list
  } else {
    if (selectedGroupId.value !== 'all') params.groups = selectedGroupId.value
    if (selectedUnitId.value  !== 'all') params.units  = selectedUnitId.value
    const { data } = await axios.get('/admin/agent-municipalities', {
      params,
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    municipalitiesMap.value = data || []
  }
  setTimeout(drawMap, 100)
}

function drawMap() {
  if (window.myMap) { window.myMap.remove(); window.myMap = null }

  const hasFsPlugin = !!(L.Control && L.Control.Fullscreen)

  window.myMap = L.map('mapa-agentes', {
    fullscreenControl: hasFsPlugin
  }).setView([6.25, -75.6], 7)

  if (hasFsPlugin) {
    window.myMap.addControl(new L.Control.Fullscreen())
  }

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 15,
    attribution: 'Map data © OpenStreetMap contributors'
  }).addTo(window.myMap)

  municipalitiesMap.value.forEach(m => {
    if (m.lat && m.lon) {
      L.marker([m.lat, m.lon], {
        icon: L.icon({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconSize: [25, 41], iconAnchor: [12, 41]
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

// Fullscreen fallback (sin plugin)
function toggleFullscreen() {
  const el = document.getElementById('mapa-agentes')
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el)
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document)
  }
}

// ===== Agentes libres
const agentesLibres = ref(0)
async function loadAgentesLibres() {
  let params = { limit: 9999 }
  if (me.value?.role === 'leader_group' && me.value.groupId) params.groupId = me.value.groupId

  const { data } = await axios.get('/admin/agents', {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  agentesLibres.value = me.value?.role === 'leader_group'
    ? (data || []).filter(a => !a.unitId).length
    : (data || []).filter(a => a.groupId == null || a.groupId === 0).length
}

// ===== Cumplimiento (líder) – tal cual
const compliance = ref({ done: [], pending: [] })
const checkpointLabel = 'diario'
async function loadComplianceLeader() {
  let url = '/dashboard/compliance'
  const params = { date: date.value }
  if (me.value?.role === 'leader_group' && me.value.groupId) {
    url = '/dashboard/compliance-units'
    params.groupId = me.value.groupId
  }
  const { data } = await axios.get(url, {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  compliance.value = { done: data.done || [], pending: data.pending || [] }
}

// ===== Cumplimiento (admin/supervisión): grupos completos/pendientes con unidades faltantes
const compAdmin = ref({ complete: [], pending: [] })
const openGroupId = ref(null)

async function loadComplianceAdmin() {
  // 1) Obtener todas las unidades por grupo
  const [unitsResp, groupsResp, reportsResp] = await Promise.all([
    axios.get('/admin/units',  { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }),
    axios.get('/admin/groups', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }),
    axios.get('/reports', {
      params: { date: date.value },
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
  ])

  const unitsList = Array.isArray(unitsResp.data) ? unitsResp.data : []
  const groupsList = Array.isArray(groupsResp.data) ? groupsResp.data : []
  const reportsList = Array.isArray(reportsResp.data) ? reportsResp.data : []

  // Mapa: groupId -> [unit objects]
  const unitsByGroup = {}
  for (const u of unitsList) {
    if (!unitsByGroup[u.groupId]) unitsByGroup[u.groupId] = []
    unitsByGroup[u.groupId].push(u)
  }

  // Mapa: groupId -> Set(unitId) reportadas ese día
  const reportedByGroup = {}
  for (const r of reportsList) {
    const gid = r.groupId, uid = r.unitId
    if (!reportedByGroup[gid]) reportedByGroup[gid] = new Set()
    if (uid) reportedByGroup[gid].add(uid)
  }

  const complete = []
  const pending = []

  for (const g of groupsList) {
    const allUnits = unitsByGroup[g.id] || []
    const reportedSet = reportedByGroup[g.id] || new Set()

    // Construir faltantes por nombre
    const missingUnits = allUnits
      .filter(u => !reportedSet.has(u.id))
      .map(u => u.name)

    if (allUnits.length === 0) {
      // Sin unidades: se considera "completo" por no tener pendientes
      complete.push({ groupId: g.id, groupCode: g.code })
    } else if (missingUnits.length === 0) {
      complete.push({ groupId: g.id, groupCode: g.code })
    } else {
      pending.push({ groupId: g.id, groupCode: g.code, missingUnits })
    }
  }

  // Ordenar por código para consistencia
  compAdmin.value = {
    complete: complete.sort((a,b) => a.groupCode.localeCompare(b.groupCode)),
    pending: pending.sort((a,b) => a.groupCode.localeCompare(b.groupCode))
  }
}

function togglePendingPopover(groupId) {
  openGroupId.value = openGroupId.value === groupId ? null : groupId
}
function handleClickOutside(e) {
  const el = complianceBox.value
  if (!el) return
  if (!el.contains(e.target)) openGroupId.value = null
}
const complianceBox = ref(null)

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
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
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
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
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
  if (isLeaderGroup.value) await loadComplianceLeader()
  else await loadComplianceAdmin()
  await loadMapData()
  await loadAgentesLibres()
}
async function reloadCompliance() {
  if (isLeaderGroup.value) await loadComplianceLeader()
  else await loadComplianceAdmin()
}

// ===== Init
onMounted(async () => {
  await loadMe()
  await loadGrupos()
  if (isAdmin.value) await loadUnits()
  if (isLeaderGroup.value) await loadMyUnits()

  selectedGroupId.value = 'all'
  selectedUnitId.value  = 'all'
  selectedLeaderUnitId.value = 'all'

  await load()
  if (isLeaderGroup.value) await loadComplianceLeader()
  else await loadComplianceAdmin()
  await loadMapData()
  await loadAgentesLibres()

  document.addEventListener('click', handleClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Logout util
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

/* Chips */
.chip { @apply px-3 py-1 rounded-full text-sm font-medium border; }
.chip-green { @apply bg-green-100 border-green-200 text-green-700; }
.chip-amber { @apply bg-amber-100 border-amber-200 text-amber-800; }
.with-caret { position: relative; }

/* Popover */
.popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  width: 260px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,.12);
}
.popover-body { padding: 10px 12px; }
.popover-arrow {
  position: absolute;
  top: -8px; left: 16px;
  width: 16px; height: 16px;
  background: #fff; border-left: 1px solid #e2e8f0; border-top: 1px solid #e2e8f0;
  transform: rotate(45deg);
}

/* Botón overlay para fullscreen (más visible y cuadrado) */
.map-fs-btn{
  position:absolute; right:12px; top:12px; z-index:1000;
  width:44px; height:44px;
  border-radius:12px;
  display:flex; align-items:center; justify-content:center;
  background:#ffffffeb;
  border:1px solid #cbd5e1;
  color:#0f172a;
  box-shadow:0 4px 14px rgba(15, 23, 42, .15);
  transition: transform .08s ease, box-shadow .08s ease, background .2s ease;
}
.map-fs-btn:hover{ transform: translateY(-1px); box-shadow:0 6px 18px rgba(15, 23, 42, .18); background:#fff; }

/* Fullscreen API */
#mapa-agentes:fullscreen,
#mapa-agentes:-webkit-full-screen{
  width:100% !important; height:100% !important;
}

/* Si usas el plugin leaflet.fullscreen */
:deep(.leaflet-container.leaflet-fullscreen-on){
  width:100% !important; height:100% !important;
}
</style>
