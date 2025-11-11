<template>
  <div
    class="grid gap-3"
    :class="compact ? 'sm:grid-cols-[1fr,240px]' : 'sm:grid-cols-[1fr,320px]'"
  >
    <!-- LIENZO -->
    <div
      :class="[
        'rounded-2xl border border-slate-200 shadow-sm',
        compact ? 'bg-white p-2' : 'bg-white p-4'
      ]"
    >
      <!-- Fondo “paper” sutil -->
      <div class="relative w-full flex justify-center rounded-xl overflow-hidden">
        <div
          class="absolute inset-0 opacity-[0.035] pointer-events-none"
          style="background-image:
            radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 1.2px),
            radial-gradient(circle at 8px 8px, #0f172a 1px, transparent 1.2px);
            background-size: 12px 12px;"
        ></div>

        <!-- === SVG base (look & feel) === -->
        <!-- CAMIONETA -->
        <svg
          v-if="!isMoto"
          viewBox="0 0 900 520"
          class="w-full h-auto select-none"
          role="img"
          aria-label="Camioneta moderna con platón"
        >
          <defs>
            <!-- Sombras -->
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2.5" stdDeviation="3" flood-opacity="0.18" />
            </filter>
            <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feOffset dx="0" dy="1" />
              <feGaussianBlur stdDeviation="1.2" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="arithmetic" k2="-1" k3="1"/>
            </filter>

            <!-- Gradientes carrocería / vidrio / metal / neumático -->
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"  stop-color="#e5e7eb"/>
              <stop offset="45%" stop-color="#cfd5dd"/>
              <stop offset="100%" stop-color="#bfc6cf"/>
            </linearGradient>

            <linearGradient id="bedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stop-color="#e2e8f0"/>
              <stop offset="100%" stop-color="#cbd5e1"/>
            </linearGradient>

            <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stop-color="#dbeafe"/>
              <stop offset="50%" stop-color="#c7d2fe"/>
              <stop offset="100%" stop-color="#bfdbfe"/>
            </linearGradient>

            <linearGradient id="chromeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stop-color="#9ca3af"/>
              <stop offset="50%" stop-color="#f3f4f6"/>
              <stop offset="100%" stop-color="#6b7280"/>
            </linearGradient>

            <radialGradient id="tireGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stop-color="#253248"/>
              <stop offset="100%" stop-color="#0f172a"/>
            </radialGradient>

            <linearGradient id="lightFront" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#fde68a"/>
              <stop offset="100%" stop-color="#fbbf24"/>
            </linearGradient>
            <linearGradient id="lightRear" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#f87171"/>
              <stop offset="100%" stop-color="#ef4444"/>
            </linearGradient>
          </defs>

          <g filter="url(#softShadow)">
            <!-- Parachoques delantero -->
            <rect x="280" y="30" width="340" height="30" rx="8"
              fill="url(#chromeGrad)"
              stroke="#64748b" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
            <!-- Capó -->
            <rect x="290" y="60" width="320" height="40" rx="10"
              fill="url(#bodyGrad)"
              stroke="#64748b" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
            <!-- Bisel capó -->
            <rect x="292" y="62" width="316" height="36" rx="9"
              fill="none" stroke="#64748b" stroke-opacity=".25"
              vector-effect="non-scaling-stroke"/>

            <!-- Luces delanteras -->
            <rect x="295" y="35" width="20" height="10" rx="2" fill="url(#lightFront)"/>
            <rect x="585" y="35" width="20" height="10" rx="2" fill="url(#lightFront)"/>

            <!-- Cabina -->
            <rect x="310" y="100" width="280" height="140" rx="20"
              fill="url(#bodyGrad)" filter="url(#innerShadow)"
              stroke="#64748b" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
            <!-- Vidrio frontal -->
            <polygon points="330,110 570,110 570,160 330,160"
              fill="url(#glassGrad)"
              stroke="#64748b" stroke-width="1.2" vector-effect="non-scaling-stroke" />
            <!-- Brillo vidrio -->
            <polygon points="330,110 500,110 470,140 330,140" fill="#fff" opacity=".12"/>

            <!-- Puertas (4) -->
            <g fill="#ffffff">
              <rect x="320" y="130" width="60" height="100" rx="6"
                stroke="#64748b" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
              <rect x="390" y="130" width="60" height="100" rx="6"
                stroke="#64748b" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
              <rect x="460" y="130" width="60" height="100" rx="6"
                stroke="#64748b" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
              <rect x="530" y="130" width="60" height="100" rx="6"
                stroke="#64748b" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
            </g>
            <!-- Manijas -->
            <g fill="#cbd5e1">
              <rect x="365" y="150" width="16" height="6" rx="3"/>
              <rect x="435" y="150" width="16" height="6" rx="3"/>
              <rect x="505" y="150" width="16" height="6" rx="3"/>
              <rect x="575" y="150" width="16" height="6" rx="3"/>
            </g>

            <!-- Espejos -->
            <rect x="305" y="150" width="10" height="20" rx="2" fill="url(#chromeGrad)"/>
            <rect x="585" y="150" width="10" height="20" rx="2" fill="url(#chromeGrad)"/>

            <!-- Platón -->
            <rect x="290" y="260" width="320" height="160" rx="10"
              fill="url(#bedGrad)"
              stroke="#64748b" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
            <rect x="300" y="270" width="300" height="140" rx="6"
              fill="#d9e2ec"
              stroke="#64748b" stroke-width="1" vector-effect="non-scaling-stroke"/>
            <!-- Lamas del platón -->
            <g stroke="#94a3b8" stroke-width="1" opacity=".55">
              <line x1="305" y1="290" x2="595" y2="290"/>
              <line x1="305" y1="310" x2="595" y2="310"/>
              <line x1="305" y1="330" x2="595" y2="330"/>
              <line x1="305" y1="350" x2="595" y2="350"/>
            </g>

            <!-- Parachoques trasero -->
            <rect x="280" y="440" width="340" height="30" rx="8"
              fill="url(#chromeGrad)"
              stroke="#64748b" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
            <!-- Luces traseras -->
            <rect x="295" y="445" width="20" height="10" rx="2" fill="url(#lightRear)"/>
            <rect x="585" y="445" width="20" height="10" rx="2" fill="url(#lightRear)"/>

            <!-- Ruedas -->
            <g>
              <g transform="translate(290,130)">
                <circle r="24" fill="url(#tireGrad)"/>
                <circle r="12" fill="#e5e7eb"/>
                <circle r="4"  fill="#64748b"/>
              </g>
              <g transform="translate(610,130)">
                <circle r="24" fill="url(#tireGrad)"/>
                <circle r="12" fill="#e5e7eb"/>
                <circle r="4"  fill="#64748b"/>
              </g>
              <g transform="translate(290,400)">
                <circle r="24" fill="url(#tireGrad)"/>
                <circle r="12" fill="#e5e7eb"/>
                <circle r="4"  fill="#64748b"/>
              </g>
              <g transform="translate(610,400)">
                <circle r="24" fill="url(#tireGrad)"/>
                <circle r="12" fill="#e5e7eb"/>
                <circle r="4"  fill="#64748b"/>
              </g>
            </g>

            <!-- Guardabarros (solo trazo suave) -->
            <path d="M314,106 a30,30 0 0 1 -48,48" stroke="#94a3b8" stroke-width="2" fill="none" opacity=".6"/>
            <path d="M586,106 a30,30 0 0 0 48,48" stroke="#94a3b8" stroke-width="2" fill="none" opacity=".6"/>
            <path d="M314,394 a30,30 0 0 0 -48,-48" stroke="#94a3b8" stroke-width="2" fill="none" opacity=".6"/>
            <path d="M586,394 a30,30 0 0 1 48,-48" stroke="#94a3b8" stroke-width="2" fill="none" opacity=".6"/>
          </g>
        </svg>

        <!-- MOTO -->
        <svg
          v-else
          viewBox="0 0 900 520"
          class="w-full h-auto select-none"
          role="img"
          aria-label="Motocicleta vista superior"
        >
          <defs>
            <filter id="softShadow2" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.18" />
            </filter>
            <linearGradient id="frameGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stop-color="#e5e7eb"/>
              <stop offset="100%" stop-color="#cbd5e1"/>
            </linearGradient>
            <linearGradient id="tankGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"  stop-color="#c7d2fe"/>
              <stop offset="100%" stop-color="#a5b4fc"/>
            </linearGradient>
            <linearGradient id="seatGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stop-color="#e2e8f0"/>
              <stop offset="100%" stop-color="#cbd5e1"/>
            </linearGradient>
            <radialGradient id="tireGrad2" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stop-color="#253248"/>
              <stop offset="100%" stop-color="#0f172a"/>
            </radialGradient>
            <radialGradient id="headlightGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stop-color="#fff59d"/>
              <stop offset="100%" stop-color="#facc15"/>
            </radialGradient>
          </defs>

          <g filter="url(#softShadow2)">
            <!-- Llantas -->
            <g>
              <g transform="translate(450,100)">
                <circle r="35" fill="url(#tireGrad2)"/>
                <circle r="18" fill="#e5e7eb"/>
                <circle r="5"  fill="#64748b"/>
              </g>
              <g transform="translate(450,420)">
                <circle r="35" fill="url(#tireGrad2)"/>
                <circle r="18" fill="#e5e7eb"/>
                <circle r="5"  fill="#64748b"/>
              </g>
            </g>

            <!-- Chasis -->
            <rect x="430" y="160" width="40" height="200" rx="8"
              fill="url(#frameGrad)" stroke="#64748b" stroke-width="1.6" vector-effect="non-scaling-stroke"/>

            <!-- Tanque -->
            <rect x="410" y="200" width="80" height="80" rx="20"
              fill="url(#tankGrad)" stroke="#64748b" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
            <!-- Brillo tanque -->
            <path d="M420,210 h40 a16,16 0 0 1 16,16 v0"
              fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="3"/>

            <!-- Asiento -->
            <rect x="410" y="290" width="80" height="60" rx="10"
              fill="url(#seatGrad)" stroke="#64748b" stroke-width="1.4" vector-effect="non-scaling-stroke"/>

            <!-- Faro -->
            <circle cx="450" cy="140" r="22"
              fill="url(#headlightGrad)" stroke="#64748b" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
            <!-- Halo leve del faro -->
            <circle cx="450" cy="140" r="32" fill="#fde68a" opacity=".10"/>

            <!-- Escape -->
            <rect x="475" y="360" width="60" height="15" rx="5"
              fill="#cbd5e1" stroke="#64748b" stroke-width="1.2" vector-effect="non-scaling-stroke"/>

            <!-- Manubrios -->
            <rect x="370" y="130" width="160" height="8" rx="4"
              fill="#cbd5e1" stroke="#64748b" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
            <!-- Puños -->
            <rect x="365" y="128" width="10" height="12" rx="2" fill="#94a3b8"/>
            <rect x="525" y="128" width="10" height="12" rx="2" fill="#94a3b8"/>

            <!-- Espejos -->
            <rect x="355" y="115" width="20" height="12" rx="2"
              fill="#d1d5db" stroke="#64748b" stroke-width="1" vector-effect="non-scaling-stroke"/>
            <rect x="525" y="115" width="20" height="12" rx="2"
              fill="#d1d5db" stroke="#64748b" stroke-width="1" vector-effect="non-scaling-stroke"/>
          </g>
        </svg>

        <!-- === Overlay interactivo (hotspots) === -->
        <svg class="absolute inset-0 w-full h-full" viewBox="0 0 900 520" aria-hidden="true">
          <defs>
            <!-- Glow para parte activa -->
            <filter id="hsGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <!-- Camioneta -->
          <template v-if="!isMoto">
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
          </template>

          <!-- Moto -->
          <template v-else>
            <circle v-bind="hsCircle('LL_DEL',450,100,35)" />
            <circle v-bind="hsCircle('LL_TRA',450,420,35)" />
            <rect v-bind="hsRect('CHASIS',430,160,40,200,8)" />
            <rect v-bind="hsRect('TANQUE',410,200,80,80,20)" />
            <rect v-bind="hsRect('ASIENTO',410,290,80,60,10)" />
            <circle v-bind="hsCircle('FARO',450,140,22)" />
            <rect v-bind="hsRect('ESCAPE',475,360,60,15,5)" />
            <rect v-bind="hsRect('MANUBRIO',370,130,160,8,4)" />
            <rect v-bind="hsRect('ESPI',355,115,20,12,2)" />
            <rect v-bind="hsRect('ESPD',525,115,20,12,2)" />
          </template>
        </svg>

        <!-- Tooltip -->
        <div
          v-if="hoverLabel"
          class="absolute pointer-events-none px-2 py-1 text-xs rounded-md bg-slate-900 text-white shadow-md ring-1 ring-black/10"
          :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px', transform: 'translate(-50%,-120%)' }"
        >
          {{ hoverLabel }}
        </div>
      </div>
    </div>

    <!-- LEYENDA -->
    <div :class="['rounded-2xl border border-slate-200 shadow-sm', compact ? 'bg-white p-2' : 'bg-white p-3']">
      <div class="text-xs text-slate-500 mb-2">Toca una zona del dibujo o usa la lista:</div>

      <div class="grid grid-cols-1 gap-2 pr-1 overflow-auto" :style="{ maxHeight: legendMaxHeight + 'px' }">
        <button
          v-for="p in partsListFiltered"
          :key="p.key"
          type="button"
          :class="[
            'w-full text-left rounded-lg border transition focus:outline-none focus:ring-2',
            compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
            modelValue === p.key
              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-blue-200'
              : 'border-slate-300 hover:bg-slate-50 ring-transparent'
          ]"
          @click="select(p.key)"
        >
          {{ p.label }}
        </button>

        <!-- OTRO (solo uno) -->
        <button
          v-if="enableOtro"
          type="button"
          :class="[
            'w-full text-left rounded-lg border transition focus:outline-none focus:ring-2',
            compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
            modelValue === 'OTRO'
              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-blue-200'
              : 'border-slate-300 hover:bg-slate-50 ring-transparent'
          ]"
          @click="select('OTRO')"
        >
          OTRO (especificar)
        </button>
      </div>

      <div v-if="modelValue" :class="['mt-3', compact ? 'text-xs' : 'text-sm']">
        <span class="text-slate-500">Seleccionado:</span>
        <span class="ml-2 font-medium">
          <template v-if="modelValue === 'OTRO'">OTRO: {{ otroText || '(sin detalle)' }}</template>
          <template v-else>{{ keyToLabel(modelValue) }}</template>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  isMoto: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  legendMaxHeight: { type: Number, default: 180 },
  enableOtro: { type: Boolean, default: true },
  initialOtroText: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'otro-change'])

