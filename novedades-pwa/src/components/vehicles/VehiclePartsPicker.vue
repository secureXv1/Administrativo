<template>
  <div
    class="grid gap-3"
    :class="compact ? 'sm:grid-cols-[1fr,220px]' : 'sm:grid-cols-[1fr,300px]'"
  >
    <!-- LIENZO -->
    <div :class="['rounded-xl border border-slate-200', compact ? 'bg-white p-2' : 'bg-white p-4']">
      <div class="relative w-full flex justify-center">
        <!-- === SVG base: camioneta con platón === -->
        <svg
          viewBox="0 0 900 520"
          class="w-full h-auto select-none"
          role="img"
          aria-label="Camioneta moderna con platón"
        >
          <defs>
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity="0.15" />
            </filter>
          </defs>

          <g fill="#d1d5db" stroke="#64748b" stroke-width="2" filter="url(#soft)">
            <!-- Parachoques delantero -->
            <rect x="280" y="30" width="340" height="30" rx="8"/>
            <!-- Capó -->
            <rect x="290" y="60" width="320" height="40" rx="10"/>

            <!-- Luces delanteras -->
            <rect x="295" y="35" width="20" height="10" fill="#fbbf24"/>
            <rect x="585" y="35" width="20" height="10" fill="#fbbf24"/>

            <!-- Cabina -->
            <rect x="310" y="100" width="280" height="140" rx="20" fill="#f1f5f9"/>
            <!-- Vidrio frontal -->
            <polygon points="330,110 570,110 570,160 330,160" fill="#cbd5e1"/>
            <!-- Puertas (4) -->
            <rect x="320" y="130" width="60" height="100" rx="6" fill="#ffffff"/>
            <rect x="390" y="130" width="60" height="100" rx="6" fill="#ffffff"/>
            <rect x="460" y="130" width="60" height="100" rx="6" fill="#ffffff"/>
            <rect x="530" y="130" width="60" height="100" rx="6" fill="#ffffff"/>
            <!-- Espejos -->
            <rect x="305" y="150" width="10" height="20" fill="#94a3b8"/>
            <rect x="585" y="150" width="10" height="20" fill="#94a3b8"/>

            <!-- Platón -->
            <rect x="290" y="260" width="320" height="160" rx="10" fill="#e2e8f0"/>
            <rect x="300" y="270" width="300" height="140" rx="6" fill="#cbd5e1"/>

            <!-- Parachoques trasero -->
            <rect x="280" y="440" width="340" height="30" rx="8"/>
            <!-- Luces traseras -->
            <rect x="295" y="445" width="20" height="10" fill="#ef4444"/>
            <rect x="585" y="445" width="20" height="10" fill="#ef4444"/>

            <!-- Ruedas -->
            <circle cx="290" cy="130" r="24" fill="#1e293b"/>
            <circle cx="610" cy="130" r="24" fill="#1e293b"/>
            <circle cx="290" cy="400" r="24" fill="#1e293b"/>
            <circle cx="610" cy="400" r="24" fill="#1e293b"/>

            <!-- Guardabarros -->
            <path d="M314,106 a30,30 0 0 1 -48,48" stroke="#64748b" fill="none"/>
            <path d="M586,106 a30,30 0 0 0 48,48" stroke="#64748b" fill="none"/>
            <path d="M314,394 a30,30 0 0 0 -48,-48" stroke="#64748b" fill="none"/>
            <path d="M586,394 a30,30 0 0 1 48,-48" stroke="#64748b" fill="none"/>
          </g>
        </svg>

        <!-- === Overlay interactivo (hotspots) === -->
        <svg class="absolute inset-0 w-full h-full" viewBox="0 0 900 520" aria-hidden="true">
          <!-- Parachoques -->
          <rect v-bind="hsRect('PAD', 280, 30, 340, 30, 8)" />
          <rect v-bind="hsRect('PAR', 280, 440, 340, 30, 8)" />

          <!-- Capó -->
          <rect v-bind="hsRect('CAP', 290, 60, 320, 40, 10)" />

          <!-- Luces -->
          <rect v-bind="hsRect('LFD', 295, 35, 20, 10, 2)" />
          <rect v-bind="hsRect('LFA', 585, 35, 20, 10, 2)" />
          <rect v-bind="hsRect('LTD', 295, 445, 20, 10, 2)" />
          <rect v-bind="hsRect('LTA', 585, 445, 20, 10, 2)" />

          <!-- Cabina + vidrio -->
          <rect v-bind="hsRect('CABINA', 310, 100, 280, 140, 20)" />
          <polygon v-bind="hsPoly('VID', '330,110 570,110 570,160 330,160')" />

          <!-- Puertas (4) -->
          <rect v-bind="hsRect('PDI', 320,130,60,100,6)" />
          <rect v-bind="hsRect('PTI', 390,130,60,100,6)" />
          <rect v-bind="hsRect('PDD', 460,130,60,100,6)" />
          <rect v-bind="hsRect('PTD', 530,130,60,100,6)" />

          <!-- Espejos -->
          <rect v-bind="hsRect('EMI', 305, 150, 10, 20, 2)" />
          <rect v-bind="hsRect('EMD', 585, 150, 10, 20, 2)" />

          <!-- Platón y carga -->
          <rect v-bind="hsRect('PLATON', 290, 260, 320, 160, 10)" />
          <rect v-bind="hsRect('CARGA', 300, 270, 300, 140, 6)" />

          <!-- Ruedas -->
          <circle v-bind="hsCircle('LTI',290,130,24)" />
          <circle v-bind="hsCircle('LTD',610,130,24)" />
          <circle v-bind="hsCircle('LLI',290,400,24)" />
          <circle v-bind="hsCircle('LLD',610,400,24)" />

          <!-- Guardabarros -->
          <path v-bind="hsPath('GFDI', 'M314,106 a30,30 0 0 1 -48,48')" />
          <path v-bind="hsPath('GFDD', 'M586,106 a30,30 0 0 0 48,48')" />
          <path v-bind="hsPath('GFTI', 'M314,394 a30,30 0 0 0 -48,-48')" />
          <path v-bind="hsPath('GFTD', 'M586,394 a30,30 0 0 1 48,-48')" />
        </svg>

        <!-- Tooltip -->
        <div
          v-if="hoverLabel"
          class="absolute pointer-events-none px-2 py-1 text-xs rounded bg-slate-800 text-white"
          :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px', transform: 'translate(-50%,-120%)' }"
        >
          {{ hoverLabel }}
        </div>
      </div>
    </div>

    <!-- LEYENDA -->
    <div :class="['rounded-xl border border-slate-200', compact ? 'bg-white p-2' : 'bg-white p-3']">
      <div class="text-xs text-slate-500 mb-2">Toca una zona del dibujo o usa la lista:</div>
      <div class="grid grid-cols-1 gap-2 pr-1 overflow-auto" :style="{ maxHeight: legendMaxHeight + 'px' }">
        <button
          v-for="p in partsList"
          :key="p.key"
          type="button"
          :class="[
            'w-full text-left rounded-lg border transition',
            compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
            modelValue === p.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 hover:bg-slate-50'
          ]"
          @click="select(p.key)"
        >
          {{ p.label }}
        </button>
      </div>

      <div v-if="modelValue" :class="['mt-3', compact ? 'text-xs' : 'text-sm']">
        <span class="text-slate-500">Seleccionado:</span>
        <span class="ml-2 font-medium">{{ keyToLabel(modelValue) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  legendMaxHeight: { type: Number, default: 160 },
})
const emit = defineEmits(['update:modelValue'])

