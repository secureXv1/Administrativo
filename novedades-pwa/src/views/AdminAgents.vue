<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <!-- Encabezado -->
    <div class="card-body flex items-center justify-between">
        <h1 class="font-semibold text-slate-800">Listado de agentes</h1>
        <div class="flex items-center gap-3">
          <span v-if="msg" :class="msgClass" class="text-sm">{{ msg }}</span>
          <button v-if="isSuperadmin" class="btn-primary" @click="openCreate">Nuevo agente</button>
        </div>
      </div>


    <!-- Filtros -->
    <div class="card">
      <div class="card-body">
        <div class="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:items-end">
          <div class="sm:col-span-2">
            <label class="label">Buscar</label>
            <input class="input" v-model="filters.q"
                   placeholder="Código, categoría (OF/ME/PT), grupo, unidad..." />
          </div>

          <div>
            <label class="label">Categoría</label>
            <select class="input" v-model="filters.cat">
              <option value="ALL">Todas</option>
              <option value="OF">OF</option>
              <option value="ME">ME</option>
              <option value="PT">PT</option>
            </select>
          </div>

          <div v-if="isAdminLike">
            <label class="label">Grupo</label>
            <select class="input" v-model="filters.groupId">
              <option value="ALL">Todos</option>
              <option v-for="g in groups" :key="g.id" :value="String(g.id)">
                {{ g.code }}
              </option>
            </select>
          </div>

          <div>
            <label class="label">Fecha (para novedad)</label>
            <input type="date" class="input" v-model="today" />
          </div>
        </div>

        <!-- Tabla -->
        <div class="mt-4 overflow-x-auto">
          <table class="table min-w-[860px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Agente</th>
                <th>Cat.</th>
                <th>Grupo</th>
                <th>Unidad</th>
                <th>Días Lab</th>
                <th style="text-align: center">Historial Nov</th>
                <th v-if="isEditableRole" style="text-align: center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(a, idx) in itemsPagina" :key="a.id">
                <td :title="'ID: ' + a.id">{{ rowNumber(idx) }}</td>
                <td>{{ a.code }}</td>
                <td>{{ a.nickname || '—' }}</td> <!-- Apodo aquí -->
                <td>{{ catLabel(a.category) }}</td>
                <td>{{ a.groupCode || groupCode(a.groupId) || '—' }}</td>
                <td>{{ a.unitName || unitName(a.unitId) || '—' }}</td>
                <td>
                  <span
                    :class="[
                      'inline-block min-w-[2.5em] text-center rounded px-1',
                      a.current_streak >= 45
                        ? 'bg-red-100 text-red-600 font-bold border border-red-200'
                        : a.current_streak >= 30
                          ? 'bg-orange-100 text-orange-700 font-semibold border border-orange-200'
                          : a.current_streak > 0
                            ? 'bg-green-50 text-green-700 font-semibold border border-green-200'
                            : 'text-slate-400'
                    ]"
                    :title="a.current_streak >= 45
                      ? '¡Alerta! Racha extremadamente prolongada'
                      : a.current_streak >= 30
                        ? 'Racha prolongada: recomienda revisión'
                        : 'Días consecutivos en servicio o sin novedad'"
                  >
                    {{ a.current_streak ?? 0 }}
                  </span>
                </td>
                <td class="text-center">
                  <button class="btn-ghost p-1" title="Historial" @click="openHistory(a)">
                    <!-- icono reloj -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"></circle>
                    </svg>
                  </button>
                </td>
                <td class="text-center">
                  <button v-if="isEditableRole" class="btn-ghost p-1" title="Editar" @click="openEdit(a)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 2a2.828 2.828 0 0 1 4 4L7 21l-4 1 1-4Z"></path><path d="m16 5 3 3"></path>
                    </svg>
                  </button>
                  <button v-if="isSuperadmin" class="btn-ghost p-1" title="Eliminar" @click="requestDelete(a)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/>
                      <path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/>
                      <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                    </svg>
                  </button>
                </td>
              </tr>
              <tr v-if="itemsPagina.length === 0">
                <td colspan="9" class="text-center text-slate-500 py-6">Sin agentes</td>
              </tr>
            </tbody>
          </table>

                          <!-- Paginación (solo admin/supervisión) -->
                <div v-if="total > 0" class="mt-3 flex items-center gap-3 justify-between">
                  <div class="text-sm text-slate-600">
                    Mostrando
                    <b>{{ Math.min(((page-1)*pageSize)+1, total) }}</b>–
                    <b>{{ Math.min(page*pageSize, total) }}</b>
                    de <b>{{ total }}</b>
                  </div>

                  <div class="flex items-center gap-2">
                    <button class="btn-ghost" :disabled="page<=1" @click="gotoPage(1)">« Primero</button>
                    <button class="btn-ghost" :disabled="page<=1" @click="gotoPage(page-1)">‹ Anterior</button>
                    <span class="text-sm text-slate-700">Página {{ page }} / {{ totalPages }}</span>
                    <button class="btn-ghost" :disabled="page>=totalPages" @click="gotoPage(page+1)">Siguiente ›</button>
                    <button class="btn-ghost" :disabled="page>=totalPages" @click="gotoPage(totalPages)">Último »</button>

                    <select class="input !w-28" v-model.number="pageSize" @change="() => { page=1; loadAgents() }">
                      <option :value="50">50</option>
                      <option :value="100">100</option>
                      <option :value="200">200</option>
                      <option :value="500">500</option>
                      <option :value="1000">1000</option>
                    </select>
                  </div>
                </div>

        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="editing" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" @click="closeEdit"></div>

      <!-- Card -->
      <form
        class="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[90vh]"
        @submit.prevent="saveEdit"
      >
        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800">
            {{ isCreating ? 'Crear agente' : 'Editar agente' }}
          </h3>
          <button type="button" class="btn-ghost" @click="closeEdit">✕</button>
        </div>

        <!-- Body -->
        <div class="p-5 overflow-auto">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="label">Código</label>
              <input class="input" v-model="form.code" :disabled="!isSuperadmin && isCreating" placeholder="EJ: A123" />
              <p class="text-[11px] text-slate-500 mt-1">Formato: LETRA + números</p>
            </div>

            <div>
              <label class="label">Nickname</label>
              <input class="input" v-model="form.nickname" maxlength="120" placeholder="Apodo del agente" />
            </div>

            <div>
              <label class="label">Categoría</label>
              <select class="input" v-model="form.categoryUi" :disabled="!isSuperadmin">
                <option value="OF">OF</option>
                <option value="ME">ME</option>
                <option value="PT">PT</option>
              </select>
            </div>

            <div>
              <label class="label">Grupo</label>
              <select class="input" v-model="form.groupId">
                <option :value="null">Sin grupo</option>
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.code }}</option>
              </select>
            </div>

            <div>
              <label class="label">Unidad</label>
              <select class="input" v-model="form.unitId">
                <option :value="null">Sin unidad</option>
                <option v-for="u in unitsForSelect" :key="u.id" :value="u.id">{{ u.name }}</option>
              </select>
            </div>
          </div>
        </div>
        <!-- MT -->
        <div>
          <label class="label">M.T</label>
          <input
            class="input"
            v-model="form.mt"
            maxlength="80"
            placeholder="Ej: RECIBE AREA, ARMERA, etc."
          />
          <p class="text-[11px] text-slate-500 mt-1">Deja vacío si no aplica.</p>
        </div>

        <!-- Fecha de nacimiento -->
        <div>
          <label class="label">Fecha de nacimiento</label>
          <input
            type="date"
            class="input"
            v-model="form.birthday"
            :max="maxBirthday"
          />
          <p class="text-[11px] text-slate-500 mt-1">Formato: AAAA-MM-DD</p>
        </div>
        <!-- Footer -->
        <div class="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button type="button" class="btn-ghost" @click="closeEdit">Cancelar</button>

          <!-- Guardar SIEMPRE visible cuando tienes permiso para la acción -->
          <button
            v-if="canShowSave"
            type="submit"
            class="btn-primary"
            :disabled="!canSubmit"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  </div>
  <!-- Toasts -->
  <div class="fixed inset-x-0 top-3 z-[9999] flex justify-center pointer-events-none">
    <div class="w-full max-w-md space-y-2 px-3">
      <div v-for="t in toasts" :key="t.id"
          class="pointer-events-auto rounded-xl border p-3 shadow-lg
                  bg-white"
          :class="{
            'border-emerald-300': t.type==='success',
            'border-red-300'   : t.type==='error',
            'border-slate-200' : t.type==='info'
          }">
        <div class="flex items-start gap-2">
          <div class="text-lg leading-none">
            <span v-if="t.type==='success'">✅</span>
            <span v-else-if="t.type==='error'">⚠️</span>
            <span v-else>ℹ️</span>
          </div>
          <div class="flex-1">
            <div class="font-medium text-slate-800">{{ t.title }}</div>
            <div v-if="t.desc" class="text-sm text-slate-600 mt-0.5">{{ t.desc }}</div>
          </div>
          <button class="text-slate-500 hover:text-slate-800" @click="closeToast(t.id)">✕</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal Confirmar Eliminación -->
  <div
    v-if="pendingDelete"
    class="fixed inset-0 z-[9998] flex items-center justify-center"
    @keydown.esc="cancelDelete"
  >
    <div class="absolute inset-0 bg-black/40" @click="cancelDelete"></div>

    <div class="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-5">
      <h3 class="font-semibold text-slate-800 text-lg">Eliminar agente</h3>
      <p class="text-slate-600 mt-2">
        ¿Seguro que deseas eliminar al agente <b>{{ pendingDelete.code }}</b>?
        Esta acción no se puede deshacer.
      </p>

      <div class="mt-4 flex justify-end gap-2">
        <button class="btn-ghost" @click="cancelDelete" :disabled="deleting">Cancelar</button>
        <button
          class="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          @click="confirmDelete"
          :disabled="deleting"
        >
          <span v-if="!deleting">Sí, eliminar</span>
          <span v-else>Eliminando…</span>
        </button>
      </div>
    </div>
  </div>
  <!-- Modal Historial (versión utilidades Tailwind) -->
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
                ]"
                >
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
import axios from 'axios'

