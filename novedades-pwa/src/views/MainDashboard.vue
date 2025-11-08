<template>
  <div class="space-y-6">

    <!-- BARRA SUPERIOR -->
    <header class="sticky top-0 z-10 bg-gradient-to-r from-sky-700 to-cyan-600 text-white rounded-xl p-4 shadow">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/15 grid place-items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-width="1.5" d="M3 3h18M3 9h18M3 15h18M3 21h18"/>
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-semibold">Panel Operativo</h1>
            <!--p class="text-white/80 text-sm">KPIs del día y analítica</p-->
          </div>
        </div>

        <!-- Acciones rápidas >
        <div class="flex items-center gap-2">
          <button @click="reloadAll" :disabled="loading"
                  class="rounded-md bg-white/90 text-sky-700 font-medium px-3 py-2 hover:bg-white disabled:opacity-60">
            Actualizar
          </button>
          <button @click="exportCsv" :disabled="loading"
                  class="rounded-md bg-white/10 text-white border border-white/30 px-3 py-2 hover:bg-white/20 disabled:opacity-60">
            CSV
          </button>
        </div-->
      </div>

      <!-- Estado -->
      <div class="mt-3 text-xs">
        <span class="inline-flex items-center gap-2 bg-white/10 px-2 py-1 rounded">
          <span class="w-2 h-2 rounded-full" :class="loading ? 'bg-yellow-300 animate-pulse' : error ? 'bg-red-300' : 'bg-emerald-300'"></span>
          <span v-if="loading">Cargando…</span>
          <span v-else-if="error" class="text-red-100">Error: {{ error }}</span>
          <span v-else class="text-emerald-100">Listo</span>
        </span>
      </div>
    </header>

    <!-- Fila de KPIs (SIN filtros de fecha) -->
    <section class="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <!-- Agentes activos / inactivos -->
      <div class="rounded-xl border border-slate-200 p-4 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
        <div class="flex items-center justify-between">
          <h4 class="text-emerald-900 text-sm font-semibold">Agentes</h4>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">snapshot</span>
        </div>
        <div class="mt-2 text-2xl font-bold text-emerald-900">
          {{ overview.agents_active }} <span class="text-sm font-medium text-emerald-800">act.</span>
        </div>
        <div class="text-sm text-emerald-800">Inactivos: {{ overview.agents_inactive }}</div>
      </div>

      <!-- Cobertura de reporte hoy -->
      <div class="rounded-xl border border-slate-200 p-4 shadow-sm bg-gradient-to-br from-sky-50 to-sky-100">
        <div class="flex items-center justify-between">
          <h4 class="text-sky-900 text-sm font-semibold">Cobertura reporte (hoy)</h4>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-sky-200 text-sky-900">en vivo</span>
        </div>
        <div class="mt-2 text-2xl font-bold text-sky-900">
          {{ overview.coverage.percent }}%
        </div>
        <div class="text-sm text-sky-800">
          Recibidos {{ overview.coverage.received }} / Esperados {{ overview.coverage.expected }}
        </div>
      </div>

      <!-- Unidades con reporte hoy -->
      <div class="rounded-xl border border-slate-200 p-4 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100">
        <div class="flex items-center justify-between">
          <h4 class="text-indigo-900 text-sm font-semibold">Unidades con reporte</h4>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900">hoy</span>
        </div>
        <div class="mt-2 text-2xl font-bold text-indigo-900">
          {{ overview.units_reported_today.count }}
        </div>
        <div class="text-sm text-indigo-800">
          {{ overview.units_reported_today.percent }}% del total
        </div>
      </div>

      <!-- Racha SN / Ausencias -->
      <div class="rounded-xl border border-slate-200 p-4 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
        <div class="flex items-center justify-between">
          <h4 class="text-amber-900 text-sm font-semibold">Racha & Ausencias</h4>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">hoy</span>
        </div>
        <div class="mt-1 text-sm text-amber-900">
          <div class="font-semibold">Top racha SNV:</div>
          <div class="truncate">{{ overview.top_streak_snv?.name || '—' }} ({{ overview.top_streak_snv?.days || 0 }} días)</div>
        </div>
        <div class="mt-2 text-sm text-amber-900">
          Ausencias activas: <span class="font-bold">{{ overview.absences_today }}</span>
        </div>
      </div>
    </section>

    <!-- FILA DE MAPA Y SLIDERS -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Mini-mapa de personas -->
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <h2 class="text-sm font-semibold text-slate-800 mb-2">Ubicación de personas (en vivo)</h2>
        <MapMini
          :dateISO="filters.corte"
          :groupId="filters.groupId"
          endpoint="/admin/agents-locations-latest"  
          :refreshMs="15000"
        />
      </div>

      <!-- Cumpleaños del mes (x2 como pediste) -->
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <SliderStrip :items="bdayItems" title="Cumpleaños del mes" :autoplayMs="3400">
          <template #icon="{ item }">
            <div class="text-2xl leading-none">{{ item.emoji || '🎂' }}</div>
          </template>
        </SliderStrip>
        <br>
        <SliderStrip :items="bdayItems" title="Cumpleaños del mes" :autoplayMs="3400">
          <template #icon="{ item }">
            <div class="text-2xl leading-none">{{ item.emoji || '🎂' }}</div>
          </template>
        </SliderStrip>
      </div>
    </section>

    <!-- LEADERBOARDS -->
    <section class="grid grid-cols-1 xl:grid-cols-4 gap-4">
      <!-- +30 días -->
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">+30 días laborados</h3>
          <span class="text-xs text-slate-500">{{ plus30.count }}</span>
        </div>
        <ul class="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
          <li v-for="(a,i) in plus30.items.slice(0,10)" :key="a.id" class="text-sm">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-full bg-slate-200 grid place-items-center text-[10px] font-bold text-slate-700">
                {{ (a.name||'?').slice(0,1) }}
              </div>
              <div class="flex-1">
                <div class="flex justify-between">
                  <span class="truncate">{{ a.name }}</span>
                  <span class="text-slate-500">{{ a.days }} d</span>
                </div>
                <div class="h-2 bg-slate-100 rounded mt-1">
                  <div class="h-2 rounded bg-emerald-500" :style="{ width: pct(a.days, maxStreak)+'%' }"></div>
                </div>
              </div>
            </div>
          </li>
          <li v-if="!plus30.items.length" class="text-slate-400 text-sm">—</li>
        </ul>
      </div>

      <!-- Top laborados -->
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Top laborados</h3>
          <span class="text-xs text-slate-500">Top 5</span>
        </div>
        <ul class="mt-3 space-y-2">
          <li v-for="(a,i) in topWorked" :key="a.id" class="text-sm">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 shrink-0 grid place-items-center rounded-full"
                    :class="i===0 ? 'bg-amber-500 text-white' : i===1 ? 'bg-slate-400 text-white' : i===2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'">
                {{ i+1 }}
              </span>
              <div class="flex-1">
                <div class="flex justify-between">
                  <span class="truncate">{{ a.name }}</span>
                  <span class="text-slate-500">{{ a.days }} d</span>
                </div>
                <div class="h-2 bg-slate-100 rounded mt-1">
                  <div class="h-2 rounded bg-sky-500" :style="{ width: pct(a.days, maxWorked)+'%' }"></div>
                </div>
              </div>
            </div>
          </li>
          <li v-if="!topWorked.length" class="text-slate-400 text-sm">—</li>
        </ul>
      </div>

      <!-- Top permisos -->
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Top permisos</h3>
          <span class="text-xs text-slate-500">Top 5</span>
        </div>
        <ul class="mt-3 space-y-2">
          <li v-for="(a,i) in topPermits" :key="a.id" class="text-sm">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 shrink-0 grid place-items-center rounded-full"
                    :class="i===0 ? 'bg-amber-500 text-white' : i===1 ? 'bg-slate-400 text-white' : i===2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'">
                {{ i+1 }}
              </span>
              <div class="flex-1">
                <div class="flex justify-between">
                  <span class="truncate">{{ a.name }}</span>
                  <span class="text-slate-500">{{ a.days }} d</span>
                </div>
                <div class="h-2 bg-slate-100 rounded mt-1">
                  <div class="h-2 rounded bg-rose-500" :style="{ width: pct(a.days, maxPermits)+'%' }"></div>
                </div>
              </div>
            </div>
          </li>
          <li v-if="!topPermits.length" class="text-slate-400 text-sm">—</li>
        </ul>
      </div>

      <!-- Top novedades (lista) -->
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Top novedades</h3>
          <span class="text-xs text-slate-500">Top 5</span>
        </div>
        <ul class="mt-3 space-y-2">
          <li v-for="(n,i) in topNovelties" :key="n.label" class="text-sm">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full"
                    :class="['bg-rose-500','bg-amber-500','bg-sky-500','bg-emerald-500','bg-fuchsia-500'][i % 5]"></span>
              <div class="flex-1 flex justify-between">
                <span class="truncate">{{ i+1 }}. {{ n.label }}</span>
                <span class="text-slate-500">{{ n.total }}</span>
              </div>
            </div>
          </li>
          <li v-if="!topNovelties.length" class="text-slate-400 text-sm">—</li>
        </ul>
      </div>
    </section>

    <!-- GRÁFICAS -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white rounded-xl border border-slate-200 p-4 h-[340px]">
        <div class="bg-white rounded-xl border border-slate-200 p-6 h-[340px]">
          <h2 class="text-lg font-semibold mb-2">Reportes por día</h2>
          <Bar :data="barData" :options="barOptions" class="h-[260px]" />
        </div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4 h-[340px]">
        <div class="bg-white rounded-xl border border-slate-200 p-6 h-[340px]">
          <h2 class="text-lg font-semibold mb-2">Reportes por día</h2>
          <Bar :data="barData" :options="barOptions" class="h-[260px]" />
        </div>
      </div>
    </section>

    <!-- MODAL NOVEDADES -->
    <div v-if="novModalOpen" class="fixed inset-0 z-[9998] grid place-items-center bg-black/40 p-4">
      <div class="bg-white rounded-2xl shadow-xl max-w-4xl w-full relative border border-slate-200">
        <button class="absolute top-3 right-4 text-2xl text-slate-600" @click="novModalOpen=false">×</button>
        <div class="p-5">
          <h2 class="text-xl font-bold mb-4">Detalle de novedades ({{ filters.corte }})</h2>

          <div class="mb-3 flex gap-2">
            <button class="border border-slate-300 px-3 py-1 rounded-lg hover:bg-slate-100" :class="novTab==='tipos' && 'bg-slate-200 font-semibold'" @click="novTab='tipos'">Por tipo</button>
            <button class="border border-slate-300 px-3 py-1 rounded-lg hover:bg-slate-100" :class="novTab==='ambito' && 'bg-slate-200 font-semibold'" @click="novTab='ambito'">Por {{ isAdminView ? 'grupo' : 'unidad' }}</button>
          </div>

          <div v-if="novTab==='tipos'" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="text-left"><th>Tipo</th><th>OF</th><th>SO</th><th>PT</th><th>Total</th></tr></thead>
              <tbody>
                <tr v-for="row in novTiposRows" :key="row.novedad">
                  <td>{{ row.novedad }}</td><td>{{ row.OF }}</td><td>{{ row.SO }}</td><td>{{ row.PT }}</td><td class="font-semibold">{{ row.total }}</td>
                </tr>
                <tr v-if="!novTiposRows.length"><td colspan="5" class="text-center text-slate-400 py-4">Sin novedades</td></tr>
              </tbody>
            </table>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="text-left"><th>{{ isAdminView ? 'Grupo' : 'Unidad' }}</th><th>OF</th><th>SO</th><th>PT</th><th>Total</th></tr></thead>
              <tbody>
                <tr v-for="row in novAmbitoRows" :key="row.label">
                  <td>{{ row.label }}</td><td>{{ row.OF }}</td><td>{{ row.SO }}</td><td>{{ row.PT }}</td><td class="font-semibold">{{ row.total }}</td>
                </tr>
                <tr v-if="!novAmbitoRows.length"><td colspan="5" class="text-center text-slate-400 py-4">Sin novedades</td></tr>
              </tbody>
            </table>

            <div class="mt-4 grid gap-4 sm:grid-cols-2" v-if="novAmbitoCards.length">
              <div v-for="card in novAmbitoCards" :key="card.label" class="bg-slate-50 border rounded-lg p-3 shadow-sm">
                <div class="font-semibold text-slate-700 mb-2">{{ card.label }}</div>
                <table class="w-full text-xs">
                  <thead><tr class="text-left"><th>Novedad</th><th>OF</th><th>SO</th><th>PT</th><th>Total</th></tr></thead>
                  <tbody>
                    <tr v-for="row in card.items" :key="row.novedad">
                      <td>{{ row.novedad }}</td><td>{{ row.OF }}</td><td>{{ row.SO }}</td><td>{{ row.PT }}</td><td>{{ row.total }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>

    <!-- PANEL DEBUG (plegable) -->
    <details class="bg-white rounded-xl border border-slate-200 p-3">
      <summary class="cursor-pointer text-sm text-slate-600">Debug (ver params y tamaños de dataset)</summary>
      <div class="mt-2 text-xs text-slate-600 space-y-1">
        <div><b>Params KPIs:</b> {{ { date: filters.corte, groupId: filters.groupId || undefined } }}</div>
        <div><b>Params rango:</b> {{ { date_from: filters.from, date_to: filters.to, groupId: filters.groupId || undefined } }}</div>
        <div><b>itemsBar:</b> {{ barData?.datasets?.[0]?.data?.length || 0 }}</div>
        <div><b>topNov:</b> {{ topNovelties.length }}</div>
      </div>
    </details>

  </div>
</template>

<script setup>
import { Bar, Pie } from 'vue-chartjs'
import { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import SliderStrip from '@/components/SliderStrip.vue'
import MapMini from '@/components/MapMini.vue'
Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

// ====== API CLIENT ======
const API_BASE = import.meta.env.VITE_API_BASE || ''
const api = axios.create({ baseURL: API_BASE })
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) cfg.headers.Authorization = 'Bearer ' + t
  return cfg
})

