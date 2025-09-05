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
        <template v-if="isAdminView">
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
    <div class="kpi"><div class="card-body"><h4>FE total (OF/SO/PT)</h4><div class="value text-lg">{{ kpiFE }}</div></div></div>
    <div class="kpi"><div class="card-body"><h4>FD total (OF/SO/PT)</h4><div class="value text-lg">{{ kpiFD }}</div></div></div>
    <div class="kpi"><div class="card-body"><h4>Novedades totales (OF/SO/PT)</h4><div class="value text-lg">{{ kpiNOV }}</div></div></div>
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
        <div id="mapa-agentes"
             class="relative z-0"
             style="height:300px;min-height:200px;width:100%;border-radius:12px;box-shadow:0 2px 8px #0001;background:#eee;">
        </div>
        <!-- Botón overlay Pantalla Completa -->
        <button class="map-fs-btn" type="button" title="Pantalla completa" aria-label="Pantalla completa del mapa"
                @click="toggleFullscreen">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 3H3v6M3 3l6 6M15 21h6v-6M21 21l-6-6M21 9V3h-6M15 9l6-6M3 15v6h6M9 15l-6 6"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Cumplimiento -->
  <div class="card" ref="complianceBox">
    <div class="card-body space-y-4">
      <div class="flex items-center justify-between flex-wrap">
        <h3 class="font-semibold text-slate-800">
          Cumplimiento <span class="text-slate-500 font-normal">(diario)</span>
          <template v-if="isAdminView">
            <span class="text-slate-400 font-normal text-sm ml-2">Grupos completos = todas sus unidades</span>
          </template>
        </h3>
        <button class="btn-ghost" @click="reloadCompliance">Actualizar</button>
      </div>

      <!-- Líder de grupo -->
      <template v-if="isLeaderGroup">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div class="mb-2 text-slate-600 font-medium flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-green-600"></span> Actualizaron
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="g in compliance.done" :key="'d'+(g.unitName||g.groupCode)"
                class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                {{ g.unitName || g.groupCode }}
              </span>
              <span v-if="!compliance.done.length" class="text-slate-500 text-sm">Nadie aún</span>
            </div>
          </div>

          <div>
            <div class="mb-2 text-slate-600 font-medium flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-600"></span> Pendientes
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="g in compliance.pending" :key="'p'+(g.unitName||g.groupCode)"
                class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {{ g.unitName || g.groupCode }}
              </span>
              <span v-if="!compliance.pending.length" class="text-slate-500 text-sm">Sin pendientes</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Admin / Supervisor -->
      <template v-else>
        <div class="space-y-6">
          <!-- Completos -->
          <div>
            <div class="mb-2 text-slate-600 font-medium flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-green-600"></span> Grupos completos
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="g in compAdmin.complete" :key="'cg'+g.groupId"
                class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 shadow">
                {{ g.groupCode }} <span class="text-xs text-green-800/70">100%</span>
              </span>
              <span v-if="!compAdmin.complete.length" class="text-slate-500 text-sm">Ninguno aún</span>
            </div>
          </div>

          <!-- Pendientes -->
          <div>
            <div class="mb-2 text-slate-600 font-medium flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-600"></span> Grupos con unidades pendientes
              <span v-if="compAdmin.pending.length" class="text-slate-400 text-sm ml-1">({{ compAdmin.pending.length }})</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-for="g in compAdmin.pending" :key="'pg'+g.groupId" class="p-3 rounded-xl border border-slate-200 bg-white shadow-sm relative">
                <div class="flex items-center justify-between mb-1">
                  <div class="font-semibold text-slate-800 tracking-wide">{{ g.groupCode }}</div>
                  <button class="text-brand-700 text-sm hover:underline" @click="togglePendingPopover(g.groupId)">
                    Ver {{ g.missingUnits.length }}
                  </button>
                </div>

                <div class="text-slate-500 text-xs mb-2">
                  {{ g.doneUnits }} / {{ g.totalUnits }} unidades — {{ g.percent }}%
                </div>

                <!-- Barra de progreso -->
                <div class="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div class="h-full bg-amber-400" :style="{ width: g.percent + '%' }"></div>
                </div>

                <!-- Popover -->
                <div v-if="openGroupId === g.groupId"
                     class="absolute z-30 top-[calc(100%+8px)] left-3 w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl">
                  <div class="absolute -top-2 left-6 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45"></div>
                  <div class="p-3">
                    <div class="font-medium text-slate-700 mb-2">Unidades pendientes ({{ g.missingUnits.length }})</div>
                    <ul class="space-y-1 max-h-56 overflow-auto pr-1">
                      <li v-for="u in g.missingUnits" :key="u" class="text-slate-700 text-sm">• {{ u }}</li>
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
              <th>{{ isAdminView ? 'Grupo' : 'Unidad' }}</th>
              <th>Fecha</th>
              <th>{{ isAdminView ? 'Hora de cierre' : 'Hora' }}</th>
              <th>FE (OF/SO/PT)</th>
              <th>FD (OF/SO/PT)</th>
              <th>Novedades (OF/SO/PT)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in tableRows" :key="r._key" class="hover:bg-slate-50">
              <td>
                <template v-if="!isAdminView">
                  <span class="inline-flex items-center gap-2 cursor-pointer hover:underline text-brand-700" @click="goToGroupDetail(r)">
                    <span class="h-2 w-2 rounded-full bg-brand-600"></span>
                    {{ r.unitName || r.groupCode }}
                  </span>
                </template>

                <!-- ADMIN / SUPERVISOR: botón que navega al detalle del grupo -->
                <template v-else>
                  <button
                    class="inline-flex items-center gap-2 text-brand-700 hover:underline"
                    @click="goToGroupReport(r)"
                    title="Ver detalle del grupo"
                  >
                    <span class="h-2 w-2 rounded-full" :class="r.isComplete ? 'bg-green-600' : 'bg-amber-600'"></span>
                    {{ r.groupCode }}
                  </button>
                </template>
              </td>
              <td>{{ r.date }}</td>
              <td>{{ formatTime(r.time) }}</td>
              <td class="font-medium text-slate-900">{{ r.FE }}</td>
              <td class="font-medium text-slate-900">{{ r.FD }}</td>
              <td class="font-medium text-slate-900">{{ r.NOV }}</td>
            </tr>
            <tr v-if="tableRows.length === 0">
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

