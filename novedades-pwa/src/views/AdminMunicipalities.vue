<template>
  <div class="max-w-3xl mx-auto p-4 space-y-4">
    <h2 class="text-xl font-semibold">Municipios</h2>
    <div class="card"><div class="card-body grid md:grid-cols-3 gap-2">
      <input class="input" v-model="dept" placeholder="Departamento" />
      <input class="input" v-model="name" placeholder="Municipio" />
      <button class="btn-primary" @click="create">Crear</button>
    </div></div>

    <div class="card"><div class="card-body">
      <div class="grid grid-cols-2 font-semibold border-b pb-2"> <div>Depto</div><div>Municipio</div> </div>
      <div v-for="m in items" :key="m.id" class="grid grid-cols-2 py-2 border-b">
        <div>{{ m.dept }}</div><div>{{ m.name }}</div>
      </div>
    </div></div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'; import axios from 'axios'
const items = ref([]); const dept=ref(''); const name=ref('')
async function load(){ const {data} = await axios.get('/catalogs/municipalities', { headers:{Authorization:'Bearer '+localStorage.getItem('token')}, params:{ limit:200 } }); items.value=data||[] }
async function create(){
  await axios.post('/adminapi/municipalities', { dept:dept.value.trim().toUpperCase(), name:name.value.trim().toUpperCase() },
    { headers:{Authorization:'Bearer '+localStorage.getItem('token')} })
  dept.value=''; name.value=''; await load()
}
onMounted(load)
</script>