// ====== HELPERS ======
const ymd = d => (d instanceof Date ? d.toISOString().slice(0,10) : String(d).slice(0,10))
const today = new Date()
const defaultFrom = new Date(today); defaultFrom.setDate(today.getDate() - 6)

// ====== STATE ======
const loading = ref(false)
const error = ref('')
const grupos = ref([])
const topNovelties = ref([])

// ====== SLIDERS ======
const annivItems = ref([])
const bdayItems  = ref([])

// Filtros (NO afectan overview; sí gráficas/tops y modal)
const filters = ref({
  corte: ymd(today),
  from: ymd(defaultFrom),
  to: ymd(today),
  groupId: ''
})

// ====== KPIs NUEVOS (overview) ======
const overview = ref({
  agents_active: 0,
  agents_inactive: 0,
  coverage: { received: 0, expected: 0, percent: 0 },
  units_reported_today: { count: 0, percent: 0 },
  top_streak_snv: { agent_id: null, name: null, days: 0 },
  absences_today: 0,
  target_date: null
})

async function loadOverview() {
  try {
    const corte = filters.value.corte

    // 1) Cumplimiento
    const { data: comp } = await api.get('/dashboard/compliance', { params: { date: corte } })
    const done = comp?.done?.length || 0
    const pend = comp?.pending?.length || 0
    const expectedUnits = done + pend
    const coveragePercent = expectedUnits ? Math.round((done / expectedUnits) * 100) : 0

    // 2) Agentes activos/inactivos
    const { data: ag } = await api.get('/catalogs/agents', { params: { limit: 1000, groupId: filters.value.groupId || undefined } })
    const agents = Array.isArray(ag?.items) ? ag.items : (Array.isArray(ag) ? ag : [])
    const act = agents.filter(a => String(a.status || '').toUpperCase() === 'ACTIVE').length
    const inact = agents.length - act

    // 3) Ausencias del día (PT)
    const { data: tipos } = await api.get('/dashboard/novelties-by-type', { params: { date: corte, groupId: filters.value.groupId || undefined } })
    const rows = (tipos?.items || (Array.isArray(tipos) ? tipos : []))
    const PT_total = rows.reduce((acc, r) => acc + Number(r.PT || r.PT_count || 0), 0)

    // 4) Top racha
    const { data: streaks } = await api.get('/admin/agents-streaks', { params: { pageSize: 200, groupId: filters.value.groupId || undefined } })
    const items = streaks?.items || []
    const top = items.reduce((best, a) => (a.current_streak > (best?.current_streak || 0) ? a : best), null)
    const topStreak = top ? { agent_id: top.id || top.agentId, name: top.nickname || top.code, days: top.current_streak || 0 } : { agent_id:null, name:null, days:0 }

    overview.value = {
      agents_active: act, agents_inactive: inact,
      coverage: { received: done, expected: expectedUnits, percent: coveragePercent },
      units_reported_today: { count: done, percent: coveragePercent },
      top_streak_snv: topStreak,
      absences_today: PT_total,
      target_date: corte
    }
  } catch (e) {
    console.error('overview error:', e?.response?.data || e?.message || e)
  }
}

