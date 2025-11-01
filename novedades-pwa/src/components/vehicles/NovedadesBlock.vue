<!-- src/components/NovedadesBlock.vue — ALINEADO CON /routes/vehiculos.js -->
<template>
  <div class="mt-8">
    <h4 class="font-semibold mb-2">Novedades registradas</h4>

    <!-- Lista -->
    <div class="space-y-2 mb-3">
      <div
        v-for="n in novedades"
        :key="n.id"
        class="text-xs border-b py-1 flex items-center gap-2"
      >
        <span>• {{ n.description }}</span>
        <a
          v-if="n.photoUrl"
          :href="`/${n.photoUrl}`"
          target="_blank"
          class="text-blue-600 underline"
        >foto</a>
        <span class="text-slate-400 ml-2">{{ n.created_at }}</span>

        <button
          v-if="canDelete && !readonly"
          class="btn-xs btn-danger ml-2"
          @click="eliminarNovedad(n.id)"
        >Eliminar</button>
      </div>
      <div v-if="!novedades.length" class="text-slate-400 text-xs">Sin novedades</div>
    </div>

    <!-- Formulario (solo si NO es readonly) -->
    <div v-if="!readonly" class="flex flex-col sm:flex-row gap-2">
      <input
        v-model="form.description"
        class="input flex-1"
        placeholder="Descripción de la novedad"
        maxlength="300"
      />
      <input
        ref="fileEl"
        type="file"
        class="input"
        accept="image/*"
        @change="e => form.file = e.target.files?.[0] || null"
      />
      <button class="btn-primary" @click="guardarNovedad">Agregar</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { http } from '@/lib/http'

const props = defineProps({
  /** ID del vehículo */
  refId: { type: [String, Number], required: true },
  /** Solo lectura (oculta el formulario) */
  readonly: { type: Boolean, default: false },
  /** Permitir botón Eliminar */
  canDelete: { type: Boolean, default: true }
})

const novedades = ref([])
const form = ref({ description: '', file: null })
const fileEl = ref(null)

async function loadNovedades() {
  if (!props.refId) return
  try {
    // SIEMPRE contra vehículo (ya no uses/assignments)
    const url = `/vehicles/vehicle/${props.refId}/novelties`
    const { data } = await http.get(url)
    novedades.value = data.items || []
  } catch (e) {
    console.error('[NovedadesBlock] loadNovedades error', e)
  }
}

async function guardarNovedad() {
  if (props.readonly) return
  const fd = new FormData()
  if (form.value.description) fd.append('description', form.value.description)
  if (form.value.file) fd.append('photo', form.value.file)
  if (![...fd.keys()].length) return

  try {
    const url = `/vehicles/vehicle/${props.refId}/novelties`
    await http.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    form.value = { description: '', file: null }
    if (fileEl.value) fileEl.value.value = ''
    await loadNovedades()
  } catch (e) {
    alert(e?.response?.data?.error || 'Error al guardar la novedad')
  }
}

async function eliminarNovedad(id) {
  if (props.readonly) return
  if (!confirm('¿Eliminar esta novedad?')) return
  try {
    await http.delete(`/vehicles/novelties/${id}`)
    await loadNovedades()
  } catch (e) {
    alert(e?.response?.data?.error || 'No se pudo eliminar')
  }
}

onMounted(loadNovedades)
watch(() => props.refId, loadNovedades)
</script>
