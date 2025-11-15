<template>
  <div>
    <!-- OVERLAY -->
    <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-6">
      <!-- MODAL -->
      <div
        class="w-full max-w-[100vw] sm:max-w-3xl lg:max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <!-- HEADER sticky -->
        <div class="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-3 sm:px-4 py-3 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800 text-sm sm:text-base">
            Usos — {{ vehicle.code }} ({{ vehicle.sigla }})
          </h3>
          <button class="btn-secondary btn-xs" @click="$emit('close')">Cerrar</button>
        </div>

        <!-- BODY con scroll interno -->
        <div class="px-3 sm:px-4 py-4 overflow-y-auto max-h-[90dvh]">
          <!-- ⛔ BLOQUEO POR ESTADO DEL VEHÍCULO -->
          <div
            v-if="isWrongState"
            class="mb-4 p-3 rounded-lg bg-rose-50 text-rose-800 text-sm border border-rose-200"
          >
            <strong>Este vehículo no puede iniciar usos.</strong><br>
            {{ wrongStateLabel }}.<br>
            Solo vehículos en estado <strong>SERVICIO</strong> pueden iniciar un uso o registrar novedades.
          </div>

          <!-- ⛔ 1) DOCUMENTOS VENCIDOS O SIN REGISTRAR -->
          <div v-if="hasExpiredDocs" class="mb-4 p-3 rounded-lg bg-rose-50 text-rose-800 text-sm border border-rose-200">
            <strong>Este vehículo tiene {{ expiredDocsLabel }}.</strong><br>
            No es posible iniciar nuevos usos ni registrar novedades hasta que se actualicen los documentos.
          </div>

          <!-- 🟡 2) AGENTE CON USO ABIERTO -->
          <div v-else-if="lockForAgentOpenUse" class="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm border border-amber-200">
            <strong>El agente ya tiene un uso vigente.</strong><br>
            Cierra el uso anterior para habilitar nuevos registros.
          </div>

          <!-- 🟠 3) VEHÍCULO CON USO ABIERTO -->
          <div v-else-if="hasOpenUse" class="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm border border-amber-200">
            Ya existe un uso vigente. Cierre el uso actual para habilitar un nuevo registro.
          </div>

          <!-- 🟢 4) SOLO SI TODO ESTÁ OK → MOSTRAR CROQUIS + NOVEDADES + FORMULARIO -->
          <div v-else-if="!isWrongState && !hasExpiredDocs && !hasOpenUse && !lockForAgentOpenUse">
            <!-- 🔹 Bloque de novedades previas al inicio del uso -->
            <div class="border rounded-xl p-3 bg-slate-50 mb-6">

              <h4 class="font-semibold text-slate-700 text-sm mb-3">
                Agregar una nueva novedad
              </h4>

              <!-- Picker visual + categorías internas/sistemas -->
              <div class="grid grid-cols-1 gap-3 mb-3">

                <!-- Picker visual -->
                <VehiclePartsPickerPro
                  v-model="selectedPartKey"
                  :topSrc="topSrc"
                  :leftSrc="leftSrc"
                  :rightSrc="rightSrc"
                  :highlight-keys="partKeysConNovedades"
                />

                <!-- Campo 'Otro' -->
                <div v-if="selectedPartKey === 'OTRO'">
                  <input
                    v-model="customPartName"
                    class="input w-full"
                    placeholder="Especifica la parte (ej: tapa combustible)"
                  />
                </div>

                <!-- Categorías internas / sistemas -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1 text-xs">

                  <!-- Interior -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-semibold text-slate-700">Interior</span>
                      <button
                        type="button"
                        class="text-[11px] text-slate-500 hover:underline"
                        @click="clearInternalSelection"
                        v-if="selectedInternalKey && isInternalSelection('INTERIOR')"
                      >
                        Quitar selección
                      </button>
                    </div>

                    <div class="flex flex-wrap gap-1">
                      <button
                        v-for="sec in INTERNAL_SECTIONS"
                        :key="sec.key"
                        type="button"
                        :class="[
                          'px-2 py-1 rounded-full border text-[11px] flex items-center gap-1',
                          selectedInternalKey === sec.key
                            ? 'bg-slate-900 text-white border-slate-900'
                            : internalCounts[sec.key] > 0
                              ? 'border-red-500 text-red-700 bg-red-50'
                              : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
                        ]"
                        @click="selectInternal(sec.key)"
                      >
                        {{ sec.label }}
                        <span
                          v-if="internalCounts[sec.key] > 0"
                          class="inline-flex items-center justify-center text-[10px] rounded-full bg-red-600 text-white px-1.5"
                        >
                          {{ internalCounts[sec.key] }}
                        </span>
                      </button>
                    </div>
                  </div>

                  <!-- Sistemas -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-semibold text-slate-700">Sistemas</span>
                      <button
                        type="button"
                        class="text-[11px] text-slate-500 hover:underline"
                        @click="clearInternalSelection"
                        v-if="selectedInternalKey && isInternalSelection('SISTEMA')"
                      >
                        Quitar selección
                      </button>
                    </div>

                    <div class="flex flex-wrap gap-1">
                      <button
                        v-for="sec in SYSTEM_SECTIONS"
                        :key="sec.key"
                        type="button"
                        :class="[
                          'px-2 py-1 rounded-full border text-[11px] flex items-center gap-1',
                          selectedInternalKey === sec.key
                            ? 'bg-slate-900 text-white border-slate-900'
                            : internalCounts[sec.key] > 0
                              ? 'border-red-500 text-red-700 bg-red-50'
                              : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
                        ]"
                        @click="selectInternal(sec.key)"
                      >
                        {{ sec.label }}
                        <span
                          v-if="internalCounts[sec.key] > 0"
                          class="inline-flex items-center justify-center text-[10px] rounded-full bg-red-600 text-white px-1.5"
                        >
                          {{ internalCounts[sec.key] }}
                        </span>
                      </button>
                    </div>
                  </div>

                </div>

                <!-- Etiqueta seleccionada -->
                <div v-if="scopeLabel" class="mt-2 text-xs text-slate-600">
                  <span class="text-slate-500">Seleccionado:</span>
                  <span class="ml-1 font-semibold">{{ scopeLabel }}</span>
                </div>

                <!-- Novedades de la parte elegida -->
                <div
                  v-if="scopeLabel && novsSelectedScope.length"
                  class="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs"
                >
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-semibold text-slate-700">
                      Novedades de: {{ scopeLabel }}
                    </span>
                    <button
                      type="button"
                      class="text-[11px] text-blue-600 hover:underline"
                      @click="showAllForScope = !showAllForScope"
                    >
                      {{ showAllForScope ? 'Ver menos' : 'Ver todas' }}
                    </button>
                  </div>

                  <ul class="space-y-1 max-h-32 overflow-y-auto">
                    <li
                      v-for="n in (showAllForScope ? novsSelectedScope : novsSelectedScope.slice(0,3))"
                      :key="n.id"
                      class="flex items-center justify-between gap-2"
                    >
                      <span class="truncate">• {{ n.description }}</span>

                      <div class="flex items-center gap-2 shrink-0">
                        <a
                          v-if="n.photoUrl"
                          :href="`/${n.photoUrl}`"
                          target="_blank"
                          class="text-[11px] text-blue-600 underline"
                        >
                          foto
                        </a>

                        <button
                          type="button"
                          class="text-[11px] text-rose-600 hover:underline"
                          @click="deleteNovedad(n.id)"
                        >
                          eliminar
                        </button>
                      </div>
                    </li>
                  </ul>
                </div>

              </div>

            </div> <!-- ESTE ES EL ÚNICO CIERRE CORRECTO -->

          </div> <!-- CIERRA EL v-else-if PRINCIPAL -->

          <!-- Formulario nuevo uso -->
          <div
            v-if="!isWrongState && !hasExpiredDocs && !hasOpenUse && !lockForAgentOpenUse"
            class="grid grid-cols-1 sm:grid-cols-6 gap-3 mb-4"
          >
            <div class="sm:col-span-2">
              <label class="label">Agente</label>
              <template v-if="isAgentLocked">
                <div class="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-300 bg-slate-50">
                  <span class="font-semibold">{{ preferredAgent?.code || '—' }}</span>
                  <span class="text-xs text-slate-500">
                    {{ preferredAgent?.nickname || preferredAgent?.name || '' }}
                  </span>
                </div>
              </template>
              <template v-else>
                <input v-model="form.agentCode" class="input" placeholder="Código de agente" list="agentsList" />
                <datalist id="agentsList">
                  <option v-for="a in agents" :key="a.id" :value="a.code" />
                </datalist>
              </template>
            </div>

            <div>
              <label class="label">Odómetro</label>
              <input type="number" v-model="form.odometer_start" class="input" />
              <p v-if="lastUseOdoHint != null" class="text-[11px] text-slate-500 mt-1">
                Sugerido: <span class="font-medium">{{ lastUseOdoHint }}</span>
              </p>
            </div>

            <div class="sm:col-span-3">
              <label class="label">Actividad a realizar</label>
              <textarea
                v-model="form.notes"
                rows="1"
                maxlength="500"
                class="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: Servicio, Actividad personal, etc"
              ></textarea>
            </div>

            <div class="sm:col-span-6 flex flex-col items-end gap-2">
              <button class="btn-primary" @click="createUse" :disabled="submitting">
                {{ submitting ? 'Guardando…' : 'Iniciar uso' }}
              </button>

              <div v-if="uiError" class="w-full sm:w-auto">
                <div class="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-start gap-2">
                  <span class="mt-0.5 text-sm">⚠️</span>
                  <span class="leading-snug">
                    {{ uiError }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tabla de usos (scroll horizontal en móvil) -->
          <div class="overflow-x-auto -mx-3 sm:mx-0">
            <table class="min-w-[760px] w-full text-sm">
              <thead>
                <tr class="text-left text-slate-600">
                  <th class="py-2 pr-3">Agente</th>
                  <th class="py-2 pr-3">Inicio</th>
                  <th class="py-2 pr-3">Fin</th>
                  <th class="py-2 pr-3">km inicio</th>
                  <th class="py-2 pr-3">km fin</th>
                  <th class="py-2 pr-3">Novedades</th>
                  <th class="py-2 pr-3">Actividad</th>
                  <th class="py-2 pr-3">Uso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="u in uses" :key="u.id">
                  <tr class="border-t align-top">
                    <td class="py-2 pr-3 font-medium">{{ u.agentCode }}</td>
                    <td class="py-2 pr-3">{{ u.started_at }}</td>
                    <td class="py-2 pr-3">{{ u.ended_at || '—' }}</td>
                    <td class="py-2 pr-3">{{ u.odometer_start ?? '—' }}</td>
                    <td class="py-2 pr-3">{{ u.odometer_end ?? '—' }}</td>
                    <td class="py-2 pr-0">
                      <button class="btn-secondary btn-xs ml-1" @click="toggleNovedades(u.id)">
                        {{ expandedUseId === u.id ? 'Ocultar' : 'Ver' }}
                      </button>
                    </td>
                    <td class="py-2 pr-3">
                      <span
                        v-if="u.notes?.trim()"
                        class="text-slate-700 block max-w-[260px] truncate cursor-pointer hover:underline"
                        title="Ver actividad completa"
                        @click="verNotaUso(u)"
                      >
                        {{ u.notes }}
                      </span>
                      <span v-else class="text-slate-400">—</span>
                    </td>
                    <td class="py-2 pr-0">
                      <button
                        v-if="!u.ended_at"
                        class="px-3 py-1 rounded-md text-white text-xs font-semibold bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition"
                        @click="askCloseUse(u)"
                      >
                        Finalizar uso
                      </button>
                    </td>
                  </tr>

                  <!-- Novedades inline (solo lectura) -->
                  <tr v-if="expandedUseId === u.id">
                    <td colspan="9" class="bg-slate-50 px-3 py-3">
                      <NovedadesBlock :tipo="'uses'" :refId="u.id" :canDelete="false" :readonly="true" />
                    </td>
                  </tr>
                </template>

                <tr v-if="!loading && !uses.length">
                  <td colspan="9" class="py-6 text-center text-slate-500">Sin usos</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Novedades del uso (detalle total, si lo quieres mantener) -->
          <div v-if="selectedUseId" class="mt-6 border-t pt-4">
            <h4 class="font-semibold text-slate-700 text-sm mb-2">Novedades del uso</h4>
            <NovedadesBlock
              :key="`uses-${selectedUseId}`"
              :tipo="'uses'"
              :refId="selectedUseId"
              canDelete
              @close="selectedUseId = null"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Modal para ver actividad/nota del uso -->
    <div
      v-if="notaUsoVisible"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2"
      @click.self="notaUsoVisible = false"
    >
      <div class="bg-white rounded-xl shadow-lg max-w-md w-full p-5">
        <h4 class="font-semibold text-slate-800 mb-2">
          Actividad del uso
        </h4>
        <p class="text-slate-700 whitespace-pre-wrap">{{ notaUsoActual?.notes }}</p>
        <div class="text-right mt-4">
          <button class="btn-secondary btn-xs" @click="notaUsoVisible = false">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
  <!-- Pregunta S/N amigable para cierre de uso -->
  <div
    v-if="showAskNovelty"
    class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
  >
    <div class="bg-white rounded-2xl shadow-xl p-6 w-[95vw] max-w-sm">
      <h3 class="font-semibold text-lg text-slate-900 mb-2">
        Cerrar uso
      </h3>

      <p class="text-sm text-slate-700 mb-4">
        ¿Deseas registrar una nueva novedad antes de cerrar el uso?
      </p>

      <div class="flex gap-3">
        <!-- SÍ -->
        <button
          class="btn-primary flex-1"
          @click="confirmClose('S')"
        >
          Sí
        </button>

        <!-- NO -->
        <button
          class="btn-secondary flex-1"
          @click="confirmClose('N')"
        >
          No
        </button>
      </div>
    </div>
  </div>

</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { http } from '@/lib/http'
import NovedadesBlock from './NovedadesBlock.vue'
import VehiclePartsPickerPro from './VehiclePartsPickerPro.vue'

const canEdit = computed(() =>
  !hasHardLock.value &&
  !hasOpenUse.value &&
  !lockForAgentOpenUse.value
)

const props = defineProps({
  agentId: { type: [Number, String], required: false, default: null },
  vehicle: { type: Object, required: true },
})

const emit = defineEmits(['close', 'created', 'end', 'end-with-novelty'])
const uiError = ref('')
const lockForAgentOpenUse = computed(() =>
  /uso.+abierto/i.test(uiError.value || '')
)

// 🔒 Modo bloqueado si viene agentId
const agents = ref([])
const isAgentLocked = computed(() => props.agentId != null)
const preferredAgent = computed(() => {
  if (!props.agentId) return null
  return agents.value.find(a => String(a.id) === String(props.agentId)) || null
})

const topSrc   = new URL('@/assets/pickup_top.png', import.meta.url).href
const leftSrc  = new URL('@/assets/pickup_left.png', import.meta.url).href
const rightSrc = new URL('@/assets/pickup_right.png', import.meta.url).href

const uses = ref([])
const loading = ref(false)
const submitting = ref(false)
const selectedUseId = ref(null)

// novedades
const recentNovedades = ref([])
const loadingNovs = ref(false)
const newNovedad = ref({ description: '', file: null })
const showRecentList = ref(false)
const expandedUseId = ref(null)
const hasOpenUse = computed(() => uses.value.some(u => !u.ended_at))

function toggleNovedades(id) {
  expandedUseId.value = (expandedUseId.value === id) ? null : id
}

const form = ref({
  agentCode: '',
  odometer_start: '',
  notes: ''
})

watch([preferredAgent, agents], () => {
  if (preferredAgent.value) {
    form.value.agentCode = preferredAgent.value.code || ''
  }
})

const notaUsoVisible = ref(false)
const notaUsoActual = ref(null)
function verNotaUso(u) {
  if (!u?.notes?.trim()) return
  notaUsoActual.value = u
  notaUsoVisible.value = true
}

async function loadAgents() {
  const { data } = await http.get('/vehicles/catalogs/agents')
  agents.value = data.items || data || []
}

async function loadUses() {
  loading.value = true
  try {
    const { data } = await http.get('/vehicles/uses', {
      params: { vehicle_id: props.vehicle.id }
    })
    uses.value = data.items || []
  } finally {
    loading.value = false
  }
}

// 🔹 cargar últimas novedades del vehículo (sube un poco el límite para agrupar por parte)
async function loadNovedades() {
  loadingNovs.value = true
  try {
    const { data } = await http.get(
      `/vehicles/${props.vehicle.id}/novelties/recent`,
      { params: { limit: 50, t: Date.now() } }
    )
    recentNovedades.value = data.items || data || []
  } finally {
    loadingNovs.value = false
  }
}

// 🔹 agregar novedad
function onPhoto(e) {
  newNovedad.value.file = e.target.files?.[0] || null
}

// --- Catálogos de partes físicas ---
const isMoto = computed(() => String(props.vehicle?.category || '') === 'MT')

const PARTS_AUTO = [
  // Zonas grandes
  { key: 'CAP',    label: 'Capó' },
  { key: 'CABINA', label: 'Techo' },
  { key: 'PLATON', label: 'Platón' },
  { key: 'CARGA',  label: 'Área de carga' },

  // Parabrisas / vidrios
  { key: 'VID', label: 'Parabrisas delantero' },
  { key: 'VIT', label: 'Parabrisas trasero' },
  { key: 'VDI', label: 'Vidrio delantero izq.' },
  { key: 'VTI', label: 'Vidrio trasero izq.' },
  { key: 'VDD', label: 'Vidrio delantero der.' },
  { key: 'VTD', label: 'Vidrio trasero der.' },

  // Puertas
  { key: 'PDI', label: 'Puerta delantera izq.' },
  { key: 'PTI', label: 'Puerta trasera izq.' },
  { key: 'PDD', label: 'Puerta delantera der.' },
  { key: 'PTD', label: 'Puerta trasera der.' },

  // Guardabarros
  { key: 'GDI', label: 'Guardabarro delantero izq.' },
  { key: 'GTI', label: 'Guardabarro trasero izq.' },
  { key: 'GDD', label: 'Guardabarro delantero der.' },
  { key: 'GTD', label: 'Guardabarro trasero der.' },

  // Llantas
  { key: 'LTI', label: 'Llanta delantera izq.' },
  { key: 'LTD', label: 'Llanta delantera der.' },
  { key: 'LLI', label: 'Llanta trasera izq.' },
  { key: 'LLD', label: 'Llanta trasera der.' },

  // Luces
  { key: 'LFD',   label: 'Luz delantera izq.' },
  { key: 'LFA',   label: 'Luz delantera der.' },
  { key: 'LTD_T', label: 'Luz trasera izq.' },
  { key: 'LTA_T', label: 'Luz trasera der.' },

  // Parachoques
  { key: 'PAD_R', label: 'Parachoques delantero' },
  { key: 'PAR_L', label: 'Parachoques trasero' },

  // Espejos
  { key: 'EMI', label: 'Espejo izq.' },
  { key: 'EMD', label: 'Espejo der.' },

  // Costados (por si ya tienes novedades antiguas con estos textos)
  { key: 'CRD',  label: 'Costado derecho' },
  { key: 'CRI',  label: 'Costado izquierdo' },

  // Otro
  { key: 'OTRO', label: 'Otro (especificar)' },
]

const PARTS_MOTO = [
  { key: 'TANQUE', label: 'Tanque' },
  { key: 'CUP',    label: 'Cúpula / faro' },
  { key: 'MAN_D',  label: 'Manubrio derecho' },
  { key: 'MAN_I',  label: 'Manubrio izquierdo' },
  { key: 'POSA',   label: 'Posapiés' },
  { key: 'GUAR',   label: 'Guardabarros' },
  { key: 'LL_DEL', label: 'Llanta delantera' },
  { key: 'LL_TRA', label: 'Llanta trasera' },
  { key: 'ESPE',   label: 'Espejo' },
  { key: 'CUBRE',  label: 'Cubrecarter' },
  { key: 'OTRO',   label: 'Otro (especificar)' },
]

// --- Catálogos internos / sistemas ---
const INTERNAL_SECTIONS = [
  { key: 'COJ',  label: 'Cojinería / asientos' },
  { key: 'TAP',  label: 'Tapetes' },
  { key: 'RAD',  label: 'Radio / multimedia' },
  { key: 'TEC',  label: 'Techo interior' },
  { key: 'PAN',  label: 'Panel de puertas' },
  { key: 'TAB',  label: 'Tablero / consola' },
]

const SYSTEM_SECTIONS = [
  { key: 'FRN',  label: 'Frenos' },
  { key: 'MTR',  label: 'Motor' },
  { key: 'DIR',  label: 'Dirección' },
  { key: 'SUS',  label: 'Suspensión' },
  { key: 'ELC',  label: 'Sistema eléctrico' },
  { key: 'TRN',  label: 'Transmisión' },
]

// Selección actual
const selectedPartKey = ref('')
const customPartName = ref('')
const selectedInternalKey = ref('')

function clearInternalSelection() {
  selectedInternalKey.value = ''
}

// para saber si la selección pertenece a interior o sistemas (para el botón "Quitar selección")
function isInternalSelection(tipo) {
  if (!selectedInternalKey.value) return false
  if (tipo === 'INTERIOR') {
    return INTERNAL_SECTIONS.some(s => s.key === selectedInternalKey.value)
  }
  if (tipo === 'SISTEMA') {
    return SYSTEM_SECTIONS.some(s => s.key === selectedInternalKey.value)
  }
  return false
}

function selectInternal(key) {
  selectedInternalKey.value = key
  // si seleccionas una categoría interna, desmarca la parte física
  selectedPartKey.value = ''
}

function labelForPartKey(key) {
  const list = isMoto.value ? PARTS_MOTO : PARTS_AUTO
  return list.find(x => x.key === key)?.label || ''
}

function selectedPartLabel() {
  const list = isMoto.value ? PARTS_MOTO : PARTS_AUTO
  const found = list.find(x => x.key === selectedPartKey.value)
  if (!found) return ''
  if (found.key === 'OTRO') {
    return customPartName.value.trim() || 'Parte no especificada'
  }
  return found.label
}

function labelForInternalKey(key) {
  const all = [...INTERNAL_SECTIONS, ...SYSTEM_SECTIONS]
  return all.find(s => s.key === key)?.label || ''
}

// Label unificado que se usará al guardar la novedad
const scopeLabel = computed(() => {
  if (selectedInternalKey.value) {
    return labelForInternalKey(selectedInternalKey.value)
  }
  if (selectedPartKey.value) {
    return selectedPartLabel()
  }
  return ''
})

async function addNovedad() {
  const partLabel = scopeLabel.value.trim()
  const desc = (newNovedad.value.description || '').trim()

  // Validaciones
  if (!partLabel && !desc && !newNovedad.value.file) {
    return alert('Selecciona una parte/categoría y/o escribe una descripción, o adjunta una foto.')
  }
  if (!partLabel && desc && !newNovedad.value.file) {
    return alert('Selecciona la parte o sistema del vehículo.')
  }
  if (partLabel && !desc && !newNovedad.value.file) {
    return alert('Escribe una descripción para la parte seleccionada o adjunta una foto.')
  }

  const finalText = partLabel
    ? (desc ? `${partLabel}: ${desc}` : `${partLabel}`)
    : desc

  const fd = new FormData()
  fd.append('description', finalText)
  if (newNovedad.value.file) fd.append('photo', newNovedad.value.file)

  await http.post(`/vehicles/vehicle/${props.vehicle.id}/novelties`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })

  newNovedad.value = { description: '', file: null }
  // mantenemos la selección de parte/categoría para registrar varias
  await loadNovedades()
}