// ====== (legacy) KPIs por corte ======
const tot = ref({ OF_FE:0, SO_FE:0, PT_FE:0, OF_FD:0, SO_FD:0, PT_FD:0, OF_N:0, SO_N:0, PT_N:0 })
const kpiFE  = computed(() => `${tot.value.OF_FE}/${tot.value.SO_FE}/${tot.value.PT_FE}`)
const kpiFD  = computed(() => `${tot.value.OF_FD}/${tot.value.SO_FD}/${tot.value.PT_FD}`)
const kpiNOV = computed(() => `${tot.value.OF_N}/${tot.value.SO_N}/${tot.value.PT_N}`)
const feTotalDash  = computed(() => tot.value.OF_FE + tot.value.SO_FE + tot.value.PT_FE)
const fdTotalDash  = computed(() => tot.value.OF_FD + tot.value.SO_FD + tot.value.PT_FD)
const novTotalDash = computed(() => tot.value.OF_N + tot.value.SO_N + tot.value.PT_N)

async function loadKPIsSnapshot() {
  try {
    const p = { date: filters.value.corte }
    if (filters.value.groupId) p.groupId = filters.value.groupId
    const { data } = await api.get('/dashboard/reports', { params: p })
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    const sum = { OF_FE:0, SO_FE:0, PT_FE:0, OF_FD:0, SO_FD:0, PT_FD:0, OF_N:0, SO_N:0, PT_N:0 }
    for (const r of items) {
      sum.OF_FE += r.OF_effective||0; sum.SO_FE += r.SO_effective||0; sum.PT_FE += r.PT_effective||0
      sum.OF_FD += r.OF_available||0; sum.SO_FD += r.SO_available||0; sum.PT_FD += r.PT_available||0
      sum.OF_N  += r.OF_nov||0;       sum.SO_N  += r.SO_nov||0;       sum.PT_N  += r.PT_nov||0
    }
    tot.value = sum
  } catch (e) {
    console.error('KPIs snapshot error:', e?.response?.data || e?.message || e)
    tot.value = { OF_FE:0, SO_FE:0, PT_FE:0, OF_FD:0, SO_FD:0, PT_FD:0, OF_N:0, SO_N:0, PT_N:0 }
  }
}

