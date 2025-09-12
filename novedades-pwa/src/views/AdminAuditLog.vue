<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold text-lg sm:text-2xl">Log de eventos</h1>
        <div class="text-sm text-slate-600">Solo superadmin</div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-2 sm:px-4 py-6 space-y-4">
      <!-- Filtros (mismo layout) -->
      <div class="card">
        <div class="card-body grid grid-cols-1 sm:grid-cols-6 gap-3">
          <div>
            <label class="label">Desde</label>
            <input type="date" v-model="filters.from" class="input" />
          </div>
          <div>
            <label class="label">Hasta</label>
            <input type="date" v-model="filters.to" class="input" />
          </div>
          <div>
            <label class="label">Acción</label>
            <select v-model="filters.action" class="input">
              <option value="">Todas</option>
              <option v-for="a in actions" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
          <div>
            <label class="label">Usuario</label>
            <input type="text" v-model="filters.username" class="input" placeholder="Usuario a buscar" />
          </div>

          <div class="sm:col-span-6 flex gap-2">
            <button class="btn-primary" @click="fetchData(1)">Aplicar filtros</button>
            <button class="btn-ghost" @click="resetFilters">Limpiar</button>
          </div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="card">
        <div class="card-body p-0 overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr>
                <th class="whitespace-nowrap">Fecha/Hora</th>
                <th>Acción</th>
                <th>Resumen</th>
                <th>Usuario</th>
                <th>IP</th>
                <th class="whitespace-nowrap">User Agent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
  <tr v-for="item in items" :key="item.id">
    <td class="align-top text-slate-700">
      {{ formatDate(item.created_at_ts ?? item.created_at) }}
            </td>

            <td class="align-top">
            <span :class="['badge', actionStyle(item.action)]">
                <span class="mr-1">{{ actionIcon(item.action) }}</span>
                {{ mapAction(item.action).label }}
            </span>
            </td>

            <td class="align-top">
            <!-- Resumen principal -->
            <div class="text-slate-900">{{ summarize(item) }}</div>

            <!-- Pill con agente (si viene en details) -->
            <div v-if="details(item)?.agentCode" class="mt-1">
                <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z"/></svg>
                Agente: {{ details(item).agentCode }}
                <span v-if="details(item).agentCategory" class="opacity-70">· {{ details(item).agentCategory }}</span>
                </span>
            </div>

            <!-- Chips con contexto del reporte (opcionales) -->
            <div
                v-if="details(item)?.reportDate || details(item)?.groupId || details(item)?.unitId"
                class="mt-1 flex flex-wrap gap-1.5"
            >
                <span v-if="details(item).reportDate" class="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-200">
                Fecha: {{ details(item).reportDate }}
                </span>
                <span v-if="details(item).groupId != null" class="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-200">
                Grupo: {{ details(item).groupId }}
                </span>
                <span v-if="details(item).unitId != null" class="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-200">
                Unidad: {{ details(item).unitId }}
                </span>
            </div>

            <!-- Línea extra específica (tu lógica actual) -->
            <div class="text-xs text-slate-500 mt-1" v-if="extraLine(item)">{{ extraLine(item) }}</div>
            </td>

            <td class="align-top">
            <div class="text-slate-900">{{ item.username || '—' }}</div>
            <div class="text-xs text-slate-500">Rol: {{ item.userRole || '—' }}</div>
            </td>

            <td class="align-top">{{ item.ip || '—' }}</td>
            <td class="align-top truncate max-w-[220px]">{{ item.user_agent || '—' }}</td>

            <td class="align-top text-right">
            <button class="btn-ghost" @click="openDetails(item)">Ver</button>
            </td>
        </tr>

        <tr v-if="!loading && !items.length">
            <td colspan="7" class="text-center py-6 text-slate-500">Sin resultados</td>
        </tr>
