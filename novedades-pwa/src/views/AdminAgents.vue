<template>
  <AdminMenuLayout :me="me" :logout="logout">
    <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div class="card">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-slate-800">Listado de agentes</h2>
            <span v-if="msg" :class="msgClass" class="text-sm">{{ msg }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <!-- Formulario crear/editar -->
          <form class="mb-6 flex flex-wrap gap-2 items-end" @submit.prevent="onSubmit">
            <input class="input" v-model="form.code" placeholder="Código (O101)" maxlength="8" required style="width:120px" />

            <select class="input" v-model="form.category" required style="width:80px">
              <option value="OF">OF</option>
              <option value="SO">SO</option>
              <option value="PT">PT</option>
            </select>

            <select class="input" v-model="form.groupId" style="width:180px">
              <option value="">Sin grupo</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.code }}</option>
            </select>

            <select class="input" v-model="form.status" required style="width:130px">
              <option value="LABORANDO">LABORANDO</option>
              <option value="VACACIONES">VACACIONES</option>
              <option value="EXCUSA">EXCUSA</option>
              <option value="PERMISO">PERMISO</option>
              <option value="SERVICIO">SERVICIO</option>
            </select>

            <!-- Municipio autocompletado -->
            <input class="input"
              v-model="form.municipalityName"
              list="municipios-list"
              @input="onMunicipalityInput"
              placeholder="Buscar municipio..."
              style="width:200px"
              autocomplete="off"
            />
            <datalist id="municipios-list">
              <option v-for="m in municipalities" :key="m.id" :value="m.dept + ' - ' + m.name" />
            </datalist>
            <input type="hidden" v-model="form.municipalityId" />

            <button class="btn-primary" type="submit">
              {{ form.id ? 'Actualizar' : 'Crear agente' }}
            </button>
            <button v-if="form.id" class="btn-ghost" @click.prevent="resetForm">Cancelar</button>
          </form>

          <table class="table">
            <thead>
              <tr>
                <th style="width:60px">ID</th>
                <th style="width:110px">Código</th>
                <th style="width:70px">Cat.</th>
                <th style="width:120px">Grupo</th>
                <th style="width:120px">Estado</th>
                <th style="width:180px">Municipio</th>
                <th style="width:80px"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in items" :key="a.id">
                <td>{{ a.id }}</td>
                <td>{{ a.code }}</td>
                <td>{{ a.category }}</td>
                <td>{{ groupCode(a.groupId) }}</td>
                <td>{{ a.status }}</td>
                <td>{{ municipalityName(a.municipalityId) }}</td>
                <td>
                  <div class="flex gap-1 items-center justify-center">
                    <button class="btn-ghost p-1" title="Editar" @click="editAgent(a)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-pencil" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L8.5 18.1a2 2 0 0 1-.9.5l-4 1a1 1 0 0 1-1.2-1.2l1-4a2 2 0 0 1 .5-.9Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button class="btn-ghost p-1" title="Eliminar" @click="deleteAgent(a)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-trash-2" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/><path d="M19 6V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="7" class="text-center text-slate-500 py-6">Sin agentes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </AdminMenuLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AdminMenuLayout from './AdminMenuLayout.vue'
import axios from 'axios'

// Usuario autenticado
const me = ref(JSON.parse(localStorage.getItem('me') || '{}'))

const items = ref([])
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')
const groups = ref([])
const municipalities = ref([])
const form = ref({
  id: null,
  code: '',
  category: 'OF',
  groupId: '',
  status: 'LABORANDO',
  municipalityId: '',
  municipalityName: ''
})

function groupCode(id) {
  if (!id) return '—'
  const g = groups.value.find(x => x.id == id)
  return g ? g.code : id
}
function municipalityName(id) {
  if (!id) return '—'
  const m = municipalities.value.find(x => x.id == id)
  return m ? `${m.dept} - ${m.name}` : id
}

// Autocompletar municipio: al escribir, asigna el id si hay match exacto
function onMunicipalityInput() {
  const q = form.value.municipalityName?.trim().toLowerCase()
  const m = municipalities.value.find(
    m => (`${m.dept} - ${m.name}`.toLowerCase() === q)
  )
  form.value.municipalityId = m ? m.id : ''
}

async function load() {
  msg.value = ''
  try {
    const { data } = await axios.get('/admin/agents', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    items.value = data || []
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'Error al cargar agentes'
  }
}

async function loadGroupsAndMunicipalities() {
  try {
    const [groupsRes, muniRes] = await Promise.all([
      axios.get('/admin/groups', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }),
      axios.get('/catalogs/municipalities', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
    ])
    groups.value = groupsRes.data || []
    municipalities.value = muniRes.data || []
  } catch (e) { /* ignore */ }
}

async function onSubmit() {
  if (!form.value.code.trim()) { msg.value = 'El código es requerido'; return }
  if (!form.value.category) { msg.value = 'La categoría es requerida'; return }
  if (form.value.municipalityName && !form.value.municipalityId) {
    msg.value = 'Selecciona un municipio válido de la lista'
    return
  }
  try {
    if (!form.value.id) {
      await axios.post('/admin/agents', {
        code: form.value.code.trim().toUpperCase(),
        category: form.value.category,
        groupId: form.value.groupId || null,
        status: form.value.status || 'LABORANDO',
        municipalityId: form.value.municipalityId || null
      }, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      msg.value = 'Agente creado ✅'
    } else {
      await axios.put(`/admin/agents/${form.value.id}`, {
        code: form.value.code.trim().toUpperCase(),
        category: form.value.category,
        groupId: form.value.groupId || null,
        status: form.value.status || 'LABORANDO',
        municipalityId: form.value.municipalityId || null
      }, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      msg.value = 'Agente actualizado ✅'
    }
    await load()
    resetForm()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo guardar'
  }
}

function editAgent(a) {
  const m = municipalities.value.find(m => m.id === a.municipalityId)
  form.value = {
    ...a,
    municipalityName: m ? `${m.dept} - ${m.name}` : ''
  }
}

async function deleteAgent(a) {
  if (!confirm('¿Eliminar este agente?')) return
  try {
    await axios.delete(`/admin/agents/${a.id}`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    msg.value = 'Agente eliminado ✅'
    await load()
    resetForm()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo eliminar'
  }
}

function resetForm() {
  form.value = {
    id: null,
    code: '',
    category: 'OF',
    groupId: '',
    status: 'LABORANDO',
    municipalityId: '',
    municipalityName: ''
  }
}

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}

onMounted(async () => {
  await loadGroupsAndMunicipalities()
  await load()
})
</script>
