<template>
  <div class="min-h-screen bg-slate-50">
    <!-- HERO -->
    <div class="bg-gradient-to-r from-slate-800 to-slate-700">
      <div class="max-w-6xl mx-auto px-4 py-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-white text-2xl font-semibold">Reporte del día</h1>
            <p class="text-slate-300 text-sm mt-1">Consolida y envía las novedades diarias</p>
          </div>
        </div>
      </div>
    </div>

    <!-- LAYOUT: Sidebar + Contenido -->
    <div class="max-w-[2000px] mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] gap-7 -mt-10 sm:-mt-12 md:-mt-12 relative z-10">
      <!-- ===== Sidebar (estilo similar al del agente) ===== -->
      <aside class="order-1 md:order-1 md:col-[1] space-y-4 md:sticky md:top-6">
        <!-- Tarjeta usuario -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow p-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/>
                <path d="M4.5 19.5a7.5 7.5 0 0115 0"/>
              </svg>
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-slate-900 truncate">{{ me?.name || me?.username || '—' }}</div>
              <div class="text-xs text-slate-500 truncate">Unidad: {{ me?.unitName || '—' }}</div>
              <div class="text-xs text-slate-400 truncate">Grupo: {{ me?.groupCode || '—' }}</div>
            </div>
          </div>
          <button
            @click="logout"
            class="mt-4 w-full px-3 py-2 rounded-xl text-white bg-slate-800 hover:bg-slate-900"
          >
            Cerrar sesión
          </button>
        </div>

        <!-- Menú -->
        <nav class="mt-4 bg-white rounded-2xl shadow p-2">
            <button
              v-for="item in menu"
              :key="item.key"
              @click="section=item.key"
              class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm"
              :class="section===item.key ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'">
              <span class="truncate">{{ item.label }}</span>
              <svg v-if="section===item.key" class="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </nav>

          <!-- Banner de fechas -->
        <FechasBanner top-offset="top-14" color="amber" />
      </aside>

      <!-- ===== CONTENIDO ===== -->
      <main class="order-2 md:order-2 md:col-[2] space-y-6">

        <!-- Tarjeta principal -->
         
        <section v-show="section==='captura'" class="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
          <!-- Header de tarjeta -->
          <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 class="text-slate-900 font-semibold">Captura de novedades</h2>
              <p class="text-xs text-slate-500 -mt-0.5">Selecciona la fecha, agrega agentes y define su estado</p>
            </div>
            
          </div>
          
          <!-- Body (tu contenido original) -->
          <div class="p-4 space-y-6">
            <!-- Fecha -->
            <div>
              <label class="text-xs font-medium text-slate-600 mb-1 block">Fecha</label>
              <input
                type="date"
                class="w-full max-w-xs rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                v-model="reportDate"
              />
              <p class="text-xs text-slate-500 mt-1">Selecciona una fecha para consultar/editar el reporte de ese día.</p>
            </div>

            <!-- Buscar y agregar agente -->
            <div class="grid grid-cols-1 sm:grid-cols-[minmax(260px,360px)_max-content] gap-3 items-start">
              <div class="flex flex-col">
                <label class="text-xs font-medium text-slate-600 mb-1 block">Agregar agente</label>
                <input
                  class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  list="free-agents-list"
                  v-model="agentSearch"
                  @input="onAgentSearchInput"
                  placeholder="Buscar código o nickname (ej: O101 o NOM.APE)..."
                  autocomplete="off"
                />

                <datalist id="free-agents-list">
                  <option
                    v-for="a in agentSearchResults.filter(x => !agents.some(y => y.code === x.code))"
                    :key="a.id"
                    :value="a.code"
                    @click="onSelectAgent(a.code)"
                  >
                    {{ a.code }}
                    <template v-if="a.nickname">
                      — "{{ a.nickname }}"
                    </template>
                    ({{ displayCategory(a.category) }}){{ a.unitName ? ' — ' + a.unitName : '' }}
                  </option>
                </datalist>
                <p v-if="agentOwnershipMsg" class="mt-1 h-5 text-xs text-amber-700">{{ agentOwnershipMsg }}</p>
                <p v-else class="mt-1 h-5 text-xs">&nbsp;</p>
              </div>

              <div class="flex flex-col items-start">
                <label class="text-xs font-medium text-slate-600 mb-1 invisible select-none">.</label>
                <button
                  class="px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 whitespace-nowrap"
                  @click="addFreeAgent"
                  :disabled="!canAddSelected"
                >
                  Agregar
                </button>
              </div>
            </div>

            <!-- Tabla desktop -->
            <div class="hidden md:block">
              <div class="overflow-auto rounded-xl border border-slate-200">
                <table class="min-w-full text-sm">
                  <thead class="bg-slate-800 text-white">
                    <tr>
                      <th class="text-left py-2 px-3 font-semibold">Código</th>
                      <th class="text-left py-2 px-3 font-semibold">Cat</th>
                      <th class="text-left py-2 px-3 font-semibold">Días Lab</th>
                      <th class="text-left py-2 px-3 font-semibold">Historial</th>
                      <th class="text-left py-2 px-3 font-semibold">Misión</th>
                      <th class="text-left py-2 px-3 font-semibold">Estado</th>
                      <th class="text-left py-2 px-3 font-semibold">Ubicación / Detalle</th>
                      <th class="text-left py-2 px-3 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody class="bg-white">
                    <tr v-for="(a, i) in agents" :key="a.id" class="border-t">
                      <td class="py-2 px-3">
                        <div class="font-medium text-slate-900">{{ a.code }}</div>
                        <div v-if="a.nickname" class="text-xs text-slate-500 mt-0.5">({{ a.nickname }})</div>
                      </td>
                      <td class="py-2 px-3">{{ displayCategory(a.category) }}</td>

                      <td>                        
                        <span
                          :class="[
                            'inline-block min-w-[2.5em] text-center rounded px-1',
                            a.diasLaborados >= 45
                              ? 'bg-red-100 text-red-600 font-bold border border-red-200'
                              : a.diasLaborados >= 30
                                ? 'bg-orange-100 text-orange-700 font-semibold border border-orange-200'
                                : a.diasLaborados > 0
                                  ? 'bg-green-50 text-green-700 font-semibold border border-green-200'
                                  : 'text-slate-400 border border-slate-200 bg-white'
                          ]"
                          :title="a.diasLaborados >= 45
                            ? '¡Alerta! tiempo prolongado sin descanso'
                            : a.diasLaborados >= 30
                              ? 'Atención: Más de un mes sin descansar'
                              : a.diasLaborados > 0
                                ? 'Días consecutivos laborados'
                                : 'Sin días laborados'"
                        >
                          {{ a.diasLaborados ?? 0 }}
                        </span>
                      </td>

                      <td>
                      <button class="btn-ghost p-1" title="Historial" @click="openHistory(a)">
                        <!-- icono reloj -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"></circle>
                        </svg>
                      </button>
                    </td>
                    <td class="py-2 px-3">
                      <input
                        class="w-full sm:w-40 md:w-32 lg:w-28 xl:w-28 rounded-lg border px-3 py-2 shadow-sm focus:ring-2"
                        
                        v-model.trim="a.mt"
                        placeholder="0000-5555-6666"
                        maxlength="120"
                      />
                      <p v-if="isMtInvalid(a.mt)" class="text-[11px] text-rose-600 mt-1">
                        Formato inválido. Usa solo números y guiones.
                      </p>
                    </td>
                      <td class="py-2 px-3 ">
                        <select
                          class="w-56 rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          v-model="a.status"
                          @change="onStateChange(a)"
                        >
                          <option value="SIN NOVEDAD">SIN NOVEDAD</option>
                          <option value="COMISIÓN DEL SERVICIO">COMISIÓN DEL SERVICIO</option>
                          <option value="FRANCO FRANCO">FRANCO FRANCO</option>
                          <option value="SERVICIO">SERVICIO</option>
                          <option value="VACACIONES">VACACIONES</option>
                          <option value="LICENCIA DE MATERNIDAD">LICENCIA DE MATERNIDAD</option>
                          <option value="LICENCIA DE LUTO">LICENCIA DE LUTO</option>
                          <option value="LICENCIA REMUNERADA">LICENCIA REMUNERADA</option>
                          <option value="LICENCIA NO REMUNERADA">LICENCIA NO REMUNERADA</option>
                          <option value="EXCUSA DEL SERVICIO">EXCUSA DEL SERVICIO</option>
                          <option value="LICENCIA PATERNIDAD">LICENCIA PATERNIDAD</option>
                          <option value="PERMISO">PERMISO</option>
                          <option value="DESCANSO ESPECIAL">DESCANSO ESPECIAL</option>
                          <option value="PERMISO ACTIVIDAD PERSONAL">PERMISO ACTIVIDAD PERSONAL</option>
                          <option value="COMISIÓN EN EL EXTERIOR">COMISIÓN EN EL EXTERIOR</option>
                          <option value="COMISIÓN DE ESTUDIO">COMISIÓN DE ESTUDIO</option>
                          <option value="SUSPENDIDO">SUSPENDIDO</option>
                          <option value="HOSPITALIZADO">HOSPITALIZADO</option>
                        </select>
                      </td>
                      <td class="py-2 px-3">
                        <!-- SIN NOVEDAD -->
                        <template v-if="a.status === 'SIN NOVEDAD'">
                          <input
                            class="w-full rounded-lg border border-slate-300 bg-slate-100 text-slate-900 px-3 py-2 shadow-sm"
                            :value="a.municipalityName || 'CUNDINAMARCA - Bogotá'"
                            readonly
                            tabindex="-1"
                          />
                        </template>

                        <!-- SERVICIO -->
                        <template v-else-if="a.status === 'SERVICIO'">
                          <input
                            class="w-full rounded-lg border border-slate-300 bg-slate-100 text-slate-900 px-3 py-2 shadow-sm mb-2"
                            :value="a.municipalityName || 'CUNDINAMARCA - Bogotá'"
                            readonly
                            tabindex="-1"
                          />
                          <div class="flex gap-2 mb-2">
                            <input
                              class="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                              type="date"
                              v-model="a.novelty_start"
                              :class="{'!border-red-500': agentHasRangeError(a)}"
                              placeholder="Fecha inicio"
                            />
                            <input
                              class="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                              type="date"
                              v-model="a.novelty_end"
                              :class="{'!border-red-500': agentHasRangeError(a)}"
                              placeholder="Fecha fin"
                            />
                          </div>
                          <p v-if="agentHasRangeError(a)" class="text-xs text-red-600 -mt-1 mb-2">
                            La fecha fin no puede ser menor a la fecha inicio.
                          </p>
                          <textarea
                            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                            v-model="a.novelty_description"
                            placeholder="Descripción..."
                            rows="1"
                          />
                        </template>

                        <!-- COMISIÓN DEL SERVICIO -->
                        <template v-else-if="a.status === 'COMISIÓN DEL SERVICIO'">
                          <div class="relative">
                            <input
                              class="w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-2"
                              :class="{
                                'border-green-500 focus:ring-green-200 bg-white': a.municipalityId,
                                'border-red-500 focus:ring-red-200 bg-white': a.municipalityName && !a.municipalityId,
                                'border-slate-300 focus:ring-indigo-200 bg-white': !a.municipalityName
                              }"
                              v-model="a.municipalityName"
                              @focus="muniOpen(a)"
                              @input="onMuniTyping(a)"
                              @blur="muniOnBlur(a)"
                              placeholder="Buscar municipio..."
                              autocomplete="off"
                              autocapitalize="off"
                              autocorrect="off"
                              spellcheck="false"
                            />

                            <!-- Botón limpiar -->
                            <button
                              v-if="a.municipalityName"
                              type="button"
                              class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 px-2 py-1"
                              @mousedown.prevent
                              @click="muniClear(a)"
                              title="Limpiar"
                            >
                              ✕
                            </button>

                            <!-- Dropdown sugerencias -->
                            <div
                              v-show="muniUi.openForAgentId === a.id"
                              class="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-56 overflow-auto"
                            >
                              <button
                                v-for="m in muniSuggestionsFor(a)"
                                :key="m.id"
                                type="button"
                                class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                                @mousedown.prevent
                                @click="muniPick(a, m)"
                              >
                                {{ m.dept }} - {{ m.name }}
                              </button>

                              <div v-if="muniSuggestionsFor(a).length === 0" class="px-3 py-2 text-sm text-slate-500">
                                Sin resultados
                              </div>
                            </div>
                          </div>

                          <span v-if="a.municipalityName && !a.municipalityId" class="text-red-500 text-xs">
                            Debe seleccionar un municipio válido
                          </span>

                          <textarea
                            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200 mt-2"
                            v-model="a.novelty_description"
                            placeholder="Descripción..."
                            rows="1"
                          />
                        </template>

                        <!-- FRANCO FRANCO -->
                        <template v-else-if="a.status === 'FRANCO FRANCO'">
                          <span class="text-xs text-slate-400">Sin datos adicionales</span>
                        </template>

                        <!-- SUSPENDIDO -->
                        <template v-else-if="a.status === 'SUSPENDIDO'">
                          <div class="flex gap-2 mb-2">
                            <input
                              class="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                              type="date"
                              v-model="a.novelty_start"
                              :class="{'!border-red-500': agentHasRangeError(a)}"
                              placeholder="Fecha inicio"
                            />
                            <input
                              class="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                              type="date"
                              v-model="a.novelty_end"
                              :class="{'!border-red-500': agentHasRangeError(a)}"
                              placeholder="Fecha fin"
                            />
                          </div>
                          <p v-if="agentHasRangeError(a)" class="text-xs text-red-600 -mt-1 mb-2">
                            La fecha fin no puede ser menor a la fecha inicio.
                          </p>
                          <textarea
                            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                            v-model="a.novelty_description"
                            placeholder="Descripción..."
                            rows="1"
                          />
                        </template>

                        <!-- HOSPITALIZADO -->
                        <template v-else-if="a.status === 'HOSPITALIZADO'">
                          <div class="flex gap-2 mb-2">
                            <input
                              class="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                              type="date"
                              v-model="a.novelty_start"
                              placeholder="Fecha inicio"
                            />
                          </div>
                          <textarea
                            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                            v-model="a.novelty_description"
                            placeholder="Descripción..."
                            rows="1"
                          />
                        </template>

                        <!-- Otros estados con rango -->
                        <template v-else>
                          <div class="flex gap-2 mb-2">
                            <input
                              class="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                              type="date"
                              v-model="a.novelty_start"
                              :class="{'!border-red-500': agentHasRangeError(a)}"
                              placeholder="Fecha inicio"
                            />
                            <input
                              class="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                              type="date"
                              v-model="a.novelty_end"
                              :class="{'!border-red-500': agentHasRangeError(a)}"
                              placeholder="Fecha fin"
                            />
                          </div>
                          <p v-if="agentHasRangeError(a)" class="text-xs text-red-600 -mt-1 mb-2">
                            La fecha fin no puede ser menor a la fecha inicio.
                          </p>
                          <textarea
                            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200"
                            v-model="a.novelty_description"
                            placeholder="Descripción..."
                            rows="1"
                          />
                        </template>
                      </td>
                      <td class="py-2 px-3 ">
                        <button
                          class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                          @click="removeAgent(a.id)"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>

                    <tr v-if="agents.length === 0">
                      <td colspan="5" class="text-center text-slate-500 py-4">Sin agentes en tu Unidad.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

              <!-- Tarjetas para móvil -->
              <div class="block md:hidden space-y-4">
                <div
                  v-for="(a, i) in agents"
                  :key="a.id"
                  class="bg-white shadow rounded-xl p-4 flex flex-col gap-2 border"
                >
                  <div class="flex justify-between items-center mb-2">
                    <div>
                      <div class="font-bold text-base">
                        {{ a.code }}
                        <span class="font-normal text-xs">
                          ({{ displayCategory(a.category) }})
                        </span>
                        <span v-if="a.nickname" class="font-normal text-xs text-slate-500">
                          — {{ a.nickname }}
                        </span>
                      </div>                      
                    </div>
                    <button class="text-red-600 text-xs underline" @click="removeAgent(a.id)">Quitar</button>
                  </div>

                  <!-- Caja de "Días Laborados" + botón historial, versión móvil -->
                  <div class="flex items-center gap-2">
                    <!-- Badge + texto -->
                    <div class="inline-flex items-center gap-2 px-2 py-1 rounded-lg border text-xs bg-white">
                      <span
                        :class="[
                          'inline-block min-w-[2.5em] text-center rounded px-1',
                          a.diasLaborados >= 45
                            ? 'bg-red-100 text-red-600 font-bold border border-red-200'
                            : a.diasLaborados >= 30
                              ? 'bg-orange-100 text-orange-700 font-semibold border border-orange-200'
                              : a.diasLaborados > 0
                                ? 'bg-green-50 text-green-700 font-semibold border border-green-200'
                                : 'text-slate-400 border border-slate-200 bg-white'
                        ]"
                        :title="a.diasLaborados >= 45
                          ? '¡Alerta! tiempo prolongado sin descanso '
                          : a.diasLaborados >= 30
                            ? 'Atención: Más de un mes sin descansar'
                            : a.diasLaborados > 0
                              ? 'Días consecutivos en servicio o sin novedad'
                              : 'Sin días laborados'"
                      >
                        {{ a.diasLaborados ?? 0 }}
                      </span>
                      <span class="text-xs text-slate-700">Días laborados</span>
                    </div>
                    <!-- Botón historial -->
                    <button
                      class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs bg-white hover:bg-slate-50"
                      @click="openHistory(a)"
                      title="Historial de novedades"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none"
                          viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"></circle>
                      </svg>
                      Historial
                    </button>
                  </div>
                  <input
                        class="input w-full"
                        :class="isMtInvalid(a.mt) ? 'border-rose-500 focus:ring-rose-200 bg-white' : 'border-slate-300 focus:ring-indigo-200 bg-white'"
                        v-model.trim="a.mt"
                        placeholder="0000-5555-6666"
                        maxlength="96"
                      />
                      <p v-if="isMtInvalid(a.mt)" class="text-[11px] text-rose-600 mt-1">Formato inválido. Usa solo números y guiones.</p>
                  <select class="input w-full" v-model="a.status" @change="onStateChange(a)">
                    <option value="SIN NOVEDAD">SIN NOVEDAD</option>
                    <option value="COMISIÓN DEL SERVICIO">COMISIÓN DEL SERVICIO</option>
                    <option value="FRANCO FRANCO">FRANCO FRANCO</option>
                    <option value="SERVICIO">SERVICIO</option>
                    <option value="VACACIONES">VACACIONES</option>
                    <option value="LICENCIA DE MATERNIDAD">LICENCIA DE MATERNIDAD</option>
                    <option value="LICENCIA DE LUTO">LICENCIA DE LUTO</option>
                    <option value="LICENCIA REMUNERADA">LICENCIA REMUNERADA</option>
                    <option value="LICENCIA NO REMUNERADA">LICENCIA NO REMUNERADA</option>
                    <option value="EXCUSA DEL SERVICIO">EXCUSA DEL SERVICIO</option>
                    <option value="LICENCIA PATERNIDAD">LICENCIA PATERNIDAD</option>
                    <option value="PERMISO">PERMISO</option>
                    <option value="DESCANSO ESPECIAL">DESCANSO ESPECIAL</option>
                    <option value="PERMISO ACTIVIDAD PERSONAL">PERMISO ACTIVIDAD PERSONAL</option>
                    <option value="COMISIÓN EN EL EXTERIOR">COMISIÓN EN EL EXTERIOR</option>
                    <option value="COMISIÓN DE ESTUDIO">COMISIÓN DE ESTUDIO</option>
                    <option value="SUSPENDIDO">SUSPENDIDO</option>
                    <option value="HOSPITALIZADO">HOSPITALIZADO</option>
                  </select>

                  <!-- Campos dinámicos según estado -->
                  <div v-if="a.status === 'SIN NOVEDAD'">
                    <input class="input w-full bg-slate-100" :value="a.municipalityName || 'CUNDINAMARCA - Bogotá'" readonly />
                  </div>
                  <div v-else-if="a.status === 'SERVICIO'">
                    <input class="input w-full bg-slate-100" :value="a.municipalityName || 'CUNDINAMARCA - Bogotá'" readonly />
                    <div class="flex gap-2 mt-2">
                      <input class="input flex-1" type="date"
                            v-model="a.novelty_start"
                            :class="{'!border-red-500': agentHasRangeError(a)}"
                            placeholder="Fecha inicio" />
                      <input class="input flex-1" type="date"
                            v-model="a.novelty_end"
                            :class="{'!border-red-500': agentHasRangeError(a)}"
                            placeholder="Fecha fin" />
                    </div>
                    <p v-if="agentHasRangeError(a)" class="text-xs text-red-600 mt-1">
                      La fecha fin no puede ser menor a la fecha inicio.
                    </p>

                    <textarea class="input w-full mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
                  </div>
                  <div v-else-if="a.status === 'COMISIÓN DEL SERVICIO'">
                    <div class="relative">
                      <input
                        class="input w-full"
                        v-model="a.municipalityName"
                        @focus="muniOpen(a)"
                        @input="onMuniTyping(a)"
                        @blur="() => setTimeout(() => muniClose(a), 150)"
                        placeholder="Buscar municipio..."
                        autocomplete="off"
                        autocapitalize="off"
                        autocorrect="off"
                        spellcheck="false"
                      />

                      <button
                        v-if="a.municipalityName"
                        type="button"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 px-2 py-1"
                        @mousedown.prevent
                        @click="muniClear(a)"
                        title="Limpiar"
                      >
                        ✕
                      </button>

                      <div
                        v-show="muniUi.openForAgentId === a.id"
                        class="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-56 overflow-auto"
                      >
                        <button
                          v-for="m in muniSuggestionsFor(a)"
                          :key="m.id"
                          type="button"
                          class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                          @mousedown.prevent
                          @click="muniPick(a, m)"
                        >
                          {{ m.dept }} - {{ m.name }}
                        </button>

                        <div v-if="muniSuggestionsFor(a).length === 0" class="px-3 py-2 text-sm text-slate-500">
                          Sin resultados
                        </div>
                      </div>
                    </div>

                    <span v-if="a.municipalityName && !a.municipalityId" class="text-red-500 text-xs">
                      Debe seleccionar un municipio válido
                    </span>

                    <textarea class="input w-full mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
                  </div>
                  <div v-else-if="a.status === 'FRANCO FRANCO'">
                    <span class="text-xs text-slate-400">Sin datos adicionales</span>
                  </div>

                  <!-- SUSPENDIDO: inicio, fin, descripción -->
                  <div v-else-if="a.status === 'SUSPENDIDO'">
                    <div class="flex gap-2 mt-2">
                      <input class="input flex-1" type="date"
                            v-model="a.novelty_start"
                            :class="{'!border-red-500': agentHasRangeError(a)}"
                            placeholder="Fecha inicio" />
                      <input class="input flex-1" type="date"
                            v-model="a.novelty_end"
                            :class="{'!border-red-500': agentHasRangeError(a)}"
                            placeholder="Fecha fin" />
                    </div>
                    <p v-if="agentHasRangeError(a)" class="text-xs text-red-600 mt-1">
                      La fecha fin no puede ser menor a la fecha inicio.
                    </p>
                    <textarea class="input w-full mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
                  </div>

                  <!-- HOSPITALIZADO: inicio y descripción (sin fin) -->
                  <div v-else-if="a.status === 'HOSPITALIZADO'">
                    <div class="flex gap-2 mt-2">
                      <input class="input flex-1" type="date" v-model="a.novelty_start" placeholder="Fecha inicio" />
                    </div>
                    <textarea class="input w-full mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
                  </div>
                  <div v-else>
                    <div class="flex gap-2 mt-2">
                      <input class="input flex-1" type="date"
                            v-model="a.novelty_start"
                            :class="{'!border-red-500': agentHasRangeError(a)}"
                            placeholder="Fecha inicio" />
                      <input class="input flex-1" type="date"
                            v-model="a.novelty_end"
                            :class="{'!border-red-500': agentHasRangeError(a)}"
                            placeholder="Fecha fin" />
                    </div>
                    <p v-if="agentHasRangeError(a)" class="text-xs text-red-600 mt-1">
                      La fecha fin no puede ser menor a la fecha inicio.
                    </p>
                    <textarea class="input w-full mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
                  </div>
                </div>
                <div v-if="agents.length === 0" class="text-center text-slate-500 py-4">
                  Sin agentes en tu Unidad.
                </div>
              </div>

            <!-- Aclaración antes de KPIs -->
            <div class="text-center py-2">
              <h3 class="text-base font-semibold text-slate-700">Novedades enviadas a nivel central</h3>
              <p class="text-xs text-slate-500">Este consolidado corresponde al reporte que se transmite a nivel central.</p>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="px-4 py-3">
                  <h4 class="text-slate-700 text-sm font-medium">FE total (OF/ME/PT)</h4>
                  <div class="text-2xl font-bold text-slate-900 mt-1">
                    {{ kpiFE }} <span class="text-sm text-slate-500">({{ feTotal }})</span>
                  </div>
                </div>
              </div>
              <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="px-4 py-3">
                  <h4 class="text-slate-700 text-sm font-medium">FD total (OF/ME/PT)</h4>
                  <div class="text-2xl font-bold text-slate-900 mt-1">
                    {{ kpiFD }} <span class="text-sm text-slate-500">({{ fdTotal }})</span>
                  </div>
                </div>
              </div>
              <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="px-4 py-3">
                  <h4 class="text-slate-700 text-sm font-medium">Novedades totales (OF/ME/PT)</h4>
                  <div class="text-2xl font-bold text-slate-900 mt-1">
                    {{ kpiNOV }} <span class="text-sm text-slate-500">({{ novTotalKPI }})</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Acciones -->
            <div class="flex flex-wrap items-center gap-3">
              <button
                @click="save"
                class="px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {{ existeReporte ? 'Actualizar' : 'Guardar' }}
              </button>
              <span v-if="msg" :class="msgClass" class="text-sm">{{ msg }}</span>
            </div>

            <!-- Panel desplegable: Novedades unidad externa -->
            <div class="rounded-2xl border-2 border-yellow-400 bg-yellow-50 overflow-hidden">
              <button
                type="button"
                class="w-full px-4 py-3 flex items-center justify-between"
                @click="showUnitPanel = !showUnitPanel"
                :aria-expanded="showUnitPanel ? 'true' : 'false'"
              >
                <div class="text-left">
                  <div class="text-sm font-semibold text-yellow-800">Novedades en su unidad</div>
                  <div class="text-xs text-yellow-700">Fecha: {{ reportDateShort }}</div>
                </div>
                <svg class="h-5 w-5 text-yellow-800 transition-transform" :class="{'rotate-180': showUnitPanel}" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clip-rule="evenodd" />
                </svg>
              </button>

              <transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-1"
              >
                <div v-show="showUnitPanel" class="px-4 pb-4 space-y-3">
                  <!-- KPIs compactos -->
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div class="rounded-xl bg-white/60 border border-yellow-200 px-3 py-2">
                      <div class="text-xs text-yellow-700">F/E (OF/ME/PT)</div>
                      <div class="text-base font-bold text-yellow-900">
                        {{ feOF }}/{{ feSO }}/{{ fePT }}
                        <span class="text-xs text-yellow-800"> ({{ feOF + feSO + fePT }})</span>
                      </div>
                    </div>

                    <div class="rounded-xl bg-white/60 border border-yellow-200 px-3 py-2">
                      <div class="text-xs text-yellow-700">F/D (Comisión del servicio)</div>
                      <div class="text-base font-bold text-yellow-900">
                        {{ comiOF }}/{{ comiSO }}/{{ comiPT }}
                        <span class="text-xs text-yellow-800"> ({{ comiTotal }})</span>
                      </div>
                    </div>

                    <div class="rounded-xl bg-white/60 border border-yellow-200 px-3 py-2">
                      <div class="text-xs text-yellow-700">Novedades</div>
                      <div class="text-base font-bold text-yellow-900">
                        {{ novOF }}/{{ novSO }}/{{ novPT }}
                        <span class="text-xs text-yellow-800"> ({{ novTotal }})</span>
                      </div>
                    </div>
                  </div>

                  <!-- Detalle discriminado -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div
                      v-for="row in summaryByStatus"
                      :key="row.status"
                      class="flex items-center justify-between rounded-xl bg-yellow-100/70 px-3 py-2 border border-yellow-200"
                    >
                      <div class="text-sm font-medium text-yellow-900">{{ row.label }}</div>
                      <div class="text-sm font-semibold text-yellow-900">
                        {{ row.of }}/{{ row.me }}/{{ row.pt }}
                        <span class="ml-1 text-xs text-yellow-800">(Total: {{ row.total }})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </section>

        <section
          v-show="section==='proyeccion'"
          class="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden"
        >
        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 class="text-slate-900 font-semibold">Proyección de descanso</h2>
              <p class="text-xs text-slate-500 -mt-0.5"> Define rangos de fechas y estado para cada funcionario de la unidad.</p>
            </div>
            
          </div>
          <!-- ===================================================== -->
          <!-- PROYECCIÓN DE DESCANSO (por unidad / agente / rango) -->
          <!-- ===================================================== -->
          <div class="mt-6 rounded-2xl p-4 space-y-4">
           <!-- Rango de proyección (obligatorio) + funcionario -->
            <div
              class="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,1.2fr)] items-end"
            >
              <div>
                <label class="text-xs font-medium text-slate-700 mb-1 block">
                  Desde (inicio de proyección)
                </label>
                <input
                  type="date"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
                  v-model="projRange.from"
                >
              </div>
              <div>
                <label class="text-xs font-medium text-slate-700 mb-1 block">
                  Hasta (fin de proyección)
                </label>
                <input
                  type="date"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
                  v-model="projRange.to"
                >
              </div>

              <!-- Agente activo para edición -->
              <div>
                <label class="text-xs font-medium text-slate-700 mb-1 block">
                  Funcionario que estoy proyectando
                </label>
                <select
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
                  v-model="projSelectedAgentId"
                >
                  <option :value="null" disabled>Selecciona un funcionario…</option>
                  <option
                    v-for="a in agents"
                    :key="a.id"
                    :value="a.id"
                  >
                    {{ a.code }}
                    <template v-if="a.nickname">
                      — "{{ a.nickname }}"
                    </template>
                    ({{ displayCategory(a.category) }})
                  </option>
                </select>
              </div>
            </div>

            <!-- LAYOUT PRINCIPAL: IZQ = rangos + línea de tiempo, DER = calendario -->
            <div
              v-if="projSelectedAgentId && projRange.from && projRange.to"
              class="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)]"
            >
              <!-- === COLUMNA IZQUIERDA: RANGOS + LÍNEA DE TIEMPO === -->
              <div class="space-y-3">
                <div class="space-y-3">
                <!-- Editor de rangos: formulario simple -->
                <div class="rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
                  <div class="text-xs text-slate-700">
                    Rangos para
                    <strong>{{ projCurrentAgentLabel }}</strong>
                  </div>

                  <div
                    class="grid gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,1.3fr)_max-content] items-end"
                  >
                    <div>
                      <label class="text-[11px] font-medium text-slate-600 mb-1 block">
                        Desde
                      </label>
                      <input
                        type="date"
                        class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
                        v-model="projDraft.from"
                        :min="projRange.from"
                        :max="projRange.to"
                      />
                    </div>

                    <div>
                      <label class="text-[11px] font-medium text-slate-600 mb-1 block">
                        Hasta
                      </label>
                      <input
                        type="date"
                        class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
                        v-model="projDraft.to"
                        :min="projRange.from"
                        :max="projRange.to"
                      />
                    </div>

                    <div>
                      <label class="text-[11px] font-medium text-slate-600 mb-1 block">
                        Estado
                      </label>
                      <select
                        class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
                        v-model="projDraft.state"
                        @change="onProjDraftStateChange"
                      >
                        <option disabled value="">Selecciona…</option>
                        <option
                          v-for="st in STATUS_ORDER"
                          :key="st"
                          :value="st"
                        >
                          {{ st }}
                        </option>
                      </select>
                    </div>

                    <div class="flex justify-end">
                      <button
                        type="button"
                        class="px-3 py-2 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        :disabled="!projCanAddDraft"
                        @click="projAddRangeForCurrent"
                      >
                        Añadir rango
                      </button>
                    </div>
                  </div>
                  <!-- Unidad destino SOLO si es COMISIÓN DEL SERVICIO -->
                  <div
                    v-if="projDraft.state === 'COMISIÓN DEL SERVICIO'"
                    class="mt-2 grid gap-2"
                  >
                    <div>
                      <label class="text-[11px] font-medium text-slate-600 mb-1 block">
                        Unidad destino
                      </label>
                      <select
                        class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
                        v-model="projDraft.destParentUnitId"
                      >
                        <option :value="null" disabled>Selecciona unidad…</option>
                        <option v-for="u in destUnits" :key="u.id" :value="u.id">
                          {{ (groupById[u.groupId]?.code || groupById[u.groupId]?.name || '—') }} — {{ u.name }}
                        </option>
                      </select>
                      <!-- Subunidad destino (solo si la unidad tiene subunidades) -->
                      <div v-if="!loadingSubunits && destSubunits.length" class="mt-2">
                        <label class="text-[11px] font-medium text-slate-600 mb-1 block">
                          Subunidad destino
                        </label>
                        <select
                          class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
                          v-model="projDraft.destSubunitId"
                        >
                          <option :value="null">— Selecciona subunidad…</option>
                          <option v-for="su in destSubunits" :key="su.id" :value="su.id">
                            {{ su.name }}
                          </option>
                        </select>
                      </div>

                      <p v-if="loadingSubunits" class="mt-2 text-[11px] text-slate-500">
                        Cargando subunidades…
                      </p>

                      <p v-if="subunitsError" class="mt-2 text-[11px] text-rose-700">
                        {{ subunitsError }}
                      </p>
                    </div>

                    <!-- SOLO si la unidad seleccionada es GEO -->
                    <div v-if="isDeptUnitDraft" class="grid gap-1">
                      <!-- Lista check de departamentos (máx 3) -->
                      <div class="border border-indigo-200 rounded-lg bg-white max-h-32 overflow-y-auto">
                        <label
                          v-for="d in depts"
                          :key="d"
                          class="flex items-center gap-2 px-2 py-1 text-xs text-slate-700"
                        >
                          <input
                            type="checkbox"
                            class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            :value="d"
                            :checked="projDraft.depts.includes(d)"
                            @change="toggleDept(d, $event.target.checked)"
                          />
                          <span>{{ d }}</span>
                        </label>
                      </div>
                      <p class="mt-1 text-[10px] text-indigo-700">
                        Puedes marcar hasta 3 departamentos (solo para unidad GEO).
                      </p>
                    </div>
                  </div>
                  <p
                    v-if="projDraftError"
                    class="text-[11px] text-rose-700 mt-1"
                  >
                    {{ projDraftError }}
                  </p>
                </div>

                <!-- Línea de tiempo para el agente actual -->
                <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <div class="flex items-center justify-between mb-2">
                    <div class="text-xs font-semibold text-slate-700">
                      Línea de tiempo de proyección
                    </div>
                    <div class="text-[11px] text-slate-500">
                      {{ projRange.from }} → {{ projRange.to }}
                    </div>
                  </div>

                  <!-- === Timeline: un registro por renglón, SIN SCROLL y con inputs más pequeños === -->
                  <div
                    v-if="projTimelineSegments.length"
                    class="relative mt-1 space-y-2"
                  >
                    <!-- Línea vertical -->
                    <div class="absolute left-2 top-0 bottom-0 w-px bg-slate-300" />

                    <div
                      v-for="seg in projTimelineSegments"
                      :key="seg.index"
                      class="flex items-center gap-2 pl-4"
                    >
                      <!-- Punto -->
                      <div
                        class="w-2.5 h-2.5 rounded-full border border-white shadow ring-1 ring-slate-200 flex-none"
                        :class="colorClass(seg.state)?.dot || 'bg-slate-400'"
                      />

                      <!-- Tarjeta -->
                      <div
                        class="flex items-center gap-1.5 px-2 py-1 text-[9px] shadow-sm bg-white border border-slate-200 rounded-md flex-1"
                      >
                        <!-- Fechas (COMPACTAS) -->
                        <input
                          type="date"
                          class="rounded border border-slate-300 px-1 py-0.5 text-[9px] w-[95px]"
                          :value="seg.from"
                          @change="projUpdateSegmentField(seg.index, 'from', $event.target.value)"
                        />
                        <span>→</span>
                        <input
                          type="date"
                          class="rounded border border-slate-300 px-1 py-0.5 text-[9px] w-[95px]"
                          :value="seg.to"
                          @change="projUpdateSegmentField(seg.index, 'to', $event.target.value)"
                        />

                        <!-- Estado -->
                        <select
                          class="rounded border border-slate-300 px-1 py-0.5 text-[9px] w-[95px]"
                          :value="seg.state"
                          @change="projUpdateSegmentField(seg.index, 'state', $event.target.value)"
                        >
                          <option
                            v-for="st in STATUS_ORDER"
                            :key="st"
                            :value="st"
                          >
                            {{ st }}
                          </option>
                        </select>

                        <!-- Unidad destino (solo Comisión de Servicio) -->
                        <select
                          v-if="seg.state === 'COMISIÓN DEL SERVICIO'"
                          class="rounded border border-slate-300 px-1 py-0.5 text-[9px] w-[140px]"
                          :value="seg.destParentUnitId || ''"
                          @change="projUpdateSegmentField(
                            seg.index,
                            'destParentUnitId',
                            $event.target.value ? Number($event.target.value) : null
                          )"
                        >
                          <option value="">Unidad…</option>
                          <option v-for="u in destUnits" :key="u.id" :value="u.id">
                            {{ (groupById[u.groupId]?.code || groupById[u.groupId]?.name || '—') }} — {{ u.name }}
                          </option>
                        </select>

                        <select
                          v-if="seg.state === 'COMISIÓN DEL SERVICIO'
                                && seg.destParentUnitId
                                && (subunitsByParent?.[seg.destParentUnitId]?.length || 0) > 0"
                          class="rounded border border-slate-300 px-1 py-0.5 text-[9px] w-[120px]"
                          :value="seg.destSubunitId || ''"
                          @change="projUpdateSegmentField(
                            seg.index,
                            'destSubunitId',
                            $event.target.value ? Number($event.target.value) : null
                          )"
                        >
                          <option value="">Sub…</option>
                          <option
                            v-for="su in (subunitsByParent?.[seg.destParentUnitId] || [])"
                            :key="su.id"
                            :value="su.id"
                          >
                            {{ su.name }}
                          </option>
                        </select>
                        

                        <!-- Mostrar unidad padre y subunidad (si aplica) -->
                        <span
                          v-if="seg.destParentLabel"
                          class="ml-1 text-[8px] opacity-80 flex-none"
                          :title="seg.destSubunitLabel ? (seg.destParentLabel + ' / ' + seg.destSubunitLabel) : seg.destParentLabel"
                        >
                          🏢 {{ seg.destParentLabel }}
                          <template v-if="seg.destSubunitLabel"> / {{ seg.destSubunitLabel }}</template>
                        </span>


                        <!-- Días -->
                        <span class="opacity-70 flex-none">{{ seg.count }}d</span>

                        <!-- Deptos -->
                        <span
                          v-if="seg.depts && seg.depts.length"
                          class="text-[8px] opacity-70 flex-none"
                        >
                          {{ seg.depts.join(',') }}
                        </span>
                      </div>

                      <!-- Botón quitar -->
                      <button
                        type="button"
                        class="text-[9px] text-rose-700 hover:underline flex-none"
                        @click="projRemoveSegment(seg.index)"
                      >
                        ✕
                      </button>
                    </div>
                  </div>


                  <p v-else class="text-[11px] text-slate-500 mt-1">
                    Este funcionario no tiene rangos proyectados dentro del intervalo seleccionado.
                  </p>
                </div>

              </div>


              </div>

              <!-- === COLUMNA DERECHA: CALENDARIO CUADRADO (estilo admin) === -->
              <div class="rounded-2xl border border-slate-200 bg-white p-3">
                <div class="flex items-center justify-between mb-2">
                  <div class="text-xs font-semibold text-slate-700">
                    Calendario de proyección
                  </div>
                  <div class="text-[11px] text-slate-500">
                    {{ projCalendarLabel }}
                  </div>
                </div>

                <!-- Cabecera días semana -->
                <div
                  class="grid grid-cols-7 gap-1 text-[9px] font-medium text-slate-500 mb-1"
                >
                  <div class="text-center">L</div>
                  <div class="text-center">M</div>
                  <div class="text-center">X</div>
                  <div class="text-center">J</div>
                  <div class="text-center">V</div>
                  <div class="text-center">S</div>
                  <div class="text-center">D</div>
                </div>

                <!-- Calendario con scroll si el rango es grande -->
                <div class="max-h-72 overflow-y-auto pr-1">
                  <div class="grid grid-cols-7 gap-1">
                    <div
                      v-for="cell in projCalendarCells"
                      :key="cell.key"
                      :title="cell.title"
                      class="h-9 rounded-sm border text-[9px] flex flex-col px-0.5 pt-0.5 pb-0.5 transition-all"
                      :class="[
                        projStateColorClass(projStateCode(cell.state)),
                        cell.isOutside && 'opacity-60',
                        projMissingDaysSet.has(cell.date) && '!border-rose-400 border-2'
                      ]"
                    >
                      <!-- Día arriba a la izquierda -->
                      <div class="flex items-center justify-between mb-0.5">
                        <span class="text-[9px] font-medium text-white/80 drop-shadow-sm">
                          {{ cell.day }}
                        </span>
                      </div>

                      <!-- Código NC / CS / SR / FR / VC / PR / CE al centro -->
                      <div class="flex-1 flex items-center justify-center">
                        <span
                          class="font-semibold tracking-tight"
                          :class="projStateCode(cell.state) ? 'text-white' : 'text-slate-400'"
                        >
                          {{ projStateCode(cell.state) || '—' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Leyenda estilo admin (opcional pero recomendado) -->
                <div class="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
                  <div class="flex items-center gap-1">
                    <span class="w-4 h-4 rounded-sm border bg-sky-700"></span> NC
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-4 h-4 rounded-sm border bg-emerald-500"></span> CS
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-4 h-4 rounded-sm border bg-orange-500"></span> SR
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-4 h-4 rounded-sm border bg-cyan-400"></span> FR
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-4 h-4 rounded-sm border bg-amber-400"></span> CE
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-4 h-4 rounded-sm border bg-amber-500"></span> PR
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="w-4 h-4 rounded-sm border bg-red-500"></span> VC
                  </div>
                </div>
              </div>
            </div>

            <!-- Mensajes y errores -->
            <div class="mt-3 space-y-1">
              <p
                v-if="projErrors.length"
                class="text-xs text-rose-700"
              >
                <strong>Revisa antes de guardar:</strong>
                <ul class="list-disc list-inside space-y-0.5 mt-1">
                  <li v-for="(e, i) in projErrors" :key="i">
                    {{ e }}
                  </li>
                </ul>
              </p>
              <p
                v-if="projMsg"
                class="text-xs"
                :class="projMsgOk ? 'text-emerald-700' : 'text-rose-700'"
              >
                {{ projMsg }}
              </p>
            </div>

            <!-- Botón guardar proyección -->
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="!projCanSave"
                @click="saveProjection"
              >
                Guardar proyección de descanso
              </button>
              <div class="text-[11px] text-slate-500">
                Se validará que, para cada funcionario que tenga rangos,
                no haya días sin estado dentro del intervalo que tenga proyectado
                (entre su primera y última fecha de proyección dentro de
                <strong>{{ projRange.from || '____' }}</strong> y
                <strong>{{ projRange.to || '____' }}</strong>).
              </div>
            </div>
          </div>
        </section>

        <!-- ====== PERFIL (embebido) ====== -->
          <div v-show="section==='perfil'" class="space-y-6">
            <div class="bg-white rounded-2xl shadow p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold text-slate-900">Perfil</h3>
                <span class="text-xs text-slate-500">Usuario: {{ me?.username || me?.email || '-' }}</span>
              </div>

              <!-- Cambio de contraseña -->
              <form @submit.prevent="onSubmitPassword" class="max-w-md space-y-3">
                <div>
                  <label class="label">Contraseña actual</label>
                  <div class="relative">
                    <input
                      :type="showOld ? 'text' : 'password'"
                      v-model.trim="formPwd.old"
                      class="input pr-10"
                      autocomplete="current-password"
                      required
                    />
                    <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                            @click="showOld=!showOld">{{ showOld ? '🙈' : '👁️' }}</button>
                  </div>
                </div>

                <div>
                  <label class="label">Nueva contraseña</label>
                  <div class="relative">
                    <input
                      :type="showNew ? 'text' : 'password'"
                      v-model.trim="formPwd.new1"
                      class="input pr-10"
                      autocomplete="new-password"
                      required
                      @input="checkStrength"
                    />
                    <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                            @click="showNew=!showNew">{{ showNew ? '🙈' : '👁️' }}</button>
                  </div>
                  <p class="text-xs mt-1" :class="pwdStrengthClass">{{ pwdStrengthLabel }}</p>
                  <ul class="text-xs text-slate-500 mt-1 list-disc pl-5">
                    <li>Mínimo 8 caracteres</li>
                    <li>Debe incluir mayúscula, minúscula, número y símbolo</li>
                  </ul>
                </div>

                <div>
                  <label class="label">Confirmar nueva contraseña</label>
                  <div class="relative">
                    <input
                      :type="showNew2 ? 'text' : 'password'"
                      v-model.trim="formPwd.new2"
                      class="input pr-10"
                      autocomplete="new-password"
                      required
                    />
                    <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                            @click="showNew2=!showNew2">{{ showNew2 ? '🙈' : '👁️' }}</button>
                  </div>
                  <p v-if="formPwd.new2 && formPwd.new1!==formPwd.new2" class="text-xs text-rose-600 mt-1">
                    Las contraseñas no coinciden.
                  </p>
                </div>

                <div class="pt-2 flex items-center gap-2">
                  <button
                    class="px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    type="submit"
                    :disabled="submittingPwd || !canSubmitPwd"
                  >
                    {{ submittingPwd ? 'Guardando…' : 'Cambiar contraseña' }}
                  </button>
                  <button type="button" class="btn-ghost" @click="resetPwdForm" :disabled="submittingPwd">Cancelar</button>
                </div>

                <p v-if="pwdMsg" aria-live="polite" class="text-sm mt-2" :class="pwdMsgOk ? 'text-emerald-700' : 'text-rose-700'">
                  {{ pwdMsg }}
                </p>
              </form>
            </div>
          </div>
        <!-- Toast -->
        <transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-2"
        >
          <div
            v-if="toast.visible"
            class="fixed bottom-4 right-4 z-[1000] rounded-xl px-4 py-3 shadow-lg border"
            :class="toast.kind === 'success'
              ? 'bg-white border-green-200 text-green-800'
              : 'bg-white border-amber-200 text-amber-800'"
          >
            <div class="text-sm font-medium">{{ toast.text }}</div>
          </div>
        </transition>
      </main>

      <!-- Modal Historial (Calendario + Línea de tiempo) -->
    <div v-if="historyModal.open" class="fixed inset-0 z-[9998] grid place-items-center p-4">
    <div class="absolute inset-0 bg-black/40" @click="historyModal.open=false"></div>

    <div class="relative z-10 w-full max-w-5xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-200">
      <!-- Header -->
      <div class="px-5 py-4 rounded-t-2xl text-white flex items-center justify-between
                  bg-gradient-to-r from-slate-900 via-indigo-700 to-blue-600
                  dark:from-slate-950 dark:via-indigo-900 dark:to-blue-800">
        <div class="flex items-center gap-3">
          <div class="text-xl font-semibold tracking-tight">
            Historial — {{ historyModal.agent?.code }}
            <span v-if="historyModal.agent?.nickname" class="opacity-80 text-sm">({{ historyModal.agent.nickname }})</span>
          </div>
          <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs bg-white/15 text-white">
            {{ monthLabel }}
          </span>
        </div>
        <button class="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
                @click="historyModal.open=false">✕</button>
      </div>

      <!-- Controles -->
      <div class="px-5 py-3 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <button class="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                  @click="prevMonth">◀</button>
          <button class="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                  @click="todayMonth">Hoy</button>
          <button class="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                  @click="nextMonth">▶</button>

          <span class="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
            {{ monthFrom }} → {{ monthTo }}
          </span>
        </div>

        <!-- Tabs -->
        <div class="ml-auto inline-flex rounded-full p-1 bg-slate-200/70 dark:bg-slate-700/60">
          <button :class="['px-3 py-1.5 text-sm rounded-full', viewTab==='calendar' ? 'bg-white shadow-sm text-slate-900 dark:bg-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200']"
                  @click="viewTab='calendar'">Calendario</button>
          <button :class="['px-3 py-1.5 text-sm rounded-full', viewTab==='timeline' ? 'bg-white shadow-sm text-slate-900 dark:bg-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200']"
                  @click="viewTab='timeline'">Línea de tiempo</button>
        </div>
      </div>

      <!-- Body -->
      <div class="px-5 pb-5 max-h-[70vh] overflow-auto">
        <!-- Calendario -->
        <div v-if="viewTab==='calendar'">
          <div class="grid grid-cols-7 gap-2 text-xs font-medium text-slate-600 mb-1">
            <div class="text-center">L</div><div class="text-center">M</div><div class="text-center">X</div>
            <div class="text-center">J</div><div class="text-center">V</div><div class="text-center">S</div>
            <div class="text-center">D</div>
          </div>

          <div class="grid grid-cols-7 gap-2">
            <div v-for="cell in calendarCells" :key="cell.key" :title="cell.title"
                class="h-20 rounded-xl p-2 flex flex-col transition-all border border-slate-200 dark:border-slate-700 hover:shadow-md hover:-translate-y-[1px]"
                :class="[
                  cell.state ? (colorClass(cell.state)?.bg || 'bg-slate-100') : 'bg-white dark:bg-slate-400/60',
                  cell.isToday && 'ring-2 ring-blue-500/70',
                  cell.isPadding && 'opacity-60'   
                ]"
                >
              <div class="text-[11px] font-medium opacity-60">{{ cell.day || '' }}</div>
              <div class="mt-auto text-center text-lg leading-none" v-if="cell.state">{{ iconFor(cell.state) }}</div>
              <div v-if="cell.state" class="text-[11px] text-center truncate mt-1 opacity-85">{{ shortState(cell.state) }}</div>
            </div>
          </div>
        </div>

        <!-- Línea de tiempo (todo; si es comisión, muestra municipio) -->
        <div v-else class="space-y-4 relative">
          <div class="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-slate-300 via-slate-200 to-slate-300 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700" />
          <div v-for="(s, i) in segments" :key="i" class="flex items-center gap-3 pl-4">
            <div class="w-3 h-3 rounded-full border-2 border-white shadow ring-1 ring-slate-200 dark:border-slate-900"
                :class="colorClass(s.state)?.dot || 'bg-slate-400'"></div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs shadow-sm"
                :class="colorClass(s.state)?.pill || 'bg-slate-100 text-slate-700'">
              {{ iconFor(s.state) }}
              <span>
                {{ s.state }}
                <template v-if="s.municipalityName"> — 📍 {{ s.municipalityName }}</template>
              </span>
              <span class="opacity-70">({{ s.from }} → {{ s.to }})</span>
              <span class="opacity-70">• {{ s.count }} día(s)</span>
            </div>
          </div>
        </div>

        <!-- Leyenda (solo visible en modo calendario) -->
        <div v-if="viewTab === 'calendar'" class="mt-5 flex flex-wrap gap-2 text-xs">
          <div v-for="st in legendStates" :key="st"
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs shadow-sm"
              :class="colorClass(st)?.pill || 'bg-slate-100 text-slate-700'">
            {{ iconFor(st) }} {{ shortState(st) }}
          </div>
        </div>

      </div>
    </div>
  </div>

    </div>
  </div>
</template>


<script setup>
import { http } from '@/lib/http'
import { ref, computed, onMounted, watch, reactive } from 'vue'
import FechasBanner from '@/components/FechasBanner.vue'


/**
 * IMPORTANTÍSIMO:
 * - No usamos axios “crudo” (rutas relativas) para evitar 404 en host.
 * - http ya debe traer baseURL + token por interceptor.
 * - Si algún endpoint no existe en el host (como /rest-planning/units-dest), lo capturamos y NO bloquea.
 */

const restViewer = reactive({
  from: '',
  to: '',
  agentId: null,
  loading: false,
  error: '',
  byAgent: {}
})

const toast = ref({ visible: false, text: '', kind: 'success' })
function showToast(text, kind = 'success') {
  toast.value = { visible: true, text, kind }
  setTimeout(() => (toast.value.visible = false), 2500)
}

// === Fechas en zona "America/Bogota" sin usar toISOString() ===
const TZ = 'America/Bogota'

function ymdInTZ(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
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

function businessDateBogota(cutoffHour) {
  const now = new Date()
  const { hour } = hourMinuteInTZ(now)
  const base = (hour >= cutoffHour)
    ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
    : now
  return ymdInTZ(base)
}

const reportDate = ref(businessDateBogota(9))
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

const agents = ref([])
const municipalities = ref([])
const me = ref(null)

const groups = ref([])
const units = ref([])
const destUnits = ref([])
const depts = ref([])
const destSubunits = ref([])          // lista que llega del backend
const loadingSubunits = ref(false)
const subunitsError = ref('')

// Cache: parentUnitId -> subunits[]
const subunitsByParent = ref({})

const muniUi = reactive({
  openForAgentId: null,   // id del agente que tiene el dropdown abierto
  query: '',              // texto actual (por si quieres)
})

const isIOS = computed(() => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/i.test(ua)
})

function muniLabel(m) {
  return `${m.dept} - ${m.name}`
}

function muniMatches(m, q) {
  if (!q) return true
  const s = muniLabel(m).toLowerCase()
  return s.includes(q.toLowerCase())
}

function muniSuggestionsFor(agent) {
  const q = (agent.municipalityName || '').trim()
  // si tienes MUCHOS municipios, limita resultados
  return (municipalities.value || [])
    .filter(m => muniMatches(m, q))
    .slice(0, 30)
}

function muniOpen(agent) {
  muniUi.openForAgentId = agent.id
}

function muniClose(agent) {
  if (muniUi.openForAgentId === agent.id) muniUi.openForAgentId = null
}

function muniOnBlur(agent) {
  window.setTimeout(() => {
    muniClose(agent)
  }, 150)
}

function muniClear(agent) {
  agent.municipalityName = ''
  agent.municipalityId = null
  muniOpen(agent)
}

function muniPick(agent, m) {
  agent.municipalityName = muniLabel(m)
  agent.municipalityId = m.id
  muniClose(agent)
}

function onMuniTyping(agent) {
  // cada tecla: si ya no coincide exacto, invalida id
  const value = (agent.municipalityName || '').trim().toLowerCase()
  const m = (municipalities.value || []).find(x => muniLabel(x).toLowerCase() === value)
  agent.municipalityId = m ? m.id : null

  muniOpen(agent)
}

// Busca una subunidad por ID en el cache
function findSubunitById(subunitId) {
  const id = Number(subunitId)
  if (!id) return null
  const cache = subunitsByParent.value || {}
  for (const parentId of Object.keys(cache)) {
    const list = cache[parentId] || []
    const hit = list.find(su => Number(su.id) === id)
    if (hit) return { ...hit, parentUnitId: Number(parentId) }
  }
  return null
}

// Resuelve labels (padre + subunidad) a partir de destUnitId
function resolveDestLabels(destUnitId) {
  const id = Number(destUnitId)
  if (!id) return { parent: '', sub: '' }

  // 1) Si es unidad padre (está en destUnits / units)
  const u = (destUnits.value || []).find(x => Number(x.id) === id) || (units.value || []).find(x => Number(x.id) === id)
  if (u) {
    const g = groupById.value?.[u.groupId]
    const gLabel = (g?.code || g?.name || '—')
    return { parent: `${gLabel} — ${u.name}`, sub: '' }
  }

  // 2) Si NO es unidad, asumimos que es subunidad guardada en dest_unit_id
  const su = findSubunitById(id)
  if (!su) return { parent: `ID ${id}`, sub: '' }

  // padre
  const parentUnit = (destUnits.value || []).find(x => Number(x.id) === Number(su.parentUnitId))
    || (units.value || []).find(x => Number(x.id) === Number(su.parentUnitId))

  if (!parentUnit) return { parent: `Unidad ${su.parentUnitId}`, sub: su.name || `Subunidad ${id}` }

  const g = groupById.value?.[parentUnit.groupId]
  const gLabel = (g?.code || g?.name || '—')
  return { parent: `${gLabel} — ${parentUnit.name}`, sub: su.name || `Subunidad ${id}` }
}


const unitsByGroup = computed(() => {
  const map = {}
  for (const u of units.value) {
    if (!u.groupId) continue
    if (!map[u.groupId]) map[u.groupId] = []
    map[u.groupId].push(u)
  }
  return map
})

const groupById = computed(() => {
  const m = {}
  for (const g of groups.value) m[g.id] = g
  return m
})
const unitById = computed(() => {
  const m = {}
  for (const u of units.value) m[u.id] = u
  return m
})

const existeReporte = ref(false)

const agentOwnershipMsg = ref('')
const canAddSelected = ref(false)

async function loadMe() {
  try {
    const { data } = await http.get('/me/profile')
    me.value = data
  } catch {
    me.value = null
  }
}

// ✅ FIX: NO rompe el montaje si falla en host
async function loadDestUnits () {
  // 1) intenta endpoint nuevo (si existe en el backend actualizado)
  const urls = ['/rest-planning/units-dest', '/api/rest-planning/units-dest']

  for (const url of urls) {
    try {
      const { data } = await http.get(url)
      destUnits.value = Array.isArray(data) ? data : []
      return
    } catch (e) {
      console.warn('[loadDestUnits] fail:', url, e?.response?.status, e?.response?.data || e?.message)
    }
  }

  // 2) fallback: usa el listado normal de unidades (que ya te funciona en host)
  try {
    // si ya están cargadas por loadUnits(), úsalo directo
    if (Array.isArray(units.value) && units.value.length) {
      destUnits.value = units.value.slice()
      console.warn('[loadDestUnits] usando fallback desde units.value (units-dest no existe en backend host)')
      return
    }

    // si por algún motivo aún no están, las pedimos
    const { data } = await http.get('/rest-planning/units')
    destUnits.value = Array.isArray(data) ? data : []
    console.warn('[loadDestUnits] usando fallback desde GET /rest-planning/units (units-dest no existe en backend host)')
  } catch (e) {
    console.warn('[loadDestUnits] fallback units también falló:', e?.response?.status, e?.response?.data || e?.message)
    destUnits.value = []
  }
}

// Mostrar "ME" cuando la categoría real sea "SO"
function displayCategory(c) {
  return String(c || '') === 'SO' ? 'ME' : c
}

async function loadAgents() {
  try {
    const { data } = await http.get('/my/agents', {
      params: { date: reportDate.value }
    })

    agents.value = (Array.isArray(data) ? data : []).map(a => ({
      ...a,
      municipalityName: a.municipalityName || '',
      novelty_start: a.novelty_start ? String(a.novelty_start).slice(0, 10) : '',
      novelty_end:   a.novelty_end   ? String(a.novelty_end).slice(0, 10)   : '',
      novelty_description: a.novelty_description || '',
      mt: a.mt || ''
    }))
    .sort((x, y) => {
      const rx = Number(x.rank_order ?? 9999)
      const ry = Number(y.rank_order ?? 9999)
      return rx - ry
    })

    await setDiasLaboradosTodos()
  } catch (e) {
    msg.value = e?.response?.data?.error || 'Error al cargar agentes'
    agents.value = []
  }
}

async function getMunicipalityIdFromLabel(label) {
  if (!label || label === 'N/A') return null
  if (!municipalities.value.length) await loadMunicipalities()
  const m = municipalities.value.find(m => `${m.dept} - ${m.name}` === label)
  return m ? m.id : null
}

async function loadMunicipalities(q = '') {
  const params = q.length >= 2 ? { q } : {}
  const { data } = await http.get('/catalogs/municipalities', { params })
  municipalities.value = data || []
}

async function loadGroups () {
  const { data } = await http.get('/rest-planning/groups')
  groups.value = Array.isArray(data) ? data : []
}

async function loadUnits () {
  const { data } = await http.get('/rest-planning/units')
  const list = Array.isArray(data) ? data : []
  units.value = list
  // ❌ ya NO seteamos destUnits aquí
}

async function loadSubunitsForUnit(parentUnitId) {
  destSubunits.value = []
  subunitsError.value = ''
  if (!parentUnitId) return

  loadingSubunits.value = true
  try {
    const pid = Number(parentUnitId)
    const { data } = await http.get(`/rest-planning/units/${pid}/subunits`)
    const items = Array.isArray(data?.items) ? data.items : []
    destSubunits.value = items

    // ✅ guardar en cache para resolver labels luego (timeline)
    subunitsByParent.value = {
      ...(subunitsByParent.value || {}),
      [pid]: items
    }
  } catch (e) {
    subunitsError.value = e?.response?.data?.error || 'No se pudieron cargar subunidades'
    destSubunits.value = []
  } finally {
    loadingSubunits.value = false
  }
}

async function loadDepts () {
  try {
    const { data } = await http.get('/admin/depts')
    depts.value = Array.isArray(data?.items) ? data.items : []
  } catch (e) {
    console.error('[loadDepts] error', e)
    depts.value = []
  }
}

function onStateChange(agent) {
  if (agent.status === 'SIN NOVEDAD') {
    agent.municipalityId = 11001
    const bogota = municipalities.value.find(m => m.id === 11001)
    agent.municipalityName = bogota ? `${bogota.dept} - ${bogota.name}` : 'CUNDINAMARCA - Bogotá'
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  if (agent.status === 'SERVICIO') {
    agent.municipalityId = 11001
    const bogota = municipalities.value.find(m => m.id === 11001)
    agent.municipalityName = bogota ? `${bogota.dept} - ${bogota.name}` : 'CUNDINAMARCA - Bogotá'
    return
  }

  if (agent.status === 'COMISIÓN DEL SERVICIO') {
    agent.municipalityId = null
    agent.municipalityName = ''
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  if (agent.status === 'FRANCO FRANCO') {
    agent.municipalityId = null
    agent.municipalityName = ''
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  if (agent.status === 'SUSPENDIDO') {
    agent.municipalityId = null
    agent.municipalityName = ''
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  if (agent.status === 'HOSPITALIZADO') {
    agent.municipalityId = null
    agent.municipalityName = ''
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  agent.municipalityId = null
  agent.municipalityName = ''
  agent.novelty_start = ''
  agent.novelty_end = ''
  agent.novelty_description = ''
}

async function save() {
  for (const a of agents.value) {
    if (a.status === 'SIN NOVEDAD') {
      if (a.municipalityId !== 11001) { msg.value = `El agente ${a.code} debe estar en Bogotá (SIN NOVEDAD)`; return }
    } else if (a.status === 'SERVICIO') {
      if (a.municipalityId !== 11001) { msg.value = `El agente ${a.code} debe estar en Bogotá (SERVICIO)`; return }
      if (!a.novelty_start) { msg.value = `Falta fecha inicio para ${a.code} (SERVICIO)`; return }
      if (!a.novelty_end)   { msg.value = `Falta fecha fin para ${a.code} (SERVICIO)`; return }
      if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (SERVICIO)`; return }
    } else if (a.status === 'COMISIÓN DEL SERVICIO') {
      if (!a.municipalityId) { msg.value = `Falta municipio para ${a.code} (COMISIÓN DEL SERVICIO)`; return }
      if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (COMISIÓN DEL SERVICIO)`; return }
    } else if (a.status === 'FRANCO FRANCO') {
      // nada
    } else if (a.status === 'SUSPENDIDO') {
      if (!a.novelty_start) { msg.value = `Falta fecha inicio para ${a.code} (SUSPENDIDO)`; return }
      if (!a.novelty_end)   { msg.value = `Falta fecha fin para ${a.code} (SUSPENDIDO)`; return }
      if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (SUSPENDIDO)`; return }
    } else if (a.status === 'HOSPITALIZADO') {
      if (!a.novelty_start) { msg.value = `Falta fecha inicio para ${a.code} (HOSPITALIZADO)`; return }
      if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (HOSPITALIZADO)`; return }
      a.novelty_end = ''
    } else {
      if (!a.novelty_start) { msg.value = `Falta fecha inicio para ${a.code} (${a.status})`; return }
      if (!a.novelty_end)   { msg.value = `Falta fecha fin para ${a.code} (${a.status})`; return }
      if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (${a.status})`; return }
    }
  }

  for (const a of agents.value) {
    if (isMtInvalid(a.mt)) {
      msg.value = `MT inválido para ${a.code}. Usa solo números y guiones.`
      return
    }
  }

  try {
    await http.post('/reports', {
      reportDate: reportDate.value,
      people: agents.value.map(a => {
        const isBase = (s) => ['SIN NOVEDAD', 'COMISIÓN DEL SERVICIO', 'FRANCO FRANCO'].includes(s)
        const isServicio = a.status === 'SERVICIO'
        const isHosp = a.status === 'HOSPITALIZADO'
        const isSusp = a.status === 'SUSPENDIDO'
        const needsDatesGeneric = !(isBase(a.status) || isServicio || isHosp)

        return {
          agentCode: a.code,
          state: a.status,
          municipalityId:
            (a.status === 'SIN NOVEDAD' || a.status === 'SERVICIO') ? 11001 :
            (a.status === 'COMISIÓN DEL SERVICIO' ? a.municipalityId : null),

          novelty_start: (isServicio || isHosp || needsDatesGeneric) ? (a.novelty_start || null) : null,
          novelty_end:   (isServicio || isSusp || needsDatesGeneric) ? (a.novelty_end   || null) : null,
          novelty_description:
            (isServicio || a.status === 'COMISIÓN DEL SERVICIO' || isHosp || isSusp || needsDatesGeneric)
              ? (a.novelty_description || null)
              : null,

          mt: a.mt ? a.mt.trim() : null
        }
      })
    })
    msg.value = 'Guardado ✅'
    await loadAgents()
  } catch (e) {
    msg.value = e?.response?.data?.error || 'Error al guardar'
  }
}

async function removeAgent(agentId) {
  if (!confirm('¿Quitar este agente de tu unidad?')) return
  try {
    const role = String(me.value?.role || '').toLowerCase()

    if (role === 'leader_unit' || role === 'leader_group') {
      await http.put(`/my/agents/${agentId}/unit`, { unitId: null })
    } else if (role === 'superadmin' || role === 'supervision') {
      await http.put(`/admin/agents/${agentId}`, { unitId: null })
    } else {
      msg.value = 'No tiene permisos para quitar agentes de la unidad'
      return
    }

    await loadAgents()
  } catch (e) {
    msg.value = e?.response?.data?.detail || e?.response?.data?.error || 'No se pudo quitar agente'
  }
}

// KPIs calculados en frontend
const fdOF = computed(() => agents.value.filter(a => a.category === 'OF' && a.status === 'SIN NOVEDAD').length)
const fdSO = computed(() => agents.value.filter(a => a.category === 'SO' && a.status === 'SIN NOVEDAD').length)
const fdPT = computed(() => agents.value.filter(a => a.category === 'PT' && a.status === 'SIN NOVEDAD').length)

const feOF = computed(() => agents.value.filter(a => a.category === 'OF').length)
const feSO = computed(() => agents.value.filter(a => a.category === 'SO').length)
const fePT = computed(() => agents.value.filter(a => a.category === 'PT').length)

const kpiFE = computed(() => `${feOF.value}/${feSO.value}/${fePT.value}`)
const kpiFD = computed(() => `${fdOF.value}/${fdSO.value}/${fdPT.value}`)
const kpiNOV = computed(() =>
  `${feOF.value - fdOF.value}/${feSO.value - fdSO.value}/${fePT.value - fdPT.value}`
)

const feTotal  = computed(() => feOF.value + feSO.value + fePT.value)
const fdTotal  = computed(() => fdOF.value + fdSO.value + fdPT.value)
const novTotalKPI = computed(() => feTotal.value - fdTotal.value)

const showUnitPanel = ref(false)

// Comisión del servicio
const comiOF = computed(() => agents.value.filter(a => a.category === 'OF' && a.status === 'COMISIÓN DEL SERVICIO').length)
const comiSO = computed(() => agents.value.filter(a => a.category === 'SO' && a.status === 'COMISIÓN DEL SERVICIO').length)
const comiPT = computed(() => agents.value.filter(a => a.category === 'PT' && a.status === 'COMISIÓN DEL SERVICIO').length)
const comiTotal = computed(() => comiOF.value + comiSO.value + comiPT.value)

const novOF = computed(() => feOF.value - comiOF.value)
const novSO = computed(() => feSO.value - comiSO.value)
const novPT = computed(() => fePT.value - comiPT.value)
const novTotal = computed(() => novOF.value + novSO.value + novPT.value)

// ==== Orden/etiquetas para la sección discriminada ====
const STATUS_ORDER = [
  'COMISIÓN DEL SERVICIO',
  'SIN NOVEDAD',
  'VACACIONES',
  'EXCUSA DEL SERVICIO',
  'SERVICIO',
  'FRANCO FRANCO',
  'LICENCIA DE MATERNIDAD',
  'LICENCIA DE LUTO',
  'LICENCIA REMUNERADA',
  'LICENCIA NO REMUNERADA',
  'LICENCIA PATERNIDAD',
  'PERMISO',
  'DESCANSO ESPECIAL',
  'PERMISO ACTIVIDAD PERSONAL',
  'COMISIÓN EN EL EXTERIOR',
  'COMISIÓN DE ESTUDIO',
  'SUSPENDIDO',
  'HOSPITALIZADO',
]

const STATUS_LABEL = {
  'COMISIÓN DEL SERVICIO': 'COMISIÓN DEL SERVICIO',
  'SIN NOVEDAD': 'SIN NOVEDAD (Bogotá)',
  'VACACIONES': 'VACACIONES',
  'EXCUSA DEL SERVICIO': 'EXCUSA DEL SERVICIO',
  'SERVICIO': 'SERVICIO',
  'FRANCO FRANCO': 'FRANCO FRANCO',
  'LICENCIA DE MATERNIDAD': 'LICENCIA DE MATERNIDAD',
  'LICENCIA DE LUTO': 'LICENCIA DE LUTO',
  'LICENCIA REMUNERADA': 'LICENCIA REMUNERADA',
  'LICENCIA NO REMUNERADA': 'LICENCIA NO REMUNERADA',
  'LICENCIA PATERNIDAD': 'LICENCIA PATERNIDAD',
  'PERMISO': 'PERMISO',
  'DESCANSO ESPECIAL': 'DESCANSO ESPECIAL',
  'PERMISO ACTIVIDAD PERSONAL': 'PERMISO ACTIVIDAD PERSONAL',
  'COMISIÓN EN EL EXTERIOR': 'COMISIÓN EN EL EXTERIOR',
  'COMISIÓN DE ESTUDIO': 'COMISIÓN DE ESTUDIO',
  'SUSPENDIDO': 'SUSPENDIDO',
  'HOSPITALIZADO': 'HOSPITALIZADO',
}

const summaryByStatus = computed(() => {
  const acc = {}
  for (const st of STATUS_ORDER) acc[st] = { of: 0, so: 0, pt: 0, total: 0 }

  for (const a of agents.value) {
    const st = a.status || 'SIN NOVEDAD'
    if (!acc[st]) acc[st] = { of: 0, so: 0, pt: 0, total: 0 }
    if (a.category === 'OF') acc[st].of++
    else if (a.category === 'SO') acc[st].so++
    else if (a.category === 'PT') acc[st].pt++
    acc[st].total++
  }

  const list = []
  for (const st of STATUS_ORDER) {
    const r = acc[st]
    if (r && r.total > 0) {
      list.push({
        status: st,
        label: STATUS_LABEL[st] || st,
        of: r.of,
        me: r.so,
        pt: r.pt,
        total: r.total,
      })
    }
  }
  return list
})

const reportDateShort = computed(() => {
  try {
    return new Date(`${reportDate.value}T00:00:00`).toLocaleDateString('es-CO', {
      year: '2-digit', month: 'numeric', day: 'numeric'
    })
  } catch { return reportDate.value }
})

function getUnitLabel(a) {
  return a.unitName || a.unitCode || a.unitShort || ''
}

function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login/'
}

function onMuniInput(agent) {
  const query = agent.municipalityName || ''
  const value = query.trim().toLowerCase()
  const m = municipalities.value.find(
    m => (`${m.dept} - ${m.name}`.toLowerCase().trim() === value)
  )
  agent.municipalityId = m ? m.id : null
}

const agentSearch = ref('')
const agentSearchResults = ref([])
const selectedAgentToAdd = ref(null)

async function onAgentSearchInput() {
  const q = agentSearch.value.trim().toUpperCase()

  agentOwnershipMsg.value = ''
  selectedAgentToAdd.value = null
  canAddSelected.value = false

  if (!q.length) { agentSearchResults.value = []; return }

  const { data } = await http.get('/catalogs/agents', {
    params: { q, limit: 20 }
  })

  agentSearchResults.value = Array.isArray(data) ? data : []
  const match = agentSearchResults.value.find(a => String(a.code).toUpperCase() === q)
  if (!match) return

  const sameGroup = !!me.value?.groupId && match.groupId === me.value.groupId
  const sameUnit  = !!me.value?.unitId && match.unitId === me.value.unitId
  const inOtherUnit = !!match.unitId && !sameUnit

  if (sameUnit) { agentOwnershipMsg.value = 'Agente ya está en su unidad'; return }
  if (inOtherUnit) {
    const unitLabel = getUnitLabel(match) || 'otra unidad'
    agentOwnershipMsg.value = `Agente pertenece a ${unitLabel}`
    return
  }

  if (!match.unitId && sameGroup) {
    selectedAgentToAdd.value = match.id
    canAddSelected.value = true
    agentOwnershipMsg.value = 'Agente de su grupo (sin unidad)'
    return
  }

  if (!match.unitId && !match.groupId) {
    selectedAgentToAdd.value = match.id
    canAddSelected.value = true
    agentOwnershipMsg.value = 'Agente libre'
    return
  }

  agentOwnershipMsg.value = 'Agente asignado a otro grupo'
}

function onSelectAgent(code) {
  agentSearch.value = code
  agentOwnershipMsg.value = ''
  selectedAgentToAdd.value = null
  canAddSelected.value = false

  const a = agentSearchResults.value.find(x => x.code === code)
  if (!a) return

  const sameGroup = !!me.value?.groupId && a.groupId === me.value.groupId
  const sameUnit  = !!me.value?.unitId && a.unitId === me.value.unitId
  const inOtherUnit = !!a.unitId && !sameUnit

  if (sameUnit) { agentOwnershipMsg.value = 'Agente ya está en su unidad'; return }
  if (inOtherUnit) {
    const unitLabel = getUnitLabel(a) || 'otra unidad'
    agentOwnershipMsg.value = `Agente pertenece a ${unitLabel}`
    return
  }
  if (!a.unitId && sameGroup) {
    selectedAgentToAdd.value = a.id
    canAddSelected.value = true
    agentOwnershipMsg.value = 'Agente de su grupo (sin unidad)'
    return
  }
  if (!a.unitId && !a.groupId) {
    selectedAgentToAdd.value = a.id
    canAddSelected.value = true
    agentOwnershipMsg.value = 'Agente libre'
    return
  }

  agentOwnershipMsg.value = 'Agente asignado a otro grupo'
}

async function addFreeAgent() {
  const q = agentSearch.value.trim().toUpperCase()
  const agent = agentSearchResults.value.find(a => String(a.code).toUpperCase() === q)

  if (!agent) { msg.value = 'Selecciona un agente válido'; return }

  if (agents.value.some(x => String(x.code).toUpperCase().trim() === agent.code)) {
    msg.value = `El agente ${agent.code} ya está en tu unidad`
    return
  }

  if (!canAddSelected.value) return

  try {
    await http.post('/my/agents/add', { agentId: agent.id })

    msg.value = 'Agregado con éxito ✅'
    showToast(`Agente ${agent.code} agregado a su unidad`, 'success')
    setTimeout(() => { if (msg.value.includes('✅')) msg.value = '' }, 3000)

    agentSearch.value = ''
    agentSearchResults.value = []
    agentOwnershipMsg.value = ''
    selectedAgentToAdd.value = null
    canAddSelected.value = false

    await loadAgents()
  } catch (e) {
    msg.value = e?.response?.data?.detail || e?.response?.data?.error || 'No se pudo agregar'
    showToast(msg.value, 'warn')
  }
}

async function checkIfReportExists() {
  try {
    const { data } = await http.get('/reports', { params: { date: reportDate.value } })
    existeReporte.value = !!(data && data.length > 0)
  } catch {
    existeReporte.value = false
  }
}

// === Helpers de fechas ===
function toDate(s) {
  if (!s) return null
  const [y, m, d] = String(s).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function isRangeInvalid(start, end) {
  const d1 = toDate(start), d2 = toDate(end)
  if (!d1 || !d2) return false
  return d2 < d1
}
function needsBothDates(state) {
  const s = String(state || '').toUpperCase()
  return [
    'SERVICIO',
    'SUSPENDIDO',
    'VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO','LICENCIA REMUNERADA',
    'LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO','LICENCIA PATERNIDAD',
    'PERMISO','DESCANSO ESPECIAL','PERMISO ACTIVIDAD PERSONAL',
    'COMISIÓN EN EL EXTERIOR','COMISIÓN DE ESTUDIO'
  ].includes(s)
}
function agentHasRangeError(a) {
  if (!needsBothDates(a.status)) return false
  return isRangeInvalid(a.novelty_start, a.novelty_end)
}
const hasDateErrors = computed(() => agents.value.some(agentHasRangeError))

// ✅ Montaje robusto: nada bloquea agentes
onMounted(async () => {
  await loadMe()

  await Promise.allSettled([
    loadMunicipalities(),
    loadGroups(),
    loadUnits(),     // catálogo normal
    loadDepts(),
  ])

  // ✅ cargar unidades DESTINO (pueden incluir otras unidades del grupo o todas según rol)
  await loadDestUnits()

  await Promise.allSettled([
    loadAgents(),
    checkIfReportExists(),
  ])
})

// === Sidebar/menú como AgentDashboard ===
const section = ref('captura')
const menu = [
  { key: 'captura', label: 'Captura de novedades' },
  { key: 'proyeccion', label: 'Proyección funcionarios' },
  { key: 'perfil',  label: 'Perfil' },
]
const titleBySection = computed(() => ({
  captura: 'Captura de novedades',
  proyeccion: 'Proyección funcionarios',
  perfil: 'Perfil de usuario',
}[section.value]))

// --- estado perfil/cambio contraseña ---
const formPwd = ref({ old: '', new1: '', new2: '' })
const showOld = ref(false)
const showNew = ref(false)
const showNew2 = ref(false)
const submittingPwd = ref(false)
const pwdMsg = ref('')
const pwdMsgOk = ref(false)

const strengthScore = ref(0)
const pwdStrengthLabel = computed(() => {
  if (!formPwd.value.new1) return 'Escribe una contraseña segura'
  if (strengthScore.value >= 4) return 'Fortaleza: alta'
  if (strengthScore.value === 3) return 'Fortaleza: media'
  return 'Fortaleza: baja'
})
const pwdStrengthClass = computed(() => {
  if (!formPwd.value.new1) return 'text-slate-500'
  if (strengthScore.value >= 4) return 'text-emerald-700'
  if (strengthScore.value === 3) return 'text-amber-700'
  return 'text-rose-700'
})

function checkStrength () {
  const s = formPwd.value.new1 || ''
  let score = 0
  if (s.length >= 8) score++
  if (/[A-Z]/.test(s)) score++
  if (/[a-z]/.test(s)) score++
  if (/\d/.test(s)) score++
  if (/[^A-Za-z0-9]/.test(s)) score++
  strengthScore.value = score
}

const canSubmitPwd = computed(() =>
  !!formPwd.value.old &&
  !!formPwd.value.new1 &&
  formPwd.value.new1 === formPwd.value.new2 &&
  strengthScore.value >= 4
)

function resetPwdForm () {
  formPwd.value = { old: '', new1: '', new2: '' }
  strengthScore.value = 0
  pwdMsg.value = ''
  pwdMsgOk.value = false
  showOld.value = showNew.value = showNew2.value = false
}

async function onSubmitPassword () {
  pwdMsg.value = ''
  pwdMsgOk.value = false
  if (!canSubmitPwd.value) {
    pwdMsg.value = 'Revisa los requisitos de la nueva contraseña.'
    return
  }
  submittingPwd.value = true
  try {
    await http.post('/me/change-password', {
      oldPassword: formPwd.value.old,
      newPassword: formPwd.value.new1
    })
    pwdMsg.value = 'Contraseña actualizada correctamente.'
    pwdMsgOk.value = true
    setTimeout(() => resetPwdForm(), 1500)
  } catch (err) {
    const apiMsg =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      'Error al cambiar la contraseña.'
    pwdMsg.value = apiMsg
    pwdMsgOk.value = false
  } finally {
    submittingPwd.value = false
  }
}

// ---------- Historial (calendario + timeline) ----------
const historyModal = ref({ open: false, agent: null })
const viewTab = ref('calendar')
const monthCursor = ref(new Date())
const historyItems = ref([])

function ymd(d){ return d.toISOString().slice(0,10) }
function startOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x }
function endOfMonth(d){ const x=new Date(d); x.setMonth(x.getMonth()+1,0); x.setHours(0,0,0,0); return x }
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x }
function dowMonday0(d){ return (d.getDay()+6)%7 }
function startOfWeekMonday(d){ const x=new Date(d); const off=(x.getDay()+6)%7; x.setDate(x.getDate()-off); x.setHours(0,0,0,0); return x }
function endOfWeekSunday(d){ const x=new Date(d); const off=(7-((x.getDay()+6)%7))-1; x.setDate(x.getDate()+off); x.setHours(0,0,0,0); return x }

const historyFrom = computed(() => ymd(startOfWeekMonday(startOfMonth(addMonths(monthCursor.value, -2)))))
const historyTo   = computed(()   => ymd(endOfWeekSunday(endOfMonth(monthCursor.value))))

const calendarStartDate = computed(() => startOfWeekMonday(startOfMonth(monthCursor.value)))
const calendarEndDate   = computed(() => endOfWeekSunday(endOfMonth(monthCursor.value)))

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric'}).format(monthCursor.value)
)
const monthFrom = computed(() => ymd(calendarStartDate.value))
const monthTo   = computed(() => ymd(calendarEndDate.value))

function iconFor(state){
  const s = String(state || '').toUpperCase()
  const map = {
    'SIN NOVEDAD':'✅','SERVICIO':'🧭','COMISIÓN DEL SERVICIO':'📌','FRANCO FRANCO':'🛌',
    'VACACIONES':'🏖️','LICENCIA DE MATERNIDAD':'👶','LICENCIA DE LUTO':'🕊️',
    'LICENCIA REMUNERADA':'📝','LICENCIA NO REMUNERADA':'📝','EXCUSA DEL SERVICIO':'📝',
    'LICENCIA PATERNIDAD':'🍼','PERMISO':'⏳','DESCANSO ESPECIAL':'🎆','PERMISO ACTIVIDAD PERSONAL':'⏳',
    'COMISIÓN EN EL EXTERIOR':'✈️','COMISIÓN DE ESTUDIO':'🎓',
    'SUSPENDIDO':'⛔','HOSPITALIZADO':'🏥'
  }
  return map[s] || '•'
}

function colorClass(state){
  const s = String(state || '').toUpperCase()
  const c = {
    'SIN NOVEDAD':{ bg:'bg-emerald-100', pill:'bg-emerald-100 text-emerald-800', dot:'bg-emerald-500' },
    'SERVICIO':{ bg:'bg-sky-100', pill:'bg-sky-100 text-sky-800', dot:'bg-sky-500' },
    'COMISIÓN DEL SERVICIO':{ bg:'bg-indigo-100', pill:'bg-indigo-100 text-indigo-800', dot:'bg-indigo-500' },
    'FRANCO FRANCO':{ bg:'bg-gray-100', pill:'bg-gray-100 text-gray-800', dot:'bg-gray-500' },
    'VACACIONES':{ bg:'bg-amber-100', pill:'bg-amber-100 text-amber-800', dot:'bg-amber-500' },
    'SUSPENDIDO':{ bg:'bg-rose-100', pill:'bg-rose-100 text-rose-800', dot:'bg-rose-500' },
    'HOSPITALIZADO':{ bg:'bg-rose-100', pill:'bg-rose-100 text-rose-800', dot:'bg-rose-500' }
  }
  return c[s] || { bg:'bg-slate-100', pill:'bg-slate-100 text-slate-700', dot:'bg-slate-400' }
}

function shortState(s){ const t=String(s||''); return t.length<=16?t:(t.slice(0,16)+'…') }
const legendStates = ['SIN NOVEDAD','SERVICIO','COMISIÓN DEL SERVICIO','VACACIONES','FRANCO FRANCO','SUSPENDIDO','HOSPITALIZADO']

function projStateCode (state) {
  const raw = String(state || '')
  const upper = raw.toUpperCase()
  if (!raw) return ''

  if (upper === 'NC' || upper.includes('SIN NOVEDAD')) return 'NC'
  if (upper === 'CS' || upper.includes('COMISION DEL SERVICIO') || upper.includes('COMISIÓN DEL SERVICIO')) return 'CS'
  if (upper === 'CE' || upper.includes('COMISION DE ESTUDIO') || upper.includes('COMISIÓN DE ESTUDIO') || upper.includes('COMISION DE ESTUDIOS') || upper.includes('COMISIÓN DE ESTUDIOS')) return 'CE'
  if (upper === 'PR' || upper.includes('PERMISO') || upper.includes('DESCANSO ESPECIAL')) return 'PR'
  if (upper === 'VC' || upper.includes('VACACION')) return 'VC'
  if (upper === 'SR' || upper === 'SERVICIO' || upper.includes('SERVICIO')) return 'SR'
  if (upper === 'FR' || upper.includes('FRANCO')) return 'FR'
  return ''
}

function projStateColorClass (code) {
  switch (code) {
    case 'NC': return 'bg-sky-700 text-white border-sky-900'
    case 'CS': return 'bg-emerald-500 text-white border-emerald-700'
    case 'CE': return 'bg-amber-400 text-slate-900 border-amber-600'
    case 'PR': return 'bg-amber-600 text-slate-900 border-amber-400'
    case 'VC': return 'bg-red-500 text-white border-red-700'
    case 'SR': return 'bg-orange-500 text-white border-orange-700'
    case 'FR': return 'bg-cyan-400 text-slate-900 border-cyan-600'
    default:   return 'bg-slate-100 text-slate-500 border-slate-300'
  }
}

function diasLaboradosColor(n) {
  if (n == null) return 'text-slate-400'
  if (n >= 15) return 'text-green-600 font-bold'
  if (n >= 8) return 'text-yellow-600 font-bold'
  return 'text-red-600 font-bold'
}

function contarDiasLaborados(historial, fechaReferencia) {
  const sorted = [...historial]
    .filter(d => d.date && d.state)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  let streak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    const day = sorted[i]
    if (day.date > fechaReferencia) continue
    const estado = String(day.state).toUpperCase()
    if (["SIN NOVEDAD", "SERVICIO", "COMISIÓN DEL SERVICIO", "PERMISO ACTIVIDAD PERSONAL"].includes(estado)) streak++
    else break
  }
  return streak
}

async function setDiasLaboradosTodos() {
  const fechaReferencia = reportDate.value
  for (const agente of agents.value) {
    const url = `/admin/agents/${agente.id}/history`
    const params = { from: '2000-01-01', to: fechaReferencia }
    try {
      const { data } = await http.get(url, { params })
      const historial = Array.isArray(data?.items) ? data.items : []
      agente.diasLaborados = contarDiasLaborados(historial, fechaReferencia)
    } catch {
      agente.diasLaborados = 0
    }
  }
}

async function openHistory(a){
  viewTab.value = 'calendar'
  historyModal.value = { open:true, agent:a }
  monthCursor.value = new Date(`${reportDate.value}T00:00:00`)
  await loadHistory()
}
function closeHistory(){
  historyModal.value = { open:false, agent:null }
  historyItems.value = []
}

async function loadHistory() {
  if (!historyModal.value.agent) return
  try {
    const { data } = await http.get(`/admin/agents/${historyModal.value.agent.id}/history`, {
      params: { from: historyFrom.value, to: historyTo.value }
    })
    historyItems.value = Array.isArray(data?.items) ? data.items : []
  } catch (e) {
    console.warn('Error historial:', e?.response?.data || e)
    historyItems.value = []
  }
}

async function prevMonth(){ monthCursor.value = addMonths(monthCursor.value,-1); await loadHistory() }
async function nextMonth(){ monthCursor.value = addMonths(monthCursor.value, 1); await loadHistory() }
async function todayMonth(){ monthCursor.value = new Date(); await loadHistory() }

const calendarCells = computed(() => {
  const start = calendarStartDate.value
  const end   = calendarEndDate.value
  const map   = new Map(historyItems.value.map(h => [String(h.date), h]))
  const cells = []

  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate()+1)) {
    const key = ymd(dt)
    const rec = map.get(key)
    const state = rec?.state || null
    const title = state ? `${key} — ${state}${rec?.municipalityName ? ' — '+rec.municipalityName : ''}` : key
    const isToday = key === ymd(new Date())
    const isPadding = dt.getMonth() !== monthCursor.value.getMonth()
    cells.push({ key, day: dt.getDate(), state, title, isToday, isPadding })
  }
  return cells
})

const segments = computed(() => {
  const days = [...historyItems.value].sort((a,b)=> String(a.date).localeCompare(String(b.date)))
  const out = []
  for (const d of days){
    const state = d.state || 'SIN NOVEDAD'
    const isCommission = String(state).toUpperCase() === 'COMISIÓN DEL SERVICIO'
    const muni = isCommission ? (d.municipalityName || '—') : null
    const key = isCommission ? `${state}::${muni}` : state
    const last = out[out.length-1]
    if (last && last.key === key){ last.to = d.date; last.count++ }
    else out.push({ key, state, municipalityName: muni, from: d.date, to: d.date, count: 1 })
  }
  return out
})

// ======================= PROYECCIÓN DE DESCANSO =======================

const projRange = ref({ from: '', to: '' })
const projByAgent = ref({})
const projDraft = ref({
  from: '',
  to: '',
  state: '',
  destGroupId: null,
  destParentUnitId: null, // padre elegido en UI
  destUnitId: null,       // lo que se guardará (padre o subunidad)
  destSubunitId: null,    // subunidad elegida en UI
  depts: []
})
const projDraftError = ref('')

const projCanAddDraft = computed(() => {
  const f = projDraft.value.from
  const t = projDraft.value.to
  const s = projDraft.value.state
  if (!f || !t || !s) return false
  const d1 = toDate(f)
  const d2 = toDate(t)
  if (!d1 || !d2 || d2 < d1) return false
  if (s === 'COMISIÓN DEL SERVICIO') {
    if (!projDraft.value.destUnitId) return false
  }
  return true
})

const projSelectedAgentId = ref(null)

watch(
  () => projSelectedAgentId.value,
  (aid) => {
    if (!aid) return
    const arr = projByAgent.value[aid] || []
    const parents = new Set(
      arr
        .filter(r => r.state === 'COMISIÓN DEL SERVICIO' && r.destParentUnitId)
        .map(r => Number(r.destParentUnitId))
    )

    for (const pid of parents) {
      // si no está en cache, cargar
      if (!(subunitsByParent.value?.[pid]?.length)) {
        loadSubunitsForUnit(pid)
      }
    }
  }
)

const projMsg = ref('')
const projMsgOk = ref(false)

async function loadProjectionFromBackend () {
  const from = projRange.value.from
  const to   = projRange.value.to

  projMsg.value = ''
  projMsgOk.value = false

  if (!from || !to) { projByAgent.value = {}; return }

  const d1 = toDate(from)
  const d2 = toDate(to)
  if (!d1 || !d2 || d2 < d1) { projByAgent.value = {}; return }

  try {
    const { data } = await http.get('/rest-planning', { params: { from, to } })
    const items = Array.isArray(data?.items) ? data.items : []

    const map = {}
    for (const it of items) {
      const aid = Number(it.agentId)
      if (!aid) continue

      let segDepts = []
      if (Array.isArray(it.depts)) segDepts = it.depts.filter(Boolean)
      else {
        const tmp = []
        if (it.dept1) tmp.push(it.dept1)
        if (it.dept2) tmp.push(it.dept2)
        if (it.dept3) tmp.push(it.dept3)
        segDepts = tmp
      }

      if (!map[aid]) map[aid] = []
            // ✅ intentar reconstruir el padre si destUnitId es una subunidad
      // ✅ intentar reconstruir padre/subunidad
      const savedDestId = it.destUnitId ? Number(it.destUnitId) : null

      let parentId = null
      let subId = null

      // si coincide con unidad padre
      if (savedDestId && (units.value || []).some(u => Number(u.id) === savedDestId)) {
        parentId = savedDestId
        subId = null
      } else if (savedDestId) {
        // si es subunidad, resolvemos padre desde cache
        const su = findSubunitById(savedDestId)
        parentId = su?.parentUnitId || null
        subId = savedDestId // 👈 esto es CLAVE
      }

      map[aid].push({
        from: String(it.start_date).slice(0, 10),
        to:   String(it.end_date).slice(0, 10),
        state: it.state,
        destGroupId: it.destGroupId || null,

        // lo que guarda backend (si hay subunidad: subId; si no: parentId)
        destUnitId: savedDestId,

        // ✅ para UI
        destParentUnitId: parentId,
        destSubunitId: subId,
        depts: segDepts
      })
    }

    projByAgent.value = map

    if (projSelectedAgentId.value && map[projSelectedAgentId.value]?.length) {
      // keep
    } else if (agents.value.length) {
      const withRanges = agents.value.find(a => map[a.id]?.length)
      projSelectedAgentId.value = withRanges?.id || null
    }
  } catch (err) {
    console.warn('Error cargando proyección existente:', err?.response?.data || err)
    projByAgent.value = {}
    projMsg.value = err?.response?.data?.error || err?.response?.data?.detail || 'No se pudo cargar la proyección existente.'
    projMsgOk.value = false
  }
}

const projCurrentAgentRanges = computed(() => {
  const id = projSelectedAgentId.value
  if (!id) return []
  if (!projByAgent.value[id]) projByAgent.value[id] = []
  return projByAgent.value[id]
})

const projCurrentAgentLabel = computed(() => {
  const id = projSelectedAgentId.value
  if (!id) return ''
  const a = agents.value.find(x => x.id === id)
  if (!a) return ''
  return `${a.code}${a.nickname ? ' — "' + a.nickname + '"' : ''} (${displayCategory(a.category)})`
})

const projCurrentAgent = computed(() => {
  if (!projSelectedAgentId.value) return null
  return agents.value.find(a => a.id === projSelectedAgentId.value) || null
})

function projEnumerateDays(from, to) {
  const s = toDate(from)
  const e = toDate(to)
  const out = []
  if (!s || !e || e < s) return out
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(ymd(d))
  return out
}

function isGigGeoDraft(draft) {
  if (!draft?.destGroupId || !draft?.destUnitId) return false
  const g = groupById.value[draft.destGroupId]
  const u = unitById.value[draft.destUnitId]
  const gLabel = String(g?.code || g?.name || '').toUpperCase()
  const uLabel = String(u?.name || '').toUpperCase()
  return gLabel === 'GIG' && uLabel === 'GEO'
}

function isGigGeoSegment(seg) {
  if (!seg?.destGroupId || !seg?.destUnitId) return false
  const g = groupById.value[seg.destGroupId]
  const u = unitById.value[seg.destUnitId]
  const gLabel = String(g?.code || g?.name || '').toUpperCase()
  const uLabel = String(u?.name || '').toUpperCase()
  return gLabel === 'GIG' && uLabel === 'GEO'
}

function limitDraftDepts() {
  if (!Array.isArray(projDraft.value.depts)) { projDraft.value.depts = []; return }
  if (projDraft.value.depts.length > 3) projDraft.value.depts = projDraft.value.depts.slice(0, 3)
}

function toggleDept(dept, checked) {
  if (!Array.isArray(projDraft.value.depts)) projDraft.value.depts = []
  if (checked) {
    if (projDraft.value.depts.includes(dept)) return
    if (projDraft.value.depts.length >= 3) {
      projMsg.value = 'Solo puedes seleccionar hasta 3 departamentos.'
      projMsgOk.value = false
      return
    }
    projDraft.value.depts = [...projDraft.value.depts, dept]
  } else {
    projDraft.value.depts = projDraft.value.depts.filter(d => d !== dept)
  }
}

function projBuildDayMap(ranges) {
  const map = new Map()
  const overlaps = new Set()
  for (const r of ranges) {
    if (!r.from || !r.to || !r.state) continue
    const days = projEnumerateDays(r.from, r.to)
    for (const day of days) {
      if (map.has(day)) overlaps.add(day)
      map.set(day, r.state)
    }
  }
  return { map, overlaps }
}

const projMissingDaysSet = computed(() => {
  const missing = new Set()
  const id = projSelectedAgentId.value
  if (!id) return missing

  const ranges = projCurrentAgentRanges.value
  if (!ranges.length) return missing

  let agentFrom = null
  let agentTo = null
  for (const r of ranges) {
    if (!r.from || !r.to) continue
    if (!agentFrom || r.from < agentFrom) agentFrom = r.from
    if (!agentTo || r.to > agentTo) agentTo = r.to
  }
  if (!agentFrom || !agentTo) return missing

  const { map } = projBuildDayMap(ranges)
  const days = projEnumerateDays(agentFrom, agentTo)
  for (const d of days) if (!map.has(d)) missing.add(d)
  return missing
})

const projPreviewDays = computed(() => {
  const from = projRange.value.from
  const to = projRange.value.to
  const id = projSelectedAgentId.value
  if (!from || !to || !id) return []
  const { map } = projBuildDayMap(projCurrentAgentRanges.value)
  const days = projEnumerateDays(from, to)
  return days.map(d => {
    const state = map.get(d) || null
    return { date: d, day: Number(d.slice(8, 10)), state, title: state ? `${d} — ${state}` : `${d} — sin estado` }
  })
})

const projErrors = computed(() => {
  const errors = []
  const from = projRange.value.from
  const to = projRange.value.to
  if (!from || !to) { errors.push('Debes definir el rango completo de proyección (desde / hasta).'); return errors }
  const d1 = toDate(from)
  const d2 = toDate(to)
  if (!d1 || !d2 || d2 < d1) { errors.push('El rango de proyección es inválido: "hasta" no puede ser menor que "desde".'); return errors }

  if (projSelectedAgentId.value) {
    const ranges = projCurrentAgentRanges.value
    const { overlaps } = projBuildDayMap(ranges)
    if (overlaps.size) errors.push('Este funcionario tiene solapamientos de rangos (mismo día con dos estados distintos).')
    if (projMissingDaysSet.value.size) errors.push('Este funcionario tiene días sin estado dentro del rango proyectado.')
  }
  return errors
})

const projCanSave = computed(() => {
  const from = projRange.value.from
  const to = projRange.value.to
  if (!from || !to) return false
  const hasAny = agents.value.some(a => {
    const arr = projByAgent.value[a.id] || []
    return arr.some(r => r.from && r.to && r.state)
  })
  return hasAny
})

function projAddRangeForCurrent() {
  projDraftError.value = ''
  const id = projSelectedAgentId.value
  if (!id) { projDraftError.value = 'Selecciona un funcionario primero.'; return }

  const { from, to, state } = projDraft.value
  if (!from || !to || !state) { projDraftError.value = 'Completa fecha inicio, fin y estado.'; return }

  const d1 = toDate(from)
  const d2 = toDate(to)
  if (!d1 || !d2 || d2 < d1) { projDraftError.value = 'El rango es inválido: la fecha fin no puede ser menor que la fecha inicio.'; return }

  const gFrom = toDate(projRange.value.from)
  const gTo   = toDate(projRange.value.to)
  if (gFrom && gTo) {
    if (d1 < gFrom || d2 > gTo) {
      projDraftError.value = `El rango debe estar dentro del intervalo global ${projRange.value.from} → ${projRange.value.to}.`
      return
    }
  }

  if (!projByAgent.value[id]) projByAgent.value[id] = []
  const arr = projByAgent.value[id]

  for (const r of arr) {
    const r1 = toDate(r.from)
    const r2 = toDate(r.to)
    if (!r1 || !r2) continue
    const noOverlap = (d2 < r1) || (d1 > r2)
    if (!noOverlap) { projDraftError.value = `Este rango se solapa con ${r.from} → ${r.to}.`; return }
  }

    let destGroupId = null
    let destUnitId = null        // ID efectivo al backend (subunidad si existe)
    let destParentUnitId = null  // padre fijo en UI

    if (projDraft.value.state === 'COMISIÓN DEL SERVICIO' && projDraft.value.destParentUnitId) {
      destParentUnitId = Number(projDraft.value.destParentUnitId)

      const subId = Number(projDraft.value.destSubunitId || 0)
      destUnitId = subId ? subId : destParentUnitId

      const parent = units.value.find(x => Number(x.id) === destParentUnitId)
      destGroupId = parent ? (parent.groupId || null) : null
    }

    arr.push({
      from,
      to,
      state,
      destGroupId,
      destUnitId,
      destParentUnitId,
      destSubunitId: projDraft.value.destSubunitId ? Number(projDraft.value.destSubunitId) : null, // ✅ nuevo
      depts:
        isGigGeoDraft({ destGroupId, destUnitId: destParentUnitId }) && Array.isArray(projDraft.value.depts)
          ? projDraft.value.depts.slice(0, 3)
          : []
    })


  projDraft.value = { from: '', to: '', state: '', destGroupId: null, destParentUnitId: null, destUnitId: null, destSubunitId: null, depts: [] }
}

function onProjDraftStateChange() {
  const s = projDraft.value.state

  if (s !== 'COMISIÓN DEL SERVICIO') {
    // si cambia a otro estado, limpiar destino
    projDraft.value.destGroupId = null
    projDraft.value.destParentUnitId = null
    projDraft.value.destSubunitId = null
    projDraft.value.destUnitId = null
    projDraft.value.depts = []
    return
  }  
}

function projRemoveRangeForCurrent(idx) {
  const id = projSelectedAgentId.value
  if (!id) return
  const arr = projByAgent.value[id]
  if (!arr) return
  arr.splice(idx, 1)
}

function projUpdateSegmentField(segIndex, field, value) {
  const id = projSelectedAgentId.value
  if (!id) return
  const arr = projByAgent.value[id]
  if (!arr || !arr[segIndex]) return

  const current = arr[segIndex]

  // Fechas
  if (field === 'from' || field === 'to') {
    const tmp = { ...current, [field]: value }
    const d1 = toDate(tmp.from)
    const d2 = toDate(tmp.to)
    if (d1 && d2 && d2 < d1) {
      projMsg.value = 'La fecha fin no puede ser menor que la fecha inicio en ese rango.'
      projMsgOk.value = false
      return
    }
    arr[segIndex] = tmp
    return
  }

  // Estado
  if (field === 'state') {
    const newState = value
    const updated = { ...current, state: newState }

    if (newState !== 'COMISIÓN DEL SERVICIO') {
      updated.destGroupId = null
      updated.destUnitId = null
      updated.destParentUnitId = null
      updated.destSubunitId = null
      updated.depts = []
    } else {
      // si vuelve a comisión y no tiene padre, limpia coherente
      if (!updated.destParentUnitId) {
        updated.destUnitId = null
        updated.destGroupId = null
      }
    }

    arr[segIndex] = updated
    return
  }

  // ✅ Padre (unidad)
  if (field === 'destParentUnitId') {
    const parentId = value ? Number(value) : null

    // groupId SIEMPRE sale del PADRE
    let newGroupId = null
    if (parentId) {
      const u = (destUnits.value || []).find(x => Number(x.id) === parentId) || (units.value || []).find(x => Number(x.id) === parentId)
      newGroupId = u ? (u.groupId || null) : null
    }

    // al cambiar padre: reset subunidad y el "dest efectivo" queda siendo el padre
    const updated = {
      ...current,
      destGroupId: newGroupId,
      destParentUnitId: parentId,
      destSubunitId: null,
      destUnitId: parentId, // 👈 lo que se guarda si NO hay subunidad escogida
      depts: [] // se recalcula abajo si aplica
    }

    // cargar subunidades (cache) para que aparezca el select
    if (parentId) loadSubunitsForUnit(parentId)

    // mantener deptos solo si sigue siendo GEO (GIG/GEO) (pero ojo: GEO depende del padre)
    const keepDepts = isGigGeoDraft({ destGroupId: newGroupId, destUnitId: parentId })
    updated.depts = keepDepts && Array.isArray(current.depts) ? current.depts.slice(0, 3) : []

    arr[segIndex] = updated
    return
  }

  // ✅ Subunidad
  if (field === 'destSubunitId') {
    const subId = value ? Number(value) : null

    // si escoge subunidad, el "dest efectivo" pasa a ser la subunidad
    const updated = {
      ...current,
      destSubunitId: subId,
      destUnitId: subId ? subId : (current.destParentUnitId || null)
    }

    arr[segIndex] = updated
    return
  }

  // (compatibilidad por si aún llamas destUnitId directo desde algún lado viejo)
  if (field === 'destUnitId') {
    const newUnitId = value ? Number(value) : null
    let newGroupId = null
    if (newUnitId) {
      const u = (destUnits.value || []).find(x => Number(x.id) === newUnitId) || (units.value || []).find(x => Number(x.id) === newUnitId)
      newGroupId = u ? (u.groupId || null) : null
    }

    const tmpSeg = { destGroupId: newGroupId, destUnitId: newUnitId }
    const keepDepts = isGigGeoSegment(tmpSeg)
    const newDepts = keepDepts && Array.isArray(current.depts) ? current.depts.slice(0, 3) : []

    arr[segIndex] = { ...current, destUnitId: newUnitId, destGroupId: newGroupId, depts: newDepts }
    return
  }

  // default
  arr[segIndex] = { ...current, [field]: value }
}

function projValidateAll() {
  const problems = []
  const from = projRange.value.from
  const to = projRange.value.to
  const d1 = toDate(from)
  const d2 = toDate(to)

  if (!from || !to || !d1 || !d2 || d2 < d1) {
    problems.push('Rango de proyección inválido.')
    return problems
  }

  for (const a of agents.value) {
    const arr = (projByAgent.value[a.id] || []).filter(r => r.from && r.to && r.state)
    if (!arr.length) continue

    const { map, overlaps } = projBuildDayMap(arr)
    if (overlaps.size) problems.push(`El agente ${a.code} tiene días con dos estados distintos en la proyección.`)

    let agentFrom = null
    let agentTo = null
    for (const r of arr) {
      if (!agentFrom || r.from < agentFrom) agentFrom = r.from
      if (!agentTo   || r.to   > agentTo)   agentTo   = r.to
    }
    if (!agentFrom || !agentTo) continue

    const missing = []
    const agentDays = projEnumerateDays(agentFrom, agentTo)
    for (const d of agentDays) if (!map.has(d)) missing.push(d)
    if (missing.length) problems.push(`El agente ${a.code} tiene días sin estado entre ${agentFrom} y ${agentTo} en su proyección.`)
  }

  return problems
}

const projTimelineSegments = computed(() => {
  const id = projSelectedAgentId.value
  if (!id) return []
  const arr = projByAgent.value[id] || []
  const out = []

  arr.forEach((r, idx) => {
    if (!r.from || !r.to || !r.state) return

    const { parent, sub } =
      (r.state === 'COMISIÓN DEL SERVICIO' && r.destUnitId)
        ? resolveDestLabels(r.destUnitId)
        : { parent: '', sub: '' }

    out.push({
      index: idx,
      state: r.state,
      from: r.from,
      to: r.to,
      count: projEnumerateDays(r.from, r.to).length,

      destGroupId: r.destGroupId || null,

      // lo que realmente se guarda
      destUnitId: r.destUnitId || null,

      // ✅ para UI (selects)
      destParentUnitId: r.destParentUnitId || null,
      destSubunitId: r.destSubunitId || null,  // 👈 CLAVE (esto te faltaba)

      depts: Array.isArray(r.depts) ? r.depts : [],

      destParentLabel: parent,
      destSubunitLabel: sub
    })
  })

  out.sort((a, b) => String(a.from).localeCompare(String(b.from)))
  return out
})

const projCalendarCells = computed(() => {
  const from = projRange.value.from
  const to   = projRange.value.to
  const id   = projSelectedAgentId.value
  if (!from || !to || !id) return []

  const d1 = toDate(from)
  const d2 = toDate(to)
  if (!d1 || !d2) return []

  const start = startOfWeekMonday(d1)
  const end   = endOfWeekSunday(d2)

  const { map } = projBuildDayMap(projCurrentAgentRanges.value)
  const cells = []

  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const ymdStr = ymd(dt)
    const state  = map.get(ymdStr) || null
    const isOutside = dt < d1 || dt > d2
    cells.push({ key: ymdStr, date: ymdStr, day: dt.getDate(), state, isOutside, title: state ? `${ymdStr} — ${state}` : `${ymdStr} — sin estado` })
  }
  return cells
})

const projCalendarLabel = computed(() => {
  const from = projRange.value.from
  const to   = projRange.value.to
  if (!from || !to) return ''
  if (from === to) return from
  return `${from} → ${to}`
})

async function saveProjection() {
  projMsg.value = ''
  projMsgOk.value = false

  const allProblems = projValidateAll()
  if (allProblems.length) {
    projMsg.value = allProblems.join(' ')
    projMsgOk.value = false
    return
  }

  try {
    const globalFrom = projRange.value.from
    const globalTo   = projRange.value.to

    const involvedIds = new Set(Object.keys(projByAgent.value).map(id => Number(id)))

    for (const a of agents.value) {
      const arr = projByAgent.value[a.id] || []
      if (arr.some(r => r.from && r.to && r.state)) involvedIds.add(a.id)
    }

    const items = []
    for (const agentId of involvedIds) {
      const a = agents.value.find(x => x.id === agentId)
      if (!a) continue

      const raw = projByAgent.value[agentId] || []
      const segments = raw
        .filter(r => r.from && r.to && r.state)
        .map(r => ({
          from: r.from,
          to:   r.to,
          state: r.state,
          destGroupId: r.state === 'COMISIÓN DEL SERVICIO' ? (r.destGroupId || null) : null,
          destUnitId:  r.state === 'COMISIÓN DEL SERVICIO' ? (r.destUnitId  || null) : null,
          depts: Array.isArray(r.depts) ? r.depts.slice(0, 3) : []
        }))

      items.push({ agentId, segments })
    }

    await http.post('/rest-planning/bulk', { from: globalFrom, to: globalTo, items })

    projMsg.value = 'Proyección de descanso guardada correctamente. ✅'
    projMsgOk.value = true
  } catch (err) {
    projMsg.value = err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Error al guardar la proyección.'
    projMsgOk.value = false
  }
}

async function loadRestProjection() {
  if (!restViewer.from || !restViewer.to) return
  restViewer.loading = true
  restViewer.error = ''

  try {
    const { data } = await http.get('/rest-planning', {
      params: { from: restViewer.from, to: restViewer.to, agentId: restViewer.agentId || undefined }
    })

    const map = {}
    for (const r of (data.items || [])) {
      if (!map[r.agentId]) map[r.agentId] = []
      map[r.agentId].push({ from: r.start_date, to: r.end_date, state: r.state })
    }
    restViewer.byAgent = map
  } catch (err) {
    console.error('Error cargando /rest-planning', err)
    restViewer.error = err?.response?.data?.error || err?.response?.data?.detail || 'Error al cargar la proyección de descanso'
  } finally {
    restViewer.loading = false
  }
}

function projRemoveSegment(idx) {
  const id = projSelectedAgentId.value
  if (!id) return
  const arr = projByAgent.value[id]
  if (!arr) return
  if (idx < 0 || idx >= arr.length) return
  if (!confirm('¿Quitar este rango de la proyección?')) return
  arr.splice(idx, 1)
}

function isMtInvalid(val) {
  if (!val) return false
  return !/^[0-9-]{1,120}$/.test(String(val).trim())
}

watch(reportDate, async () => {
  msg.value = ''
  await loadAgents()
  await checkIfReportExists()
})

watch(
  () => [projRange.value.from, projRange.value.to],
  async ([from, to]) => {
    if (!from || !to) return
    const d1 = toDate(from)
    const d2 = toDate(to)
    if (!d1 || !d2 || d2 < d1) return
    await loadProjectionFromBackend()
  }
)

watch(
  () => projDraft.value.destParentUnitId,
  async (parentId) => {
    const pid = parentId ? Number(parentId) : null

    // reset subunidad al cambiar padre
    projDraft.value.destSubunitId = null

    // ✅ si NO hay padre, limpiar todo lo relacionado
    if (!pid) {
      projDraft.value.destParentUnitId = null
      projDraft.value.destUnitId = null
      projDraft.value.destGroupId = null
      projDraft.value.depts = []
      destSubunits.value = []
      return
    }

    // ✅ dest efectivo por defecto = padre
    projDraft.value.destParentUnitId = pid
    projDraft.value.destUnitId = pid

    // ✅ groupId siempre sale del padre (destUnits o units)
    const parent =
      (destUnits.value || []).find(x => Number(x.id) === pid) ||
      (units.value || []).find(x => Number(x.id) === pid)

    projDraft.value.destGroupId = parent ? (parent.groupId || null) : null

    // cargar subunidades y cachear
    await loadSubunitsForUnit(pid)

    // ✅ si NO es GEO, limpiar deptos
    if (!isGigGeoDraft({ destGroupId: projDraft.value.destGroupId, destUnitId: pid })) {
      projDraft.value.depts = []
    } else {
      // mantener máximo 3
      if (!Array.isArray(projDraft.value.depts)) projDraft.value.depts = []
      if (projDraft.value.depts.length > 3) projDraft.value.depts = projDraft.value.depts.slice(0, 3)
    }
  }
)

watch(
  () => projDraft.value.destSubunitId,
  (subId) => {
    const sid = subId ? Number(subId) : null
    const pid = projDraft.value.destParentUnitId ? Number(projDraft.value.destParentUnitId) : null

    // ✅ dest efectivo = subunidad si existe; si no, queda el padre
    projDraft.value.destUnitId = sid ? sid : (pid || null)
  }
)

const isDeptUnitDraft = computed(() => {
  const unitId = projDraft.value.destUnitId ?? null
  if (!unitId) return false
  const u = destUnits.value.find(x => Number(x.id) === Number(unitId))
  if (!u) return false
  const name = String(u.name || '').toUpperCase().trim()
  return name === 'GEO' || name === 'UNCO' || name.includes('GEO') || name.includes('UNCO')
})
</script>


<style scoped>
.fade-enter-active,.fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from,.fade-leave-to { opacity: 0; }
</style>