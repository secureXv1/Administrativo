<template>
  <div class="relative rounded-xl overflow-hidden">
    <!-- controles -->
    <div class="absolute top-2 left-2 z-[500] flex gap-2">
      <button @click="reload" class="px-2 py-1 rounded bg-white/90 text-slate-700 text-xs border hover:bg-white">
        Refrescar
      </button>
      <!--button @click="fitAll" class="px-2 py-1 rounded bg-white/90 text-slate-700 text-xs border hover:bg-white">
        Ajustar
      </button-->
      <span v-if="loading" class="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs">Cargando…</span>
      <span v-else-if="error" class="px-2 py-1 rounded bg-red-100 text-red-700 text-xs">Error</span>
      <span v-else class="px-2 py-1 rounded bg-white/90 text-slate-600 text-xs border">Pts: {{ locations.length }}</span>
    </div>

    <!-- mapa -->
    <div ref="mapEl" class="w-full h-[300px]"></div>

    <!-- leyenda >
    <div class="absolute bottom-2 left-2 z-[500] px-2 py-1 rounded bg-white/90 text-[11px] text-slate-700 border">
      <div class="flex items-center gap-2">
        <span class="marker-dot bg-emerald-500"></span> Activo
        <span class="marker-dot bg-amber-500 ml-3"></span> Permiso
        <span class="marker-dot bg-rose-500 ml-3"></span> Ausente
      </div>
    </div-->
  </div>
</template>

<script setup>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'

const props = defineProps({
  // fecha de corte (YYYY-MM-DD)
  dateISO: { type: String, default: () => new Date().toISOString().slice(0,10) },
  // limitar por grupo (opcional)
  groupId: { type: [String, Number], default: '' },
  // cada cuánto refrescar
  refreshMs: { type: Number, default: 15000 },
  // cuántos días hacia atrás mirar en fallback
  lookbackDays: { type: Number, default: 7 },
  // endpoint principal tipo "latest" (igual AdminDashboard)
  endpoint: { type: String, default: '/admin/agents-locations-latest' }
})

/** Axios con token */
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE || '' })
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) cfg.headers.Authorization = 'Bearer ' + t
  return cfg
})

/** Prefijo seguro /api si no estás usando VITE_API_BASE ni proxy */
function ep(path) {
  if (!path) return '/'
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return path.startsWith('/') ? path : `/${path}`
}

const mapEl = ref(null)
let map, markersLayer, timerId

const loading   = ref(false)
const error     = ref('')
const locations = ref([]) // [{id,name,lat,lng,status,ts,unitName}]

/** ===== Utils robustos para adaptarse a distintos shapes ===== */
const pick = (...vals) => vals.find(v => v !== undefined && v !== null)
function parseTs(r){
  const raw = pick(r.updated_at, r.updatedAt, r.ts, r.time, r.created_at, r.createdAt, r.date, r.last_seen)
  return raw ? new Date(raw) : null
}
function parseLat(r){
  return Number(pick(r.last_lat, r.lat, r.latitude, r.lat_dec, r.geo_lat, r.latitud, r.location?.lat))
}
function parseLng(r){
  return Number(pick(
    r.last_lng, r.lng, r.lon,              // << añade r.lon
    r.longitude, r.lon_dec,
    r.geo_lng, r.longitud,
    r.location?.lng
  ))
}

function parseName(r){
  return pick(r.nickname, r.name, r.agentName, r.agent?.nickname, r.code, `Agente ${r.agentId||r.id||''}`)
}
function parseUnit(r){
  return pick(r.unitName, r.unit, r.unitCode, r.unit_label, r.groupCode, r.group)
}
function parseStatus(r){
  const s = String(pick(r.status, r.state, r.current_status, r.agentStatus, r.novedad, r.last_status) || '').toUpperCase()
  if (s.includes('PERMISO') || s === 'SO') return 'PERMISO'
  if (s === 'PT' || s.includes('AUSEN')) return 'AUSENTE'
  return 'ACTIVE'
}
function statusColor(s){
  if (s==='PERMISO') return { stroke:'#f59e0b', fill:'#fbbf24' } // amber
  if (s==='AUSENTE') return { stroke:'#e11d48', fill:'#fb7185' } // rose
  return { stroke:'#059669', fill:'#34d399' }                    // emerald
}
function pointStyle(person){
  const c = statusColor(person.status)
  return {
    radius: 6,
    color: c.stroke,
    weight: 2,
    fillColor: c.fill,
    fillOpacity: 0.9
  }
}

// ~0.001° ≈ 111 m. Ajusta si quieres más/menos “pegados”
const GRID = 0.001

function gridKey(lat, lng){
  const rl = Math.round(lat / GRID) * GRID
  const rg = Math.round(lng / GRID) * GRID
  // limitar a 6 decimales para evitar ruido
  return `${rl.toFixed(6)},${rg.toFixed(6)}`
}

