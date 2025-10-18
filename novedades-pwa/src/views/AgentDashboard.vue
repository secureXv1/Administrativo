<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold">Panel del agente</h1>
        <button @click="logout" class="btn-ghost">Cerrar sesión</button>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <!-- Mis asignaciones vigentes -->
      <section class="bg-white rounded-2xl shadow p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-slate-800">Mis asignaciones vigentes</h2>
          <button class="btn-secondary btn-xs" @click="loadMyActiveAssignments" :disabled="loadingAssignments">
            {{ loadingAssignments ? 'Actualizando…' : 'Actualizar' }}
          </button>
        </div>
        <div v-if="loadingAssignments" class="text-sm text-slate-500">Cargando asignaciones…</div>
        <div v-else-if="!myAssignments.length" class="text-sm text-slate-500">No tienes asignaciones vigentes.</div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-slate-600">
                <th class="py-2 pr-3">Vehículo</th>
                <th class="py-2 pr-3">Inicio</th>
                <th class="py-2 pr-3">Km inicio</th>
                <th class="py-2 pr-3">Nota</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in myAssignments" :key="row.id" class="border-t">
                <td class="py-2 pr-3 font-medium">{{ row.vehicle.code }} ({{ row.vehicle.sigla }})</td>
                <td class="py-2 pr-3">{{ row.start_date }}</td>
                <td class="py-2 pr-3">{{ row.odometer_start ?? '—' }}</td>
                <td class="py-2 pr-3"><span v-if="row.notes?.trim()">{{ row.notes }}</span><span v-else class="text-slate-400">—</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Buscar vehículo e iniciar/cerrar uso -->
      <section class="bg-white rounded-2xl shadow p-4">
        <h2 class="font-semibold text-slate-800 mb-3">Iniciar / cerrar uso</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-2">
            <label class="label">Buscar vehículo (código o sigla)</label>
            <div class="relative">
              <input
                v-model="vehicleQuery"
                @input="searchVehicles"
                class="input w-full"
                placeholder="Ej: 06-004 o 004"
                autocomplete="off"
              />
              <div
                v-if="vehicleResultsVisible"
                class="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow max-h-64 overflow-auto"
                @mouseleave="hideDropdownSoon"
              >
                <button
                  v-for="v in vehicleResults"
                  :key="v.id"
                  class="w-full text-left px-3 py-2 hover:bg-slate-50"
                  @click="pickVehicle(v)"
                >
                  <div class="font-medium text-sm">{{ v.code }} — {{ v.sigla }}</div>
                  <div class="text-[11px] text-slate-500">Grupo: {{ v.groupName || '—' }} · Unidad: {{ v.unitName || '—' }}</div>
                </button>
                <div v-if="!vehicleResults.length" class="px-3 py-2 text-sm text-slate-500">Sin resultados…</div>
              </div>
            </div>
          </div>

          <div class="md:col-span-1">
            <label class="label">Seleccionado</label>
            <div class="h-[42px] px-3 rounded-lg border flex items-center text-sm bg-slate-50">
              <span v-if="selectedVehicle">{{ selectedVehicle.code }} ({{ selectedVehicle.sigla }})</span>
              <span v-else class="text-slate-400">Ninguno</span>
            </div>
          </div>
        </div>

        <div v-if="selectedVehicle" class="mt-4 border-t pt-3">
          <div class="flex flex-col md:flex-row md:items-end gap-3">
            <div class="flex-1">
              <label class="label">Odómetro inicial</label>
              <input
                type="number"
                v-model="form.odometer_start"
                class="input w-full"
                :placeholder="lastOdoHint != null ? `Sugerido: ${lastOdoHint}` : 'Odómetro inicial'"
                :disabled="!!openUseId"
              />
              <p v-if="lastOdoHint != null" class="text-[11px] text-slate-500 mt-1">
                Último odómetro final registrado: <span class="font-medium">{{ lastOdoHint }}</span>
              </p>
            </div>
            <div class="flex gap-2">
              <button
                class="btn-primary"
                @click="startUse"
                :disabled="starting || !!openUseId"
                v-if="!openUseId"
              >
                {{ starting ? 'Iniciando…' : 'Iniciar uso' }}
              </button>
              <button
                class="px-3 py-2 rounded-md text-white font-semibold bg-red-600 hover:bg-red-700
                       focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition"
                @click="endUse"
                :disabled="ending || !openUseId"
                v-else
              >
                {{ ending ? 'Cerrando…' : 'Cerrar uso' }}
              </button>
            </div>
          </div>
          <div v-if="openUseInfo" class="mt-3 text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div class="font-medium mb-1">Tienes un uso abierto para este vehículo.</div>
            <div>Inicio: <strong>{{ openUseInfo.started_at }}</strong></div>
            <div>Odómetro salida: <strong>{{ openUseInfo.odometer_start ?? '—' }}</strong></div>
            <!-- Novedades del uso abierto -->
            <div v-if="openUseNovedades.length" class="mt-2">
              <b>Novedades de este uso:</b>
              <ul class="list-disc pl-6 text-xs mt-1">
                <li v-for="n in openUseNovedades" :key="n.id">
                  {{ n.description }}
                  <a v-if="n.photoUrl" :href="`/${n.photoUrl}`" target="_blank" class="text-blue-600 underline ml-1">foto</a>
                  <span class="text-slate-400 ml-2">{{ n.created_at }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <!-- Bloque de novedades previas (staging, SOLO SIN USO ABIERTO) -->
        <div v-if="selectedVehicle && !openUseId" class="mt-6 bg-slate-50 rounded-xl p-3 border">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-medium">Novedades recientes</h3>
            <button class="btn-secondary btn-xs" @click="loadStagingNovedades">Actualizar</button>
          </div>
          <div v-if="loadingNovedades" class="text-xs text-slate-400">Cargando novedades…</div>
          <div v-else>
            <div v-if="!novedadesStaging.length" class="text-xs text-slate-400">No hay novedades registradas aún.</div>
            <div v-for="n in novedadesStaging" :key="n.id" class="text-xs border-b py-1 flex items-center justify-between">
              <div>
                • {{ n.description }}
                <a v-if="n.photoUrl" :href="`/${n.photoUrl}`" target="_blank" class="text-blue-600 underline ml-1">foto</a>
                <span class="text-slate-400 ml-2">{{ n.created_at }}</span>
              </div>
              <button class="text-red-600 hover:text-red-800 font-medium text-[11px]" @click="deleteNovedad(n.id)">
                Eliminar
              </button>
            </div>
            <div class="mt-2 flex gap-2">
              <input v-model="newNovedad.description" class="input flex-1" placeholder="Descripción de novedad" maxlength="500" />
              <input type="file" @change="onPhoto" accept="image/*" class="input w-32" />
              <button class="btn-primary btn-xs" @click="addNovedad">Agregar</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Historial de usos del agente SOLO EN ESE VEHÍCULO -->
      <section v-if="selectedVehicle" class="bg-white rounded-2xl shadow p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-slate-800">Mis usos de este vehículo</h2>
          <button class="btn-secondary btn-xs" @click="loadUsesForSelected" :disabled="loadingUses">
            {{ loadingUses ? 'Actualizando…' : 'Actualizar' }}
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-slate-600">
                <th class="py-2 pr-3">#</th>
                <th class="py-2 pr-3">Inicio</th>
                <th class="py-2 pr-3">Fin</th>
                <th class="py-2 pr-3">Km salida</th>
                <th class="py-2 pr-3">Km entrada</th>
                <th class="py-2 pr-3">Notas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in uses" :key="u.id" class="border-t">
                <td class="py-2 pr-3">#{{ u.id }}</td>
                <td class="py-2 pr-3">{{ u.started_at }}</td>
                <td class="py-2 pr-3">{{ u.ended_at || '—' }}</td>
                <td class="py-2 pr-3">{{ u.odometer_start ?? '—' }}</td>
                <td class="py-2 pr-3">{{ u.odometer_end ?? '—' }}</td>
                <td class="py-2 pr-3">{{ u.notes || '—' }}</td>
              </tr>
              <tr v-if="!loadingUses && !uses.length">
                <td colspan="6" class="py-6 text-center text-slate-500">Sin usos</td>
              </tr>
            </tbody>
          </table>
          <div v-if="loadingUses" class="text-sm text-slate-500 mt-2">Cargando…</div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { http } from '@/lib/http'

const me = ref(null)
const vehicleQuery = ref('')
const vehicleResults = ref([])
const vehicleResultsVisible = ref(false)
const selectedVehicle = ref(null)

const lastOdoHint = ref(null)
const openUseId = ref(null)
const openUseInfo = ref(null)

const form = ref({ odometer_start: '' })
const starting = ref(false)
const ending = ref(false)

const myAssignments = ref([])
const loadingAssignments = ref(false)

const uses = ref([])
const loadingUses = ref(false)

const novedadesStaging = ref([])
const loadingNovedades = ref(false)
const newNovedad = ref({ description: '', file: null })

const openUseNovedades = ref([])

function hideDropdownSoon() {
  setTimeout(() => (vehicleResultsVisible.value = false), 150)
}

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login/'
}

