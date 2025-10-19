<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-slate-800">
          Usos — {{ vehicle.code }} ({{ vehicle.sigla }})
        </h3>
        <button class="btn-secondary btn-xs" @click="$emit('close')">Cerrar</button>
      </div>
      <!-- Banner cuando hay un uso vigente -->
      <div v-if="hasOpenUse" class="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm border border-amber-200">
        Ya existe un uso vigente. Cierre el uso actual para habilitar un nuevo registro.
      </div>
      <!-- 🔹 Bloque de novedades previas al inicio del uso -->
      <div v-if="!hasOpenUse" class="border rounded-xl p-3 bg-slate-50 mb-6">
        <h4 class="font-semibold text-slate-700 text-sm mb-3">
          Novedades recientes del vehículo
        </h4>
        <div v-if="loadingNovs" class="text-xs text-slate-500">Cargando novedades…</div>

        <div v-else>
          <div v-if="!recentNovedades.length" class="text-xs text-slate-400 mb-2">
            No hay novedades registradas aún.
          </div>
          <div v-for="n in recentNovedades" :key="n.id" class="text-xs border-b py-1 flex items-center justify-between">
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

          <!-- Formulario para nueva novedad -->
          <div class="mt-3 flex flex-col sm:flex-row gap-2 items-end">
            <input
              v-model="newNovedad.description"
              class="input flex-1"
              placeholder="Descripción de la novedad"
              maxlength="500"
            />
            <input
              type="file"
              @change="onPhoto"
              accept="image/*"
              class="input w-36 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-700"
            />
            <button class="btn-primary btn-xs" @click="addNovedad">Agregar</button>
          </div>
        </div>
      </div>

      <!-- Formulario nuevo uso -->
      <div v-if="!hasOpenUse" class="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
        <div class="sm:col-span-2">
          <label class="label">Agente</label>
          <input v-model="form.agentCode" class="input" placeholder="Código de agente" list="agentsList" />
          <datalist id="agentsList">
            <option v-for="a in agents" :key="a.id" :value="a.code" />
          </datalist>
        </div>
        <div>
          <label class="label">Odómetro</label>
          <input type="number" v-model="form.odometer_start" class="input" />
        </div>
        <div class="sm:col-span-5 flex justify-end">
          <button class="btn-primary" @click="createUse" :disabled="submitting">
            {{ submitting ? 'Guardando…' : 'Iniciar uso' }}
          </button>
        </div>
      </div>

      <!-- Tabla de usos -->
      <table class="min-w-full text-sm">
        <thead>
          <tr class="text-left text-slate-600">
            <th class="py-2 pr-3">Agente</th>
            <th class="py-2 pr-3">Inicio</th>
            <th class="py-2 pr-3">Fin</th>
            <th class="py-2 pr-3">km inicio</th>
            <th class="py-2 pr-3">km fin</th>
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
                <button
                  v-if="!u.ended_at"
                  class="px-3 py-1 rounded-md text-white text-xs font-semibold bg-red-600 hover:bg-red-700
                        focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition"
                  @click="closeUse(u)"
                >
                  Cerrar
                </button>
                <button class="btn-secondary btn-xs ml-1" @click="toggleNovedades(u.id)">
                  {{ expandedUseId === u.id ? 'Ocultar' : 'Novedades' }}
                </button>
              </td>
            </tr>

            <!-- Novedades inline (solo lectura) -->
            <tr v-if="expandedUseId === u.id">
              <td colspan="6" class="bg-slate-50 px-3 py-3">
                <NovedadesBlock :tipo="'uses'" :refId="u.id" :canDelete="false" :readonly="true" />
              </td>
            </tr>
          </template>

          <tr v-if="!loading && !uses.length">
            <td colspan="6" class="py-6 text-center text-slate-500">Sin usos</td>
          </tr>
        </tbody>
      </table>

      <!-- Novedades del uso -->
      <div v-if="selectedUseId" class="mt-6 border-t pt-4">
        <h4 class="font-semibold text-slate-700 text-sm mb-2">Novedades del uso</h4>
        <NovedadesBlock
          :tipo="'use'"
          :refId="selectedUseId"
          canDelete
          @close="selectedUseId = null"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { http } from '@/lib/http'
import NovedadesBlock from './NovedadesBlock.vue'

const props = defineProps({ vehicle: { type: Object, required: true } })
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
  odometer_start: ''
})

async function loadAgents() {
  const { data } = await http.get('/catalogs/agents')
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
  if (!newNovedad.value.description && !newNovedad.value.file) return
  const fd = new FormData()
  fd.append('description', newNovedad.value.description)
  if (newNovedad.value.file) fd.append('photo', newNovedad.value.file)
  await http.post(`/vehicles/vehicle/${props.vehicle.id}/novelties`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
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
    const ag = agents.value.find(a => a.code === form.value.agentCode)
    if (!ag) return alert('Agente no válido')

    await http.post('/vehicles/uses/start', {
      vehicle_id: props.vehicle.id,
      agent_id: ag.id,
      odometer_start: form.value.odometer_start || null,
    })

    form.value = { agentCode: '', started_at: '', odometer_start: '' }
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