// ===== Auth / roles
const me = ref(null)
async function loadMe() {
  try {
    const { data } = await axios.get('/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
    me.value = data
  } catch { me.value = null }
}
const roleLc = computed(() => String(me.value?.role || '').trim().toLowerCase())
const isAdminView   = computed(() => ['superadmin','supervision','supervisor'].includes(roleLc.value))
const isLeaderGroup = computed(() => roleLc.value === 'leader_group')

// ===== Filtros
const today = new Date().toISOString().slice(0,10)
const date = ref(today)
const selectedGroupId = ref('all')
const selectedUnitId  = ref('all')
const selectedLeaderUnitId = ref('all')

// ===== Catálogos
const grupos = ref([])
const units  = ref([])
const myUnits = ref([])

const unitsOfSelectedGroup = computed(() => {
  if (selectedGroupId.value === 'all') return []
  return units.value.filter(u => String(u.groupId) === String(selectedGroupId.value))
})

async function loadGrupos() {
  const { data } = await axios.get('/admin/groups', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
  grupos.value = Array.isArray(data) ? data : []
}
async function loadUnits() {
  if (!isAdminView.value) return
  const { data } = await axios.get('/admin/units', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
  units.value = Array.isArray(data) ? data : []
}
async function loadMyUnits() {
  if (!isLeaderGroup.value) return
  const { data } = await axios.get('/my/units', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
  myUnits.value = Array.isArray(data) ? data : []
}
function onChangeGrupo(){ selectedUnitId.value = 'all' }

// ===== KPIs
const rows = ref([])
const tot = ref({ OF_FE:0,SO_FE:0,PT_FE:0, OF_FD:0,SO_FD:0,PT_FD:0, OF_N:0,SO_N:0,PT_N:0 })
const kpiFE  = computed(() => `${tot.value.OF_FE}/${tot.value.SO_FE}/${tot.value.PT_FE}`)
const kpiFD  = computed(() => `${tot.value.OF_FD}/${tot.value.SO_FD}/${tot.value.PT_FD}`)
const kpiNOV = computed(() => `${tot.value.OF_N}/${tot.value.SO_N}/${tot.value.PT_N}`)

function recalcTotals () {
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

function formatTime (ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().substring(11,16)
}

function goToGroupDetail (r) {
  router.push(`/admin/report/${r.id}`)
}

function goToGroupReport(r) {
  const gid = r.groupId || r.group_id; // fallback por si el nombre cambia
  if (!gid) {
    console.warn('No se encontró groupId en la fila seleccionada', r);
    return;
  }
  router.push({
    path: '/admin/report',
    query: { date: r.date, groupId: String(gid) }
  });
}



// ===== Mapa
const municipalitiesMap = ref([])

async function loadMapData () {
  const params = { date: date.value }
  if (isLeaderGroup.value) {
    const { data } = await axios.get('/admin/agent-municipalities', {
      params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
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
      params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    municipalitiesMap.value = data || []
  }
  setTimeout(drawMap, 100)
}

function drawMap () {
  if (window.myMap) { window.myMap.remove(); window.myMap = null }
  const hasFsPlugin = !!(L.Control && L.Control.Fullscreen)
  window.myMap = L.map('mapa-agentes', { fullscreenControl: hasFsPlugin }).setView([6.25, -75.6], 7)
  if (hasFsPlugin) window.myMap.addControl(new L.Control.Fullscreen())
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 15, attribution: 'Map data © OpenStreetMap contributors' }).addTo(window.myMap)

  municipalitiesMap.value.forEach(m => {
    if (m.lat && m.lon) {
      L.marker([m.lat, m.lon], {
        icon: L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconSize:[25,41], iconAnchor:[12,41] })
      }).addTo(window.myMap).bindPopup(`
        <b>${m.name}</b><br/>
        <span style="font-size:13px">${m.dept}</span><br/>
        Agentes: <b>${m.agent_count}</b><br/>
        ${m.groupCode}${m.unitName ? ' — ' + m.unitName : ''}
      `)
    }
  })
}

// Fullscreen (fallback nativo)
function toggleFullscreen () {
  const el = document.getElementById('mapa-agentes')
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el)
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document)
  }
}