</tbody>

          </table>
        </div>

        <!-- Paginación -->
        <div class="p-3 flex items-center justify-between text-sm text-slate-600">
          <div>Total: <b>{{ total }}</b></div>
          <div class="flex items-center gap-2">
            <button class="btn-ghost" :disabled="page<=1" @click="fetchData(page-1)">«</button>
            <div>Página <b>{{ page }}</b></div>
            <button class="btn-ghost" :disabled="page*pageSize>=total" @click="fetchData(page+1)">»</button>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal detalles -->
    <div v-if="detailsItem" class="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="font-semibold">Detalles ({{ mapAction(detailsItem.action).label }})</div>
          <button class="btn-ghost" @click="detailsItem=null">Cerrar</button>
        </div>
        <pre class="text-xs bg-slate-50 rounded p-3 overflow-auto max-h-[60vh]">{{ pretty(details(detailsItem)) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { http as axios } from '@/lib/http'

const actionOptions = [
  { value: '',                 label: 'Todas',                 icon: '•'   },
  { value: 'LOGIN',            label: 'Inicio de sesión',      icon: '🔑'  },
  { value: 'LOGOUT',           label: 'Cierre de sesión',      icon: '⎋'   },
  { value: 'ACCOUNT_LOCK',     label: 'Bloqueo temporal',      icon: '⏳'  },
  { value: 'ACCOUNT_HARD_LOCK',label: 'Bloqueo',          icon: '🔒'  },
  { value: 'ACCOUNT_UNLOCK',   label: 'Desbloqueo de cuenta',  icon: '🔓'  },
  { value: 'REPORT_CREATE',    label: 'Registro de reporte',   icon: '📝'  },
  { value: 'REPORT_UPDATE',    label: 'Edición de reporte',    icon: '✏️'  },
  { value: 'EXCEL_DOWNLOAD',   label: 'Descarga Excel',        icon: '📊'  },
  { value: 'USER_CREATE',      label: 'Creación de usuario',   icon: '👤➕' },
  { value: 'USER_PASSWORD_CHANGE', label: 'Cambio de contraseña', icon: '🔒' },
  { value: 'USER_ROLE_CHANGE', label: 'Cambio de rol',         icon: '🎛'  },
  { value: 'AGENT_CREATE',     label: 'Creación de agente',    icon: '🧑‍✈️➕' },
  { value: 'AGENT_UPDATE',     label: 'Edición de agente',     icon: '🧑‍✈️✏' },
  { value: 'GROUP_CREATE',     label: 'Creación de grupo',     icon: '🧩'  },
  { value: 'UNIT_CREATE',      label: 'Creación de unidad',    icon: '🏷️'  },
]
/* para el <select> clásico del layout */
const actions = actionOptions.filter(o => o.value).map(o => o.value)

const filters = ref({ from:'', to:'', action:'', username:'' })
const items = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const loading = ref(false)
const detailsItem = ref(null)

function mapAction(value) { return actionOptions.find(o => o.value === value) || actionOptions[0] }
function actionStyle(a){
  switch (a) {
    case 'LOGIN': return 'badge-green'
    case 'LOGOUT': return 'badge-slate'
    case 'ACCOUNT_LOCK': return 'badge-amber'
    case 'ACCOUNT_HARD_LOCK': return 'badge-red'
    case 'ACCOUNT_UNLOCK': return 'badge-lime'
    case 'REPORT_CREATE': return 'badge-blue'
    case 'REPORT_UPDATE': return 'badge-amber'
    case 'EXCEL_DOWNLOAD': return 'badge-emerald'
    case 'USER_CREATE': return 'badge-purple'
    case 'USER_PASSWORD_CHANGE': return 'badge-orange'
    case 'USER_ROLE_CHANGE': return 'badge-violet'
    case 'AGENT_CREATE': return 'badge-teal'
    case 'AGENT_UPDATE': return 'badge-cyan'
    case 'GROUP_CREATE': return 'badge-indigo'
    case 'UNIT_CREATE': return 'badge-indigo'
    default: return 'badge-slate'
  }
}
function actionIcon(a){ return mapAction(a).icon }

function formatDate(val){
  if (!val && val !== 0) return '—'
  const d = typeof val === 'number' ? new Date(val) : new Date(String(val))
  return d.toLocaleString()
}
function pretty(obj){ try{ return JSON.stringify(obj||{}, null, 2)}catch{ return String(obj)} }
function resetFilters(){ filters.value = { from:'', to:'', action:'', username:'' }; fetchData(1) }
function openDetails(item){ detailsItem.value = item }

// details & resúmenes
function safeParse(v){ try{ return typeof v==='string' ? JSON.parse(v) : (v||null) }catch{ return null } }
function details(item){ return safeParse(item?.details) }

function summarize(item) {
  const d = details(item) || {}
  const actor = item.username ? `@${item.username}` : 'usuario'
  switch (item.action) {
    case 'LOGIN':  return `Inicio de sesión de ${actor}`
    case 'LOGOUT': return `Cierre de sesión de ${actor}`

     case 'ACCOUNT_LOCK': {
      const mins = d.minutes ? `${d.minutes} min` : (d.lock_until ? 'hasta ' + d.lock_until : '')
      const who  = d.targetUserId ? `ID ${d.targetUserId}` : (d.username ? '@' + d.username : 'cuenta')
      return `Bloqueo temporal de ${who}${mins ? ' · ' + mins : ''}${d.reason ? ' · ' + d.reason : ''}`
    }
    case 'ACCOUNT_HARD_LOCK': {
      const who  = d.targetUserId ? `ID ${d.targetUserId}` : (d.username ? '@' + d.username : 'cuenta')
      return `Bloqueo de ${who}${d.reason ? ' · ' + d.reason : ''}`
    }
        case 'ACCOUNT_UNLOCK': {
        const who = d.username ? `@${d.username}` 
                    : (d.targetUserId ? `ID ${d.targetUserId}` : 'cuenta')
        return `Desbloqueo de ${who}`
        }
    case 'REPORT_CREATE': {
      const rid = d.reportId ? `#${d.reportId}` : ''
      const date = d.reportDate || ''
      const g = d.groupId != null ? `grupo ${d.groupId}` : ''
      const u = d.unitId  != null ? `unidad ${d.unitId}` : ''
      const n = Array.isArray(d.agents) ? d.agents.length : (d.agentsCount ?? '')
      const parts = [rid, date, g, u, n ? `${n} agentes` : ''].filter(Boolean)
      return `Registro de reporte ${parts.join(' · ')}`
    }
    case 'REPORT_UPDATE': {
      const rid = d.reportId ? `#${d.reportId}` : ''
      const code = d.agentCode || d.code || ''
      const st = d.state || d?.changes?.state
      const base = `Actualizó reporte ${rid}${code ? ` para agente ${code}` : ''}`
      return st ? `${base} · estado: ${st}` : base
    }
    case 'EXCEL_DOWNLOAD': {
      const date = d.date || ''
      const g = d.groupId != null ? `grupo ${d.groupId}` : ''
      const u = d.unitId  != null ? `unidad ${d.unitId}` : ''
      const parts = [date, g, u].filter(Boolean)
      return `Descargó Excel${parts.length ? ' · ' + parts.join(' · ') : ''}`
    }
    case 'USER_CREATE':           return `Creó usuario ${d.username ? '@'+d.username : 'nuevo usuario'}${d.role ? ' · rol '+d.role : ''}`
    case 'USER_PASSWORD_CHANGE':  return `Cambio de contraseña de usuario${d.by ? ` (${d.by})` : ''}`
    case 'USER_ROLE_CHANGE':      return `Cambio de rol de usuario${d.oldRole || d.newRole ? `: ${d.oldRole || '—'} → ${d.newRole || '—'}` : ''}`
    case 'AGENT_CREATE':          return `Creó agente ${d.code || 'sin código'}${d.category ? ' · '+d.category : ''}`
    case 'AGENT_UPDATE': {
      const code = d?.changes?.code || d.code
      const keys = d?.changes ? Object.keys(d.changes).filter(k => k !== 'code') : []
      return `Editó agente ${code || ''}${keys.length ? ` · campos: ${keys.join(', ')}` : ''}`
    }
    case 'GROUP_CREATE':          return `Creó grupo ${d.code || 'nuevo'}`
    case 'UNIT_CREATE':           return `Creó unidad ${d.name || 'nueva'}${d.groupId != null ? ' · grupo '+d.groupId : ''}`
    default:                      return 'Evento'
  }
}
function extraLine(item) {
  const d = details(item) || {}
  if (item.action === 'REPORT_UPDATE') {
    const segs = []
    if (d.municipalityId) segs.push(`municipio ${d.municipalityId}`)
    if (d.novelty_start) segs.push(`inicio ${d.novelty_start}`)
    if (d.novelty_end) segs.push(`fin ${d.novelty_end}`)
    if (d.novelty_description) segs.push(`"${String(d.novelty_description).slice(0,50)}${String(d.novelty_description).length>50?'…':''}"`)
    return segs.join(' · ') || null
  }
  return null
}

// fetch
async function fetchData(p = 1) {
  loading.value = true
  page.value = p
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    Object.entries(filters.value).forEach(([k, v]) => { if (v !== '' && v != null) params[k] = v })
    const { data } = await axios.get('/admin/audit', { params })
    items.value = data.items || []
    total.value = data.total || 0
  } catch (e) {
    console.error('AUDIT LIST ERROR', e)
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// por defecto: últimos 7 días
onMounted(() => {
  const t = new Date()
  const from = new Date(t); from.setDate(from.getDate() - 6)
  filters.value.from = from.toISOString().slice(0,10)
  filters.value.to   = t.toISOString().slice(0,10)
  fetchData(1)
})
</script>

<style scoped>
.badge { @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium; }
.badge-slate   { @apply bg-slate-100 text-slate-700; }
.badge-green   { @apply bg-green-100 text-green-700; }
.badge-blue    { @apply bg-blue-100 text-blue-700; }
.badge-amber   { @apply bg-amber-100 text-amber-800; }
.badge-emerald { @apply bg-emerald-100 text-emerald-700; }
.badge-purple  { @apply bg-purple-100 text-purple-700; }
.badge-violet  { @apply bg-violet-100 text-violet-700; }
.badge-teal    { @apply bg-teal-100 text-teal-700; }
.badge-cyan    { @apply bg-cyan-100 text-cyan-700; }
.badge-indigo  { @apply bg-indigo-100 text-indigo-700; }
.badge-red   { @apply bg-red-100 text-red-700; }
.badge-lime  { @apply bg-lime-100 text-lime-700; }
</style>
