<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold">Reporte del día</h1>
        <button @click="logout" class="btn-ghost">Cerrar sesión</button>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div class="card">
        <div class="card-body space-y-6">
          <!-- Fecha -->
          <div>
            <label class="label">Fecha</label>
            <input type="date" v-model="reportDate" class="input" />
          </div>
          
          <!-- Agregar fila -->
          <div class="card">
            <div class="card-body space-y-3">
              <div class="grid md:grid-cols-4 gap-3 items-end">
                <div class="md:col-span-2">
                  <label class="label">Código Agente</label>
                  <div class="relative">
                    <input
                      class="input"
                      v-model="codeQuery"
                      placeholder="Escribe o selecciona (ej: O101)"
                      @input="searchAgents"
                      @keydown.enter.prevent="confirmCodeFromQuery"
                    />
                    <div v-if="agentOpts.length" class="absolute z-10 bg-white border rounded mt-1 max-h-48 overflow-auto w-full shadow">
                      <button
                        v-for="a in agentOpts"
                        :key="a.code"
                        class="w-full text-left px-3 py-2 hover:bg-slate-50"
                        :disabled="a.groupId && a.groupId !== 0"
                        @click="!a.groupId || a.groupId===0 ? selectAgent(a) : null"
                      >
                        {{ a.code }}
                        <span class="text-slate-500">({{ a.category }})</span>
                        <span v-if="a.groupId && a.groupId!==0" class="text-rose-500 text-xs ml-2">no disponible</span>
                      </button>
                    </div>
                  </div>
                  
                </div>
                <div>
                  <label class="label">Estado</label>
                  <select v-model="newState" class="input">
                    <option value="LABORANDO">LABORANDO</option>
                    <option value="VACACIONES">VACACIONES</option>
                    <option value="EXCUSA">EXCUSA</option>
                    <option value="PERMISO">PERMISO</option>
                    <option value="SERVICIO">SERVICIO</option>
                  </select>
                </div>
                <div class="flex gap-2">
                  <button class="btn-primary w-full" @click="addRow" :disabled="!canAdd">Agregar</button>
                </div>
              </div>

              <!-- Ubicación cuando “SERVICIO” (al agregar una fila) -->
              <div v-if="newState==='SERVICIO'" class="grid md:grid-cols-3 gap-3">
                <div class="md:col-span-2">
                  <label class="label">Ubicación (buscar por depto o municipio)</label>
                  <div class="flex gap-2">
                    <input class="input" v-model="newMuniQuery" placeholder="Ej: ANTIOQUIA o MEDELLÍN" @input="searchNewMuni" />
                    <select class="input" v-model.number="newMunicipalityId">
                      <option disabled value="">Seleccione</option>
                      <option v-for="m in newMuniOpts" :key="m.id" :value="m.id">{{ m.dept }} - {{ m.name }}</option>
                    </select>
                  </div>
                </div>
              </div>

              <p v-if="adderMsg" class="text-xs text-amber-600">{{ adderMsg }}</p>
            </div>
          </div>

          <!-- Tabla de personas -->
          <div class="card">
            <div class="card-body space-y-3">
              <div class="overflow-auto">
                <table class="table">
                  <thead>
                    <tr>
                      <th style="width: 140px">Código</th>
                      <th style="width: 120px">Categoría</th>
                      <th style="width: 180px">Estado</th>
                      <th>Ubicación</th>
                      <th style="width: 80px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(p,i) in people" :key="p.agentCode">
                      <td class="font-medium">{{ p.agentCode }}</td>
                      <td><span class="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700">{{ p.category }}</span></td>
                      <td>
                        <select class="input" v-model="p.state" @change="onStateChange(i)">
                          <option value="LABORANDO">LABORANDO</option>
                          <option value="VACACIONES">VACACIONES</option>
                          <option value="EXCUSA">EXCUSA</option>
                          <option value="PERMISO">PERMISO</option>
                          <option value="SERVICIO">SERVICIO</option>
                        </select>
                      </td>
                      <td>
                        <div v-if="isNA(p.state)" class="text-slate-500">N/A</div>
                        <div v-else>
                          <select
                            class="input"
                            v-model.number="p.municipalityId"
                            @focus="loadMunicipalities(i)"
                          >
                            <option disabled value="">Seleccione ubicación</option>
                            <option v-for="m in municipalities" :key="m.id" :value="m.id">
                              {{ m.dept }} - {{ m.name }}
                            </option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <button class="btn-ghost" @click="removeRow(i)">Quitar</button>
                      </td>
                    </tr>
                    <tr v-if="people.length===0">
                      <td colspan="5" class="text-center text-slate-500 py-4">Sin filas. Usa el buscador de códigos.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- KPIs calculados -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="kpi"><div class="card-body">
              <h4>FE total (OF/SO/PT)</h4>
              <div class="value">{{ kpiFE }}</div>
            </div></div>
            <div class="kpi"><div class="card-body">
              <h4>FD total (OF/SO/PT)</h4>
              <div class="value">{{ kpiFD }}</div>
            </div></div>
            <div class="kpi"><div class="card-body">
              <h4>Novedades totales (OF/SO/PT)</h4>
              <div class="value">{{ kpiNOV }}</div>
            </div></div>
          </div>

          <div class="flex gap-3">
            <button @click="save" class="btn-primary">Guardar</button>
            <span v-if="msg" :class="msgClass">{{ msg }}</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'

