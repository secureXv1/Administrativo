<template>
  <div class="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Gráfico de barras dummy -->
    <div class="card p-6">
      <h2 class="text-lg font-bold mb-2">Reporte por día</h2>
      <Bar :data="barData" :options="barOptions" />
    </div>
    <!-- Gráfico de pastel dummy -->
    <div class="card p-6">
      <h2 class="text-lg font-bold mb-2">Estados</h2>
      <Pie :data="pieData" :options="pieOptions" />
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
