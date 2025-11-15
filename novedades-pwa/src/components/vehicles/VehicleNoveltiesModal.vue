<template>
  <div>
    <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-6">
      <div
        class="w-full max-w-[100vw] sm:max-w-3xl lg:max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <!-- HEADER -->
        <div class="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-3 sm:px-4 py-3 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800 text-sm sm:text-base">
            Novedades — {{ vehicle.code }} <span v-if="vehicle.sigla" class="text-slate-500">({{ vehicle.sigla }})</span>
          </h3>
          <button class="btn-secondary btn-xs" @click="$emit('close')">Cerrar</button>
        </div>

        <!-- BODY -->
        <div class="px-3 sm:px-4 py-4 overflow-y-auto max-h-[90dvh] space-y-6">
          <!-- 👉 Bloque para agregar novedad -->
          <div class="border rounded-xl p-3 bg-slate-50">
            <h4 class="font-semibold text-slate-700 text-sm mb-3">
              Agregar novedad del vehículo
            </h4>

            <div class="grid grid-cols-1 gap-3">
              <!-- Picker visual (croquis) -->
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

              <!-- Descripción + foto -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                <div class="md:col-span-2">
                  <label class="label text-xs mb-1">Descripción</label>
                  <textarea
                    v-model="newNovedad.description"
                    class="input w-full"
                    rows="2"
                    :placeholder="descPlaceholder"
                  ></textarea>
                </div>
                <div>
                  <label class="label text-xs mb-1">Foto (opcional)</label>
                  <input type="file" accept="image/*" @change="onPhoto" class="block w-full text-xs" />
                  <p v-if="newNovedad.file" class="mt-1 text-[11px] text-slate-500 truncate">
                    {{ newNovedad.file.name }}
                  </p>
                </div>
              </div>

              <!-- Botón agregar -->
              <div class="flex justify-end">
                <button
                  type="button"
                  class="btn-primary btn-sm"
                  :disabled="submittingNov"
                  @click="addNovedad"
                >
                  {{ submittingNov ? 'Guardando…' : 'Agregar novedad' }}
                </button>
              </div>
            </div>

            <!-- Novedades de la parte/categoría seleccionada -->
            <div
              v-if="scopeLabel && novsSelectedScope.length"
              class="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-xs"
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

              <ul class="space-y-1 max-h-40 overflow-y-auto">
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

          <!-- 👉 Listado general de novedades -->
          <div class="border rounded-xl p-3">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-semibold text-slate-700 text-sm">
                Novedades recientes del vehículo
              </h4>
              <button
                type="button"
                class="text-[11px] text-slate-500 hover:underline"
                @click="loadNovedades"
              >
                Actualizar
              </button>
            </div>

            <div v-if="loadingNovs" class="text-xs text-slate-500">
              Cargando novedades…
            </div>

            <div v-else-if="!recentNovedades.length" class="text-xs text-slate-500">
              No hay novedades registradas para este vehículo.
            </div>

            <div v-else class="max-h-[40vh] overflow-y-auto">
              <table class="min-w-full text-xs">
                <thead class="text-slate-500 border-b">
                  <tr>
                    <th class="py-1 pr-2 text-left">Fecha</th>
                    <th class="py-1 pr-2 text-left">Descripción</th>
                    <th class="py-1 pr-2 text-left">Foto</th>
                    <th class="py-1 pr-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="n in recentNovedades" :key="n.id" class="border-b last:border-0">
                    <td class="py-1 pr-2 align-top whitespace-nowrap">
                      {{ n.createdAt || n.created_at || '—' }}
                    </td>
                    <td class="py-1 pr-2 align-top">
                      {{ n.description }}
                    </td>
                    <td class="py-1 pr-2 align-top">
                      <a
                        v-if="n.photoUrl"
                        :href="`/${n.photoUrl}`"
                        target="_blank"
                        class="text-[11px] text-blue-600 underline"
                      >
                        ver foto
                      </a>
                      <span v-else class="text-slate-400 text-[11px]">—</span>
                    </td>
                    <td class="py-1 pl-2 align-top text-right">
                      <button
                        type="button"
                        class="text-[11px] text-rose-600 hover:underline"
                        @click="deleteNovedad(n.id)"
                      >
                        eliminar
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { http } from '@/lib/http'
import VehiclePartsPickerPro from './VehiclePartsPickerPro.vue'

