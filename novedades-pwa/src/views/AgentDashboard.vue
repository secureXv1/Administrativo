<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Hero superior -->
    <div class="bg-gradient-to-r from-slate-800 to-slate-700">
      <div class="max-w-6xl mx-auto px-4 py-8">
        <h1 class="text-white text-2xl font-semibold">Panel del agente</h1>
        <p class="text-slate-300 text-sm mt-1">Tu cuenta y operaciones diarias</p>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-4 -mt-6 pb-10">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <!-- SIDEBAR -->
        <aside class="md:col-span-3">
          <div class="bg-white rounded-2xl shadow p-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full bg-slate-100 grid place-content-center">
                <svg class="w-6 h-6 text-slate-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </div>
              <div class="min-w-0">
                <div class="text-slate-900 font-medium truncate">{{ me?.name || 'Agente' }}</div>
                <div class="text-xs text-slate-500 truncate">{{ me?.email || '—' }}</div>
              </div>
            </div>
            <button
              @click="logout"
              class="mt-3 w-full px-3 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
            >
              Cerrar sesión
            </button>
          </div>

          <nav class="mt-4 bg-white rounded-2xl shadow p-2">
            <button
              v-for="item in menu"
              :key="item.key"
              @click="section=item.key"
              class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm"
              :class="section===item.key
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50'"
            >
              <span class="truncate">{{ item.label }}</span>
              <svg v-if="section===item.key" class="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </nav>
        </aside>

        <!-- CONTENT -->
        <section class="md:col-span-9 space-y-6">
          <!-- Encabezado local + breadcrumb -->
          <div class="bg-white rounded-2xl shadow p-4 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-500">Inicio / <span class="capitalize">{{ section }}</span></div>
              <h2 class="text-slate-900 font-semibold text-lg mt-0.5">
                {{ titleBySection }}
              </h2>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="section==='vehiculos'"
                class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                @click="loadMyActiveAssignments"
                :disabled="loadingAssignments"
              >
                {{ loadingAssignments ? 'Actualizando…' : 'Actualizar' }}
              </button>
              <button
                v-if="section==='novedades'"
                class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                @click="loadDailyHistory"
                :disabled="dailyHistoryLoading"
              >
                {{ dailyHistoryLoading ? 'Cargando…' : 'Actualizar' }}
              </button>
            </div>
          </div>

          <!-- ================= MIS NOVEDADES (historial solo visual) ================= -->
          <div v-show="section==='novedades'" class="space-y-6">
            <div class="bg-white rounded-2xl shadow">
              <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                <h3 class="font-semibold text-slate-900">Historial de mis estados</h3>
                <p class="text-xs text-slate-500">SIN NOVEDAD · SERVICIO · COMISIÓN DEL SERVICIO</p>
              </div>

              <div class="p-4">
                <div class="flex flex-wrap items-center gap-2 mb-3">
                  <input type="date" v-model="filterFrom"
                         class="h-9 rounded-lg border border-slate-300 bg-white text-slate-900 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                  <span class="text-xs text-slate-500">a</span>
                  <input type="date" v-model="filterTo"
                         class="h-9 rounded-lg border border-slate-300 bg-white text-slate-900 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                  <button
                    class="h-9 px-3 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                    @click="applyHistoryFilter"
                  >Filtrar</button>
                  <div class="flex-1"></div>
                </div>

                <!-- Tabla estilo “Mi cuenta” -->
                <div class="overflow-x-auto rounded-xl border border-slate-200">
                  <table class="min-w-full text-sm">
                    <thead class="bg-slate-800 text-white">
                      <tr>
                        <th class="text-left py-2 px-3 font-semibold">Fecha</th>
                        <th class="text-left py-2 px-3 font-semibold">Estado</th>
                        <th class="text-left py-2 px-3 font-semibold">Descripción</th>
                        <th class="text-left py-2 px-3 font-semibold">Autor</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white">
                      <tr v-for="h in filteredDailyHistory" :key="h.id" class="border-t">
                        <td class="py-2 px-3 text-slate-700">{{ h.created_at }}</td>
                        <td class="py-2 px-3">
                          <span class="px-2 py-1 text-xs rounded-full border"
                                :class="dailyBadgeClass(h.state)">
                            {{ h.state || 'SIN NOVEDAD' }}
                          </span>
                        </td>
                        <td class="py-2 px-3 text-slate-700">{{ h.description || '—' }}</td>
                        <td class="py-2 px-3 text-slate-500 text-xs">{{ h.author || 'Tú' }}</td>
                      </tr>
                      <tr v-if="!dailyHistoryLoading && !filteredDailyHistory.length">
                        <td colspan="4" class="py-6 text-center text-slate-500">Sin registros</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div v-if="dailyHistoryLoading" class="text-sm text-slate-500 mt-3">Cargando…</div>
              </div>
            </div>
          </div>

          <!-- ================= VEHÍCULOS (tu flujo tal cual) ================= -->
          <div v-show="section==='vehiculos'" class="space-y-6">
            <!-- Mis asignaciones vigentes -->
            <section class="bg-white rounded-2xl shadow">
              <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                <h3 class="font-semibold text-slate-900">Mis asignaciones vigentes</h3>
              </div>
              <div class="p-4">
                <div v-if="loadingAssignments" class="text-sm text-slate-500">Cargando asignaciones…</div>
                <div v-else-if="!myAssignments.length" class="text-sm text-slate-500">No tienes asignaciones vigentes.</div>
                <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
                  <table class="min-w-full text-sm">
                    <thead class="bg-slate-800 text-white">
                      <tr>
                        <th class="text-left py-2 px-3 font-semibold">Vehículo</th>
                        <th class="text-left py-2 px-3 font-semibold">Inicio</th>
                        <th class="text-left py-2 px-3 font-semibold">Km inicio</th>
                        <th class="text-left py-2 px-3 font-semibold">Nota</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white">
                      <tr v-for="row in myAssignments" :key="row.id" class="border-t">
                        <td class="py-2 px-3 font-medium">{{ row.vehicle.code }} ({{ row.vehicle.sigla }})</td>
                        <td class="py-2 px-3">{{ row.start_date }}</td>
                        <td class="py-2 px-3">{{ row.odometer_start ?? '—' }}</td>
                        <td class="py-2 px-3">
                          <span v-if="row.notes?.trim()">{{ row.notes }}</span>
                          <span v-else class="text-slate-400">—</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
            <!-- ================= MIS USOS VIGENTES (nuevo bloque) ================= -->
            <section class="bg-white rounded-2xl shadow">
              <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl flex items-center justify-between">
                <h3 class="font-semibold text-slate-900">Mis usos vigentes</h3>
                <button
                  class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                  @click="loadMyOpenUses" :disabled="loadingOpenUses"
                >
                  {{ loadingOpenUses ? 'Actualizando…' : 'Actualizar' }}
                </button>
              </div>
              <div class="p-4">
                <div v-if="loadingOpenUses" class="text-sm text-slate-500">Cargando usos…</div>
                <div v-else-if="!myOpenUses.length" class="text-sm text-slate-500">No tienes usos abiertos.</div>
                <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
                  <table class="min-w-full text-sm">
                    <thead class="bg-slate-800 text-white">
                      <tr>
                        <th class="text-left py-2 px-3 font-semibold">Vehículo</th>
                        <th class="text-left py-2 px-3 font-semibold">Inicio</th>
                        <th class="text-left py-2 px-3 font-semibold">Km salida</th>
                        <th class="text-left py-2 px-3 font-semibold">Nota</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white">
                      <tr v-for="u in myOpenUses" :key="u.id" class="border-t">
                        <td class="py-2 px-3 font-medium">
                          {{ u.vehicle?.code }} <span v-if="u.vehicle?.sigla">({{ u.vehicle.sigla }})</span>
                        </td>
                        <td class="py-2 px-3">{{ u.started_at }}</td>
                        <td class="py-2 px-3">{{ u.odometer_start ?? '—' }}</td>
                        <td class="py-2 px-3">{{ u.notes?.trim() || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>


            <!-- Buscar vehículo e iniciar/cerrar uso -->
            <section class="bg-white rounded-2xl shadow">
              <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                <h3 class="font-semibold text-slate-900">Iniciar / cerrar uso</h3>
              </div>
              <div class="p-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div class="md:col-span-2">
                    <label class="text-xs font-medium text-slate-600 mb-1 block">Buscar vehículo (código o sigla)</label>
                    <div class="relative">
                      <input
                        v-model="vehicleQuery"
                        @input="searchVehicles"
                        class="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    <label class="text-xs font-medium text-slate-600 mb-1 block">Seleccionado</label>
                    <div class="h-[42px] px-3 rounded-lg border flex items-center text-sm bg-slate-50">
                      <span v-if="selectedVehicle">{{ selectedVehicle.code }} ({{ selectedVehicle.sigla }})</span>
                      <span v-else class="text-slate-400">Ninguno</span>
                    </div>
                  </div>
                </div>

                <div v-if="selectedVehicle" class="mt-4 border-t pt-3">
                  <div class="flex flex-col md:flex-row md:items-end gap-3">
                    <div class="flex-1">
                      <label class="text-xs font-medium text-slate-600 mb-1 block">Odómetro inicial</label>
                      <input
                        type="number"
                        v-model="form.odometer_start"
                        class="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        :placeholder="lastOdoHint != null ? `Sugerido: ${lastOdoHint}` : 'Odómetro inicial'"
                        :disabled="!!openUseId"
                      />
                      <p v-if="lastOdoHint != null" class="text-[11px] text-slate-500 mt-1">
                        Último odómetro final registrado: <span class="font-medium">{{ lastOdoHint }}</span>
                      </p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        class="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                        @click="startUse"
                        :disabled="starting || !!openUseId"
                        v-if="!openUseId"
                      >
                        {{ starting ? 'Iniciando…' : 'Iniciar uso' }}
                      </button>
                      <button
                        class="px-3 py-2 rounded-md text-white font-semibold bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition"
                        @click="endUse"
                        :disabled="ending || !openUseId"
                        v-else
                      >
                        {{ ending ? 'Cerrando…' : 'Cerrar uso' }}
                      </button>
                    </div>
                  </div>

                  <!-- Novedades del uso abierto -->
                  <div v-if="openUseInfo" class="mt-3 text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div class="font-medium mb-1">Tienes un uso abierto para este vehículo.</div>
                    <div>Inicio: <strong>{{ openUseInfo.started_at }}</strong></div>
                    <div>Odómetro salida: <strong>{{ openUseInfo.odometer_start ?? '—' }}</strong></div>

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

                <!-- Novedades previas (sin uso abierto) -->
                <div v-if="selectedVehicle && !openUseId" class="mt-6 bg-slate-50 rounded-xl p-3 border">
                  <div class="flex items-center justify-between mb-2">
                    <h3 class="font-medium">Novedades recientes</h3>
                    <button
                      class="px-2 py-1 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                      @click="loadStagingNovedades"
                    >Actualizar</button>
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
                      <input v-model="newNovedad.description"
                             class="flex-1 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                             placeholder="Descripción de novedad" maxlength="500" />
                      <input type="file" @change="onPhoto" accept="image/*"
                             class="rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32" />
                      <button class="px-3 py-1.5 text-xs rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                              @click="addNovedad">
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Historial de usos -->
            <section v-if="selectedVehicle" class="bg-white rounded-2xl shadow">
              <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                <h3 class="font-semibold text-slate-900">Mis usos de este vehículo</h3>
              </div>
              <div class="p-4">
                <div class="overflow-x-auto rounded-xl border border-slate-200">
                  <table class="min-w-full text-sm">
                    <thead class="bg-slate-800 text-white">
                      <tr>
                        <th class="text-left py-2 px-3 font-semibold">#</th>
                        <th class="text-left py-2 px-3 font-semibold">Inicio</th>
                        <th class="text-left py-2 px-3 font-semibold">Fin</th>
                        <th class="text-left py-2 px-3 font-semibold">Km salida</th>
                        <th class="text-left py-2 px-3 font-semibold">Km entrada</th>
                        <th class="text-left py-2 px-3 font-semibold">Notas</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white">
                      <tr v-for="u in uses" :key="u.id" class="border-t">
                        <td class="py-2 px-3">#{{ u.id }}</td>
                        <td class="py-2 px-3">{{ u.started_at }}</td>
                        <td class="py-2 px-3">{{ u.ended_at || '—' }}</td>
                        <td class="py-2 px-3">{{ u.odometer_start ?? '—' }}</td>
                        <td class="py-2 px-3">{{ u.odometer_end ?? '—' }}</td>
                        <td class="py-2 px-3">{{ u.notes || '—' }}</td>
                      </tr>
                      <tr v-if="!loadingUses && !uses.length">
                        <td colspan="6" class="py-6 text-center text-slate-500">Sin usos</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-if="loadingUses" class="text-sm text-slate-500 mt-2">Cargando…</div>
              </div>
            </section>
          </div>

          <!-- ================= SERVICIOS ================= -->
          <div v-show="section==='servicios'" class="space-y-6">
            <div class="bg-white rounded-2xl shadow p-4">
              <h3 class="font-semibold text-slate-900">Servicios</h3>
              <p class="text-sm text-slate-500">En desarrollo…</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { http } from '@/lib/http'
import { ref, computed, onMounted, watch, nextTick } from 'vue'

/* ===== Sidebar / navegación ===== */
const section = ref('novedades') // 'novedades' | 'vehiculos' | 'servicios'
const menu = [
  { key: 'novedades', label: 'Mis novedades' },
  { key: 'vehiculos', label: 'Vehículos' },
  { key: 'servicios', label: 'Servicios' },
]
const titleBySection = computed(() => ({
  novedades: 'Mis novedades — Historial',
  vehiculos: 'Gestión de vehículos',
  servicios: 'Servicios',
}[section.value]))

/* ===== Usuario ===== */
const me = ref(null)
async function loadMe(){ const { data } = await http.get('/me'); me.value = data }
function logout(){ localStorage.removeItem('token'); window.location.href='/login/' }

/* ===== Mis novedades (solo visual) ===== */
const dailyHistory = ref([])
const dailyHistoryLoading = ref(false)
const filterFrom = ref('')
const filterTo = ref('')
function dailyBadgeClass(state){
  const s = String(state || 'SIN NOVEDAD').toUpperCase()
  if (s === 'SIN NOVEDAD') return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  if (s.includes('COMISIÓN')) return 'bg-sky-50 border-sky-200 text-sky-700'
  if (s.includes('SERVICIO')) return 'bg-amber-50 border-amber-200 text-amber-700'
  return 'bg-slate-50 border-slate-200 text-slate-700'
}
async function loadDailyHistory(){
  dailyHistoryLoading.value = true
  try {
    // Ajusta al endpoint real de historial
    const { data } = await http.get('/dailyreport/me/history', { params: { limit: 50 } })
    dailyHistory.value = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
  } finally { dailyHistoryLoading.value = false }
}
const filteredDailyHistory = computed(() => {
  if (!filterFrom.value && !filterTo.value) return dailyHistory.value
  const from = filterFrom.value ? new Date(filterFrom.value) : null
  const to = filterTo.value ? new Date(filterTo.value + 'T23:59:59') : null
  return dailyHistory.value.filter(h => {
    const d = new Date(h.created_at)
    return (!from || d >= from) && (!to || d <= to)
  })
})
function applyHistoryFilter(){ /* computado ya aplica; dejamos por semántica */ }

/* ===== Vehículos (tu lógica tal cual) ===== */
const vehicleQuery = ref('')
const vehicleResults = ref([])
const vehicleResultsVisible = ref(false)
const selectedVehicle = ref(null)
const myOpenUses = ref([])           
const loadingOpenUses = ref(false)

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

function hideDropdownSoon(){ setTimeout(()=>vehicleResultsVisible.value=false,150) }
function onPhoto(e){ newNovedad.value.file = e.target.files?.[0] || null }

async function addNovedad(){
  if (!selectedVehicle.value || !newNovedad.value.description) return
  const fd = new FormData()
  fd.append('description', newNovedad.value.description)
  if (newNovedad.value.file) fd.append('photo', newNovedad.value.file)
  await http.post(`/vehicles/vehicle/${selectedVehicle.value.id}/novelties`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  newNovedad.value = { description: '', file: null }
  await loadStagingNovedades()
}

async function deleteNovedad(id){ await http.delete(`/vehicles/novelties/${id}`); await loadStagingNovedades() }

async function loadStagingNovedades(){
  novedadesStaging.value = []
  if (!selectedVehicle.value) return
  loadingNovedades.value = true
  try {
    const { data } = await http.get(`/vehicles/${selectedVehicle.value.id}/novelties/recent`)
    novedadesStaging.value = data.items || []
  } finally { loadingNovedades.value = false }
}

async function loadOpenUseNovedades(){
  openUseNovedades.value = []
  if (!openUseInfo.value) return
  const { data } = await http.get(`/vehicles/uses/${openUseInfo.value.id}/novelties`)
  openUseNovedades.value = data.items || []
}

async function loadMyActiveAssignments() {
  loadingAssignments.value = true
  try {
    // Asegura que /me esté cargado para obtener el id del agente
    if (!(me.value?.agentId ?? me.value?.agent_id)) {
      await loadMe()
    }
    const agentIdVal = me.value?.agentId ?? me.value?.agent_id
    if (!agentIdVal) {
      myAssignments.value = []
      return
    }

    // --- (Opcional) Si tienes endpoint directo por agente, descomenta y listo ---
    /*
    const { data } = await http.get(`/agents/${agentIdVal}/assignments`, { params: { active: 1, pageSize: 500 } })
    const items = data?.items ?? data ?? []
    myAssignments.value = items.map(a => ({
      ...a,
      start_date: a.start_date ?? a.startDate ?? a.started_at ?? a.startedAt ?? a.start ?? '',
      odometer_start: a.odometer_start ?? a.odometerStart ?? a.km_inicio ?? a.kmStart ?? null,
      notes: a.notes ?? a.note ?? a.observation ?? '',
      vehicle: a.vehicle || { id: a.vehicle_id, code: a.vehicle_code, sigla: a.sigla ?? a.vehicle_sigla }
    })).sort((a,b) => (b.start_date || '').localeCompare(a.start_date || ''))
    return
    */

    // --- Fallback: recorrer vehículos como antes, con comparaciones tolerantes ---
    const { data: vehs } = await http.get('/vehicles', { params: { pageSize: 500 } })
    const vehicles = vehs?.items ?? []
    const out = []

    await Promise.all(vehicles.map(async v => {
      try {
        const { data: asg } = await http.get(`/vehicles/${v.id}/assignments`, { params: { pageSize: 500 } })
        const list = asg?.items ?? asg ?? []
        list.forEach(a => {
          const aAgent = a.agentId ?? a.agent_id ?? a.agent?.id
          const endRaw = a.end_date ?? a.endDate ?? a.ended_at ?? a.endedAt ?? a.end

          // isOpen compatible con múltiples “falsy” que tu backend puede usar
          const isOpen =
            endRaw === null ||
            endRaw === undefined ||
            endRaw === '' ||
            endRaw === false ||
            endRaw === 0 ||
            (typeof endRaw === 'string' && endRaw.trim() === '') ||
            (typeof endRaw === 'string' && endRaw.startsWith('0000-00-00'))

          // Comparación tolerante (== a propósito para string/number)
          if ((aAgent ?? '') == (agentIdVal ?? '')) {
            if (isOpen) {
              out.push({
                ...a,
                start_date: a.start_date ?? a.startDate ?? a.started_at ?? a.startedAt ?? a.start ?? '',
                odometer_start: a.odometer_start ?? a.odometerStart ?? a.km_inicio ?? a.kmStart ?? null,
                notes: a.notes ?? a.note ?? a.observation ?? '',
                vehicle: {
                  id: v.id,
                  code: v.code ?? v.vehicle_code ?? '',
                  sigla: v.sigla ?? v.short ?? v.alias ?? v.vehicle_sigla ?? ''
                }
              })
            }
          }
        })
      } catch {}
    }))

    out.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
    myAssignments.value = out
  } finally {
    loadingAssignments.value = false
  }
}

async function loadMyOpenUses() {
  loadingOpenUses.value = true
  try {
    // Asegurar que /me esté cargado
    if (!(me.value?.agentId ?? me.value?.agent_id)) await loadMe()
    const agentIdVal = me.value?.agentId ?? me.value?.agent_id
    if (!agentIdVal) { myOpenUses.value = []; return }

    // === Opción A (rápida): endpoint directo de usos abiertos por agente ===
    try {
      const { data } = await http.get('/vehicles/uses', {
        params: { agent_id: agentIdVal, open: 1, pageSize: 500 }
      })
      const items = data?.items ?? data ?? []
      if (Array.isArray(items)) {
        myOpenUses.value = items.map(mapUseRow)
        return
      }
    } catch { /* sigue al fallback */ }

    // === Fallback: recorrer vehículos y filtrar "open" por agente ===
    const { data: vehs } = await http.get('/vehicles', { params: { pageSize: 500 } })
    const vehicles = vehs?.items ?? []
    const out = []

    await Promise.all(vehicles.map(async v => {
      try {
        // si tu API soporta "open" como query, úsalo; si no, trae todos y filtra
        const { data: usesRes } = await http.get('/vehicles/uses', {
          params: { vehicle_id: v.id, agent_id: agentIdVal, open: 1, pageSize: 200 }
        })
        const list = usesRes?.items ?? usesRes ?? []
        list.forEach(u => {
          // normaliza y empuja
          out.push(mapUseRow(u, v))
        })
      } catch { /* ignorar vehículo con error */ }
    }))

    myOpenUses.value = out
  } finally {
    loadingOpenUses.value = false
  }
}

// Normaliza un registro de uso a las columnas que mostramos
function mapUseRow(u, vehOpt) {
  const started = u.started_at ?? u.startedAt ?? u.start_date ?? u.startDate ?? u.start ?? ''
  const odoStart = u.odometer_start ?? u.odometerStart ?? u.km_salida ?? u.kmStart ?? null
  const notes = u.notes ?? u.note ?? u.observation ?? ''
  const v = u.vehicle || vehOpt || {}
  const vCode = v.code ?? u.vehicle_code ?? ''
  const vSigla = v.sigla ?? v.short ?? v.alias ?? u.vehicle_sigla ?? ''
  const vId = v.id ?? u.vehicle_id
  return {
    id: u.id,
    started_at: started,
    odometer_start: odoStart,
    notes,
    vehicle: { id: vId, code: vCode, sigla: vSigla }
  }
}

let searchTimer = null
function searchVehicles(){
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    const q = vehicleQuery.value.trim()
    if (!q){ vehicleResults.value = []; vehicleResultsVisible.value = false; return }
    const { data } = await http.get('/vehicles', { params: { query: q, pageSize: 20 } })
    vehicleResults.value = data.items || []
    vehicleResultsVisible.value = true
  }, 220)
}

async function pickVehicle(v){
  selectedVehicle.value = v
  vehicleQuery.value = `${v.code} — ${v.sigla}`
  vehicleResultsVisible.value = false
  await afterSelectVehicle()
}

async function afterSelectVehicle(){
  await Promise.all([
    loadLastAssignOdometer(),
    checkOpenUse(),
    loadUsesForSelected(),
    loadStagingNovedades(),
    loadOpenUseNovedades()
  ])
}

async function loadLastAssignOdometer(){
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

async function checkOpenUse(){
  openUseId.value = null
  openUseInfo.value = null
  if (!selectedVehicle.value || !me.value?.agentId) return
  const { data } = await http.get('/vehicles/uses', {
    params: { vehicle_id: selectedVehicle.value.id, agent_id: me.value.agentId, open: 1 }
  })
  const list = data.items || []
  if (list.length){ openUseId.value = list[0].id; openUseInfo.value = list[0]; await loadOpenUseNovedades() }
  else { openUseNovedades.value = [] }
}

async function startUse(){
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
  } catch (e) { alert(e?.response?.data?.error || 'Error al iniciar uso') }
  finally { starting.value = false }
}

async function endUse(){
  if (!openUseId.value) return
  const od = prompt('Odómetro final (opcional, deja vacío si no aplica):', '')
  let odNum = null
  if (od!=null && od!==''){ const n = Number(od); if(!Number.isFinite(n) || n<0) return alert('Odómetro inválido'); odNum=n }
  ending.value = true
  try {
    await http.patch(`/vehicles/uses/${openUseId.value}/end`, { odometer_end: odNum })
    await Promise.all([checkOpenUse(), loadUsesForSelected(), loadStagingNovedades()])
    alert('Uso cerrado correctamente.')
  } catch (e) { alert(e?.response?.data?.error || 'Error al cerrar uso') }
  finally { ending.value = false }
}

async function loadUsesForSelected(){
  loadingUses.value = true
  uses.value = []
  try {
    if (!selectedVehicle.value || !me.value?.agentId) return
    const { data } = await http.get('/vehicles/uses', { params: { vehicle_id: selectedVehicle.value.id, agent_id: me.value.agentId } })
    uses.value = data.items || []
  } finally { loadingUses.value = false }
}

/* ===== Init ===== */
onMounted(async () => {
  await loadMe()
  await nextTick()   
  await loadDailyHistory()
  await loadMyActiveAssignments()
  await loadMyOpenUses()
})

watch(() => (me.value?.agentId ?? me.value?.agent_id), (id) => {
  if (id) {
    if (!myOpenUses.value.length && !loadingOpenUses.value) loadMyOpenUses()
    if (!myAssignments.value.length && !loadingAssignments.value) loadMyActiveAssignments()
  }
})

watch(section, (s) => {
  if (s === 'vehiculos') {
    if (!myOpenUses.value.length && !loadingOpenUses.value) loadMyOpenUses()
    if (!myAssignments.value.length && !loadingAssignments.value) loadMyActiveAssignments()
  }
})

</script>