function onPhoto(e) {
  newNovedad.value.file = e.target.files?.[0] || null
}

async function addNovedad() {
  if (!selectedVehicle.value || !newNovedad.value.description) return
  const fd = new FormData()
  fd.append('description', newNovedad.value.description)
  if (newNovedad.value.file) fd.append('photo', newNovedad.value.file)
  await http.post(`/vehicles/vehicle/${selectedVehicle.value.id}/novelties`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  newNovedad.value = { description: '', file: null }
  await loadStagingNovedades()
}

async function deleteNovedad(id) {
  await http.delete(`/vehicles/novelties/${id}`)
  await loadStagingNovedades()
}

async function loadStagingNovedades() {
  novedadesStaging.value = []
  if (!selectedVehicle.value) return
  loadingNovedades.value = true
  try {
    const { data } = await http.get(`/vehicles/${selectedVehicle.value.id}/novelties/recent`)
    novedadesStaging.value = data.items || []
  } finally {
    loadingNovedades.value = false
  }
}

async function loadOpenUseNovedades() {
  openUseNovedades.value = []
  if (!openUseInfo.value) return
  const { data } = await http.get(`/vehicles/uses/${openUseInfo.value.id}/novelties`)
  openUseNovedades.value = data.items || []
}

async function loadMe() {
  const { data } = await http.get('/me')
  me.value = data
}

async function loadMyActiveAssignments() {
  loadingAssignments.value = true
  try {
    const { data: vehs } = await http.get('/vehicles', { params: { pageSize: 500 } })
    const items = vehs.items || []
    const out = []
    await Promise.all(items.map(async v => {
      try {
        const { data: asg } = await http.get(`/vehicles/${v.id}/assignments`)
        const list = (asg.items || asg || []).filter(a =>
          a.agentId && me.value?.agentId && a.agentId === me.value.agentId && !a.end_date
        )
        list.forEach(a => out.push({ ...a, vehicle: { id: v.id, code: v.code, sigla: v.sigla } }))
      } catch {}
    }))
    out.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
    myAssignments.value = out
  } finally {
    loadingAssignments.value = false
  }
}

let searchTimer = null
function searchVehicles() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    const q = vehicleQuery.value.trim()
    if (!q) {
      vehicleResults.value = []
      vehicleResultsVisible.value = false
      return
    }
    const { data } = await http.get('/vehicles', { params: { query: q, pageSize: 20 } })
    vehicleResults.value = data.items || []
    vehicleResultsVisible.value = true
  }, 220)
}

