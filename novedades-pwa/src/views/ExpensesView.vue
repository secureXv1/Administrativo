<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- Título -->
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">
          Gastos — Proyección de comisiones del servicio
        </h1>
        <p class="text-sm text-slate-500">
          Consulta qué funcionarios tienen proyección de
          <strong>COMISIÓN DEL SERVICIO</strong> en un rango de fechas y valida las comisiones que se certificarán en gastos.
        </p>
      </div>
    </header>

    <!-- SECCIÓN 1: Solo fechas + consultar -->
    <section class="bg-white rounded-2xl shadow border border-slate-200 p-4 space-y-4">
      <div class="grid gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
        <!-- Desde -->
        <div>
          <label class="text-xs font-medium text-slate-700 mb-1 block">
            Desde
          </label>
          <input
            type="date"
            v-model="filters.from"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <!-- Hasta -->
        <div>
          <label class="text-xs font-medium text-slate-700 mb-1 block">
            Hasta
          </label>
          <input
            type="date"
            v-model="filters.to"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed"
          @click="loadExpenses"
          :disabled="loading"
        >
          {{ loading ? 'Consultando…' : 'Consultar proyección para gastos' }}
        </button>

        <p v-if="error" class="text-xs text-rose-700">
          {{ error }}
        </p>

        <p v-else-if="filters.from && filters.to" class="text-xs text-slate-500">
          Ventana de vigencia seleccionada:
          <strong>{{ filters.from }}</strong> → <strong>{{ filters.to }}</strong>
        </p>
      </div>
    </section>

    <!-- SECCIÓN 2: filtros locales + resultados -->
    <section class="bg-white rounded-2xl shadow border border-slate-200 p-4">
      <!-- Encabezado + filtros locales de grupo/unidad -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">
            Funcionarios con COMISIÓN DEL SERVICIO en el rango
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
        No hay funcionarios con COMISIÓN DEL SERVICIO en el rango / filtros seleccionados.
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
                <!-- Unidad proyectada: intentamos primero la de destino -->
                {{ r.destUnitName || r.unitName || '—' }}
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
                <!-- Si ya fue validada en esta sesión, no mostramos botón -->
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
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-[11px] text-slate-500 mt-3">
        Ejemplo: si el agente S069 tiene proyección
        01–05 COMISIÓN DEL SERVICIO, 06–10 PERMISO, 11–27 COMISIÓN DEL SERVICIO
        y consultas del 01/12/25 al 25/12/25, se mostrará:
        <strong>inicio 11/12/25, fin 25/12/25</strong> (se toma la comisión que
        cubre más días dentro del rango).
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
  from: '',
  to: '',
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
const periods = ref([])         // { id, from, to, created_at, ... }
const currentVigenciaId = ref(null)
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
   - ensureVigenciaForRange(from,to) busca o crea
========================== */

async function fetchPeriods () {
  loadingPeriods.value = true
  try {
    const { data } = await http.get('/rest-planning/periods')
    const items = Array.isArray(data?.items) ? data.items : []
    periods.value = items.map(p => ({
        id: p.id,
        from: String(p.from_date).slice(0, 10),
        to: String(p.to_date).slice(0, 10),
        created_at: p.created_at || null
    }))

  } catch (e) {
    console.error('Error cargando vigencias:', e)
    periods.value = []
  } finally {
    loadingPeriods.value = false
  }
}

/**
 * Asegura que exista una vigencia para [from,to]:
 * - si ya existe en periods → usa esa
 * - si no, hace POST /rest-planning/periods y la crea
 */
async function ensureVigenciaForRange (from, to) {
  if (!from || !to) {
    throw new Error('Rango de fechas requerido para la vigencia')
  }

  if (!periods.value.length && !loadingPeriods.value) {
    await fetchPeriods()
  }

  // ¿Ya existe una vigencia con exactamente ese rango?
  const existing = periods.value.find(
    p => p.from === from && p.to === to
  )
  if (existing) {
    currentVigenciaId.value = existing.id
    return existing.id
  }

  // Crear nueva vigencia
  const { data } = await http.post('/rest-planning/periods', { from, to })
  const newId = data?.id
  if (!newId) {
    throw new Error('No se pudo crear vigencia')
  }

  const newPeriod = {
    id: newId,
    from,
    to,
    created_at: new Date().toISOString()
  }
  periods.value.unshift(newPeriod)
  currentVigenciaId.value = newId
  return newId
}

/* =======================
   buildRows
   - items: segmentos de /rest-planning
   - periodFrom / periodTo: rango de la vigencia
   - commissions: comisiones reales /service-commissions
========================== */