const reportDate = ref(new Date().toISOString().slice(0,10))
const msg = ref('')
const msgClass = computed(()=> msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

// ========= Personas en el reporte =========
// Estructura: { agentId, agentCode, category, state, municipalityId, muniQuery, muniOpts:[] }
const people = ref([])
const inPeople = (code) => people.value.some(p => p.agentCode === code)

// Carga inicial: llenar la tabla con los agentes de MI grupo (todos en LABORANDO)
const me = ref(null)
const lastLoadInfo = ref(null) // debug visible

async function loadMyAgents() {
  const hdr = { headers:{ Authorization:'Bearer '+(localStorage.getItem('token')||'') } }

  try {
    // 1) /me
    const { data: meData } = await axios.get('/me', hdr)
    me.value = meData

    // 2) /my/agents (oficial para líderes)
    let list = []
    try {
      const { data } = await axios.get('/my/agents', hdr)
      list = Array.isArray(data) ? data : []
    } catch (e) {
      // si eres admin o algo bloquea, list se queda []
      list = []
    }

    // 3) Fallback por si /my/agents viene vacío: filtrar catálogo por mi groupId
    if (!list.length && me.value?.groupId != null) {
      const { data: all } = await axios.get('/catalogs/agents', { params:{ limit: 1000 }, ...hdr })
      list = (Array.isArray(all) ? all : []).filter(a => Number(a.groupId) === Number(me.value.groupId))
    }

    // 4) Poblar tabla
    people.value = list.map(a => ({
      agentId: a.id,
      agentCode: a.code,
      category: a.category,
      state: 'LABORANDO',
      municipalityId: null,
      muniQuery: '',
      muniOpts: []
    }))

    // Debug visible
    lastLoadInfo.value = {
      me: me.value,
      count: people.value.length,
      preview: people.value.slice(0, 4)
    }
    console.log('loadMyAgents()', lastLoadInfo.value)

  } catch (err) {
    lastLoadInfo.value = { error: err?.response?.data || err?.message }
    console.error('loadMyAgents() error', err)
    people.value = [] // deja la tabla vacía si algo grave falla
  }
}

// ========= Autocomplete de agentes (global) =========
const codeQuery = ref('')
const agentOpts = ref([]) // resultados del backend (incluye groupId)
const selectedAgent = ref(null) // {id,code,category,groupId}
const newState = ref('LABORANDO')
const newMunicipalityId = ref('')
const newMuniQuery = ref('')
const newMuniOpts = ref([])
const adderMsg = ref('')

let searchTimer = null

watch(codeQuery, (v) => {
  const q = (v || '').trim().toUpperCase()
  if (!selectedAgent.value || !q || selectedAgent.value.code !== q) {
    if (!(selectedAgent.value && selectedAgent.value.code === q)) {
      selectedAgent.value = null
    }
  }
})

async function searchAgents(){
  const q = codeQuery.value.trim().toUpperCase()
  clearTimeout(searchTimer)
  if (!q) { agentOpts.value = []; selectedAgent.value = null; return }

  searchTimer = setTimeout(async () => {
    const hdr = { headers:{ Authorization:'Bearer '+(localStorage.getItem('token')||'') } }
    // Trae por prefijo y recibir groupId para saber si está libre
    const { data } = await axios.get('/catalogs/agents', { params:{ q, limit: 50 }, ...hdr })
    // Muestra todos, pero deshabilitamos los que no estén libres; si prefieres ocultarlos, filtra aquí:
    // agentOpts.value = (data || []).filter(a => !a.groupId || a.groupId === 0)
    agentOpts.value = data || []

    // exact match
    const exact = (agentOpts.value || []).find(a => a.code === q)
    if (exact) { selectedAgent.value = exact; return }

    const { data: exactData } = await axios.get('/catalogs/agents', { params:{ code: q, limit: 1 }, ...hdr })
    selectedAgent.value = (exactData && exactData[0]) ? exactData[0] : null
  }, 200)
}

function selectAgent(a){
  // No seleccionar si no está libre
  if (a.groupId && a.groupId !== 0) return
  selectedAgent.value = a
  codeQuery.value = a.code
  agentOpts.value = []
}

function confirmCodeFromQuery(){
  const q = codeQuery.value.trim().toUpperCase()
  const match = agentOpts.value.find(a => a.code === q && (!a.groupId || a.groupId===0))
  if (match) { selectAgent(match); return }
  searchAgents()
}

// ========= Municipios (solo al agregar si SERVICIO) =========
async function searchNewMuni(){
  const q = newMuniQuery.value.trim()
  if (!q || q.length < 2) { newMuniOpts.value = []; return }
  const { data } = await axios.get('/catalogs/municipalities', {
    params: { q, limit: 50 },
    headers: { Authorization: 'Bearer '+(localStorage.getItem('token')||'') }
  })
  newMuniOpts.value = data || []
}

// ========= Agregar fila (y asignar agente a MI grupo en BD) =========
const canAdd = computed(()=>{
  if (!selectedAgent.value) return false
  if (selectedAgent.value.groupId && selectedAgent.value.groupId !== 0) return false // debe estar libre
  if (inPeople(selectedAgent.value.code)) return false
  if (newState.value === 'SERVICIO' && !newMunicipalityId.value) return false
  return true
})

async function addRow(){
  adderMsg.value = ''
  if (!selectedAgent.value) { adderMsg.value = 'Selecciona un código válido.'; return }
  if (selectedAgent.value.groupId && selectedAgent.value.groupId !== 0) { adderMsg.value = 'El agente no está libre (groupId ≠ 0).'; return }
  if (inPeople(selectedAgent.value.code)) { adderMsg.value = 'Ese código ya fue agregado.'; return }
  if (newState.value === 'SERVICIO' && !newMunicipalityId.value) { adderMsg.value = 'Selecciona un municipio.'; return }

  try {
    // 1) asignar en BD al grupo del líder
    const hdr = { headers:{ Authorization:'Bearer '+(localStorage.getItem('token')||'') } }
    await axios.post('/my/agents/add', { agentId: selectedAgent.value.id }, hdr)

    // 2) reflejar en UI (y marcar agentId)
    people.value.push({
      agentId: selectedAgent.value.id,
      agentCode: selectedAgent.value.code,
      category: selectedAgent.value.category,
      state: newState.value || 'LABORANDO',
      municipalityId: (newState.value==='SERVICIO' ? Number(newMunicipalityId.value) : null),
      muniQuery: '',
      muniOpts: []
    })

    // reset picker
    selectedAgent.value = null
    codeQuery.value = ''
    agentOpts.value = []
    newState.value = 'LABORANDO'
    newMunicipalityId.value = ''
    newMuniQuery.value = ''
    newMuniOpts.value = []
  } catch (e) {
    adderMsg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo agregar'
  }
}

/* ====== Edición por fila ====== */
function isNA(state){ return ['VACACIONES','EXCUSA','PERMISO'].includes((state||'').toUpperCase()) }

function onStateChange(i){
  const p = people.value[i]
  if (isNA(p.state)) {
    p.municipalityId = null
    p.muniQuery = ''
    p.muniOpts = []
  }
}

async function searchMuni(i){
  const p = people.value[i]
  const q = (p.muniQuery || '').trim()
  if (!q || q.length < 2) { p.muniOpts = []; return }
  const { data } = await axios.get('/catalogs/municipalities', {
    params: { q, limit: 50 },
    headers: { Authorization: 'Bearer '+(localStorage.getItem('token')||'') }
  })
  p.muniOpts = data || []
}

/* ====== Quitar fila (y soltar del grupo en BD => groupId=0) ====== */
async function removeRow(i){
  const p = people.value[i]
  if (!p) return
  if (!confirm(`¿Quitar al agente ${p.agentCode} de tu grupo?`)) return
  try {
    const hdr = { headers:{ Authorization:'Bearer '+(localStorage.getItem('token')||'') } }
    await axios.post('/my/agents/remove', { agentId: p.agentId }, hdr)
    people.value.splice(i,1)
  } catch (e) {
    alert(e.response?.data?.detail || e.response?.data?.error || 'No se pudo quitar')
  }
}

/* ====== KPIs auto (FE/FD/NOV) ====== */
const feOF = computed(()=> people.value.filter(p => p.category==='OF').length)
const feSO = computed(()=> people.value.filter(p => p.category==='SO').length)
const fePT = computed(()=> people.value.filter(p => p.category==='PT').length)

const fdOF = computed(()=> people.value.filter(p => p.category==='OF' && p.state==='LABORANDO').length)
const fdSO = computed(()=> people.value.filter(p => p.category==='SO' && p.state==='LABORANDO').length)
const fdPT = computed(()=> people.value.filter(p => p.category==='PT' && p.state==='LABORANDO').length)

const kpiFE  = computed(()=> `${feOF.value}/${feSO.value}/${fePT.value}`)
const kpiFD  = computed(()=> `${fdOF.value}/${fdSO.value}/${fdPT.value}`)
const kpiNOV = computed(()=> `${Math.max(feOF.value-fdOF.value,0)}/${Math.max(feSO.value-fdSO.value,0)}/${Math.max(fePT.value-fdPT.value,0)}`)

/* ====== Guardar ====== */
async function save(){
  try{
    for (const p of people.value) {
      if (p.state==='SERVICIO' && !p.municipalityId) { msg.value = `Falta municipio para ${p.agentCode}`; return }
    }
    const payload = {
      reportDate: reportDate.value,
      people: people.value.map(p => ({
        agentCode: p.agentCode,
        state: p.state,
        municipalityId: isNA(p.state) ? null : (p.municipilityId ?? p.municipalityId ?? null) // typo-safe
      }))
    }
    await axios.post('/reports', payload, { headers:{ Authorization:'Bearer '+(localStorage.getItem('token')||'') } })
    msg.value = 'Guardado ✅'
  } catch(e){
    msg.value = e.response?.data?.error || 'Error al guardar'
  }
}
const municipalities = ref([])

async function loadMunicipalities() {
  if (municipalities.value.length) return // ya cargado
  const hdr = { headers:{ Authorization:'Bearer '+(localStorage.getItem('token')||'') } }
  const { data } = await axios.get('/catalogs/municipalities', { params:{ limit: 1000 }, ...hdr })
  municipalities.value = data || []
}

/* ====== Inicio ====== */
onMounted(async () => {
  await loadMyAgents() // ← llena la tabla con los de tu grupo
})

/* ====== Logout ====== */
function logout(){ localStorage.removeItem('token'); window.location.href='/login' }
</script>
