<template>
  <div class="max-w-9xl mx-auto space-y-6">
    <!-- HEADER -->
    <div class="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-slate-200">
      <div class="max-w-9xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 grid place-items-center text-white font-bold">G</div>
          <div>
            <h2 class="font-semibold text-slate-900">Proyección general de descanso</h2>
            <p class="text-slate-500 text-xs">Vista para administrador, supervisión y líder de grupo (todas las unidades)</p>
          </div>
        </div>
      </div>
    </div>
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
          Selecciona un rango de fechas (idealmente un mes) para ver la matriz.
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

      <div class="grid gap-4 md:grid-cols-5">
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

        <!-- Unidad actual -->
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Unidad actual
          </label>
          <select
            v-model="filtroUnidadActual"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            <option value="">Todas</option>
            <option v-for="u in units" :key="u.id" :value="u.id">
              {{ u.name }}
            </option>
          </select>
        </div>

        <!-- Unidad proyectada -->
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Unidad proyectada
          </label>
          <select
            v-model="filtroUnidadProyectada"
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
            placeholder="Código o alias"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
        </div>
      </div>

      <p class="text-xs text-slate-500">
        {{ groupedAgents.length }} funcionarios · {{ filtered.length }} tramos proyectados.
      </p>
    </section>

    <!-- MATRIZ NICKNAME + LÍNEA DE TIEMPO VERTICAL -->
    <section v-if="loaded">
      <div v-if="!items.length" class="text-sm text-slate-500">
        No hay proyección en el rango seleccionado.
      </div>

      <div v-else class="bg-white border border-slate-200 rounded-xl overflow-auto">
        <table class="min-w-full text-[11px] border-collapse">
          <thead class="bg-amber-500 text-white sticky top-0 z-10">
            <!-- Fila de MESES -->
            <tr>
              <th
                class="px-3 py-2 text-left font-semibold w-56"
                rowspan="2"
              >
                FUNCIONARIO
              </th>

              <th
                v-for="m in monthSpans"
                :key="m.key"
                class="px-1 py-1 text-center font-semibold text-black"
                :class="monthColorClass(m.index)"
                :colspan="m.colspan"
              >
                {{ m.label }}
              </th>
            </tr>


            <!-- Fila de DÍAS -->
            <tr>
              <th
                v-for="(day, i) in dayRange"
                :key="day.date"
                class="px-1 py-1 text-center font-semibold min-w-[24px] text-black"
                :class="monthColorClass(
                  monthSpans.findIndex(m =>
                    day.date.startsWith(m.key)
                  )
                )"
              >
                {{ day.day }}
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="agent in groupedAgents"
              :key="agent.agentId"
              class="border-t border-slate-200"
            >
              <!-- Columna NICKNAME + unidad actual/proyectada -->
              <td class="px-3 py-1.5 bg-slate-100 align-top">
                <!-- NICKNAME clickable -->
                <button
                  type="button"
                  class="font-semibold text-sky-700 hover:underline block text-left truncate"
                  @click="openModal(agent)"
                >
                  {{ agent.agentNickname || 'Sin alias' }}
                </button>
                
                <!-- Unidades -->
                <div class="mt-1 text-[10px] text-slate-700">
                  <div>Act.: <span class="font-medium">{{ agent.unitName || '—' }}</span></div>
                  <div>
                    Proy.:
                    <span class="font-medium">
                      {{ projectedUnit(agent) }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Celdas día a día -->
              <td
                v-for="day in dayRange"
                :key="day.date"
                class="px-0.5 py-0.5 text-center"
              >
                <div
                  v-if="dayRange.length"
                  class="w-6 h-6 rounded-sm flex items-center justify-center border text-[10px]"
                  :class="stateColorClass(getStateCode(agent, day.date).code)"
                  :title="getStateCode(agent, day.date).full"
                >
                  {{ getStateCode(agent, day.date).code }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- LEYENDA -->
      <div class="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-700">
        <div class="flex items-center gap-1">
          <span class="w-4 h-4 rounded-sm border bg-sky-700"></span> NC — SIN NOVEDAD
        </div>
        <div class="flex items-center gap-1">
          <span class="w-4 h-4 rounded-sm border bg-emerald-500"></span> CS — COMISIÓN DEL SERVICIO
        </div>
        <div class="flex items-center gap-1">
          <span class="w-4 h-4 rounded-sm border bg-amber-400"></span> CE — COMISIÓN DE ESTUDIOS
        </div>
        <div class="flex items-center gap-1">
          <span class="w-4 h-4 rounded-sm border bg-amber-200"></span> PR — PERMISO
        </div>
        <div class="flex items-center gap-1">
          <span class="w-4 h-4 rounded-sm border bg-red-500"></span> VC — VACACIONES
        </div>
        <div class="flex items-center gap-1">
          <span class="w-4 h-4 rounded-sm border bg-orange-500"></span> SR — SERVICIO
        </div>
        <div class="flex items-center gap-1">
          <span class="w-4 h-4 rounded-sm border bg-cyan-400"></span> FR — FRANCO
        </div>
      </div>
    </section>

    <!-- MODAL: LÍNEA DE TIEMPO EDITABLE POR FUNCIONARIO -->
    <transition name="fade">
      <div
        v-if="selectedAgent"
        class="fixed inset-0 z-[2000] flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/40" @click="closeModal"></div>

        <div class="relative bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
          <!-- Header modal -->
          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-slate-900">
                Proyección — {{ selectedAgent.agentNickname || 'Sin alias' }}
              </h2>
              <p class="text-[11px] text-slate-500">
                {{ selectedAgent.agentCode }} · {{ selectedAgent.unitName }} ·
                Rango: {{ from }} → {{ to }}
              </p>
              <p class="text-[11px] text-slate-500 mt-0.5">
                Click en un día para cambiar el estado.
              </p>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-full hover:bg-slate-100"
              @click="closeModal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="size-4 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Contenido modal: línea de tiempo editable -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
                <div class="flex flex-wrap items-end gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div class="flex-1 min-w-[120px]">
                        <label class="block text-xs font-medium text-slate-700 mb-1">Desde</label>
                        <input type="date" v-model="newSegment.from" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                    </div>
                    <div class="flex-1 min-w-[120px]">
                        <label class="block text-xs font-medium text-slate-700 mb-1">Hasta</label>
                        <input type="date" v-model="newSegment.to" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                    </div>
                    <div class="flex-1 min-w-[150px]">
                      <label class="block text-xs font-medium text-slate-700 mb-1">
                        Unidad proyectada (opcional)
                      </label>
                      <select
                        v-model.number="newSegment.destUnitId"
                        class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      >
                        <option :value="null">Sin cambio</option>
                        <option
                          v-for="u in units"
                          :key="u.id"
                          :value="u.id"
                        >
                          {{ u.name }}
                        </option>
                      </select>
                    </div>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                        @click="addSegment"
                        :disabled="!newSegment.from || !newSegment.to || !newSegment.state || !newSegmentValid"
                    >
                        Añadir rango
                    </button>
                </div>

                <h3 class="text-sm font-semibold text-slate-800">
                    Línea de tiempo de proyección
                </h3>
                
                <div class="space-y-2">
                    <div
                        v-for="(segment, index) in editableSegments"
                        :key="index"
                        class="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white"
                    >
                        <div class="size-3 rounded-full flex-shrink-0" :class="stateColorClass(fullToCode[segment.state] || '')"></div>

                        <div class="flex items-center gap-2 flex-grow">
                          <input
                            type="date"
                            v-model="segment.from"
                            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 w-[120px]"
                          >
                          <span>—</span>
                          <input
                            type="date"
                            v-model="segment.to"
                            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 w-[120px]"
                          >
                          
                          <select
                            v-model="segment.state"
                            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 w-[180px]"
                          >
                            <option
                              v-for="code in stateOrder.slice(1)"
                              :key="code"
                              :value="codeToFull[code]"
                            >
                              {{ codeToFull[code] }}
                            </option>
                          </select>
                          
                          <!-- ============================= -->
                          <!-- UNIDAD / SUBUNIDAD (COMISIÓN) -->
                          <!-- ============================= -->

                          <template v-if="isCS(segment.state)">
                            <!-- Unidad padre -->
                            <select
                              v-model.number="segment.destParentUnitId"
                              @change="onChangeParent(segment)"
                              class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 w-[170px]"
                            >
                              <option :value="null">Unidad (padre)…</option>
                              <option v-for="u in units" :key="u.id" :value="u.id">
                                {{ u.name }}
                              </option>
                            </select>

                            <!-- Subunidad: solo si ese padre tiene subunidades -->
                            <select
                              v-if="segment.destParentUnitId && (getSubunits(segment.destParentUnitId).length > 0)"
                              v-model.number="segment.destSubUnitId"
                              class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 w-[170px]"
                            >
                              <option :value="null">Subunidad…</option>
                              <option
                                v-for="su in getSubunits(segment.destParentUnitId)"
                                :key="su.id"
                                :value="su.id"
                              >
                                {{ su.name }}
                              </option>
                            </select>
                          </template>

                          <!-- Estados que NO son CS -->
                          <template v-else>
                            <select
                              v-model.number="segment.destUnitId"
                              class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 w-[170px]"
                            >
                              <option :value="null">Sin cambio</option>
                              <option v-for="u in units" :key="u.id" :value="u.id">
                                {{ u.name }}
                              </option>
                            </select>
                          </template>
                        </div>

                        
                        <div class="flex items-center gap-2 flex-shrink-0 text-xs text-slate-500">
                            <span v-if="dateDifference(segment.from, segment.to) !== null">
                                {{ dateDifference(segment.from, segment.to) }} día(s)
                            </span>
                            <button type="button" @click="removeSegment(index)" class="text-red-500 hover:text-red-700 font-medium ml-2">
                                Quitar
                            </button>
                        </div>
                    </div>
                    <div v-if="!editableSegments.length" class="text-xs text-slate-500 p-2 text-center border-dashed border rounded-lg">
                        No hay rangos de proyección definidos.
                    </div>
                </div>
          </div>

          <!-- Footer modal -->
          <div class="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 hover:bg-slate-100"
              @click="closeModal"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="px-4 py-1.5 rounded-lg bg-sky-600 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
              :disabled="saving"
              @click="saveProjection"
            >
              <span v-if="!saving">Guardar proyección</span>
              <span v-else>Guardando…</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
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

const subunitsByParent = ref(new Map()) // parentId -> subunits[]
const unitById = computed(() => {
  const m = new Map()
  for (const u of units.value) m.set(u.id, u)
  // también metemos las subunidades ya cargadas
  for (const arr of subunitsByParent.value.values()) {
    for (const su of arr) m.set(su.id, su)
  }
  return m
})

async function loadSubunits(parentId) {
  if (!parentId) return []
  if (subunitsByParent.value.has(parentId)) return subunitsByParent.value.get(parentId)

  const { data } = await http.get(`/rest-planning/units/${parentId}/subunits`)
  const list = data?.items || []
  subunitsByParent.value.set(parentId, list)
  return list
}

function isCS(fullState) {
  const s = String(fullState || '').toUpperCase()
  return s.includes('COMISIÓN DEL SERVICIO') || s.includes('COMISION DEL SERVICIO')
}

function getSubunits(parentId) {
  const pid = Number(parentId || 0)
  return pid ? (subunitsByParent.value.get(pid) || []) : []
}

async function onChangeParent(segment) {
  segment.destSubUnitId = null
  if (segment.destParentUnitId) {
    await loadSubunits(segment.destParentUnitId)
  }
}

// Filtros secundarios
const filtroGrupo = ref('')
const filtroUnidadActual = ref('')
const filtroUnidadProyectada = ref('')
const filtroEstado = ref('')
const filtroTexto = ref('')

// Modal / edición
const selectedAgent = ref(null)
const editableSegments = ref([]) // Nuevo: Para almacenar los segmentos en el modal
const newSegment = ref({
  from: '',
  to: '',
  state: '',
  destUnitId: null,
  destParentUnitId: null, // unidad padre
  destSubUnitId: null     // subunidad
})
const saving = ref(false)
const modalDays = ref([]) // [{date, day, code}]

// Orden y nombres completos de estados
const stateOrder = ['', 'NC', 'CS', 'CE', 'PR', 'VC', 'SR', 'FR']
const codeToFull = {
  '': '',
  NC: 'SIN NOVEDAD',
  CS: 'COMISIÓN DEL SERVICIO',
  CE: 'COMISIÓN DE ESTUDIOS',
  PR: 'PERMISO',
  VC: 'VACACIONES',
  SR: 'SERVICIO',
  FR: 'FRANCO'
}

const fullToCode = computed(() => {
    const map = {}
    for (const [code, full] of Object.entries(codeToFull)) {
        if (code) map[full] = code
    }
    return map
})

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

// Lista filtrada (por grupo, unidad actual, unidad proyectada, estado, texto)
const filtered = computed(() => {
  return items.value.filter(r => {
    const destUnitIdRaw = r.destUnitId ?? r.dest_unit_id ?? null

    if (filtroGrupo.value && r.agentGroupId !== Number(filtroGrupo.value)) return false
    if (filtroUnidadActual.value && r.unitId !== Number(filtroUnidadActual.value)) return false
    if (filtroUnidadProyectada.value && destUnitIdRaw !== Number(filtroUnidadProyectada.value)) return false
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

// Unidad proyectada usando dest_unit_id
function projectedUnit (agent) {
  const ids = new Set()

  for (const seg of agent.segments) {
    const id = seg.destUnitId ?? seg.dest_unit_id ?? null
    if (id) ids.add(id)
  }

  if (!ids.size) return 'Sin cambio'
  if (ids.size === 1) {
    const id = [...ids][0]
    const u = units.value.find(u => u.id === id)
    return u ? u.name : `Unidad ${id}`
  }
  return 'Varias'
}

// Rango global de días (para las columnas)
// helpers
const parseYMDLocal = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d) // LOCAL (sin UTC)
}
const ymd = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Rango global de días (para las columnas)
const dayRange = computed(() => {
  const res = []
  if (!from.value || !to.value) return res

  const d1 = parseYMDLocal(from.value)
  const d2 = parseYMDLocal(to.value)
  if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return res

  for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
    res.push({ date: ymd(d), day: d.getDate() })
  }
  return res
})

const monthSpans = computed(() => {
  const fmt = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' })

  const out = []
  let currentKey = null
  let current = null
  let monthIndex = -1

  for (const d of dayRange.value) {
    const dt = new Date(d.date + 'T00:00:00')
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`

    if (key !== currentKey) {
      currentKey = key
      monthIndex++

      const label = fmt.format(dt).replace('.', '').toUpperCase()

      current = {
        key,
        label,
        colspan: 1,
        index: monthIndex
      }

      out.push(current)
    } else {
      current.colspan++
    }
  }

  return out
})

function monthColorClass(index) {
  const colors = [
    'bg-amber-200 text-amber-900',
    'bg-indigo-200 text-indigo-900',
    'bg-emerald-200 text-emerald-900',
    'bg-rose-200 text-rose-900',
    'bg-sky-200 text-sky-900',
    'bg-purple-200 text-purple-900'
  ]

  return colors[index % colors.length]
}


async function consultarProyeccion () {
  error.value = ''
  loaded.value = false
  items.value = []
  selectedAgent.value = null

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
  } catch (e) {
    console.error('Error consultando proyección', e)
    error.value = 'No se pudo cargar la proyección.'
  } finally {
    loading.value = false
  }
}

// =========================
// HELPERS PARA ESTADOS
// =========================

// Devuelve { code, full } para un agente en una fecha específica
function getStateCode (agent, dateStr) {
  const seg = agent.segments.find(
    s => dateStr >= s.start_date && dateStr <= s.end_date
  )

  const raw = seg ? String(seg.state || '') : ''
  const upper = raw.toUpperCase()

  if (!raw) {
    return { code: '', full: '' }
  }
  if (upper === 'NC' || upper.includes('SIN NOVEDAD')) {
    return { code: 'NC', full: 'SIN NOVEDAD' }
  }
  if (upper === 'CS' || upper.includes('COMISION DEL SERVICIO') || upper.includes('COMISIÓN DEL SERVICIO')) {
    return { code: 'CS', full: 'COMISIÓN DEL SERVICIO' }
  }
  if (upper === 'CE' || upper.includes('COMISION DE ESTUDIOS') || upper.includes('COMISIÓN DE ESTUDIOS')) {
    return { code: 'CE', full: 'COMISIÓN DE ESTUDIOS' }
  }
  if (upper === 'PR' || upper.includes('PERMISO')) {
    return { code: 'PR', full: 'PERMISO' }
  }
  if (upper === 'VC' || upper.includes('VACACION')) {
    return { code: 'VC', full: 'VACACIONES' }
  }
  if (upper === 'FR' || upper.includes('FRANCO')) {
    return { code: 'FR', full: 'FRANCO' }
  }
  if (upper === 'SR' || (upper.includes('SERVICIO') && !upper.includes('COMISION'))) {
    return { code: 'SR', full: 'SERVICIO' }
  }

  return { code: '', full: raw }
}

// Clases de color según código
function stateColorClass (code) {
  switch (code) {
    case 'NC': return 'bg-sky-700 text-white border-sky-900'
    case 'CS': return 'bg-emerald-500 text-white border-emerald-700'
    case 'CE': return 'bg-amber-400 text-slate-900 border-amber-600'
    case 'PR': return 'bg-amber-200 text-slate-900 border-amber-400'
    case 'VC': return 'bg-red-500 text-white border-red-700'
    case 'SR': return 'bg-orange-500 text-white border-orange-700'
    case 'FR': return 'bg-cyan-400 text-slate-900 border-cyan-600'
    default:   return 'bg-slate-100 text-slate-500 border-slate-300'
  }
}

// =========================
// MODAL / EDICIÓN
// =========================
// Calcula la diferencia en días entre dos fechas (inclusive)
function dateDifference(date1Str, date2Str) {
  const d1 = parseYMDLocal(date1Str)
  const d2 = parseYMDLocal(date2Str)
  if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return null

  // diferencia en días (inclusive)
  const diffTime = d2.getTime() - d1.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays + 1
}

// Valida si el nuevo segmento es válido para ser añadido
const newSegmentValid = computed(() => {
    if (!newSegment.value.from || !newSegment.value.to) return false
    const diff = dateDifference(newSegment.value.from, newSegment.value.to)
    return diff !== null && diff > 0
})

// =========================
// MODAL / EDICIÓN (BASADO EN RANGOS)
// =========================

async function openModal(agent) {
  selectedAgent.value = agent

  // Clonamos segmentos
  editableSegments.value = agent.segments.map(s => ({
    from: s.start_date,
    to: s.end_date,
    state: s.state,
    // lo que venga del backend
    destUnitId: s.destUnitId ?? s.dest_unit_id ?? null,
    destGroupId: s.destGroupId ?? s.dest_group_id ?? null,

    // nuevos campos UI:
    destParentUnitId: null,
    destSubUnitId: null
  }))

  // ✅ reconstruir parent/subunit cuando sea CS
  for (const seg of editableSegments.value) {
    if (!isCS(seg.state) || !seg.destUnitId) continue

    try {
      // si destUnitId es una subunidad, esto lo dirá parentUnitId
      const { data: u } = await http.get(`/rest-planning/units/${seg.destUnitId}`)

      if (u?.parentUnitId) {
        // destUnitId era subunidad
        seg.destParentUnitId = u.parentUnitId
        seg.destSubUnitId = u.id
        await loadSubunits(seg.destParentUnitId)
      } else {
        // destUnitId era unidad padre
        seg.destParentUnitId = u?.id || seg.destUnitId
        seg.destSubUnitId = null
        await loadSubunits(seg.destParentUnitId)
      }
    } catch (e) {
      console.warn('No se pudo resolver unidad/subunidad del segmento', e)
      // fallback: tratarlo como padre
      seg.destParentUnitId = seg.destUnitId
      seg.destSubUnitId = null
    }
  }

  // Init newSegment
  newSegment.value = {
    from: from.value,
    to: to.value,
    state: '',
    destParentUnitId: null,
    destSubUnitId: null
  }
}


function closeModal () {
  selectedAgent.value = null
  editableSegments.value = []
}

// Nuevo: Añade un nuevo segmento a la lista
function addSegment() {
  if (!newSegmentValid.value || !newSegment.value.state) return

  editableSegments.value.push({
    from: newSegment.value.from,
    to: newSegment.value.to,
    state: newSegment.value.state,

    // 🔥 siempre crear estos campos para que el v-model quede fijo
    destUnitId: newSegment.value.destUnitId || null,
    destParentUnitId: newSegment.value.destParentUnitId || null,
    destSubUnitId: newSegment.value.destSubUnitId || null,

    destGroupId: null
  })

  // reset completo conservando llaves
  newSegment.value = {
    from: '',
    to: '',
    state: '',
    destUnitId: null,
    destParentUnitId: null,
    destSubUnitId: null
  }

  editableSegments.value.sort((a, b) => a.from.localeCompare(b.from))
}

// Nuevo: Elimina un segmento de la lista
function removeSegment(index) {
    editableSegments.value.splice(index, 1)
}

function cycleDayState (idx) {
  const current = modalDays.value[idx].code
  const i = stateOrder.indexOf(current)
  const next = stateOrder[(i + 1) % stateOrder.length] || ''
  modalDays.value[idx].code = next || 'NC'
}

function fillAll (code) {
  modalDays.value = modalDays.value.map(d => ({ ...d, code }))
}

// Generar segmentos y enviar POST /rest-planning/bulk
// Enviar POST /rest-planning/bulk
async function saveProjection () {
  if (!selectedAgent.value) return
  saving.value = true
  try {
    // 1. Validar que no haya superposiciones ni rangos inválidos
    const validSegments = editableSegments.value
        .filter(s => s.from && s.to && s.state && dateDifference(s.from, s.to) !== null)
        .sort((a, b) => a.from.localeCompare(b.from)) // Ordenar por fecha

    if (!validSegments.length) {
        // Enviar una lista vacía para "borrar" la proyección en el rango
        // Si no hay segmentos, se asume 'NC' por defecto si no hay un segmento con el estado. 
        // Enviamos los segmentos válidos. Si se deben borrar, la API debería manejar la eliminación de los rangos existentes antes de guardar los nuevos.

    } else {
        // Validación de superposiciones simple
        for (let i = 0; i < validSegments.length - 1; i++) {
            const currentEnd = new Date(validSegments[i].to)
            const nextStart = new Date(validSegments[i+1].from)
            
            // Si el día de inicio del siguiente es menor o igual al día de fin del actual (o el día siguiente al fin del actual)
            if (nextStart.getTime() <= currentEnd.getTime()) {
                alert('Error: Los rangos de proyección se superponen o son contiguos, y no están ordenados correctamente. Por favor, revísalos.')
                saving.value = false
                return
            }
        }
    }

    const payload = {
      from: from.value,
      to: to.value,
      items: [
        {
          agentId: selectedAgent.value.agentId,
          segments: validSegments.map(s => {
            const effectiveDestUnitId = isCS(s.state)
              ? (s.destSubUnitId || s.destParentUnitId || null)
              : (s.destUnitId || null)

            const unit = effectiveDestUnitId ? unitById.value.get(effectiveDestUnitId) : null

            return {
              from: s.from,
              to: s.to,
              state: s.state,
              destUnitId: effectiveDestUnitId,
              destGroupId: unit ? unit.groupId : (s.destGroupId || null)
            }
          })
        }
      ]
    }

    await http.post('/rest-planning/bulk', payload)

    // Recargar y cerrar
    await consultarProyeccion()
    closeModal()
  } catch (e) {
    console.error('Error guardando proyección', e)
    alert('Vigencia de gatos vigente no se puede modificar la proyección')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadCatalogs()
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
