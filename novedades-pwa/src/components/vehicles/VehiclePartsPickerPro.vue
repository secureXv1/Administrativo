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

  // 🏍️ modo moto
  isMoto: { type: Boolean, default: false },

  //categoría real vehículo (CM, MT, LP)
  vehicleCategory: { type: String, default: '' },
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
// 🚐 Croquis vehículo (pickup)
const PARTS_AUTO = {
  top: [
    { key:'CAP',    label:'Capó' },
    { key:'VID',    label:'Parabrisas delantero' },
    { key:'VIT',    label:'Parabrisas trasero' },
    { key:'VDI',    label:'Vidrio delantero izq.' },
    { key:'VTI',    label:'Vidrio trasero izq.' },
    { key:'VDD',    label:'Vidrio delanterio der.' },
    { key:'VTD',    label:'Vidrio trasero der.' },
    { key:'CABINA', label:'Techo' },
    { key:'PLATON', label:'Platón' },
    { key:'CARGA',  label:'Área de carga' },
    { key:'LTI',    label:'Llanta delantera izq.' },
    { key:'LTD',    label:'Llanta delantera der.' },
    { key:'LLI',    label:'Llanta trasera izq.' },
    { key:'LLD',    label:'Llanta trasera der.' },
    { key:'LFD',    label:'Luz delantera izq.' },
    { key:'LFA',    label:'Luz delantera der.' },
    { key:'LTD_T',  label:'Luz trasera izq.' },
    { key:'LTA_T',  label:'Luz trasera der.' },
    { key:'PAR_L',  label:'Parachoques trasero' },
    { key:'PDI',    label:'Puerta delantera izq.' },
    { key:'PTI',    label:'Puerta trasera izq.' },
    { key:'PAD_R',  label:'Parachoques delantero' },
    { key:'EMI',    label:'Espejo izq.' },
    { key:'EMD',    label:'Espejo der.' },
    { key:'PDD',    label:'Puerta delantera der.' },
    { key:'PTD',    label:'Puerta trasera der.' },
    { key:'GDI',    label:'Guardabarro delantero izq.' },
    { key:'GTI',    label:'Guardabarro trasero izq.' },
    { key:'GDD',    label:'Guardabarro delantero der.' },
    { key:'GTD',    label:'Guardabarro trasero der.' },
  ],
}

const HS_AUTO = {
  top: [
    { key:'CAP',    type:'rect',   x:90,  y:30,  w:70,  h:130, r:20 },
    { key:'VID',    type:'poly',   points:'625,25 780,25 795,70 610,70' },
    { key:'VIT',    type:'poly',   points:'625,310 770,310 785,350 610,350' },
    { key:'VDI',    type:'rect',   x:220, y:200, w:70,  h:40,  r:6 },
    { key:'VTI',    type:'rect',   x:300, y:200, w:60,  h:40,  r:6 },
    { key:'VDD',    type:'rect',   x:320, y:370, w:70,  h:40,  r:6 },
    { key:'VTD',    type:'rect',   x:250, y:370, w:60,  h:40,  r:6 },
    { key:'CABINA', type:'rect',   x:220, y:40,  w:140, h:110, r:18 },
    { key:'PLATON', type:'rect',   x:610, y:360, w:180, h:70,  r:12 },
    { key:'CARGA',  type:'rect',   x:380, y:30,  w:140, h:135, r:8 },
    { key:'LTI',    type:'circle', cx:143, cy:320, r:33 },
    { key:'LTD',    type:'circle', cx:465, cy:485, r:33 },
    { key:'LLI',    type:'circle', cx:430, cy:320, r:33 },
    { key:'LLD',    type:'circle', cx:175, cy:485, r:34 },
    { key:'LFD',    type:'rect',   x:770, y:95,  w:50,  h:30,  r:3 },
    { key:'LFA',    type:'rect',   x:590, y:95,  w:50,  h:30,  r:3 },
    { key:'LTD_T',  type:'rect',   x:580, y:375, w:25,  h:55,  r:3 },
    { key:'LTA_T',  type:'rect',   x:795, y:375, w:25,  h:55,  r:3 },
    { key:'PAR_L',  type:'rect',   x:580, y:435, w:240, h:28,  r:6 },
    { key:'PAD_R',  type:'rect',   x:585, y:140, w:235, h:50,  r:6 },
    { key:'PDI',    type:'rect',   x:200, y:245, w:90,  h:70,  r:6 },
    { key:'PTI',    type:'rect',   x:295, y:245, w:80,  h:70,  r:6 },
    { key:'PDD',    type:'rect',   x:320, y:410, w:90,  h:70,  r:6 },
    { key:'PTD',    type:'rect',   x:230, y:410, w:80,  h:70,  r:6 },
    { key:'EMI',    type:'rect',   x:805, y:55,  w:30,  h:30,  r:3 },
    { key:'EMD',    type:'rect',   x:570, y:55,  w:30,  h:30,  r:3 },
    { key:'GDI',    type:'rect',   x:100, y:250, w:90,  h:30,  r:9 },
    { key:'GTI',    type:'rect',   x:390, y:250, w:140, h:30,  r:9 },
    { key:'GDD',    type:'rect',   x:420, y:420, w:90,  h:30,  r:9 },
    { key:'GTD',    type:'rect',   x:90, y:420, w:140, h:30,  r:9 },
  ],
}