// ====== CHARTS & TOP NOV ======
const barData = ref({ labels: [], datasets: [{ label: 'Reportes', data: [] }] })
const barOptions = { responsive: true, plugins: { legend: { display: false } } }
const pieData = ref({ labels: [], datasets: [{ data: [] }] })
const pieOptions = { responsive: true, plugins: { legend: { position: 'bottom' } } }

async function loadSeriesAndTop() {
  try {
    const p = { date_from: filters.value.from, date_to: filters.value.to }
    if (filters.value.groupId) p.groupId = filters.value.groupId
    const { data } = await api.get('/dashboard/reports', { params: p })
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    const byDate = new Map()
    for (const r of items) {
      const d = ymd(r.date)
      byDate.set(d, (byDate.get(d)||0) + 1)
    }
    const ordered = Array.from(byDate.entries()).sort((a,b)=> a[0].localeCompare(b[0]))
    barData.value = { labels: ordered.map(([d])=>d), datasets: [{ label:'Reportes', data: ordered.map(([,c])=>c) }] }

    const pNov = { date: filters.value.to }
    if (filters.value.groupId) pNov.groupId = filters.value.groupId
    const { data: tipos } = await api.get('/dashboard/novelties-by-type', { params: pNov })
    const rows = (tipos?.items || (Array.isArray(tipos) ? tipos : []))
      .filter(r => String(r.novedad||'').trim().toUpperCase() !== 'SIN NOVEDAD')
    const ranked = rows.map(r => {
      const OF = Number(r.OF||r.OF_count||0)
      const SO = Number(r.ME||r.SO||r.SO_count||0)
      const PT = Number(r.PT||r.PT_count||0)
      return { label: r.novedad, total: OF+SO+PT }
    }).sort((a,b)=> b.total - a.total).slice(0,5)

    topNovelties.value = ranked
    pieData.value = { labels: ranked.map(r=>r.label), datasets: [{ data: ranked.map(r=>r.total) }] }
  } catch (e) {
    console.error('Series/Top error:', e?.response?.data || e?.message || e)
    barData.value = { labels: [], datasets: [{ label:'Reportes', data: [] }] }
    pieData.value = { labels: [], datasets: [{ data: [] }] }
    topNovelties.value = []
  }
}

