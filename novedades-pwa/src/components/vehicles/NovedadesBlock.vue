<template>
  <div class="mt-8">
    <h4 class="font-semibold mb-2">Novedades registradas</h4>
    <div class="space-y-2 mb-2">
      <div v-for="n in novedades" :key="n.id" class="text-xs border-b py-1 flex items-center gap-2">
        <span>• {{ n.description }}</span>
        <a v-if="n.photoUrl" :href="`/${n.photoUrl}`" target="_blank" class="text-blue-600 underline">foto</a>
        <span class="text-slate-400 ml-2">{{ n.created_at }}</span>
        <button
          v-if="canDelete && !readonly"
          class="btn-xs btn-danger ml-2"
          @click="eliminarNovedad(n.id)"
        >Eliminar</button>
      </div>
      <div v-if="!novedades.length" class="text-slate-400 text-xs">Sin novedades</div>
    </div>
    <details>
      <summary class="cursor-pointer text-xs text-slate-600">Añadir novedad</summary>
      <div v-if="!readonly && tipo === 'vehicle'" class="mt-2 flex flex-col sm:flex-row gap-2 items-end">
        <input
            v-model="form.description"
            class="input flex-1 min-w-0"
            placeholder="Descripción"
            maxlength="1000"
        />
        <input
            type="file"
            @change="onPhoto"
            accept="image/*"
            class="input w-36 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-700"
        />
        <button class="btn-primary btn-xs" @click="registrarNovedad">Guardar</button>
    </div>
    </details>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { http } from '@/lib/http'

const props = defineProps({
  tipo: { type: String, required: true },   // 'use' o 'assignment'
  refId: { type: [Number, String], required: true },
  canDelete: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false }
})

const novedades = ref([])
const form = ref({ description: '', file: null })

// Cargar novedades cuando cambian props
async function loadNovedades() {
  if (!props.refId) return
  let url
  if (props.tipo === 'use' || props.tipo === 'uses') {
    url = `/vehicles/uses/${props.refId}/novelties`
  } else if (props.tipo === 'vehicle') {
    url = `/vehicles/vehicle/${props.refId}/novelties`
  } else if (props.tipo === 'assignment' || props.tipo === 'assignments') {
    // Asignaciones ya no tienen novedades: evita llamadas inválidas
    novedades.value = []
    return
  } else {
    novedades.value = []
    return
 }
  try {
    const { data } = await http.get(url)
    novedades.value = data.items || []
  } catch (e) {
    novedades.value = []
  }
}
watch(() => props.refId, loadNovedades, { immediate: true })

function onPhoto(e) {
  form.value.file = e.target.files?.[0] || null
}
async function registrarNovedad() {
  if (props.readonly) return
  let url =
    props.tipo === 'use'
      ? `/vehicles/uses/${props.refId}/novelties`
      : `/vehicles/assignments/${props.refId}/novelties`
  const fd = new FormData()
  if (form.value.description) fd.append('description', form.value.description)
  if (form.value.file) fd.append('photo', form.value.file)
  if (!fd.has('description') && !fd.has('photo')) return
  try {
    await http.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    form.value = { description: '', file: null }
    await loadNovedades()
  } catch (e) {
    alert(e?.response?.data?.error || 'Error al guardar la novedad')
  }
}
async function eliminarNovedad(id) {
  if (props.readonly) return
  if (!confirm('¿Eliminar esta novedad?')) return
  // Solo una ruta, la de tu backend
  let url = `/vehicles/novelties/${id}`
  try {
    await http.delete(url)
    await loadNovedades()
  } catch (e) {
    alert(e?.response?.data?.error || 'No se pudo eliminar')
  }
}
</script>
