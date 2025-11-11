<!-- VehiclePartsPickerPro.vue -->
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
              <!-- Soporta rect / circle / poly -->
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

    <!-- LEYENDA -->
    <div :class="['rounded-2xl border border-slate-200 bg-white shadow-sm', compact ? 'p-2' : 'p-3']">
      
      <!--div class="grid grid-cols-1 gap-2 pr-1 overflow-auto" :style="{ maxHeight: legendMaxHeight + 'px' }">
        <button
          v-for="p in partsListForView"
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
      </div-->

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

/** PROPS */
const props = defineProps({
  modelValue: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  legendMaxHeight: { type: Number, default: 200 },
  enableOtro: { type: Boolean, default: true },
  initialOtroText: { type: String, default: '' },

  /** Reemplaza estas rutas por tus assets reales */
  topSrc:  { type: String, default: '/assets/pickup_top.png' },
  //leftSrc: { type: String, default: '/assets/pickup_left.png' },
  //rightSrc:{ type: String, default: '/assets/pickup_right.png' },
})

const emit = defineEmits(['update:modelValue', 'otro-change'])

/** VISTAS DISPONIBLES */
const views = [
  { key:'top',    label:'Superior' },
  //{ key:'left',   label:'Lateral izq.' },
  //{ key:'right',  label:'Lateral der.' },
]
const view = ref('top')

/** DIMENSIONES DE TRABAJO (ajústalas a cada imagen) */
const VIEWBOXES = {
  top:   { width: 900, height: 520, viewBox: '0 0 900 520' },
  //left:  { width: 900, height: 300, viewBox: '0 0 900 300' },
  //right: { width: 900, height: 300, viewBox: '0 0 900 300' },
}

/** IMÁGENES POR VISTA */
const currentView = computed(() => {
  const v = view.value
  const meta = VIEWBOXES[v]
  const src = v === 'top' ? props.topSrc : v === 'left' ? props.leftSrc : props.rightSrc
  return { ...meta, src }
})

/** PARTES Y HOTSPOTS (ejemplo) */
const PARTS = {
  top: [
    { key:'CAP', label:'Capó' },
    { key:'VID', label:'Parabrisas' },
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
  ],
  //left: [
    //{ key:'LTI_L', label:'Llanta delantera' },
    //{ key:'LLI_L', label:'Llanta trasera' },
  //],
  //right: [
    //{ key:'LTD_R', label:'Llanta delantera' },
    //{ key:'LLD_R', label:'Llanta trasera' },  
  //],
}

/** Hotspots por vista (coordenadas en el mismo sistema del viewBox) */
const HS = {
  top: [
    // capó (rect)
    { key:'CAP', type:'rect', x:90, y:30, w:70, h:130, r:20 },
    // parabrisas (poly aproximado)
    { key:'VID', type:'poly', points:'625,25 780, 25, 795,70 610,70' },
    // cabina
    { key:'CABINA', type:'rect', x:220, y:40, w:140, h:110, r:18 },
    // platón
    { key:'PLATON', type:'rect', x:610, y:360, w:180, h:70, r:12 },
    { key:'CARGA', type:'rect', x:380, y:30, w:140, h:135, r:8 },
    // llantas
    { key:'LTI', type:'circle', cx:143, cy:320, r:33 },
    { key:'LTD', type:'circle', cx:465, cy:485, r:33 },
    { key:'LLI', type:'circle', cx:430, cy:320, r:33 },
    { key:'LLD', type:'circle', cx:175, cy:485, r:34 },
    // luces
    { key:'LFD', type:'rect', x:770, y:95, w:50, h:30, r:3 },
    { key:'LFA', type:'rect', x:590, y:95, w:50, h:30, r:3 },
    { key:'LTD_T', type:'rect', x:580, y:375, w:25, h:55, r:3 },
    { key:'LTA_T', type:'rect', x:795, y:375, w:25, h:55, r:3 },
    // Parachoques
    { key:'PAR_L', type:'rect', x:580, y:435, w:240, h:28, r:6 },
    { key:'PAD_R', type:'rect', x:585, y:140, w:235, h:50, r:6 },
    //Puertas
    { key:'PDI', type:'rect', x:200, y:245, w:90, h:70, r:6 },
    { key:'PTI', type:'rect', x:295, y:245, w:80, h:70, r:6 },
    { key:'PDD', type:'rect', x:320, y:410, w:90, h:70, r:6 },
    { key:'PTD', type:'rect', x:230, y:410, w:80, h:70, r:6 },
    //Espejos
    { key:'EMI', type:'rect', x:805, y:55, w:30, h:30, r:3 },
    { key:'EMD', type:'rect', x:570, y:55, w:30, h:30, r:3 },
  ],
  //left: [
    //{ key:'LTI_L', type:'circle', cx:155, cy:240, r:60 },
    //{ key:'LLI_L', type:'circle', cx:683, cy:240, r:60 },
  //],
  //right: [
    //{ key:'LTD_R', type:'circle', cx:280, cy:220, r:38 },
    //{ key:'LLD_R', type:'circle', cx:630, cy:220, r:38 },
  //],
}

/** estado local */
const otroText = ref(props.initialOtroText)
watch(() => props.initialOtroText, v => { otroText.value = v })

const hoverLabel = ref('')
const tooltip = ref({ x: 0, y: 0 })

/** Derivados */
const partsListForView = computed(() => PARTS[view.value])
const currentHotspots = computed(() => HS[view.value])

/** Select + etiquetas */
function select(key){
  emit('update:modelValue', key)
  if (key === 'OTRO') emit('otro-change', otroText.value)
}
function keyToLabel(key){
  const list = PARTS[view.value]
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
  return {
    stroke: active ? '#2563eb' : 'transparent',
    'stroke-width': 2,
    fill: active ? 'rgba(37,99,235,0.12)' : 'rgba(59,130,246,0.10)',
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
/* Mejora de renderizado y foco del overlay */
:deep(svg) {
  shape-rendering: geometricPrecision;
  text-rendering: optimizeLegibility;
}
</style>
