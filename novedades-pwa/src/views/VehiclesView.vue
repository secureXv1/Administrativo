<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <div class="card-body flex items-center justify-between">
      <h2 class="font-semibold text-slate-800">Gestión de vehículos</h2>
      <div class="flex gap-2">
        <button class="btn-secondary" @click="activeTab='list'">Vehículos</button>
        <button class="btn-secondary" @click="activeTab='due'">Vencimientos</button>
        <button class="btn-primary" @click="showAddVehicle = true" >+ Agregar vehículo </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card" v-if="activeTab==='list'">
      <div class="card-body grid grid-cols-1 sm:grid-cols-6 gap-3 sm:items-end">
        <div class="sm:col-span-3">
          <label class="label">Buscar</label>
          <input v-model="filters.query" class="input" placeholder="Código o sigla…" @keyup.enter="loadVehicles" />
        </div>
        <div>
          <label class="label">Alertar ≤ días</label>
          <input
            type="number"
            v-model="filters.due_within"
            class="input"
            min="0"
            placeholder="Días alerta (opcional)"
          />
        </div>
      </div>
    </div>

    <!-- Tabla vehículos -->
    <div class="card" v-if="activeTab==='list'">
      <div class="card-body overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left text-slate-600">
              <th class="py-2 pr-3">Código</th>
              <th class="py-2 pr-3">Sigla</th>
              <th class="py-2 pr-3">SOAT</th>
              <th class="py-2 pr-3">Tecno</th>
              <th class="py-2 pr-3">Funcionario</th>
              <th class="py-2 pr-3">Grupo</th>
              <th class="py-2 pr-3">Unidad</th>
              <th class="py-2 pr-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in vehicles" :key="v.id" class="border-t">
              <td class="py-2 pr-3 font-medium">{{ v.code }}</td>
              <td class="py-2 pr-3">{{ v.sigla }}</td>
              <td class="py-2 pr-3">
                <BadgeDate :date="formatDate(v.soatDate)" />
              </td>
              <td class="py-2 pr-3">
                <BadgeDate :date="formatDate(v.tecnoDate)" />
              </td>
              <td class="py-2 pr-3">
                <span v-if="v.agentCode">
                  <span class="font-mono text-xs">{{ v.agentCode }}</span>
                  <span class="text-slate-500">({{ v.agentNickname }})</span>
                </span>
                <span v-else class="text-slate-400">Sin asignar</span>
              </td>
              <td class="py-2 pr-3">{{ v.groupName || '—' }}</td>
              <td class="py-2 pr-3">{{ v.unitName || '—' }}</td>
              <td class="py-2 pr-3">
              <div class="flex flex-wrap gap-2">
                <!-- Asignaciones -->
                <button class="icon-btn" title="Asignaciones" @click="openAssignments(v)">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </button>
                <!-- Usos abiertos -->
                <button class="icon-btn" title="Usos abiertos" @click="openUses(v)">
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    :class="v.hasOpenUse ? 'stroke-green-600' : 'stroke-slate-400'"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <rect x="3" y="11" width="18" height="6" rx="3" />
                    <circle cx="7.5" cy="16.5" r="2.5" />
                    <circle cx="16.5" cy="16.5" r="2.5" />
                    <path d="M3 11V7a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v4" />
                  </svg>
                </button>
                <!-- Editar -->
                <button class="icon-btn" title="Editar vehículo" @click="openEditVehicle(v)">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 1 1 2.828 2.828L11.828 15.828a4 4 0 0 1-1.414.94l-4.243 1.415 1.415-4.243a4 4 0 0 1 .94-1.414z"/>
                  </svg>
                </button>
                <!-- Eliminar -->
                <button class="icon-btn" title="Eliminar vehículo" @click="confirmDeleteVehicle(v)">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M3 6h18" />
                    <path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" />
                    <rect x="8" y="6" width="8" height="14" rx="2" />
                    <path d="M10 10v6" />
                    <path d="M14 10v6" />
                    <path d="M5 6l1-2h12l1 2" />
                  </svg>
                </button>
              </div>
            </td>
            </tr>
            <tr v-if="!loading && !vehicles.length">
              <td colspan="5" class="py-6 text-center text-slate-500">Sin resultados</td>
            </tr>
          </tbody>
        </table>
        <div v-if="loading" class="text-sm text-slate-500 mt-2">Cargando…</div>
      </div>
    </div>

    <!-- Vencimientos -->
    <div class="card" v-if="activeTab==='due'">
      <div class="card-body">
        <div class="flex items-center gap-3 mb-3">
          <label class="label">Alertar ≤ días</label>
          <input type="number" v-model.number="dueWithin" class="input w-32" min="0" />
          <button class="btn-primary" @click="loadDue">Actualizar</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="d in dueItems" :key="d.id" class="border rounded-xl p-4">
            <div class="font-semibold">{{ d.code }} <span class="text-slate-500">({{ d.sigla }})</span></div>
            <div class="mt-2 text-sm">
              <div>SOAT: <strong>{{ d.soatDate }}</strong> <small class="text-slate-500" v-if="d.soat_in_days!=null"> ({{ d.soat_in_days }} días)</small></div>
              <div>Tecno: <strong>{{ d.tecnoDate }}</strong> <small class="text-slate-500" v-if="d.tecno_in_days!=null"> ({{ d.tecno_in_days }} días)</small></div>
            </div>
          </div>
        </div>

        <div v-if="loadingDue" class="text-sm text-slate-500 mt-2">Cargando…</div>
      </div>
    </div>

    <!-- Modales -->
    <VehicleAssignmentsModal
      v-if="showAssign"
      :vehicle="currentVehicle"
      @close="showAssign=false"
    />

    <VehicleUsesModal
      v-if="showUses"
      :vehicle="currentVehicle"
      @close="showUses = false"
      @iniciar-uso="onIniciarUso"
      @end="cerrarUso"
    />

  </div>
  <!-- Modal Agregar vehículo -->
  <div
    v-if="showAddVehicle"
    class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
  >
    <div class="bg-white rounded-2xl shadow-xl p-8 w-[96vw] max-w-md relative">
      <button
        class="absolute top-2 right-2 text-xl text-slate-500 hover:text-slate-800"
        @click="showAddVehicle = false"
        aria-label="Cerrar"
      >&times;</button>
      <h3 class="font-semibold text-lg mb-4">Agregar vehículo</h3>
      <form @submit.prevent="submitAddVehicle" class="space-y-4">
        <div>
          <label class="label">Código</label>
          <input v-model="addVehicleForm.code" class="input w-full" maxlength="20" required />
        </div>
        <div>
          <label class="label">Sigla</label>
          <input v-model="addVehicleForm.sigla" class="input w-full" maxlength="20" required />
        </div>
        <div>
          <label class="label">SOAT (YYYY-MM-DD)</label>
          <input v-model="addVehicleForm.soatDate" type="date" class="input w-full" required />
        </div>
        <div>
          <label class="label">Tecno (YYYY-MM-DD)</label>
          <input v-model="addVehicleForm.tecnoDate" type="date" class="input w-full" required />
        </div>
         <!-- Categoría -->
        <div>
          <label class="label">Categoría</label>
          <select v-model="addVehicleForm.category" class="input" required>
            <option value="">— Selecciona —</option>
            <option value="VH">Vehículo</option>
            <option value="MT">Moto</option>
          </select>
        </div>

        <!-- Grupo -->
        <div>
          <label class="label">Grupo</label>
          <select v-model="addVehicleForm.groupId" @change="addVehicleForm.unitId=''" class="input" required>
            <option value="">— Selecciona —</option>
            <option v-for="g in grupos" :key="g.id" :value="String(g.id)">{{ g.code }}</option>
          </select>
        </div>

        <!-- Unidad (opcional: filtra por grupoId) -->
        <div>
          <label class="label">Unidad</label>
          <select v-model="addVehicleForm.unitId" class="input" required>
            <option value="">— Selecciona —</option>
            <option v-for="u in unidadesPorGrupoAdd" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
          </select>
        </div>

        <div v-if="addVehicleError" class="text-red-600 text-sm">{{ addVehicleError }}</div>
        <div class="flex gap-3">
          <button class="btn-secondary flex-1" type="button" @click="showAddVehicle = false">Cancelar</button>
          <button class="btn-primary flex-1" :disabled="addVehicleLoading">
            <span v-if="addVehicleLoading">Guardando…</span>
            <span v-else>Guardar</span>
          </button>
        </div>
      </form>
    </div>
  </div>
  <!-- Modal Editar vehículo -->
  <div
    v-if="showEditVehicle"
    class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
  >
    <div class="bg-white rounded-2xl shadow-xl p-8 w-[96vw] max-w-md relative">
      <button
        class="absolute top-2 right-2 text-xl text-slate-500 hover:text-slate-800"
        @click="showEditVehicle = false"
        aria-label="Cerrar"
      >&times;</button>
      <h3 class="font-semibold text-lg mb-4">Editar vehículo</h3>
      <form @submit.prevent="submitEditVehicle" class="space-y-4">
        <div>
          <label class="label">Código</label>
          <input v-model="editVehicleForm.code" class="input w-full" maxlength="20" required />
        </div>
        <div>
          <label class="label">Sigla</label>
          <input v-model="editVehicleForm.sigla" class="input w-full" maxlength="20" required />
        </div>
        <div>
          <label class="label">SOAT</label>
          <input v-model="editVehicleForm.soatDate" type="date" class="input w-full" required />
        </div>
        <div>
          <label class="label">Tecno</label>
          <input v-model="editVehicleForm.tecnoDate" type="date" class="input w-full" required />
        </div>
        <div>
          <label class="label">Categoría</label>
          <select v-model="editVehicleForm.category" class="input w-full" required>
            <option value="VH">Vehículo</option>
            <option value="MT">Moto</option>
          </select>
        </div>
        <div>
          <label class="label">Grupo</label>
          <select v-model="editVehicleForm.groupId" class="input w-full" required>
            <option v-for="g in grupos" :value="g.id">{{ g.code }}</option>
          </select>
        </div>
        <div>
          <label class="label">Unidad</label>
          <!-- UNIDAD (Editar) -->
          <select v-model="editVehicleForm.unitId" class="input w-full" required>
            <option v-for="u in unidadesPorGrupoEdit" :key="u.id" :value="String(u.id)">
              {{ u.name }}
            </option>
          </select>
        </div>
        <div class="flex gap-3">
          <button class="btn-secondary flex-1" type="button" @click="showEditVehicle = false">Cancelar</button>
          <button class="btn-primary flex-1">Guardar cambios</button>
        </div>
      </form>
    </div>
  </div>