/** Catálogo 1:1 con hotspots */
const PARTS = [
  // Carrocería
  { key: 'CAP',    label: 'Capó' },
  { key: 'PAD',    label: 'Parachoques delantero' },
  { key: 'PAR',    label: 'Parachoques trasero' },
  { key: 'CABINA', label: 'Cabina' },
  { key: 'PLATON', label: 'Platón' },
  { key: 'CARGA',  label: 'Área de carga' },

  // Vidrios
  { key: 'VID',    label: 'Vidrio frontal' },

  // Puertas
  { key: 'PDI', label: 'Puerta delantera izquierda' },
  { key: 'PTI', label: 'Puerta trasera izquierda' },
  { key: 'PDD', label: 'Puerta delantera derecha' },
  { key: 'PTD', label: 'Puerta trasera derecha' },

  // Espejos
  { key: 'EMI',    label: 'Espejo izquierdo' },
  { key: 'EMD',    label: 'Espejo derecho' },

  // Llantas
  { key: 'LTI',    label: 'Llanta delantera izquierda' },
  { key: 'LTD',    label: 'Llanta delantera derecha' },
  { key: 'LLI',    label: 'Llanta trasera izquierda' },
  { key: 'LLD',    label: 'Llanta trasera derecha' },

  // Luces
  { key: 'LFD',    label: 'Luz delantera izquierda' },
  { key: 'LFA',    label: 'Luz delantera derecha' },
  { key: 'LTD',    label: 'Luz trasera izquierda' },
  { key: 'LTA',    label: 'Luz trasera derecha' },

  // Guardabarros
  { key: 'GFDI', label: 'Guardabarros delantero izquierdo' },
  { key: 'GFDD', label: 'Guardabarros delantero derecho' },
  { key: 'GFTI', label: 'Guardabarros trasero izquierdo' },
  { key: 'GFTD', label: 'Guardabarros trasero derecho' },
]

const partsList = computed(() => PARTS)

function select(key){ emit('update:modelValue', key) }
function keyToLabel(key){ return PARTS.find(p => p.key === key)?.label || 'Parte' }

/* Tooltip */
const hoverLabel = ref('')
const tooltip = ref({ x: 0, y: 0 })
function setTip(key, evt){
  hoverLabel.value = keyToLabel(key)
  const rect = evt.currentTarget.ownerSVGElement?.getBoundingClientRect?.() || { left:0, top:0 }
  tooltip.value = { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
}
function clearTip(){ hoverLabel.value = '' }

/* Atributos comunes para hotspots */
function baseHS(key){
  const active = props.modelValue === key
  return {
    stroke: active ? '#2563eb' : 'transparent',
    'stroke-width': 2,
    fill: active ? '#dbeafe' : 'transparent',
    style: 'cursor:pointer; transition: all .12s ease',
    onMouseenter: e => setTip(key, e),
    onMousemove: e => setTip(key, e),
    onMouseleave: clearTip,
    onClick: () => select(key),
  }
}
function hsRect(key, x, y, w, h, r=8){
  return { x, y, width:w, height:h, rx:r, ...baseHS(key) }
}
function hsCircle(key, cx, cy, r){
  return { cx, cy, r, ...baseHS(key) }
}
function hsPath(key, d){
  return { d, ...baseHS(key) }
}
function hsPoly(key, points){
  return { points, ...baseHS(key) }
}
</script>
