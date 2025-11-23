<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- Título -->
    <header class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">
          Proyección general de descanso
        </h1>
        <p class="text-sm text-slate-500">
          Vista para administrador, supervisión y líder de grupo (todas las unidades)
        </p>
      </div>
    </header>

    <!-- BLOQUE DE CONSULTA (SOLO FECHAS) -->
    <section class="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <!-- Fecha desde -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Desde
          </label>
          <input
            type="date"
            v-model="from"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
        </div>

        <!-- Fecha hasta -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Hasta
          </label>
          <input
            type="date"
            v-model="to"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
          @click="consultarProyeccion"
          :disabled="loading"
        >
          <span v-if="!loading">Consultar proyección</span>
          <span v-else>Cargando…</span>
        </button>

        <p class="text-xs text-slate-500">
          Selecciona un rango de fechas para ver la proyección consolidada.
        </p>
      </div>

      <p v-if="error" class="text-xs text-red-500">
        {{ error }}
      </p>
    </section>

    <!-- FILTROS SECUNDARIOS SOBRE LA CONSULTA -->
    <section
      v-if="loaded && items.length"
      class="bg-white border border-slate-200 rounded-xl p-4 space-y-4"
    >
      <h2 class="text-sm font-semibold text-slate-800">
        Filtros sobre la consulta actual
      </h2>

      <div class="grid gap-4 md:grid-cols-4">
        <!-- Grupo -->
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Grupo
          </label>
          <select
            v-model="filtroGrupo"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            <option value="">Todos</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">
              {{ g.name }}
            </option>
          </select>
        </div>

        <!-- Unidad -->
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Unidad
          </label>
          <select
            v-model="filtroUnidad"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            <option value="">Todas</option>
            <option v-for="u in units" :key="u.id" :value="u.id">
              {{ u.name }}
            </option>
          </select>
        </div>

        <!-- Estado -->
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Estado
          </label>
          <select
            v-model="filtroEstado"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            <option value="">Todos</option>
            <option v-for="s in estadosUnicos" :key="s" :value="s">
              {{ s }}
            </option>
          </select>
        </div>

        <!-- Buscador por funcionario -->
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Buscar funcionario
          </label>
          <input
            v-model="filtroTexto"
            type="text"
            placeholder="Código o nombre"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
        </div>
      </div>

      <p class="text-xs text-slate-500">
        {{ groupedAgents.length }} funcionarios · {{ filtered.length }} registros en total.
      </p>
    </section>

    <!-- LISTA AGRUPADA POR FUNCIONARIO -->
    <section v-if="loaded">
      <div v-if="!items.length" class="text-sm text-slate-500">
        No hay proyección en el rango seleccionado.
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="agent in groupedAgents"
          :key="agent.agentId"
          class="bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          <!-- CABECERA DEL FUNCIONARIO (CLICK PARA VER DETALLE) -->
          <button
            type="button"
            class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
            @click="toggleAgent(agent.agentId)"
          >
            <div>
              <div class="text-sm font-semibold text-slate-900">
                {{ agent.agentCode }} — {{ agent.agentNickname || 'Sin alias' }}
              </div>
              <div class="text-xs text-slate-500">
                {{ agent.unitName }} · {{ agent.segments.length }} tramos
              </div>
            </div>
            <svg
              class="size-4 text-slate-400 transition-transform"
              :class="expandedAgentId === agent.agentId ? 'rotate-180' : ''"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <!-- DETALLE: TRAMOS + LÍNEA DE TIEMPO / CALENDARIO -->
          <div v-if="expandedAgentId === agent.agentId" class="border-t border-slate-200 px-4 py-3 space-y-4">
            <!-- Tabla de tramos -->
            <div class="overflow-x-auto rounded-lg border border-slate-100">
              <table class="min-w-full text-xs">
                <thead class="bg-slate-800 text-white uppercase tracking-wide">
                  <tr>
                    <th class="text-left px-3 py-1.5">Rango</th>
                    <th class="text-left px-3 py-1.5">Estado</th>
                    <th class="text-left px-3 py-1.5">Destino</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="seg in agent.segments"
                    :key="seg.id"
                    class="border-t border-slate-100"
                  >
                    <td class="px-3 py-1.5 whitespace-nowrap">
                      {{ seg.start_date }} → {{ seg.end_date }}
                    </td>
                    <td class="px-3 py-1.5">
                      <span class="inline-flex items-center rounded-full bg-sky-50 text-sky-700 px-2 py-0.5 text-[11px] font-medium">
                        {{ seg.state }}
                      </span>
                    </td>
                    <td class="px-3 py-1.5 text-[11px] text-slate-600">
                      <div v-if="seg.destGroupName || seg.destUnitName">
                        <span v-if="seg.destGroupName">Grupo: {{ seg.destGroupName }}</span>
                        <span v-if="seg.destUnitName">
                          <span v-if="seg.destGroupName"> · </span>
                          Unidad: {{ seg.destUnitName }}
                        </span>
                      </div>
                      <span v-else class="italic text-slate-400">Sin cambio</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- LÍNEA DE TIEMPO / CALENDARIO DÍA A DÍA -->
            <div class="space-y-1">
              <div class="text-xs font-semibold text-slate-700">
                Línea de tiempo en el rango seleccionado
              </div>
              <div class="text-[11px] text-slate-500 mb-1">
                Cada recuadro es un día ({{ from }} → {{ to }}), coloreado según el estado.
              </div>
              <div class="overflow-x-auto">
                <div class="flex gap-1 min-w-max">
                  <div
                    v-for="day in buildDayCellsForAgent(agent)"
                    :key="day.date"
                    class="flex flex-col items-center"
                  >
                    <div
                      class="w-7 h-7 rounded-md text-[10px] flex items-center justify-center border"
                      :class="stateColorClass(day.state)"
                      :title="day.date + (day.state ? ' — ' + day.state : '')"
                    >
                      {{ day.day }}
                    </div>
                    <div class="mt-0.5 text-[9px] text-slate-400">
                      {{ day.label }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { http } from '../lib/http'

// Parámetros globales de consulta
const from = ref('')
const to = ref('')

// Resultado crudo del backend
const items = ref([])
const loaded = ref(false)
const loading = ref(false)
const error = ref('')

// Catálogos
const groups = ref([])
const units = ref([])

// Filtros secundarios
const filtroGrupo = ref('')
const filtroUnidad = ref('')
const filtroEstado = ref('')
const filtroTexto = ref('')

// Funcionario expandido
const expandedAgentId = ref(null)

// Cargar catálogos (grupos y unidades)
async function loadCatalogs () {
  try {
    const [gRes, uRes] = await Promise.all([
      http.get('/rest-planning/groups'),
      http.get('/rest-planning/units')
    ])

    groups.value = gRes.data || []
    units.value = uRes.data || []
  } catch (e) {
    console.error('Error cargando catálogos', e)
  }
}

// Estados únicos (para el select de estado)
const estadosUnicos = computed(() => {
  const set = new Set(items.value.map(i => i.state))
  return [...set].sort()
})

// Lista filtrada (por grupo, unidad, estado, texto)
const filtered = computed(() => {
  return items.value.filter(r => {
    if (filtroGrupo.value && r.agentGroupId !== Number(filtroGrupo.value)) return false
    if (filtroUnidad.value && r.unitId !== Number(filtroUnidad.value)) return false
    if (filtroEstado.value && r.state !== filtroEstado.value) return false

    if (filtroTexto.value) {
      const q = filtroTexto.value.toLowerCase()
      const code = String(r.agentCode || '').toLowerCase()
      const nick = String(r.agentNickname || '').toLowerCase()
      if (!code.includes(q) && !nick.includes(q)) return false
    }

    return true
  })
})

// Agrupar por funcionario
const groupedAgents = computed(() => {
  const map = new Map()

  for (const r of filtered.value) {
    if (!map.has(r.agentId)) {
      map.set(r.agentId, {
        agentId: r.agentId,
        agentCode: r.agentCode,
        agentNickname: r.agentNickname,
        unitName: r.unitName,
        agentGroupId: r.agentGroupId,
        segments: []
      })
    }
    map.get(r.agentId).segments.push(r)
  }

  // ordenar tramos por fecha dentro de cada agente
  for (const ag of map.values()) {
    ag.segments.sort((a, b) => a.start_date.localeCompare(b.start_date))
  }

  // ordenar agentes por código
  return Array.from(map.values()).sort((a, b) =>
    String(a.agentCode || '').localeCompare(String(b.agentCode || ''))
  )
})

function toggleAgent (id) {
  expandedAgentId.value = expandedAgentId.value === id ? null : id
}

async function consultarProyeccion () {
  error.value = ''
  loaded.value = false
  items.value = []

  if (!from.value || !to.value) {
    error.value = 'Seleccione un rango de fechas (desde y hasta).'
    return
  }

  loading.value = true
  try {
    const params = { from: from.value, to: to.value }
    const { data } = await http.get('/rest-planning', { params })
    items.value = data.items || []
    loaded.value = true
    expandedAgentId.value = null
  } catch (e) {
    console.error('Error consultando proyección', e)
    error.value = 'No se pudo cargar la proyección.'
  } finally {
    loading.value = false
  }
}

// Helper: construir "calendario" / línea de tiempo para un agente
function buildDayCellsForAgent (agent) {
  const result = []
  if (!from.value || !to.value) return result

  const d1 = new Date(from.value)
  const d2 = new Date(to.value)

  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return result

  // Función helper para formato YYYY-MM-DD
  const ymd = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
    const dateStr = ymd(d)
    const dayNum = d.getDate()
    const label = monthLabels[d.getMonth()]

    const seg = agent.segments.find(s => dateStr >= s.start_date && dateStr <= s.end_date)
    result.push({
      date: dateStr,
      day: dayNum,
      label,
      state: seg ? seg.state : ''
    })
  }

  return result
}

// Clase de color según estado (muy simple; puedes ajustar colores por tipo)
function stateColorClass (state) {
  if (!state) return 'bg-white text-slate-400 border-slate-200'
  const s = String(state).toUpperCase()
  if (s.includes('PERMISO')) return 'bg-amber-50 text-amber-800 border-amber-300'
  if (s.includes('COMISIÓN')) return 'bg-emerald-50 text-emerald-800 border-emerald-300'
  if (s.includes('DESCANSO')) return 'bg-sky-50 text-sky-800 border-sky-300'
  return 'bg-slate-50 text-slate-700 border-slate-300'
}

onMounted(() => {
  loadCatalogs()
})
</script>
