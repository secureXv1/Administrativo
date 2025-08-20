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
          <!-- Buscar y agregar agente libre -->
          <div class="mb-4 flex gap-2 items-end">
            <div>
              <label class="label">Agregar agente libre</label>
              <input
                class="input"
                list="free-agents-list"
                v-model="agentSearch"
                @input="onAgentSearchInput"
                placeholder="Buscar código (ej: O101)..."
                autocomplete="off"
              />
              <datalist id="free-agents-list">
                <option
                  v-for="a in agentSearchResults"
                  :key="a.id"
                  :value="a.code"
                  @click="onSelectAgent(a.code)"
                >
                  {{ a.code }} ({{ a.category }})
                </option>
              </datalist>
            </div>
            <button class="btn-primary" @click="addFreeAgent" :disabled="!selectedAgentToAdd">Agregar</button>
          </div>


          <!-- Tabla de agentes editables -->
          <div class="card">
            <div class="card-body space-y-3">
              <div class="overflow-auto">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Categoría</th>
                      <th>Estado</th>
                      <th>Ubicación</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(a, i) in agents" :key="a.id">
                      <td>{{ a.code }}</td>
                      <td>{{ a.category }}</td>
                      <td>
                        <select class="input" v-model="a.status" @change="onStateChange(a)">
                          <option value="LABORANDO">LABORANDO</option>
                          <option value="VACACIONES">VACACIONES</option>
                          <option value="EXCUSA">EXCUSA</option>
                          <option value="PERMISO">PERMISO</option>
                          <option value="SERVICIO">SERVICIO</option>
                        </select>
                      </td>
                      <td>
                        <template v-if="a.status === 'SERVICIO' || a.status === 'LABORANDO'">
                          <input
                            class="input"
                            :class="{'border-green-500': a.municipalityId, 'border-red-500': a.municipalityName && !a.municipalityId}"
                            list="municipios-list"
                            v-model="a.municipalityName"
                            @input="onMuniInput(a)"
                            @blur="onMuniInput(a)"
                            placeholder="Buscar municipio..."
                            autocomplete="off"
                          />
                          <datalist id="municipios-list">
                            <option
                              v-for="m in municipalities"
                              :key="m.id"
                              :value="m.dept + ' - ' + m.name"
                            />
                          </datalist>
                          <span v-if="a.municipalityName && !a.municipalityId" class="text-red-500 text-xs">Debe seleccionar un municipio válido</span>

                        </template>
                        <template v-else>
                          <span class="text-slate-500">N/A</span>
                        </template>
                      </td>
                      <td>
                        <button class="btn-ghost" @click="removeAgent(a.id)">Quitar</button>
                      </td>
                    </tr>
                    <tr v-if="agents.length === 0">
                      <td colspan="5" class="text-center text-slate-500 py-4">Sin agentes en tu grupo.</td>
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
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const reportDate = ref(new Date().toISOString().slice(0, 10))
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

const agents = ref([])          // [{id, code, category, status, location, municipalityId}]
const municipalities = ref([])

async function loadAgents() {
  try {
    const { data } = await axios.get('/my/agents', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    });
    // Asegura que municipalityName SIEMPRE se asigne desde municipios si hay ID
    agents.value = data.map(a => {
      let municipalityName = a.municipalityName || '';
      if ((!municipalityName || municipalityName === '') && a.municipalityId && municipalities.value.length) {
        const m = municipalities.value.find(m => m.id === a.municipalityId);
        if (m) {
          municipalityName = `${m.dept} - ${m.name}`;
        }
      }
      return { ...a, municipalityName };
    });
  } catch (e) {
    msg.value = e.response?.data?.error || 'Error al cargar agentes'
    agents.value = []
  }
}

async function getMunicipalityIdFromLabel(label) {
  if (!label || label === 'N/A') return null
  if (!municipalities.value.length) await loadMunicipalities()
  const m = municipalities.value.find(m => `${m.dept} - ${m.name}` === label)
  return m ? m.id : null
}

async function loadMunicipalities(q = '') {
  const params = q.length >= 2 ? { q } : {};
  const { data } = await axios.get('/catalogs/municipalities', {
    headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
    params
  });
  municipalities.value = data || [];
}

// Limpia municipio si se cambia el estado a uno distinto de SERVICIO
function onStateChange(agent) {
  if (agent.status !== 'SERVICIO' && agent.status !== 'LABORANDO') {
    agent.municipalityId = null
  }
}

