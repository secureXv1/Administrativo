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
                        <template v-if="a.status === 'SERVICIO'">
                          <select class="input" v-model.number="a.municipalityId">
                            <option disabled value="">Seleccione municipio</option>
                            <option v-for="m in municipalities" :key="m.id" :value="m.id">
                              {{ m.dept }} - {{ m.name }}
                            </option>
                          </select>
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
    })
    // Intenta poblar municipalityId para quienes están en SERVICIO y ya tienen ubicación
    agents.value = await Promise.all(
      data.map(async a => ({
        ...a,
        municipalityId: a.status === 'SERVICIO' && a.location !== 'N/A'
          ? await getMunicipalityIdFromLabel(a.location)
          : null
      }))
    )
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

async function loadMunicipalities() {
  if (municipalities.value.length) return
  const { data } = await axios.get('/catalogs/municipalities', {
    headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
    params: { limit: 1000 }
  })
  municipalities.value = data || []
}

// Limpia municipio si se cambia el estado a uno distinto de SERVICIO
function onStateChange(agent) {
  if (agent.status !== 'SERVICIO') {
    agent.municipalityId = null
  }
}

async function save() {
  for (const a of agents.value) {
    if (a.status === 'SERVICIO' && !a.municipalityId) {
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
        municipalityId: a.status === 'SERVICIO' ? a.municipalityId : null
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

onMounted(async () => {
  await loadMunicipalities()
  await loadAgents()
})
</script>