// 🏍️ Croquis moto (vista superior)
// Usamos las MISMAS keys que ya tienes en el modal: TANQUE, CUP, MAN_D, MAN_I, etc.
const PARTS_MOTO = {
  top: [
    { key:'TANQUE', label:'Tanque' },
    { key:'CUP',    label:'Cúpula / faro' },
    { key:'MAN_D',  label:'Manubrio derecho' },
    { key:'MAN_I',  label:'Manubrio izquierdo' },
    { key:'POSAD',   label:'Posapiés der.' },
    { key:'POSAI',   label:'Posapiés izq.' },
    { key:'GUARD',   label:'Guardabarro del.' },
    { key:'GUART',   label:'Guardabarro tra.' },
    { key:'LL_DEL', label:'Llanta delantera' },
    { key:'LL_TRA', label:'Llanta trasera' },
    { key:'ESPED',   label:'Espejo der.' },
    { key:'ESPEI',   label:'Espejo izq.' },
    { key:'SILL',   label:'Sillin' },
    { key:'TC',   label:'Tacometro' },
    { key:'STOP',   label:'Stop' },
    { key:'TPD',   label:'Tapas der' },
    { key:'TPI',   label:'Tapas izq' },
    { key:'DIRDD',   label:'Direccional del. der' },
    { key:'DIRDI',   label:'Direccional del. izq' },
    { key:'DIRTD',   label:'Direccional tra. der' },
    { key:'DIRTI',   label:'Direccional tra. izq' },
    { key:'ESC',   label:'Tubo de escape' },
  ],
}