// 🔹 eliminar novedad
async function deleteNovedad(id) {
  if (!confirm('¿Eliminar esta novedad?')) return
  await http.delete(`/vehicles/novelties/${id}`)
  await loadNovedades()
}

// --- Agrupación / conteos por categoría interna/sistema ---
const internalCounts = computed(() => {
  const counts = {}
  const allSections = [...INTERNAL_SECTIONS, ...SYSTEM_SECTIONS]
  for (const sec of allSections) {
    const label = sec.label
    counts[sec.key] = recentNovedades.value.filter(n =>
      (n.description || '').startsWith(label)
    ).length
  }
  return counts
})

// --- Highlight para partes físicas (croquis) ---
const partKeysConNovedades = computed(() => {
  const keys = new Set()
  const list = isMoto.value ? PARTS_MOTO : PARTS_AUTO
  for (const part of list) {
    const label = part.label
    if (!label) continue
    const tiene = recentNovedades.value.some(n =>
      (n.description || '').startsWith(label)
    )
    if (tiene) keys.add(part.key)
  }
  return Array.from(keys)
})

// --- Novedades de la parte / categoría seleccionada ---
const novsSelectedScope = computed(() => {
  const label = scopeLabel.value
  if (!label) return []
  return recentNovedades.value.filter(n =>
    (n.description || '').startsWith(label)
  )
})
const showAllForScope = ref(false)

