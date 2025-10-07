<template>
<div class="space-y-4"> <!-- Este div es el "stack" vertical de tus tarjetas -->
  <!-- KPIs de novedades -->
  <h1 class="text-lg font-bold mb-2">PARTE</h1>
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
  <h1 class="text-lg font-bold mb-2">CUMPLEAÑOS</h1>
  <div class="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
    <!-- Gráfico 1 -->
    <div class="card flex flex-col p-6 h-[340px]">
      <h2 class="text-lg font-bold mb-2">Reporte por día</h2>
      <Bar :data="barData" :options="barOptions" class="flex-1" />
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
</template>

<script setup>
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

// === Modal (dummy, reemplaza por modal real si lo tienes) ===
function openNovModal() {
  alert('Aquí iría el detalle de novedades');
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
