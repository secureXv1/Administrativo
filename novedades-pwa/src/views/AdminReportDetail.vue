<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold text-lg sm:text-2xl">Detalle de Reporte</h1>
        <button @click="router.back()" class="btn-ghost">Volver</button>
      </div>
    </header>
    <main class="max-w-4xl mx-auto px-2 sm:px-4 py-6 space-y-4">
      <div v-if="loading" class="text-center py-12 text-brand-700 font-semibold">Cargando...</div>
      <div v-else-if="!reporte" class="text-center py-12 text-red-500">Reporte no encontrado</div>
      <div v-else>
        <!-- Tarjeta de encabezado -->
        <div class="card mb-4">
          <div class="card-body">
            <div class="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-6 items-center text-base sm:text-lg">
              <div>
                <b>Grupo:</b> <span class="text-brand-700">{{ reporte.groupCode }}</span>
              </div>
              <div>
                <b>Unidad:</b>
                <span class="text-brand-700">{{ reporte.unitName || 'N/A' }}</span>
              </div>
              <div>
                <b>Fecha:</b> {{ reporte.date }}
              </div>
            </div>
          </div>
        </div>

        <!-- Tabla de agentes -->
        <div class="card mb-6">
          <div class="card-body overflow-x-auto p-0">
            <table class="table min-w-full text-xs sm:text-sm">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Ubicación</th>
                  <th>Descripción</th>
                  <th>Novedad (inicio - fin)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in agentes" :key="a.code">
                  <td>{{ a.code }}</td>
                  <td>{{ a.category }}</td>
                  <td>
                    <span
                      v-if="['LABORANDO','SERVICIO','SIN NOVEDAD'].includes(a.state)"
                      class="text-green-700 font-semibold"
                    >{{ a.state }}</span>
                    <span
                      v-else
                      class="text-amber-800 font-semibold"
                    >{{ a.state }}</span>
                  </td>
                  <td>
                    <span>
                      {{ a.municipality ? a.municipality : 'N/A' }}
                    </span>
                  </td>
                  <td>
                    <span>
                      {{ a.novelty_description || '—' }}
                    </span>
                  </td>
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
                <tr v-if="!agentes.length">
                  <td colspan="6" class="text-center text-slate-500 py-6">Sin agentes</td>
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
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const reporte = ref(null)
const agentes = ref([])

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

onMounted(async () => {
  loading.value = true
  try {
    // Trae el reporte resumen para encabezado (busca por ID)
    const { data } = await axios.get('/dashboard/reports', {
      params: { date_from: '', date_to: '', id: route.params.id },
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    reporte.value = (data.items || []).find(r => String(r.id) === String(route.params.id))
    // Trae agentes del detalle
    if (reporte.value) {
      const { data: ags } = await axios.get(`/admin/report-agents/${route.params.id}`, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      agentes.value = ags.map(a => ({
        ...a,
        municipality: a.municipalityName && a.dept
          ? `${a.municipalityName} (${a.dept})`
          : (a.municipalityName || ''),
        novelty_description: a.novelty_description || a.descripcion // asegúrate que el campo se llame igual
      }))
    }
  } catch (e) {
    reporte.value = null
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
@media (max-width: 640px) {
  .card-body {
    padding: 1rem !important;
  }
  .table th, .table td {
    padding: 6px 4px !important;
    font-size: 12px !important;
  }
  .flex, .flex-row, .flex-col, .flex-wrap, .items-center {
    gap: 6px !important;
  }
}
.table {
  min-width: 700px;
}
@media (max-width: 700px) {
  .table {
    min-width: 500px;
    font-size: 12px;
  }
}
</style>