</template>

<script setup>
import { ref, onMounted, computed, watch  } from 'vue'
import { http } from '@/lib/http'
import VehicleAssignmentsModal from '@/components/vehicles/VehicleAssignmentsModal.vue'
import VehicleUsesModal from '@/components/vehicles/VehicleUsesModal.vue'
import BadgeDate from '@/components/BadgeDate.vue'


const activeTab = ref('list')
const loading = ref(false)
const vehicles = ref([])
const filters = ref({ query: '', due_within: '' })

const showAssign = ref(false)
const showUses = ref(false)
const showControl = ref(false)
const currentVehicle = ref(null)

function resetFilters() {
  filters.value = { query: '', due_within: 30 }
  loadVehicles()
}

async function loadVehicles() {
  loading.value = true
  try {
    const params = {
      query: filters.value.query || undefined,
      page: 1,
      pageSize: 500
    }
    if (filters.value.due_within !== '' && filters.value.due_within != null) {
      params.due_within = filters.value.due_within
    }
    const { data } = await http.get('/vehicles', { params })
    vehicles.value = data.items || []

    vehicles.value = data.items || []
  } finally {
    loading.value = false
  }
}

function formatDate(val) {
  // Soporta '2025-10-24T05:00:00.000Z' o '2025-10-24'
  return val ? String(val).slice(0, 10) : ''
}

