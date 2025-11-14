<template>
<div class="space-y-4"> <!-- Este div es el "stack" vertical de tus tarjetas -->
  <!-- Cumplimiento -->
  <div class="card" ref="complianceBox">
  <div class="card-body space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <h3 class="font-semibold text-slate-800">
          Cumplimiento <span class="text-slate-500 font-normal">(diario)</span>
          <template v-if="isAdminView">
            <span class="text-slate-400 font-normal text-sm ml-2">Grupos completos = todas sus unidades</span>
          </template>
        </h3>
        <button class="btn-ghost ml-2" @click="reloadCompliance">Actualizar</button>
      </div>
      <!-- KPI agentes sin unidad a la derecha -->
      <div
        class="hidden sm:flex items-center gap-2"
      >
        <div
          class="border rounded-xl px-4 py-1 flex items-center gap-2 text-xs font-medium"
          :class="agentesSinUnidad > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-700'"
          style="min-width:120px;"
        >
          <span>Funcionarios sin unidad:</span>
          <span class="font-bold text-lg">{{ agentesSinUnidad }}</span>
          <button
            v-if="agentesSinUnidad > 0"
            class="btn-ghost px-1 py-0 h-7 text-xs"
            @click="openSinUnidadModal"
            title="Ver detalle"
          >
            Detalle
          </button>
        </div>
      </div>
    </div>

    <!-- Para MOBILE: debajo del header -->
    <div class="flex sm:hidden mt-3">
      <div
        class="border rounded-xl px-4 py-1 flex items-center gap-2 text-xs font-medium w-full"
        :class="agentesSinUnidad > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-700'"
      >
        <span>Agentes sin unidad:</span>
        <span class="font-bold text-lg">{{ agentesSinUnidad }}</span>
        <button
          v-if="agentesSinUnidad > 0"
          class="btn-ghost px-1 py-0 h-7 text-xs"
          @click="openSinUnidadModal"
          title="Ver detalle"
        >
          Detalle
        </button>
      </div>
    </div>
      
      <!-- Líder de grupo -->
      <template v-if="isLeaderGroup">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div class="mb-2 text-slate-600 font-medium flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-green-600"></span> Actualizaron
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="g in compliance.done" :key="'d'+(g.unitName||g.groupCode)"
                class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                {{ g.unitName || g.groupCode }}
              </span>
              <span v-if="!compliance.done.length" class="text-slate-500 text-sm">Nadie aún</span>
            </div>
          </div>

          <div>
            <div class="mb-2 text-slate-600 font-medium flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-600"></span> Pendientes
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="g in compliance.pending" :key="'p'+(g.unitName||g.groupCode)"
                class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {{ g.unitName || g.groupCode }}
              </span>
              <span v-if="!compliance.pending.length" class="text-slate-500 text-sm">Sin pendientes</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Admin / Supervisor -->
      <template v-else>
        <div class="space-y-6">
          <!-- Completos -->
          <div>
            <div class="mb-2 text-slate-600 font-medium flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-green-600"></span> Grupos completos
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="g in compAdmin.complete" :key="'cg'+g.groupId"
                class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 shadow">
                {{ g.groupCode }} <span class="text-xs text-green-800/70">100%</span>
              </span>
              <span v-if="!compAdmin.complete.length" class="text-slate-500 text-sm">Ninguno aún</span>
            </div>
          </div>

          <!-- Pendientes -->
          <div>
            <div class="mb-2 text-slate-600 font-medium flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-600"></span> Grupos con unidades pendientes
              <span v-if="compAdmin.pending.length" class="text-slate-400 text-sm ml-1">({{ compAdmin.pending.length }})</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-for="g in compAdmin.pending" :key="'pg'+g.groupId" class="p-3 rounded-xl border border-slate-200 bg-white shadow-sm relative">
                <div class="flex items-center justify-between mb-1">
                  <div class="font-semibold text-slate-800 tracking-wide">{{ g.groupCode }}</div>
                  <button class="text-brand-700 text-sm hover:underline" @click="togglePendingPopover(g.groupId)">
                    Ver {{ g.missingUnits.length }}
                  </button>
                </div>

                <div class="text-slate-500 text-xs mb-2">
                  {{ g.doneUnits }} / {{ g.totalUnits }} unidades — {{ g.percent }}%
                </div>

                <!-- Barra de progreso -->
                <div class="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div class="h-full bg-amber-400" :style="{ width: g.percent + '%' }"></div>
                </div>

                <!-- Popover -->
                <div v-if="openGroupId === g.groupId"
                     class="absolute z-30 top-[calc(100%+8px)] left-3 w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl">
                  <div class="absolute -top-2 left-6 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45"></div>
                  <div class="p-3">
                    <div class="font-medium text-slate-700 mb-2">Unidades pendientes ({{ g.missingUnits.length }})</div>
                    <ul class="space-y-1 max-h-56 overflow-auto pr-1">
                      <li v-for="u in g.missingUnits" :key="u" class="text-slate-700 text-sm">• {{ u }}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <span v-if="!compAdmin.pending.length" class="text-slate-500 text-sm">Sin pendientes</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
  <!-- Filtros -->
  <div class="card mb-2">
    <div class="card-body">
      <div class="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:items-end">
        <div>
          <label class="label">Fecha</label>
          <input type="date" v-model="date" class="input" />
        </div>

        <!-- Acciones -->
        <div class="flex gap-2 sm:col-span-2">
          <button
            @click="descargarExcel"
            class="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            style="min-width: 90px;"
          >
            Descargar
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- KPIs -->
   
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="kpi">
            <div class="card-body">
              <h4>FE total (OF/ME/PT)</h4>
              <div class="value text-lg">
                {{ kpiFE }}
                <span class="text-sm text-slate-500"> ({{ feTotalDash }})</span>
              </div>
            </div>
          </div>

          <div class="kpi">
            <div class="card-body">
              <div class="flex items-center justify-between gap-2">
                <h4>FD total (OF/ME/PT)</h4>
                <button
                  class="btn-ghost h-8 px-2 text-xs"
                  @click="goToParte"
                >
                  Parte
                </button>
              </div>
              <div class="value text-lg">
                {{ kpiFD }}
                <span class="text-sm text-slate-500"> ({{ fdTotalDash }})</span>
              </div>
            </div>
          </div>


          <div class="kpi">
            <div class="card-body">
              <div class="flex items-center justify-between gap-2">
                <h4>Novedades totales (OF/ME/PT)</h4>
                <button class="btn-ghost h-8 px-2 text-xs" @click="openNovModal">Detalles</button>
              </div>
              <div class="value text-lg">
                {{ kpiNOV }}
                <span class="text-sm text-slate-500"> ({{ novTotalDash }})</span>
              </div>
            </div>
          </div>
        </div>
  <!-- Tabla -->
  <div class="card">
    <div class="card-body p-0">
      <div class="overflow-x-auto">
        <table class="table text-xs sm:text-sm">
          <thead>
            <tr>
              <th>{{ isAdminView ? 'Grupo' : 'Unidad' }}</th>
              <th>Fecha de envío</th>
              <th>{{ isAdminView ? 'Hora de cierre' : 'Hora' }}</th>
              <th>FE (OF/ME/PT)</th>
              <th>FD (OF/ME/PT)</th>
              <th>Novedades (OF/ME/PT)</th>
            </tr>
          </thead>
          <tbody>
            <!-- === Vista ADMIN/SUPERVISOR: grupos con despliegue de unidades === -->
            <template v-if="isAdminView">
              <template v-for="g in rowsDisplayAdminNested" :key="'G'+g._key">
                <!-- Fila de grupo -->
                <tr class="hover:bg-slate-50">
                  <td>
                    <button
                      class="inline-flex items-center gap-2 text-brand-700 hover:underline"
                      @click="toggleGroup(g.groupId)"
                      title="Desplegar/contraer unidades"
                      style="background:none;border:none;padding:0;margin:0;cursor:pointer;"
                    >
                      <!-- caret -->
                      <svg :style="{ transform: isExpanded(g.groupId) ? 'rotate(90deg)' : 'rotate(0deg)' }"
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M9 18l6-6-6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>

                      <span class="h-2 w-2 rounded-full" :class="g.isComplete ? 'bg-green-600' : 'bg-amber-600'"></span>
                      {{ g.groupCode }}
                      <span class="text-xs text-slate-400">({{ g.units.length }} unidades)</span>

                      <!-- 🔔 Campana si hubo reporte tarde en el grupo -->
                      <svg v-if="g.groupLate" class="inline-block ml-1 text-amber-600" width="16" height="16" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor">
                        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5"
                              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M13.73 21a2 2 0 01-3.46 0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  
                  </td>
                  <td>{{ fmtFechaColombia(g.submittedAt || g.date) }}</td>
                  <td>{{ fmtHoraColombia(g.time || g.submittedAt) }}</td>
                  <td class="font-medium text-slate-900" v-html="fmtTriadWithSum(g.FE)"></td>
                  <td class="font-medium text-slate-900" v-html="fmtTriadWithSum(g.FD)"></td>
                  <td class="font-medium text-slate-900" v-html="fmtTriadWithSum(g.NOV)"></td>
                </tr>

                <!-- Filas hijas: unidades del grupo -->
                <tr v-for="u in g.units" :key="'U'+g._key+'-'+u.unitId"
                    v-show="isExpanded(g.groupId)"
                    class="bg-slate-50/40 hover:bg-slate-50">
                  <td>
                    <button
                      class="inline-flex items-center gap-2 pl-6 text-slate-700 hover:underline"
                      
                      title="Ver detalle de unidad"
                      style="background:none;border:none;padding:0;margin:0;cursor:pointer;"
                    >
                      <span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                      {{ u.unitName }}

                      <!-- 🔔 Campana si la unidad reportó tarde -->
                      <svg v-if="u.late" class="inline-block ml-1 text-amber-600" width="14" height="14" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor">
                        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5"
                              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M13.73 21a2 2 0 01-3.46 0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </td>
                  <td>{{ fmtFechaColombia(u.submittedAt || u.date) }}</td>
                  <td>{{ fmtHoraColombia(u.time || u.submittedAt) }}</td>
                  <td class="font-medium text-slate-900" v-html="fmtTriadWithSum(u.FE)"></td>
                  <td class="font-medium text-slate-900" v-html="fmtTriadWithSum(u.FD)"></td>
                  <td class="font-medium text-slate-900" v-html="fmtTriadWithSum(u.NOV)"></td>
                </tr>
              </template>

              <tr v-if="!rowsDisplayAdminNested.length">
                <td colspan="6" class="text-center text-slate-500 py-6">Sin datos</td>
              </tr>
            </template>

            <!-- === Vista LÍDER DE GRUPO: (unidad a unidad) === -->
            <template v-else>
              <tr v-for="r in rowsDisplayLeader" :key="r._key" class="hover:bg-slate-50">
                <td>
                  <button
                    class="inline-flex items-center gap-2 text-brand-700 hover:underline"
                    @click="goToGroupReport(r)"
                    title="Ver detalle"
                    style="background:none;border:none;padding:0;margin:0;cursor:pointer;"
                  >
                    <span class="h-2 w-2 rounded-full bg-green-600"></span>
                    {{ r.unitName }}
                    <svg v-if="r.late" class="inline-block ml-1 text-amber-600" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor">
                      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5"
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M13.73 21a2 2 0 01-3.46 0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </td>
                <td>{{ fmtFechaColombia(r.submittedAt || r.time) }}</td>
                <td>{{ fmtHoraColombia(r.time || r.submittedAt) }}</td>
                <td class="font-medium text-slate-900">{{ r.FE }}</td>
                <td class="font-medium text-slate-900">{{ r.FD }}</td>
                <td class="font-medium text-slate-900">{{ r.NOV }}</td>
              </tr>
              <tr v-if="!rowsDisplayLeader.length">
                <td colspan="6" class="text-center text-slate-500 py-6">Sin datos</td>
              </tr>
            </template>
          </tbody>

        </table>
      </div>
    </div>
  </div>

  <!-- Mapa -->
  <div class="card">
    <div class="card-body">
      <h3 class="font-semibold mb-3 text-slate-700">Mapa de ubicación de agentes</h3>
      <div class="relative">
        <div id="mapa-agentes"
             class="relative z-0"
             style="height:300px;min-height:200px;width:100%;border-radius:12px;box-shadow:0 2px 8px #0001;background:#eee;">
        </div>
        <!-- Botón overlay Pantalla Completa -->
        <button class="map-fs-btn" type="button" title="Pantalla completa" aria-label="Pantalla completa del mapa"
                @click="toggleFullscreen">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 3H3v6M3 3l6 6M15 21h6v-6M21 21l-6-6M21 9V3h-6M15 9l6-6M3 15v6h6M9 15l-6 6"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