/** Catálogos */
const PARTS_AUTO = [
  { key: 'CAP',    label: 'Capó' },
  { key: 'PAD',    label: 'Parachoques delantero' },
  { key: 'PAR',    label: 'Parachoques trasero' },
  { key: 'CABINA', label: 'Cabina' },
  { key: 'PLATON', label: 'Platón' },
  { key: 'CARGA',  label: 'Área de carga' },
  { key: 'VID',    label: 'Vidrio frontal' },
  { key: 'PDI', label: 'Puerta delantera izquierda' },
  { key: 'PTI', label: 'Puerta trasera izquierda' },
  { key: 'PDD', label: 'Puerta delantera derecha' },
  { key: 'PTD', label: 'Puerta trasera derecha' },
  { key: 'EMI', label: 'Espejo izquierdo' },
  { key: 'EMD', label: 'Espejo derecho' },
  { key: 'LTI', label: 'Llanta delantera izquierda' },
  { key: 'LTD', label: 'Llanta delantera derecha' },
  { key: 'LLI', label: 'Llanta trasera izquierda' },
  { key: 'LLD', label: 'Llanta trasera derecha' },
  { key: 'LFD', label: 'Luz delantera izquierda' },
  { key: 'LFA', label: 'Luz delantera derecha' },
  { key: 'LTD', label: 'Luz trasera izquierda' },
  { key: 'LTA', label: 'Luz trasera derecha' },
  { key: 'GFDI', label: 'Guardabarros delantero izquierdo' },
  { key: 'GFDD', label: 'Guardabarros delantero derecho' },
  { key: 'GFTI', label: 'Guardabarros trasero izquierdo' },
  { key: 'GFTD', label: 'Guardabarros trasero derecho' },
]