const props = defineProps({
  vehicle: { type: Object, required: true }
})

const emit = defineEmits(['close'])

const recentNovedades = ref([])
const loadingNovs = ref(false)
const submittingNov = ref(false)
const newNovedad = ref({ description: '', file: null })

const selectedPartKey = ref('')
const customPartName = ref('')
const selectedInternalKey = ref('')

const showAllForScope = ref(false)

// croquis
const topSrc   = new URL('@/assets/pickup_top.png', import.meta.url).href
const leftSrc  = new URL('@/assets/pickup_left.png', import.meta.url).href
const rightSrc = new URL('@/assets/pickup_right.png', import.meta.url).href

const isMoto = computed(() => String(props.vehicle?.category || '') === 'MT')

// partes vehículo
const PARTS_AUTO = [
  { key: 'CAP',    label: 'Capó' },
  { key: 'CABINA', label: 'Techo' },
  { key: 'PLATON', label: 'Platón' },
  { key: 'CARGA',  label: 'Área de carga' },
  { key: 'VID', label: 'Parabrisas delantero' },
  { key: 'VIT', label: 'Parabrisas trasero' },
  { key: 'VDI', label: 'Vidrio delantero izq.' },
  { key: 'VTI', label: 'Vidrio trasero izq.' },
  { key: 'VDD', label: 'Vidrio delantero der.' },
  { key: 'VTD', label: 'Vidrio trasero der.' },
  { key: 'PDI', label: 'Puerta delantera izq.' },
  { key: 'PTI', label: 'Puerta trasera izq.' },
  { key: 'PDD', label: 'Puerta delantera der.' },
  { key: 'PTD', label: 'Puerta trasera der.' },
  { key: 'GDI', label: 'Guardabarro delantero izq.' },
  { key: 'GTI', label: 'Guardabarro trasero izq.' },
  { key: 'GDD', label: 'Guardabarro delantero der.' },
  { key: 'GTD', label: 'Guardabarro trasero der.' },
  { key: 'LTI', label: 'Llanta delantera izq.' },
  { key: 'LTD', label: 'Llanta delantera der.' },
  { key: 'LLI', label: 'Llanta trasera izq.' },
  { key: 'LLD', label: 'Llanta trasera der.' },
  { key: 'LFD',   label: 'Luz delantera izq.' },
  { key: 'LFA',   label: 'Luz delantera der.' },
  { key: 'LTD_T', label: 'Luz trasera izq.' },
  { key: 'LTA_T', label: 'Luz trasera der.' },
  { key: 'PAD_R', label: 'Parachoques delantero' },
  { key: 'PAR_L', label: 'Parachoques trasero' },
  { key: 'EMI', label: 'Espejo izq.' },
  { key: 'EMD', label: 'Espejo der.' },
  { key: 'CRD',  label: 'Costado derecho' },
  { key: 'CRI',  label: 'Costado izquierdo' },
  { key: 'OTRO', label: 'Otro (especificar)' }
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
  { key: 'OTRO',   label: 'Otro (especificar)' }
]

// internas / sistemas
const INTERNAL_SECTIONS = [
  { key: 'COJ',  label: 'Cojinería / asientos' },
  { key: 'TAP',  label: 'Tapetes' },
  { key: 'RAD',  label: 'Radio / multimedia' },
  { key: 'TEC',  label: 'Techo interior' },
  { key: 'PAN',  label: 'Panel de puertas' },
  { key: 'TAB',  label: 'Tablero / consola' }
]

