<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-slate-900 font-semibold">Reporte del día</h1>
        <div class="flex gap-3 items-center">
          <router-link to="/perfil" class="btn-ghost">Perfil</router-link>
          <button @click="logout" class="btn-ghost">Cerrar sesión</button>
        </div>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div v-if="me" class="mb-4 text-sm text-slate-700">
        Unidad: <b>{{ me.unitName || '—' }}</b>
        &nbsp; | &nbsp;
        Grupo: <b>{{ me.groupCode || '—' }}</b>
      </div>

      <div class="card">
        <div class="card-body space-y-6">
        <!-- Fecha -->
        <div>
          <label class="label">Fecha</label>
          <input
            type="date"
            class="input"
            v-model="reportDate"
          />
          <p class="text-xs text-slate-500 mt-1">
            Selecciona una fecha para consultar/editar el reporte de ese día.
          </p>
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
                  v-for="a in agentSearchResults.filter(x => !agents.some(y => y.code === x.code))"
                  :key="a.id"
                  :value="a.code"
                  @click="onSelectAgent(a.code)"
                >
                {{ a.code }} ({{ displayCategory(a.category) }})
              </option>

              </datalist>
            </div>
            <button class="btn-primary" @click="addFreeAgent" :disabled="!selectedAgentToAdd">Agregar</button>
          </div>

          <!-- Tabla para desktop -->
              <div class="overflow-auto hidden md:block">
                <table class="table w-full">
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
                      <td>{{ displayCategory(a.category) }}</td>
                      <td>
                        <select class="input" v-model="a.status" @change="onStateChange(a)">
                          <!-- ...options como tienes... -->
                          <option value="SIN NOVEDAD">SIN NOVEDAD</option>
                          <option value="COMISIÓN DEL SERVICIO">COMISIÓN DEL SERVICIO</option>
                          <option value="FRANCO FRANCO">FRANCO FRANCO</option>
                          <option value="SERVICIO">SERVICIO</option>
                          <option value="VACACIONES">VACACIONES</option>
                          <option value="LICENCIA DE MATERNIDAD">LICENCIA DE MATERNIDAD</option>
                          <option value="LICENCIA DE LUTO">LICENCIA DE LUTO</option>
                          <option value="LICENCIA REMUNERADA">LICENCIA REMUNERADA</option>
                          <option value="LICENCIA NO REMUNERADA">LICENCIA NO REMUNERADA</option>
                          <option value="EXCUSA DEL SERVICIO">EXCUSA DEL SERVICIO</option>
                          <option value="LICENCIA PATERNIDAD">LICENCIA PATERNIDAD</option>
                          <option value="PERMISO">PERMISO</option>
                          <option value="COMISIÓN EN EL EXTERIOR">COMISIÓN EN EL EXTERIOR</option>
                          <option value="COMISIÓN DE ESTUDIO">COMISIÓN DE ESTUDIO</option>
                        </select>
                      </td>
                      <td>
                        <!-- Usa tu mismo template de inputs, igual que antes -->
                        <!-- ... igual que tu código actual ... -->
                        <template v-if="a.status === 'SIN NOVEDAD'">
                          <input class="input bg-slate-100 cursor-not-allowed" :value="a.municipalityName || 'CUNDINAMARCA - Bogotá'" readonly tabindex="-1" />
                        </template>
                        <template v-else-if="a.status === 'SERVICIO'">
                          <input class="input mb-1 bg-slate-100 cursor-not-allowed" :value="a.municipalityName || 'CUNDINAMARCA - Bogotá'" readonly tabindex="-1" />
                          <div class="flex gap-1 mb-1">
                            <input class="input" type="date" v-model="a.novelty_start" placeholder="Fecha inicio" />
                            <input class="input" type="date" v-model="a.novelty_end" placeholder="Fecha fin" />
                          </div>
                          <textarea class="input" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
                        </template>
                        <template v-else-if="a.status === 'COMISIÓN DEL SERVICIO'">
                          <input class="input" :class="{'border-green-500': a.municipalityId, 'border-red-500': a.municipalityName && !a.municipalityId}" list="municipios-list" v-model="a.municipalityName" @input="onMuniInput(a)" @blur="onMuniInput(a)" placeholder="Buscar municipio..." autocomplete="off" />
                          <datalist id="municipios-list">
                            <option v-for="m in municipalities" :key="m.id" :value="m.dept + ' - ' + m.name" />
                          </datalist>
                          <span v-if="a.municipalityName && !a.municipalityId" class="text-red-500 text-xs">
                            Debe seleccionar un municipio válido
                          </span>
                          <textarea class="input mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
                        </template>
                        <template v-else-if="a.status === 'FRANCO FRANCO'">
                          <span class="text-xs text-slate-400">Sin datos adicionales</span>
                        </template>
                        <template v-else>
                          <div class="flex gap-1 mb-1">
                            <input class="input" type="date" v-model="a.novelty_start" placeholder="Fecha inicio" />
                            <input class="input" type="date" v-model="a.novelty_end" placeholder="Fecha fin" />
                          </div>
                          <textarea class="input" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
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

              <!-- Tarjetas para móvil -->
              <div class="block md:hidden space-y-4">
                <div
                  v-for="(a, i) in agents"
                  :key="a.id"
                  class="bg-white shadow rounded-xl p-4 flex flex-col gap-2 border"
                >
                  <div class="flex justify-between items-center mb-2">
                    <div>
                      <div class="font-bold text-base">{{ a.code }} <span class="font-normal text-xs">({{ displayCategory(a.category) }})</span></div>
                      <div class="text-xs text-gray-500 mt-0.5">Estado</div>
                    </div>
                    <button class="text-red-600 text-xs underline" @click="removeAgent(a.id)">Quitar</button>
                  </div>
                  <select class="input w-full" v-model="a.status" @change="onStateChange(a)">
                    <option value="SIN NOVEDAD">SIN NOVEDAD</option>
                    <option value="COMISIÓN DEL SERVICIO">COMISIÓN DEL SERVICIO</option>
                    <option value="FRANCO FRANCO">FRANCO FRANCO</option>
                    <option value="SERVICIO">SERVICIO</option>
                    <option value="VACACIONES">VACACIONES</option>
                    <option value="LICENCIA DE MATERNIDAD">LICENCIA DE MATERNIDAD</option>
                    <option value="LICENCIA DE LUTO">LICENCIA DE LUTO</option>
                    <option value="LICENCIA REMUNERADA">LICENCIA REMUNERADA</option>
                    <option value="LICENCIA NO REMUNERADA">LICENCIA NO REMUNERADA</option>
                    <option value="EXCUSA DEL SERVICIO">EXCUSA DEL SERVICIO</option>
                    <option value="LICENCIA PATERNIDAD">LICENCIA PATERNIDAD</option>
                    <option value="PERMISO">PERMISO</option>
                    <option value="COMISIÓN EN EL EXTERIOR">COMISIÓN EN EL EXTERIOR</option>
                    <option value="COMISIÓN DE ESTUDIO">COMISIÓN DE ESTUDIO</option>
                  </select>

                  <!-- Campos dinámicos según estado -->
                  <div v-if="a.status === 'SIN NOVEDAD'">
                    <input class="input w-full bg-slate-100" :value="a.municipalityName || 'CUNDINAMARCA - Bogotá'" readonly />
                  </div>
                  <div v-else-if="a.status === 'SERVICIO'">
                    <input class="input w-full bg-slate-100" :value="a.municipalityName || 'CUNDINAMARCA - Bogotá'" readonly />
                    <div class="flex gap-2 mt-2">
                      <input class="input flex-1" type="date" v-model="a.novelty_start" placeholder="Fecha inicio" />
                      <input class="input flex-1" type="date" v-model="a.novelty_end" placeholder="Fecha fin" />
                    </div>
                    <textarea class="input w-full mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
                  </div>
                  <div v-else-if="a.status === 'COMISIÓN DEL SERVICIO'">
                    <input class="input w-full" list="municipios-list" v-model="a.municipalityName" @input="onMuniInput(a)" placeholder="Buscar municipio..." autocomplete="off" />
                    <datalist id="municipios-list">
                      <option v-for="m in municipalities" :key="m.id" :value="m.dept + ' - ' + m.name" />
                    </datalist>
                    <span v-if="a.municipalityName && !a.municipalityId" class="text-red-500 text-xs">
                      Debe seleccionar un municipio válido
                    </span>
                    <textarea class="input w-full mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
                  </div>
                  <div v-else-if="a.status === 'FRANCO FRANCO'">
                    <span class="text-xs text-slate-400">Sin datos adicionales</span>
                  </div>
                  <div v-else>
                    <div class="flex gap-2 mt-2">
                      <input class="input flex-1" type="date" v-model="a.novelty_start" placeholder="Fecha inicio" />
                      <input class="input flex-1" type="date" v-model="a.novelty_end" placeholder="Fecha fin" />
                    </div>
                    <textarea class="input w-full mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
                  </div>
                </div>
                <div v-if="agents.length === 0" class="text-center text-slate-500 py-4">
                  Sin agentes en tu grupo.
                </div>
              </div>

                        <!-- Aclaración antes de KPIs -->
          <div class="text-center py-2">
            <h3 class="text-base font-semibold text-slate-700">
              Novedades enviadas a nivel central
            </h3>
            <p class="text-xs text-slate-500">
              Este consolidado corresponde al reporte que se transmite a nivel central.
            </p>
          </div>



          <!-- KPIs calculados -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="kpi"><div class="card-body">
              <h4>FE total (OF/ME/PT)</h4>
              <div class="value">{{ kpiFE }}</div>
            </div></div>
            <div class="kpi"><div class="card-body">
              <h4>FD total (OF/ME/PT)</h4>
              <div class="value">{{ kpiFD }}</div>
            </div></div>
            <div class="kpi"><div class="card-body">
              <h4>Novedades totales (OF/ME/PT)</h4>
              <div class="value">{{ kpiNOV }}</div>
            </div></div>
          </div>

          <div class="flex gap-3">
            <button @click="save" class="btn-primary">
              {{ existeReporte ? 'Actualizar' : 'Guardar' }}
            </button>
            <span v-if="msg" :class="msgClass">{{ msg }}</span>
          </div>


          <!-- Aclaración antes del resumen discriminado -->