function clusterize(list){
  const clusters = new Map()
  for (const p of list){
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    const key = gridKey(p.lat, p.lng)
    if (!clusters.has(key)){
      clusters.set(key, { 
        lat: p.lat, 
        lng: p.lng, 
        items: [] 
      })
    }
    clusters.get(key).items.push(p)
  }
  return Array.from(clusters.values())
}

function popupHTML(cluster){
  // agrupar por grupo (fallback a Unidad o “—”)
  const byGroup = new Map()
  for (const a of cluster.items){
    const g = a.group || a.unitName || '—'
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g).push(a)
  }

  // ordenar grupos alfabéticamente y dentro por nombre
  const groups = Array.from(byGroup.entries())
    .sort((a,b)=> String(a[0]||'').localeCompare(String(b[0]||'')))
    .map(([g, arr]) => {
      arr.sort((x,y)=> String(x.name||'').localeCompare(String(y.name||'')))
      const lis = arr.map(x => {
        const s = x.status || '—'
        return `<li>${String(x.name||'Agente').replace(/</g,'&lt;')} <span class="text-slate-500">(${s})</span></li>`
      }).join('')
      return `
        <div class="mb-2">
          <div class="font-semibold text-slate-700">${g} <span class="text-slate-500 text-xs">(${arr.length})</span></div>
          <ul class="list-disc ml-4 text-[12px] leading-5">${lis}</ul>
        </div>`
    }).join('')

  const total = cluster.items.length
  const when = cluster.items
    .map(x => x.ts?.getTime?.() || 0)
    .reduce((m,v)=> Math.max(m,v), 0)
  const whenLabel = when ? new Date(when).toLocaleString('es-CO') : '—'

  return `
    <div class="text-[12px] max-w-[280px]">
      <div class="font-bold mb-1">Personas aquí: ${total}</div>
      <div class="text-slate-500 mb-2">Última act.: ${whenLabel}</div>
      ${groups || '<div class="text-slate-400">Sin datos</div>'}
    </div>
  `
}

function makeDivIcon(person){
  const color = statusColor(person.status)
  const html = `
    <button class="group relative px-2 py-1 rounded-md bg-white/95 border text-[11px] font-medium shadow hover:bg-white"
            style="transform: translate(-50%, -120%);">
      <span class="absolute -z-10 -top-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full ping ping-outer bg-${color}-400/40"></span>
      <span class="absolute -z-10 -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full ping ping-inner bg-${color}-500/60"></span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block w-2 h-2 rounded-full bg-${color}-500"></span>
        ${String(person.name||'Agente').replace(/</g,'&lt;')}
      </span>
    </button>`
  return L.divIcon({ html, className: 'marker-btn', iconSize: [0,0] })
}

function parseGroup(r){
  return pick(r.groupCode, r.group, r.group_code, r.groupName)
}

/** ===== 1) INTENTO PRINCIPAL: endpoint de “últimas ubicaciones” (latest=1) ===== */
async function fetchFromLatestEndpoint(){
  const params = { latest: 1, date: props.dateISO }
  if (props.groupId) params.groupId = props.groupId
  const token = localStorage.getItem('token') || ''
  const { data } = await api.get(ep(props.endpoint), {
    params,
    headers: token ? { Authorization: 'Bearer ' + token } : {}
  })
  const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
  return arr.map(r => {
    const lat = parseLat(r), lng = parseLng(r)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return {
      id: r.agentId || r.id,
      name: parseName(r),
      lat, lng,
      status: parseStatus(r),
      unitName: parseUnit(r),
      group: parseGroup(r),
      ts: parseTs(r)
    }
  }).filter(Boolean)
}

/** ===== 2) FALLBACK A: detalle del día del AdminDashboard ===== */
async function fetchFromAdminDetail(){
  const params = { date: props.dateISO }
  if (props.groupId) params.groupId = props.groupId
  const { data } = await api.get(ep('/admin/report/detail'), { params })
  const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
  return arr
    .map(r => {
      const lat = parseLat(r), lng = parseLng(r)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          id: r.agentId || r.id,
          name: parseName(r),
          lat, lng,
          status: parseStatus(r),
          unitName: parseUnit(r),
          group: parseGroup(r),
          ts: parseTs(r) || new Date(props.dateISO + 'T00:00:00')
        }
      }
      return null
    })
    .filter(Boolean)
}