// Vencimientos
const dueWithin = ref(30)
const loadingDue = ref(false)
const dueItems = ref([])

async function loadDue() {
  loadingDue.value = true
  try {
    const { data } = await http.get('/vehicles/due', {
      params: { within: dueWithin.value }
    })
    dueItems.value = data.items || []
  } finally {
    loadingDue.value = false
  }
}

async function confirmDeleteVehicle(v) {
  if (confirm(`¿Eliminar vehículo ${v.code} (${v.sigla})? Esta acción no se puede deshacer.`)) {
    try {
      await http.delete(`/vehicles/${v.id}`)
      loadVehicles()
    } catch (e) {
      alert(e?.response?.data?.error || 'Error al eliminar vehículo')
    }
  }
}

const grupos = ref([])
const unidades = ref([])

const form = ref({
  code: '',
  sigla: '',
  soatDate: '',
  tecnoDate: '',
  category: '',
  groupId: '',
  unitId: ''
})

// Trae los catálogos al montar el modal/form
async function cargarCatalogos() {
  const [{ data: g }, { data: u }] = await Promise.all([
    http.get('/catalogs/groups'),
    http.get('/catalogs/units')
  ]);
  grupos.value = g.items || [];
  unidades.value = u.items || [];
  //console.log('Cargados:', grupos.value, unidades.value)
}

