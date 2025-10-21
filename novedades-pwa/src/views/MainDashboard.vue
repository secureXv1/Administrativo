<template>
<div class="space-y-4"> <!-- Este div es el "stack" vertical de tus tarjetas -->
  <!-- KPIs de novedades -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
    <div class="kpi card-body">
      <h4>FE total (OF/ME/PT)</h4>
      <div class="value text-lg">
        {{ kpiFE }}
        <span class="text-sm text-slate-500"> ({{ feTotalDash }})</span>
      </div>
    </div>
    <div class="kpi card-body">
      <h4>FD total (OF/ME/PT)</h4>
      <div class="value text-lg">
        {{ kpiFD }}
        <span class="text-sm text-slate-500"> ({{ fdTotalDash }})</span>
      </div>
    </div>
    <div class="kpi card-body">
      <div class="flex items-center justify-between gap-2">
        <h4>Novedades totales (OF/ME/PT)</h4>
        <button class="btn-ghost h-8 px-2 text-xs" @click="openNovModal">Detalles</button>
      </div>
      <div class="value text-lg">
        {{ kpiNOV }}
        <span class="text-sm text-slate-500"> ({{ novTotalDash }})</span>
      </div>
    </div>
  </div>
  <div class="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
    <!-- Gráfico 1 -->
    <div class="card flex flex-col p-6 h-[340px]">
      <FechasBanner
        top-offset="top-14"
        color="amber"  
      />
    </div>
    <!-- Gráfico 2 -->
    <div class="card flex flex-col p-6 h-[340px]">
      <h2 class="text-lg font-bold mb-2">Reporte por día</h2>
      <Bar :data="barData" :options="barOptions" class="flex-1" />
    </div>
    <!-- Gráfico 3 -->
    <div class="card flex flex-col p-6 h-[340px]">
      <h2 class="text-lg font-bold mb-2">Estados</h2>
      <Pie :data="pieData" :options="pieOptions" class="flex-1" />
  </div>
</div>

</div>