// Confirmación borrar
const pendingDelete = ref(null)
const deleting = ref(false)

function requestDelete(a) {
  pendingDelete.value = { id: a.id, code: a.code }
}

function authHeader() {
  return {
    headers: {
      Authorization: 'Bearer ' + localStorage.getItem('token')
    }
  }
}

function cancelDelete() {
  if (deleting.value) return
  pendingDelete.value = null
}

async function confirmDelete() {
  if (!pendingDelete.value || deleting.value) return
  deleting.value = true
  try {
    const id = pendingDelete.value.id
    await axios.delete(`/admin/agents/${id}`, authHeader())
    toast?.({ type:'success', title:'Agente eliminado', desc: pendingDelete.value.code })
    await loadAgents()
  } catch (e) {
    const detail = e?.response?.data?.detail || e?.response?.data?.error || e?.message || 'Error al eliminar'
    toast?.({ type:'error', title:'No se pudo eliminar', desc: detail })
  } finally {
    deleting.value = false
    pendingDelete.value = null
  }
}


/* ===== Helpers UI ===== */
const catLabel = (c) => (String(c).toUpperCase()==='SO' ? 'ME' : c)
const uiToApiCategory = (ui) => (ui==='ME' ? 'SO' : ui)

// ===== Paginación común (admin/supervisión: server-side | líder grupo: client-side) =====
const page = ref(1)
const pageSize = ref(200)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil((total.value || 0) / (pageSize.value || 1))))