const HS_MOTO = {
  top: [
    // llantas
    { key:'LL_DEL', type:'circle', cx:770, cy:425, r:55 },
    { key:'LL_TRA', type:'circle', cx:510, cy:425, r:55 },

    // tanque / cuerpo
    { key:'TANQUE', type:'rect',   x:300, y:130, w:100, h:90,  r:12 },
    { key:'SILL',  type:'rect',   x:300, y:240, w:100, h:160,  r:12},
    { key:'TC',  type:'rect',   x:300, y:70, w:100, h:30,  r:12},

    // frontal
    { key:'CUP',    type:'rect',   x:135, y:62, w:40, h:40,  r:80 },
    { key:'MAN_D',  type:'rect',   x:85, y:45, w:50,  h:20,  r:8 },
    { key:'MAN_I',  type:'rect',   x:180, y:45, w:50,  h:20,  r:8 },
    { key:'GUARD',   type:'rect',   x:130, y:115, w:50, h:40,  r:10 },
    { key:'POSAD',   type:'rect',   x:95, y:165, w:30,  h:20,  r:10 },
    { key:'POSAI',   type:'rect',   x:180, y:165, w:30,  h:20,  r:10 },
    { key:'DIRDD',  type:'rect',   x:105, y:70, w:30,  h:20,  r:8 },
    { key:'DIRDI',  type:'rect',   x:175, y:70, w:30,  h:20,  r:8 },
    
    //Tarsero
    { key:'ESPED',   type:'rect',   x:210, y:260, w:40,  h:20,  r:6 },
    { key:'ESPEI',   type:'rect',   x:70, y:260, w:40,  h:20,  r:6 },
    { key:'GUART',   type:'rect',   x:140, y:380, w:50, h:40,  r:10 },
    { key:'STOP',   type:'rect',   x:140, y:325, w:45, h:30,  r:10 },
    { key:'DIRTD',   type:'rect',   x:185, y:360, w:30,  h:20,  r:6 },
    { key:'DIRTI',   type:'rect',   x:110, y:360, w:30,  h:20,  r:6 },
    { key:'ESC',   type:'rect',   x:185, y:395, w:40, h:60,  r:10 },

    //Costados
    { key:'TPD',  type:'rect',   x:540, y:340, w:130, h:40,  r:12},
    { key:'TPI',  type:'rect',   x:590, y:100, w:130, h:40,  r:12},
   
  ],
}

// 🚐 Croquis panel (vista superior)
// Keys propias para panel
const PARTS_PANEL = {
  top: [
    { key:'CAP',      label:'Capó' },
    { key:'VID',      label:'Parabrisas delantero' },
    { key:'PDI',      label:'Puerta conductor' },
    { key:'VID_PDI',      label:'Vidrio puerta conductor' },
    { key:'PDD',      label:'Puerta pasajero' },
    { key:'VID_PDD',      label:'Vidrio puerta pasajero' },
    { key:'CORR_IZQ',     label:'Puerta corredera izquierda' },
    { key:'CORR_DER',     label:'Puerta corredera derecha' },
    { key:'LAT_IZQ',  label:'Guardabarro trasero izquierdo' },
    { key:'VID_TIZ',      label:'Vidrio trasero izquierdo' },
    { key:'LAT_DER',  label:'Guardabarro trasero derecho' },
    { key:'VID_TDE',      label:'Vidrio trasero derecho' },
    { key:'LAT_DEL_IZQ',  label:'Guardabarro delantero izquierdo' },
    { key:'LAT_DEL_DER',  label:'Guardabarro delantero derecho' },    
    { key:'TECHO',    label:'Techo' },
    { key:'TRAS',     label:'Puerta trasera' },
    { key:'PAR_DEL',  label:'Parachoques delantero' },
    { key:'PAR_TRA',  label:'Parachoques trasero' },
    { key:'LTI',      label:'Llanta delantera izq.' },
    { key:'LTD',      label:'Llanta delantera der.' },
    { key:'LLI',      label:'Llanta trasera izq.' },
    { key:'LLD',      label:'Llanta trasera der.' },
    { key:'LFD',      label:'Luz delantera izq.' },
    { key:'LFA',      label:'Luz delantera der.' },
    { key:'LTI_T',    label:'Luz trasera izq.' },
    { key:'LTD_T',    label:'Luz trasera der.' },
    { key:'ESPR',    label:'Espejo retrovisor der.' },
    { key:'SPRL',    label:'Espejo retrovisor izq.' },
  ],
}

