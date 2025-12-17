<template>
  <div class="max-w-9xl mx-auto space-y-6">
    <!-- HEADER -->
    <div class="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-slate-200">
      <div class="max-w-9xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 grid place-items-center text-white font-bold">G</div>
          <div>
            <h2 class="font-semibold text-slate-900">Gastos — Proyección de comisiones del servicio</h2>
            <p class="text-slate-500 text-xs">Selecciona una <strong>vigencia</strong>, consulta qué funcionarios
          tienen proyección de <strong>COMISIÓN DEL SERVICIO</strong> y valida las
          comisiones que se certificarán en gastos.</p>
          </div>
        </div>
      </div>
    </div>
    <!-- SECCIÓN 1: seleccionar vigencia + consultar -->
    <section class="bg-white rounded-2xl shadow border border-slate-200 p-4 space-y-4">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1.5fr),minmax(0,1fr)] items-end">
        <!-- Vigencia -->
        <div>
          <label class="text-xs font-medium text-slate-700 mb-1 block">
            Vigencia
          </label>
          <select
            v-model="currentVigenciaId"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">Selecciona una vigencia…</option>
            <option
              v-for="p in periods"
              :key="p.id"
              :value="p.id"
            >
              {{ p.name }} — {{ p.from }} → {{ p.to }}
            </option>
          </select>
          <p v-if="loadingPeriods" class="text-[11px] text-slate-400 mt-1">
            Cargando vigencias…
          </p>
        </div>

        <!-- Info y botón -->
        <div class="flex flex-col items-start md:items-end gap-2">
          <div class="text-[11px] text-slate-500 w-full md:text-right">
            <template v-if="currentPeriod">
              Vigencia seleccionada:
              <strong>{{ currentPeriod.name }}</strong>
              ({{ currentPeriod.from }} → {{ currentPeriod.to }})
            </template>
            <template v-else>
              Selecciona una vigencia para consultar la proyección.
            </template>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed"
              @click="loadExpenses"
              :disabled="loading || !currentVigenciaId"
            >
              {{ loading ? 'Consultando…' : 'Consultar proyección para gastos' }}
            </button>

            <p v-if="error" class="text-xs text-rose-700">
              {{ error }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- SECCIÓN 2: filtros locales + resultados -->
    <section class="bg-white rounded-2xl shadow border border-slate-200 p-4">
      <!-- Encabezado + filtros locales de grupo/unidad -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">
            Funcionarios con COMISIÓN DEL SERVICIO en la vigencia seleccionada
          </h2>
          <p class="text-xs text-slate-500">
            Los filtros de grupo y unidad se aplican sobre la proyección
            <strong>de destino</strong> (destino proyectado).
          </p>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <!-- Grupo (filtro local sobre grupo destino) -->
          <div>
            <label class="text-[11px] font-medium text-slate-700 mb-1 block">
              Grupo destino
            </label>
            <select
              v-model="filters.groupId"
              class="w-40 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
              :disabled="!rows.length"
            >
              <option :value="null">Todos</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">
                {{ g.code || g.name || ('Grupo ' + g.id) }}
              </option>
            </select>
          </div>

          <!-- Unidad (filtro local sobre unidad destino) -->
          <div>
            <label class="text-[11px] font-medium text-slate-700 mb-1 block">
              Unidad destino
            </label>
            <select
              v-model="filters.unitId"
              class="w-40 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
              :disabled="!rows.length"
            >
              <option :value="null">Todas</option>
              <option v-for="u in units" :key="u.id" :value="u.id">
                {{ u.short || u.name || ('Unidad ' + u.id) }}
              </option>
            </select>
          </div>

          <div class="text-[11px] text-slate-500">
            {{ filteredRows.length }} registro(s)
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-slate-500 py-8 text-center">
        Cargando…
      </div>

      <div v-else-if="!filteredRows.length" class="text-sm text-slate-500 py-8 text-center">
        No hay funcionarios con COMISIÓN DEL SERVICIO en la vigencia / filtros seleccionados.
      </div>

      <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-800 text-white">
            <tr>
              <th class="text-left py-2 px-3 font-semibold">Código</th>
              <th class="text-left py-2 px-3 font-semibold">Nickname</th>
              <th class="text-left py-2 px-3 font-semibold">Unidad destino</th>
              <th class="text-left py-2 px-3 font-semibold">Inicio vigencia</th>
              <th class="text-left py-2 px-3 font-semibold">Fin vigencia</th>
              <th class="text-left py-2 px-3 font-semibold">Días en vigencia</th>
              <th class="text-left py-2 px-3 font-semibold text-right">Acción</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr
              v-for="r in filteredRows"
              :key="r.agentId"
              class="border-t hover:bg-slate-50"
            >
              <td class="py-2 px-3 font-semibold text-slate-900">
                {{ r.code }}
              </td>
              <td class="py-2 px-3 text-slate-700">
                {{ r.nickname || '—' }}
              </td>
              <td class="py-2 px-3 text-slate-700">
                {{ r.displayUnit || r.destUnitName || r.unitName || '—' }}
              </td>
              <td class="py-2 px-3 text-slate-900">
                {{ r.start }}
              </td>
              <td class="py-2 px-3 text-slate-900">
                {{ r.end }}
              </td>
              <td class="py-2 px-3 text-slate-900">
                {{ r.days }}
              </td>
              <td class="py-2 px-3 text-right">
                <button
                  v-if="!r.validated"
                  type="button"
                  class="px-3 py-1 rounded-lg text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                  @click="validarComision(r)"
                >
                  Validar comisión
                </button>
                <span
                  v-else
                  class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  ✔ Validada
                </span>
                <button
                  v-if="r.validated && r.commissionId"
                  type="button"
                  class="ml-2 px-3 py-1 rounded-lg text-[11px] font-medium bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-300"
                  @click="undoValidacion(r)"
                >
                  Deshacer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-[11px] text-slate-500 mt-3">
        Ejemplo: si el agente S069 tiene proyección
        01–05 COMISIÓN DEL SERVICIO, 06–10 PERMISO, 11–27 COMISIÓN DEL SERVICIO
        y la vigencia va del 01/12/25 al 25/12/25, se mostrará:
        <strong>inicio 11/12/25, fin 25/12/25</strong>
        (se toma la comisión que cubre más días dentro del rango).
      </p>

      <p v-if="msg" class="mt-3 text-xs" :class="msgOk ? 'text-emerald-700' : 'text-rose-700'">
        {{ msg }}
      </p>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { http } from '@/lib/http'

const COMMISSION_STATE = 'COMISIÓN DEL SERVICIO'

// === Estado local ===
const filters = ref({
  groupId: null,   // filtro local sobre GRUPO DESTINO
  unitId: null     // filtro local sobre UNIDAD DESTINO
})

const groups = ref([])
const units = ref([])

const loading = ref(false)
const error = ref('')
const rows = ref([])

const msg = ref('')
const msgOk = ref(false)

// Vigencias (projection_periods)
const periods = ref([])              // { id, name, from, to, created_at }
const currentVigenciaId = ref('')
const loadingPeriods = ref(false)

// ==== Helpers de fecha ====
function toDate (s) {
  if (!s) return null
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function diffDaysInclusive (from, to) {
  const d1 = toDate(from)
  const d2 = toDate(to)
  if (!d1 || !d2) return 0
  const ms = d2.getTime() - d1.getTime()
  return Math.floor(ms / 86400000) + 1
}

const currentPeriod = computed(() =>
  periods.value.find(p => p.id === currentVigenciaId.value) || null
)

/**
 * Recorta un rango [segFrom, segTo] al periodo [periodFrom, periodTo].
 * Devuelve { from, to, days } o null si no se intersectan.
 */
function clipRange (segFrom, segTo, periodFrom, periodTo) {
  const s1 = toDate(segFrom)
  const e1 = toDate(segTo)
  const s2 = toDate(periodFrom)
  const e2 = toDate(periodTo)
  if (!s1 || !e1 || !s2 || !e2) return null

  const start = s1 > s2 ? s1 : s2
  const end = e1 < e2 ? e1 : e2
  if (end < start) return null

  const fromStr = start.toISOString().slice(0, 10)
  const toStr = end.toISOString().slice(0, 10)
  const days = diffDaysInclusive(fromStr, toStr)
  return { from: fromStr, to: toStr, days }
}

/* =======================
   VIGENCIAS (frontend)
   - fetchPeriods() carga /rest-planning/periods
========================== */

async function fetchPeriods () {
  loadingPeriods.value = true
  try {
    const { data } = await http.get('/rest-planning/periods')
    const items = Array.isArray(data?.items) ? data.items : []
    periods.value = items.map(p => ({
      id: p.id,
      name: p.name || `Vigencia #${p.id}`,
      from: String(p.from_date).slice(0, 10),
      to: String(p.to_date).slice(0, 10),
      created_at: p.created_at || null
    }))

    // Seleccionar la más reciente por defecto, si no hay seleccionada
    if (!currentVigenciaId.value && periods.value.length) {
      currentVigenciaId.value = periods.value[0].id
    }
  } catch (e) {
    console.error('Error cargando vigencias:', e)
    periods.value = []
  } finally {
    loadingPeriods.value = false
  }
}

/* =======================
   buildRows
   - items: segmentos de /rest-planning
   - periodFrom / periodTo: rango de la vigencia
   - commissions: comisiones reales /service-commissions (para marcar validated)
========================== */

function buildRows (items, periodFrom, periodTo, commissions = []) {
  // 1) Comisiones reales por rest_plan_id
  // const commByPlanId = new Set() // <-- CÓDIGO ANTERIOR
  const commByPlanId = new Map() // Map<restPlanId, serviceCommissionId> // <-- CAMBIO
  for (const c of commissions) {
    const planId = c.restPlanId || c.rest_plan_id
    if (planId) {
      // commByPlanId.add(Number(planId)) // <-- CÓDIGO ANTERIOR
      commByPlanId.set(Number(planId), c.id) // <-- CAMBIO: Almacena el ID de la comisión
    }
  }

  const byAgent = new Map()

  for (const it of items) {
    const st = String(it.state || '').toUpperCase()
    if (st !== COMMISSION_STATE.toUpperCase()) continue

    const segFrom = String(it.start_date || it.from || '').slice(0, 10)
    const segTo   = String(it.end_date   || it.to   || '').slice(0, 10)

    const clipped = clipRange(segFrom, segTo, periodFrom, periodTo)
    if (!clipped) continue

    const agentId = it.agentId || it.agent_id
    if (!agentId) continue

    const key = agentId

    const candidate = {
      agentId,
      code:
        it.agentCode ||
        it.code ||
        it.agent_code ||
        '',
      nickname: it.nickname || it.agentNickname || it.agent_nickname || '',

      // 👇 IMPORTANTÍSIMO: id de la fila de rest_plans
      planId: it.id || it.restPlanId || it.rest_plan_id || null,

      // ORIGEN
      groupIdOrigin: it.agentGroupId || it.groupId || it.group_id || null,
      unitIdOrigin:  it.agentUnitId  || it.unitId  || it.unit_id  || null,
      unitName:      it.unitName     || it.unit_name || '',

      // DESTINO
      destGroupId:   it.destGroupId   || it.dest_group_id   || null,
      destGroupName: it.destGroupName || it.dest_group_name || '',
      destUnitId:    it.destUnitId    || it.dest_unit_id    || null,
      destUnitName:  it.destUnitName  || it.dest_unit_name  || '',
      municipalityId: it.municipalityId || it.municipality_id || null,

      // 👇 NUEVO: departamentos que vienen del backend
      dept1: it.dept1 || it.dept_1 || null,
      dept2: it.dept2 || it.dept_2 || null,
      dept3: it.dept3 || it.dept_3 || null,

      start: clipped.from,
      end:   clipped.to,
      days:  clipped.days,
      validated: false,
      commissionId: null
    }

    // 👇 construir label de unidad a mostrar
    const unitBase =
      candidate.destUnitName ||
      candidate.unitName ||
      ''

    const depts = [candidate.dept1, candidate.dept2, candidate.dept3].filter(Boolean)

    let displayUnit = unitBase || '—'

    // Palabras clave para las que queremos mostrar departamentos
    const baseUpper = (unitBase || '').toUpperCase()
    const isGeo  = baseUpper.includes('GEO')
    const isUnco = baseUpper.includes('UNCO')

    // Si es GEO o UNCO y tiene departamentos, agregamos paréntesis
    if ((isGeo || isUnco) && depts.length) {
      displayUnit = `${unitBase} (${depts.join(', ')})`
    }

candidate.displayUnit = displayUnit


    candidate.displayUnit = displayUnit


    const current = byAgent.get(key)
    if (!current) {
      byAgent.set(key, candidate)
    } else {
      if (candidate.days > current.days) {
        byAgent.set(key, candidate)
      } else if (candidate.days === current.days && candidate.start < current.start) {
        byAgent.set(key, candidate)
      }
    }
  }

  // 2) Marcar como "validated" si hay una comisión ligada a ese rest_plan_id
  const out = Array.from(byAgent.values())

  for (const r of out) {
    const pid = r.planId ? Number(r.planId) : null
    
    // r.validated = pid ? commByPlanId.has(pid) : false // <-- CÓDIGO ANTERIOR

    // <-- CAMBIO: Almacenar el ID si está validada
    if (pid && commByPlanId.has(pid)) {
      r.validated = true
      r.commissionId = commByPlanId.get(pid) // Guarda el ID para la eliminación
    } else {
      r.validated = false
      r.commissionId = null
    }
    // CAMBIO FIN -->
  }

  // 3) Orden
  out.sort((a, b) => {
    const gA = (a.destGroupName || '').localeCompare(b.destGroupName || '')
    if (gA !== 0) return gA
    return String(a.code || '').localeCompare(String(b.code || ''))
  })

  return out
}


// ==== Carga de catálogos ====
async function loadGroups () {
  try {
    const { data } = await http.get('/admin/groups')
    groups.value = Array.isArray(data) ? data : []
  } catch {
    groups.value = []
  }
}

async function loadUnits () {
  try {
    const { data } = await http.get('/admin/units')
    units.value = Array.isArray(data) ? data : []
  } catch {
    units.value = []
  }
}

// ==== Acción principal: cargar proyección para gastos ====
// LÓGICA:
// 1) Si hay vigencia seleccionada → usar sus fechas (from/to de la vigencia)
// 2) Si NO hay vigencia → usar filtros de fecha manuales
// 3) Asegurar vigencia (si no había) solo para poder guardar vigenciaId en service_commissions
// 4) /rest-planning y /service-commissions se consultan POR FECHAS
async function loadExpenses () {
  error.value = ''
  msg.value = ''
  rows.value = []

  let from = ''
  let to = ''

  // 1) Si ya hay vigencia seleccionada, usamos sus fechas
  if (currentVigenciaId.value) {
    const vig = periods.value.find(
      p => Number(p.id) === Number(currentVigenciaId.value)
    )
    if (!vig) {
      error.value = 'La vigencia seleccionada no existe o no se pudo cargar.'
      return
    }
    from = vig.from
    to = vig.to
  } else {
    // 2) Si NO hay vigencia, usamos lo que haya en los inputs de fecha
    from = filters.value.from
    to = filters.value.to
  }

  // Validación básica
  if (!from || !to) {
    error.value = 'Debes seleccionar una vigencia o un rango de fechas.'
    return
  }

  const d1 = toDate(from)
  const d2 = toDate(to)
  if (!d1 || !d2 || d2 < d1) {
    error.value = 'Rango de fechas inválido: "hasta" no puede ser menor que "desde".'
    return
  }

  loading.value = true
  try {
    // 3) Asegurar vigencia SOLO si aún no hay (cuando vino por fechas manuales)
    let vigId = currentVigenciaId.value
    if (!vigId) {
      vigId = await ensureVigenciaForRange(from, to)
      currentVigenciaId.value = vigId
    }

    // 4) Traer proyección y comisiones reales POR FECHA
    const [planningRes, commissionsRes] = await Promise.all([
      http.get('/rest-planning', { params: { from, to } }),
      http.get('/service-commissions', { params: { from, to } })
    ])

    const items = Array.isArray(planningRes?.data?.items) ? planningRes.data.items : []
    const commissions = Array.isArray(commissionsRes?.data?.items) ? commissionsRes.data.items : []

    rows.value = buildRows(items, from, to, commissions)

    // Reset filtros locales grupo/unidad
    filters.value.groupId = null
    filters.value.unitId = null
  } catch (err) {
    console.error('Error al cargar datos de proyección para gastos:', err)
    error.value =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.message ||
      'No se pudo cargar la proyección de descanso para gastos.'
  } finally {
    loading.value = false
  }
}


// ==== Filtro local por grupo / unidad (DESTINO) ====
const filteredRows = computed(() => {
  let out = rows.value || []

  const groupId = filters.value.groupId
  const unitId = filters.value.unitId

  if (groupId) {
    out = out.filter(r => Number(r.destGroupId || 0) === Number(groupId))
  }

  if (unitId) {
    out = out.filter(r => Number(r.destUnitId || 0) === Number(unitId))
  }

  return out
})

// ==== Validar / crear comisión para una fila ====
async function validarComision (row) {
  msg.value = ''
  msgOk.value = false

  if (!currentVigenciaId.value) {
    msg.value = 'No se encontró la vigencia actual para esta proyección.'
    msgOk.value = false
    return
  }

  try {
    const payload = {
      agentId: row.agentId,
      // unidad: destino si existe, si no la de origen
      unitId: row.destUnitId || row.unitIdOrigin || null,
      restPlanId: row.planId || null,      // ya lo estás usando
      start_date: row.start,
      end_date: row.end,
      state: COMMISSION_STATE,
      destGroupId: row.destGroupId || null,
      destUnitId: row.destUnitId || null,
      municipalityId: row.municipalityId || null,

      // 👇 NUEVO: amarrar la comisión a la vigencia actual
      vigenciaId: currentVigenciaId.value
    }

    const res = await http.post('/service-commissions', payload)

    row.validated = true
    row.commissionId = res.data.id // <-- NUEVO: Guardar el ID de la comisión creada
    msg.value = `Comisión creada para ${row.code}`
    msgOk.value = true
  } catch (e) {
    console.error('Error al crear comisión:', e)
    msg.value = e?.response?.data?.error || 'Error al crear comisión'
    msgOk.value = false
  }
}

// ==== Deshacer validación / eliminar comisión para una fila ====
async function undoValidacion (row) {
  msg.value = ''
  msgOk.value = false

  if (!row.commissionId) {
    msg.value = 'No se encontró el ID de la comisión para eliminar.'
    msgOk.value = false
    return
  }

  try {
    // Llama al endpoint DELETE
    await http.delete(`/service-commissions/${row.commissionId}`)

    // Actualizar estado local
    row.validated = false
    row.commissionId = null
    msg.value = `Comisión eliminada para ${row.code}`
    msgOk.value = true
  } catch (e) {
    console.error('Error al eliminar comisión:', e)
    msg.value = e?.response?.data?.error || 'Error al eliminar comisión'
    msgOk.value = false
  }
}

// ==== Inicialización ====
onMounted(async () => {
  await Promise.all([loadGroups(), loadUnits(), fetchPeriods()])
  // No cargamos automáticamente; el usuario elige vigencia y da "Consultar"
})
</script>