function gotoPage(n){
  const t = totalPages.value
  const p = Math.min(Math.max(1, Number(n) || 1), t)
  if (p !== page.value) {
    page.value = p
    if (isAdminLike.value) loadAgents()     // 👈 recarga server-side
  }
}

function onChangePageSize(){
  page.value = 1 // client-side: el computed se recalcula solo
}

function rowNumber(idx){
  // Admin/Supervisión (server-side): numeración absoluta con offset del backend
  if (isAdminLike.value) {
    return (page.value - 1) * pageSize.value + idx + 1
  }
  // Líder de grupo (client-side): numeración por página tras filtrar & paginar en cliente
  return (page.value - 1) * pageSize.value + idx + 1
}

function badgeClass(state){
  const s = String(state || '').toUpperCase()
  if (s === 'SIN NOVEDAD') return 'bg-green-50 text-green-700 border-green-200'
  if (s === 'SERVICIO' || s === 'COMISIÓN DEL SERVICIO') return 'bg-sky-50 text-sky-700 border-sky-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

/* ===== Auth / Rol ===== */
const me = ref(null)
async function loadMe(){
  try{
    const { data } = await axios.get('/me', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    me.value = data
  } catch { me.value = null }
}
const role = computed(() => String(me.value?.role || '').toLowerCase())
const isLeaderGroup = computed(() => role.value === 'leader_group')
const isAdminLike   = computed(() => ['superadmin','supervision'].includes(role.value))
const isSuperadmin  = computed(() => role.value === 'superadmin')

/* ===== Data ===== */
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

const itemsBase = ref([])
const items = ref([])
const groups = ref([])         // grupos (admin)
const units = ref([])          // todas las unidades (admin)
const myUnits = ref([])        // unidades de mi grupo (líder grupo)
const municipalities = ref([]) // catálogo
/* ===== Fecha por defecto (mañana) ===== */
function formatDateISO(d) {
  return d.toISOString().slice(0,10)
}
const today = ref(formatDateISO(new Date))

/* ===== Filtros ===== */
const filters = ref({ q:'', cat:'ALL', groupId:'ALL' })
watch(filters, () => { page.value = 1; reloadAdminDebounced() }, { deep: true })


/* ===== Estados ===== */
 const estadosValidos = [
  'SIN NOVEDAD','SERVICIO','COMISIÓN DEL SERVICIO','FRANCO FRANCO',
  'VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO',
  'LICENCIA REMUNERADA','LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO',
  'LICENCIA PATERNIDAD','PERMISO','PERMISO ACTIVIDAD PERSONAL','COMISIÓN EN EL EXTERIOR', 'COMISIÓN DE ESTUDIO', 'SUSPENDIDO','HOSPITALIZADO'
 ]
 const otrosRequierenFechas = [
  'VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO',
  'LICENCIA REMUNERADA','LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO',
  'LICENCIA PATERNIDAD','PERMISO','PERMISO ACTIVIDAD PERSONAL','COMISIÓN EN EL EXTERIOR', 'COMISIÓN DE ESTUDIO', 'SUSPENDIDO'
 ]

/* ===== Cargas ===== */
async function loadGroups(){
  if (!isAdminLike.value) return
  const { data } = await axios.get('/admin/groups', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  groups.value = data || []
}
async function loadUnits(){
  if (isAdminLike.value) {
    const { data } = await axios.get('/admin/units', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    units.value = data || []
  } else if (isLeaderGroup.value) {
    const { data } = await axios.get('/my/units', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    myUnits.value = data || []
  }
}


async function loadAgentNovelty(agentId){
  const { data } = await axios.get(`/admin/agents/${agentId}/novelty`, {
    params: { date: today.value },   // usa la fecha seleccionada en el filtro
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  return data || null
}



async function loadMunicipalities(q=''){
  const params = q && q.length>=2 ? { q, limit: 50 } : { limit: 50 }
  const { data } = await axios.get('/catalogs/municipalities', {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  municipalities.value = data || []
}

async function loadAgents() {
  msg.value = ''
  try {
    if (isAdminLike.value || isLeaderGroup.value) {
      // Siempre usa server-side para ambos roles
      const params = {
        page: page.value,
        pageSize: pageSize.value
      }
      // Solo admins pueden filtrar por grupo (líder ve solo su grupo, el backend lo filtra)
      if (isAdminLike.value && filters.value.groupId !== 'ALL')
        params.groupId = Number(filters.value.groupId)
      if (filters.value.q && filters.value.q.trim())
        params.q = String(filters.value.q).trim()
      if (filters.value.cat !== 'ALL')
        params.category = filters.value.cat === 'ME' ? 'SO' : filters.value.cat

      const { data } = await axios.get('/admin/agents-streaks', {
        params: {
          ...params,
          date: today.value // <-- Agrega la fecha seleccionada
        },
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })


      items.value = normalizeAgents(data?.items || [])
      total.value = Number(data?.total || 0)

    } else {
      // Otros roles (si aplican, aquí vacía)
      items.value = []
      itemsBase.value = []
      total.value = 0
      msg.value = 'No tiene permisos suficientes.'
    }
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al cargar'
  }
}

function normalizeAgents(list){
  return list.map(a => ({
    ...a,
    id: a.id ?? a.agentId,        // Usa id si existe, si no agentId
    groupCode: a.groupCode || null,
    unitName: a.unitName || null,
    municipalityName: a.municipalityName || (a.municipalityId ? '' : ''),
    nickname: a.nickname || null
  }))
}

// ===== Recarga con debounce (evita bombardear la API al escribir) =====
const reloadAdminDebounced = (() => {
  let t = null
  return () => {
    clearTimeout(t)
    t = setTimeout(() => {
      loadAgents()
    }, 300)
  }
})()

// Filtrado + orden (solo para líder de grupo; admin/supervisión ya filtran en backend)
const itemsFiltradosOrdenados = computed(() => {
  // Todos los roles: confiar en backend (ya viene filtrado/paginado); solo ordenamos por estética si quieres
  const arr = items.value.slice()
  const order = { 'OF':1, 'SO':2, 'PT':3 }
  arr.sort((a,b) => {
    const ca = order[String(a.category).toUpperCase()] || 9
    const cb = order[String(b.category).toUpperCase()] || 9
    if (ca !== cb) return ca - cb
    return String(a.code).localeCompare(String(b.code))
  })
  return arr
})

const itemsPagina = computed(() => {
  // Ya está paginado por backend, simplemente retorna los items
  return itemsFiltradosOrdenados.value
})



/* ===== Catálogos helpers ===== */
function groupCode(id){
  const g = groups.value.find(x => x.id == id)
  return g ? g.code : null
}
function unitName(id){
  if (isAdminLike.value){
    const u = units.value.find(x => x.id == id)
    return u ? u.name : null
  } else {
    const u = myUnits.value.find(x => x.id == id)
    return u ? u.name : null
  }
}
const unitsForSelect = computed(() => {
  if (isLeaderGroup.value) return myUnits.value
  if (isAdminLike.value && form.value.groupId){
    return units.value.filter(u => String(u.groupId) === String(form.value.groupId))
  }
  return isAdminLike.value ? units.value : []
})

/* ===== Modal edición (solo tabla agent) ===== */
const isEditableRole = computed(() => !!(isSuperadmin.value || isAdminLike.value)) // excluye leader_group

const canShowSave = computed(() => {
  // Crear: solo Superadmin
  if (isCreating.value) return !!isSuperadmin.value
  // Editar: Admin/Supervisión o Líder de grupo
  return !!(isAdminLike.value || isLeaderGroup.value)
})

// Validación mínima para habilitar "Guardar"
const canSubmit = computed(() => {
  const codeOk = /^[A-Z][0-9]+$/.test(String(form.value.code || '').trim())
  const catOk  = ['OF','ME','PT'].includes(String(form.value.categoryUi))
  // Crear requiere superadmin + code válido
  if (isCreating.value) return isSuperadmin.value && codeOk && catOk
  // Editar: con code válido (aunque no lo cambies) + categoría válida
  return codeOk && catOk
})

const maxBirthday = new Date().toISOString().slice(0,10)

const isCreating = ref(false)
const editing = ref(null) // fila original cargada del backend
const form = ref({
  id: null,
  code: '',
  categoryUi: 'OF',   // UI: OF/ME/PT
  groupId: null,
  unitId: null,
  nickname: '',
  mt: '',           
  birthday: ''
})

function openCreate () {
  isCreating.value = true
  editing.value = { id: null } // muestra el modal en modo crear
  form.value = {
    id: null,
    code: '',
    categoryUi: 'OF',
    groupId: null,
    unitId: null,
    nickname: '',
    mt: '',
    birthday: ''
  }
}

async function openEdit (a) {
  editing.value = null
  try {
    const { data } = await axios.get(`/admin/agents/${a.id}`, authHeader())

    form.value = {
      id: data.id,
      code: data.code,
      categoryUi: catLabel(data.category),     // OF/ME/PT
      groupId: data.groupId ?? null,
      unitId: data.unitId ?? null,
      nickname: data.nickname || '',
      mt: data.mt || '',                       // 👈 NUEVO
      birthday: data.birthday || ''            // 👈 NUEVO (backend debe dar YYYY-MM-DD)
    }

    editing.value = data
  } catch (e) {
    msg.value = e?.response?.data?.detail || e?.message || 'No se pudo cargar el agente'
  }
}

function closeEdit () {
  editing.value = null
  isCreating.value = false
}

async function saveEdit () {
  msg.value = ''
  const id = form.value.id

  // sanity date -> 'YYYY-MM-DD' o null
  const birthday = (form.value.birthday && /^\d{4}-\d{2}-\d{2}$/.test(form.value.birthday))
    ? form.value.birthday
    : null

  try {
    if (isCreating.value) {
      if (!isSuperadmin.value) { msg.value = 'No autorizado'; return }
      const code = String(form.value.code || '').toUpperCase().trim()
      if (!/^[A-Z][0-9]+$/.test(code)) {
        msg.value = 'Código inválido (LETRA+números)'
        return
      }
      await axios.post('/admin/agents', {
        code,
        category: uiToApiCategory(form.value.categoryUi),
        groupId : form.value.groupId || null,
        unitId  : form.value.unitId  || null,
        nickname: (form.value.nickname || '').trim() || null,
        mt      : (form.value.mt || '').trim() || null,   // 👈 NUEVO
        birthday                         // 👈 NUEVO
      }, authHeader())

      msg.value = 'Agente creado ✅'
      toast({ type:'success', title:'Agente creado', desc:`${form.value.code} guardado.` })
      closeEdit()
      await loadAgents()
      return
    }

    // EDITAR
    if (isLeaderGroup.value) {
      // líder: solo mover unidad si cambió
      if ((editing.value.unitId || null) !== (form.value.unitId || null)) {
        await axios.put(`/my/agents/${id}/unit`, { unitId: form.value.unitId || null }, authHeader())
      }
      // líder NO toca mt/birthday por política (si quieres permitirlo, muévelo al bloque admin de abajo)
    } else if (isAdminLike.value) {
      const payload = {
        // Solo superadmin puede cambiar code/category
        code    : isSuperadmin.value ? String(form.value.code || '').toUpperCase().trim() : undefined,
        category: isSuperadmin.value ? uiToApiCategory(form.value.categoryUi)            : undefined,
        groupId : form.value.groupId || null,
        unitId  : form.value.unitId  || null,
        nickname: (form.value.nickname ?? '').trim() || null,
        mt      : (form.value.mt || '').trim() || null,   // 👈 NUEVO
        birthday                                 // 👈 NUEVO
      }
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
      await axios.put(`/admin/agents/${id}`, payload, authHeader())
    }

    msg.value = 'Cambios guardados ✅'
    toast({ type:'success', title:'Agente actualizado', desc:`${form.value.code} actualizado.` })
    closeEdit()
    await loadAgents()
  } catch (e) {
    const detail = e?.response?.data?.detail || e?.response?.data?.error || e?.message || 'Error al guardar'
    msg.value = detail
    toast({ type:'error', title:'No se pudo guardar', desc: detail })
  }
}

async function deleteAgent(a){
  if (!confirm('¿Eliminar este agente?')) return
  try{
    await axios.delete(`/admin/agents/${a.id}`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    msg.value = 'Agente eliminado ✅'
    await loadAgents()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo eliminar'
  }
}
watch(today, () => {
  page.value = 1
  loadAgents()
})

// TOASTS
const toasts = ref([]) // {id, type: 'success'|'error'|'info', title, desc}
let toastSeq = 0

function toast({ type = 'info', title = '', desc = '', timeout = 4000 } = {}) {
  const id = ++toastSeq
  toasts.value.push({ id, type, title, desc })
  if (timeout) setTimeout(() => closeToast(id), timeout)
}
function closeToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

// ==== HISTORIAL: estado + utils de fecha (sin dependencias) ==================
const historyModal = ref({ open: false, agent: null })
const viewTab = ref('calendar')

const historyItems = ref([]) // [{date:'YYYY-MM-DD', state:'SERVICIO', ...}]
const monthCursor = ref(new Date()) // mes visible

function ymd(d){ return d.toISOString().slice(0,10) }
function startOfMonth(d){
  const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x
}
function endOfMonth(d){
  const x = new Date(d); x.setMonth(x.getMonth()+1,0); x.setHours(0,0,0,0); return x
}
function addMonths(d, n){
  const x = new Date(d); x.setMonth(x.getMonth()+n); return x
}
function monthNameES(d){
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(d)
}
function dowMonday0(d){ // lunes=0 ... domingo=6
  const i = d.getDay() // 0..6 (domingo..sábado)
  return (i + 6) % 7
}

// Mapeos icono / color
function iconFor(state){
  const s = String(state || '').toUpperCase()
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
  const s = String(state || '').toUpperCase()
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
function shortState(s){
  const t = String(s || '')
  if (t.length <= 16) return t
  return t.slice(0,16)+'…'
}

function startOfWeekMonday(d){
  const x = new Date(d); const off = (x.getDay()+6)%7;
  x.setDate(x.getDate()-off); x.setHours(0,0,0,0); return x
}
function endOfWeekSunday(d){
  const x = new Date(d); const off = (7-((x.getDay()+6)%7))-1;
  x.setDate(x.getDate()+off); x.setHours(0,0,0,0); return x
}

// Rango para pedir al backend: mes visible + 2 meses atrás, cubriendo semanas completas
const historyFrom = computed(() => ymd(startOfWeekMonday(startOfMonth(addMonths(monthCursor.value, -2)))))
const historyTo   = computed(() => ymd(endOfWeekSunday(endOfMonth(monthCursor.value))))

// Rango VISUAL (un mes con padding lunes→domingo)
const calendarStartDate = computed(() => startOfWeekMonday(startOfMonth(monthCursor.value)))
const calendarEndDate   = computed(() => endOfWeekSunday(endOfMonth(monthCursor.value)))

// Etiquetas mostradas en el modal
const monthFrom  = computed(() => ymd(calendarStartDate.value))
const monthTo    = computed(() => ymd(calendarEndDate.value))
const monthLabel = computed(() => monthNameES(monthCursor.value))

function prevMonth(){ monthCursor.value = addMonths(monthCursor.value, -1); loadHistory() }
function nextMonth(){ monthCursor.value = addMonths(monthCursor.value, +1); loadHistory() }
function todayMonth() {
  // usa la fecha del filtro "today" para abrir ese mes
  monthCursor.value = new Date(today.value + 'T00:00:00')
  loadHistory()
}

async function openHistory(agent){
  historyModal.value = { open:true, agent }
  monthCursor.value = new Date(today.value + 'T00:00:00') // arrancar en el mes de la fecha del filtro
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
    toast({ type:'error', title:'No se pudo cargar el historial', desc: e?.response?.data?.error || e.message })
    historyItems.value = []
  }
}

// Calendario: celdas del mes (con padding inicial para lunes=0)
const calendarCells = computed(() => {
  const start = calendarStartDate.value
  const end   = calendarEndDate.value
  const map   = new Map(historyItems.value.map(h => [String(h.date), h]))
  const cells = []
  const todayKey = ymd(new Date())

  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate()+1)) {
    const key   = ymd(dt)
    const rec   = map.get(key)
    const state = rec?.state || null
    const title = state ? `${key} — ${state}${rec?.municipalityName ? ' — '+rec.municipalityName : ''}` : key
    const isToday   = key === todayKey
    const isPadding = dt.getMonth() !== monthCursor.value.getMonth()

    cells.push({ key, day: dt.getDate(), state, title, isToday, isPadding })
  }
  return cells
})

// Timeline: agrupar días consecutivos por estado
// Timeline: agrupar días consecutivos por estado;
// si es COMISIÓN DEL SERVICIO, también agrupar por municipio
const segments = computed(() => {
  const days = [...historyItems.value]
    .sort((a,b)=> String(a.date).localeCompare(String(b.date)))

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
      out.push({
        key,
        state,
        municipalityName: muni, // null si no es comisión
        from: d.date,
        to: d.date,
        count: 1
      })
    }
  }
  return out
})

// Segmentos de COMISIÓN DEL SERVICIO agrupados por municipio
const commissionSegments = computed(() => {
  const days = [...historyItems.value]
    .filter(d => String(d.state).toUpperCase() === 'COMISIÓN DEL SERVICIO')
    .sort((a,b)=> String(a.date).localeCompare(String(b.date)))

  const out = []
  for (const d of days) {
    const muni = d.municipalityName || '—'
    const last = out[out.length-1]
    if (last && last.municipalityName === muni) {
      last.to = d.date
      last.count += 1
    } else {
      out.push({ municipalityName: muni, from: d.date, to: d.date, count: 1 })
    }
  }
  return out
})

function openCommission(agent){
  // Solo abre el mismo modal, en la vista timeline (sin filtrar por estado)
  historyModal.value = { open:true, agent }
  viewTab.value = 'timeline'
  monthCursor.value = new Date(today.value + 'T00:00:00')
  loadHistory()
}

const legendStates = [
  'SIN NOVEDAD','SERVICIO','COMISIÓN DEL SERVICIO','VACACIONES',
  'FRANCO FRANCO','SUSPENDIDO','HOSPITALIZADO'
]
// ==== FIN HISTORIAL ==========================================================

/* ===== Init ===== */
onMounted(async () => {
  await loadMe()
  await Promise.all([loadGroups(), loadUnits(), loadMunicipalities()])
  await loadAgents()
})

watch(() => form.value.groupId, (newG) => {
  if (!newG) { form.value.unitId = null; return }
  const pool = isLeaderGroup.value ? myUnits.value : units.value
  const ok = pool.some(u => String(u.id) === String(form.value.unitId) && String(u.groupId) === String(newG))
  if (!ok) form.value.unitId = null
})

</script>