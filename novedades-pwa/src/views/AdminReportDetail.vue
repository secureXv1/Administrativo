<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold">Detalle de Reporte</h1>
        <button @click="router.back()" class="btn-ghost">Volver</button>
      </div>
    </header>
    <main class="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div v-if="loading" class="text-center py-12 text-brand-700 font-semibold">Cargando...</div>
      <div v-else-if="!reporte" class="text-center py-12 text-red-500">Reporte no encontrado</div>
      <div v-else>
        <div class="card mb-4">
          <div class="card-body">
            <div class="flex flex-wrap gap-6 items-center">
              <div><b>Grupo:</b> <span class="text-brand-700">{{ reporte.groupCode }}</span></div>
              <div><b>Fecha:</b> {{ reporte.date }}</div>
              <div><b>Corte:</b> {{ prettyCorte(reporte.checkpoint) }}</div>
            </div>
          </div>
        </div>

        <div class="card mb-6">
          <div class="card-body overflow-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Ubicación</th>
                  <th>Novedad (inicio - fin)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in agentes" :key="a.id">
                  <td>{{ a.code }}</td>
                  <td>{{ a.category }}</td>
                  <td>
                    <span v-if="['LABORANDO','SERVICIO'].includes(a.state)" class="text-green-700 font-semibold">{{ a.state }}</span>
                    <span v-else class="text-amber-800 font-semibold">{{ a.state }}</span>
                  </td>
                  <td>
                    <span v-if="a.state === 'LABORANDO' || a.state === 'SERVICIO'">{{ a.municipality || '—' }}</span>
                    <span v-else class="text-slate-400">N/A</span>
                  </td>
                  <td>
                    <span v-if="a.state !== 'LABORANDO' && a.state !== 'SERVICIO'">
                        <template v-if="a.novelty_start && a.novelty_end">
                        {{ formatDate(a.novelty_start) }} – {{ formatDate(a.novelty_end) }}
                        </template>
                        <template v-else-if="a.novelty_start">
                        {{ formatDate(a.novelty_start) }}
                        </template>
                        <template v-else>
                        <span class="text-slate-300">—</span>
                        </template>
                    </span>
                    <span v-else class="text-slate-300">—</span>
                    </td>

                </tr>
                <tr v-if="!agentes.length">
                  <td colspan="5" class="text-center text-slate-500 py-6">Sin agentes</td>
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

function prettyCorte(hhmm) {
  const h = parseInt((hhmm || '00:00').slice(0, 2), 10)
  if (h >= 6 && h <= 12) return 'Mañana (AM)'
  if (h >= 13 && h <= 23) return 'Tarde (PM)'
  return hhmm
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  // Asegura que d es válido
  if (isNaN(d)) return ''
  // Pad con ceros
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}


onMounted(async () => {
  loading.value = true
  try {
    // Trae los reportes (puedes optimizar para traer uno solo si tienes endpoint individual)
    const { data } = await axios.get('/dashboard/reports', {
      params: { date_from: '', date_to: '', checkpoint: '', id: route.params.id }, // puedes ajustar filtros
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    // Busca el reporte
    reporte.value = (data.items || []).find(r => String(r.id) === String(route.params.id))
    // Trae agentes del detalle
    if (reporte.value) {
      const { data: ags } = await axios.get(`/admin/report-agents/${route.params.id}`, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      agentes.value = ags.map(a => ({
        ...a,
        municipality: a.municipalityName ? `${a.municipalityName} (${a.dept})` : ''
      }))
    }
  } catch (e) {
    reporte.value = null
  } finally {
    loading.value = false
  }
})
</script>