const SYSTEM_SECTIONS = [
  { key: 'FRN',  label: 'Frenos' },
  { key: 'MTR',  label: 'Motor' },
  { key: 'DIR',  label: 'Dirección' },
  { key: 'SUS',  label: 'Suspensión' },
  { key: 'ELC',  label: 'Sistema eléctrico' },
  { key: 'TRN',  label: 'Transmisión' }
]

function clearInternalSelection () {
  selectedInternalKey.value = ''
}

function isInternalSelection (tipo) {
  if (!selectedInternalKey.value) return false
  if (tipo === 'INTERIOR') {
    return INTERNAL_SECTIONS.some(s => s.key === selectedInternalKey.value)
  }
  if (tipo === 'SISTEMA') {
    return SYSTEM_SECTIONS.some(s => s.key === selectedInternalKey.value)
  }
  return false
}

function selectInternal (key) {
  selectedInternalKey.value = key
  selectedPartKey.value = ''
}

function labelForPartKey (key) {
  const list = isMoto.value ? PARTS_MOTO : PARTS_AUTO
  return list.find(x => x.key === key)?.label || ''
}

function selectedPartLabel () {
  const list = isMoto.value ? PARTS_MOTO : PARTS_AUTO
  const found = list.find(x => x.key === selectedPartKey.value)
  if (!found) return ''
  if (found.key === 'OTRO') {
    return customPartName.value.trim() || 'Parte no especificada'
  }
  return found.label
}

function labelForInternalKey (key) {
  const all = [...INTERNAL_SECTIONS, ...SYSTEM_SECTIONS]
  return all.find(s => s.key === key)?.label || ''
}

const scopeLabel = computed(() => {
  if (selectedInternalKey.value) return labelForInternalKey(selectedInternalKey.value)
  if (selectedPartKey.value) return selectedPartLabel()
  return ''
})

const descPlaceholder = computed(() =>
  'Describe la novedad para la parte o sistema seleccionados…'
)

function onPhoto (e) {
  newNovedad.value.file = e.target.files?.[0] || null
}

async function loadNovedades () {
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

async function addNovedad () {
  const partLabel = scopeLabel.value.trim()
  const desc = (newNovedad.value.description || '').trim()

  if (!partLabel && !desc && !newNovedad.value.file) {
    alert('Selecciona una parte/categoría y/o escribe una descripción, o adjunta una foto.')
    return
  }
  if (!partLabel && desc && !newNovedad.value.file) {
    alert('Selecciona la parte o sistema del vehículo.')
    return
  }
  if (partLabel && !desc && !newNovedad.value.file) {
    alert('Escribe una descripción para la parte seleccionada o adjunta una foto.')
    return
  }

  const finalText = partLabel
    ? (desc ? `${partLabel}: ${desc}` : `${partLabel}`)
    : desc

  const fd = new FormData()
  fd.append('description', finalText)
  if (newNovedad.value.file) fd.append('photo', newNovedad.value.file)

  submittingNov.value = true
  try {
    await http.post(`/vehicles/vehicle/${props.vehicle.id}/novelties`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    newNovedad.value = { description: '', file: null }
    await loadNovedades()
  } finally {
    submittingNov.value = false
  }
}

async function deleteNovedad (id) {
  if (!confirm('¿Eliminar esta novedad?')) return
  await http.delete(`/vehicles/novelties/${id}`)
  await loadNovedades()
}

// conteos por internas/sistemas
const internalCounts = computed(() => {
  const counts = {}
  const all = [...INTERNAL_SECTIONS, ...SYSTEM_SECTIONS]
  for (const sec of all) {
    const label = sec.label
    counts[sec.key] = recentNovedades.value.filter(n =>
      (n.description || '').startsWith(label)
    ).length
  }
  return counts
})

// highlight en croquis
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

// novedades por parte/categoría seleccionada
const novsSelectedScope = computed(() => {
  const label = scopeLabel.value
  if (!label) return []
  return recentNovedades.value.filter(n =>
    (n.description || '').startsWith(label)
  )
})

watch(selectedPartKey, (val) => {
  if (val) selectedInternalKey.value = ''
})

onMounted(() => {
  loadNovedades()
})
</script>