// ====== LEADERBOARDS (Agentes) ======
const topWorked = ref([])
const topPermits = ref([])
const plus30 = ref({ count: 0, items: [] })

async function loadLeaderboards() {
  const common = {}
  if (filters.value.groupId) common.groupId = filters.value.groupId

  try {
    const { data } = await api.get('/admin/agents-streaks', { params: { page: 1, pageSize: 1000, ...common } })
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    topWorked.value = [...items]
      .sort((a,b) => (b.current_streak||0) - (a.current_streak||0))
      .slice(0, 5)
      .map(a => ({ id: a.id || a.agentId, name: a.nickname || a.code, days: a.current_streak || 0 }))

    topPermits.value = items
      .filter(a => String(a.status || '').toUpperCase() === 'PERMISO')
      .sort((a,b) => (b.current_streak||0) - (a.current_streak||0))
      .slice(0, 5)
      .map(a => ({ id: a.id || a.agentId, name: a.nickname || a.code, days: a.current_streak || 0 }))

    const ge30 = items
      .filter(a => (a.current_streak || 0) >= 30)
      .sort((a,b) => (b.current_streak||0) - (a.current_streak||0))
      .map(a => ({ id: a.id || a.agentId, name: a.nickname || a.code, days: a.current_streak || 0 }))

    plus30.value = { count: ge30.length, items: ge30.slice(0, 100) }
  } catch (e) {
    console.warn('Leaderboards no disponibles:', e?.message || e)
    topWorked.value = []
    topPermits.value = []
    plus30.value = { count: 0, items: [] }
  }
}

