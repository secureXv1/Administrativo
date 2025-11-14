<template>
  <div> <!-- 👈 root único -->
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
          <!-- Banner cuando hay un uso vigente -->
          <div
            v-if="hasOpenUse"
            class="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm border border-amber-200"
          >
            Ya existe un uso vigente. Cierre el uso actual para habilitar un nuevo registro.
          </div>

          <!-- 🔹 Bloque de novedades previas al inicio del uso -->
          <div v-if="!hasOpenUse" class="border rounded-xl p-3 bg-slate-50 mb-6">
            <h4 class="font-semibold text-slate-700 text-sm mb-3">
              Agregar una nueva novedad
            </h4>

            <!-- Picker visual + campos (stack en móvil) -->
            <div class="grid grid-cols-1 gap-3 mb-3">
              <!-- 👇 Picker compacto (auto/moto) >
              <VehiclePartsPicker
                v-model="selectedPartKey"
                :is-moto="isMoto"
                compact
                :scale="0.7"
                :legend-max-height="120"
              /-->
              <VehiclePartsPickerPro
                v-model="selectedPartKey"
                :topSrc="topSrc"
                :leftSrc="leftSrc"
                :rightSrc="rightSrc"
              />

              <!-- Campo 'Otro' si corresponde -->
              <div v-if="selectedPartKey === 'OTRO'">
                <input
                  v-model="customPartName"
                  class="input w-full"
                  placeholder="Especifica la parte (ej: tapa combustible)"
                />
              </div>
            </div>

            <!-- Formulario para nueva novedad (desc + foto + agregar) -->
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
              <!-- Descripción -->
              <div class="sm:col-span-7">
                <textarea
                  v-model="newNovedad.description"
                  rows="2"
                  maxlength="200"
                  class="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  :placeholder="descPlaceholder"
                ></textarea>
                <div class="text-[11px] text-slate-400 mt-1">
                  {{ (newNovedad.description || '').length }}/200
                </div>
              </div>

              <!-- Foto -->
              <div class="sm:col-span-3">
                <label
                  class="inline-flex items-center justify-center px-3 py-2 w-full rounded-lg border border-slate-300 bg-white text-slate-800 text-sm cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Seleccionar img
                  <input type="file" accept="image/*" class="hidden" @change="onPhoto" />
                </label>
                <div class="text-[11px] text-slate-500 truncate mt-1">
                  {{ newNovedad.file ? newNovedad.file.name : 'Ningún archivo' }}
                </div>
              </div>

              <!-- Botón -->
              <div class="sm:col-span-2 flex items-end">
                <button class="btn-primary w-full" @click="addNovedad">Agregar</button>
              </div>
            </div>

            <h4 class="font-semibold text-slate-700 text-sm mt-5 mb-2">
              Novedades recientes del vehículo
            </h4>
            <div v-if="loadingNovs" class="text-xs text-slate-500">Cargando novedades…</div>

            <div v-else>
              <div v-if="!recentNovedades.length" class="text-xs text-slate-400 mb-2">
                No hay novedades registradas aún.
              </div>
              <div
                v-for="n in recentNovedades"
                :key="n.id"
                class="text-xs border-b py-1 flex items-center justify-between"
              >
                <div>
                  • {{ n.description }}
                  <a
                    v-if="n.photoUrl"
                    :href="`/${n.photoUrl}`"
                    target="_blank"
                    class="text-blue-600 underline ml-1"
                  >foto</a>
                  <span class="text-slate-400 ml-2">{{ n.created_at }}</span>
                </div>
                <button
                  class="text-red-600 hover:text-red-800 font-medium text-[11px]"
                  @click="deleteNovedad(n.id)"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>

          <!-- Formulario nuevo uso -->
          <div v-if="!hasOpenUse" class="grid grid-cols-1 sm:grid-cols-6 gap-3 mb-4">
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
                placeholder="Ej: Servicio, Actividad persona, etc"
              ></textarea>
            </div>

            <div class="sm:col-span-6 flex justify-end">
              <button class="btn-primary" @click="createUse" :disabled="submitting">
                {{ submitting ? 'Guardando…' : 'Iniciar uso' }}
              </button>
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
                        @click="closeUse(u)"
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

          <!-- Novedades del uso -->
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
        <!-- /BODY -->
      </div>
      <!-- /MODAL -->
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
</template>


<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { http } from '@/lib/http'
import NovedadesBlock from './NovedadesBlock.vue'
import VehiclePartsPickerPro from './VehiclePartsPickerPro.vue'


const props = defineProps({
  agentId: { type: [Number, String], required: false, default: null },
  vehicle: { type: Object, required: true }, // { id, code, ... }
})

// 🔒 Modo bloqueado si viene agentId
const isAgentLocked = computed(() => props.agentId != null)

// Agente elegido por prop (una vez cargado el catálogo)
const preferredAgent = computed(() => {
  if (!props.agentId) return null
  return agents.value.find(a => String(a.id) === String(props.agentId)) || null
})

const emit = defineEmits(['close', 'created'])

const topSrc   = new URL('@/assets/pickup_top.png', import.meta.url).href
const leftSrc  = new URL('@/assets/pickup_left.png', import.meta.url).href
const rightSrc = new URL('@/assets/pickup_right.png', import.meta.url).href
const agents = ref([])
const uses = ref([])
const loading = ref(false)
const submitting = ref(false)
const selectedUseId = ref(null)

// 🆕 novedades recientes
const recentNovedades = ref([])
const loadingNovs = ref(false)
const newNovedad = ref({ description: '', file: null })
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

// Si el modal viene desde AgentDashboard con agentId, precarga el code y bloquea cambios
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

