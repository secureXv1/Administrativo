<template>
  <div class="relative">
    <!-- Header opcional -->
    <div v-if="title" class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-slate-700">{{ title }}</h3>
      <div class="text-xs text-slate-500">{{ items?.length || 0 }} ítems</div>
    </div>

    <!-- Carrusel -->
    <div class="overflow-hidden group rounded-xl border border-slate-200 bg-white">
      <div
        ref="track"
        class="flex gap-3 p-3 transition-transform duration-500 will-change-transform"
        :style="{ transform: `translateX(-${offset}px)` }"
        @mouseenter="pause = true"
        @mouseleave="pause = false"
      >
        <div
          v-for="(it, idx) in looped"
          :key="idx"
          class="flex-none w-72 sm:w-80 rounded-xl border border-slate-200 bg-gradient-to-br"
          :class="it.bg || 'from-sky-50 to-cyan-50'"
        >
          <div class="p-3">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-lg bg-white/70 grid place-items-center text-sky-700">
                <slot name="icon" :item="it">
                  <!-- Icono por defecto -->
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-width="1.5" d="M8 7V3m8 4V3M3 8h18M5 21h14a2 2 0 0 0 2-2V8H3v11a2 2 0 0 0 2 2Z"/>
                  </svg>
                </slot>
              </div>
              <div class="min-w-0">
                <div class="text-sm font-semibold text-slate-800 truncate">{{ it.title }}</div>
                <div class="text-xs text-slate-600 truncate">{{ it.subtitle }}</div>
              </div>
            </div>
            <div class="mt-2 text-xs text-slate-600 flex items-center gap-2">
              <span class="inline-flex items-center rounded-md bg-white/70 px-2 py-0.5 border border-slate-200">
                {{ it.badge || it.dateLabel || it.dateISO }}
              </span>
              <span v-if="it.extra" class="text-slate-500 truncate">• {{ it.extra }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Controles -->
      <button
        class="hidden group-hover:flex absolute -left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-300 shadow items-center justify-center"
        @click="prev"
        aria-label="Anterior"
      >‹</button>
      <button
        class="hidden group-hover:flex absolute -right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-300 shadow items-center justify-center"
        @click="next"
        aria-label="Siguiente"
      >›</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] }, // [{title, subtitle, dateISO, dateLabel, extra, bg}]
  title: { type: String, default: '' },
  autoplayMs: { type: Number, default: 3500 }
})

const track = ref(null)
const offset = ref(0)
const pause = ref(false)
const cardWidth = ref(320) // se ajusta en mounted
const looped = computed(() => {
  // duplicamos para “scroll infinito” simple
  return [...props.items, ...props.items]
})

let timer = null

function measure() {
  // detectar ancho real (card + gap)
  const first = track.value?.children?.[0]
  if (!first) return
  const rect = first.getBoundingClientRect()
  // gap 12px aprox (gap-3). Ajustamos leyendo el estilo real:
  const styles = window.getComputedStyle(track.value)
  const gap = parseFloat(styles.columnGap || styles.gap || '12') || 12
  cardWidth.value = rect.width + gap
}

function next() {
  offset.value += cardWidth.value
  const max = cardWidth.value * props.items.length
  if (offset.value >= max) offset.value = 0
}
function prev() {
  const max = cardWidth.value * props.items.length
  offset.value -= cardWidth.value
  if (offset.value < 0) offset.value = max - cardWidth.value
}

onMounted(async () => {
  await nextTick()
  measure()
  window.addEventListener('resize', measure)
  timer = setInterval(() => { if (!pause.value && props.items.length > 1) next() }, props.autoplayMs)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  if (timer) clearInterval(timer)
})

watch(() => props.items, async () => {
  await nextTick()
  measure()
  offset.value = 0
})
</script>
