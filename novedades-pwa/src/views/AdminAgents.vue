<template>
  <div class="max-w-4xl mx-auto p-4 space-y-4">
    <h2 class="text-xl font-semibold">Agentes</h2>
    <div class="card"><div class="card-body grid md:grid-cols-4 gap-2">
      <input class="input" v-model="code" placeholder="Código (A123)" />
      <select class="input" v-model="category">
        <option>OF</option><option>SO</option><option>PT</option>
      </select>
      <input class="input" v-model.number="groupId" placeholder="groupId (opcional)" />
      <button class="btn-primary" @click="create">Crear</button>
    </div></div>

    <div class="card"><div class="card-body">
      <div class="grid grid-cols-3 font-semibold border-b pb-2"> <div>Código</div><div>Categoría</div><div>Grupo</div> </div>
      <div v-for="a in items" :key="a.id" class="grid grid-cols-3 py-2 border-b">
        <div>{{ a.code }}</div><div>{{ a.category }}</div><div>{{ a.groupId ?? '—' }}</div>
      </div>
    </div></div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'; import axios from 'axios'
const items = ref([]); const code=ref(''); const category=ref('OF'); const groupId=ref(null)
async function load(){ const {data} = await axios.get('/catalogs/agents', { headers:{Authorization:'Bearer '+localStorage.getItem('token')} }); items.value=data||[] }
async function create(){
  await axios.post('/adminapi/agents', { code:code.value.trim().toUpperCase(), category:category.value, groupId:groupId.value||null },
    { headers:{Authorization:'Bearer '+localStorage.getItem('token')} })
  code.value=''; groupId.value=null; await load()
}
onMounted(load)
</script>