async function pickVehicle(v) {
  selectedVehicle.value = v
  vehicleQuery.value = `${v.code} — ${v.sigla}`
  vehicleResultsVisible.value = false
  await afterSelectVehicle()
}

async function afterSelectVehicle() {
  await Promise.all([
    loadLastAssignOdometer(),
    checkOpenUse(),
    loadUsesForSelected(),
    loadStagingNovedades(),
    loadOpenUseNovedades()
  ])
}

async function loadLastAssignOdometer() {
  lastOdoHint.value = null
  if (!selectedVehicle.value) return
  try {
    const { data } = await http.get(`/vehicles/${selectedVehicle.value.id}/last-assignment-odometer`)
    lastOdoHint.value = data?.lastOdometer ?? null
    if (!form.value.odometer_start && lastOdoHint.value != null) {
      form.value.odometer_start = String(lastOdoHint.value)
    }
  } catch {}
}

async function checkOpenUse() {
  openUseId.value = null
  openUseInfo.value = null
  if (!selectedVehicle.value || !me.value?.agentId) return
  const { data } = await http.get('/vehicles/uses', {
    params: { vehicle_id: selectedVehicle.value.id, agent_id: me.value.agentId, open: 1 }
  })
  const list = data.items || []
  if (list.length) {
    openUseId.value = list[0].id
    openUseInfo.value = list[0]
    await loadOpenUseNovedades()
  } else {
    openUseNovedades.value = []
  }
}