const HS_PANEL = {
  top: [
    // Frente
    { key:'CAP',     type:'rect',   x:600,  y:125,  w:160, h:20,  r:18 },
    { key:'VID',     type:'rect',   x:617, y:75,  w:130, h:45,  r:14 },
    { key:'PAR_DEL', type:'rect',   x:590,  y:175, w:180, h:40,  r:10 },
    { key:'LFD',     type:'rect',   x:730,  y:150, w:40,  h:15,  r:14 },
    { key:'LFA',     type:'rect',   x:595, y:150, w:40,  h:15,  r:14 },
    { key:'ESPR',    type:'rect',   x:570, y:100, w:35, h:25, r:14 },
    { key:'SPRL',    type:'rect',   x:757, y:100, w:35, h:25, r:14 },

    // Cabina / puertas
    { key:'PDI',     type:'rect',   x:210, y:365, w:90, h:80,  r:10 },
    { key:'VID_PDI',     type:'rect',   x:225, y:310, w:70, h:50,  r:10 },
    { key:'PDD',     type:'rect',   x:335, y:125, w:90, h:80,  r:10 },
    { key:'VID_PDD',     type:'rect',   x:335, y:70, w:70, h:50,  r:10 },
    { key:'CORR_DER',    type:'rect',   x:243, y:70, w:90, h:130, r:14 },
    { key:'CORR_IZQ',    type:'rect',   x:302, y:310, w:90, h:130, r:14 },
    

    // Laterales y techo
    { key:'LAT_IZQ', type:'rect',   x:395, y:365, w:110, h:50,  r:14 },
    { key:'LAT_DER', type:'rect',   x:130, y:130,  w:110, h:50,  r:14 },
    { key:'LAT_DEL_IZQ', type:'rect',   x:165, y:365, w:40, h:50,  r:14 },
    { key:'LAT_DEL_DER', type:'rect',   x:430, y:120,  w:40, h:50,  r:14 },
    { key:'TECHO',   type:'rect',   x:140, y:50, w:250, h:15, r:18 },
    { key:'VID_TIZ',     type:'rect',   x:395, y:310, w:100, h:50,  r:10 },
    { key:'VID_TDE',     type:'rect',   x:140, y:70, w:100, h:50,  r:10 },

    // Trasera
    { key:'TRAS',    type:'rect',   x:605, y:305, w:145, h:120, r:14 },
    { key:'PAR_TRA', type:'rect',   x:600, y:430, w:170, h:30,  r:10 },
    { key:'LTI_T',   type:'rect',   x:590, y:340, w:15,  h:70,  r:6 },
    { key:'LTD_T',   type:'rect',   x:755, y:340, w:15,  h:70,  r:6 },

    // Llantas (aprox)
    { key:'LTI',     type:'circle', cx:188, cy:445, r:25 },
    { key:'LLI',     type:'circle', cx:438, cy:445, r:25 },
    { key:'LTD',     type:'circle', cx:447, cy:202, r:25 },
    { key:'LLD',     type:'circle', cx:196, cy:202, r:25 },
  ],
}


/** estado local */
const otroText = ref(props.initialOtroText)
watch(() => props.initialOtroText, v => { otroText.value = v })

const hoverLabel = ref('')
const tooltip = ref({ x: 0, y: 0 })

/** Derivados */
const vehicleCat = computed(() => String(props.vehicleCategory || '').toUpperCase())

const mode = computed(() => {
  if (vehicleCat.value === 'MT') return 'moto'
  if (vehicleCat.value === 'LP') return 'panel'
  if (vehicleCat.value === 'CM') return 'pickup'
  // compatibilidad hacia atrás
  return props.isMoto ? 'moto' : 'pickup'
})

const partsSource = computed(() => {
  if (mode.value === 'moto') return PARTS_MOTO
  if (mode.value === 'panel') return PARTS_PANEL
  return PARTS_AUTO
})
const hsSource = computed(() => {
  if (mode.value === 'moto') return HS_MOTO
  if (mode.value === 'panel') return HS_PANEL
  return HS_AUTO
})


const partsListForView = computed(
  () => partsSource.value[view.value] || []
)
const currentHotspots = computed(
  () => hsSource.value[view.value] || []
)
const highlightSet = computed(
  () => new Set(props.highlightKeys || [])
)


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
    stroke = active ? '#b91c1c' : 'rgba(185,28,28,0.55)'
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