function buildRows (items, periodFrom, periodTo, commissions = []) {
  // Agrupar comisiones reales por agente para marcar "validated"
  const commByAgent = new Map()
  for (const c of commissions) {
    const agentId = c.agentId || c.agent_id
    if (!agentId) continue
    const arr = commByAgent.get(agentId) || []
    arr.push({
      start: String(c.start_date).slice(0, 10),
      end:   String(c.end_date).slice(0, 10)
    })
    commByAgent.set(agentId, arr)
  }

  const byAgent = new Map()

  for (const it of items) {
    const st = String(it.state || '').toUpperCase()
    if (st !== COMMISSION_STATE.toUpperCase()) continue

    const segFrom = String(it.start_date || it.from || '').slice(0, 10)
    const segTo = String(it.end_date || it.to || '').slice(0, 10)

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
      // grupo / unidad ORIGEN (por si quieres verlos luego)
      groupIdOrigin: it.agentGroupId || it.groupId || it.group_id || null,
      unitIdOrigin: it.agentUnitId || it.unitId || it.unit_id || null,
      unitName: it.unitName || it.unit_name || '',
      // grupo / unidad DESTINO (proyectada)
      destGroupId: it.destGroupId || it.dest_group_id || null,
      destGroupName: it.destGroupName || it.dest_group_name || '',
      destUnitId: it.destUnitId || it.dest_unit_id || null,
      destUnitName: it.destUnitName || it.dest_unit_name || '',
      municipalityId: it.municipalityId || it.municipality_id || null,
      start: clipped.from,
      end: clipped.to,
      days: clipped.days,
      validated: false // se recalcula después
    }

    const current = byAgent.get(key)

    // Nos quedamos con el segmento con MÁS días; en empate, el de inicio más temprano.
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

  let out = Array.from(byAgent.values()).sort((a, b) => {
    // Orden por grupo DESTINO (nombre) y luego por código
    const gA = (a.destGroupName || '').localeCompare(b.destGroupName || '')
    if (gA !== 0) return gA
    return String(a.code || '').localeCompare(String(b.code || ''))
  })

  // Marcar como "validated" si ya existe una comisión real con ese mismo rango
  for (const r of out) {
    const arr = commByAgent.get(r.agentId) || []
    r.validated = arr.some(c => c.start === r.start && c.end === r.end)
  }

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
// AHORA:
// 1) Asegura vigencia (from/to) → vigenciaId
// 2) GET /rest-planning?vigenciaId
// 3) GET /service-commissions?from&to para saber qué ya está certificado
async function loadExpenses () {
  error.value = ''
  msg.value = ''
  rows.value = []

  const { from, to } = filters.value

  if (!from || !to) {
    error.value = 'Debes seleccionar fecha desde y hasta.'
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
    // 1) Asegurar vigencia
    const vigId = await ensureVigenciaForRange(from, to)

    // 2) Traer proyección + comisiones reales en paralelo
    const [planningRes, commissionsRes] = await Promise.all([
      http.get('/rest-planning', {
        params: {
          vigenciaId: vigId
        }
      }),
      http.get('/service-commissions', {
        params: {
          from,
          to
        }
      })
    ])

    const items = Array.isArray(planningRes?.data?.items) ? planningRes.data.items : []
    const commissions = Array.isArray(commissionsRes?.data?.items) ? commissionsRes.data.items : []

    rows.value = buildRows(items, from, to, commissions)

    // Reset de filtros locales al hacer nueva consulta
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

  try {
    const payload = {
      agentId: row.agentId,
      // para gastos es más interesante la unidad destino; si no hay, caemos a la de origen
      unitId: row.destUnitId || row.unitIdOrigin || null,
      restPlanId: null, // backend ya valida que haya proyección COMISIÓN DEL SERVICIO
      start_date: row.start,
      end_date: row.end,
      state: COMMISSION_STATE,
      destGroupId: row.destGroupId || null,
      destUnitId: row.destUnitId || null,
      municipalityId: row.municipalityId || null
    }

    await http.post('/service-commissions', payload)

    row.validated = true // 👈 oculta botón y muestra chip "Validada"
    msg.value = `Comisión creada para ${row.code}`
    msgOk.value = true
  } catch (e) {
    console.error('Error al crear comisión:', e)
    msg.value = e?.response?.data?.error || 'Error al crear comisión'
    msgOk.value = false
  }
}

// ==== Inicialización ====
onMounted(async () => {
  // Rango por defecto (mes actual)
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)

  const fmt = d => d.toISOString().slice(0, 10)
  filters.value.from = fmt(first)
  filters.value.to = fmt(last)

  await Promise.all([loadGroups(), loadUnits(), fetchPeriods()])
  // Si quieres cargar al entrar:
  // await loadExpenses()
})
</script>