onMounted(async () => {
  await cargarCatalogos()
  //console.log('Grupos:', grupos.value)
  //console.log('Unidades:', unidades.value)
  await loadVehicles()
  await loadDue()
})

// Acciones
function openAssignments(v) {
  currentVehicle.value = v
  showAssign.value = true
}
function openUses(v) {
  currentVehicle.value = v
  showUses.value = true
}
function startUse(v) {
  currentVehicle.value = v
  showControl.value = true
}
function onControlDone() {
  showControl.value = false
  if (activeTab.value === 'due') loadDue()
  else loadVehicles()
}

function onIniciarUso(vehicle) {
  currentVehicle.value = vehicle
  showUses.value = false
  // espera un pequeño tiempo para evitar glitches visuales del modal
  setTimeout(() => {
    showControl.value = true
  }, 150)
}
async function cerrarUso(useId) {
  if (!useId) return
  try {
    // Puedes pedir confirmación si quieres:
    if (!confirm('¿Seguro que quieres cerrar este uso?')) return
    await http.patch(`/vehicles/uses/${useId}/end`, {
      // Puedes agregar odometer_end, fuel_end_pct, notes si tienes un formulario para ello.
      odometer_end: null,
      notes: null,
    })
    // Opcional: mostrar mensaje o feedback
    showUses.value = false
    loadVehicles() // Refresca la lista
  } catch (e) {
    alert(e?.response?.data?.error || 'Error al cerrar el uso')
  }
}

const showAddVehicle = ref(false)

// Solo superadmin/supervision pueden crear (ajusta según tu user info)

const addVehicleForm = ref({
  code: '',
  sigla: '',
  soatDate: '',
  tecnoDate: '',
  category: '',
  groupId: '',  
  unitId: ''
});

const showEditVehicle = ref(false)
const editVehicleForm = ref({
  id: null,
  code: '',
  sigla: '',
  soatDate: '',
  tecnoDate: '',
  category: '',
  groupId: null,
  unitId: null
})

const unidadesPorGrupoAdd = computed(() => {
  if (!addVehicleForm.value.groupId) return unidades.value;
  // 👇 Usa el campo correcto
  return unidades.value.filter(
    u => String(u.groupId) === String(addVehicleForm.value.groupId)
  );
});

const unidadesPorGrupoEdit = computed(() => {
  if (!editVehicleForm.value.groupId) return unidades.value;
  return unidades.value.filter(
    u => String(u.groupId) === String(editVehicleForm.value.groupId)
  );
});


function openEditVehicle(v) {
  editVehicleForm.value = {
    id: v.id,
    code: v.code,
    sigla: v.sigla,
    soatDate: v.soatDate ? String(v.soatDate).slice(0,10) : '',
    tecnoDate: v.tecnoDate ? String(v.tecnoDate).slice(0,10) : '',
    category: v.category || '',
    groupId: v.groupId ? String(v.groupId) : '',
    unitId: v.unitId ? String(v.unitId) : ''
  }
  showEditVehicle.value = true
}


async function submitEditVehicle() {
  try {
    await http.put(`/vehicles/${editVehicleForm.value.id}`, editVehicleForm.value)
    showEditVehicle.value = false
    loadVehicles()
  } catch (e) {
    alert(e?.response?.data?.error || 'Error al actualizar vehículo')
  }
}

const addVehicleLoading = ref(false)
const addVehicleError = ref('')

async function submitAddVehicle() {
  addVehicleLoading.value = true
  addVehicleError.value = ''
  try {
    // POST al endpoint
    await http.post('/vehicles', addVehicleForm.value)
    showAddVehicle.value = false
    addVehicleForm.value = {
      code: '',
      sigla: '',
      soatDate: '',
      tecnoDate: '',
      category: '',
      groupId: '',
      unitId: ''
    }
    loadVehicles()
  } catch (e) {
    addVehicleError.value = e?.response?.data?.error || 'Error al agregar vehículo'
  } finally {
    addVehicleLoading.value = false
  }
}

watch(() => filters.value.due_within, (val) => {
  // Solo recarga si hay número válido o vacío (para limpiar filtro)
  if (val === '' || val == null) return loadVehicles()
  loadVehicles()
})

</script>
