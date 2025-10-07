<!-- SidebarItem.vue -->
<template>
  <RouterLink
    :to="to"
    :class="[
      'flex items-center gap-3 px-2 py-2 rounded-lg transition-colors',
      isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
    ]"
    @click="$emit('navigate')"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path :d="iconPath"/>
    </svg>
    <span v-if="!collapsed" class="truncate">{{ label }}</span>
  </RouterLink>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

const props = defineProps({
  to: { type: [String, Object], required: true },
  label: { type: String, required: true },
  icon: { type: String, default: 'dot' },
  collapsed: { type: Boolean, default: false },
  exact: { type: Boolean, default: false }
})

const route = useRoute()

const isActive = computed(() => {
  if (props.exact) return route.path === (typeof props.to === 'string' ? props.to : props.to.path || '')
  const base = typeof props.to === 'string' ? props.to : (props.to.path || '')
  return route.path.startsWith(base)
})

const iconPaths = {
  dashboard: 'M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v11h-7V3zm0 13h7v5h-7v-5z',
  agents: 'M5 8a3 3 0 116 0 3 3 0 01-6 0zm8 9a5 5 0 10-10 0h10z',
  vehicles: 'M3 13l2-5h10l2 5M3 13h16M6 16h2m8 0h2',
  services: 'M4 7h16M4 12h16M4 17h16',
  expenses: 'M12 8c-3 0-5 2-5 5v4h10v-4c0-3-2-5-5-5zM12 8V6m0 12v2',
  groups: 'M4 7h6v6H4V7zm10 0h6v10h-6V7zM4 15h6v6H4v-6z',
  units: 'M4 4h16v16H4V4zm4 4h8v8H8V8z',
  users: 'M12 12a4 4 0 100-8 4 4 0 000 8zm6 8a6 6 0 10-12 0h12z',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8z M4 12h2m12 0h2M12 4v2m0 12v2',
  dot: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0'
}
const iconPath = computed(() => iconPaths[props.icon] || iconPaths.dot)
</script>
