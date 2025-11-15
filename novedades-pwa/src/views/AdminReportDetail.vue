<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold text-lg sm:text-2xl">
          {{ isGroupMode ? 'Detalle de reporte del grupo' : 'Detalle de reporte de unidad' }}
        </h1>
        <button @click="router.back()" class="btn-ghost">Volver</button>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-2 sm:px-4 py-6 space-y-4">
      <div v-if="loading" class="text-center py-12 text-brand-700 font-semibold">Cargando...</div>
      <div v-else-if="!headerOk" class="text-center py-12 text-gray-500">No se encontró información para esta fecha!</div>

      <template v-else>
        <!-- Filtros: Fecha + Unidad -->
        <div class="card mb-3">
          <div class="card-body grid grid-cols-1 sm:grid-cols-6 gap-3 sm:items-end">
            <div>
              <label class="label">Fecha</label>
              <input type="date" v-model="filterDate" class="input" @change="onChangeDate" />
            </div>
            <div>
              <label class="label">Grupo</label>
              <!-- Solo para superadmin/supervision es editable -->
              <select v-model="selectedGroupId" class="input" :disabled="isLeaderGroup">
                <option value="all" v-if="!isLeaderGroup">Todos</option>
                <option v-for="g in grupos" :key="g.id" :value="String(g.id)">
                  {{ g.code }} ({{ g.name }})
                </option>
              </select>
              
            </div>
            <div class="sm:col-span-3">
              <label class="label">Unidad</label>
              <select v-model="filterUnitId" class="input" @change="onChangeUnit">
                <option value="">Todas las unidades…</option>
                <option v-for="u in unitOptions" :key="u.id" :value="String(u.id)">
                  {{ u.name }}
                </option>
              </select>
              <p v-if="!unitOptions.length" class="text-xs text-slate-500 mt-1">
                No hay unidades para la fecha seleccionada.
              </p>
            </div>

            
          </div>
        </div>

        <!-- Filtros -->
        <div class="card">
          <div class="card-body">
            <div class="grid grid-cols-1 sm:grid-cols-6 gap-2 sm:items-end">
              <div>
                <label class="label">Búsqueda</label>
                <input v-model="filters.q" class="input" placeholder="Código o texto…" />
              </div>
              <div>
                <label class="label">Categoría</label>
                <select v-model="filters.category" class="input">
                  <option value="ALL">Todas</option>
                  <option value="OF">OF</option>
                  <option value="SO">ME</option>
                  <option value="PT">PT</option>
                </select>
              </div>
              <div>
                <label class="label">Estado</label>
                <select v-model="filters.state" class="input">
                  <option value="ALL">Todos</option>
                  <option v-for="s in estadosValidos" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
              
              <div class="flex items-center gap-2 mt-2 sm:mt-0">
                <input id="solo-nov" type="checkbox" v-model="filters.onlyNovelties" class="h-4 w-4" />
                <label class="label cursor-pointer" for="solo-nov">Solo novedades</label>
              </div>
              <div class="flex gap-2">
                
                <button             class="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700" @click="exportarExcel">Descargar</button>
              </div>
            </div>

            <!-- Resumen por estado -->
            <div class="mt-4 flex flex-wrap gap-2">
              <span v-for="chip in resumenChips" :key="chip.key"
                    class="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm"
                    :class="chip.cls">
                <span class="inline-block w-2.5 h-2.5 rounded-full" :class="chip.dot"></span>
                {{ chip.label }}: <b>{{ chip.count }}</b>
              </span>
            </div>
          </div>
        </div>

        <!-- Tabla -->
        <div class="card">
          <div class="card-body overflow-x-auto p-0">
            <table class="table min-w-full text-xs sm:text-sm">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Agente</th>
                  <th>Cat</th>
                  <th v-if="isGroupMode">Grupo</th>
                  <th v-if="isGroupMode">Unidad</th>
                  <th>Novedad</th>
                  <th>Ubicación</th>
                  <th>Descripción</th>
                  <th>Misión</th>
                  <th>Inicio - Fin</th>
                  <th>Días Lab</th>
                  <th>Historial</th>
                  <th v-if="canEdit" class="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in agentesFiltrados" :key="a._key">
                  <td class="font-medium text-slate-900">{{ a.code }}</td>
                   <td>{{ a.nickname || '—' }}</td>
                  <td>{{ displayCat(a.category) }}</td>
                  <td v-if="isGroupMode"><span class="text-slate-700">{{ a.groupCode || '—' }}</span></td>
                  <td v-if="isGroupMode"><span class="text-slate-700">{{ a.unitName || '—' }}</span></td>
                  <td>
                    <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border"
                          :class="badgeClass(a.state)">
                      {{ displayState(a.state) }}
                    </span>
                  </td>
                  <td>{{ a.municipality || 'N/A' }}</td>
                  <td>{{ a.novelty_description || '—' }}</td>
                  <td>
                    <div
                      class="line-clamp-1 max-w-[180px] text-slate-800 text-sm cursor-help"
                      :title="a.mt || '—'"
                    >
                      {{ a.mt || '—' }}
                    </div>
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
                  <td>
                    <span
                      :class="[
                        'inline-block min-w-[2.5em] text-center rounded px-1',
                        a.diasLaborados >= 45
                          ? 'bg-red-100 text-red-600 font-bold border border-red-200'
                          : a.diasLaborados >= 30
                            ? 'bg-orange-100 text-orange-700 font-semibold border border-orange-200'
                            : a.diasLaborados > 0
                              ? 'bg-green-50 text-green-700 font-semibold border border-green-200'
                              : 'text-slate-400 border border-slate-200 bg-white'
                      ]"
                      :title="a.diasLaborados >= 45
                        ? '¡Alerta! tiempo prolongado sin descanso '
                        : a.diasLaborados >= 30
                          ? 'Atención: Más de un mes sin descansar'
                          : a.diasLaborados > 0
                            ? 'Días consecutivos en servicio o sin novedad'
                            : 'Sin días laborados'"
                    >
                      {{ a.diasLaborados ?? 0 }}
                    </span>
                  </td>
                  <td v-if="canEdit" class="text-right">
                    <button class="btn-ghost p-1" title="Historial" @click="openHistory(a)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"></circle>
                      </svg>
                    </button>
                  </td>
                  <td v-if="canEdit" class="text-right">
                    <button class="btn-ghost p-1" title="Editar" @click="openEdit(a)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 2a2.828 2.828 0 0 1 4 4L7 21l-4 1 1-4Z"></path>
                      <path d="m16 5 3 3"></path>
                    </svg>
                  </button>
                  </td>
                </tr>
                <tr v-if="!agentesFiltrados.length">
                  <td
                    :colspan="isGroupMode ? (canEdit ? 14 : 13) : (canEdit ? 12 : 11)"
                    class="text-center text-slate-500 py-6"
                  >
                    Sin agentes
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal edición -->
          <div v-if="editOpen" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" @click.self="closeEdit">
            <div class="bg-white rounded-xl shadow max-w-2xl w-full">
              <div class="p-4 border-b flex items-center justify-between">
                <div class="font-semibold text-slate-800">
                  Editar agente — {{ editRow?.code }}
                </div>
                <button class="btn-ghost" @click="closeEdit">Cerrar</button>
              </div>

              <div class="p-4 space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label class="label">Estado</label>
                    <select v-model="form.state" class="input">
                      <option v-for="s in estadosValidos" :key="s" :value="s">{{ s }}</option>
                    </select>
                  </div>

                  <div v-if="needsMunicipio" class="sm:col-span-2">
                    <label class="label">Municipio</label>
                    <Multiselect
                      v-model="form.municipio"
                      :options="muniOptions"
                      :loading="muniLoading"
                      :internal-search="false"
                      :clear-on-select="true"
                      :close-on-select="true"
                      :preserve-search="true"
                      :show-labels="false"
                      :allow-empty="true"
                      placeholder="Escribe para buscar…"
                      label="label"
                      track-by="id"
                      @search-change="searchMunicipios"
                      class="w-full"
                    >
                      <template #noResult>Ningún municipio encontrado</template>
                      <template #option="{ option }">
                        <div class="flex items-center justify-between w-full">
                          <span>{{ option.label }}</span>
                          <span class="text-xs text-slate-400">id: {{ option.id }}</span>
                        </div>
                      </template>
                      <template #singleLabel="{ option }">
                        <span>{{ option.label }}</span>
                      </template>
                    </Multiselect>
                    <div class="text-xs text-slate-500 mt-1">
                    </div>
                  </div>

                  <!-- Estados que requieren INICIO y FIN -->
                  <div v-if="needsFechas">
                    <label class="label">Inicio</label>
                    <input v-model="form.novelty_start" type="date" class="input" />
                  </div>
                  <div v-if="needsFechas">
                    <label class="label">Fin</label>
                    <input v-model="form.novelty_end" type="date" class="input" />
                  </div>

                  <!-- HOSPITALIZADO: solo INICIO -->
                  <div v-else-if="form.state === 'HOSPITALIZADO'">
                    <label class="label">Inicio</label>
                    <input v-model="form.novelty_start" type="date" class="input" />
                  </div>
                  <!-- ⬇️ MT en modal -->
                  <div>
                    <label class="label">MT</label>
                    <input
                      v-model="form.mt"
                      type="text"
                      class="input"
                      placeholder="MT"
                    />
                    <p class="text-[11px] text-slate-500 mt-1">Campo libre (opcional).</p>
                  </div>
                  <div v-if="needsDescripcion" class="sm:col-span-3">
                    <label class="label">Descripción</label>
                    <textarea v-model="form.novelty_description" class="input" rows="2" placeholder="Motivo / detalle..."></textarea>
                  </div>

                  <div v-if="form.state === 'SERVICIO'" class="sm:col-span-3 text-xs text-slate-500">
                    Para “SERVICIO” el municipio se fija automáticamente en Bogotá (11001).
                  </div>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button class="btn-ghost" @click="closeEdit">Cancelar</button>
                  <button class="btn-primary" @click="saveEdit" :disabled="saving">
                    {{ saving ? 'Guardando...' : 'Guardar' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

      </template>
    </main>
  </div>
  <!-- Modal Historial (Detalle de reporte) -->
  <div v-if="historyModal.open" class="fixed inset-0 z-[9998] grid place-items-center p-4">
    <div class="absolute inset-0 bg-black/40" @click="historyModal.open=false"></div>

    <div class="relative z-10 w-full max-w-5xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-200">
      <!-- Header -->
      <div class="px-5 py-4 rounded-t-2xl text-white flex items-center justify-between
                  bg-gradient-to-r from-slate-900 via-indigo-700 to-blue-600
                  dark:from-slate-950 dark:via-indigo-900 dark:to-blue-800">
        <div class="flex items-center gap-3">
          <div class="text-xl font-semibold tracking-tight">
            Historial — {{ historyModal.agent?.code }}
            <span v-if="historyModal.agent?.nickname" class="opacity-80 text-sm">({{ historyModal.agent.nickname }})</span>
          </div>
          <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs bg-white/15 text-white">
            {{ monthLabel }}
          </span>
        </div>
        <button class="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
                @click="historyModal.open=false">✕</button>
      </div>

      <!-- Controles -->
      <div class="px-5 py-3 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <button class="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                  @click="prevMonth">◀</button>
          <button class="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                  @click="todayMonth">Hoy</button>
          <button class="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                  @click="nextMonth">▶</button>

          <span class="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
            {{ monthFrom }} → {{ monthTo }}
          </span>
        </div>

        <!-- Tabs -->
        <div class="ml-auto inline-flex rounded-full p-1 bg-slate-200/70 dark:bg-slate-700/60">
          <button :class="['px-3 py-1.5 text-sm rounded-full', viewTab==='calendar' ? 'bg-white shadow-sm text-slate-900 dark:bg-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200']"
                  @click="viewTab='calendar'">Calendario</button>
          <button :class="['px-3 py-1.5 text-sm rounded-full', viewTab==='timeline' ? 'bg-white shadow-sm text-slate-900 dark:bg-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200']"
                  @click="viewTab='timeline'">Línea de tiempo</button>
        </div>
      </div>

      <!-- Body -->
      <div class="px-5 pb-5 max-h-[70vh] overflow-auto">
        <!-- Calendario -->
        <div v-if="viewTab==='calendar'">
          <div class="grid grid-cols-7 gap-2 text-xs font-medium text-slate-600 mb-1">
            <div class="text-center">L</div><div class="text-center">M</div><div class="text-center">X</div>
            <div class="text-center">J</div><div class="text-center">V</div><div class="text-center">S</div>
            <div class="text-center">D</div>
          </div>

          <div class="grid grid-cols-7 gap-2">
            <div v-for="cell in calendarCells" :key="cell.key" :title="cell.title"
                class="h-20 rounded-xl p-2 flex flex-col transition-all border border-slate-200 dark:border-slate-700 hover:shadow-md hover:-translate-y-[1px]"
                  :class="[
                  cell.state ? (colorClass(cell.state)?.bg || 'bg-slate-100') : 'bg-white dark:bg-slate-400/60',
                  cell.isToday && 'ring-2 ring-blue-500/70',
                  cell.isPadding && 'opacity-60'
                ]">
              <div class="text-[11px] font-medium opacity-60">{{ cell.day || '' }}</div>
              <div class="mt-auto text-center text-lg leading-none" v-if="cell.state">{{ iconFor(cell.state) }}</div>
              <div v-if="cell.state" class="text-[11px] text-center truncate mt-1 opacity-85">{{ shortState(cell.state) }}</div>
            </div>
          </div>
        </div>

        <!-- Línea de tiempo (todo; si es comisión, muestra municipio) -->
        <div v-else class="space-y-4 relative">
          <div class="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-slate-300 via-slate-200 to-slate-300 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700" />
          <div v-for="(s, i) in segments" :key="i" class="flex items-center gap-3 pl-4">
            <div class="w-3 h-3 rounded-full border-2 border-white shadow ring-1 ring-slate-200 dark:border-slate-900"
                :class="colorClass(s.state)?.dot || 'bg-slate-400'"></div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs shadow-sm"
                :class="colorClass(s.state)?.pill || 'bg-slate-100 text-slate-700'">
              {{ iconFor(s.state) }}
              <span>
                {{ s.state }}
                <template v-if="s.municipalityName"> — 📍 {{ s.municipalityName }}</template>
              </span>
              <span class="opacity-70">({{ s.from }} → {{ s.to }})</span>
              <span class="opacity-70">• {{ s.count }} día(s)</span>
            </div>
          </div>
        </div>

        <!-- Leyenda (solo visible en modo calendario) -->
        <div v-if="viewTab === 'calendar'" class="mt-5 flex flex-wrap gap-2 text-xs">
          <div v-for="st in legendStates" :key="st"
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs shadow-sm"
              :class="colorClass(st)?.pill || 'bg-slate-100 text-slate-700'">
            {{ iconFor(st) }} {{ shortState(st) }}
          </div>
        </div>

      </div>
    </div>
  </div>

</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.css'


// ===== Grupos (para el filtro) =====
const grupos = ref([])

async function loadGrupos() {
  try {
    const { data } = await axios.get('/admin/groups', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    grupos.value = Array.isArray(data) ? data : []
    // Opcional debug:
    // console.log("Grupos:", grupos.value)
  } catch {
    grupos.value = []
  }
}

const isLeaderGroup = computed(() => me.value && me.value.role === 'leader_group')
const selectedGroupId = ref('all')

const route = useRoute()
const router = useRouter()

const BOGOTA_DC = {
  id: 11001,
  name: 'BOGOTÁ, D.C.',
  dept: 'BOGOTÁ, D.C.',
  label() { return `${this.name} (${this.dept})` }
}

// ===== user (permisos)
const me = ref(null)
async function loadMe() {
  try {
    const { data } = await axios.get('/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
    me.value = data
  } catch { me.value = null }
}
const canEdit = computed(() => {
  const r = String(me.value?.role || '').toLowerCase()
  return ['leader_group','superadmin','supervision','supervisor'].includes(r)
})

// ===== Parámetros
const reportId   = computed(() => route.params.id ? String(route.params.id) : null)
const dateParam  = computed(() => route.query.date ? String(route.query.date) : new Date().toISOString().slice(0,10))
const groupIdQ   = computed(() => route.query.groupId ? String(route.query.groupId) : null)
const aggregateAll = ref(false)
const isGroupMode = computed(() => aggregateAll.value || !!groupIdQ.value)
const loading   = ref(true)

// ===== Estado UI
const head = ref({ groupCode:'', unitName:'', date:'—' })
const headerOk = ref(false)
const agentes = ref([])        // plano
const unitsInGroup = ref([])   // para selector unidad

// ===== Filtros
const filtrosBase = { q:'', category:'ALL', state:'ALL', unitId:'ALL', onlyNovelties:false }
const filters = ref({ ...filtrosBase })

// ===== Dominio
const estadosValidos = [
  'SIN NOVEDAD',
  'SERVICIO',
  'COMISIÓN DEL SERVICIO',
  'FRANCO FRANCO',
  'VACACIONES',
  'LICENCIA DE MATERNIDAD',
  'LICENCIA DE LUTO',
  'LICENCIA REMUNERADA',
  'LICENCIA NO REMUNERADA',
  'EXCUSA DEL SERVICIO',
  'LICENCIA PATERNIDAD',
  'PERMISO',
  'PERMISO ACTIVIDAD PERSONAL',
  'COMISIÓN EN EL EXTERIOR',
  'COMISIÓN DE ESTUDIO', 
  'SUSPENDIDO',
  'HOSPITALIZADO'
]

// === Estado de filtros (sin romper tus params existentes) ===
const filterDate   = ref(dateParam.value)                 // arranca desde query o hoy
const filterUnitId = ref(String(route.query.unitId || '')) // arranca desde query
const unitOptions  = ref([]) // [{id, name}] índice para el select

// === Helpers de fecha ===
function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
function shiftDate(yyyy_mm_dd, offsetDays) {
  const [y, m, d] = yyyy_mm_dd.split('-').map(n => parseInt(n, 10))
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() + offsetDays)
  const yy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(base.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// Índice de unidades por fecha (respeta unitId del query si viene)
async function loadUnitsIndex(date) {
  try {
    const params = { date_from: date, date_to: date }
    if (isGroupMode.value && groupIdQ.value) params.groupId = groupIdQ.value

    const { data } = await axios.get('/dashboard/reports', {
      params,
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    const items = Array.isArray(data?.items) ? data.items : []

    const map = new Map()
    for (const r of items) {
      if (r.unitId && r.unitName) {
        const key = String(r.unitId)
        if (!map.has(key)) map.set(key, { id: key, name: r.unitName })
      }
    }
    unitOptions.value = Array.from(map.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''))
    )

    
    // Respeta selección entrante desde Dashboard
    const qUnit = String(route.query.unitId || '')
    if (qUnit) {
      filterUnitId.value = qUnit
      // Si no está en las opciones del día, la agregamos para que el select la muestre
      if (!unitOptions.value.some(u => String(u.id) === qUnit)) {
        try {
          const { data: u } = await axios.get(`/admin/units/${qUnit}`, {
            headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
          })
          if (u?.id) unitOptions.value.unshift({ id: String(u.id), name: u.name || `Unidad ${u.id}` })
          else unitOptions.value.unshift({ id: qUnit, name: `Unidad ${qUnit}` })
        } catch {
          unitOptions.value.unshift({ id: qUnit, name: `Unidad ${qUnit}` })
        }
      }
    } else {
      // NO rellenar la unidad por defecto, solo dejar vacío
      filterUnitId.value = ''
    }

  } catch (e) {
    console.error('loadUnitsIndex error', e)
    unitOptions.value = []
  }
}
// Calcula reportId real para (date, unitId) y navega
async function gotoReportForUnit(date, unitId) {
  try {
    const raw = String(unitId ?? '').trim()
    const unitIdParam = /^\d+$/.test(raw) ? Number(raw) : raw

    const params = { date_from: date, date_to: date, unitId: unitIdParam }
    if (isGroupMode.value && groupIdQ.value) params.groupId = groupIdQ.value

    const { data } = await axios.get('/dashboard/reports', {
      params,
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    let items = Array.isArray(data?.items) ? data.items : []

    // Defensa: si el backend no filtró por unidad, filtramos aquí
    if (items.length) items = items.filter(r => String(r.unitId) === String(unitIdParam))

    if (!items.length) {
      // No hay reporte para esa unidad/fecha → sincroniza query y sal
      await router.replace({
        name: route.name,
        params: route.params,
        query: { ...route.query, unitId: String(unitIdParam || ''), date }
      })
      return
    }

    const target = items.sort((a, b) => String(a.id).localeCompare(String(b.id))).pop()

    await router.replace({
      name: route.name,
      params: { id: String(target.id) },
      query: { ...route.query, unitId: String(unitIdParam), date }
    })

    headerOk.value = false
    agentes.value = []
    await loadSingleReport(String(target.id))
    head.value = { ...head.value, date }
    headerOk.value = true
  } catch (e) {
    console.warn('gotoReportForUnit error:', e?.message || e)
    await router.replace({
      name: route.name,
      params: route.params,
      query: { ...route.query, unitId: String(unitId || ''), date }
    })
  }
}

// === Handlers de UI ===
async function onChangeDate() {
  const date = filterDate.value || todayStr()
  await loadUnitsIndex(date)

  if (filterUnitId.value) {
    await gotoReportForUnit(date, filterUnitId.value)
  } else {
    if (isGroupMode.value && groupIdQ.value) {
      await loadGroupReports(date, groupIdQ.value)
    } else {
      // ✅ SIN grupo/unidad -> modo TODOS
      await loadAllReports(date)
    }
    await router.replace({ name: route.name, params: route.params, query: { ...route.query, date, unitId: '' } })
    head.value = { ...head.value, date }
  }
}

async function onChangeUnit() {
  const date = filterDate.value || todayStr()
  const unitId = filterUnitId.value
  if (!unitId) {
    // Quitaste la unidad → en modo grupo vuelve a vista agregada del grupo y deja unitId vacío
    if (isGroupMode.value && groupIdQ.value) {
      await loadGroupReports(date, groupIdQ.value)
    }
    await router.replace({ name: route.name, params: route.params, query: { ...route.query, date, unitId: '' } })
    return
  }
  await gotoReportForUnit(date, unitId)
}

async function goPrevDate() {
  filterDate.value = shiftDate(filterDate.value || todayStr(), -1)
  await onChangeDate()
}
async function goNextDate() {
  filterDate.value = shiftDate(filterDate.value || todayStr(), +1)
  await onChangeDate()
}

// === Sincroniza si cambia la URL desde fuera (por ejemplo, navegación externa) ===
watch(
  () => route.query,
  async (q) => {
    const newDate = String(q.date || todayStr())
    const newUnit = String(q.unitId || '')
    const changed = (newDate !== filterDate.value) || (newUnit !== filterUnitId.value)
    if (!changed) return

    filterDate.value = newDate
    filterUnitId.value = newUnit

    await loadUnitsIndex(newDate)

    if (newUnit) {
      await gotoReportForUnit(newDate, newUnit)
    } else if (isGroupMode.value && groupIdQ.value) {
      await loadGroupReports(newDate, groupIdQ.value)
    } else {
      await loadAllReports(newDate)
    }
  }
)

watch(
  () => route.query.groupId,
  (newG) => {
    // Esto sincroniza si navegas con el browser o pegas un link
    if (newG && String(selectedGroupId.value) !== String(newG)) {
      selectedGroupId.value = String(newG)
    }
    if (!newG && selectedGroupId.value !== 'all') {
      selectedGroupId.value = 'all'
    }
  }
)

// ===== Helpers
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


function displayCat(cat) {
  const c = String(cat || '').toUpperCase()
  return c === 'SO' ? 'ME' : cat
}

//ORDENAR OF ME PT

const categoryOrder = { OF: 1, SO: 2, PT: 3 }

function categorySort(cat) {
  const c = String(cat || '').toUpperCase()
  return categoryOrder[c] || 99
}


function badgeClass(state){
  const s = String(state || '').toUpperCase()
  if (s === 'SIN NOVEDAD') return 'bg-green-50 text-green-700 border-green-200'
  if (s === 'SERVICIO' || s === 'COMISIÓN DEL SERVICIO') return 'bg-sky-50 text-sky-700 border-sky-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

// ===== Carga
async function loadSingleReport(id){
  try {
    headerOk.value = false
    agentes.value = []

    const { data: ags } = await axios.get(`/admin/report-agents/${id}`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })

    const map = (row) => ({
      ...row,
      _key: `${row.code}-${row.unitName||''}-${row.state}-${row.novelty_start||''}-${row.novelty_end||''}`,
      municipality: row.municipalityName && row.dept ? `${row.municipalityName} (${row.dept})` : (row.municipalityName || ''),
      municipalityName: row.municipalityName || null,
      municipalityDept: row.dept || null,
      municipalityId: row.municipalityId != null ? Number(row.municipalityId) : null,
      novelty_description: row.novelty_description || row.descripcion,
      reportId: id,
      mt: row.mt ?? '',
    
    })
    const list = (Array.isArray(ags) ? ags : []).map(map)

    agentes.value = list
    const first = list[0]
    const shownDate = filterDate.value || dateParam.value
    head.value = { groupCode: first?.groupCode || '', unitName: first?.unitName || '', date: shownDate }

    headerOk.value = true                 // ✅ pinta de inmediato
    setTimeout(() => { setDiasLaboradosTodos().catch(()=>{}) }, 0)  // ✅ diferido
  } catch (e) {
    console.error('loadSingleReport error:', e)
    headerOk.value = false
    agentes.value = []
  }
}

function displayState(state) {
  const s = String(state || '').toUpperCase()
  if (s === 'PERMISO ACTIVIDAD PERSONAL') return 'PERMISO'
  return state
}

async function loadGroupReports(date, groupId){
  try {
    headerOk.value = false
    agentes.value = []

    const { data } = await axios.get('/dashboard/reports', {
      params: { date_from: date, date_to: date, groupId },
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    const items = Array.isArray(data?.items) ? data.items : []
    if (!items.length) { headerOk.value = false; return }

    head.value = { groupCode: items[0].groupCode, unitName: '', date }
    unitsInGroup.value = [...new Map(items.map(r => [String(r.unitName||''), { id: r.unitId, name: r.unitName }])).values()]
                        .filter(u => !!u.id)
                        .sort((a,b)=> (a.name||'').localeCompare((b.name||'')))

    const all = []
    for (const r of items) {
      const { data: ags } = await axios.get(`/admin/report-agents/${r.id}`, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      const list = (Array.isArray(ags) ? ags : []).map(a => ({
        ...a,
        _key: `${a.code}-${a.unitName||''}-${a.state}-${a.novelty_start||''}-${a.novelty_end||''}`,
        municipality: a.municipalityName && a.dept ? `${a.municipalityName} (${a.dept})` : (a.municipalityName || ''),
        municipalityName: a.municipalityName || null,
        municipalityDept: a.dept || null,
        municipalityId: a.municipalityId != null ? Number(a.municipalityId) : null,
        novelty_description: a.novelty_description || a.descripcion,
        reportId: r.id,
        mt: a.mt ?? '',
        
      }))
      all.push(...list)
    }

    agentes.value = all
    headerOk.value = true                 // ✅ pinta de inmediato
    setTimeout(() => { setDiasLaboradosTodos().catch(()=>{}) }, 0)  // ✅ diferido
  } catch (e) {
    console.error('loadGroupReports error:', e)
    headerOk.value = false
    agentes.value = []
  }
}


// --- Función para contar días laborados ---
function contarDiasLaborados(historial) {
  const estadosValidos = ['SIN NOVEDAD', 'SERVICIO', 'COMISIÓN DEL SERVICIO' ,'PERMISO ACTIVIDAD PERSONAL']
  let count = 0
  for (let i = historial.length - 1; i >= 0; i--) {
    const st = String(historial[i]?.state || '').toUpperCase()
    if (estadosValidos.includes(st)) count++
    else break
  }
  return count
}

async function setDiasLaboradosTodos() {
  const hasta = (filterDate.value || todayStr())
  for (const agente of agentes.value) {
    try {
      const { data } = await axios.get(`/admin/agents/${agente.agentId || agente.id}/history`, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
        params: { from: '2020-01-01', to: hasta }
      })
      const historial = Array.isArray(data?.items) ? data.items : []
      agente.diasLaborados = contarDiasLaborados(historial, hasta)
    } catch {
      agente.diasLaborados = 0
    }
  }
}

// Cargar TODOS los reportes del día (sin groupId ni unitId) y aplanar agentes
async function loadAllReports(date) {
  try {
    headerOk.value = false
    agentes.value = []

    const { data } = await axios.get('/dashboard/reports', {
      params: { date_from: date, date_to: date },
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    const items = Array.isArray(data?.items) ? data.items : []

    const all = []
    for (const r of items) {
      const { data: ags } = await axios.get(`/admin/report-agents/${r.id}`, {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
      })
      const list = (Array.isArray(ags) ? ags : []).map(a => ({
        ...a,
        _key: `${a.code}-${a.unitName||''}-${a.state}-${a.novelty_start||''}-${a.novelty_end||''}`,
        municipality: a.municipalityName && a.dept ? `${a.municipalityName} (${a.dept})` : (a.municipalityName || ''),
        municipalityName: a.municipalityName || null,
        municipalityDept: a.dept || null,
        municipalityId: a.municipalityId != null ? Number(a.municipalityId) : null,
        novelty_description: a.novelty_description || a.descripcion,
        reportId: r.id,
        mt: a.mt ?? '',
        
      }))
      all.push(...list)
    }

    agentes.value = all
    head.value = { groupCode: 'Todos', unitName: '', date }
    headerOk.value = true                 // ✅ pinta de inmediato

    // ✅ calcula días en diferido para no bloquear la UI
    setTimeout(() => { setDiasLaboradosTodos().catch(()=>{}) }, 0)
  } catch (e) {
    console.error('loadAllReports error:', e)
    headerOk.value = false
    agentes.value = []
  }
}


const agentesFiltrados = computed(() => {
  let list = agentes.value.slice()
  const q = filters.value.q.trim().toUpperCase()
  if (q) {
    list = list.filter(a => {
      const code  = String(a.code || '').toUpperCase()
      const nick  = String(a.nickname || '').toUpperCase()
      const desc  = String(a.novelty_description || '').toUpperCase()
      const unit  = String(a.unitName || '').toUpperCase()
      const miss  = String(a.mission || '').toUpperCase()

      return (
        code.includes(q) ||
        nick.includes(q) ||          // 🔍 búsqueda por nickname
        desc.includes(q) ||
        unit.includes(q) ||
        miss.includes(q)
      )
    })
  }
  if (filters.value.category !== 'ALL') list = list.filter(a => String(a.category) === filters.value.category)
  if (filters.value.state !== 'ALL')    list = list.filter(a => String(a.state).toUpperCase() === filters.value.state)
  if (filters.value.onlyNovelties)      list = list.filter(a => String(a.state).toUpperCase() !== 'SIN NOVEDAD')
  if (isGroupMode.value && filters.value.unitId !== 'ALL') {
    const uName = unitsInGroup.value.find(u => String(u.id) === String(filters.value.unitId))?.name || ''
    list = list.filter(a => String(a.unitName||'') === uName)
  }

  return list.sort((a, b) => {
    const ca = categorySort(a.category)
    const cb = categorySort(b.category)
    if (ca !== cb) return ca - cb
    return String(a.code).localeCompare(String(b.code))
  })
})



// Resumen chips
const resumenChips = computed(() => {
  const cnt = { 'SIN NOVEDAD':0, 'SERVICIO':0, 'COMISIÓN DEL SERVICIO':0, otros:0 }
  for (const a of agentesFiltrados.value) {
    const s = String(a.state).toUpperCase()
    if (s === 'SIN NOVEDAD') cnt['SIN NOVEDAD']++
    else if (s === 'SERVICIO') cnt['SERVICIO']++
    else if (s === 'COMISIÓN DEL SERVICIO') cnt['COMISIÓN DEL SERVICIO']++
    else cnt.otros++
  }
  return [
    { key:'sn',  label:'Sin novedad',            count:cnt['SIN NOVEDAD'],            cls:'bg-green-50 text-green-700 border-green-200', dot:'bg-green-600' },
    { key:'srv', label:'Servicio',               count:cnt['SERVICIO'],               cls:'bg-sky-50 text-sky-700 border-sky-200',       dot:'bg-sky-600' },
    { key:'cds', label:'Comisión del servicio',  count:cnt['COMISIÓN DEL SERVICIO'],  cls:'bg-sky-50 text-sky-700 border-sky-200',       dot:'bg-sky-600' },
    { key:'oth', label:'Otros',                  count:cnt.otros,                     cls:'bg-amber-50 text-amber-800 border-amber-200', dot:'bg-amber-600' }
  ]
})

// ===== Modal edición
const editOpen = ref(false)
const editRow  = ref(null)
const saving   = ref(false)
const form     = ref({
  state:'SIN NOVEDAD',
  municipio: null,              // {id,label}
  novelty_start:'',
  novelty_end:'',
  novelty_description:''
})
const needsFechas      = computed(() => [
  'SERVICIO','VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO',
  'LICENCIA REMUNERADA','LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO',
  'LICENCIA PATERNIDAD','PERMISO','PERMISO ACTIVIDAD PERSONAL', 'COMISIÓN EN EL EXTERIOR',
  'COMISIÓN DE ESTUDIO', 'SUSPENDIDO'              
].includes(form.value.state))
const needsDescripcion = computed(() => [
  'SERVICIO','VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO',
  'LICENCIA REMUNERADA','LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO',
  'LICENCIA PATERNIDAD','PERMISO','PERMISO ACTIVIDAD PERSONAL','COMISIÓN EN EL EXTERIOR',
  'COMISIÓN DE ESTUDIO',              
  'COMISIÓN DEL SERVICIO', 'SUSPENDIDO','HOSPITALIZADO'           
].includes(form.value.state))

const needsMunicipio = computed(() => form.value.state === 'COMISIÓN DEL SERVICIO')


function openEdit(a){
  if (!canEdit.value) return
  editRow.value = a

  const state = String(a.state || '').toUpperCase()
  const isCDS = state === 'COMISIÓN DEL SERVICIO'

  // Precargar municipio SOLO para COMISIÓN DEL SERVICIO
  let selectedMuni = null
  if (isCDS) {
    const id   = a.municipalityId != null ? Number(a.municipalityId) : null
    const name = a.municipalityName || null
    const dept = a.municipalityDept || null
    if (id) {
      // inyecta (si no existe) y devuelve la opción real del array
      selectedMuni = ensureMuniInOptions(id, name, dept)
    }
  }

  form.value = {
    state,
    municipio: selectedMuni,                 // 👈 queda seleccionado
    novelty_start: a.novelty_start || '',
    novelty_end: a.novelty_end || '',
    novelty_description: a.novelty_description || '',
    mt: a.mt ?? ''
  }

  editOpen.value = true
}

watch(() => form.value.state, (newS) => {
  const s = String(newS || '').toUpperCase()
  if (s !== 'COMISIÓN DEL SERVICIO') {
    form.value.municipio = null
  } else {
    // Si entras a CDS sin opción cargada y el registro original traía municipio, vuelve a inyectarlo
    const a = editRow.value
    if (a?.municipalityId && !form.value.municipio) {
      form.value.municipio = ensureMuniInOptions(a.municipalityId, a.municipalityName, a.municipalityDept)
    }
  }
})


function closeEdit(){ editOpen.value = false; editRow.value = null }
function ensureMuniOption(id, name, dept) {
  if (!id) return
  const numId = Number(id)
  const exists = (muniOptions.value || []).some(m => Number(m.id) === numId)
  if (!exists) {
    const label = name ? `${name} (${dept || ''})` : `id: ${numId}`
    // la insertamos al inicio para que Multiselect la reconozca
    muniOptions.value.unshift({ id: numId, label })
  }
}

function selectMuniInOptionsById(id) {
  const numId = Number(id)
  const found = (muniOptions.value || []).find(m => Number(m.id) === numId)
  if (found) form.value.municipio = found
}

// ===== Autocomplete municipios
const muniOptions = ref([])
const muniLoading = ref(false)
let muniTimer = null
async function searchMunicipios(term){
  if (muniTimer) clearTimeout(muniTimer)
  muniTimer = setTimeout(async () => {
    const q = String(term || '').trim()
    if (q.length < 2) { muniOptions.value = []; return }
    muniLoading.value = true
    try {
      const { data } = await axios.get('/catalogs/municipalities', {
        params: { q, limit: 15 },
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      muniOptions.value = (data || []).map(m => ({
        id: m.id,
        label: `${m.name} (${m.dept})`
      }))
    } catch {
      muniOptions.value = []
    } finally {
      muniLoading.value = false
    }
  }, 250)
}

function ensureMuniInOptions(id, name, dept) {
  if (!id) return null
  const numId = Number(id)
  let found = muniOptions.value.find(o => Number(o.id) === numId)
  if (!found) {
    found = { id: numId, label: name ? `${name} (${dept || ''})` : `id ${numId}` }
    muniOptions.value = [found, ...muniOptions.value]
  }
  return found
}

// ===== Guardar
async function saveEdit(){
  if (!editRow.value) return

  // Reglas específicas
  if (form.value.state === 'COMISIÓN DEL SERVICIO' && !form.value.municipio?.id) {
    alert('Selecciona un municipio para Comisión del servicio')
    return
  }
  if (form.value.state === 'COMISIÓN DEL SERVICIO' && !form.value.novelty_description?.trim()) {
    alert('La descripción es requerida para Comisión del servicio')
    return
  }

  // HOSPITALIZADO: inicio + descripción (SIN fin)
  if (form.value.state === 'HOSPITALIZADO') {
    if (!form.value.novelty_start) { alert('Falta fecha de inicio (HOSPITALIZADO)'); return }
    if (!form.value.novelty_description?.trim()) { alert('Falta descripción (HOSPITALIZADO)'); return }
  }

  // Estados que requieren INICIO y FIN (incluye SUSPENDIDO)
  if (needsFechas.value) {
    if (!form.value.novelty_start || !form.value.novelty_end) {
      alert('Completa las fechas de la novedad (inicio y fin)')
      return
    }
  }

  if (needsDescripcion.value && !form.value.novelty_description?.trim()) {
    alert('La descripción es requerida para este estado')
    return
  }

  saving.value = true
  try {
    const isHosp = form.value.state === 'HOSPITALIZADO'

    await axios.put(`/admin/report-agents/${editRow.value.reportId}/${editRow.value.agentId}`, {
      state: form.value.state,
      municipalityId:
        form.value.state === 'COMISIÓN DEL SERVICIO'
          ? (form.value.municipio?.id || null)
          : (['SERVICIO','SIN NOVEDAD'].includes(form.value.state) ? BOGOTA_DC.id : null),
      novelty_start: form.value.novelty_start || null,
      novelty_end:   isHosp ? null : (form.value.novelty_end || null), // 👈 hospitalizado sin fin
      novelty_description: form.value.novelty_description || null
    }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })

    // Reflejar cambios en la tabla
    let mId = null, mName = null, mDept = null, mLabel = ''
    if (form.value.state === 'COMISIÓN DEL SERVICIO') {
      mId = form.value.municipio?.id || null
      if (form.value.municipio?.label) {
        const parts = form.value.municipio.label.split(' (')
        mName = parts[0] || null
        mDept = parts[1] ? parts[1].replace(/\)$/, '') : null
        mLabel = form.value.municipio.label
      }
    } else if (['SERVICIO','SIN NOVEDAD'].includes(form.value.state)) {
      mId = BOGOTA_DC.id
      mName = BOGOTA_DC.name
      mDept = BOGOTA_DC.dept
      mLabel = BOGOTA_DC.label()
    }

    Object.assign(editRow.value, {
      state: form.value.state,
      municipalityId: mId,
      municipalityName: mName,
      municipalityDept: mDept,
      municipality: mLabel || (mName ? `${mName} (${mDept||''})` : 'N/A'),
      novelty_start: form.value.novelty_start || null,
      novelty_end:   isHosp ? null : (form.value.novelty_end || null), // 👈 reflejo local
      novelty_description: form.value.novelty_description || null,
      mt: (form.value.mt ?? '').toString().trim() || null 
    })

    closeEdit()
  } catch (e) {
    alert(e?.response?.data?.detail || e?.response?.data?.error || 'No se pudo guardar')
  } finally {
    saving.value = false
  }
}


// ===== Acciones varias
async function reload(){ /* filtrado es client-side */ }

async function exportarExcel(){
  const rows = agentesFiltrados.value.map(a => ({
    codigo: a.code,
    categoria: a.category,
    unidad: a.unitName || '',
    estado: a.state,
    ubicacion: a.municipality || '',
    descripcion: a.novelty_description || '',
    mt: a.mt ?? '',
  
    fecha_inicio: a.novelty_start ? String(a.novelty_start).slice(0,10) : '',
    fecha_fin: a.novelty_end ? String(a.novelty_end).slice(0,10) : ''
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Detalle')
  const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' })
  saveAs(new Blob([wbout], { type:'application/octet-stream' }), `detalle_${head.value.groupCode}_${head.value.date}.xlsx`)
}

// ===== Init
onMounted(async () => {
  loading.value = true
  await loadMe()
  await loadGrupos()

  // Inicializa con lo que venga del query
  const groupIdQInit = route.query.groupId ? String(route.query.groupId) : (isLeaderGroup.value && grupos.value[0] ? String(grupos.value[0].id) : 'all')
  selectedGroupId.value = groupIdQInit

  try {
    // 1) Tomar parámetros iniciales desde el Dashboard
    const qDate = String(route.query.date || '')
    const qUnit = String(route.query.unitId || '')

    // 2) Inicializar filtros con lo que venga del Dashboard (o hoy si falta la fecha)
    filterDate.value   = qDate || dateParam.value
    filterUnitId.value = qUnit

    if (!route.query.groupId && !('unitId' in route.query)) {
     await router.replace({
       name: route.name,
       params: route.params,
      query: { ...route.query, date: filterDate.value, unitId: '' }
     })
   }

    // 3) Cargar índice de unidades respetando la selección entrante (NO pisar)
    await loadUnitsIndex(filterDate.value)

    // 4) Si vino unitId + date en la URL: calcular reportId y navegar
    if (filterUnitId.value && filterDate.value) {
      await gotoReportForUnit(filterDate.value, filterUnitId.value)
    } else {
      // 5) Si NO vino unitId (o vienes en modo grupo), mantén tu lógica anterior
      if (isGroupMode.value && groupIdQ.value) {
        await loadGroupReports(filterDate.value, groupIdQ.value)
      } else if (reportId.value) {
        await loadSingleReport(reportId.value)
        head.value = { ...head.value, date: filterDate.value }
      } else {
        await loadAllReports(filterDate.value)
      }
    }
    if (isLeaderGroup.value && grupos.value.length) {
      selectedGroupId.value = String(grupos.value[0].id)
    }
  } catch {
    headerOk.value = false
  } finally {
    loading.value = false
  }
})

watch(
  () => route.params.id,
  async (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Limpiar mientras carga (opcional, pero da feedback visual si tienes spinner)
      headerOk.value = false
      agentes.value = []
      try {
        await loadSingleReport(String(newId))
      } finally {
        headerOk.value = true
      }
    }
  }
)

watch(filterUnitId, async (newUnit, oldUnit) => {
  if (newUnit !== oldUnit) {
    await onChangeUnit()
  }
})

watch(selectedGroupId, async (newG, oldG) => {
  if (newG !== oldG) {
    await router.replace({
      name: route.name,
      params: route.params,
      query: {
        ...route.query,
        groupId: newG === 'all' ? undefined : newG,
        unitId: '', // resetea unidad
      },
    })
    await loadUnitsIndex(filterDate.value)

    if (newG !== 'all') {
      aggregateAll.value = false
      await loadGroupReports(filterDate.value, newG)
    } else {
      // ✅ volver a modo TODOS
      await loadAllReports(filterDate.value)
    }
  }
})

// ==== HISTORIAL (Detalle) ============================================
const historyModal = ref({ open: false, agent: null })
const viewTab = ref('calendar')
const historyItems = ref([])               // [{date:'YYYY-MM-DD', state, municipalityName?...}]
const monthCursor = ref(new Date())        // mes visible en el modal

function ymd(d){ return d.toISOString().slice(0,10) }
function startOfMonth(d){ const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x }
function endOfMonth(d){ const x = new Date(d); x.setMonth(x.getMonth()+1,0); x.setHours(0,0,0,0); return x }
function addMonths(d,n){ const x = new Date(d); x.setMonth(x.getMonth()+n); return x }
function monthNameES(d){ return new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric'}).format(d) }
function dowMonday0(d){ return (d.getDay()+6)%7 } // lunes=0

function startOfWeekMonday(d) {
  const x = new Date(d); x.setHours(0,0,0,0)
  const dow = (x.getDay() + 6) % 7 // lunes=0
  x.setDate(x.getDate() - dow)
  return x
}
function endOfWeekSunday(d) {
  const x = new Date(d); x.setHours(0,0,0,0)
  const dow = (x.getDay() + 6) % 7 // lunes=0
  x.setDate(x.getDate() + (6 - dow))
  return x
}

// Trae 3 meses hacia atrás hasta el mes del cursor,
// pero extendiendo a semanas completas (lun-dom) en ambos extremos.
const historyFrom = computed(() =>
  ymd(startOfWeekMonday(startOfMonth(addMonths(monthCursor.value, -2))))
)
const historyTo = computed(() =>
  ymd(endOfWeekSunday(endOfMonth(monthCursor.value)))
)

// CALENDARIO (1 mes actual con padding lun-dom)
const calendarStartDate = computed(() => startOfWeekMonday(startOfMonth(monthCursor.value)))
const calendarEndDate   = computed(() => endOfWeekSunday(endOfMonth(monthCursor.value)))

// Etiquetas visibles en el modal
const monthLabel = computed(() => monthNameES(monthCursor.value))
const monthFrom  = computed(() => ymd(calendarStartDate.value))
const monthTo    = computed(() => ymd(calendarEndDate.value))

function prevMonth(){ monthCursor.value = addMonths(monthCursor.value, -1); loadHistory() }
function nextMonth(){ monthCursor.value = addMonths(monthCursor.value, +1); loadHistory() }
function todayMonth(){ monthCursor.value = new Date((filterDate.value || todayStr()) + 'T00:00:00'); loadHistory() }

function iconFor(state){
  const s = String(state||'').toUpperCase()
  const map = {
    'SIN NOVEDAD':'✅','SERVICIO':'🧭','COMISIÓN DEL SERVICIO':'📌',
    'FRANCO FRANCO':'🛌','VACACIONES':'🏖️','LICENCIA DE MATERNIDAD':'👶',
    'LICENCIA DE LUTO':'🕊️','LICENCIA REMUNERADA':'📝','LICENCIA NO REMUNERADA':'📝',
    'EXCUSA DEL SERVICIO':'📝','LICENCIA PATERNIDAD':'🍼','PERMISO':'⏳', 'PERMISO ACTIVIDAD PERSONAL':'⏳',
    'COMISIÓN EN EL EXTERIOR':'✈️','COMISIÓN DE ESTUDIO':'🎓',
    'SUSPENDIDO':'⛔','HOSPITALIZADO':'🏥'
  }
  return map[s] || '•'
}
function colorClass(state){
  const s = String(state||'').toUpperCase()
  const c = {
    'SIN NOVEDAD'           : { bg:'bg-emerald-100', pill:'bg-emerald-100 text-emerald-800', dot:'bg-emerald-500' },
    'SERVICIO'              : { bg:'bg-sky-100',     pill:'bg-sky-100 text-sky-800',         dot:'bg-sky-500' },
    'COMISIÓN DEL SERVICIO' : { bg:'bg-indigo-100',  pill:'bg-indigo-100 text-indigo-800',   dot:'bg-indigo-500' },
    'FRANCO FRANCO'         : { bg:'bg-gray-100',    pill:'bg-gray-100 text-gray-800',       dot:'bg-gray-500' },
    'VACACIONES'            : { bg:'bg-amber-100',   pill:'bg-amber-100 text-amber-800',     dot:'bg-amber-500' },
    'SUSPENDIDO'            : { bg:'bg-rose-100',    pill:'bg-rose-100 text-rose-800',       dot:'bg-rose-500' },
    'HOSPITALIZADO'         : { bg:'bg-rose-100',    pill:'bg-rose-100 text-rose-800',       dot:'bg-rose-500' },
  }
  return c[s] || { bg:'bg-slate-100', pill:'bg-slate-100 text-slate-700', dot:'bg-slate-400' }
}
function shortState(t){ t=String(t||''); return t.length<=16?t:(t.slice(0,16)+'…') }

const legendStates = [
  'SIN NOVEDAD','SERVICIO','COMISIÓN DEL SERVICIO','VACACIONES',
  'FRANCO FRANCO','SUSPENDIDO','HOSPITALIZADO'
]

async function openHistory(agentRow){
  // agentId puede venir como agentId o id; tomamos el que exista
  const agentId = agentRow.agentId ?? agentRow.id
  if (!agentId) return

  historyModal.value = { open:true, agent: { id: agentId, code: agentRow.code, nickname: agentRow.nickname } }
  viewTab.value = 'calendar'
  // arrancar en el mes de la fecha seleccionada en este detalle
  monthCursor.value = new Date((filterDate.value || todayStr()) + 'T00:00:00')
  await loadHistory()
}
function closeHistory(){
  historyModal.value = { open:false, agent:null }
  historyItems.value = []
}

async function loadHistory(){
  if (!historyModal.value.agent) return
  try{
    const { data } = await axios.get(`/admin/agents/${historyModal.value.agent.id}/history`, {
      params: { from: historyFrom.value, to: historyTo.value },
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    historyItems.value = Array.isArray(data?.items) ? data.items : []
  } catch (e) {
    console.warn('No se pudo cargar historial:', e?.response?.data?.error || e.message)
    historyItems.value = []
  }
}

const calendarCells = computed(() => {
  const start = calendarStartDate.value
  const end   = calendarEndDate.value

  const map = new Map(historyItems.value.map(h => [String(h.date), h]))
  const cells = []

  // límites duros del MES actual (para marcar padding)
  const hardStart = startOfMonth(monthCursor.value)
  const hardEnd   = endOfMonth(monthCursor.value)

  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const key = ymd(dt)
    const rec = map.get(key)
    const state = rec?.state || null
    const title = state ? `${key} — ${state}${rec?.municipalityName ? ' — ' + rec.municipalityName : ''}` : key
    const isToday = key === ymd(new Date())
    const isPadding = (dt < hardStart) || (dt > hardEnd)

    cells.push({
      key,
      day: dt.getDate(),
      state,
      title,
      isToday,
      isPadding
    })
  }
  return cells
})


// Timeline: agrupa por estado; si es COMISIÓN DEL SERVICIO, también por municipio
const segments = computed(() => {
  const days = [...historyItems.value].sort((a,b)=> String(a.date).localeCompare(String(b.date)))
  const out = []
  for (const d of days){
    const state = (d.state || 'SIN NOVEDAD')
    const isCommission = String(state).toUpperCase() === 'COMISIÓN DEL SERVICIO'
    const muni = isCommission ? (d.municipalityName || '—') : null
    const key = isCommission ? `${state}::${muni}` : state

    const last = out[out.length-1]
    if (last && last.key === key){
      last.to = d.date
      last.count += 1
    } else {
      out.push({ key, state, municipalityName: muni, from: d.date, to: d.date, count: 1 })
    }
  }
  return out
})
// ==== /HISTORIAL =====================================================



</script>

<style scoped>
.input { @apply w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500; }
.btn-ghost { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100; }
.btn-primary { @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700; }
.card { @apply bg-white rounded-xl shadow; }
.card-body { @apply p-4; }
.table { min-width: 780px; }

/* Botón icono */


@media (max-width: 640px) {
  .card-body { padding: 1rem !important; }
  .table th, .table td { padding: 6px 4px !important; font-size: 12px !important; }
}
</style>
