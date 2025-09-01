<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Topbar: adaptativo -->

     <transition name="fade">
      <div v-if="drawerOpen" class="md:hidden">
        <div
          class="fixed inset-0 bg-black/40 z-50"
          @click="drawerOpen = false"
        ></div>
        <nav
          class="fixed top-0 left-0 h-full w-64 max-w-[80vw] bg-white shadow-xl flex flex-col py-6 px-4 gap-2 z-50"
          style="min-width: 220px; overflow-y:auto; max-height:100vh;"
          @click.stop
        >
          <button class="self-end mb-4" @click="drawerOpen = false" aria-label="Cerrar menú">
            <svg class="h-7 w-7 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <router-link to="/admin" class="btn-ghost w-full text-left">Dashboard</router-link>
          <router-link v-if="me && (me.role === 'superadmin' || me.role === 'supervision')" to="/admin/groups" class="btn-ghost w-full text-left">Grupos</router-link>
          <router-link v-if="me && (me.role === 'superadmin' || me.role === 'supervision' || me.role === 'leader_group')" to="/admin/units" class="btn-ghost w-full text-left">Unidades</router-link>
          <router-link to="/admin/users" class="btn-ghost w-full text-left">Usuarios</router-link>
          <router-link to="/admin/agents" class="btn-ghost w-full text-left">Agentes</router-link>
          <router-link to="/perfil" class="btn-ghost w-full text-left">Perfil</router-link>
          <button @click="logout" class="btn-ghost w-full text-left">Cerrar sesión</button>
        </nav>
      </div>
    </transition>
    
    <header class="sticky top-0 z-20 backdrop-blur bg-white/80 border-b border-slate-200">
  <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
    <!-- Logo + Título -->
    <div class="flex items-center gap-3">
      <!-- Botón hamburguesa solo en móvil -->
      <button class="md:hidden p-2 -ml-2" @click="drawerOpen = true">
        <svg class="h-7 w-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div class="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-xl">N</div>
      <div>
        <h1 class="text-slate-900 font-semibold leading-tight text-base sm:text-lg">
          Dashboard de Novedades
          <template v-if="me && me.role === 'leader_group'">- Grupo</template>
        </h1>
        <p class="text-slate-500 text-xs">
          <template v-if="me && me.role === 'superadmin'">Administrador</template>
          <template v-else-if="me && me.role === 'supervision'">Supervisión</template>
          <template v-else-if="me && me.role === 'leader_group'">Líder de Grupo</template>
        </p>
      </div>
    </div>
    <!-- Menú solo visible en desktop -->
    <nav class="hidden md:flex items-center gap-2">
      <router-link to="/admin" class="btn-ghost">Dashboard</router-link>
      <router-link v-if="me && (me.role === 'superadmin' || me.role === 'supervision')" to="/admin/groups" class="btn-ghost">Grupos</router-link>
      <router-link v-if="me && (me.role === 'superadmin' || me.role === 'supervision' || me.role === 'leader_group')" to="/admin/units" class="btn-ghost">Unidades</router-link>
      <router-link to="/admin/users" class="btn-ghost">Usuarios</router-link>
      <router-link to="/admin/agents" class="btn-ghost">Agentes</router-link>
      <router-link to="/perfil" class="btn-ghost flex items-center gap-1">
        Perfil
      </router-link>
      <button @click="logout" class="btn-ghost">Cerrar sesión</button>
    </nav>
  </div>


</header>


    <main class="max-w-6xl mx-auto px-2 sm:px-4 py-4 space-y-5">
      <!-- Filtros -->
      <div class="card mb-2">
        <div class="card-body">
          <div class="flex flex-col gap-4 sm:grid sm:grid-cols-4 sm:items-end">
            <div>
              <label class="label">Fecha</label>
              <input type="date" v-model="date" class="input" />
            </div>
            <div class="flex gap-2 sm:col-span-2">
              <button @click="applyFilters" class="btn-primary flex-1 sm:flex-none">Aplicar</button>
              <button @click="descargarExcel" class="btn-ghost flex-1 sm:flex-none">Descargar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- KPIs en columna en mobile -->
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

      <!-- Agentes sin grupo + filtro de grupos -->
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="kpi bg-white flex-1">
          <div class="card-body">
            <h4>Agentes sin grupo</h4>
            <div class="value text-amber-600 font-bold text-xl">{{ agentesLibres }}</div>
          </div>
        </div>
        <!-- Filtro de grupos adaptativo -->
        <div class="flex-1">
          <label class="label block mb-1">Filtrar grupos en mapa</label>
          <Multiselect
            v-model="gruposSeleccionados"
            :options="grupos"
            :multiple="true"
            :close-on-select="false"
            :clear-on-select="false"
            :preserve-search="false"
            :searchable="false"
            :show-labels="false"
            placeholder="Selecciona grupos..."
            label="name"
            track-by="id"
            :preselect-first="false"
            @input="onChangeGrupos"
            class="w-full"
          >
            <template #selection="{ values }">
              <span class="text-brand-700 font-medium">{{ values.length }} seleccionados</span>
            </template>
          </Multiselect>
          <div class="text-xs text-slate-400 mt-1">Puedes seleccionar uno o varios grupos</div>
        </div>
      </div>

      <!-- Mapa -->
      <div class="card">
        <div class="card-body">
          <h3 class="font-semibold mb-3 text-slate-700">Mapa de ubicación de agentes</h3>
          <div id="mapa-agentes"
            style="height:300px;min-height:200px;width:100%;border-radius:12px;box-shadow:0 2px 8px #0001;background:#eee;"
            class="relative z-0"
          ></div>
        </div>
      </div>

      <!-- Cumplimiento por corte -->
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

      <!-- Tabla de reportes -->
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
    </main>
  </div>
