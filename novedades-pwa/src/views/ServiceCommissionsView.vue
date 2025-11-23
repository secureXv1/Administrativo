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
            Administra las comisiones de servicio validadas por vigencia (ej. DIC25), ajusta fechas
            dentro de la vigencia y cambia su estado.
          </p>
        </div>
      </div>
    </div>

    <div class="max-w-[1500px] mx-auto px-4 -mt-6 pb-10">
      <!-- Panel de vigencias + estado -->
      <div class="bg-white rounded-2xl shadow border border-slate-200 p-4 mb-4 space-y-4">
        <!-- Fila 1: seleccionar vigencia + estado -->
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="flex-1 min-w-[220px]">
            <label class="text-xs font-medium text-slate-700 mb-1 block">
              Vigencia
            </label>
            <select
              v-model="selectedVigenciaId"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200 bg-white"
            >
              <option value="">Selecciona una vigencia…</option>
              <option
                v-for="p in periods"
                :key="p.id"
                :value="p.id"
              >
                {{ p.name }} — {{ p.from }} → {{ p.to }}
              </option>
            </select>
            <p v-if="loadingPeriods" class="text-[11px] text-slate-400 mt-1">
              Cargando vigencias…
            </p>
            <p v-else-if="currentPeriod" class="text-[11px] text-slate-500 mt-1">
              Rango: <strong>{{ currentPeriod.from }}</strong> → <strong>{{ currentPeriod.to }}</strong>
            </p>
          </div>

          <div class="flex items-end gap-3">
            <div>
              <label class="text-xs font-medium text-slate-700 mb-1 block">
                Estado
              </label>
              <select
                v-model="statusFilter"
                class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Todos los estados</option>
                <option value="DRAFT">Borrador</option>
                <option value="APROBADA">Aprobadas</option>
                <option value="ANULADA">Anuladas</option>
              </select>
            </div>

            <button
              class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
              @click="loadCommissions"
              :disabled="loadingCommissions || !selectedVigenciaId"
            >
              {{ loadingCommissions ? 'Cargando…' : 'Actualizar' }}
            </button>
          </div>
        </div>

        <!-- Fila 2: crear nueva vigencia -->
        <div class="border-t border-slate-200 pt-4">
          <h3 class="text-xs font-semibold text-slate-700 mb-2">
            Crear nueva vigencia
          </h3>
          <div class="grid gap-3 md:grid-cols-[minmax(0,1fr),repeat(3,minmax(0,1fr))] items-end">
            <div>
              <label class="text-xs font-medium text-slate-700 mb-1 block">
                Nombre (ej: DIC25)
              </label>
              <input
                type="text"
                v-model="newPeriod.name"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
                placeholder="DIC25"
              >
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700 mb-1 block">
                Desde
              </label>
              <input
                type="date"
                v-model="newPeriod.from"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
              >
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700 mb-1 block">
                Hasta
              </label>
              <input
                type="date"
                v-model="newPeriod.to"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
              >
            </div>
            <div class="flex justify-end">
              <button
                class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                @click="createVigencia"
                :disabled="creatingPeriod"
              >
                {{ creatingPeriod ? 'Creando…' : 'Crear vigencia' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Comisiones reales (editable por gastos) -->
      <section class="bg-white rounded-2xl shadow border border-slate-200">
        <header class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 class="text-slate-900 font-semibold text-sm">
              Comisiones certificadas (gastos)
            </h2>
            <p class="text-xs text-slate-500">
              Rango real que se reconocerá como comisión de servicio dentro de la vigencia seleccionada.
              Puedes ajustar fechas (subvigencias) siempre que se mantengan dentro de la vigencia y la proyección,
              y cambiar su estado.
            </p>
          </div>
        </header>

        <div class="p-3">
          <div v-if="!selectedVigenciaId" class="text-sm text-slate-500">
            Selecciona una vigencia para ver las comisiones certificadas.
          </div>
          <div v-else-if="loadingCommissions" class="text-sm text-slate-500">
            Cargando comisiones…
          </div>
          <div v-else-if="!commissions.length" class="text-sm text-slate-500">
            No hay comisiones registradas para la vigencia seleccionada y el estado filtrado.
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
import { ref, onMounted, watch, computed } from 'vue'

const commissions = ref([])
const loadingCommissions = ref(false)

const statusFilter = ref('')
const msg = ref('')
const msgOk = ref(false)

// Vigencias
const periods = ref([])              // { id, name, from, to, created_at }
const selectedVigenciaId = ref('')
const loadingPeriods = ref(false)

const newPeriod = ref({
  name: '',
  from: '',
  to: ''
})
const creatingPeriod = ref(false)

function displayCategory (c) {
  return String(c || '') === 'SO' ? 'ME' : c
}

function countDays (start, end) {
  if (!start || !end) return 0
  const d1 = new Date(start + 'T00:00:00')
  const d2 = new Date(end + 'T00:00:00')
  const ms = d2.getTime() - d1.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1
}

function statusPillClass (status) {
  if (status === 'APROBADA') { return 'bg-emerald-100 text-emerald-800 border border-emerald-200' }
  if (status === 'ANULADA') { return 'bg-rose-100 text-rose-800 border border-rose-200' }
  return 'bg-slate-100 text-slate-800 border border-slate-200'
}

const currentPeriod = computed(() =>
  periods.value.find(p => p.id === selectedVigenciaId.value) || null
)

async function fetchPeriods () {
  loadingPeriods.value = true
  try {
    const { data } = await axios.get('/rest-planning/periods', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    const items = Array.isArray(data?.items) ? data.items : []
    periods.value = items.map(p => ({
      id: p.id,
      name: p.name || `Vigencia #${p.id}`,
      from: String(p.from_date).slice(0, 10),
      to: String(p.to_date).slice(0, 10),
      created_at: p.created_at || null
    }))

    // autoseleccionar la más reciente si no hay ninguna
    if (!selectedVigenciaId.value && periods.value.length) {
      selectedVigenciaId.value = periods.value[0].id
    }
  } catch (e) {
    console.error('[fetchPeriods] error', e)
    periods.value = []
  } finally {
    loadingPeriods.value = false
  }
}

async function loadCommissions () {
  if (!selectedVigenciaId.value) {
    commissions.value = []
    return
  }
  loadingCommissions.value = true
  msg.value = ''
  try {
    const { data } = await axios.get('/service-commissions', {
      params: {
        vigenciaId: selectedVigenciaId.value,
        status: statusFilter.value || undefined
      },
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    commissions.value = Array.isArray(data?.items)
      ? data.items.map(c => ({
          ...c,
          start_date: String(c.start_date).slice(0, 10),
          end_date: String(c.end_date).slice(0, 10)
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
async function saveRow (c) {
  msg.value = ''
  msgOk.value = false
  try {
    await axios.put(`/service-commissions/${c.id}`, {
      start_date: c.start_date,
      end_date: c.end_date,
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
async function changeStatus (c, newStatus) {
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

// Crear nueva vigencia
async function createVigencia () {
  msg.value = ''
  msgOk.value = false

  const name = String(newPeriod.value.name || '').trim()
  const from = newPeriod.value.from
  const to = newPeriod.value.to

  if (!name || !from || !to) {
    msg.value = 'Nombre, desde y hasta son requeridos para crear una vigencia.'
    msgOk.value = false
    return
  }

  if (to < from) {
    msg.value = 'La fecha final no puede ser menor que la inicial.'
    msgOk.value = false
    return
  }

  creatingPeriod.value = true
  try {
    const { data } = await axios.post('/rest-planning/periods', {
      name,
      from,
      to
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })

    const newId = data?.id
    if (newId) {
      // recargar lista de vigencias o inyectar la nueva
      await fetchPeriods()
      selectedVigenciaId.value = newId
      await loadCommissions()
      msg.value = `Vigencia ${name} creada correctamente.`
      msgOk.value = true

      // limpiar formulario
      newPeriod.value.name = ''
      newPeriod.value.from = ''
      newPeriod.value.to = ''
    } else {
      msg.value = 'No se pudo crear la vigencia.'
      msgOk.value = false
    }
  } catch (e) {
    console.error('[createVigencia] error', e)
    msg.value = e?.response?.data?.error || 'Error al crear vigencia'
    msgOk.value = false
  } finally {
    creatingPeriod.value = false
  }
}

onMounted(async () => {
  await fetchPeriods()
  if (selectedVigenciaId.value) {
    await loadCommissions()
  }
})

// Refiltrar comisiones cuando cambie el statusFilter
watch(statusFilter, async () => {
  if (selectedVigenciaId.value) {
    await loadCommissions()
  }
})

// Cuando cambie la vigencia seleccionada, recargar comisiones
watch(selectedVigenciaId, async () => {
  msg.value = ''
  msgOk.value = false
  if (selectedVigenciaId.value) {
    await loadCommissions()
  } else {
    commissions.value = []
  }
})
</script>
