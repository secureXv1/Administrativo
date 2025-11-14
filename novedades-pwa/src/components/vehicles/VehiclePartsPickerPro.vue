<template>
  <div
    class="grid gap-3"
    :class="compact ? 'sm:grid-cols-[1fr,260px]' : 'sm:grid-cols-[1fr,340px]'"
  >
    <!-- LIENZO -->
    <div :class="['rounded-2xl border border-slate-200 bg-white shadow-sm', compact ? 'p-2' : 'p-4']">
      <div class="flex items-center gap-2 mb-3">
        <button
          v-for="opt in views"
          :key="opt.key"
          type="button"
          :class="[
            'px-3 py-1.5 rounded-lg text-sm border transition',
            view === opt.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          ]"
          @click="view = opt.key"
        >
          {{ opt.label }}
        </button>
      </div>

      <div class="relative w-full rounded-xl overflow-hidden">
        <!-- Base: imagen fotorealista -->
        <svg
          :viewBox="currentView.viewBox"
          class="w-full h-auto block select-none"
          role="img"
          :aria-label="`Vehículo vista ${view}`"
        >
          <image
            :href="currentView.src"
            x="0" y="0"
            :width="currentView.width"
            :height="currentView.height"
            preserveAspectRatio="xMidYMid meet"
          />

          <!-- Overlay de hotspots -->
          <g>
            <template v-for="h in currentHotspots" :key="h.key">
              <rect v-if="h.type==='rect'"
                v-bind="rectAttrs(h)"
              />
              <circle v-else-if="h.type==='circle'"
                v-bind="circleAttrs(h)"
              />
              <polygon v-else-if="h.type==='poly'"
                v-bind="polyAttrs(h)"
              />
            </template>
          </g>
        </svg>

        <!-- Tooltip -->
        <div
          v-if="hoverLabel"
          class="absolute pointer-events-none px-2 py-1 text-xs rounded-md bg-slate-900 text-white shadow-md ring-1 ring-black/10"
          :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px', transform: 'translate(-50%, -120%)' }"
        >
          {{ hoverLabel }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

/** PROPS */
const props = defineProps({
  modelValue: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  legendMaxHeight: { type: Number, default: 200 },
  enableOtro: { type: Boolean, default: true },
  initialOtroText: { type: String, default: '' },

  topSrc:  { type: String, default: '/assets/pickup_top.png' },
  leftSrc: { type: String, default: '/assets/pickup_left.png' },
  rightSrc:{ type: String, default: '/assets/pickup_right.png' },

  // 🆕 partes que tienen novedades (se pintan en rojo)
  highlightKeys: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'otro-change'])

/** VISTAS DISPONIBLES */
const views = [
  { key:'top',    label:'Superior' },
]
const view = ref('top')

/** DIMENSIONES DE TRABAJO */
const VIEWBOXES = {
  top:   { width: 900, height: 520, viewBox: '0 0 900 520' },
}

/** IMÁGENES POR VISTA */
const currentView = computed(() => {
  const v = view.value
  const meta = VIEWBOXES[v]
  const src = v === 'top' ? props.topSrc : v === 'left' ? props.leftSrc : props.rightSrc
  return { ...meta, src }
})

/** PARTES Y HOTSPOTS */
const PARTS = {
  top: [
    { key:'CAP', label:'Capó' },
    { key:'VID', label:'Parabrisas delantero' },
    { key:'VIT', label:'Parabrisas trasero' },
    { key:'VDI', label:'Vidrio delantero izq.' },
    { key:'VTI', label:'Vidrio trasero izq.' },
    { key:'VDD', label:'Vidrio delanterio der.' },
    { key:'VTD', label:'Vidrio trasero der.' },
    { key:'CABINA', label:'Techo' },
    { key:'PLATON', label:'Platón' },
    { key:'CARGA', label:'Área de carga' },
    { key:'LTI', label:'Llanta delantera izq.' },
    { key:'LTD', label:'Llanta delantera der.' },
    { key:'LLI', label:'Llanta trasera izq.' },
    { key:'LLD', label:'Llanta trasera der.' },
    { key:'LFD', label:'Luz delantera izq.' },
    { key:'LFA', label:'Luz delantera der.' },
    { key:'LTD_T', label:'Luz trasera izq.' },
    { key:'LTA_T', label:'Luz trasera der.' },
    { key:'PAR_L', label:'Parachoques trasero' },
    { key:'PDI', label:'Puerta delantera izq.' },
    { key:'PTI', label:'Puerta trasera izq.' },
    { key:'PAD_R', label:'Parachoques delantero' },
    { key:'EMI', label:'Espejo izq.' },
    { key:'EMD', label:'Espejo der.' },
    { key:'PDD', label:'Puerta delantera der.' },
    { key:'PTD', label:'Puerta trasera der.' },
    { key:'GDI', label:'Guardabarro delantero izq.' },
    { key:'GTI', label:'Guardabarro trasero izq.' },
    { key:'GDD', label:'Guardabarro delantero der.' },
    { key:'GTD', label:'Guardabarro trasero der.' },
  ],
}

const HS = {
  top: [
    { key:'CAP', type:'rect', x:90, y:30, w:70, h:130, r:20 },
    { key:'VID', type:'poly', points:'625,25 780,25 795,70 610,70' },
    { key:'VIT', type:'poly', points:'625,310 770,310 785,350 610,350' },
    { key:'CABINA', type:'rect', x:220, y:40, w:140, h:110, r:18 },
    { key:'PLATON', type:'rect', x:610, y:360, w:180, h:70, r:12 },
    { key:'CARGA', type:'rect', x:380, y:30, w:140, h:135, r:8 },
    { key:'LTI', type:'circle', cx:143, cy:320, r:33 },
    { key:'LTD', type:'circle', cx:465, cy:485, r:33 },
    { key:'LLI', type:'circle', cx:430, cy:320, r:33 },
    { key:'LLD', type:'circle', cx:175, cy:485, r:34 },
    { key:'LFD', type:'rect', x:770, y:95, w:50, h:30, r:3 },
    { key:'LFA', type:'rect', x:590, y:95, w:50, h:30, r:3 },
    { key:'LTD_T', type:'rect', x:580, y:375, w:25, h:55, r:3 },
    { key:'LTA_T', type:'rect', x:795, y:375, w:25, h:55, r:3 },
    { key:'PAR_L', type:'rect', x:580, y:435, w:240, h:28, r:6 },
    { key:'PAD_R', type:'rect', x:585, y:140, w:235, h:50, r:6 },
    { key:'PDI', type:'rect', x:200, y:245, w:90, h:70, r:6 },
    { key:'PTI', type:'rect', x:295, y:245, w:80, h:70, r:6 },
    { key:'PDD', type:'rect', x:320, y:410, w:90, h:70, r:6 },
    { key:'PTD', type:'rect', x:230, y:410, w:80, h:70, r:6 },
    { key:'EMI', type:'rect', x:805, y:55, w:30, h:30, r:3 },
    { key:'EMD', type:'rect', x:570, y:55, w:30, h:30, r:3 },
    { key:'GDI', type:'rect', x:100, y:250, w:90, h:30, r:9 },
    { key:'GTI', type:'rect', x:390, y:250, w:140, h:30, r:9 },
    { key:'GDD', type:'rect', x:420, y:420, w:90, h:30, r:9 },
    { key:'GTD', type:'rect', x:80, y:420, w:140, h:30, r:9 },
    { key:'VDI', type:'rect', x:235, y:200, w:50, h:40, r:9 },
    { key:'VTI', type:'rect', x:305, y:200, w:50, h:40, r:9 },
    { key:'VDD', type:'rect', x:325, y:370, w:50, h:40, r:9 },
    { key:'VTD', type:'rect', x:250, y:370, w:50, h:40, r:9 },
  ],
}

/** estado local */
const otroText = ref(props.initialOtroText)
watch(() => props.initialOtroText, v => { otroText.value = v })

const hoverLabel = ref('')
const tooltip = ref({ x: 0, y: 0 })

/** Derivados */
const partsListForView = computed(() => PARTS[view.value])
const currentHotspots = computed(() => HS[view.value])
const highlightSet = computed(() => new Set(props.highlightKeys || []))

/** Select + etiquetas */
function select(key){
  emit('update:modelValue', key)
  if (key === 'OTRO') emit('otro-change', otroText.value)
}
function keyToLabel(key){
  const list = partsListForView.value || []
  if (key === 'OTRO') return 'OTRO (especificar)'
  return list.find(p => p.key === key)?.label || 'Parte'
}

/** Eventos tooltip */
function setTip(key, evt){
  hoverLabel.value = keyToLabel(key)
  const rect = evt.currentTarget.ownerSVGElement?.getBoundingClientRect?.() || { left:0, top:0 }
  tooltip.value = { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
}
function clearTip(){ hoverLabel.value = '' }

/** Atributos comunes */
function baseHS(key){
  const active = key === modelValue.value
  const hasIssue = highlightSet.value.has(key)

  let stroke, fill
  if (hasIssue) {
    // rojo cuando tiene novedades
    stroke = active ? '#b91c1c' : '#'
    fill   = active ? 'rgba(185,28,28,0.28)' : 'rgba(248,113,113,0.24)'
  } else {
    // azul para selección normal
    stroke = active ? '#2563eb' : 'transparent'
    fill   = active ? 'rgba(37,99,235,0.20)' : 'rgba(59,130,246,0.10)'
  }

  return {
    stroke,
    'stroke-width': 2,
    fill,
    style: 'cursor:pointer; transition:all .12s ease',
    onMouseenter: e => setTip(key, e),
    onMousemove: e => setTip(key, e),
    onMouseleave: clearTip,
    onClick: () => select(key),
  }
}
function rectAttrs(h){ return { x:h.x, y:h.y, width:h.w, height:h.h, rx:h.r||0, ...baseHS(h.key) } }
function circleAttrs(h){ return { cx:h.cx, cy:h.cy, r:h.r, ...baseHS(h.key) } }
function polyAttrs(h){ return { points:h.points, ...baseHS(h.key) } }

/** v-model */
const modelValue = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})
</script>

<style scoped>
:deep(svg) {
  shape-rendering: geometricPrecision;
  text-rendering: optimizeLegibility;
}
</style>