<div class="text-center py-2">
  <h3 class="text-base font-semibold text-slate-700">
    Novedades para unidad externa
  </h3>
  <p class="text-xs text-slate-500">
    Este detalle refleja las novedades discriminadas de los agentes en su unidad.
  </p>
</div>

          

          

   <!-- Novedades en su unidad (desplegable) -->
<div class="rounded-2xl border-2 border-yellow-400 bg-yellow-50">
  <!-- Encabezado / Toggle -->
  <button
    type="button"
    class="w-full px-4 py-3 flex items-center justify-between"
    @click="showUnitPanel = !showUnitPanel"
    :aria-expanded="showUnitPanel ? 'true' : 'false'"
  >
    <div class="text-left">
      <div class="text-sm font-semibold text-yellow-800">Novedades en su unidad</div>
      <div class="text-xs text-yellow-700">Fecha: {{ reportDateShort }}</div>
    </div>
    <svg class="h-5 w-5 text-yellow-800 transition-transform"
         :class="{'rotate-180': showUnitPanel}" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clip-rule="evenodd" />
    </svg>
  </button>

  <!-- Resumen compacto (siempre visible) -->
  <div class="px-4 pb-3">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <!-- FE -->
      <div class="rounded-xl bg-white/60 border border-yellow-200 px-3 py-2">
        <div class="text-xs text-yellow-700">F/E (OF/ME/PT)</div>
        <div class="text-base font-bold text-yellow-900">
          {{ feOF }}/{{ feSO }}/{{ fePT }}
          <span class="text-xs text-yellow-800"> ({{ feOF + feSO + fePT }})</span>
        </div>
      </div>
      <!-- F/D (Comisión del servicio) -->
      <div class="rounded-xl bg-white/60 border border-yellow-200 px-3 py-2">
        <div class="text-xs text-yellow-700">F/D (Comisión del servicio)</div>
        <div class="text-base font-bold text-yellow-900">
          {{ comiOF }}/{{ comiSO }}/{{ comiPT }}
          <span class="text-xs text-yellow-800"> ({{ comiTotal }})</span>
        </div>
      </div>
      <!-- Novedades (SIN NOVEDAD + demás, excepto Comisión) -->
      <div class="rounded-xl bg-white/60 border border-yellow-200 px-3 py-2">
        <div class="text-xs text-yellow-700">Novedades</div>
        <div class="text-base font-bold text-yellow-900">
          {{ novOF }}/{{ novSO }}/{{ novPT }}
          <span class="text-xs text-yellow-800"> ({{ novTotal }})</span>
        </div>
      </div>
    </div>
  </div>

                            <!-- Contenido desplegable -->
            <div v-show="showUnitPanel" class="px-4 pb-4 space-y-3">
              <!-- Lista discriminada de estados (Comisión primero, luego Sin novedad, etc.) -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  v-for="row in summaryByStatus"
                  :key="row.status"
                  class="flex items-center justify-between rounded-xl bg-yellow-100/70 px-3 py-2 border border-yellow-200"
                >
                  <div class="text-sm font-medium text-yellow-900">
                    {{ row.label }}
                  </div>
                  <div class="text-sm font-semibold text-yellow-900">
                    {{ row.of }}/{{ row.me }}/{{ row.pt }}
                    <span class="ml-1 text-xs text-yellow-800">(Total: {{ row.total }})</span>
                  </div>
                </div>
              </div>
            </div>
            </div>





        </div>
      </div>
    </main>
  </div>
