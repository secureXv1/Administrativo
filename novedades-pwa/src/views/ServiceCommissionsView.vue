<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Hero / encabezado -->
    <div class="bg-gradient-to-r from-slate-800 to-slate-700">
      <div class="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
        <div>
          <h1 class="text-white text-2xl font-semibold">
            Comisiones de servicio certificadas
          </h1>
          <p class="text-slate-300 text-sm mt-1">
            Aquí ves y editas las comisiones de servicio que ya fueron validadas desde gastos.
          </p>
        </div>
      </div>
    </div>

    <div class="max-w-[1500px] mx-auto px-4 -mt-6 pb-10">
      <!-- Filtros -->
      <div class="bg-white rounded-2xl shadow border border-slate-200 p-4 mb-4">
        <div class="grid gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))] items-end">
          <div>
            <label class="text-xs font-medium text-slate-700 mb-1 block">Desde</label>
            <input
              type="date"
              v-model="filtro.from"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
            >
          </div>
          <div>
            <label class="text-xs font-medium text-slate-700 mb-1 block">Hasta</label>
            <input
              type="date"
              v-model="filtro.to"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
            >
          </div>
          <div class="flex gap-2 justify-end">
            <button
              class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-800 hover:bg-slate-900"
              @click="loadCommissions"
            >
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <!-- Comisiones reales (editable por gastos) -->
      <section class="bg-white rounded-2xl shadow border border-slate-200">
        <header class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 class="text-slate-900 font-semibold text-sm">Comisiones certificadas (gastos)</h2>
            <p class="text-xs text-slate-500">
              Rango real que se reconocerá como comisión de servicio. Aquí puedes ajustar fechas y estado.
            </p>
          </div>
          <select
            v-model="statusFilter"
            class="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="APROBADA">Aprobadas</option>
            <option value="ANULADA">Anuladas</option>
          </select>
        </header>

        <div class="p-3">
          <div v-if="loadingCommissions" class="text-sm text-slate-500">Cargando comisiones…</div>
          <div v-else-if="!commissions.length" class="text-sm text-slate-500">
            No hay comisiones registradas en el rango seleccionado.
          </div>
          <div v-else class="overflow-auto rounded-xl border border-slate-200">
            <table class="min-w-full text-xs">
              <thead class="bg-slate-900 text-white">
                <tr>
                  <th class="text-left px-3 py-2 font-semibold">Agente</th>
                  <th class="text-left px-3 py-2 font-semibold">Rango real</th>
                  <th class="text-left px-3 py-2 font-semibold">Destino</th>
                  <th class="text-left px-3 py-2 font-semibold">Días</th>
                  <th class="text-left px-3 py-2 font-semibold">Estado</th>
                  <th class="text-left px-3 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody class="bg-white">
                <tr
                  v-for="c in commissions"
                  :key="c.id"
                  class="border-t border-slate-100"
                >
                  <td class="px-3 py-2">
                    <div class="font-semibold text-slate-900">
                      {{ c.agentCode }}
                      <span class="text-[11px] text-slate-500">
                        ({{ displayCategory(c.agentCategory) }})
                      </span>
                    </div>
                    <div v-if="c.agentNickname" class="text-[11px] text-slate-500">
                      "{{ c.agentNickname }}"
                    </div>
                    <div class="text-[11px] text-slate-400">
                      {{ c.unitName || '-' }}
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-1">
                        <input
                          type="date"
                          v-model="c.start_date"
                          class="w-28 rounded-md border border-slate-300 px-2 py-1 text-[11px] focus:ring-1 focus:ring-indigo-200"
                        >
                        <span class="text-[11px]">→</span>
                        <input
                          type="date"
                          v-model="c.end_date"
                          class="w-28 rounded-md border border-slate-300 px-2 py-1 text-[11px] focus:ring-1 focus:ring-indigo-200"
                        >
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-[11px]">
                    <div v-if="c.destGroupName || c.destUnitName">
                      {{ c.destGroupName || 'Grupo' }} / {{ c.destUnitName || 'Unidad' }}
                    </div>
                    <div v-else class="text-slate-400">Sin destino explícito</div>
                  </td>
                  <td class="px-3 py-2 text-[11px]">
                    {{ countDays(c.start_date, c.end_date) }}
                  </td>
                  <td class="px-3 py-2">
                    <span
                      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      :class="statusPillClass(c.status)"
                    >
                      {{ c.status }}
                    </span>
                    <div class="mt-1 flex flex-wrap gap-1">
                      <button
                        v-for="st in ['DRAFT','APROBADA','ANULADA']"
                        :key="st"
                        type="button"
                        class="px-2 py-0.5 rounded-md border text-[10px]"
                        :class="c.status === st
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'"
                        @click="changeStatus(c, st)"
                      >
                        {{ st }}
                      </button>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <button
                      class="px-3 py-1 rounded-lg text-[11px] font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 mr-1"
                      @click="saveRow(c)"
                    >
                      Guardar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="msg" class="px-4 pb-3 text-xs" :class="msgOk ? 'text-emerald-700' : 'text-rose-700'">
          {{ msg }}
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import { ref, onMounted, watch } from 'vue'