// ====== MODAL NOVEDADES ======
const novModalOpen = ref(false)
const novTab = ref('tipos')
const isAdminView = computed(() => true)
const novTiposRows = ref([])
const novAmbitoRows = ref([])
const novAmbitoDetRows = ref([])

const novAmbitoCards = computed(() => {
  const map = new Map()
  for (const r of novAmbitoDetRows.value) {
    const label = r.label || r.groupCode || r.unitName || '—'
    if (!map.has(label)) map.set(label, [])
    const OF = Number(r.OF || r.OF_count || 0)
    const SO = Number(r.ME || r.SO || r.SO_count || 0)
    const PT = Number(r.PT || r.PT_count || 0)
    map.get(label).push({ novedad: r.novedad, OF, SO, PT, total: OF+SO+PT })
  }
  const out = []
  for (const [label, items] of map.entries()) {
    const clean = items.filter(i => String(i.novedad).toUpperCase() !== 'SIN NOVEDAD').sort((a,b)=> b.total - a.total)
    out.push({ label, items: clean })
  }
  return out.sort((a,b)=> String(a.label).localeCompare(String(b.label)))
})

function openNovModal() {
  novModalOpen.value = true
  novTab.value = 'tipos'
  loadNovDetails()
}

async function loadNovDetails() {
  const p = { date: filters.value.corte }
  if (filters.value.groupId) p.groupId = filters.value.groupId

  try {
    const { data: tipos } = await api.get('/dashboard/novelties-by-type', { params: p })
    novTiposRows.value = (tipos?.items || (Array.isArray(tipos) ? tipos : []))
      .filter(r => String(r.novedad||'').trim().toUpperCase() !== 'SIN NOVEDAD')
      .map(r => {
        const OF = Number(r.OF||r.OF_count||0)
        const SO = Number(r.ME||r.SO||r.SO_count||0)
        const PT = Number(r.PT||r.PT_count||0)
        return { novedad: r.novedad, OF, SO, PT, total: OF+SO+PT }
      })
  } catch (e) {
    console.warn('Nov by type no disponible:', e?.message || e)
    novTiposRows.value = []
  }

  try {
    const scopeUrl = '/dashboard/novelties-by-unit'
    const { data: amb } = await api.get(scopeUrl, { params: p })
    novAmbitoRows.value = (amb?.items || (Array.isArray(amb) ? amb : []))
      .map(r => {
        const OF = Number(r.OF||r.OF_count||0)
        const SO = Number(r.ME||r.SO||r.SO_count||0)
        const PT = Number(r.PT||r.PT_count||0)
        return { label: r.label || r.groupCode || r.unitName, OF, SO, PT, total: OF+SO+PT }
      })
  } catch (e) {
    console.warn('Nov por ámbito no disponible:', e?.message || e)
    novAmbitoRows.value = []
  }

  try {
    const bdUrl = isAdminView.value ? '/dashboard/novelties-by-group-breakdown' : '/dashboard/novelties-by-unit-breakdown'
    const { data: det } = await api.get(bdUrl, { params: p })
    novAmbitoDetRows.value = (det?.items || (Array.isArray(det) ? det : []))
      .filter(r => String(r.novedad||'').trim().toUpperCase() !== 'SIN NOVEDAD')
  } catch (e) {
    console.warn('Breakdown no disponible:', e?.message || e)
    novAmbitoDetRows.value = []
  }
}