</template>

<script setup>

import axios from 'axios'
import { ref, computed, onMounted, watch } from 'vue'


function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
const reportDate = ref(tomorrowStr())
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

const agents = ref([])          // [{id, code, category, status, location, municipalityId}]
const municipalities = ref([])
const me = ref(null) // 👈 Para info usuario

const existeReporte = ref(false)

async function loadMe() {
  try {
    me.value = await axios.get('/me/profile', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    }).then(r => r.data)
  } catch { me.value = null }
}

const CATEG_ORDER = { 'OF': 1, 'SO': 2, 'PT': 3 }

// Mostrar "ME" cuando la categoría real sea "SO"
function displayCategory(c) {
  return String(c || '') === 'SO' ? 'ME' : c
}





async function loadAgents() {
  try {
    const { data } = await axios.get('/my/agents', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
      params: { date: reportDate.value } // 👈 IMPORTANTE
    });

    agents.value = data
      .map(a => ({
        ...a,
        municipalityName: a.municipalityName || '',
        novelty_start: a.novelty_start ? a.novelty_start.slice(0, 10) : '',
        novelty_end:   a.novelty_end   ? a.novelty_end.slice(0, 10)   : '',
        novelty_description: a.novelty_description || '',
      }))
      .sort((x, y) => (CATEG_ORDER[x.category] || 99) - (CATEG_ORDER[y.category] || 99));
  } catch (e) {
    msg.value = e.response?.data?.error || 'Error al cargar agentes';
    agents.value = [];
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

function onStateChange(agent) {
  // SIN NOVEDAD: Bogotá fijo, limpia lo demás
  if (agent.status === 'SIN NOVEDAD') {
    agent.municipalityId = 11001
    const bogota = municipalities.value.find(m => m.id === 11001)
    agent.municipalityName = bogota ? `${bogota.dept} - ${bogota.name}` : 'CUNDINAMARCA - Bogotá'
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  // SERVICIO: Bogotá fijo, pero permite editar fechas y descripción
  if (agent.status === 'SERVICIO') {
    agent.municipalityId = 11001
    const bogota = municipalities.value.find(m => m.id === 11001)
    agent.municipalityName = bogota ? `${bogota.dept} - ${bogota.name}` : 'CUNDINAMARCA - Bogotá'
    // No limpia fechas ni descripción, el usuario las edita
    return
  }

  // COMISIÓN DEL SERVICIO: limpia municipio (el usuario debe seleccionarlo)
  if (agent.status === 'COMISIÓN DEL SERVICIO') {
    agent.municipalityId = null
    agent.municipalityName = ''
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  // FRANCO FRANCO: limpia todo
  if (agent.status === 'FRANCO FRANCO') {
    agent.municipalityId = null
    agent.municipalityName = ''
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  // Otros estados: limpia municipio y pide fechas/desc
  agent.municipalityId = null
  agent.municipalityName = ''
  agent.novelty_start = ''
  agent.novelty_end = ''
  agent.novelty_description = ''
}





async function save() {
  for (const a of agents.value) {
    if (a.status === 'SIN NOVEDAD') {
      if (a.municipalityId !== 11001) {
        msg.value = `El agente ${a.code} debe estar en Bogotá (SIN NOVEDAD)`
        return
      }
    } else if (a.status === 'SERVICIO') {
      if (a.municipalityId !== 11001) {
        msg.value = `El agente ${a.code} debe estar en Bogotá (SERVICIO)`
        return
      }
      if (!a.novelty_start) { msg.value = `Falta fecha inicio para ${a.code} (SERVICIO)`; return }
      if (!a.novelty_end) { msg.value = `Falta fecha fin para ${a.code} (SERVICIO)`; return }
      if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (SERVICIO)`; return }
    } else if (a.status === 'COMISIÓN DEL SERVICIO') {
      if (!a.municipalityId) { msg.value = `Falta municipio para ${a.code} (COMISIÓN DEL SERVICIO)`; return }
      if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (COMISIÓN DEL SERVICIO)`; return }
    } else if (a.status === 'FRANCO FRANCO') {
      // Nada requerido
    } else {
      // Resto de novedades: fecha inicio, fecha fin, descripción
      if (!a.novelty_start) { msg.value = `Falta fecha inicio para ${a.code} (${a.status})`; return }
      if (!a.novelty_end) { msg.value = `Falta fecha fin para ${a.code} (${a.status})`; return }
      if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (${a.status})`; return }
    }
  }

  try {
    await axios.post('/reports', {
      reportDate: reportDate.value,
     people: agents.value.map(a => ({
          agentCode: a.code,
          state: a.status,
          municipalityId:
            (a.status === 'SIN NOVEDAD' || a.status === 'SERVICIO') ? 11001 :
            (a.status === 'COMISIÓN DEL SERVICIO' ? a.municipalityId : null),
          novelty_start:
            (a.status === 'SERVICIO' || !['SIN NOVEDAD', 'COMISIÓN DEL SERVICIO', 'FRANCO FRANCO'].includes(a.status))
              ? a.novelty_start : null,
          novelty_end:
            (a.status === 'SERVICIO' || !['SIN NOVEDAD', 'COMISIÓN DEL SERVICIO', 'FRANCO FRANCO'].includes(a.status))
              ? a.novelty_end : null,
          novelty_description:
          (a.status === 'SERVICIO' || a.status === 'COMISIÓN DEL SERVICIO' ||
          !['SIN NOVEDAD', 'COMISIÓN DEL SERVICIO', 'FRANCO FRANCO'].includes(a.status))
          ? a.novelty_description : null,
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
// FD = todos los OF/SO/PT con status "SIN NOVEDAD"
const fdOF = computed(() => agents.value.filter(a => a.category === 'OF' && a.status === 'SIN NOVEDAD').length)
const fdSO = computed(() => agents.value.filter(a => a.category === 'SO' && a.status === 'SIN NOVEDAD').length)
const fdPT = computed(() => agents.value.filter(a => a.category === 'PT' && a.status === 'SIN NOVEDAD').length)

// FE (efectivo total)
const feOF = computed(() => agents.value.filter(a => a.category === 'OF').length)
const feSO = computed(() => agents.value.filter(a => a.category === 'SO').length)
const fePT = computed(() => agents.value.filter(a => a.category === 'PT').length)

// Novedades = total - FD
const kpiFE = computed(() => `${feOF.value}/${feSO.value}/${fePT.value}`)
const kpiFD = computed(() => `${fdOF.value}/${fdSO.value}/${fdPT.value}`)
const kpiNOV = computed(() =>
  `${feOF.value - fdOF.value}/${feSO.value - fdSO.value}/${fePT.value - fdPT.value}`
)




// Panel desplegable (cerrado por defecto)
const showUnitPanel = ref(false)

// === Cómputos para FE, F/D (Comisión) y Novedades ===
// Ya tienes feOF/feSO/fePT; reutilizamos

const comiOF = computed(() =>
  agents.value.filter(a => a.category === 'OF' && a.status === 'COMISIÓN DEL SERVICIO').length
)
const comiSO = computed(() =>
  agents.value.filter(a => a.category === 'SO' && a.status === 'COMISIÓN DEL SERVICIO').length
)
const comiPT = computed(() =>
  agents.value.filter(a => a.category === 'PT' && a.status === 'COMISIÓN DEL SERVICIO').length
)
const comiTotal = computed(() => comiOF.value + comiSO.value + comiPT.value)

// Novedades (suma de "SIN NOVEDAD" y todos los demás EXCEPTO Comisión del servicio)
// Equivale a FE - Comisión del servicio
const novOF = computed(() => feOF.value - comiOF.value)
const novSO = computed(() => feSO.value - comiSO.value)
const novPT = computed(() => fePT.value - comiPT.value)
const novTotal = computed(() => novOF.value + novSO.value + novPT.value)

// ==== Orden/etiquetas para la sección discriminada ====
const STATUS_ORDER = [
  'COMISIÓN DEL SERVICIO',
  'SIN NOVEDAD',
  'VACACIONES',
  'EXCUSA DEL SERVICIO',
  'SERVICIO',
  'FRANCO FRANCO',
  'LICENCIA DE MATERNIDAD',
  'LICENCIA DE LUTO',
  'LICENCIA REMUNERADA',
  'LICENCIA NO REMUNERADA',
  'LICENCIA PATERNIDAD',
  'PERMISO',
  'COMISIÓN EN EL EXTERIOR',
  'COMISIÓN DE ESTUDIO',
];

const STATUS_LABEL = {
  'COMISIÓN DEL SERVICIO': 'COMISIÓN DEL SERVICIO',
  'SIN NOVEDAD': 'SIN NOVEDAD (Bogotá)',
  'VACACIONES': 'VACACIONES',
  'EXCUSA DEL SERVICIO': 'EXCUSA DEL SERVICIO',
  'SERVICIO': 'SERVICIO',
  'FRANCO FRANCO': 'FRANCO FRANCO',
  'LICENCIA DE MATERNIDAD': 'LICENCIA DE MATERNIDAD',
  'LICENCIA DE LUTO': 'LICENCIA DE LUTO',
  'LICENCIA REMUNERADA': 'LICENCIA REMUNERADA',
  'LICENCIA NO REMUNERADA': 'LICENCIA NO REMUNERADA',
  'LICENCIA PATERNIDAD': 'LICENCIA PATERNIDAD',
  'PERMISO': 'PERMISO',
  'COMISIÓN EN EL EXTERIOR': 'COMISIÓN EN EL EXTERIOR',
  'COMISIÓN DE ESTUDIO': 'COMISIÓN DE ESTUDIO',
};

const summaryByStatus = computed(() => {
  const acc = {};
  for (const st of STATUS_ORDER) acc[st] = { of: 0, so: 0, pt: 0, total: 0 };

  for (const a of agents.value) {
    const st = a.status || 'SIN NOVEDAD';
    if (!acc[st]) acc[st] = { of: 0, so: 0, pt: 0, total: 0 };
    if (a.category === 'OF') acc[st].of++;
    else if (a.category === 'SO') acc[st].so++;
    else if (a.category === 'PT') acc[st].pt++;
    acc[st].total++;
  }

  const list = [];
  for (const st of STATUS_ORDER) {
    const r = acc[st];
    if (r && r.total > 0) {
      list.push({
        status: st,
        label: STATUS_LABEL[st] || st,
        of: r.of,
        me: r.so,  // mostrar "ME" aunque la categoría sea SO
        pt: r.pt,
        total: r.total,
      });
    }
  }
  return list;
});

// Fecha corta
const reportDateShort = computed(() => {
  try {
    return new Date(`${reportDate.value}T00:00:00`).toLocaleDateString('es-CO', {
      year: '2-digit', month: 'numeric', day: 'numeric'
    })
  } catch { return reportDate.value }
})




function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login/'
}

function onMuniInput(agent) {
  const query = agent.municipalityName || '';
  const value = query.trim().toLowerCase();
  const m = municipalities.value.find(
    m => (`${m.dept} - ${m.name}`.toLowerCase().trim() === value)
  );
  agent.municipalityId = m ? m.id : null;
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
  agentSearchResults.value = (data || []).filter(a => (a.groupId == null || a.groupId === 0) && (a.unitId == null || a.unitId === 0))

  const match = agentSearchResults.value.find(a => a.code === q)
  selectedAgentToAdd.value = match ? match.id : null
}

function onSelectAgent(code) {
  agentSearch.value = code
  const agent = agentSearchResults.value.find(a => a.code === code)
  selectedAgentToAdd.value = agent ? agent.id : null
}

async function addFreeAgent() {
  const q = agentSearch.value.trim().toUpperCase()
  const agent = agentSearchResults.value.find(a => a.code === q)

  if (!agent) {
    msg.value = "Selecciona un agente libre válido"
    return
  }

  // 🚫 Evitar duplicados: si ya está en la lista de agentes, no lo agregues
  if (agents.value.some(x => String(x.code).toUpperCase().trim() === agent.code)) {
    msg.value = `El agente ${agent.code} ya está en tu unidad`
    return
  }

  try {
    await axios.post('/my/agents/add', { agentId: agent.id }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    msg.value = "Agente agregado a tu grupo ✅"

    // limpiar buscador
    agentSearch.value = ''
    agentSearchResults.value = []
    selectedAgentToAdd.value = null

    // recargar listado
    await loadAgents()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo agregar'
  }
}


async function checkIfReportExists() {
  try {
    const { data } = await axios.get('/reports', {
      params: { date: reportDate.value },
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    });
    existeReporte.value = !!(data && data.length > 0);
  } catch { existeReporte.value = false }
}

watch(reportDate, async () => {
  msg.value = ''
  await loadAgents()
  await checkIfReportExists()
})

onMounted(async () => {
  await loadMe() // <--- Carga el usuario y unidad
  await loadMunicipalities();
  await loadAgents();
  await checkIfReportExists();
});




</script>