const filtro = ref({
  from: '',
  to: ''
})

const commissions = ref([])

const loadingCommissions = ref(false)

const statusFilter = ref('')
const msg = ref('')
const msgOk = ref(false)

function displayCategory(c) {
  return String(c || '') === 'SO' ? 'ME' : c
}

function countDays(start, end) {
  if (!start || !end) return 0
  const d1 = new Date(start + 'T00:00:00')
  const d2 = new Date(end   + 'T00:00:00')
  const ms = d2.getTime() - d1.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1
}

function statusPillClass(status) {
  if (status === 'APROBADA') return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
  if (status === 'ANULADA')  return 'bg-rose-100 text-rose-800 border border-rose-200'
  return 'bg-slate-100 text-slate-800 border border-slate-200'
}

async function loadCommissions() {
  if (!filtro.value.from || !filtro.value.to) {
    commissions.value = []
    return
  }
  loadingCommissions.value = true
  msg.value = ''
  try {
    const { data } = await axios.get('/service-commissions', {
      params: {
        from: filtro.value.from,
        to: filtro.value.to,
        status: statusFilter.value || undefined
      },
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    commissions.value = Array.isArray(data?.items)
      ? data.items.map(c => ({
          ...c,
          start_date: String(c.start_date).slice(0, 10),
          end_date:   String(c.end_date).slice(0, 10)
        }))
      : []
  } catch (e) {
    console.error(e)
    msg.value = e?.response?.data?.error || 'Error al cargar comisiones'
    msgOk.value = false
    commissions.value = []
  } finally {
    loadingCommissions.value = false
  }
}

// Guardar cambios de una fila (fechas, destino, etc.)
async function saveRow(c) {
  msg.value = ''
  msgOk.value = false
  try {
    await axios.put(`/service-commissions/${c.id}`, {
      start_date: c.start_date,
      end_date:   c.end_date,
      state: c.state || 'COMISIÓN DEL SERVICIO',
      destGroupId: c.destGroupId || null,
      destUnitId: c.destUnitId || null,
      municipalityId: c.municipalityId || null
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    msg.value = `Comisión actualizada para ${c.agentCode}`
    msgOk.value = true
    await loadCommissions()
  } catch (e) {
    console.error(e)
    msg.value = e?.response?.data?.error || 'Error al actualizar comisión'
    msgOk.value = false
  }
}

// Cambiar status (DRAFT / APROBADA / ANULADA)
async function changeStatus(c, newStatus) {
  if (c.status === newStatus) return
  msg.value = ''
  msgOk.value = false
  try {
    await axios.patch(`/service-commissions/${c.id}/status`, {
      status: newStatus
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    c.status = newStatus
    msg.value = `Estado actualizado a ${newStatus} para ${c.agentCode}`
    msgOk.value = true
  } catch (e) {
    console.error(e)
    msg.value = e?.response?.data?.error || 'Error al cambiar estado'
    msgOk.value = false
  }
}

// Inicializar con un rango por defecto (ej: mes actual)
function initRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const first = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDate = new Date(y, m, 0).getDate()
  const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`
  filtro.value.from = first
  filtro.value.to = last
}

onMounted(async () => {
  initRange()
  await loadCommissions()
})

// Refiltrar comisiones cuando cambie el statusFilter
watch(statusFilter, async () => {
  await loadCommissions()
})
</script>