// ====== CSV único ======
async function exportCsv() {
  try {
    loading.value = true
    const p = { date_from: filters.value.from, date_to: filters.value.to }
    if (filters.value.groupId) p.groupId = filters.value.groupId
    const { data } = await api.get('/dashboard/reports', { params: p })
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    const { data: tipos } = await api.get('/dashboard/novelties-by-type', {
      params: { date: filters.value.to, groupId: filters.value.groupId || undefined }
    })
    const rowsNov = (tipos?.items || (Array.isArray(tipos) ? tipos : []))
      .filter(r => String(r.novedad||'').toUpperCase() !== 'SIN NOVEDAD')
      .map(r => {
        const OF = Number(r.OF||r.OF_count||0)
        const SO = Number(r.ME||r.SO||r.SO_count||0)
        const PT = Number(r.PT||r.PT_count||0)
        return [r.novedad, OF, SO, PT, OF+SO+PT]
      })
      .sort((a,b)=> b[4]-a[4]).slice(0,5)

    const head1 = ['date','groupId','unitId','groupCode','unitName','OF_effective','SO_effective','PT_effective','OF_available','SO_available','PT_available','OF_nov','SO_nov','PT_nov']
    const rows1 = items.map(r => [
      ymd(r.date), r.groupId, r.unitId, r.groupCode, (r.unitName||''),
      r.OF_effective, r.SO_effective, r.PT_effective,
      r.OF_available, r.SO_available, r.PT_available,
      r.OF_nov, r.SO_nov, r.PT_nov
    ])
    const head2 = ['novedad','OF','SO','PT','total']

    const csv1 = [head1.join(','), ...rows1.map(a=>a.join(','))].join('\n')
    const csv2 = [head2.join(','), ...rowsNov.map(a=>a.join(','))].join('\n')
    const csv  = `${csv1}\n\nTOP_5_NOVEDADES\n${csv2}\n`

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard_${filters.value.from}_a_${filters.value.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('CSV export error:', e?.response?.data || e?.message || e)
  } finally {
    loading.value = false
  }
}

// Fechas conmemorativas de la semana (dom-sáb)
async function loadAnniversaries() {
  try {
    const { data } = await api.get('/api/fechas/semana', { params: { date: filters.value.corte } })
    const arr = Array.isArray(data?.items) ? data.items : []
    annivItems.value = arr.map((x, i) => ({
      emoji: i % 2 ? '🎗️' : '🇨🇴',
      title: x.description || 'Conmemoración',
      subtitle: x.gao || 'Institucional',
      dateISO: String(x.fecha).slice(0,10),
      dateLabel: new Date(x.fecha).toLocaleDateString('es-CO', { weekday:'short', month:'short', day:'2-digit' }),
      bg: pastelBGs[i % pastelBGs.length],
    }))
    if (!annivItems.value.length) {
      const week = getWeekDatesISO(filters.value.corte)
      annivItems.value = buildAnnivDummy(week)
    }
  } catch (e) {
    console.warn('anniversaries error:', e?.message || e)
    const week = getWeekDatesISO(filters.value.corte)
    annivItems.value = buildAnnivDummy(week)
  }
}

const maxWorked  = computed(() => Math.max(1, ...topWorked.value.map(x => x.days || 0)))
const maxPermits = computed(() => Math.max(1, ...topPermits.value.map(x => x.days || 0)))
const maxStreak  = computed(() => Math.max(1, ...plus30.value.items.map(x => x.days || 0)))
function pct(v, max) { return Math.round((Number(v||0) / Number(max||1)) * 100) }

// Paleta intensa para cumpleaños (sin pastel)
const boldBdayBGs = [
  'from-violet-700 to-fuchsia-700 text-white',
  'from-indigo-700 to-blue-700 text-white',
  'from-emerald-700 to-teal-700 text-white',
  'from-rose-700 to-pink-700 text-white',
  'from-amber-600 to-orange-700 text-white',
  'from-slate-700 to-gray-800 text-white',
]

// === Helpers para cumpleaños ===
function parseBirthday(val) {
  if (!val) return null
  // Normaliza: acepta 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss', y 'DD/MM/YYYY'
  const s = String(val).trim()

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    const bd = new Date(Number(y), Number(m) - 1, Number(d))
    return isNaN(+bd) ? null : bd
  }

  // YYYY-MM-DD (o con hora)
  const iso = s.slice(0, 10) // 'YYYY-MM-DD'
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number)
    const bd = new Date(y, m - 1, d) // local, evita problemas de zona
    return isNaN(+bd) ? null : bd
  }

  // Último intento
  const bd = new Date(s)
  return isNaN(+bd) ? null : bd
}

function calcAge(bd, onDate) {
  const on = onDate instanceof Date ? onDate : new Date(onDate)
  let age = on.getFullYear() - bd.getFullYear()
  const m = on.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && on.getDate() < bd.getDate())) age -= 1
  // Ajusta límites si quieres (18–80)
  return Math.max(18, Math.min(80, age))
}

// Cumpleaños del mes
async function loadBirthdays() {
  try {
    const base = new Date(filters.value.corte)
    const month = base.getMonth()
    const year  = base.getFullYear()

    const { data } = await api.get('/catalogs/agents', {
      params: { limit: 1000, groupId: filters.value.groupId || undefined }
    })
    const agents = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    // Parsear y filtrar por mes actual (usando Date local para evitar desfases)
    const parsed = agents
      .map(a => ({ ...a, bd: parseBirthday(a.birthday) }))
      .filter(a => a.bd && a.bd.getMonth() === month)

    bdayItems.value = parsed
      .sort((a,b) => a.bd.getDate() - b.bd.getDate())
      .map((a, i) => {
        const bd = a.bd
        const next = new Date(year, bd.getMonth(), bd.getDate()) // próximo cumpleaños este año
        const age = calcAge(bd, base) // edad “a la fecha de corte”
        return {
          emoji: ['🎂','🎉','🎁','🥳','🍰','🎈'][i % 6],
          title: a.nickname || a.code,
          subtitle: `Cumple ${age}`,
          dateISO: next.toISOString().slice(0,10),
          dateLabel: next.toLocaleDateString('es-CO', { month:'short', day:'2-digit' }),
          bg: boldBdayBGs[i % boldBdayBGs.length],
        }
      })

    if (!bdayItems.value.length) {
      bdayItems.value = buildBirthdaysDummy(filters.value.corte)
    }
  } catch (e) {
    console.warn('birthdays error:', e?.message || e)
    bdayItems.value = buildBirthdaysDummy(filters.value.corte)
  }
}