/** ===== 3) FALLBACK B: rango reciente y tomar la última por agente ===== */
async function fetchFromRangeFallback(){
  const to   = new Date(props.dateISO)
  const from = new Date(to); from.setDate(to.getDate() - props.lookbackDays)
  const p = { date_from: from.toISOString().slice(0,10), date_to: to.toISOString().slice(0,10) }
  if (props.groupId) p.groupId = props.groupId

  const { data } = await api.get(ep('/dashboard/reports'), { params: p })
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
  const flat = []
  for (const r of items){
    const rows = pick(r.agents, r.rows, r.details) || []
    if (Array.isArray(rows)){
      for (const a of rows){
        const lat = parseLat(a), lng = parseLng(a)
        if (Number.isFinite(lat) && Number.isFinite(lng)){
          flat.push({
            id: a.agentId || a.id,
            name: parseName(a),
            lat, lng,
            status: parseStatus(a),
            unitName: parseUnit(a) || parseUnit(r),
            ts: parseTs(a) || (r.date ? new Date(r.date) : null) || parseTs(r) || new Date()
          })
        }
      }
    } else {
      const lat = parseLat(r), lng = parseLng(r)
      if (Number.isFinite(lat) && Number.isFinite(lng)){
        flat.push({
          id: r.agentId || r.id,
          name: parseName(r),
          lat, lng,
          status: parseStatus(r),
          unitName: parseUnit(r),
          group: parseGroup(r),
          ts: parseTs(r) || (r.date ? new Date(r.date) : new Date())
        })
      }
    }
  }
  const latestByAgent = new Map()
  for (const x of flat){
    const k = x.id || x.name
    const prev = latestByAgent.get(k)
    if (!prev || (x.ts && prev.ts && x.ts > prev.ts)) latestByAgent.set(k, x)
  }
  return Array.from(latestByAgent.values())
}

/** ===== CARGA / PINTADO ===== */
async function load(){
  loading.value = true
  error.value = ''
  try {
    // 1) último por agente (igual AdminDashboard)
    let list = await fetchFromLatestEndpoint()

    // 2) si vacío, detalle del día
    if (!list.length) list = await fetchFromAdminDetail()

    // 3) si sigue vacío, rango reciente
    if (!list.length) list = await fetchFromRangeFallback()

    // orden por timestamp desc
    list.sort((a,b) => (b.ts?.getTime?.() || 0) - (a.ts?.getTime?.() || 0))
    locations.value = list
    renderMarkers()
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || 'Error'
    locations.value = []
    renderMarkers()
  } finally {
    loading.value = false
  }
}

let firstFitDone = false
function renderMarkers(){
  if (!map) return
  if (markersLayer) markersLayer.clearLayers()
  else markersLayer = L.layerGroup().addTo(map)

  const clusters = clusterize(locations.value)
  const bounds = []

  for (const c of clusters){
    // Estilo: toma el primer item para escoger color por estado (o mézclalo si quieres)
    const refItem = c.items[0]
    const cm = L.circleMarker([c.lat, c.lng], pointStyle(refItem))
      .on('click', () => {
        L.popup({ offset: [0,-8], className: 'mini-popup' })
          .setLatLng([c.lat, c.lng])
          .setContent(popupHTML(c))
          .openOn(map)
      })
    cm.addTo(markersLayer)
    bounds.push([c.lat, c.lng])
  }

  if (bounds.length){
    const b = L.latLngBounds(bounds)
    if (!firstFitDone) { map.fitBounds(b.pad(0.2)); firstFitDone = true }
  }
}


function fitAll(){
  const pts = locations.value.map(p => [p.lat, p.lng]).filter(([a,b]) => Number.isFinite(a)&&Number.isFinite(b))
  if (!pts.length) return
  map.fitBounds(L.latLngBounds(pts).pad(0.2))
}

function reload(){ firstFitDone = false; load() }

/** ===== Ciclo de vida ===== */
onMounted(() => {
  map = L.map(mapEl.value, { zoomControl: false, attributionControl: false })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
  map.setView([4.65, -74.1], 11) // Bogotá por defecto

  load()
  timerId = setInterval(load, props.refreshMs)
})

onBeforeUnmount(() => {
  if (timerId) clearInterval(timerId)
  if (map) map.remove()
})

watch(() => [props.dateISO, props.groupId, props.endpoint], () => {
  firstFitDone = false
  load()
})
</script>

<style scoped>
@keyframes ping {
  0%   { transform: translate(-50%, -50%) scale(0.8); opacity: .9; }
  70%  { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
  100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
}
.ping { position:absolute; top:0; }
.ping-outer { animation: ping 1.8s cubic-bezier(0,0,.2,1) infinite; }
.ping-inner { animation: ping 1.8s cubic-bezier(0,0,.2,1) infinite; animation-delay: .4s; }
.marker-dot { display:inline-block; width:.6rem; height:.6rem; border-radius:9999px; }
.mini-popup { padding: 0 !important; }
.mini-popup .leaflet-popup-content { margin: 8px 10px; }
.mini-popup .leaflet-popup-tip { display: none; }
</style>