async function startUse() {
  if (!selectedVehicle.value) return
  if (openUseId.value) return alert('Ya hay un uso abierto para este vehículo.')
  if (!me.value?.agentId) return alert('No se pudo determinar tu agente.')
  starting.value = true
  try {
    await http.post('/vehicles/uses/start', {
      vehicle_id: selectedVehicle.value.id,
      agent_id: me.value.agentId,
      odometer_start: form.value.odometer_start || null
    })
    await Promise.all([checkOpenUse(), loadUsesForSelected(), loadStagingNovedades()])
    alert('Uso iniciado correctamente.')
  } catch (e) {
    alert(e?.response?.data?.error || 'Error al iniciar uso')
  } finally {
    starting.value = false
  }
}

async function endUse() {
  if (!openUseId.value) return
  const od = prompt('Odómetro final (opcional, deja vacío si no aplica):', '')
  let odNum = null
  if (od != null && od !== '') {
    const n = Number(od)
    if (!Number.isFinite(n) || n < 0) return alert('Odómetro inválido')
    odNum = n
  }
  ending.value = true
  try {
    await http.patch(`/vehicles/uses/${openUseId.value}/end`, { odometer_end: odNum })
    await Promise.all([checkOpenUse(), loadUsesForSelected(), loadStagingNovedades()])
    alert('Uso cerrado correctamente.')
  } catch (e) {
    alert(e?.response?.data?.error || 'Error al cerrar uso')
  } finally {
    ending.value = false
  }
}

async function loadUsesForSelected() {
  loadingUses.value = true
  uses.value = []
  try {
    if (!selectedVehicle.value || !me.value?.agentId) return
    // Solo los usos de este agente y este vehículo
    const { data } = await http.get('/vehicles/uses', {
      params: { vehicle_id: selectedVehicle.value.id, agent_id: me.value.agentId }
    })
    uses.value = data.items || []
  } finally {
    loadingUses.value = false
  }
}

onMounted(async () => {
  await loadMe()
  await loadMyActiveAssignments()
})
</script>

<style scoped>
.label { @apply text-xs font-medium text-slate-600 mb-1 block; }
.input { @apply w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500; }
.btn-ghost { @apply px-3 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg; }
.btn-secondary { @apply px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50; }
.btn-primary { @apply px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1; }
</style>