// 🔹 cargar últimas novedades del vehículo
async function loadNovedades() {
  loadingNovs.value = true
  try {
  const { data } = await http.get(`/vehicles/${props.vehicle.id}/novelties/recent`, { params: { limit: 5, t: Date.now() } })
  recentNovedades.value = data.items || data || []
  } finally {
    loadingNovs.value = false
  }
}

// 🔹 agregar novedad
function onPhoto(e) {
  newNovedad.value.file = e.target.files?.[0] || null
}
async function addNovedad() {
  const partLabel = selectedPartLabel().trim()
  const desc = (newNovedad.value.description || '').trim()

  // Validaciones: al menos una parte y una descripción, o permite foto sola si quieres
  if (!partLabel && !desc && !newNovedad.value.file) {
    return alert('Selecciona una parte y/o escribe una descripción, o adjunta una foto.')
  }
  if (!partLabel && desc && !newNovedad.value.file) {
    return alert('Selecciona la parte del vehículo.')
  }
  if (partLabel && !desc && !newNovedad.value.file) {
    return alert('Escribe una descripción para la parte seleccionada o adjunta una foto.')
  }

  // Construye "Parte: descripción"
  const finalText = partLabel
    ? (desc ? `${partLabel}: ${desc}` : `${partLabel}`)
    : desc

  const fd = new FormData()
  fd.append('description', finalText)
  if (newNovedad.value.file) fd.append('photo', newNovedad.value.file)

  await http.post(`/vehicles/vehicle/${props.vehicle.id}/novelties`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })

  // Limpieza post-agregado: resetea descripción y foto; conserva la "parte" para agilizar varias del mismo componente
  newNovedad.value = { description: '', file: null }
  await loadNovedades()
}

// 🔹 eliminar novedad
async function deleteNovedad(id) {
  if (!confirm('¿Eliminar esta novedad?')) return
  await http.delete(`/vehicles/novelties/${id}`)
  await loadNovedades()
}

async function createUse() {
  submitting.value = true
  try {
    let agentIdToUse = null
    if (props.agentId) {
      agentIdToUse = Number(props.agentId)
    } else {
      const ag = agents.value.find(a => a.code === form.value.agentCode)
      if (!ag) return alert('Agente no válido')
      agentIdToUse = ag.id
    }

    await http.post('/vehicles/uses/start', {
      vehicle_id: props.vehicle.id,
      agent_id: agentIdToUse,
      odometer_start: form.value.odometer_start || null,
      notes: (form.value.notes || '').trim() || null
    })

    form.value = { agentCode: '', odometer_start: '', notes: '' }
    await loadUses()
    await loadNovedades()
  } finally {
    submitting.value = false
  }
}

async function closeUse(u) {
  const odoStr = prompt('Ingrese el odómetro final:')
  if (!odoStr) return
  const odoNum = Number(odoStr)
  if (isNaN(odoNum)) return alert('Debe ingresar un número válido.')

  try {
    await http.patch(`/vehicles/uses/${u.id}/end`, { odometer_end: odoNum })
    await loadUses()
  } catch (e) {
    console.error(e)
    alert('Error al cerrar el uso.')
  }
}

function showNovedades(id) {
  selectedUseId.value = id
}

const lastUseOdoHint = ref(null)

async function loadLastUseOdometer() {
  try {
    const { data } = await http.get(`/vehicles/${props.vehicle.id}/last-use-odometer`)
    lastUseOdoHint.value = data?.lastOdometer ?? null
    // si el form está vacío, prellenar
    if (!form.value.odometer_start && lastUseOdoHint.value != null) {
      form.value.odometer_start = String(lastUseOdoHint.value)
    }
  } catch {
    lastUseOdoHint.value = null
  }
}

// Tipo según categoría
const isMoto = computed(() => String(props.vehicle?.category || '') === 'MT')

// Catálogo de partes (solo etiquetas; sin textos automáticos)
const PARTS_AUTO = [
  { key: 'PDD',  label: 'Puerta delantera derecha' },
  { key: 'PDI',  label: 'Puerta delantera izquierda' },
  { key: 'PTD',  label: 'Puerta trasera derecha' },
  { key: 'PTI',  label: 'Puerta trasera izquierda' },
  { key: 'PAD',  label: 'Parachoques delantero' },
  { key: 'PAR',  label: 'Parachoques trasero' },
  { key: 'CRD',  label: 'Costado derecho' },
  { key: 'CRI',  label: 'Costado izquierdo' },
  { key: 'CAP',  label: 'Capó' },
  { key: 'TECHO',label: 'Techo' },
  { key: 'VID',  label: 'Parabrisas / vidrios' },
  { key: 'LLD',  label: 'Llanta delantera derecha' },
  { key: 'LLI',  label: 'Llanta delantera izquierda' },
  { key: 'LTD',  label: 'Llanta trasera derecha' },
  { key: 'LTI',  label: 'Llanta trasera izquierda' },
  { key: 'FAR',  label: 'Faros' },
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

// Selección de parte
const selectedPartKey = ref('')
const customPartName = ref('') // 🆕 campo cuando se elige "Otro"

function selectedPartLabel() {
  const list = isMoto.value ? PARTS_MOTO : PARTS_AUTO
  const found = list.find(x => x.key === selectedPartKey.value)
  if (!found) return ''
  if (found.key === 'OTRO') {
    return customPartName.value.trim() || 'Parte no especificada'
  }
  return found.label
}

// Placeholder dinámico
const descPlaceholder = computed(() =>
  'Describe la novedad o selecciona una parte para auto-completar…'
)

onMounted(() => {
  loadUses()
  loadAgents()
  loadNovedades() // 
  loadLastUseOdometer()
})

watch(() => props.vehicle?.id, () => {
  loadUses()
  loadNovedades()
  loadLastUseOdometer()
})
</script>