<!-- Modal de novedades -->
<div v-if="novModalOpen" class="fixed inset-0 z-[9998] grid place-items-center bg-black/40 p-4">
  <div class="bg-white rounded-xl shadow-xl max-w-3xl w-full relative border border-slate-200">
    <button class="absolute top-3 right-4 text-2xl text-slate-600" @click="novModalOpen=false">×</button>
    <div class="p-5">
      <h2 class="text-xl font-bold mb-4">Detalle de novedades</h2>
      <div class="mb-3 flex gap-2">
        <button class="btn-ghost px-3 py-1 rounded-lg border" :class="novTab==='tipos' && 'bg-slate-200 font-semibold'" @click="novTab='tipos'">Por tipo</button>
        <button class="btn-ghost px-3 py-1 rounded-lg border" :class="novTab==='ambito' && 'bg-slate-200 font-semibold'" @click="novTab='ambito'">Por {{ isAdminView ? 'grupo' : 'unidad' }}</button>
      </div>

      <div v-if="novTab === 'tipos'" class="overflow-x-auto">
        <table class="table w-full text-sm">
          <thead>
            <tr>
              <th>Tipo de novedad</th>
              <th>OF</th>
              <th>ME</th>
              <th>PT</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in novTiposRows" :key="row.novedad">
              <td>{{ row.novedad }}</td>
              <td>{{ row.OF }}</td>
              <td>{{ row.ME }}</td>
              <td>{{ row.PT }}</td>
              <td class="font-semibold">{{ row.total }}</td>
            </tr>
            <tr v-if="novTiposRows.length === 0">
              <td colspan="5" class="text-center text-slate-400 py-4">Sin novedades</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table w-full text-sm">
          <thead>
            <tr>
              <th>{{ isAdminView ? 'Grupo' : 'Unidad' }}</th>
              <th>OF</th>
              <th>ME</th>
              <th>PT</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in novAmbitoRows" :key="row.label">
              <td>{{ row.label }}</td>
              <td>{{ row.OF }}</td>
              <td>{{ row.ME }}</td>
              <td>{{ row.PT }}</td>
              <td class="font-semibold">{{ row.total }}</td>
            </tr>
            <tr v-if="novAmbitoRows.length === 0">
              <td colspan="5" class="text-center text-slate-400 py-4">Sin novedades</td>
            </tr>
          </tbody>
        </table>

        <!-- Cards de desglose por novedad (si quieres un nivel más de detalle) -->
        <div class="mt-4 grid gap-4 sm:grid-cols-2" v-if="novAmbitoCards.length">
          <div v-for="card in novAmbitoCards" :key="card.label" class="bg-slate-50 border rounded-lg p-3 shadow-sm">
            <div class="font-semibold text-slate-700 mb-2">{{ card.label }}</div>
            <table class="table w-full text-xs">
              <thead>
                <tr>
                  <th>Novedad</th>
                  <th>OF</th>
                  <th>ME</th>
                  <th>PT</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in card.items" :key="row.novedad">
                  <td>{{ row.novedad }}</td>
                  <td>{{ row.OF }}</td>
                  <td>{{ row.ME }}</td>
                  <td>{{ row.PT }}</td>
                  <td>{{ row.total }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>


</template>

<script setup>
import FechasBanner from '@/components/FechasBanner.vue'
import { Bar, Pie } from 'vue-chartjs'
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'

import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

// === Utilidad: fecha actual en formato YYYY-MM-DD ===
function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
const fechaActual = ref(todayStr())

// === KPIs ===
const tot = ref({ OF_FE:0, SO_FE:0, PT_FE:0, OF_FD:0, SO_FD:0, PT_FD:0, OF_N:0, SO_N:0, PT_N:0 })

const kpiFE  = computed(() => `${tot.value.OF_FE}/${tot.value.SO_FE}/${tot.value.PT_FE}`)
const kpiFD  = computed(() => `${tot.value.OF_FD}/${tot.value.SO_FD}/${tot.value.PT_FD}`)
const kpiNOV = computed(() => `${tot.value.OF_N}/${tot.value.SO_N}/${tot.value.PT_N}`)

const feTotalDash  = computed(() => tot.value.OF_FE + tot.value.SO_FE + tot.value.PT_FE)
const fdTotalDash  = computed(() => tot.value.OF_FD + tot.value.SO_FD + tot.value.PT_FD)
const novTotalDash = computed(() => tot.value.OF_N + tot.value.SO_N + tot.value.PT_N)

// === Cargar datos reales del backend ===
async function loadKpiData() {
  try {
    const params = { date_from: fechaActual.value, date_to: fechaActual.value }
    const { data } = await axios.get('/dashboard/reports', {
      params,
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    const items = Array.isArray(data?.items) ? data.items : []
    // Sumatorias por categoría
    const sum = { OF_FE:0, SO_FE:0, PT_FE:0, OF_FD:0, SO_FD:0, PT_FD:0, OF_N:0, SO_N:0, PT_N:0 }
    for (const r of items) {
      sum.OF_FE += r.OF_effective||0
      sum.SO_FE += r.SO_effective||0
      sum.PT_FE += r.PT_effective||0
      sum.OF_FD += r.OF_available||0
      sum.SO_FD += r.SO_available||0
      sum.PT_FD += r.PT_available||0
      sum.OF_N  += r.OF_nov||0
      sum.SO_N  += r.SO_nov||0
      sum.PT_N  += r.PT_nov||0
    }
    tot.value = sum
  } catch (err) {
    console.error('Error cargando KPIs:', err)
    tot.value = { OF_FE:0, SO_FE:0, PT_FE:0, OF_FD:0, SO_FD:0, PT_FD:0, OF_N:0, SO_N:0, PT_N:0 }
  }
}

// ===== Modal Novedades
// Modal y pestañas
const novModalOpen = ref(false)
const novTab = ref('tipos') // 'tipos' | 'ambito'
const novTiposRows = ref([])   // [{ novedad, OF, ME, PT, total }]
const novAmbitoRows = ref([])  // [{ label,  OF, ME, PT, total }]
const novAmbitoDetRows = ref([]) // [{ label, novedad, OF, ME, PT, total }]

function sum(list, key) {
  return list.reduce((a, b) => a + (Number(b[key])||0), 0)
}

// Determina si es vista admin o solo de unidad
const isAdminView = computed(() => {
  // Lógica para saber si el usuario ve varios grupos/unidades. 
  // Puedes adaptar este return según tus props, user, o route.
  return true // Cambia esto según tu contexto (en AdminDashboard es true, en MainDashboard usualmente false)
})

// Filtros genéricos para el modal (ajusta las keys si usas otros nombres en MainDashboard)
function buildCommonParams() {
  // Adapta estos params para tu contexto; date, grupo, unidad...
  const params = { date: date.value }
  if (selectedGroupId?.value && selectedGroupId.value !== 'all')
    params.groupId = selectedGroupId.value
  if (selectedUnitId?.value && selectedUnitId.value !== 'all')
    params.unitId = selectedUnitId.value
  return params
}

// Cards agrupadas por ámbito
const novAmbitoCards = computed(() => {
  const map = new Map()
  for (const r of novAmbitoDetRows.value) {
    const label = r.label || r.groupCode || r.unitName || '—'
    if (!map.has(label)) map.set(label, [])
    map.get(label).push({
      novedad: r.novedad,
      OF: Number(r.OF || r.OF_count || 0),
      ME: Number(r.ME || r.SO || r.SO_count || 0),
      PT: Number(r.PT || r.PT_count || 0),
      total: (Number(r.OF || r.OF_count || 0)
            + Number(r.ME || r.SO || r.SO_count || 0)
            + Number(r.PT || r.PT_count || 0))
    })
  }
  const out = []
  for (const [label, items] of map.entries()) {
    const clean = items.filter(i => String(i.novedad).toUpperCase() !== 'SIN NOVEDAD')
                       .sort((a,b)=> b.total - a.total)
    out.push({ label, items: clean })
  }
  return out.sort((a,b)=> String(a.label).localeCompare(String(b.label)))
})

function openNovModal() {
  novModalOpen.value = true
  novTab.value = 'tipos'
  loadNovDetails()
}

async function loadNovDetails() {
  const params = buildCommonParams()

  // 1) Por tipo (global)
  const { data: tipos } = await axios.get('/dashboard/novelties-by-type', {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  novTiposRows.value = (tipos?.items || [])
    .filter(r => String(r.novedad || '').trim().toUpperCase() !== 'SIN NOVEDAD')
    .map(r => ({
      novedad: r.novedad,
      OF: Number(r.OF || r.OF_count || 0),
      ME: Number(r.ME || r.SO || r.SO_count || 0),
      PT: Number(r.PT || r.PT_count || 0),
      total: (Number(r.OF || r.OF_count || 0)
            + Number(r.ME || r.SO || r.SO_count || 0)
            + Number(r.PT || r.PT_count || 0))
    }))

  // 2) Por ámbito (grupo/unidad)
  const scopeUrl = isAdminView.value ? '/dashboard/novelties-by-group' : '/dashboard/novelties-by-unit'
  const { data: amb } = await axios.get(scopeUrl, {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  novAmbitoRows.value = (amb?.items || []).map(r => ({
    label: r.label || r.groupCode || r.unitName,
    OF: Number(r.OF || r.OF_count || 0),
    ME: Number(r.ME || r.SO || r.SO_count || 0),
    PT: Number(r.PT || r.PT_count || 0),
    total: (Number(r.OF || r.OF_count || 0)
          + Number(r.ME || r.SO || r.SO_count || 0)
          + Number(r.PT || r.PT_count || 0))
  }))

  // 3) Por ámbito con detalle por novedad
  const bdUrl = isAdminView.value
    ? '/dashboard/novelties-by-group-breakdown'
    : '/dashboard/novelties-by-unit-breakdown'
  const { data: det } = await axios.get(bdUrl, {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  novAmbitoDetRows.value = (det?.items || []).filter(
    r => String(r.novedad || '').trim().toUpperCase() !== 'SIN NOVEDAD'
  )
}


onMounted(() => {
  loadKpiData()
})



Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

const barData = {
  labels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
  datasets: [
    {
      label: 'Reportes',
      backgroundColor: '#0ea5e9',
      data: [12, 19, 8, 17, 14]
    }
  ]
}

const barOptions = {
  responsive: true,
  plugins: {
    legend: { display: false },
    title: { display: false }
  }
}

const pieData = {
  labels: ['Activos', 'Inactivos', 'Pendientes'],
  datasets: [
    {
      backgroundColor: ['#0ea5e9', '#38bdf8', '#fbbf24'],
      data: [50, 30, 20]
    }
  ]
}

const pieOptions = {
  responsive: true,
  plugins: {
    legend: { position: 'bottom' }
  }
}
</script>

<style scoped>
.card {
  @apply bg-white/80 border border-slate-200 rounded-2xl shadow;
}
</style>
