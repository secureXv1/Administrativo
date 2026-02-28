<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-slate-800">
          Asignaciones — {{ vehicle.code }} ({{ vehicle.sigla }})
        </h3>
        <button class="btn-secondary btn-xs" @click="$emit('close')">Cerrar</button>
      </div>

      <!-- Formulario nueva asignación (oculto si hay una vigente) -->
      <div v-if="!hasActive" class="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
        <!-- Agente (typeahead con datalist filtrado) -->
        <div class="sm:col-span-2">
          <label class="label">Agente</label>
          <input
            v-model.trim="form.agentCode"
            class="input"
            placeholder="Código de agente"
            list="agentsList"
            autocomplete="off"
          />
          <datalist id="agentsList">
            <option
              v-for="a in filteredAgents"
              :key="a.id"
              :value="a.code"
            >
              {{ a.code }} — {{ a.nickname || a.name || '(sin nombre)' }}
            </option>
          </datalist>
          <p class="text-[11px] text-slate-500 mt-1" v-if="form.agentCode && !filteredAgents.length">
            Sin coincidencias para “{{ form.agentCode }}”.
          </p>
          <p class="text-[11px] text-slate-500 mt-1" v-else-if="form.agentCode && filteredAgents.length === maxSuggestions">
            Mostrando las primeras {{ maxSuggestions }} coincidencias…
          </p>
        </div>


        <!-- 👇 Ya NO pedimos fecha; la pone el backend (CURDATE) -->
        <!-- <div>...Inicio...</div>  ELIMINADO -->

        <div>
          <label class="label">Odómetro (inicio)</label>
          <input
            type="number"
            v-model="form.odometer_start"
            class="input"
            :placeholder="lastAssignOdoHint != null ? `Sugerido: ${lastAssignOdoHint}` : 'Odómetro al iniciar'"
          />
          <p v-if="lastAssignOdoHint != null" class="text-[11px] text-slate-500 mt-1">
            Último odómetro final registrado: <span class="font-medium">{{ lastAssignOdoHint }}</span>
          </p>
        </div>

        <div class="sm:col-span-5">
          <label class="label">Nota (opcional)</label>
          <textarea
            v-model="form.notes"
            rows="2"
            maxlength="500"
            class="w-full rounded-lg border border-slate-300 bg-white text-slate-900
                  placeholder-slate-400 px-3 py-2 shadow-sm focus:outline-none
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Observación general para esta asignación…"
          ></textarea>
        </div>

        <div class="sm:col-span-5 flex justify-end">
          <button class="btn-primary" @click="createAssignment" :disabled="submitting">
            {{ submitting ? 'Guardando…' : 'Asignar' }}
          </button>
        </div>
      </div>

      <!-- Banner cuando hay una asignación vigente -->
      <div v-else class="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm border border-amber-200">
        Ya existe una asignación vigente. Cierre la asignación actual para habilitar un nuevo registro.
      </div>


      <!-- Tabla de asignaciones -->
      <div class="overflow-x-auto mb-4">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left text-slate-600">
              <th class="py-2 pr-3">Agente</th>
              <th class="py-2 pr-3">Fec.Inicio</th>
              <th class="py-2 pr-3">Fec.Fin</th>
              <th class="py-2 pr-3">km inicio</th>
              <th class="py-2 pr-3">km fin</th>
              <th class="py-2 pr-3">Nota</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in assignments"
              :key="a.id"
              class="border-t align-top hover:bg-slate-50 transition-colors cursor-pointer"
              @click="verNota(a)"
            >
              <td class="py-2 pr-3 font-medium">
                {{ a.agentCode }}
                <span v-if="a.agentNickname" class="text-slate-500 font-normal ml-1">
                  ({{ a.agentNickname }})
                </span>
              </td>
              <td class="py-2 pr-3">{{ a.start_date }}</td>
              <td class="py-2 pr-3">{{ a.end_date || '—' }}</td>

              <!-- Odómetros -->
              <td class="py-2 pr-3">
                {{ a.odometer_start != null ? formatKm(a.odometer_start) : '—' }}
              </td>
              <td class="py-2 pr-3">
                {{ a.odometer_end != null ? formatKm(a.odometer_end) : '—' }}
              </td>
              
              <!-- Nota (solo lectura) -->
              <td class="py-2 pr-3">
                <span v-if="a.notes?.trim()" class="text-slate-700 truncate block max-w-[200px]">
                  {{ a.notes }}
                </span>
                <span v-else class="text-slate-400">—</span>
              </td>

              <!-- Acciones -->
              <td class="py-2 pr-0 whitespace-nowrap text-right">
                <button
                  v-if="!a.end_date"
                  @click.stop="closeAssignment(a)"
                  class="px-3 py-1 rounded-md text-white text-xs font-semibold bg-red-600 hover:bg-red-700
                        focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition"
                >
                  Finalizar asignación
                </button>
              </td>
            </tr>

            <tr v-if="!loading && !assignments.length">
              <td colspan="8" class="py-6 text-center text-slate-500">Sin asignaciones</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal para ver nota -->
      <div
        v-if="notaVisible"
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        @click.self="notaVisible = false"
      >
        <div class="bg-white rounded-xl shadow-lg max-w-md w-full p-5">
          <h4 class="font-semibold text-slate-800 mb-2">
            Nota de la asignación
          </h4>
          <p class="text-slate-700 whitespace-pre-wrap">{{ notaActual?.notes }}</p>
          <div class="text-right mt-4">
            <button class="btn-secondary btn-xs" @click="notaVisible = false">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, defineEmits, computed} from 'vue'