// ===== Agentes libres
const agentesLibres = ref(0)
async function loadAgentesLibres () {
  let params = { limit: 9999 }
  if (isLeaderGroup.value && me.value?.groupId) params.groupId = me.value.groupId
  const { data } = await axios.get('/admin/agents', {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  agentesLibres.value = isLeaderGroup.value
    ? (data || []).filter(a => !a.unitId).length
    : (data || []).filter(a => a.groupId == null || a.groupId === 0).length
}

// ===== Cumplimiento
const checkpointLabel = 'diario'

// Líder
const compliance = ref({ done: [], pending: [] })
async function loadComplianceLeader () {
  let url = '/dashboard/compliance'
  const params = { date: date.value }
  if (isLeaderGroup.value && me.value?.groupId) {
    url = '/dashboard/compliance-units'
    params.groupId = me.value.groupId
  }
  const { data } = await axios.get(url, {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  compliance.value = { done: data.done || [], pending: data.pending || [] }
}

// Admin/Supervisor
const compAdmin = ref({ complete: [], pending: [] })
const openGroupId = ref(null)
const complianceBox = ref(null)

async function loadComplianceAdmin () {
  const [unitsResp, groupsResp, reportsResp] = await Promise.all([
    axios.get('/admin/units',  { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }),
    axios.get('/admin/groups', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }),
    axios.get('/reports',      { params: { date: date.value }, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
  ])

  const unitsList   = Array.isArray(unitsResp.data)  ? unitsResp.data  : []
  const groupsList  = Array.isArray(groupsResp.data) ? groupsResp.data : []
  const reportsList = Array.isArray(reportsResp.data)? reportsResp.data: []

  // groupId -> unidades
  const unitsByGroup = {}
  for (const u of unitsList) {
    if (!unitsByGroup[u.groupId]) unitsByGroup[u.groupId] = []
    unitsByGroup[u.groupId].push(u)
  }

  // groupId -> Set(unitId) reportadas ese día
  const reportedByGroup = {}
  for (const r of reportsList) {
    const gid = r.groupId, uid = r.unitId
    if (!reportedByGroup[gid]) reportedByGroup[gid] = new Set()
    if (uid) reportedByGroup[gid].add(uid)
  }

  const complete = []
  const pending  = []

  for (const g of groupsList) {
    const allUnits   = unitsByGroup[g.id] || []
    const totalUnits = allUnits.length
    const repSet     = reportedByGroup[g.id] || new Set()
    const doneUnits  = [...repSet].length
    const missingUnits = allUnits.filter(u => !repSet.has(u.id)).map(u => u.name)
    const percent = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 100

    if (totalUnits === 0 || percent === 100) {
      complete.push({ groupId: g.id, groupCode: g.code })
    } else {
      pending.push({ groupId: g.id, groupCode: g.code, totalUnits, doneUnits, percent, missingUnits })
    }
  }

  compAdmin.value = {
    complete: complete.sort((a,b)=>a.groupCode.localeCompare(b.groupCode)),
    pending : pending.sort((a,b)=>a.groupCode.localeCompare(b.groupCode))
  }
}

function togglePendingPopover(id){ openGroupId.value = openGroupId.value === id ? null : id }
function onComplianceOutsideClick(e){
  const el = complianceBox.value
  if (!el) return
  if (!el.contains(e.target)) openGroupId.value = null
}

// ===== Tabla (líder por unidad / admin por grupo)
const rowsDisplayLeader = computed(() =>
  rows.value.map(r => ({
    _key: r.id, id: r.id, unitName: r.unitName, groupCode: r.groupCode,
    date: r.date, time: r.updatedAt,
    FE:  `${r.OF_effective||0}/${r.SO_effective||0}/${r.PT_effective||0}`,
    FD:  `${r.OF_available||0}/${r.SO_available||0}/${r.PT_available||0}`,
    NOV: `${r.OF_nov||0}/${r.SO_nov||0}/${r.PT_nov||0}`
  }))
)

const completeGroupCodes = computed(() => new Set(compAdmin.value.complete.map(x => x.groupCode)))

const rowsDisplayAdmin = computed(() => {
  const map = new Map()
  for (const r of rows.value) {
    const code = r.groupCode
    if (!code) continue
    if (!map.has(code)) {
      map.set(code, {
        _key: code,
        groupCode: code,
        groupId: r.groupId,           // <-- IMPORTANTE
        date: r.date,
        updatedAtMax: r.updatedAt || null,
        OF_effective:0, SO_effective:0, PT_effective:0,
        OF_available:0, SO_available:0, PT_available:0,
        OF_nov:0, SO_nov:0, PT_nov:0
      })
    }
    const g = map.get(code)
    const ts  = new Date(r.updatedAt||0).getTime()
    const old = new Date(g.updatedAtMax||0).getTime()
    if (isFinite(ts) && ts > old) g.updatedAtMax = r.updatedAt

    g.OF_effective += r.OF_effective||0
    g.SO_effective += r.SO_effective||0
    g.PT_effective += r.PT_effective||0
    g.OF_available += r.OF_available||0
    g.SO_available += r.SO_available||0
    g.PT_available += r.PT_available||0
    g.OF_nov += r.OF_nov||0
    g.SO_nov += r.SO_nov||0
    g.PT_nov += r.PT_nov||0
  }

  const out = []
  for (const [code, g] of map.entries()) {
    const isComplete = completeGroupCodes.value.has(code)
    out.push({
      _key: code,
      groupCode: code,
      groupId: g.groupId,                 // <-- IMPORTANTE
      date: g.date,
      time: isComplete ? g.updatedAtMax : null,
      isComplete,
      FE:  `${g.OF_effective}/${g.SO_effective}/${g.PT_effective}`,
      FD:  `${g.OF_available}/${g.SO_available}/${g.PT_available}`,
      NOV: `${g.OF_nov}/${g.SO_nov}/${g.PT_nov}`
    })
  }
  return out.sort((a,b)=>a.groupCode.localeCompare(b.groupCode))
})


const tableRows = computed(() => isAdminView.value ? rowsDisplayAdmin.value : rowsDisplayLeader.value)

// ===== Carga / Export
async function load () {
  const params = { date_from: date.value, date_to: date.value }
  if (isLeaderGroup.value && me.value?.groupId) {
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

async function descargarExcel () {
  const params = { date: date.value }
  if (isLeaderGroup.value) params.groupId = me.value.groupId
  else {
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
      if (v == null || (typeof v === 'string' && v.trim() === '')) v = 'N/A'
      out[k] = v
    }
    return out
  })
  const ws = XLSX.utils.json_to_sheet(normalizado)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'DatosNovedades')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `novedades_${params.date}.xlsx`)
}

// ===== Acciones
async function applyFilters () {
  await load()
  if (isLeaderGroup.value) await loadComplianceLeader()
  else await loadComplianceAdmin()
  await loadMapData()
  await loadAgentesLibres()
}
async function reloadCompliance () {
  if (isLeaderGroup.value) await loadComplianceLeader()
  else await loadComplianceAdmin()
}

// ===== Init
function handleClickOutside(e){
  const el = complianceBox.value
  if (!el) return
  if (!el.contains(e.target)) openGroupId.value = null
}

onMounted(async () => {
  await loadMe()
  await loadGrupos()
  if (isAdminView.value) await loadUnits()
  if (isLeaderGroup.value) await loadMyUnits()

  selectedGroupId.value = 'all'
  selectedUnitId.value  = 'all'
  selectedLeaderUnitId.value = 'all'

  await load()
  if (isLeaderGroup.value) await loadComplianceLeader()
  else await loadComplianceAdmin()
  await loadMapData()
  await loadAgentesLibres()

  document.addEventListener('click', onComplianceOutsideClick)
})
onBeforeUnmount(() => document.removeEventListener('click', onComplianceOutsideClick))
</script>

<style scoped>
/* Utilidades base (Tailwind) */
.input { @apply w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500; }
.btn-primary { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700; }
.btn-ghost { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100; }
.label { @apply text-sm text-slate-600; }
.card { @apply bg-white rounded-xl shadow; }
.card-body { @apply p-4; }
.kpi { @apply bg-white rounded-xl shadow; }

/* Botón overlay Fullscreen */
.map-fs-btn{
  position:absolute; right:12px; top:12px; z-index:1000;
  width:44px; height:44px; border-radius:12px;
  display:flex; align-items:center; justify-content:center;
  background:#ffffffeb; color:#0f172a;
  border:1px solid #cbd5e1;
  box-shadow:0 6px 18px rgba(15,23,42,.18);
  transition: transform .08s ease, box-shadow .08s ease, background .2s ease;
}
.map-fs-btn:hover{ transform: translateY(-1px); background:#ffffff; }

/* Fullscreen API */
#mapa-agentes:fullscreen,
#mapa-agentes:-webkit-full-screen{ width:100% !important; height:100% !important; }
:deep(.leaflet-container.leaflet-fullscreen-on){ width:100% !important; height:100% !important; }

/* Si Tailwind purga colores, añade en tailwind.config.js:
safelist: [{ pattern: /(bg|text|border)-(green|amber)-(50|100|200|400|600|700|800)/ }]
*/
</style>