async function save() {
  for (const a of agents.value) {
    if ((a.status === 'SERVICIO' || a.status === 'LABORANDO') && !a.municipalityId) {
      msg.value = `Falta municipio para ${a.code}`
      return
    }
  }
  try {
    await axios.post('/reports', {
      reportDate: reportDate.value,
      people: agents.value.map(a => ({
        agentCode: a.code,
        state: a.status,
        municipalityId: (a.status === 'SERVICIO' || a.status === 'LABORANDO') ? a.municipalityId : null
      }))
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    msg.value = 'Guardado ✅'
    await loadAgents()
  } catch (e) {
    msg.value = e.response?.data?.error || 'Error al guardar'
  }
}

async function removeAgent(agentId) {
  if (!confirm('¿Quitar este agente de tu grupo?')) return
  try {
    await axios.post('/my/agents/remove', { agentId }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    await loadAgents()
  } catch (e) {
    msg.value = e.response?.data?.error || 'No se pudo quitar agente'
  }
}

// KPIs calculados en frontend
const feOF = computed(() => agents.value.filter(p => p.category === 'OF').length)
const feSO = computed(() => agents.value.filter(p => p.category === 'SO').length)
const fePT = computed(() => agents.value.filter(p => p.category === 'PT').length)

const fdOF = computed(() => agents.value.filter(p => p.category === 'OF' && p.status === 'LABORANDO').length)
const fdSO = computed(() => agents.value.filter(p => p.category === 'SO' && p.status === 'LABORANDO').length)
const fdPT = computed(() => agents.value.filter(p => p.category === 'PT' && p.status === 'LABORANDO').length)

const kpiFE = computed(() => `${feOF.value}/${feSO.value}/${fePT.value}`)
const kpiFD = computed(() => `${fdOF.value}/${fdSO.value}/${fdPT.value}`)
const kpiNOV = computed(() => `${Math.max(feOF.value - fdOF.value, 0)}/${Math.max(feSO.value - fdSO.value, 0)}/${Math.max(fePT.value - fdPT.value, 0)}`)

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}

function onMuniInput(agent) {
  const query = agent.municipalityName || '';
  // Ya no cargues municipios aquí si ya los cargaste al inicio
  const value = query.trim().toLowerCase();
  const m = municipalities.value.find(
    m => (`${m.dept} - ${m.name}`.toLowerCase().trim() === value)
  );
  agent.municipalityId = m ? m.id : null;
  // Ya NO limpies el campo, solo muestra advertencia visual
}

const agentSearch = ref('')
const agentSearchResults = ref([])
const selectedAgentToAdd = ref(null)

async function onAgentSearchInput() {
  const q = agentSearch.value.trim().toUpperCase()
  if (q.length < 1) {
    agentSearchResults.value = []
    selectedAgentToAdd.value = null
    return
  }
  const { data } = await axios.get('/catalogs/agents', {
    params: { q, limit: 20 },
    headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
  })
  // Solo agentes sin grupo (groupId == null)
  agentSearchResults.value = (data || []).filter(a => a.groupId == null)
  // Si coincide exacto, selecciona el id
  const match = agentSearchResults.value.find(a => a.code === q)
  selectedAgentToAdd.value = match ? match.id : null
}

// Permitir seleccionar un agente haciendo clic (opcional)
function onSelectAgent(code) {
  agentSearch.value = code
  const agent = agentSearchResults.value.find(a => a.code === code)
  selectedAgentToAdd.value = agent ? agent.id : null
}

async function addFreeAgent() {
  // Buscar el agente seleccionado, aunque no esté seleccionado exactamente por el datalist
  const q = agentSearch.value.trim().toUpperCase()
  const agent = agentSearchResults.value.find(a => a.code === q)
  if (!agent) {
    msg.value = "Selecciona un agente libre válido";
    return
  }
  try {
    await axios.post('/my/agents/add', { agentId: agent.id }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    msg.value = "Agente agregado a tu grupo ✅"
    agentSearch.value = ''
    agentSearchResults.value = []
    selectedAgentToAdd.value = null
    await loadAgents() // Refresca la tabla
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo agregar'
  }
}

onMounted(async () => {
  await loadMunicipalities() // sin query
  await loadAgents()
})
</script>
