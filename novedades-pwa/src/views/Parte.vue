<template>
  <div class="min-h-screen bg-slate-50">
    <!-- HERO -->
    <div class="bg-gradient-to-r from-slate-800 to-slate-700">
      <div class="max-w-6xl mx-auto px-4 py-6 flex flex-wrap md:flex-nowrap items-center justify-between gap-4">
        <!-- Título -->
        <div class="flex-shrink-0">
          <h1 class="text-white text-2xl font-semibold">Parte</h1>
        </div>

        <!-- Controles -->
        <div class="flex flex-wrap justify-end md:justify-normal items-center gap-3 w-full md:w-auto">
          <input
            v-model="date"
            type="date"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white w-full sm:w-auto"
          />

          <!-- Ver SERVICIO -->
          <label class="flex items-center gap-2 text-slate-200 text-sm">
            <input
              type="checkbox"
              v-model="showServicio"
              class="accent-sky-400"
              @change="onToggleServicio"
            >
            SERVICIO
          </label>

          <!-- Ver AUSENTES -->
          <label class="flex items-center gap-2 text-slate-200 text-sm">
            <input
              type="checkbox"
              v-model="showOnlyNoCheck"
              class="accent-sky-400"
              @change="onToggleOnlyNoCheck"
            >
            AUSENTES
          </label>

          <!-- Botón Actualizar -->
          <button
            @click="refreshAll(false)"
            class="px-3 py-1.5 text-sm rounded-lg bg-white/90 border border-slate-200 hover:bg-white disabled:opacity-60 w-full sm:w-auto"
            :disabled="loading"
          >
            {{ loading ? 'Actualizando…' : 'Actualizar' }}
          </button>
        </div>
      </div>
    </div>


    <!-- FILTROS / KPIs -->
    <div class="max-w-6xl mx-auto px-4 py-4">
      <div v-if="isSuperLike" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <!-- KPI: FD esperado -->
        <section class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div class="text-xs text-slate-500">FUERZA DISPONIBLE</div>
          <div class="text-2xl font-semibold text-slate-800">
            {{ kpiFdEsperadoTriad[0] }}/{{ kpiFdEsperadoTriad[1] }}/{{ kpiFdEsperadoTriad[2] }}
          </div>
          <div class="text-xs text-slate-500 mt-1">{{ kpiFdEsperadoTotal }}</div>
        </section>

        <!-- KPI: Marcados (checks) -->
        <section class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div class="text-xs text-slate-500">PRESENTES</div>
          <div class="text-2xl font-semibold text-slate-800">
            {{ kpiMarcadosTriad[0] }}/{{ kpiMarcadosTriad[1] }}/{{ kpiMarcadosTriad[2] }} 
          </div>
          <div class="text-xs text-slate-500 mt-1">{{ kpiMarcadosTotal }}</div>
        </section>

        <!-- ✅ KPI: Ausentes -->
        <section class="bg-white rounded-xl border border-rose-200 p-4 shadow-sm">
          <div class="text-xs text-rose-600">AUSENTES</div>
          <div class="text-2xl font-semibold text-rose-600">
            {{ kpiAusentesTotal }}
          </div>
          <div class="text-xs text-slate-500 mt-1">
            {{ kpiAusentesTriad[0] }}/{{ kpiAusentesTriad[1] }}/{{ kpiAusentesTriad[2] }} (OF/ME/PT)
          </div>
          <div class="mt-3">
            <button
              class="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              :disabled="kpiAusentesTotal===0"
              @click="showAbsentModal = true"
            >
              Ver detalle
            </button>
          </div>
        </section>
      </div>
    </div>

    <!-- LISTAS POR GRUPO (sin unidades) -->
    <div class="max-w-6xl mx-auto px-4 pb-12 space-y-6">
      <div v-for="group in visibleGroupIds" :key="group" class="rounded-xl overflow-hidden border border-slate-200 shadow">
        <div
          class="flex items-center justify-between px-4 py-3 cursor-pointer transition"
          @click="toggleOpen(group)"
          :class="isGroupComplete(group) ? 'bg-green-50' : 'bg-rose-50'"
        >
          <div>
            <div class="font-semibold text-slate-800 text-lg">
              {{ groupCode(group) }}
            </div>

            <!-- Línea de contexto actual -->
            <div class="text-xs text-slate-700 font-medium">
              {{ showServicio ? 'SERVICIO' : (showOnlyNoCheck ? 'SIN NOVEDAD (faltantes)' : 'SIN NOVEDAD') }}
              {{ triadText(group) }} (OF/ME/PT)
            </div>

            <!-- NUEVO: FD esperado solo para super/supervisión/leader_group -->
            <div v-if="isSuperLike" class="text-[11px] text-slate-500 mt-0.5">
              FD esperado: {{ fdEsperadoTriadText(group) }}
            </div>
          </div>

          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 transition-transform"
              :class="isOpen(group) ? 'rotate-90' : ''" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div v-show="isOpen(group)" class="bg-white p-4">
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            <div
              v-for="a in agentRows(group)"
              :key="a.id"
              class="rounded-lg p-3 border"
              :class="cardColorUI(group, a)"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="font-semibold text-sm">
                    {{ a.code }} <span class="text-xs text-slate-500">({{ a.category }})</span>
                  </div>
                  <div class="text-xs text-slate-500">{{ a.nickname || '—' }}</div>
                  <div class="text-xs mt-1">Estado: <b>{{ a.status }}</b></div>
                  <div class="text-[11px] text-slate-500 truncate max-w-[220px] mt-0.5" :title="a.mt ? `Misión de trabajo: ${a.mt}` : '—'">
                    {{ a.mt || '—' }}
                  </div>
                </div>
                <div v-if="!showServicio && a.status === 'SIN NOVEDAD'">
                  <label class="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      class="accent-green-600"
                      :checked="isPresentUI(group,a.id)"
                      :disabled="isSaving.has(a.id)"
                      @change="onTogglePresent(group,a)"
                    >
                    Presente
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div v-if="dataset[group]?.noReport" class="text-center text-slate-500 py-3">
            No existe reporte creado para esta fecha.
          </div>
          <div v-else-if="agentRows(group).length === 0" class="text-center text-slate-500 py-3">
            No hay registros para este filtro.
          </div>
        </div>
      </div>
    </div>

    <!-- 🔍 Modal detalle ausentes -->
    <div v-if="showAbsentModal" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="showAbsentModal=false"></div>
      <div class="absolute inset-0 grid place-items-center p-4">
        <div class="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 class="font-semibold text-slate-800">Detalle de ausentes ({{ kpiAusentesTotal }})</h3>
            <button class="text-slate-500 hover:text-slate-700" @click="showAbsentModal=false">Cerrar</button>
          </div>
          <div class="px-4 py-3 max-h-[70vh] overflow-auto">
            <div v-if="absentRows.length === 0" class="text-sm text-slate-500">No hay ausentes.</div>

            <table v-else class="w-full text-sm">
              <thead class="text-left text-slate-500">
                <tr>
                  <th class="py-2 pr-3">Grupo</th>
                  <th class="py-2 pr-3">Código</th>
                  <th class="py-2 pr-3">Nickname</th>
                  <th class="py-2 pr-3">Categoría</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in absentRows" :key="row.gid + '-' + row.id" class="border-t">
                  <td class="py-2 pr-3">{{ row.group }}</td>
                  <td class="py-2 pr-3">{{ row.code }}</td>
                  <td class="py-2 pr-3">{{ row.nickname || '—' }}</td>
                  <td class="py-2 pr-3">{{ row.category }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="px-4 py-3 border-t border-slate-200 text-right">
            <button class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50" @click="showAbsentModal=false">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
    <!-- /Modal -->
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { http } from '../lib/http'

const me = ref(null)
const date = ref(new Date().toISOString().slice(0,10))
const showServicio = ref(false)
const showOnlyNoCheck = ref(false)
const loading = ref(false)
const isSaving = ref(new Set())
const showAbsentModal = ref(false)

const groups = ref([])
const selectedGroups = reactive(new Set())
const openAcc = reactive({})

// gid -> { sinNovedadEsperados:Set<number>, servicio:Set<number>, checked:Set<number>, reportIdByAgent:Map, agentsById:Map, noReport:boolean }
const dataset = reactive({})
const uiUnchecks = reactive({}) // gid -> Set(agentId)
const getUiSet = (gid) => (uiUnchecks[gid] || (uiUnchecks[gid] = new Set()))
function markUiUnchecked(gid, agentId) { getUiSet(gid).add(agentId) }
function clearUiUnchecked(gid, agentId) { getUiSet(gid).delete(agentId) }

const isSuperLike = computed(() =>
  ['superadmin','supervision','leader_group'].includes(String(me.value?.role||'').toLowerCase())
)
const myGroupCode = computed(() => groups.value.find(g=>g.id===me.value?.groupId)?.code || null)
const visibleGroupIds = computed(() => isSuperLike.value ? [...selectedGroups] : [me.value?.groupId])
const groupCode = gid => groups.value.find(g=>g.id===gid)?.code || gid

const isOpen = gid => !!openAcc[gid]
const toggleOpen = gid => openAcc[gid] = !isOpen(gid)

const sinNovExpected = gid => dataset[gid]?.sinNovedadEsperados?.size || 0
const presentCountUI = gid => {
  const box = dataset[gid]; if (!box) return 0
  let c = 0
  for (const id of box.sinNovedadEsperados) if (box.checked.has(id)) c++
  return c
}
const isGroupComplete = gid => presentCountUI(gid) > 0 && presentCountUI(gid) === sinNovExpected(gid)

/* ---------- Helpers de categoría y orden ---------- */
function normalizeCat(raw) {
  const s = String(raw || '').toUpperCase().trim()
  if (s.startsWith('OF')) return 'OF'
  if (s === 'ME' || s === 'SO' || s.startsWith('SUB')) return 'ME' // SO/Suboficial → ME
  return 'PT'
}
const catRank = c => (c === 'OF' ? 0 : c === 'ME' ? 1 : 2)
const codeNum = code => {
  const m = String(code||'').match(/\d+/)
  return m ? Number(m[0]) : 0
}

function fdEsperadoTriadText(gid) {
  const t = triadEsperadosByGroup(gid) // [OF, ME, PT]
  const total = (t[0] + t[1] + t[2]) || 0
  return `${t[0]}/${t[1]}/${t[2]} (Total: ${total})`
}

function ensureGroupBox(gid) {
  if (!dataset[gid]) {
    dataset[gid] = {
      noReport: false,
      sinNovedadEsperados: new Set(),
      servicio: new Set(),
      checked: new Set(),
      reportIdByAgent: new Map(),
      agentsById: new Map()
    }
  }
  return dataset[gid]
}
function clearGroupBox(box) {
  box.noReport = false
  box.sinNovedadEsperados.clear()
  box.servicio.clear()
  box.checked.clear()
  box.reportIdByAgent.clear()
  box.agentsById.clear()
}


/* ---------- Pintado por checked ---------- */
function isPresentUI(gid, agentId) {
  const box = dataset[gid]
  if (!box) return false
  const serverChecked = box.checked.has(agentId)
  const forcedUncheck = getUiSet(gid).has(agentId)
  return serverChecked && !forcedUncheck
}

function cardColorUI(gid, a) {
  if (a.status !== 'SIN NOVEDAD') return 'bg-white'
  return isPresentUI(gid, a.id)
    ? 'bg-green-50 border-green-200'
    : 'bg-rose-50 border-rose-200'
}

/* ---------- Listado (filtros + orden OF/ME/PT + número) ---------- */
const agentRows = gid => {
  const box = dataset[gid]
  if (!box || box.noReport) return []    
  const list = [...box.agentsById.values()]

  let filtered = []
  if (showServicio.value) {
    filtered = list.filter(a => a.status === 'SERVICIO')
  } else {
    filtered = list.filter(a => a.status === 'SIN NOVEDAD')
    if (showOnlyNoCheck.value) filtered = filtered.filter(a => !isPresentUI(gid, a.id))
  }

  filtered.sort((x, y) => {
    const cx = catRank(normalizeCat(x.category))
    const cy = catRank(normalizeCat(y.category))
    if (cx !== cy) return cx - cy
    const nx = codeNum(x.code), ny = codeNum(y.code)
    if (nx !== ny) return nx - ny
    return String(x.code).localeCompare(String(y.code))
  })

  return filtered
}

/* ---------- KPIs / Triadas ---------- */
function triadEsperadosByGroup(gid) {
  const box = dataset[gid]; const out = [0,0,0]
  if (!box) return out
  for (const id of box.sinNovedadEsperados) {
    const a = box.agentsById.get(id); if (!a) continue
    out[catRank(normalizeCat(a.category))]++
  }
  return out
}
function triadPresentesByGroupUI(gid) {
  const box = dataset[gid]; const out = [0,0,0]
  if (!box) return out
  for (const id of box.sinNovedadEsperados) {
    if (!box.checked.has(id)) continue
    const a = box.agentsById.get(id); if (!a) continue
    out[catRank(normalizeCat(a.category))]++
  }
  return out
}
function triadServicioByGroup(gid) {
  const box = dataset[gid]; const out = [0,0,0]
  if (!box) return out
  for (const id of box.servicio) {
    const a = box.agentsById.get(id); if (!a) continue
    out[catRank(normalizeCat(a.category))]++
  }
  return out
}

function triadAusentesByGroup(gid) {
  const need = triadEsperadosByGroup(gid)
  const have = triadPresentesByGroupUI(gid)
  return [
    Math.max(need[0]-have[0], 0),
    Math.max(need[1]-have[1], 0),
    Math.max(need[2]-have[2], 0)
  ]
}

function triadText(gid) {
  if (showServicio.value) {
    const t = triadServicioByGroup(gid)
    return ` ${t[0]}/${t[1]}/${t[2]}`
  }
  if (showOnlyNoCheck.value) {
    const need = triadEsperadosByGroup(gid)
    const have = triadPresentesByGroupUI(gid)
    return ` ${Math.max(need[0]-have[0],0)}/${Math.max(need[1]-have[1],0)}/${Math.max(need[2]-have[2],0)}`
  }
  const t = triadPresentesByGroupUI(gid)
  return ` ${t[0]}/${t[1]}/${t[2]}`
}

const kpiFdEsperadoTotal = computed(() =>
  visibleGroupIds.value.reduce((acc, gid) => {
    const box = dataset[gid]
    if (!box || box.noReport) return acc
    return acc + box.sinNovedadEsperados.size
  }, 0)
)

const kpiMarcadosTotal = computed(() =>
  visibleGroupIds.value.reduce((acc, gid) => {
    const box = dataset[gid]
    if (!box || box.noReport) return acc
    let c = 0
    for (const id of box.sinNovedadEsperados) if (box.checked.has(id)) c++
    return acc + c
  }, 0)
)

const kpiFdEsperadoTriad = computed(() => {
  const out = [0,0,0]
  for (const gid of visibleGroupIds.value) {
    const t = triadEsperadosByGroup(gid)
    out[0]+=t[0]; out[1]+=t[1]; out[2]+=t[2]
  }
  return out
})
const kpiMarcadosTriad = computed(() => {
  const out = [0,0,0]
  for (const gid of visibleGroupIds.value) {
    const t = triadPresentesByGroupUI(gid)
    out[0]+=t[0]; out[1]+=t[1]; out[2]+=t[2]
  }
  return out
})

/* ✅ Nuevos KPIs: AUSENTES */
const kpiAusentesTotal = computed(() => kpiFdEsperadoTotal.value - kpiMarcadosTotal.value)
const kpiAusentesTriad = computed(() => {
  const out = [0,0,0]
  for (const gid of visibleGroupIds.value) {
    const t = triadAusentesByGroup(gid)
    out[0]+=t[0]; out[1]+=t[1]; out[2]+=t[2]
  }
  return out
})

/* ✅ Listado para el modal de ausentes */
const absentRows = computed(() => {
  const rows = []
  for (const gid of visibleGroupIds.value) {
    const box = dataset[gid]
    if (!box || box.noReport) continue
    for (const id of box.sinNovedadEsperados) {
      if (box.checked.has(id)) continue
      const a = box.agentsById.get(id)
      if (!a) continue
      rows.push({
        gid,
        id,
        group: groupCode(gid),
        code: a.code,
        nickname: a.nickname || null,
        category: a.category
      })
    }
  }
  // Orden: Grupo, categoría (OF/ME/PT), número de código
  rows.sort((x,y) => {
    const gc = String(x.group).localeCompare(String(y.group))
    if (gc !== 0) return gc
    const cx = catRank(normalizeCat(x.category)), cy = catRank(normalizeCat(y.category))
    if (cx !== cy) return cx - cy
    const nx = codeNum(x.code), ny = codeNum(y.code)
    if (nx !== ny) return nx - ny
    return String(x.code).localeCompare(String(y.code))
  })
  return rows
})

/* ---------- Carga de datos ---------- */
function resetDataset() { for (const k of Object.keys(dataset)) delete dataset[k] }

async function loadMe() {
  const { data } = await http.get('/me')
  me.value = data
}
async function loadGroups() {
  const { data } = await http.get('/admin/groups')
  groups.value = data
  if (isSuperLike.value) data.forEach(g=>selectedGroups.add(g.id))
  else selectedGroups.add(me.value?.groupId)
}

async function syncGroup(gid) {
  const box = ensureGroupBox(gid)

  // 0) ¿Existe reporte?
  const { data: ex } = await http.get('/admin/report/exists', {
    params: { groupId: gid, date: date.value }
  })

  if (!ex.exists) {
    clearGroupBox(box)
    box.noReport = true
    return
  }

  // 1) Hay reporte ⇒ limpia y continúa poblando
  clearGroupBox(box)

  // 2) Base de estados por día (FD / Servicio)
  const { data: streaks } = await http.get('/admin/agents-streaks', {
    params: { groupId: gid, date: date.value, page: 1, pageSize: 2000 }
  })
  for (const it of (streaks.items || [])) {
    const a = {
      id: it.agentId,
      code: it.code,
      nickname: it.nickname || null,
      category: it.category,
      status: (it.status || '').toUpperCase()
    }
    box.agentsById.set(a.id, a)
    if (a.status === 'SIN NOVEDAD') box.sinNovedadEsperados.add(a.id)
    if (a.status === 'SERVICIO')    box.servicio.add(a.id)
  }

  // 3) Detalle con checked y (opcional) reportId
  const { data: det } = await http.get('/admin/report/detail', {
    params: { groupId: gid, date: date.value, ts: Date.now() }
  })

  for (const r of (det.items || [])) {
    const a = {
      id: r.agentId,
      code: r.code,
      nickname: r.nickname || null,
      category: r.category,
      status: (r.state || '').toUpperCase(),
      mt: r.mt || r.mt_report || r.mt_agent || null
    };
    box.agentsById.set(a.id, a);

    if (a.status === 'SIN NOVEDAD') {
      box.sinNovedadEsperados.add(a.id);
      if (r.checked === 1 || r.checked === true) box.checked.add(a.id);
    }
    if (a.status === 'SERVICIO') box.servicio.add(a.id);
    if (r.reportId) box.reportIdByAgent.set(a.id, r.reportId);
  }
}

async function refreshAll (silent = false) {
  try {
    if (!silent) loading.value = true
    const gids = visibleGroupIds.value
    for (const gid of gids) await syncGroup(gid)
  } finally {
    if (!silent) loading.value = false
  }
}

/* ---------- Mount & watchers (sin timers) ---------- */
onMounted(async () => {
  await loadMe()
  await loadGroups()
  await refreshAll(false)
})

watch(date, async () => {
  resetDataset()
  await refreshAll(false)
})
watch(visibleGroupIds, async () => {
  resetDataset()
  await refreshAll(true)
})

function ensureIso(d) {
  const s = String(d || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date().toISOString().slice(0,10)
}

async function onTogglePresent(gid, a) {
  const box = dataset[gid]; if (!box) return
  const currentlyChecked = box.checked.has(a.id)
  const nextVal = currentlyChecked ? 0 : 1

  try {
    isSaving.value.add(a.id)

    await http.put('/admin/report/check', {
      date: ensureIso(date.value),
      agentId: a.id,
      check: nextVal
    })

    if (nextVal === 1) {
      clearUiUnchecked(gid, a.id)
      box.checked.add(a.id)
    } else {
      markUiUnchecked(gid, a.id)
      box.checked.delete(a.id)
    }
  } catch (e) {
    console.error('Toggle check error', e)
  } finally {
    isSaving.value.delete(a.id)
  }
}

/* ---------- Exclusión de filtros ---------- */
function onToggleServicio() {
  if (showServicio.value) showOnlyNoCheck.value = false
}
function onToggleOnlyNoCheck() {
  if (showOnlyNoCheck.value) showServicio.value = false
}
</script>
