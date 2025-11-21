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
          <strong>COMISIÓN DEL SERVICIO</strong> en un rango de fechas.
        </p>
      </div>
    </header>

    <!-- Filtros -->
    <section class="bg-white rounded-2xl shadow border border-slate-200 p-4 space-y-4">
      <div class="grid gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
        <!-- Desde / Hasta -->
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

      <div class="grid gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))] items-end">
        <!-- Estado (por ahora fijo en COMISIÓN DEL SERVICIO, pero editable) -->
        <div>
          <label class="text-xs font-medium text-slate-700 mb-1 block">
            Estado de proyección
          </label>
          <select
            v-model="filters.state"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
          >
            <option value="COMISIÓN DEL SERVICIO">COMISIÓN DEL SERVICIO</option>
            <!-- Si quieres más estados, los agregas aquí -->
          </select>
        </div>

        <!-- Grupo -->
        <div>
          <label class="text-xs font-medium text-slate-700 mb-1 block">
            Grupo
          </label>
          <select
            v-model="filters.groupId"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
          >
            <option :value="null">Todos</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">
              {{ g.code || g.name || ('Grupo ' + g.id) }}
            </option>
          </select>
        </div>

        <!-- Unidad -->
        <div>
          <label class="text-xs font-medium text-slate-700 mb-1 block">
            Unidad
          </label>
          <select
            v-model="filters.unitId"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
          >
            <option :value="null">Todas</option>
            <option v-for="u in units" :key="u.id" :value="u.id">
              {{ u.short || u.name || ('Unidad ' + u.id) }}
            </option>
          </select>
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

    <!-- Resultados -->
    <section class="bg-white rounded-2xl shadow border border-slate-200 p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-900">
          Funcionarios con {{ filters.state }} en el rango
        </h2>
        <span class="text-xs text-slate-500">
          {{ rows.length }} registro(s)
        </span>
      </div>

      <div v-if="loading" class="text-sm text-slate-500 py-8 text-center">
        Cargando…
      </div>

      <div v-else-if="!rows.length" class="text-sm text-slate-500 py-8 text-center">
        No hay funcionarios con "{{ filters.state }}" en el rango seleccionado.
      </div>

      <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-800 text-white">
            <tr>
              <th class="text-left py-2 px-3 font-semibold">Código</th>
              <th class="text-left py-2 px-3 font-semibold">Nickname</th>
              <th class="text-left py-2 px-3 font-semibold">Categoría</th>
              <th class="text-left py-2 px-3 font-semibold">Grupo</th>
              <th class="text-left py-2 px-3 font-semibold">Unidad</th>
              <th class="text-left py-2 px-3 font-semibold">Inicio vigencia</th>
              <th class="text-left py-2 px-3 font-semibold">Fin vigencia</th>
              <th class="text-left py-2 px-3 font-semibold">Días en vigencia</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr
              v-for="r in rows"
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
                {{ r.category || '—' }}
              </td>
              <td class="py-2 px-3 text-slate-700">
                {{ r.groupCode || r.groupName || '—' }}
              </td>
              <td class="py-2 px-3 text-slate-700">
                {{ r.unitName || '—' }}
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
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Nota de ejemplo (puedes quitarla si quieres) -->
      <p class="text-[11px] text-slate-500 mt-3">
        Ejemplo: si el agente S069 tiene proyección
        01–05 COMISIÓN DEL SERVICIO, 06–10 PERMISO, 11–27 COMISIÓN DEL SERVICIO
        y consultas del 01/12/25 al 25/12/25, se mostrará:
        <strong>inicio 11/12/25, fin 25/12/25</strong> (se toma la comisión que
        cubre más días dentro del rango).
      </p>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { http } from '@/lib/http'

// === Estado local ===
const filters = ref({
  from: '',
  to: '',
  state: 'COMISIÓN DEL SERVICIO',
  groupId: null,
  unitId: null
})

const groups = ref([])
const units = ref([])

const loading = ref(false)
const error = ref('')
const rows = ref([])

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

/**
 * Construye las filas para la tabla de gastos.
 * items = data.items del /rest-planning (segmentos crudos).
 */
function buildRows (items, periodFrom, periodTo, stateFilter) {
  const byAgent = new Map()

  for (const it of items) {
    const st = String(it.state || '').toUpperCase()
    if (stateFilter && st !== String(stateFilter).toUpperCase()) continue

    const segFrom = String(it.start_date || it.from || '').slice(0, 10)
    const segTo = String(it.end_date || it.to || '').slice(0, 10)

    const clipped = clipRange(segFrom, segTo, periodFrom, periodTo)
    if (!clipped) continue

    const agentId = it.agentId || it.agent_id
    if (!agentId) continue

    const key = agentId
    const current = byAgent.get(key)

    // Datos de agente (ajusta los nombres de propiedades si tu backend usa otros)
    const candidate = {
      agentId,
      code:
        it.agentCode ||
        it.code ||
        it.agent_code ||
        '',
      nickname: it.nickname || it.agentNickname || it.agent_nickname || '',
      category: it.category || it.agentCategory || it.agent_category || '',
      groupCode: it.groupCode || it.group_code || '',
      groupName: it.groupName || it.group_name || '',
      unitName: it.unitName || it.unit_name || '',
      start: clipped.from,
      end: clipped.to,
      days: clipped.days
    }

    // Si ya hay uno para este agente, nos quedamos con el que
    // tenga MÁS días; en empate, el de inicio más temprano.
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

  return Array.from(byAgent.values()).sort((a, b) => {
    // Orden por grupo, luego por código
    const gA = (a.groupCode || a.groupName || '').localeCompare(b.groupCode || b.groupName || '')
    if (gA !== 0) return gA
    return String(a.code || '').localeCompare(String(b.code || ''))
  })
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
async function loadExpenses () {
  error.value = ''
  rows.value = []

  const { from, to, state, groupId, unitId } = filters.value

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
    const { data } = await http.get('/rest-planning', {
      params: {
        from,
        to,
        state: state || undefined,
        groupId: groupId || undefined,
        unitId: unitId || undefined
      }
    })

    const items = Array.isArray(data?.items) ? data.items : []
    rows.value = buildRows(items, from, to, state)
  } catch (err) {
    console.error('Error /rest-planning (gastos):', err)
    error.value =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      'No se pudo cargar la proyección de descanso para gastos.'
  } finally {
    loading.value = false
  }
}

// ==== Inicialización ====
onMounted(async () => {
  // Si quieres, puedes precargar un rango por defecto (ej: mes actual)
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)

  const fmt = d => d.toISOString().slice(0, 10)
  filters.value.from = fmt(first)
  filters.value.to = fmt(last)

  await Promise.all([loadGroups(), loadUnits()])
  // No llamo loadExpenses() automáticamente para no pegarle al backend
  // hasta que tú lo decidas. Si quieres que cargue de una, descomenta:
  // await loadExpenses()
})
</script>
