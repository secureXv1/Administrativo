<script setup>
import { computed } from 'vue'

const props = defineProps({
  date: { type: String, default: '' }
})

const daysLeft = computed(() => {
  if (!props.date) return null
  const d = new Date(props.date + 'T00:00:00')
  const today = new Date()
  const diff = Math.floor((d - new Date(today.toDateString())) / 86400000)
  return diff
})
const cls = computed(() => {
  const n = daysLeft.value
  if (n == null) return 'bg-slate-200 text-slate-700'
  if (n < 0) return 'bg-red-100 text-red-800'
  if (n <= 30) return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
})
</script>

<template>
  <span class="px-2 py-0.5 rounded-full text-xs" :class="cls">
    {{ date || '—' }} <span v-if="daysLeft != null">({{ daysLeft }}d)</span>
  </span>
</template>
