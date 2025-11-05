<!-- src/components/NovedadesBlock.vue -->
<template>
  <div class="mt-8">
    <h4 class="font-semibold mb-2">
      Novedades registradas <span class="text-slate-400 text-xs">({{ tipoLabel }})</span>
    </h4>

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
        :disabled="tipo !== 'vehicle'"
        :title="tipo !== 'vehicle' ? 'Solo se pueden adjuntar novedades al vehículo (no al uso)' : ''"
      />
      <button
        class="btn-primary"
        @click="guardarNovedad"
        :disabled="tipo !== 'vehicle'"
        :title="tipo !== 'vehicle' ? 'Solo se pueden agregar novedades al vehículo (no al uso)' : ''"
      >
        Agregar
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { http } from '@/lib/http'

const props = defineProps({
  /** 'vehicle' | 'uses' (coincide con /vehicles/:tipo/:id/novelties) */
  tipo: { type: String, default: 'vehicle' },
  /** ID del recurso según el tipo (vehículo o uso) */
  refId: { type: [String, Number], required: true },
  /** Solo lectura (oculta el formulario) */
  readonly: { type: Boolean, default: false },
  /** Permitir botón Eliminar */
  canDelete: { type: Boolean, default: true }
})

const tipoLabel = computed(() => props.tipo === 'uses' ? 'del uso' : 'del vehículo')

const novedades = ref([])
const form = ref({ description: '', file: null })
const fileEl = ref(null)

function buildUrl() {
  // Alineado con el backend: GET /vehicles/:tipo/:id/novelties
  return `/vehicles/${props.tipo}/${props.refId}/novelties`
}

async function loadNovedades() {
  if (!props.refId) return
  try {
    const { data } = await http.get(buildUrl())
    novedades.value = data.items || []
  } catch (e) {
    console.error('[NovedadesBlock] loadNovedades error', e)
    novedades.value = []
  }
}

async function guardarNovedad() {
  if (props.readonly) return
  // El backend SOLO permite POST cuando tipo === 'vehicle'
  if (props.tipo !== 'vehicle') {
    alert('Solo se pueden registrar novedades directamente al vehículo (no al uso).')
    return
  }

  const fd = new FormData()
  if (form.value.description) fd.append('description', form.value.description)
  if (form.value.file) fd.append('photo', form.value.file)
  if (![...fd.keys()].length) return

  try {
    await http.post(buildUrl(), fd, { headers: { 'Content-Type': 'multipart/form-data' } })
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
watch(() => props.tipo, loadNovedades)
</script>