// Placeholder dinámico
const descPlaceholder = computed(() =>
  'Describe la novedad para la parte o sistema seleccionados…'
)

// --- Crear / cerrar usos ---
async function createUse() {
  if (hasOpenUse.value) {
    uiError.value = 'Ya existe un uso abierto para este vehículo. Cierra el uso actual antes de iniciar otro.'
    return
  }

  uiError.value = ''
  submitting.value = true
  try {
    let agentIdToUse = null
    if (props.agentId) {
      // Modo AgentDashboard: bloqueado al agente logueado
      agentIdToUse = Number(props.agentId)
    } else {
      // Modo superadmin / administración: se elige el agente por código
      const ag = agents.value.find(a => a.code === form.value.agentCode)
      if (!ag) {
        uiError.value = 'Selecciona un agente válido.'
        return
      }
      agentIdToUse = ag.id
    }

    const payload = {
      vehicle_id: props.vehicle.id,
      agent_id: agentIdToUse,
      odometer_start: form.value.odometer_start || null,
      notes: (form.value.notes || '').trim() || null
    }

    const { data } = await http.post('/vehicles/uses/start', payload)

    // Aviso de cambio de aceite (opcional, amigable)
    if (data && data.oil_warning) {
      const { remaining, nextOil } = data.oil_warning
      const remTxt =
        remaining != null ? `${remaining} km` : 'pocos kilómetros'
      uiError.value =
        `⚠️ Aviso de mantenimiento: al vehículo le faltan ${remTxt} para el próximo cambio de aceite` +
        (nextOil != null ? ` (programado alrededor de ${nextOil} km).` : '.')
    } else {
      uiError.value = ''
    }

    // Notificamos al padre (AgentDashboard / Admin) que se creó el uso
    emit('created', data)

    form.value = { agentCode: '', odometer_start: '', notes: '' }
    await Promise.all([loadUses(), loadNovedades(), loadLastUseOdometer()])
  } catch (err) {
    const raw =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.message ||
      'No se pudo iniciar el uso.'

    if (/uso.+abierto/i.test(raw)) {
      uiError.value =
        'Este agente ya tiene un uso abierto (en este u otro vehículo). Debe cerrarlo antes de iniciar uno nuevo.'
    } else {
      uiError.value = raw
    }
  } finally {
    submitting.value = false
  }
}

