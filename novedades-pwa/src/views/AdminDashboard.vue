<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Topbar -->
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">N</div>
          <div>
            <h1 class="text-slate-900 font-semibold leading-tight">Dashboard de Novedades</h1>
            <p class="text-slate-500 text-xs">Administrador</p>
          </div>
        </div>
        <nav class="flex items-center gap-3">
          <router-link to="/admin" class="btn-ghost">Dashboard</router-link>
          <router-link to="/admin/groups" class="btn-ghost">Grupos</router-link>
          <router-link to="/admin/users" class="btn-ghost">Usuarios</router-link>
          <router-link to="/admin/agents" class="btn-ghost">Agentes</router-link>
          <button @click="logout" class="btn-ghost">Cerrar sesión</button>
        </nav>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <!-- Filtros -->
      <div class="card">
        <div class="card-body">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label class="label">Fecha</label>
              <input type="date" v-model="date" class="input" />
            </div>
            <div>
              <label class="label">Corte</label>
              <select v-model="checkpoint" class="input">
                <option value="AM">Mañana (AM)</option>
                <option value="PM">Tarde (PM)</option>
              </select>
            </div>
            <div class="flex gap-2 md:col-span-2">
              <button @click="applyFilters" class="btn-primary w-full md:w-auto">Aplicar</button>
              <button @click="exportCSV" class="btn-ghost w-full md:w-auto">CSV</button>
            </div>
          </div>
        </div>
      </div>
      <!-- KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="kpi"><div class="card-body">
          <h4>FE total (OF/SO/PT)</h4>
          <div class="value">{{ kpiFE }}</div>
        </div></div>
        <div class="kpi"><div class="card-body">
          <h4>FD total (OF/SO/PT)</h4>
          <div class="value">{{ kpiFD }}</div>
        </div></div>
        <div class="kpi"><div class="card-body">
          <h4>Novedades totales (OF/SO/PT)</h4>
          <div class="value">{{ kpiNOV }}</div>
        </div></div>
      </div>

      <!-- Mapa de agentes por municipio -->
      <div class="card">
        <div class="card-body">
          <h3 class="font-semibold mb-3 text-slate-700">Mapa de ubicación de agentes</h3>
          <div id="mapa-agentes"
            style="height:420px;min-height:350px;width:100%;border-radius:12px;box-shadow:0 2px 8px #0001;background:#eee;"
            class="relative z-0"
          ></div>
        </div>
      </div>
      <!-- Cumplimiento por corte -->
      <div class="card">
        <div class="card-body space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-slate-800">Cumplimiento ({{ checkpointLabel }})</h3>
            <button class="btn-ghost" @click="loadCompliance">Actualizar</button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 class="text-slate-600 mb-2">✅ Actualizaron</h4>
              <div class="flex flex-wrap gap-2">
                <span v-for="g in compliance.done" :key="'d'+g.groupCode" class="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm">
                  {{ g.groupCode }}
                </span>
                <span v-if="!compliance.done.length" class="text-slate-500 text-sm">Nadie aún</span>
              </div>
            </div>
            <div>
              <h4 class="text-slate-600 mb-2">⏳ Pendientes</h4>
              <div class="flex flex-wrap gap-2">
                <span v-for="g in compliance.pending" :key="'p'+g.groupCode" class="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm">
                  {{ g.groupCode }}
                </span>
                <span v-if="!compliance.pending.length" class="text-slate-500 text-sm">Sin pendientes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="card">
        <div class="card-body">
          <div class="overflow-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Grupo</th> <!-- Grupo primero -->
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Corte</th>
                  <th>FE (OF/SO/PT)</th>
                  <th>FD (OF/SO/PT)</th>
                  <th>Novedades (OF/SO/PT)</th>
                  </tr>
              </thead>
              <tbody>
                <tr v-for="r in rowsDisplay" :key="r.id" class="hover:bg-slate-50">
                  <td>
                    <span class="inline-flex items-center gap-2">
                      <span class="h-2 w-2 rounded-full bg-brand-600"></span>{{ r.groupCode }}
                    </span>
                  </td>
                  <td>{{ r.date }}</td>
                  <td>{{ formatTime(r.updatedAt) }}</td>
                  <td>{{ prettyCorte(r.checkpoint) }}</td>
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

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const today = new Date().toISOString().slice(0,10)
const date = ref(today)        // un solo día
const checkpoint = ref('AM')   // solo AM/PM

const rows = ref([])

const tot = ref({
  OF_FE: 0, SO_FE: 0, PT_FE: 0,
  OF_FD: 0, SO_FD: 0, PT_FD: 0,
  OF_N:  0, SO_N:  0, PT_N:  0
})

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

import L from 'leaflet'

const municipalitiesMap = ref([])

async function loadMapData() {
  // Ahora pasa date y checkpoint al endpoint:
  const { data } = await axios.get('/admin/agent-municipalities', {
  params: { date: date.value, checkpoint: checkpoint.value },
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
});
  municipalitiesMap.value = data || []
  setTimeout(drawMap, 120) // Espera a que se renderice el div
}

function drawMap() {
  if (window.myMap) {
    window.myMap.remove();
    window.myMap = null;
  }

  window.myMap = L.map('mapa-agentes', {
    fullscreenControl: true
  }).setView([6.25, -75.6], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 15,
    attribution: 'Map data © OpenStreetMap contributors'
  }).addTo(window.myMap);

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
        <span>Agentes: <b>${m.agent_count}</b></span>
      `)
    }
  })
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toISOString().substring(11, 16) // HH:mm
}

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

async function load(){
  const { data } = await axios.get('/dashboard/reports', {
    params: {
      date_from: date.value,      // mismo día
      date_to: date.value,        // mismo día
      checkpoint: checkpoint.value // AM|PM
    },
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  rows.value = data.items || []
  recalcTotals()
}

// Cumplimiento
const compliance = ref({ done: [], pending: [] })
const checkpointLabel = computed(() => checkpoint.value === 'AM' ? 'Mañana' : 'Tarde')

async function loadCompliance() {
  const { data } = await axios.get('/dashboard/compliance', {
    params: { date: date.value, checkpoint: checkpoint.value },
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  compliance.value = { done: data.done || [], pending: data.pending || [] }
}

// Botón "Aplicar"
async function applyFilters() {
  await load();
  await loadCompliance();
  await loadMapData(); 
}


// CSV (con Grupo primero + Hora)
function exportCSV(){
  const header = ['Grupo','Fecha','Hora','Corte','FE (OF/SO/PT)','FD (OF/SO/PT)','Novedades (OF/SO/PT)']
  const lines = rowsDisplay.value.map(r => [
    r.groupCode,
    r.date,
    formatTime(r.updatedAt),
    prettyCorte(r.checkpoint),
    r.FE,
    r.FD,
    r.NOV
  ])

  const csv = [header, ...lines]
    .map(x => x.map(v => `"${(v??'').toString().replace(/"/g,'""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `dashboard_${date.value}_${checkpoint.value}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// Cargar al montar
onMounted(async () => {
  await load()
  await loadCompliance()
  await loadMapData()   // <--- Agrega esta línea
})

function prettyCorte(hhmm) {
  const h = parseInt((hhmm || '00:00').slice(0, 2), 10)
  if (h >= 6 && h <= 12) return 'Mañana (AM)'
  if (h >= 13 && h <= 23) return 'Tarde (PM)'
  return hhmm
}

// Logout
function logout(){
  localStorage.removeItem('token')
  window.location.href = '/login'
}
</script>