const PARTS_MOTO = [
  { key: 'LL_DEL',  label: 'Llanta delantera' },
  { key: 'LL_TRA',  label: 'Llanta trasera' },
  { key: 'CHASIS',  label: 'Chasis' },
  { key: 'TANQUE',  label: 'Tanque de gasolina' },
  { key: 'ASIENTO', label: 'Asiento' },
  { key: 'FARO',    label: 'Faro delantero' },
  { key: 'ESCAPE',  label: 'Escape' },
  { key: 'MANUBRIO',label: 'Manubrio' },
  { key: 'ESPI',    label: 'Espejo izquierdo' },
  { key: 'ESPD',    label: 'Espejo derecho' },
]

// Lista mostrada (sin OTRO)
const partsListFiltered = computed(() => {
  const list = props.isMoto ? PARTS_MOTO : PARTS_AUTO
  return list.filter(p => p.key !== 'OTRO')
})

function select(key){
  emit('update:modelValue', key)
  if (key === 'OTRO') emit('otro-change', otroText.value)
}
function keyToLabel(key){
  const list = props.isMoto ? PARTS_MOTO : PARTS_AUTO
  if (key === 'OTRO') return 'OTRO (especificar)'
  return list.find(p => p.key === key)?.label || 'Parte'
}

/* Texto para OTRO */
const otroText = ref(props.initialOtroText)
watch(() => props.initialOtroText, v => { otroText.value = v })

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
    filter: active ? 'url(#hsGlow)' : 'none',
    style: 'cursor:pointer; transition: all .12s ease',
    onMouseenter: e => setTip(key, e),
    onMousemove: e => setTip(key, e),
    onMouseleave: clearTip,
    onClick: () => select(key),
  }
}
function hsRect(key, x, y, w, h, r=8){ return { x, y, width:w, height:h, rx:r, ...baseHS(key) } }
function hsCircle(key, cx, cy, r){ return { cx, cy, r, ...baseHS(key) } }
function hsPath(key, d){ return { d, ...baseHS(key) } }
function hsPoly(key, points){ return { points, ...baseHS(key) } }
</script>

<style scoped>
:deep(svg) {
  shape-rendering: geometricPrecision;
  text-rendering: optimizeLegibility;
}
</style>