async function closeUse(u) {
  if (!u) return

  if (wantsNovelty) {
    // 👉 no cerramos aquí, solo avisamos al padre que quiere novedad
    emit('end-with-novelty', u)
    return
  }

  // 👉 flujo normal: solo cerrar uso
  emit('end', u)
}

function showNovedades(id) {
  selectedUseId.value = id
}

// === Documentos vencidos / sin registrar (SOAT / Tecno) ===
function isEmptyDate(value) {
  if (!value) return true
  const s = String(value).trim()

  // casos típicos de BD
  if (s === '' || s === 'null' || s === 'undefined') return true
  if (s === '0000-00-00' || s.startsWith('0000-00-00')) return true

  return false
}

function isExpiredDate(value) {
  if (isEmptyDate(value)) return false

  // normalizar cadenas tipo "2025-11-15 00:00:00"
  const s = String(value).trim().replace(' ', 'T')

  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return false

  const today = new Date()
  d.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  return d < today
}

const soatDate = computed(() => {
  const v = props.vehicle || {}
  return (
    // 🔹 primero los nombres que sí manda el backend
    v.soatDate ??
    v.soat_date ??
    // 🔹 compatibilidad con otros nombres que probaste antes
    v.soat_until ??
    v.soatUntil ??
    v.soat_expire_at ??
    v.soatExpireAt ??
    v.soat ??
    null
  )
})