// ====== CATALOGOS ======
async function loadGroups() {
  try {
    const { data } = await api.get('/admin/groups', { params: { limit: 200 } })
    grupos.value = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
  } catch (e) {
    console.warn('No se pudieron cargar grupos (opcional):', e?.message || e)
    grupos.value = []
  }
}

// === DUMMY HELPERS ===
function getWeekDatesISO(baseISO) {
  const base = new Date(baseISO || new Date())
  const day = base.getDay() // 0=Dom
  const start = new Date(base); start.setDate(base.getDate() - day)
  const out = []
  for (let i=0; i<7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    out.push(d.toISOString().slice(0,10))
  }
  return out
}

const pastelBGs = [
  'from-amber-50 to-yellow-50',
  'from-indigo-50 to-sky-50',
  'from-rose-50 to-pink-50',
  'from-emerald-50 to-teal-50',
  'from-fuchsia-50 to-purple-50',
  'from-blue-50 to-cyan-50',
  'from-lime-50 to-green-50',
]

function buildAnnivDummy(weekISO) {
  const labels = ['D','L','M','M','J','V','S']
  const events = [
    { emoji: '🇨🇴', title: 'Independencia', subtitle: 'Efeméride nacional' },
    { emoji: '🛡️', title: 'Día del Guardia', subtitle: 'Reconocimiento' },
    { emoji: '🏥', title: 'Jornada de salud', subtitle: 'Prevención y cuidado' },
    { emoji: '🚔', title: 'Día de la Seguridad', subtitle: 'Campaña institucional' },
    { emoji: '🎗️', title: 'Conmemoración especial', subtitle: 'Sensibilización' },
    { emoji: '🏆', title: 'Reconocimiento interno', subtitle: 'Mejores desempeños' },
    { emoji: '🌱', title: 'Día Ambiental', subtitle: 'Sostenibilidad' },
  ]

  return weekISO.map((iso, i) => ({
    emoji: events[i]?.emoji || '📅',
    title: events[i]?.title || `Conmemoración ${labels[i]}`,
    subtitle: events[i]?.subtitle || 'Conmemoración',
    dateISO: iso,
    dateLabel: new Date(iso).toLocaleDateString('es-CO', { weekday:'short', month:'short', day:'2-digit' }),
    bg: pastelBGs[i % pastelBGs.length],
  }))
}

function buildBirthdaysDummy(baseISO) {
  const base = new Date(baseISO || new Date())
  const year = base.getFullYear()
  const month = base.getMonth()
  const people = [
    { name: 'María Fernanda', day: 2,  emoji: '🎂' },
    { name: 'Juan Pérez',     day: 8,  emoji: '🎉' },
    { name: 'Luisa Gómez',    day: 13, emoji: '🎁' },
    { name: 'Carlos Rojas',   day: 21, emoji: '🥳' },
    { name: 'Diana Torres',   day: 27, emoji: '🍰' },
    { name: 'Andrés Acosta',  day: 30, emoji: '🎈' },
  ]
  return people.map((p, i) => {
    const d = new Date(year, month, p.day)
    return {
      emoji: p.emoji,
      title: p.name,
      subtitle: `Cumple ${year - (year - 30) - (i % 5) + 25}`.replace('Cumple NaN', 'Cumple 30'),
      dateISO: d.toISOString().slice(0,10),
      dateLabel: d.toLocaleDateString('es-CO', { month:'short', day:'2-digit' }),
      bg: pastelBGs[(i+2) % pastelBGs.length],
    }
  })
}

// ====== RELOAD ======
async function reloadAll() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([
      loadOverview(),
      loadGroups(),
      loadKPIsSnapshot(),
      loadSeriesAndTop(),
      loadLeaderboards(),
      loadAnniversaries(),
      loadBirthdays(),
    ])
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || 'Error desconocido'
  } finally {
    loading.value = false
  }
}

onMounted(reloadAll)
</script>