</template>


<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.css'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'



const me = ref(null)
const drawerOpen = ref(false);


async function loadMe() {
  try {
    const { data } = await axios.get('/me', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    me.value = data
  } catch { me.value = null }
}

async function descargarExcel() {
  // Prepara los filtros (usa los mismos que para cargar)
  const params = {
    date: date.value,
  }
  if (me.value?.role === 'leader_group') {
    params.groupId = me.value.groupId
  }
  if (me.value?.role === 'leader_unit') {
    params.unitId = me.value.unitId
  }

  // Llama al endpoint
  const { data } = await axios.get('/reports/export', {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })

  // Reemplaza campos vacíos/null/undefined por "N/A"
  const normalizado = data.map(row => {
    const newRow = {}
    for (const key in row) {
      let value = row[key]
      // Verifica null, undefined, string vacío, etc.
      if (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        value = 'N/A'
      }
      newRow[key] = value
    }
    return newRow
  })

  // Convierte el resultado a hoja Excel
  const ws = XLSX.utils.json_to_sheet(normalizado)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'DatosNovedades')

  // Descarga el archivo
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([wbout], { type: "application/octet-stream" }), `novedades_${params.date}.xlsx`)
}



function groupLabel(option) {
  // Para mostrar código y nombre
  return `${option.code} - ${option.name}`
}

function seleccionarTodosGrupos() {
  gruposSeleccionados.value = grupos.value.slice()
}
function deseleccionarTodosGrupos() {
  gruposSeleccionados.value = []
}






const today = new Date().toISOString().slice(0,10)
const date = ref(today)        // un solo día
const agentesLibres = ref(0)
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

const grupos = ref([]) // Todos los grupos cargados del backend
const gruposSeleccionados = ref([]) // Ids seleccionados para el filtro
const cargado = ref(false)

async function loadMapData() {
  // Si el usuario es líder de grupo, llama SIN parámetro groups
  if (me.value && me.value.role === 'leader_group') {
    const { data } = await axios.get('/admin/agent-municipalities', {
      params: { date: date.value },
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    municipalitiesMap.value = data || []
    setTimeout(drawMap, 120)
    return
  }
  // Para admin/supervision: multiselección normal
  if (!gruposSeleccionados.value.length) {
    municipalitiesMap.value = []
    setTimeout(drawMap, 120)
    return
  }
  const groupsParam = gruposSeleccionados.value.map(g => g.id).join(',')
  const { data } = await axios.get('/admin/agent-municipalities', {
    params: {
      date: date.value,
      groups: groupsParam
    },
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  municipalitiesMap.value = data || []
  setTimeout(drawMap, 120)
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

// === CARGAR AGENTES LIBRES ===
async function loadAgentesLibres() {
  let params = { limit: 9999 }

  // Si es líder de grupo, filtra por su grupo y SIN unidad
  if (me.value && me.value.role === 'leader_group' && me.value.groupId) {
    params.groupId = me.value.groupId
  }

  const { data } = await axios.get('/admin/agents', {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })

  if (me.value && me.value.role === 'leader_group') {
    // Solo agentes de SU grupo sin unidad
    agentesLibres.value = (data || []).filter(a => !a.unitId).length
  } else {
    // Admin/supervision: todos los agentes sin grupo
    agentesLibres.value = (data || []).filter(a => a.groupId == null || a.groupId === 0).length
  }
}


function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toISOString().substring(11, 16)
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

import { useRouter } from 'vue-router'
const router = useRouter()
function goToGroupDetail(r) {
  router.push(`/admin/report/${r.id}`)
}

async function load() {
  let params = {
    date_from: date.value,
    date_to: date.value,
  }

  // Si es líder de grupo, filtra por su groupId
  if (me.value && me.value.role === 'leader_group' && me.value.groupId) {
    params.groupId = me.value.groupId
  }

  const { data } = await axios.get('/dashboard/reports', {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  rows.value = data.items || []
  recalcTotals()
}


// Cumplimiento
const compliance = ref({ done: [], pending: [] })


async function loadCompliance() {
  let url = '/dashboard/compliance'
  let params = { date: date.value }

  // Si es líder de grupo, usa el nuevo endpoint
  if (me.value && me.value.role === 'leader_group' && me.value.groupId) {
    url = '/dashboard/compliance-units'
    params.groupId = me.value.groupId
  }

  const { data } = await axios.get(url, {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  compliance.value = { done: data.done || [], pending: data.pending || [] }
}



// Botón "Aplicar"
async function applyFilters() {
  await load()
  await loadCompliance()
  // Selecciona todos los grupos SIEMPRE al filtrar:
  gruposSeleccionados.value = grupos.value.slice()
  await loadMapData()
  await loadAgentesLibres()
}



function onChangeGrupos() {
  loadMapData()
}




// Cargar al montar
onMounted(async () => {
  await loadMe()
  await loadGrupos()

  // Si es líder de grupo, selecciona SOLO su grupo
  if (me.value && me.value.role === 'leader_group') {
    gruposSeleccionados.value = grupos.value.filter(g => g.id === me.value.groupId)
  } else {
    gruposSeleccionados.value = grupos.value.slice() // Todos seleccionados por defecto
  }
  cargado.value = true

  await load()
  await loadCompliance()
  await loadMapData()
  await loadAgentesLibres()
})


// Nueva función:
async function loadGrupos() {
  const { data: gruposData } = await axios.get('/admin/groups', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  grupos.value = Array.isArray(gruposData) ? gruposData : []
}



// Logout
function logout(){
  localStorage.removeItem('token')
  window.location.href = '/login'
}
</script>