const tecnoDate = computed(() => {
  const v = props.vehicle || {}
  return (
    // 🔹 primero los nombres que sí manda el backend
    v.tecnoDate ??
    v.tecno_date ??
    // 🔹 compatibilidad con otros nombres que probaste antes
    v.tecno_until ??
    v.tecnoUntil ??
    v.tecno_expire_at ??
    v.tecnoExpireAt ??
    v.tecno ??
    null
  )
})

const isWrongState = computed(() => {
  const st = String(props.vehicle?.estado || '').trim().toUpperCase()
  return st !== 'SERVICIO'
})

const wrongStateLabel = computed(() => {
  const st = String(props.vehicle?.estado || '').trim()
  return st ? `Estado actual: "${st}"` : 'Estado desconocido'
})

// Bloqueamos si falta la fecha (campo vacío) o si está vencida
const hasExpiredDocs = computed(() =>
  isEmptyDate(soatDate.value) ||
  isEmptyDate(tecnoDate.value) ||
  isExpiredDate(soatDate.value) ||
  isExpiredDate(tecnoDate.value)
)

const expiredDocsLabel = computed(() => {
  const parts = []

  if (isEmptyDate(soatDate.value)) {
    parts.push('SOAT sin registrar')
  } else if (isExpiredDate(soatDate.value)) {
    parts.push('SOAT vencido')
  }

  if (isEmptyDate(tecnoDate.value)) {
    parts.push('técnico-mecánica sin registrar')
  } else if (isExpiredDate(tecnoDate.value)) {
    parts.push('técnico-mecánica vencida')
  }

  return parts.join(' y ')
})


