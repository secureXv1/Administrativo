<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold text-lg sm:text-2xl">Log de eventos</h1>
        <div class="text-sm text-slate-600">Solo superadmin</div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-2 sm:px-4 py-6 space-y-4">
      <!-- Filtros -->
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
            <label class="label">Usuario (ID)</label>
            <input type="number" v-model="filters.userId" class="input" placeholder="Ej. 12" />
          </div>
          <div class="sm:col-span-2">
            <label class="label">Buscar texto</label>
            <input v-model="filters.search" class="input" placeholder="IP, UA, contenido de details..." />
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
                <th>Usuario</th>
                <th>IP</th>
                <th class="whitespace-nowrap">User Agent</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id">
                <td class="align-top">{{ formatDate(item.created_at) }}</td>
                <td class="align-top font-semibold">{{ item.action }}</td>
                <td class="align-top">
                  <div class="text-slate-900">{{ item.username || '—' }}</div>
                  <div class="text-xs text-slate-500">ID: {{ item.userId || '—' }} · Rol: {{ item.userRole || '—' }}</div>
                </td>
                <td class="align-top">{{ item.ip || '—' }}</td>
                <td class="align-top truncate max-w-[220px]">{{ item.user_agent || '—' }}</td>
                <td class="align-top">
                  <button class="btn-ghost" @click="openDetails(item)">Ver</button>
                </td>
              </tr>
              <tr v-if="!loading && !items.length">
                <td colspan="6" class="text-center py-6 text-slate-500">Sin resultados</td>
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
          <div class="font-semibold">Detalles ({{ detailsItem.action }})</div>
          <button class="btn-ghost" @click="detailsItem=null">Cerrar</button>
        </div>
        <pre class="text-xs bg-slate-50 rounded p-3 overflow-auto max-h-[60vh]">{{ pretty(detailsItem.details) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { http as axios } from '@/lib/http' // tu wrapper

const actions = [
  'LOGIN','LOGOUT','REPORT_CREATE','REPORT_UPDATE','EXCEL_DOWNLOAD',
  'USER_CREATE','USER_PASSWORD_CHANGE','USER_ROLE_CHANGE',
  'AGENT_CREATE','AGENT_UPDATE','GROUP_CREATE','UNIT_CREATE'
]

const filters = ref({
  from: '',
  to: '',
  action: '',
  userId: '',
  search: ''
})

const items = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const loading = ref(false)
const detailsItem = ref(null)

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleString()
}

function pretty(obj) {
  try { return JSON.stringify(obj || {}, null, 2) } catch { return String(obj) }
}

function resetFilters() {
  filters.value = { from: '', to: '', action: '', userId: '', search: '' }
  fetchData(1)
}

async function fetchData(p = 1) {
  loading.value = true
  page.value = p
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value
    }
    Object.entries(filters.value).forEach(([k,v]) => { if (v !== '' && v != null) params[k]=v })
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

function openDetails(item) {
  detailsItem.value = item
}

onMounted(() => fetchData(1))
</script>
