<template>
  <!-- Banner fijo debajo de la barra superior -->
  <div :class="['sticky', topClass, 'z-30']">
    <div class="mx-auto max-w-6xl px-2">
      <div
        :class="[
          'rounded-xl border p-2 sm:p-3',
          colorClass.bg, colorClass.border, colorClass.text
        ]"
        role="region"
        aria-label="Fechas conmemorativas de la semana"
      >
        <!-- Encabezado -->
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div :class="['text-[11px] leading-4', colorClass.subtext]">
              Semana {{ weekLabel }}
            </div>

            <!-- Modo cerrado: una sola línea con elipsis -->
            <div
              v-if="!expanded"
              class="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis"
            >
              Fechas conmemorativas:
              <span class="font-normal">
                {{ summaryLine }}
              </span>
            </div>

            <!-- Modo abierto: sólo el título -->
            <div v-else class="text-sm font-medium">
              Fechas conmemorativas
            </div>
          </div>

          <button
            class="shrink-0 text-xs underline hover:no-underline px-1"
            @click="expanded = !expanded"
          >
            {{ expanded ? 'Ocultar' : 'Ver detalles' }}
          </button>
        </div>

        <!-- Detalle -->
        <transition name="fade">
          <div v-if="expanded" class="mt-2 pt-2" :class="[colorClass.divider]">
            <div v-if="loading" :class="['text-xs', colorClass.subtext]">Cargando…</div>
            <div v-else-if="items.length === 0" :class="['text-xs', colorClass.subtext]">
              Sin registros para esta semana.
            </div>
            <ul v-else class="space-y-1">
              <li
                v-for="it in items"
                :key="it.id"
                class="rounded-md px-2 py-1 bg-white/50"
                :class="[colorClass.itemBorder]"
              >
                <div :class="['text-[11px]', colorClass.subtext]">
                  {{ formatFechaBonita(it.fecha) }} • {{ it.gao }}
                </div>
                <div :class="['text-sm', colorClass.text]">
                  {{ it.description }}
                </div>
              </li>
            </ul>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

/**
 * Props
 * - topOffset: clase tailwind para la separación desde el top (por la barra). Ej: 'top-14'
 * - color: 'amber' (defecto) o 'red'
 * - apiBase: opcional. Si no viene, usa VITE_API_URL o construye con hostname actual.
 * - dateYmd: opcional. Si no viene, el backend usa la fecha de hoy (Bogotá).
 */
const props = defineProps({
  topOffset: { type: String, default: 'top-14' },
  color: { type: String, default: 'amber' },
  apiBase: { type: String, default: '' },
  dateYmd: { type: String, default: '' },
})

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
function toDateLocal(x) {
  if (!x) return null
  return String(x).includes('T') ? new Date(x) : new Date(String(x) + 'T00:00:00')
}
function formatFechaBonita(x) {
  const d = toDateLocal(x)
  if (!d || isNaN(d)) return String(x)
  const dia = String(d.getDate()).padStart(2, '0')
  const mesCap = MONTHS_ES[d.getMonth()].replace(/^\w/, c => c.toUpperCase())
  return `${dia} de ${mesCap}`
}

const expanded = ref(false)
const loading  = ref(false)
const items    = ref([])
const weekStart = ref('')
const weekEnd   = ref('')

const weekLabel = computed(() => {
  if (!weekStart.value || !weekEnd.value) return '—'
  return `${weekStart.value} a ${weekEnd.value}`
})

const summaryLine = computed(() => {
  if (loading.value) return 'Cargando…'
  if (!items.value.length) return 'Sin registros esta semana'
  return items.value.map(it => `${formatFechaBonita(it.fecha)} • ${it.gao}`).join(' • ')
})

// Colores
const colorClass = computed(() => {
  if (props.color === 'red') {
    return {
      bg: 'bg-red-100',
      border: 'border-red-300',
      text: 'text-red-900',
      subtext: 'text-red-700',
      divider: 'border-t border-red-200',
      itemBorder: 'border border-red-200'
    }
  }
  // amber por defecto
  return {
    bg: 'bg-amber-100',
    border: 'border-amber-300',
    text: 'text-amber-900',
    subtext: 'text-amber-700',
    divider: 'border-t border-amber-200',
    itemBorder: 'border border-amber-200'
  }
})

const topClass = computed(() => props.topOffset || 'top-14')

// dentro del componente, reemplaza tu cálculo de API:
const API = computed(() => {
  // 1) si pasas apiBase como prop, se usa
  if (props.apiBase) return props.apiBase
  // 2) si tienes VITE_API_URL en prod, úsala (p.ej. 'https://tudominio.com')
  const env = import.meta.env?.VITE_API_URL
  if (env) return env
  // 3) fallback: MISMO ORIGEN (sin puertos raros)
  return window.location.origin
})

// y llama:
const url = `${API.value}/api/fechas/semana`


async function loadWeek() {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    if (!token) {
      items.value = []
      return
    }
    const url = `${API.value}/api/fechas/semana`
    const params = {}
    if (props.dateYmd) params.date = props.dateYmd

    const { data } = await axios.get(url, {
      params,
      headers: { Authorization: 'Bearer ' + token }
    })
    weekStart.value = data?.week_start || ''
    weekEnd.value   = data?.week_end || ''
    items.value     = Array.isArray(data?.items) ? data.items : []
  } catch (e) {
    console.error('fechas/semana:', e?.response?.status, e?.message)
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadWeek)
watch(() => props.dateYmd, () => loadWeek())

// expose util por si un padre lo quiere
defineExpose({ reload: loadWeek, formatFechaBonita })
</script>

<style scoped>
.fade-enter-active,.fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from,.fade-leave-to { opacity: 0; }
</style>