import { http } from '@/lib/http'

const props = defineProps({ vehicle: { type: Object, required: true } })
const emit = defineEmits(['close', 'changed'])
const agents = ref([])
const assignments = ref([])
const loading = ref(false)
const submitting = ref(false)
const notaVisible = ref(false)
const notaActual = ref(null)
const hasActive = computed(() => assignments.value.some(a => !a.end_date))


const form = ref({
  agentCode: '',
  start_date: '',
  odometer_start: '',
  notes: ''
})

// hint para el formulario (usamos el último odometer_end de asignaciones)
const lastAssignOdoHint = ref(null)

// función real
async function loadLastAssignOdometer() {
  try {
    const { data } = await http.get(`/vehicles/${props.vehicle.id}/last-assignment-odometer`)
    lastAssignOdoHint.value = data?.lastOdometer ?? null
    // si el campo está vacío, prellenar el odómetro final del form
    if (!form.value.odometer_start && lastAssignOdoHint.value != null) {
     form.value.odometer_start = String(lastAssignOdoHint.value)
   }
  } catch {
    lastAssignOdoHint.value = null
  }
}

// alias para no romper referencias antiguas:
async function loadLastOdometer() {
  return loadLastAssignOdometer()
}

async function loadAgents() {
  const { data } = await http.get('/vehicles/catalogs/agents', {
    params: { limit: 20000 }
  })
  agents.value = data.items || data || []
}

async function loadAssignments() {
  loading.value = true
  try {
    const { data } = await http.get(`/vehicles/${props.vehicle.id}/assignments`)
    assignments.value = data.items || data || []
  } finally {
    loading.value = false
  }
}