const lastUseOdoHint = ref(null)

async function loadLastUseOdometer() {
  try {
    const { data } = await http.get(`/vehicles/${props.vehicle.id}/last-use-odometer`)
    lastUseOdoHint.value = data?.lastOdometer ?? null
    if (!form.value.odometer_start && lastUseOdoHint.value != null) {
      form.value.odometer_start = String(lastUseOdoHint.value)
    }
  } catch {
    lastUseOdoHint.value = null
  }
}

const showAskNovelty = ref(false)
const useToClose = ref(null)

function askCloseUse(u) {
  useToClose.value = u
  showAskNovelty.value = true
}

function confirmClose(option) {
  const u = useToClose.value
  showAskNovelty.value = false
  useToClose.value = null
  if (!u) return

  if (option === 'S') {
    // 👉 cerrar con novedad
    emit('end-with-novelty', u)
  } else {
    // 👉 cerrar directo
    emit('end', u)
  }
}


onMounted(() => {
  loadUses()
  loadAgents()
  loadNovedades()
  loadLastUseOdometer()
})

watch(() => props.vehicle?.id, () => {
  loadUses()
  loadNovedades()
  loadLastUseOdometer()
})

watch(selectedPartKey, (val) => {
  // Si seleccionas una parte en el croquis, desmarca cualquier categoría interna/sistema
  if (val) {
    selectedInternalKey.value = ''
  }
})

</script>