<!-- MODAL DETALLES NOVEDADES -->
<div v-if="novModalOpen" class="fixed inset-0 z-[1000] flex items-center justify-center">
  <div class="absolute inset-0 bg-black/40" @click="novModalOpen=false"></div>

  <!-- Contenedor -->
  <div class="relative bg-white w-screen h-screen sm:w-[95vw] sm:max-w-4xl sm:h-auto sm:max-h-[80vh] rounded-none sm:rounded-xl shadow-xl flex flex-col">

    <!-- Header -->
    <div class="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
      <div class="font-semibold text-slate-800">
        Detalle de Novedades — {{ isAdminView ? 'por Grupos' : 'por Unidades' }}
      </div>
      <button class="btn-ghost" @click="novModalOpen=false">Cerrar</button>
    </div>

    <!-- Tabs -->
    <div class="px-4 pt-3 sticky top-[56px] sm:top-[64px] bg-white z-10 border-b border-slate-100">
      <div class="flex gap-2">
        <button
          :class="['btn-ghost h-8 px-3 text-sm', novTab==='tipos' && 'bg-slate-100']"
          @click="novTab='tipos'">
          Por novedad
        </button>

        <button
          :class="['btn-ghost h-8 px-3 text-sm', novTab==='ambito' && 'bg-slate-100']"
          @click="novTab='ambito'">
          Por {{ isAdminView ? 'grupo' : 'unidad' }}
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="p-4 overflow-auto grow">

      <!-- Por Tipo -->
      <div v-show="novTab==='tipos'" class="overflow-x-auto">
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">
          <!-- Tabla de novedad -->
          <div class="overflow-x-auto">
            <table class="table w-full text-xs sm:text-sm">
              <thead>
                <tr>
                  <th class="w-1/2">Novedad</th>
                  <th class="text-center">OF</th>
                  <th class="text-center">ME</th>
                  <th class="text-center">PT</th>
                  <th class="text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in novTiposRows"
                  :key="row.novedad"
                  class="cursor-pointer hover:bg-slate-50"
                  :class="novSelected===row.novedad ? 'ring-1 ring-brand-500/50' : ''"
                  @click="onClickNovedad(row.novedad)"
                  title="Ver funcionarios"
                >
                  <td class="font-medium">
                    <span class="inline-flex items-center gap-2">
                      <span
                        class="inline-block w-2 h-2 rounded-full"
                        :class="novSelected===row.novedad ? 'bg-brand-600' : 'bg-slate-300'"
                      />
                      {{ row.novedad }}
                    </span>
                  </td>
                  <td class="text-center">{{ row.OF }}</td>
                  <td class="text-center">{{ row.ME }}</td>
                  <td class="text-center">{{ row.PT }}</td>
                  <td class="text-center font-semibold">{{ row.total }}</td>
                </tr>
                <tr v-if="!novTiposRows.length">
                  <td colspan="5" class="text-center text-slate-500 py-4">Sin datos</td>
                </tr>
              </tbody>
              <tfoot v-if="novTiposRows.length">
                <tr class="bg-slate-50">
                  <td class="font-semibold">Total general</td>
                  <td class="text-center font-semibold">{{ sum(novTiposRows,'OF') }}</td>
                  <td class="text-center font-semibold">{{ sum(novTiposRows,'ME') }}</td>
                  <td class="text-center font-semibold">{{ sum(novTiposRows,'PT') }}</td>
                  <td class="text-center font-bold">{{ sum(novTiposRows,'total') }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Panel derecho: funcionarios de la novedad seleccionada -->
          <div class="border border-slate-200 rounded-xl p-3 bg-white min-h-[260px]">
            <div class="flex items-center justify-between gap-2 mb-2">
              <div class="font-semibold text-slate-800">
                {{ novSelected ? ('Funcionarios — ' + novSelected) : 'Funcionarios' }}
              </div>
              <div class="flex items-center gap-2">
                <!--button
                  class="btn-ghost h-8 px-2 text-xs"
                  :disabled="!novSelected || novAgentsLoading"
                  @click="exportNovAgentsCsv"
                >
                  Exportar CSV
                </button-->
                <button
                  class="btn-ghost h-8 px-2 text-xs"
                  :disabled="!novSelected || novAgentsLoading"
                  @click="reloadNovAgents"
                  title="Recargar"
                >
                  Recargar
                </button>
              </div>
            </div>

            <div class="mb-2 flex items-center gap-2">
              <input
                v-model="novAgentsQuery"
                type="text"
                class="input !py-1 !text-xs"
                placeholder="Buscar por código o nombre…"
              />
              <select v-model="novAgentsCat" class="input !py-1 !text-xs w-[110px]">
                <option value="ALL">Todos</option>
                <option value="OF">OF</option>
                <option value="ME">ME</option>
                <option value="PT">PT</option>
              </select>
            </div>

            <div v-if="novAgentsLoading" class="text-slate-500 text-sm">Cargando…</div>

            <template v-else>
              <div v-if="!novSelected" class="text-slate-500 text-sm">
                Selecciona una novedad en la tabla para ver el detalle.
              </div>
              <div v-else>
                <div class="text-xs text-slate-500 mb-2">
                  Total: <b>{{ novAgentsFiltered.length }}</b> •
                  OF: <b>{{ novCounts.OF }}</b> •
                  ME: <b>{{ novCounts.ME }}</b> •
                  PT: <b>{{ novCounts.PT }}</b>
                </div>

                <div class="border rounded-lg overflow-hidden" style="max-height: 360px; overflow-y: auto;">
                  <table class="table w-full text-xs">
                    <thead class="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th class="w-[22%]">Código</th>
                        <th class="w-[50%]">Funcionario</th>
                        <th class="w-[8%] text-center">Cat.</th>
                        <th class="w-[20%]">Grupo</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="a in novAgentsFiltered" :key="a.id" class="hover:bg-slate-50">
                        <td class="font-semibold">{{ a.code }}</td>
                        <td class="font-medium">{{ a.nickname }}</td>
                        <td class="text-center">{{ a.category === 'SO' ? 'ME' : a.category }}</td>
                        <td class="text-slate-600">
                          <span v-if="isAdminView">{{ a.groupCode || ('G'+(a.groupId || '—')) }}</span>
                          <span v-else>{{ a.unitName || ('U'+(a.unitId || '—')) }}</span>
                        </td>
                      </tr>
                      <tr v-if="!novAgentsFiltered.length">
                        <td colspan="4" class="text-center text-slate-500 py-4">Sin resultados</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            </template>
          </div>
        </div>
      </div>
      <!-- Por Ámbito -->
      <div v-show="novTab==='ambito'" class="overflow-x-auto">
        <!-- Totales por ámbito -->
        <table class="table w-full text-xs sm:text-sm">
          <thead>
            <tr>
              <th class="w-1/2">{{ isAdminView ? 'Grupo' : 'Unidad' }}</th>
              <th class="text-center">OF</th>
              <th class="text-center">ME</th>
              <th class="text-center">PT</th>
              <th class="text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in novAmbitoRows" :key="row.label">
              <td class="font-medium">{{ row.label }}</td>
              <td class="text-center">{{ row.OF }}</td>
              <td class="text-center">{{ row.ME }}</td>
              <td class="text-center">{{ row.PT }}</td>
              <td class="text-center font-semibold">{{ row.total }}</td>
            </tr>
            <tr v-if="!novAmbitoRows.length">
              <td colspan="5" class="text-center text-slate-500 py-4">Sin datos</td>
            </tr>
          </tbody>
          <tfoot v-if="novAmbitoRows.length">
            <tr class="bg-slate-50">
              <td class="font-semibold">Total general</td>
              <td class="text-center font-semibold">{{ sum(novAmbitoRows,'OF') }}</td>
              <td class="text-center font-semibold">{{ sum(novAmbitoRows,'ME') }}</td>
              <td class="text-center font-semibold">{{ sum(novAmbitoRows,'PT') }}</td>
              <td class="text-center font-bold">{{ sum(novAmbitoRows,'total') }}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Cuadro discriminado por novedad (cards por ámbito) -->
        <div class="mt-6">
          <div class="text-slate-700 font-medium mb-2">
            Detalle por novedad en cada {{ isAdminView ? 'grupo' : 'unidad' }}
          </div>

          <div v-if="novAmbitoCards.length" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              v-for="card in novAmbitoCards"
              :key="card.label"
              class="border border-slate-200 rounded-xl p-3 bg-white">
              <div class="font-semibold text-slate-800 mb-2">{{ card.label }}</div>
              <div class="flex flex-wrap gap-2">
                <template v-if="card.items.length">
                  <div
                    v-for="it in card.items"
                    :key="it.novedad"
                    class="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs cursor-pointer hover:bg-slate-100"
                    @click="pickScopeAndNovedad(card.label, it.novedad)"
                  >
                    <span class="font-medium">{{ it.novedad }}</span>:
                    <span>{{ it.total }}</span>
                    <span class="opacity-70"> ({{ it.OF }}/{{ it.ME }}/{{ it.PT }})</span>
                  </div>
                </template>
                <span v-else class="text-slate-500 text-xs">Sin datos</span>
              </div>
            </div>
          </div>

          <div v-else class="text-slate-500 text-sm">Sin datos detallados</div>
        </div>
      </div>
    </div>
  </div>
</div>

  <!-- MODAL AGENTES SIN UNIDAD -->
  <div v-if="sinUnidadModalOpen" class="fixed inset-0 z-[1100] flex items-center justify-center">
    <div class="absolute inset-0 bg-black/40" @click="sinUnidadModalOpen=false"></div>

    <div class="relative bg-white w-screen h-screen sm:w-[520px] sm:h-auto sm:max-h-[80vh] rounded-none sm:rounded-xl shadow-xl flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
        <div class="font-semibold text-slate-800">
          Agentes sin unidad — <span class="text-amber-700">{{ agentesSinUnidad }}</span>
        </div>
        <button class="btn-ghost" @click="sinUnidadModalOpen=false">Cerrar</button>
      </div>

      <!-- Body -->
      <div class="p-4 overflow-auto">
        <template v-if="agentesSinUnidad > 0">
          <div class="mb-2 text-xs text-slate-500">
            * Permanecen en su grupo. Cambio de grupo solo por Super Admin.
          </div>

          <div class="border rounded-xl overflow-hidden">
            <table class="table w-full text-sm">
              <thead>
                <tr class="bg-slate-50">
                  <th class="w-[25%]">Código</th>
                  <th class="w-[25%]">Agente</th>
                  <th class="w-[25%]">Cat.</th>
                  <th class="w-[25%]">Grupo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in agentesSinUnidadList" :key="a.id">
                  <td class="font-semibold">{{ a.code }}</td>
                  <td class="font-semibold">{{ a.nickname }}</td>
                  <td>{{ a.category === 'SO' ? 'ME' : a.category }}</td>
                  <td>{{ a.groupCode || ('G'+(a.groupId ?? '—')) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <div v-else class="text-slate-500 text-sm text-center py-6">
          Sin agentes sin unidad.
        </div>
      </div>
    </div>
  </div>
  </div>

</template>

<script setup>

import {ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import L from 'leaflet'
import { useRouter } from 'vue-router'

const router = useRouter()

// === Fechas en zona "America/Bogota" sin usar toISOString() ===
const TZ = 'America/Bogota'

function ymdInTZ(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}` // YYYY-MM-DD
}

function hourMinuteInTZ(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit'
  }).formatToParts(date)
  return {
    hour: Number(parts.find(p => p.type === 'hour')?.value || 0),
    minute: Number(parts.find(p => p.type === 'minute')?.value || 0)
  }
}

/**
 * Devuelve YYYY-MM-DD "de negocio" en Bogotá, con corte a la hora indicada.
 * - Si ahora >= cutoffHour (hora local Bogotá), devuelve "mañana".
 * - Si ahora <  cutoffHour, devuelve "hoy".
 */
function businessDateBogota(cutoffHour /* 0..23 */) {
  const now = new Date()
  const { hour } = hourMinuteInTZ(now)
  const base = (hour >= cutoffHour)
    ? new Date(now.getTime() + 24 * 60 * 60 * 1000) // +1 día
    : now
  return ymdInTZ(base)
}


// ===== Auth / roles
const me = ref(null)
async function loadMe() {
  try {
    const { data } = await axios.get('/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
    me.value = data
  } catch { me.value = null }
}
const roleLc = computed(() => String(me.value?.role || '').trim().toLowerCase())
const isAdminView   = computed(() => ['superadmin','supervision','supervisor'].includes(roleLc.value))
const isLeaderGroup = computed(() => roleLc.value === 'leader_group')

// === Expandir/colapsar grupos en vista admin
const expandedGroups = ref(new Set())

function isExpanded (gid) {
  return expandedGroups.value.has(String(gid))
}
function toggleGroup (gid) {
  const s = new Set(expandedGroups.value)
  const k = String(gid)
  if (s.has(k)) s.delete(k); else s.add(k)
  expandedGroups.value = s
}

// ===== Filtros
// === Fecha "programada" del reporte (cambia 14 h más tarde que antes)
// Mantener el comportamiento actual (flip base ~19:00) y desplazarlo +14 h → 09:00
function tomorrowStr () {
  const d = new Date()
  d.setDate(d.getDate() + 1)       // igual que antes
  d.setHours(d.getHours() + 14)    // 👉 desplaza el cambio +14h (19:00 + 14 = 09:00)
  return d.toISOString().slice(0, 10)
}


const date = ref(businessDateBogota(9)) // flip a las 09:00 Bogotá

const selectedGroupId = ref('all')
const selectedUnitId  = ref('all')
const selectedLeaderUnitId = ref('all')

// ===== Catálogos
const grupos = ref([])
const units  = ref([])
const myUnits = ref([])

const unitsOfSelectedGroup = computed(() => {
  if (selectedGroupId.value === 'all') return []
  return units.value.filter(u => String(u.groupId) === String(selectedGroupId.value))
})

async function loadGrupos() {
  const { data } = await axios.get('/admin/groups', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
  grupos.value = Array.isArray(data) ? data : []
}
async function loadUnits() {
  if (!isAdminView.value) return
  const { data } = await axios.get('/admin/units', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
  units.value = Array.isArray(data) ? data : []
}
async function loadMyUnits() {
  if (!isLeaderGroup.value) return
  const { data } = await axios.get('/my/units', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
  myUnits.value = Array.isArray(data) ? data : []
}
function onChangeGrupo(){ selectedUnitId.value = 'all' }

// ===== KPIs
const rows = ref([])
const tot = ref({ OF_FE:0,SO_FE:0,PT_FE:0, OF_FD:0,SO_FD:0,PT_FD:0, OF_N:0,SO_N:0,PT_N:0 })
const kpiFE  = computed(() => `${tot.value.OF_FE}/${tot.value.SO_FE}/${tot.value.PT_FE}`)
const kpiFD  = computed(() => `${tot.value.OF_FD}/${tot.value.SO_FD}/${tot.value.PT_FD}`)
const kpiNOV = computed(() => `${tot.value.OF_N}/${tot.value.SO_N}/${tot.value.PT_N}`)

function recalcTotals () {
  tot.value = { OF_FE:0,SO_FE:0,PT_FE:0, OF_FD:0,SO_FD:0,PT_FD:0, OF_N:0,SO_N:0,PT_N:0 }
  for (const r of rows.value) {
    tot.value.OF_FE += r.OF_effective||0
    tot.value.SO_FE += r.SO_effective||0
    tot.value.PT_FE += r.PT_effective||0
    tot.value.OF_FD += r.OF_available||0
    tot.value.SO_FD += r.SO_available||0
    tot.value.PT_FD += r.PT_available||0
    tot.value.OF_N  += r.OF_nov||0
    tot.value.SO_N  += r.SO_nov||0
    tot.value.PT_N  += r.PT_nov||0
  }
}

// Totales para KPI (dashboard)
const feTotalDash  = computed(() => tot.value.OF_FE + tot.value.SO_FE + tot.value.PT_FE)
const fdTotalDash  = computed(() => tot.value.OF_FD + tot.value.SO_FD + tot.value.PT_FD)
// Puedes calcularlo de dos maneras; dejo ambas equivalentes:
const novTotalDash = computed(() =>
  (tot.value.OF_N + tot.value.SO_N + tot.value.PT_N)
  // o: feTotalDash.value - fdTotalDash.value
)

// === Helpers de fecha/hora en Colombia (America/Bogota) ===
function toDateSafe(v) {
  if (!v) return null;
  // Soporta ISO con Z, epoch numérico, y 'YYYY-MM-DD HH:mm:ss'
  if (typeof v === 'number') return new Date(v);
  const s = String(v).trim();
  // Si ya es ISO con Z o con offset, úsalo tal cual.
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  // 'YYYY-MM-DDTHH:mm:ss'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return new Date(s);
  // 'YYYY-MM-DD HH:mm:ss' -> conviértelo a 'YYYY-MM-DDTHH:mm:ss-05:00'
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return new Date(s.replace(' ', 'T') + '-05:00');
  // Solo fecha 'YYYY-MM-DD'
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00-05:00');
  // Fallback
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fmtFechaColombia(v) {
  const d = toDateSafe(v);
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

function fmtHoraColombia(v) {
  const d = toDateSafe(v);
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit', minute: '2-digit'
  }).format(d);
}

function formatTime (ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().substring(11,16)
}

// === ¿Se reportó después de las 6:00 pm en America/Bogota?
function isLateBogota (v) {
  const d = toDateSafe(v)
  if (!d) return false
  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d)
  const hh = Number(parts.find(p => p.type === 'hour')?.value || '0')
  const mm = Number(parts.find(p => p.type === 'minute')?.value || '0')
  // "después de las 6 pm" => estrictamente > 18:00 (18:01+)
  return (hh > 18) || (hh === 18 && mm > 0)
}

function goToGroupReport(r) {
  let groupId = r.groupId || r.group_id || (me.value?.groupId);
  // 🚨 unitId viene directamente en la fila r (si la tabla lo tiene)
  let unitId = (typeof r.unitId !== 'undefined') ? String(r.unitId) : '';

  if (!groupId) {
    console.warn('No se encontró groupId para detalle de reporte', r);
    return;
  }
  router.push({
    path: '/admin/report',
    query: {
      date: r.date || date.value,
      groupId: String(groupId),
      unitId // 👉 lleva el que venga (puede ser vacío)
    }
  });
}

async function goToGroupDetailButton() {
  if (!selectedGroupId.value || selectedGroupId.value === 'all') return
  try {
    // Buscar el dailyreport de ese grupo en la fecha seleccionada
    const { data } = await axios.get('/dashboard/reports', {
      params: { date_from: date.value, date_to: date.value, groupId: selectedGroupId.value },
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    const items = Array.isArray(data?.items) ? data.items : []
    if (!items.length) {
      alert('No hay reporte para este grupo en la fecha seleccionada.')
      return
    }
    // Navega al último reporte de ese grupo en esa fecha (usualmente solo uno)
    const target = items.sort((a, b) => String(a.id).localeCompare(String(b.id))).pop()
    router.push({
      path: '/admin/report',
      query: {
        date: target.date || date.value,
        groupId: String(target.groupId),
        unitId: '' // O puedes ponerle 'all' si usas ese valor
      }
    })
  } catch (e) {
    alert('No se pudo encontrar el reporte para este grupo.')
  }
}

// ===== Mapa

// ---- CACHÉ DE AGENTES: code -> { nickname, groupCode, unitName }
const _agentsCacheMap = ref(null)
async function getAgentsLookupMap () {
  if (_agentsCacheMap.value) return _agentsCacheMap.value
  const token = localStorage.getItem('token')
  let items = []
  try {
    if (isLeaderGroup.value) {
      const { data } = await axios.get('/my/agents', {
        params: { limit: 5000 },
        headers: { Authorization: 'Bearer ' + token }
      })
      items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    } else {
      const { data } = await axios.get('/admin/agents', {
        params: { limit: 5000 },
        headers: { Authorization: 'Bearer ' + token }
      })
      items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    }
  } catch (e) {
    console.error('getAgentsLookupMap error:', e)
    items = []
  }

  const map = new Map()
  for (const a of items) {
    const code = String(a.code ?? a.codigo ?? '').trim()
    if (!code) continue
    map.set(code, {
      nickname: a.nickname ?? a.nombre ?? a.name ?? '',
      groupCode: a.groupCode ?? a.grupo ?? '',
      unitName : a.unitName  ?? a.unidad ?? ''
    })
  }
  _agentsCacheMap.value = map
  return map
}

function normText (s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function normKey(name, dept) {
  return `${normText(name)}|${normText(dept || '')}`;
}

async function loadDailyExportRows (params) {
  const { data } = await axios.get('/reports/export', {
    params,
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  return Array.isArray(data) ? data : (data?.items || [])
}

// Etiqueta de ámbito para el rol actual (Admin=grupo, Líder=unidad)
function labelForRole (row) {
  return isLeaderGroup.value
    ? (row.unidad || row.unitName || '')
    : (row.grupo  || row.groupCode || '')
}

// Indexa nombres por municipio (id o nombre) y por ámbito (grupo/unidad)
function buildNamesByMunicipalityAndGroup (rows, agentsMap) {
  const byId = new Map();        // id -> Map(scopeLabelNorm -> Set(nicks))
  const byName = new Map();      // norm(name) -> Map(scopeLabelNorm -> Set(nicks))
  const byNameDept = new Map();  // norm(name|dept) -> Map(scopeLabelNorm -> Set(nicks))

  const addTo = (map, key, scopeLabelNorm, nickname) => {
    if (!key || !scopeLabelNorm || !nickname) return
    const k = String(key)
    if (!map.has(k)) map.set(k, new Map())
    const gmap = map.get(k)
    if (!gmap.has(scopeLabelNorm)) gmap.set(scopeLabelNorm, new Set())
    gmap.get(scopeLabelNorm).add(String(nickname))
  }

  for (const r of rows) {
    const muniId   = r.municipalityId ?? r.municipio_id ?? r.muni_id ?? r.municipioId ?? r.muniId ?? null
    const muniName = r.municipalityName ?? r.municipio ?? r.ubicacion ?? r.municipio_name ?? r.muni_name ?? null
    const muniDept = r.municipalityDept ?? r.departamento ?? r.depto ?? r.dept ?? null

    // scope/nick desde export
    let scope = isLeaderGroup.value
      ? (r.unidad || r.unitName || '')
      : (r.grupo  || r.groupCode || '')
    let nick  = r.nickname ?? r.funcionario ?? r.name ?? r.agent_name ?? ''

    // 🚀 completa con lookup por código cuando falte
    const code = String(r.codigo_agente ?? r.code ?? '').trim()
    const ag = code ? agentsMap.get(code) : null
    if (!nick && ag?.nickname) nick = ag.nickname
    if (!scope) {
      scope = isLeaderGroup.value ? (ag?.unitName || '') : (ag?.groupCode || '')
    }

    const scopeLabel = normText(scope)
    if (muniId != null) addTo(byId, String(muniId), scopeLabel, nick)
    if (muniName) {
      addTo(byName, normText(muniName), scopeLabel, nick)
      addTo(byNameDept, normKey(muniName, muniDept), scopeLabel, nick)
    }
  }

  return { byId, byName, byNameDept }
}

const municipalitiesMap = ref([])

async function loadMapData () {
  // 1) Armar filtros coherentes para AMBAS consultas
  const reportParams = { date_from: date.value, date_to: date.value }
  if (isLeaderGroup.value && me.value?.groupId) {
    reportParams.groupId = String(me.value.groupId)
    if (selectedLeaderUnitId.value !== 'all') {
      reportParams.unitId = String(selectedLeaderUnitId.value)
    }
  } else {
    if (selectedGroupId.value !== 'all') reportParams.groupId = String(selectedGroupId.value)
    if (selectedUnitId.value  !== 'all') reportParams.unitId  = String(selectedUnitId.value)
  }

  try {
    // 2) Verificar si hay reportes del día (con los mismos filtros del tablero)
    const repResp = await axios.get('/dashboard/reports', {
      params: reportParams,
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
    const reports = Array.isArray(repResp?.data?.items) ? repResp.data.items : []

    // 👉 Si NO hay reportes, vaciamos marcadores y redibujamos mapa base SIN nada
    if (reports.length === 0) {
      municipalitiesMap.value = []
      setTimeout(drawMap, 0)
      return
    }

    // 3) Si SÍ hay reportes, pedimos la agregación por municipios (como antes)
    const muniParams = { date: date.value }
    if (isLeaderGroup.value) {
      if (selectedLeaderUnitId.value !== 'all') {
        muniParams.unitId = String(selectedLeaderUnitId.value)
      }
      // (el backend ya limita por groupId del líder)
    } else {
      if (selectedGroupId.value !== 'all') {
        muniParams.groupId = String(selectedGroupId.value)
        muniParams.groups  = String(selectedGroupId.value) // compat
      }
      if (selectedUnitId.value !== 'all') {
        muniParams.unitId = String(selectedUnitId.value)
        muniParams.units  = String(selectedUnitId.value) // compat
      }
    }

    let list = []
    try {
      const { data } = await axios.get('/admin/agent-municipalities', {
        params: muniParams,
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      })
      list = Array.isArray(data) ? data : []
    } catch (err) {
      console.error('Error /admin/agent-municipalities:', err)
      list = []
    }

    // 4) Filtros adicionales y armado de estructura por municipio (igual a tu lógica actual)
    // — respeta tu filtro de líder por unidad —
    if (isLeaderGroup.value && selectedLeaderUnitId.value !== 'all') {
      list = list.filter(m => String(m.unitId) === String(selectedLeaderUnitId.value))
    }

    const byMuni = new Map()
    for (const r of list) {
      if (!r?.id) continue
      let entry = byMuni.get(r.id)
      if (!entry) {
        entry = {
          id: r.id, name: r.name, dept: r.dept, lat: r.lat, lon: r.lon,
          total: 0,
          breakdown: {}
        }
        byMuni.set(r.id, entry)
      }
      const key = isLeaderGroup.value
        ? (r.unitName || `Unidad ${r.unitId || '—'}`)
        : (r.groupCode || `Grupo ${r.groupId || '—'}`)

      const n = Number(r.agent_count || 0)
      entry.total += n
      entry.breakdown[key] = (entry.breakdown[key] || 0) + n
    }
    for (const r of list) {
      const label = isLeaderGroup.value
        ? (r.unitName || `Unidad ${r.unitId || '—'}`)
        : (r.groupCode || `Grupo ${r.groupId || '—'}`);

      if (Array.isArray(r.nicknames) && r.nicknames.length) {
        const m = byMuni.get(r.id);
        if (!m) continue;
        if (!m.namesByGroupNorm) m.namesByGroupNorm = {};
        const k = normText(label);
        const merged = (m.namesByGroupNorm[k] || []).concat(r.nicknames);
        m.namesByGroupNorm[k] = [...new Set(merged)]
          .sort((a,b)=> a.localeCompare(b,'es',{sensitivity:'base'}));
      }
    }
  

    municipalitiesMap.value = [...byMuni.values()]
    setTimeout(drawMap, 0)

  } catch (err) {
    console.error('Error verificando reportes/mapa:', err)
    municipalitiesMap.value = []
    setTimeout(drawMap, 0)
  }
}

function drawMap () {
  if (window.myMap) { window.myMap.remove(); window.myMap = null }
  const hasFsPlugin = !!(L.Control && L.Control.Fullscreen)
  window.myMap = L.map('mapa-agentes', { fullscreenControl: hasFsPlugin })
                 .setView([6.25, -75.6], 7)
  if (hasFsPlugin) window.myMap.addControl(new L.Control.Fullscreen())
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 15, attribution: 'Map data © OpenStreetMap contributors'
  }).addTo(window.myMap)

  municipalitiesMap.value.forEach(m => {
    if (!m.lat || !m.lon) return
    const items = Object.entries(m.breakdown).sort((a,b) => b[1] - a[1])
    const labelTitulo = isLeaderGroup.value ? 'Unidades' : 'Grupos'

    // 🔹 Agregamos nicknames si existen
    const namesByGroupNorm = m.namesByGroupNorm || {}
    const listHtml = items.map(([k,v]) => {
      const kn = normText(k) // 👈 normalizamos la etiqueta del breakdown
      const names = (namesByGroupNorm[kn] || [])
        .map(n => `<li style="margin-left:12px; list-style-type:circle;">${n}</li>`)
        .join('')
      return `
        <li>
          ${k}: <b>${v}</b>
          ${names ? `<ul style="margin-top:2px;">${names}</ul>` : ''}
        </li>
      `
    }).join('')


    const popupHtml = `
      <b>${m.name}</b><br/>
      <span style="font-size:13px">${m.dept}</span><br/>
      Total agentes: <b>${m.total}</b><br/>
      <div style="margin-top:6px">
        <span style="font-size:12px;color:#475569">${labelTitulo}:</span>
        <ul style="margin:6px 0 0 16px; font-size:13px">
          ${listHtml || '<li>—</li>'}
        </ul>
      </div>
    `

    L.marker([m.lat, m.lon], {
      icon: L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize:[25,41], iconAnchor:[12,41]
      })
    }).addTo(window.myMap).bindPopup(popupHtml)
  })
}

// Fullscreen (fallback nativo)
function toggleFullscreen () {
  const el = document.getElementById('mapa-agentes')
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el)
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document)
  }
}

// ===== Agentes sin unidad (alerta/KPI + modal)
const agentesSinUnidad = ref(0)
const agentesSinUnidadList = ref([])   // [{id, code, category, groupId, groupCode}]
const sinUnidadModalOpen = ref(false)

async function loadAgentesSinUnidad () {
  try {
    // 1) Construir filtros según rol/selecciones
    const params = { freeOnly: 1, limit: 2000 } // queremos SOLO sin unidad
    if (isLeaderGroup.value && me.value?.groupId) {
      // líder de grupo: restringido a su propio grupo
      params.groupId = me.value.groupId
    } else {
      // admin/supervisor: puede filtrar por grupo desde el select
      if (selectedGroupId.value !== 'all') params.groupId = selectedGroupId.value
      // (no filtramos por unidad; buscamos precisamente sin unidad)
    }

    // 2) Llamada correcta al endpoint
    const { data } = await axios.get('/admin/agents', {
      params,
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })

   // 3) Filtrar por seguridad (unitId null/0)
    let arr = Array.isArray(data.items) ? data.items : [];
    let list = arr.filter(a =>
      !a.unitId ||
      a.unitId === null ||
      a.unitId === undefined ||
      a.unitId === '' ||
      a.unitId === 0 ||
      a.unitId === 'null'
    );

    // 4) Ordenar por categoría y código
    const CATEG_ORDER = { 'OF': 1, 'SO': 2, 'PT': 3 }
    list.sort(
      (x, y) =>
        (CATEG_ORDER[x.category] || 99) - (CATEG_ORDER[y.category] || 99) ||
        String(x.code).localeCompare(String(y.code))
    )

    agentesSinUnidadList.value = list
    agentesSinUnidad.value = list.length
  } catch (err) {
    console.error('Error loadAgentesSinUnidad:', err)
    agentesSinUnidadList.value = []
    agentesSinUnidad.value = 0
  }
}

function openSinUnidadModal () {
  if (agentesSinUnidad.value > 0) sinUnidadModalOpen.value = true
}


// ===== Cumplimiento
const checkpointLabel = 'diario'

// Líder
const compliance = ref({ done: [], pending: [] })
async function loadComplianceLeader () {
  let url = '/dashboard/compliance'
  const params = { date: date.value }
  if (isLeaderGroup.value && me.value?.groupId) {
    url = '/dashboard/compliance-units'
    params.groupId = me.value.groupId
  }
  const { data } = await axios.get(url, {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  compliance.value = { done: data.done || [], pending: data.pending || [] }
}

// Admin/Supervisor
const compAdmin = ref({ complete: [], pending: [] })
const openGroupId = ref(null)
const complianceBox = ref(null)

async function loadComplianceAdmin () {
  const [unitsResp, groupsResp, reportsResp] = await Promise.all([
    axios.get('/admin/units',  { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }),
    axios.get('/admin/groups', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }),
    axios.get('/reports',      { params: { date: date.value }, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
  ])

  const unitsList   = Array.isArray(unitsResp.data)  ? unitsResp.data  : []
  const groupsList  = Array.isArray(groupsResp.data) ? groupsResp.data : []
  const reportsList = Array.isArray(reportsResp.data)? reportsResp.data: []

  // groupId -> unidades
  const unitsByGroup = {}
  for (const u of unitsList) {
    if (!unitsByGroup[u.groupId]) unitsByGroup[u.groupId] = []
    unitsByGroup[u.groupId].push(u)
  }

  // groupId -> Set(unitId) reportadas ese día
  const reportedByGroup = {}
  for (const r of reportsList) {
    const gid = r.groupId, uid = r.unitId
    if (!reportedByGroup[gid]) reportedByGroup[gid] = new Set()
    if (uid) reportedByGroup[gid].add(uid)
  }

  const complete = []
  const pending  = []

  for (const g of groupsList) {
    const allUnits   = unitsByGroup[g.id] || []
    const totalUnits = allUnits.length
    const repSet     = reportedByGroup[g.id] || new Set()
    const doneUnits  = [...repSet].length
    const missingUnits = allUnits.filter(u => !repSet.has(u.id)).map(u => u.name)
    const percent = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 100

    if (totalUnits === 0 || percent === 100) {
      complete.push({ groupId: g.id, groupCode: g.code })
    } else {
      pending.push({ groupId: g.id, groupCode: g.code, totalUnits, doneUnits, percent, missingUnits })
    }
  }

  compAdmin.value = {
    complete: complete.sort((a,b)=>a.groupCode.localeCompare(b.groupCode)),
    pending : pending.sort((a,b)=>a.groupCode.localeCompare(b.groupCode))
  }
}

function togglePendingPopover(id){ openGroupId.value = openGroupId.value === id ? null : id }
function onComplianceOutsideClick(e){
  const el = complianceBox.value
  if (!el) return
  if (!el.contains(e.target)) openGroupId.value = null
}

// ===== Tabla (líder por unidad / admin por grupo)
const rowsDisplayLeader = computed(() =>
  rows.value.map(r => ({
    _key: r.id,
    id: r.id,
    unitName: r.unitName,
    groupCode: r.groupCode,
    // Fecha del reporte programada (mañana):
    date: r.date,
    // Fecha/hora reales de envío:
    submittedAt: r.updatedAt,   // 👈 usamos updatedAt
    time: r.updatedAt,          // ya usabas updatedAt para la hora
    FE:  `${r.OF_effective||0}/${r.SO_effective||0}/${r.PT_effective||0}`,
    FD:  `${r.OF_available||0}/${r.SO_available||0}/${r.PT_available||0}`,
    NOV: `${r.OF_nov||0}/${r.SO_nov||0}/${r.PT_nov||0}`,
    late: isLateBogota(r.updatedAt)
  }))
);


const completeGroupCodes = computed(() => new Set(compAdmin.value.complete.map(x => x.groupCode)))

const rowsDisplayAdmin = computed(() => {
  const codeById = new Map(grupos.value.map(g => [String(g.id), g.code]));
  const map = new Map(); // key = groupId

  for (const r of rows.value) {
    const gid = String(r.groupId ?? r.group_id ?? '');
    if (!gid) continue;

    if (!map.has(gid)) {
      map.set(gid, {
        _key: gid,
        groupId: gid,
        groupCode: r.groupCode || codeById.get(gid) || `Grupo ${gid}`,
        date: r.date,               // fecha del reporte (programada)
        updatedAtMax: r.updatedAt || null, // para “hora/fecha de envío” (máxima del grupo)
        OF_effective:0, SO_effective:0, PT_effective:0,
        OF_available:0, SO_available:0, PT_available:0,
        OF_nov:0, SO_nov:0, PT_nov:0
      });
    }

    const g = map.get(gid);
    const ts  = new Date(r.updatedAt||0).getTime();
    const old = new Date(g.updatedAtMax||0).getTime();
    if (isFinite(ts) && ts > old) g.updatedAtMax = r.updatedAt;

    g.OF_effective += r.OF_effective||0;
    g.SO_effective += r.SO_effective||0;
    g.PT_effective += r.PT_effective||0;
    g.OF_available += r.OF_available||0;
    g.SO_available += r.SO_available||0;
    g.PT_available += r.PT_available||0;
    g.OF_nov += r.OF_nov||0;
    g.SO_nov += r.SO_nov||0;
    g.PT_nov += r.PT_nov||0;
  }

  const completeIds = new Set(compAdmin.value.complete.map(x => String(x.groupId)));

  const out = [];
  for (const [gid, g] of map.entries()) {
    const isComplete = completeIds.has(gid);
    const submittedAt = isComplete ? g.updatedAtMax : null; // 👈 fecha/hora reales (máx del grupo)
    out.push({
      _key: gid,
      groupCode: g.groupCode,
      groupId: g.groupId,
      // Fecha del reporte (programada)
      date: g.date,
      // Fecha/hora de envío reales:
      submittedAt,                 // 👈 nueva propiedad
      time: submittedAt,           // para la columna “Hora”
      isComplete,
      FE:  `${g.OF_effective}/${g.SO_effective}/${g.PT_effective}`,
      FD:  `${g.OF_available}/${g.SO_available}/${g.PT_available}`,
      NOV: `${g.OF_nov}/${g.SO_nov}/${g.PT_nov}`
    });
  }
  return out.sort((a,b)=> String(a.groupCode).localeCompare(String(b.groupCode)));
});

// Vista anidada para Admin/Supervisor: grupos con sus unidades e "hora de actualización"
const rowsDisplayAdminNested = computed(() => {
  // Mapa de códigos de grupo
  const codeById = new Map(grupos.value.map(g => [String(g.id), g.code]))
  // Ids de grupos completos (todas sus unidades reportadas)
  const completeIds = new Set(compAdmin.value.complete.map(x => String(x.groupId)))

  // groupId -> objeto agrupado con totales + unidades
  const byGroup = new Map()

  for (const r of rows.value) {
    const gid = String(r.groupId ?? r.group_id ?? '')
    if (!gid) continue

    // Crear contenedor de grupo si no existe
    if (!byGroup.has(gid)) {
      byGroup.set(gid, {
        _key: gid,
        groupId: gid,
        groupCode: r.groupCode || codeById.get(gid) || `Grupo ${gid}`,
        // Totales del grupo (sumas de sus unidades)
        OF_effective: 0, SO_effective: 0, PT_effective: 0,
        OF_available: 0, SO_available: 0, PT_available: 0,
        OF_nov: 0,      SO_nov: 0,      PT_nov: 0,
        // Máxima fecha/hora de envío (para el grupo)
        updatedAtMax: null,
        // Unidades del grupo
        units: []
      })
    }
    const g = byGroup.get(gid)

    // Acumula totales del grupo
    g.OF_effective += r.OF_effective || 0
    g.SO_effective += r.SO_effective || 0
    g.PT_effective += r.PT_effective || 0
    g.OF_available += r.OF_available || 0
    g.SO_available += r.SO_available || 0
    g.PT_available += r.PT_available || 0
    g.OF_nov      += r.OF_nov || 0
    g.SO_nov      += r.SO_nov || 0
    g.PT_nov      += r.PT_nov || 0

    // Max de updatedAt para el grupo (hora real de envío)
    const ts = new Date(r.updatedAt || 0).getTime()
    const old = new Date(g.updatedAtMax || 0).getTime()
    if (isFinite(ts) && ts > old) g.updatedAtMax = r.updatedAt || null

    // Push de la unidad con su hora real de actualización
    g.units.push({
      unitId: r.unitId,
      unitName: r.unitName || `Unidad ${r.unitId || '—'}`,
      date: r.date,                // fecha programada del parte
      submittedAt: r.updatedAt,    // hora real de envío por unidad
      time: r.updatedAt,
      FE:  `${r.OF_effective||0}/${r.SO_effective||0}/${r.PT_effective||0}`,
      FD:  `${r.OF_available||0}/${r.SO_available||0}/${r.PT_available||0}`,
      NOV: `${r.OF_nov||0}/${r.SO_nov||0}/${r.PT_nov||0}`,
      late: isLateBogota(r.updatedAt)
    })
  }

  // Arma salida ordenada por código de grupo y marca "isComplete"
  const out = []
  for (const [gid, g] of byGroup.entries()) {
    out.push({
      _key: gid,
      groupId: gid,
      groupCode: g.groupCode,
      date: g.units[0]?.date || null,          // fecha programada del parte (referencial)
      submittedAt: completeIds.has(gid) ? g.updatedAtMax : null,  // hora real si está completo
      time: completeIds.has(gid) ? g.updatedAtMax : null,
      isComplete: completeIds.has(gid),
      FE:  `${g.OF_effective}/${g.SO_effective}/${g.PT_effective}`,
      FD:  `${g.OF_available}/${g.SO_available}/${g.PT_available}`,
      NOV: `${g.OF_nov}/${g.SO_nov}/${g.PT_nov}`,
      units: g.units.sort((a,b)=> String(a.unitName).localeCompare(String(b.unitName))),
      groupLate: g.units.some(u => u.late)
    })
  }
  return out.sort((a,b)=> String(a.groupCode).localeCompare(String(b.groupCode)))
})

const tableRows = computed(() => isAdminView.value ? rowsDisplayAdmin.value : rowsDisplayLeader.value)

// ===== Carga / Export
async function load () {
  const params = { date_from: date.value, date_to: date.value }
  if (isLeaderGroup.value && me.value?.groupId) {
    params.groupId = me.value.groupId
  } else {
    if (selectedGroupId.value !== 'all') params.groupId = selectedGroupId.value
    if (selectedUnitId.value  !== 'all') params.unitId  = selectedUnitId.value
  }
  const { data } = await axios.get('/dashboard/reports', {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  rows.value = data.items || []
  recalcTotals()
}

async function descargarExcel () {
  try {
    const params = { date: date.value }
    if (isLeaderGroup.value) params.groupId = me.value.groupId
    else {
      if (selectedGroupId.value !== 'all') params.groupId = selectedGroupId.value
      if (selectedUnitId.value  !== 'all') params.unitId  = selectedUnitId.value
    }

    const { data } = await axios.get('/reports/export', {
      params,
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })

    const rows = Array.isArray(data) ? data : []
    const normalizado = rows.map(row => {
      const out = {}
      for (const k in row) {
        if (k === 'mt') continue // 👈 que no la pise el normalizador
        let v = row[k]
        if (k === 'descripcion' && row.novedad === 'SIN NOVEDAD') out[k] = 'SIN NOVEDAD'
        else if (k === 'descripcion' && row.novedad === 'FRANCO FRANCO') out[k] = 'FRANCO FRANCO'
        else if (k === 'novedad' && typeof v === 'string') {
          let nv = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          if (nv.toUpperCase() === 'COMISION DEL SERVICIO') nv = 'COMISION SERVICIO'
          else if (nv.toUpperCase() === 'COMISION DE ESTUDIO') nv = 'COMISION ESTUDIO'
          else if (nv.toUpperCase() === 'PERMISO ACTIVIDAD PERSONAL') nv = 'PERMISO'
          out[k] = nv
        } else if (v == null || (typeof v === 'string' && v.trim() === '')) out[k] = 'N/A'
        else out[k] = v
      }
      const mtVal = typeof row.mt === 'string' ? row.mt.trim() : (row.mt ?? '')
      out['M.T'] = mtVal !== '' ? mtVal : 'N/A'
      return out
    })

    const header = [
      'codigo_agente','novedad','descripcion',
      'fecha_inicio','fecha_fin','grupo','unidad',
      'ubicacion','M.T'
    ]

    const ws = XLSX.utils.json_to_sheet(normalizado, { header })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DatosNovedades')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `novedades_${params.date}.xlsx`)
  } catch (e) {
    console.error('descargarExcel error:', e)
    alert(e?.response?.data?.detail || e?.response?.data?.error || 'No se pudo generar el Excel')
  }
}



// ===== Acciones

// ===== Modal Novedades
const novModalOpen = ref(false)
const novTab = ref('tipos') // 'tipos' | 'ambito'
const novTiposRows = ref([])   // [{ novedad, OF, ME, PT, total }]
const novAmbitoRows = ref([])  // [{ label,  OF, ME, PT, total }]

function sum(list, key) {
  return list.reduce((a, b) => a + (Number(b[key])||0), 0)
}

async function openNovModal() {
  novModalOpen.value = true
  novTab.value = 'tipos'
  await loadNovDetails()

  // 🟢 Si no hay selección, toma la primera novedad con datos
  if (!novSelected.value && novTiposRows.value.length) {
    novSelected.value = novTiposRows.value[0].novedad
    await loadNovAgents() // carga inmediata del panel derecho
  }
}

// arma filtros según rol y selects actuales
function buildCommonParams() {
  const params = { date: date.value }
  if (isLeaderGroup.value && me.value?.groupId) {
    params.groupId = me.value.groupId
    if (selectedLeaderUnitId.value !== 'all') params.unitId = selectedLeaderUnitId.value
  } else {
    if (selectedGroupId.value !== 'all') params.groupId = selectedGroupId.value
    if (selectedUnitId.value  !== 'all') params.unitId  = selectedUnitId.value
  }
  return params
}

// --- Detalle discriminado por novedad (por grupo/unidad)
const novAmbitoDetRows = ref([]) // [{ label, novedad, OF, ME, PT, total }]

// cards agrupadas por ámbito -> [{ label, items:[{ novedad, OF, ME, PT, total }] }]
const novAmbitoCards = computed(() => {
  const map = new Map()
  for (const r of novAmbitoDetRows.value) {
    const label = r.label || r.groupCode || r.unitName || '—'
    if (!map.has(label)) map.set(label, [])
    map.get(label).push({
      novedad: r.novedad,
      OF: Number(r.OF || r.OF_count || 0),
      ME: Number(r.ME || r.SO || r.SO_count || 0),
      PT: Number(r.PT || r.PT_count || 0),
      total: (Number(r.OF || r.OF_count || 0)
            + Number(r.ME || r.SO || r.SO_count || 0)
            + Number(r.PT || r.PT_count || 0))
    })
  }
  // ordena cada card por total desc y filtra "SIN NOVEDAD"
  const out = []
  for (const [label, items] of map.entries()) {
    const clean = items.filter(i => String(i.novedad).toUpperCase() !== 'SIN NOVEDAD')
                       .sort((a,b)=> b.total - a.total)
    out.push({ label, items: clean })
  }
  // ordena cards por etiqueta
  return out.sort((a,b)=> String(a.label).localeCompare(String(b.label)))
})

async function loadNovDetails() {
  const params = buildCommonParams()

  // 1) Por tipo (global) - ya lo tenías
  const { data: tipos } = await axios.get('/dashboard/novelties-by-type', {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  novTiposRows.value = (tipos?.items || [])
    .filter(r => String(r.novedad || '').trim().toUpperCase() !== 'SIN NOVEDAD')
    .map(r => ({
      novedad: r.novedad,
      OF: Number(r.OF || r.OF_count || 0),
      ME: Number(r.ME || r.SO || r.SO_count || 0),
      PT: Number(r.PT || r.PT_count || 0),
      total: (Number(r.OF || r.OF_count || 0)
            + Number(r.ME || r.SO || r.SO_count || 0)
            + Number(r.PT || r.PT_count || 0))
    }))

  // 2) Por ámbito (totales)
  const scopeUrl = isAdminView.value ? '/dashboard/novelties-by-group' : '/dashboard/novelties-by-unit'
  const { data: amb } = await axios.get(scopeUrl, {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  novAmbitoRows.value = (amb?.items || []).map(r => ({
    label: r.label || r.groupCode || r.unitName,
    OF: Number(r.OF || r.OF_count || 0),
    ME: Number(r.ME || r.SO || r.SO_count || 0),
    PT: Number(r.PT || r.PT_count || 0),
    total: (Number(r.OF || r.OF_count || 0)
          + Number(r.ME || r.SO || r.SO_count || 0)
          + Number(r.PT || r.PT_count || 0))
  }))

  // 3) Por ámbito con detalle por novedad (NUeVO)
  const bdUrl = isAdminView.value
    ? '/dashboard/novelties-by-group-breakdown'
    : '/dashboard/novelties-by-unit-breakdown'

  const { data: det } = await axios.get(bdUrl, {
    params, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  })
  // Espera items: [{ label/groupCode/unitName, novedad, OF, ME/SO, PT }]
  novAmbitoDetRows.value = (det?.items || []).filter(
    r => String(r.novedad || '').trim().toUpperCase() !== 'SIN NOVEDAD'
  )
}

function findGroupIdByCode(code) {
  if (!code) return null;
  const g = grupos.value.find(x => String(x.code).toUpperCase() === String(code).toUpperCase());
  return g?.id ?? null;
}

function findUnitIdByName(name) {
  if (!name) return null;
  const u = units.value.find(x => String(x.name).toUpperCase() === String(name).toUpperCase());
  return u?.id ?? null;
}

/**
 * A partir de la etiqueta de card/fila ("G01" o "Unidad Central")
 * fija el ámbito correspondiente (groupId o unitId) y retorna true si lo logró.
 */
function applyScopeFromLabel(label) {
  if (isAdminView.value) {
    // En Admin, las labels de "ambito" son groupCode
    const gid = findGroupIdByCode(label);
    if (gid) {
      selectedGroupId.value = String(gid);
      selectedUnitId.value = 'all';
      return true;
    }
  } else {
    // En líder, las labels son nombre de unidad
    const uid = findUnitIdByName(label);
    if (uid) {
      selectedLeaderUnitId.value = String(uid);
      return true;
    }
  }
  return false;
}

async function pickScopeAndNovedad(label, novedad) {
  // 1) fija ámbito desde la etiqueta
  const ok = applyScopeFromLabel(label);
  // 2) selecciona novedad y asegura pestaña correcta
  novSelected.value = novedad;
  novTab.value = 'tipos';

  // 3) si no pudo fijar ámbito (admin sin match), no intentes cargar
  if (isAdminView.value && !ok && !buildCommonParams().groupId && !buildCommonParams().unitId) {
    return;
  }

  await loadNovAgents();
}

// ===== Detalle: funcionarios por novedad (panel lateral)
const novSelected = ref(null)         // string con el nombre de la novedad seleccionada
const novAgents = ref([])             // [{ id, code, nickname, category, groupCode?, unitName? }]
const novAgentsLoading = ref(false)
const novAgentsQuery = ref('')
const novAgentsCat = ref('ALL')       // ALL | OF | ME | PT

function onClickNovedad(novedad) {
  if (novSelected.value === novedad) {
    novSelected.value = null;
    novAgents.value = [];
    return;
  }
  novSelected.value = novedad;
  // opcional: garantiza que estás en la pestaña "Por novedad"
  novTab.value = 'tipos';
  loadNovAgents();
}

function normStr(x) {
  return String(x || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sin tildes
    .trim().toUpperCase();
}

async function reloadNovAgents(){ if (novSelected.value) await loadNovAgents() }

// ---- CACHÉ DE AGENTES PARA ENRIQUECER (code -> {nickname, category, groupCode, unitName})
const _agentsCache = ref(null) // Map<string, AgentMin>
async function getAgentsLookup () {
  if (_agentsCache.value) return _agentsCache.value

  const token = localStorage.getItem('token')
  let items = []
  try {
    if (isLeaderGroup.value) {
      // líder: que el backend limite a su grupo
      const { data } = await axios.get('/my/agents', {
        params: { limit: 5000 },
        headers: { Authorization: 'Bearer ' + token }
      })
      items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    } else {
      // admin/supervisor: todos
      const { data } = await axios.get('/admin/agents', {
        params: { limit: 5000 },
        headers: { Authorization: 'Bearer ' + token }
      })
      items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    }
  } catch (e) {
    console.error('getAgentsLookup error:', e)
    items = []
  }

  // arma el map por código (string)
  const map = new Map()
  for (const a of items) {
    const code = String(a.code ?? a.codigo ?? '').trim()
    if (!code) continue
    map.set(code, {
      nickname: a.nickname ?? a.nombre ?? a.name ?? '',
      category: a.category ?? a.categoria ?? '',
      groupCode: a.groupCode ?? a.grupo ?? '',
      unitName : a.unitName  ?? a.unidad ?? ''
    })
  }
  _agentsCache.value = map
  return map
}

// ---- CARGA DE FUNCIONARIOS POR NOVEDAD (sin depender de filtro grupo/unidad)
async function loadNovAgents() {
  if (!novSelected.value) { novAgents.value = []; return; }

  novAgentsLoading.value = true
  try {
    const token = localStorage.getItem('token')

    // 1) Trae TODO el día desde export (rol ya restringe lo que corresponde)
    const { data } = await axios.get('/reports/export', {
      params: { date: date.value },
      headers: { Authorization: 'Bearer ' + token }
    })
    const rows = Array.isArray(data) ? data : (data?.items || [])

    const sel = normStr(novSelected.value)

    // 2) Filtra por novedad (y excluye SIN NOVEDAD)
    const filtered = rows.filter(r => {
      const nov = normStr(r.novedad || r.novelty || '')
      return nov && nov !== 'SIN NOVEDAD' && nov === sel
    })

    // 3) Lookup de agentes por código para enriquecer (nickname / category / grupo / unidad)
    const lookup = await getAgentsLookup()

    // 4) Normaliza y enriquece
    const norm = filtered.map(row => {
      const code =
        String(row.codigo_agente ?? row.code ?? '').trim()

      const base = lookup.get(code) || {
        nickname: row.funcionario || '',     // por si tu export ya lo incluyera en el futuro
        category: row.categoria || '',       // idem
        groupCode: row.grupo || '',
        unitName : row.unidad || ''
      }

      // SO -> ME como pedías
      const cat = (base.category === 'SO' ? 'ME' : base.category) || '—'

      return {
        id: row.id || row.agentId || code,
        code,
        nickname: base.nickname || '—',
        category: cat,
        groupCode: base.groupCode || '',
        unitName : base.unitName || ''
      }
    })

    // 5) Orden: categoría y nombre
    const CAT_ORDER = { OF: 1, ME: 2, PT: 3 }
    novAgents.value = norm.sort((x, y) =>
      (CAT_ORDER[x.category] || 99) - (CAT_ORDER[y.category] || 99) ||
      String(x.nickname || '').localeCompare(String(y.nickname || ''), 'es', { sensitivity: 'base' })
    )
  } catch (e) {
    console.error('loadNovAgents error:', e)
    novAgents.value = []
  } finally {
    novAgentsLoading.value = false
  }
}

const novAgentsFiltered = computed(() => {
  let list = novAgents.value
  if (novAgentsCat.value !== 'ALL') {
    list = list.filter(a => a.category === novAgentsCat.value)
  }
  const q = novAgentsQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(a =>
      (a.code||'').toLowerCase().includes(q) ||
      (a.nickname||'').toLowerCase().includes(q)
    )
  }
  return list
})

const novCounts = computed(() => {
  return novAgents.value.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1
    return acc
  }, { OF:0, ME:0, PT:0 })
})

// Export CSV de los funcionarios listados
async function exportNovAgentsCsv () {
  try {
    // Construye con el filtro actual aplicado (buscador + categoría)
    const rows = novAgentsFiltered.value.map(a => ({
      codigo: a.code,
      funcionario: a.nickname,
      categoria: a.category,
      ambito: isAdminView.value
        ? (a.groupCode || ('G'+(a.groupId || '—')))
        : (a.unitName || ('U'+(a.unitId || '—'))),
      novedad: novSelected.value
    }))

    // Genera CSV simple (sin dependencias extra)
    const header = ['codigo','funcionario','categoria','ambito','novedad']
    const lines = [
      header.join(','),
      ...rows.map(r => header.map(h => {
        const v = (r[h] ?? '').toString().replace(/"/g,'""')
        return /[",\n]/.test(v) ? `"${v}"` : v
      }).join(','))
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `funcionarios_${(novSelected.value||'novedad')}_${date.value}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('exportNovAgentsCsv error:', e)
    alert('No se pudo exportar el CSV')
  }
}

async function applyFilters () {
  await load()
  if (isLeaderGroup.value) await loadComplianceLeader()
  else await loadComplianceAdmin()
  await loadMapData()
  await loadAgentesSinUnidad()
  await loadNovDetails()
}
async function reloadCompliance () {
  if (isLeaderGroup.value) await loadComplianceLeader()
  else await loadComplianceAdmin()
}

// === Helpers para mostrar "a/b/c (suma)" en gris y pequeño ===
function parseTriad(val) {
  if (val == null) return null;

  if (typeof val === 'string') {
    const m = val.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
    if (m) return { of: +m[1], me: +m[2], pt: +m[3] };
    try {
      return parseTriad(JSON.parse(val));
    } catch (_) {
      return null;
    }
  }

  if (typeof val === 'object') {
    const of = +(val.of ?? val.OF ?? 0);
    const me = +(val.me ?? val.ME ?? 0);
    const pt = +(val.pt ?? val.PT ?? 0);
    return { of, me, pt };
  }

  return null;
}

function fmtTriadWithSum(val) {
  const t = parseTriad(val);
  if (!t) return val ?? '';
  const sum = t.of + t.me + t.pt;
  // Devuelve HTML con la suma en gris y tamaño más pequeño
  return `${t.of}/${t.me}/${t.pt} <span class="text-slate-400 text-[11px]">( ${sum} )</span>`;
}
function goToParte() {
  router.push('/parte')
}

// ===== Init
function handleClickOutside(e){
  const el = complianceBox.value
  if (!el) return
  if (!el.contains(e.target)) openGroupId.value = null
}

onMounted(async () => {
  await loadMe()
  await loadGrupos()
  if (isAdminView.value) await loadUnits()
  if (isLeaderGroup.value) await loadMyUnits()

  selectedGroupId.value = 'all'
  selectedUnitId.value  = 'all'
  selectedLeaderUnitId.value = 'all'

  await load()
  if (isLeaderGroup.value) await loadComplianceLeader()
  else await loadComplianceAdmin()
  await loadMapData()
  await loadAgentesSinUnidad()

  document.addEventListener('click', onComplianceOutsideClick)
})
onBeforeUnmount(() => document.removeEventListener('click', onComplianceOutsideClick))

watch([date, selectedGroupId, selectedUnitId], async () => {
  novSelected.value = null;     
  novAgents.value = [];         
  await applyFilters()
})
</script>