async function createAssignment() {
  // 1) Validar agente
  const ag = agents.value.find(a => a.code === form.value.agentCode)
  if (!ag) {
    alert('Agente no válido')
    return
  }

  // 2) Validar odómetro inicial (obligatorio, ≥0)
  const odoStr = String(form.value.odometer_start ?? '').trim()
  if (!odoStr) {
    alert('Debes ingresar el kilometraje inicial.')
    return
  }

  const odoNum = Number(odoStr)
  if (!Number.isFinite(odoNum) || odoNum < 0) {
    alert('Kilometraje inicial inválido.')
    return
  }

  // 3) No menor al último odómetro final registrado (si existe)
  const lastKm =
    lastAssignOdoHint.value != null
      ? Number(lastAssignOdoHint.value)
      : null

  if (lastKm != null && Number.isFinite(lastKm) && odoNum < lastKm) {
    alert(
      `⚠️ El odómetro inicial (${odoNum}) no puede ser menor ` +
      `al último registrado (${lastKm}).`
    )
    return
  }

  submitting.value = true
  try {
    await http.post(`/vehicles/${props.vehicle.id}/assignments`, {
      agent_id: ag.id,
      odometer_start: odoNum,
      notes: (form.value.notes || '').trim() || null
    })

    // Limpiar formulario
    form.value = {
      agentCode: '',
      start_date: '',
      odometer_start: '',
      notes: ''
    }

    // Recargar asignaciones y sugerencia de odómetro
    await loadAssignments()
    await loadLastAssignOdometer()
    emit('changed')
  } finally {
    submitting.value = false
  }
}

async function closeAssignment(a) {
  // valor por defecto para el prompt:
  const base =
    a.odometer_end ??
    a.odometer_start ??
    lastAssignOdoHint.value ??
    ''

  const odoStr = window.prompt(
    'Odómetro final (obligatorio, número entero)',
    base === null ? '' : String(base)
  )

  // Si cancela el prompt, no hacemos nada
  if (odoStr == null) return

  const odoTrim = String(odoStr).trim()
  if (!odoTrim) {
    alert('Debes ingresar el kilometraje final.')
    return
  }

  const odoNum = Number(odoTrim)
  if (!Number.isFinite(odoNum) || odoNum < 0) {
    alert('Odómetro inválido.')
    return
  }

  const startKm =
    a.odometer_start != null
      ? Number(a.odometer_start)
      : null

  if (startKm != null && Number.isFinite(startKm) && odoNum < startKm) {
    alert(
      `El odómetro final (${odoNum}) no puede ser menor ` +
      `al odómetro inicial (${startKm}).`
    )
    return
  }

  await http.patch(`/vehicles/${props.vehicle.id}/assignments/${a.id}`, {
    odometer_end: odoNum
  })

  // Recarga asignaciones y último odómetro para que la próxima asignación
  // ya tenga la sugerencia correcta
  await loadAssignments()
  await loadLastAssignOdometer()
  emit('changed')
}


function verNota(a) {
  if (!a.notes?.trim()) return
  notaActual.value = a
  notaVisible.value = true
}

function formatKm(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return n.toLocaleString('es-CO') // ej: 12.345
}
function deltaKm(a) {
  const s = Number(a.odometer_start)
  const e = Number(a.odometer_end)
  if (!Number.isFinite(s) || !Number.isFinite(e)) return '—'
  const d = e - s
  return d >= 0 ? d.toLocaleString('es-CO') : `-${Math.abs(d).toLocaleString('es-CO')}`
}
const maxSuggestions = 30

const filteredAgents = computed(() => {
  const q = (form.value.agentCode || '').toLowerCase().trim()
  if (!q) return []
  // filtra por código o nickname/name
  return (agents.value || [])
    .filter(a => {
      const code = String(a.code || '').toLowerCase()
      const nick = String(a.nickname || a.name || '').toLowerCase()
      return code.includes(q) || nick.includes(q)
    })
    .slice(0, maxSuggestions)
})

watch(() => form.value.agentCode, (val) => {
  if (!val) return
  // si hay solo una coincidencia exacta, mantenla
  const exact = (filteredAgents.value || []).find(a => a.code === val)
  if (exact) return
}, { flush: 'sync' })


onMounted(() => {
  loadAssignments(); loadAgents(); loadLastAssignOdometer()
})
watch(() => props.vehicle?.id, () => {
  loadAssignments()
  loadLastAssignOdometer()
})
</script>
