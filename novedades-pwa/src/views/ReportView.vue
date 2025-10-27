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
    <div class="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 -mt-10 sm:-mt-12 md:-mt-12 relative z-10">
      <!-- ===== Sidebar (idéntico estilo al del agente) ===== -->
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
      </aside>

      <!-- ===== CONTENIDO ===== -->
      <main class="order-2 md:order-2 md:col-[2] space-y-6">

        <!-- Banner de fechas -->
        <FechasBanner top-offset="top-14" color="amber" />
        
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
                  class="rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  list="free-agents-list"
                  v-model="agentSearch"
                  @input="onAgentSearchInput"
                  placeholder="Buscar código (ej: O101)..."
                  autocomplete="off"
                />
                <datalist id="free-agents-list">
                  <option
                    v-for="a in agentSearchResults.filter(x => !agents.some(y => y.code === x.code))"
                    :key="a.id"
                    :value="a.code"
                    @click="onSelectAgent(a.code)"
                  >
                    {{ a.code }} ({{ displayCategory(a.category) }}){{ a.unitName ? ' — ' + a.unitName : '' }}
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
                          <input
                            class="w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-2"
                            :class="{
                              'border-green-500 focus:ring-green-200 bg-white': a.municipalityId,
                              'border-red-500 focus:ring-red-200 bg-white': a.municipalityName && !a.municipalityId,
                              'border-slate-300 focus:ring-indigo-200 bg-white': !a.municipalityName
                            }"
                            list="municipios-list"
                            v-model="a.municipalityName"
                            @input="onMuniInput(a)"
                            @blur="onMuniInput(a)"
                            placeholder="Buscar municipio..."
                            autocomplete="off"
                          />
                          <datalist id="municipios-list">
                            <option v-for="m in municipalities" :key="m.id" :value="m.dept + ' - ' + m.name" />
                          </datalist>
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

                        <!-- Genérico (otros estados con rango) -->
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
                    <input class="input w-full" list="municipios-list" v-model="a.municipalityName" @input="onMuniInput(a)" placeholder="Buscar municipio..." autocomplete="off" />
                    <datalist id="municipios-list">
                      <option v-for="m in municipalities" :key="m.id" :value="m.dept + ' - ' + m.name" />
                    </datalist>
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
                  cell.isToday && 'ring-2 ring-blue-500/70'
                ]">
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

import axios from 'axios'
import { http } from '@/lib/http'
import { ref, computed, onMounted, watch } from 'vue'
import FechasBanner from '@/components/FechasBanner.vue'

const toast = ref({ visible: false, text: '', kind: 'success' })
function showToast(text, kind = 'success') {
  toast.value = { visible: true, text, kind }
  setTimeout(() => (toast.value.visible = false), 2500)
}

function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
const reportDate = ref(tomorrowStr())
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

const agents = ref([])          // [{id, code, category, status, location, municipalityId}]
const municipalities = ref([])
const me = ref(null) // 👈 Para info usuario

const existeReporte = ref(false)

const agentOwnershipMsg = ref('')     // Mensaje "Agente pertenece a XX unidad"
const canAddSelected     = ref(false) // Habilita/inhabilita el botón Agregar

async function loadMe() {
  try {
    me.value = await axios.get('/me/profile', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    }).then(r => r.data)
  } catch { me.value = null }
}

const CATEG_ORDER = { 'OF': 1, 'SO': 2, 'PT': 3 }

// Mostrar "ME" cuando la categoría real sea "SO"
function displayCategory(c) {
  return String(c || '') === 'SO' ? 'ME' : c
}

async function loadAgents() {
  try {
    const { data } = await axios.get('/my/agents', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
      params: { date: reportDate.value }
    })
    agents.value = (Array.isArray(data) ? data : [])
      .map(a => ({
        ...a,
        municipalityName: a.municipalityName || '',
        novelty_start: a.novelty_start ? String(a.novelty_start).slice(0, 10) : '',
        novelty_end:   a.novelty_end   ? String(a.novelty_end).slice(0, 10)   : '',
        novelty_description: a.novelty_description || ''
      }))
      .sort((x, y) => (CATEG_ORDER[x.category] || 99) - (CATEG_ORDER[y.category] || 99))
    await setDiasLaboradosTodos();
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
  const params = q.length >= 2 ? { q } : {};
  const { data } = await axios.get('/catalogs/municipalities', {
    headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
    params
  });
  municipalities.value = data || [];
}

function onStateChange(agent) {
  // SIN NOVEDAD: Bogotá fijo, limpia lo demás
  if (agent.status === 'SIN NOVEDAD') {
    agent.municipalityId = 11001
    const bogota = municipalities.value.find(m => m.id === 11001)
    agent.municipalityName = bogota ? `${bogota.dept} - ${bogota.name}` : 'CUNDINAMARCA - Bogotá'
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  // SERVICIO: Bogotá fijo, pero permite editar fechas y descripción
  if (agent.status === 'SERVICIO') {
    agent.municipalityId = 11001
    const bogota = municipalities.value.find(m => m.id === 11001)
    agent.municipalityName = bogota ? `${bogota.dept} - ${bogota.name}` : 'CUNDINAMARCA - Bogotá'
    return
  }

  // COMISIÓN DEL SERVICIO: municipio requerido
  if (agent.status === 'COMISIÓN DEL SERVICIO') {
    agent.municipalityId = null
    agent.municipalityName = ''
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  // FRANCO FRANCO: limpia todo
  if (agent.status === 'FRANCO FRANCO') {
    agent.municipalityId = null
    agent.municipalityName = ''
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  // SUSPENDIDO: requiere inicio, fin y descripción, sin municipio
  if (agent.status === 'SUSPENDIDO') {
    agent.municipalityId = null
    agent.municipalityName = ''
    agent.novelty_start = ''
    agent.novelty_end = ''
    agent.novelty_description = ''
    return
  }

  // HOSPITALIZADO: requiere inicio y descripción (sin fin), sin municipio
  if (agent.status === 'HOSPITALIZADO') {
    agent.municipalityId = null
    agent.municipalityName = ''
    agent.novelty_start = ''
    agent.novelty_end = '' // asegúrate que quede vacío
    agent.novelty_description = ''
    return
  }

  // Otros estados genéricos: limpia municipio y pide fechas/desc
  agent.municipalityId = null
  agent.municipalityName = ''
  agent.novelty_start = ''
  agent.novelty_end = ''
  agent.novelty_description = ''
}

async function save() {
        for (const a of agents.value) {
        if (a.status === 'SIN NOVEDAD') {
          if (a.municipalityId !== 11001) {
            msg.value = `El agente ${a.code} debe estar en Bogotá (SIN NOVEDAD)`
            return
          }
        } else if (a.status === 'SERVICIO') {
          if (a.municipalityId !== 11001) {
            msg.value = `El agente ${a.code} debe estar en Bogotá (SERVICIO)`
            return
          }
          if (!a.novelty_start) { msg.value = `Falta fecha inicio para ${a.code} (SERVICIO)`; return }
          if (!a.novelty_end)   { msg.value = `Falta fecha fin para ${a.code} (SERVICIO)`; return }
          if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (SERVICIO)`; return }
        } else if (a.status === 'COMISIÓN DEL SERVICIO') {
          if (!a.municipalityId) { msg.value = `Falta municipio para ${a.code} (COMISIÓN DEL SERVICIO)`; return }
          if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (COMISIÓN DEL SERVICIO)`; return }
        } else if (a.status === 'FRANCO FRANCO') {
          // nada requerido
        } else if (a.status === 'SUSPENDIDO') {
          if (!a.novelty_start) { msg.value = `Falta fecha inicio para ${a.code} (SUSPENDIDO)`; return }
          if (!a.novelty_end)   { msg.value = `Falta fecha fin para ${a.code} (SUSPENDIDO)`; return }
          if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (SUSPENDIDO)`; return }
        } else if (a.status === 'HOSPITALIZADO') {
          if (!a.novelty_start) { msg.value = `Falta fecha inicio para ${a.code} (HOSPITALIZADO)`; return }
          if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (HOSPITALIZADO)`; return }
          // fuerza a vacío por consistencia de UI
          a.novelty_end = ''
        } else {
          // Resto de novedades: inicio, fin, descripción
          if (!a.novelty_start) { msg.value = `Falta fecha inicio para ${a.code} (${a.status})`; return }
          if (!a.novelty_end)   { msg.value = `Falta fecha fin para ${a.code} (${a.status})`; return }
          if (!a.novelty_description) { msg.value = `Falta descripción para ${a.code} (${a.status})`; return }
        }
      }


  try {
    await axios.post('/reports', {
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

              // reglas:
              novelty_start: (isServicio || isHosp || needsDatesGeneric) ? (a.novelty_start || null) : null,
              novelty_end:   (isServicio || isSusp || needsDatesGeneric) ? (a.novelty_end   || null) : null, // HOSPITALIZADO => null
              novelty_description:
                (isServicio || a.status === 'COMISIÓN DEL SERVICIO' || isHosp || isSusp || needsDatesGeneric)
                  ? (a.novelty_description || null)
                  : null,
            }
          })


    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    msg.value = 'Guardado ✅'
    await loadAgents()
  } catch (e) {
    msg.value = e.response?.data?.error || 'Error al guardar'
  }
}

async function removeAgent(agentId) {
  if (!confirm('¿Quitar este agente de tu unidad?')) return
  try {
    const role = String(me.value?.role || '').toLowerCase()

    if (role === 'leader_unit' || role === 'leader_group') {
      await axios.put(`/my/agents/${agentId}/unit`, { unitId: null }, {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
      })
    } else if (role === 'superadmin' || role === 'supervision') {
      await axios.put(`/admin/agents/${agentId}`, { unitId: null }, {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
      })
    } else {
      msg.value = 'No tiene permisos para quitar agentes de la unidad'
      return
    }

    await loadAgents()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo quitar agente'
  }
}

// KPIs calculados en frontend
// FD = todos los OF/SO/PT con status "SIN NOVEDAD"
const fdOF = computed(() => agents.value.filter(a => a.category === 'OF' && a.status === 'SIN NOVEDAD').length)
const fdSO = computed(() => agents.value.filter(a => a.category === 'SO' && a.status === 'SIN NOVEDAD').length)
const fdPT = computed(() => agents.value.filter(a => a.category === 'PT' && a.status === 'SIN NOVEDAD').length)

// FE (efectivo total)
const feOF = computed(() => agents.value.filter(a => a.category === 'OF').length)
const feSO = computed(() => agents.value.filter(a => a.category === 'SO').length)
const fePT = computed(() => agents.value.filter(a => a.category === 'PT').length)

// Novedades = total - FD
const kpiFE = computed(() => `${feOF.value}/${feSO.value}/${fePT.value}`)
const kpiFD = computed(() => `${fdOF.value}/${fdSO.value}/${fdPT.value}`)
const kpiNOV = computed(() =>
  `${feOF.value - fdOF.value}/${feSO.value - fdSO.value}/${fePT.value - fdPT.value}`
)

// Totales para KPI
const feTotal  = computed(() => feOF.value + feSO.value + fePT.value)
const fdTotal  = computed(() => fdOF.value + fdSO.value + fdPT.value)
const novTotalKPI = computed(() => feTotal.value - fdTotal.value) // = (FE - FD)

// Panel desplegable (cerrado por defecto)
const showUnitPanel = ref(false)

// === Cómputos para FE, F/D (Comisión) y Novedades ===
// Ya tienes feOF/feSO/fePT; reutilizamos

const comiOF = computed(() =>
  agents.value.filter(a => a.category === 'OF' && a.status === 'COMISIÓN DEL SERVICIO').length
)
const comiSO = computed(() =>
  agents.value.filter(a => a.category === 'SO' && a.status === 'COMISIÓN DEL SERVICIO').length
)
const comiPT = computed(() =>
  agents.value.filter(a => a.category === 'PT' && a.status === 'COMISIÓN DEL SERVICIO').length
)
const comiTotal = computed(() => comiOF.value + comiSO.value + comiPT.value)

// Novedades (suma de "SIN NOVEDAD" y todos los demás EXCEPTO Comisión del servicio)
// Equivale a FE - Comisión del servicio
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
  'COMISIÓN EN EL EXTERIOR',
  'COMISIÓN DE ESTUDIO',
  'SUSPENDIDO',
  'HOSPITALIZADO',
];

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
  'COMISIÓN EN EL EXTERIOR': 'COMISIÓN EN EL EXTERIOR',
  'COMISIÓN DE ESTUDIO': 'COMISIÓN DE ESTUDIO',
  'SUSPENDIDO': 'SUSPENDIDO',
  'HOSPITALIZADO': 'HOSPITALIZADO',

};

const summaryByStatus = computed(() => {
  const acc = {};
  for (const st of STATUS_ORDER) acc[st] = { of: 0, so: 0, pt: 0, total: 0 };

  for (const a of agents.value) {
    const st = a.status || 'SIN NOVEDAD';
    if (!acc[st]) acc[st] = { of: 0, so: 0, pt: 0, total: 0 };
    if (a.category === 'OF') acc[st].of++;
    else if (a.category === 'SO') acc[st].so++;
    else if (a.category === 'PT') acc[st].pt++;
    acc[st].total++;
  }

  const list = [];
  for (const st of STATUS_ORDER) {
    const r = acc[st];
    if (r && r.total > 0) {
      list.push({
        status: st,
        label: STATUS_LABEL[st] || st,
        of: r.of,
        me: r.so,  // mostrar "ME" aunque la categoría sea SO
        pt: r.pt,
        total: r.total,
      });
    }
  }
  return list;
});

// Fecha corta
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
  const query = agent.municipalityName || '';
  const value = query.trim().toLowerCase();
  const m = municipalities.value.find(
    m => (`${m.dept} - ${m.name}`.toLowerCase().trim() === value)
  );
  agent.municipalityId = m ? m.id : null;
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

  const { data } = await axios.get('/catalogs/agents', {
    params: { q, limit: 20 },
    headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
  })

  agentSearchResults.value = Array.isArray(data) ? data : []
  const match = agentSearchResults.value.find(a => String(a.code).toUpperCase() === q)
  if (!match) return

  const sameGroup = !!me.value?.groupId && match.groupId === me.value.groupId
  const sameUnit  = !!me.value?.unitId && match.unitId === me.value.unitId
  const inOtherUnit = !!match.unitId && !sameUnit

  if (sameUnit) {
    agentOwnershipMsg.value = 'Agente ya está en su unidad'
    return
  }
  if (inOtherUnit) {
    const unitLabel  = getUnitLabel(match) || 'otra unidad'
    agentOwnershipMsg.value = `Agente pertenece a ${unitLabel}`
    return
  }

  // ✅ NUEVO: permitir agregar si es de mi grupo y no tiene unidad
  if (!match.unitId && sameGroup) {
    selectedAgentToAdd.value = match.id
    canAddSelected.value = true
    agentOwnershipMsg.value = 'Agente de su grupo (sin unidad)'
    return
  }

  // Libre total (sin grupo ni unidad) → también se puede agregar
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
    const unitLabel  = getUnitLabel(a) || 'otra unidad'
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

  if (!agent) { msg.value = "Selecciona un agente válido"; return }

  // Evitar duplicados en la misma unidad
  if (agents.value.some(x => String(x.code).toUpperCase().trim() === agent.code)) {
    msg.value = `El agente ${agent.code} ya está en tu unidad`
    return
  }

  // Solo si está libre
  if (!canAddSelected.value) return

  try {
    await axios.post('/my/agents/add', { agentId: agent.id }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })

    msg.value = "Agregado con éxito ✅"
    showToast(`Agente ${agent.code} agregado a su unidad`, 'success')
    setTimeout(() => { if (msg.value.includes('✅')) msg.value = '' }, 3000)

    // limpiar buscador/estado
    agentSearch.value = ''
    agentSearchResults.value = []
    agentOwnershipMsg.value = ''
    selectedAgentToAdd.value = null
    canAddSelected.value = false

    await loadAgents()
  } catch (e) {
    msg.value = e.response?.data?.detail || e.response?.data?.error || 'No se pudo agregar'
    showToast(msg.value, 'warn')
  }
}

async function checkIfReportExists() {
  try {
    const { data } = await axios.get('/reports', {
      params: { date: reportDate.value },
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    });
    existeReporte.value = !!(data && data.length > 0);
  } catch { existeReporte.value = false }
}

// === Helpers de fechas ===
function toDate(s) {
  if (!s) return null
  // forzamos formato YYYY-MM-DD a Date (00:00 local)
  const [y, m, d] = String(s).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function isRangeInvalid(start, end) {
  const d1 = toDate(start), d2 = toDate(end)
  if (!d1 || !d2) return false // solo validamos cuando ambas existen
  return d2 < d1
}
// Estados que piden dos fechas (inicio y fin)
function needsBothDates(state) {
  const s = String(state || '').toUpperCase()
  return [
    'SERVICIO',
    'SUSPENDIDO',
    // genéricos: todas las que en tu UI piden inicio y fin
    'VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO','LICENCIA REMUNERADA',
    'LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO','LICENCIA PATERNIDAD','PERMISO',
    'COMISIÓN EN EL EXTERIOR','COMISIÓN DE ESTUDIO'
  ].includes(s)
}
// ¿El agente tiene error de rango?
function agentHasRangeError(a) {
  if (!needsBothDates(a.status)) return false
  return isRangeInvalid(a.novelty_start, a.novelty_end)
}
// Computado global: ¿hay algún error de fechas en el listado?
const hasDateErrors = computed(() => agents.value.some(agentHasRangeError))

watch(reportDate, async () => {
  msg.value = ''
  await loadAgents()
  await checkIfReportExists()
})

onMounted(async () => {
  await loadMe() // <--- Carga el usuario y unidad
  await loadMunicipalities();
  await loadAgents();
  await checkIfReportExists();
});

// === Sidebar/menú como AgentDashboard ===
const section = ref('captura')  // 'captura' | 'perfil'
const menu = [
  { key: 'captura', label: 'Captura de novedades' },
  { key: 'perfil',  label: 'Perfil' },
]
const titleBySection = computed(() => ({
  captura: 'Captura de novedades',
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
    await axios.post('/me/change-password', {
      oldPassword: formPwd.value.old,
      newPassword: formPwd.value.new1
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    pwdMsg.value = 'Contraseña actualizada correctamente.'
    pwdMsgOk.value = true
    // Limpia el form **después de un pequeño delay**, así el usuario ve el mensaje
    setTimeout(() => resetPwdForm(), 1500)
  } catch (err) {
    // Toma el mensaje correcto del backend
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

// Helpers de fechas
function ymd(d){ return d.toISOString().slice(0,10) }
function startOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x }
function endOfMonth(d){ const x=new Date(d); x.setMonth(x.getMonth()+1,0); x.setHours(0,0,0,0); return x }
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x }
function dowMonday0(d){ return (d.getDay()+6)%7 }

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric'}).format(monthCursor.value)
)
const monthFrom = computed(() => ymd(startOfMonth(monthCursor.value)))
const monthTo   = computed(() => ymd(endOfMonth(monthCursor.value)))   // <-- ESTA ES LA QUE FALTABA

// Colores/Iconos
function iconFor(state){
  const s = String(state || '').toUpperCase()
  const map = {
    'SIN NOVEDAD':'✅','SERVICIO':'🧭','COMISIÓN DEL SERVICIO':'📌','FRANCO FRANCO':'🛌',
    'VACACIONES':'🏖️','LICENCIA DE MATERNIDAD':'👶','LICENCIA DE LUTO':'🕊️',
    'LICENCIA REMUNERADA':'📝','LICENCIA NO REMUNERADA':'📝','EXCUSA DEL SERVICIO':'📝',
    'LICENCIA PATERNIDAD':'🍼','PERMISO':'⏳','COMISIÓN EN EL EXTERIOR':'✈️','COMISIÓN DE ESTUDIO':'🎓',
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
const legendStates = [
  'SIN NOVEDAD','SERVICIO','COMISIÓN DEL SERVICIO','VACACIONES','FRANCO FRANCO','SUSPENDIDO','HOSPITALIZADO'
]

function diasLaboradosColor(n) {
  if (n == null) return 'text-slate-400'
  if (n >= 15) return 'text-green-600 font-bold'
  if (n >= 8) return 'text-yellow-600 font-bold'
  return 'text-red-600 font-bold'
}

function contarDiasLaborados(historial, fechaReferencia) {
  // Historial debe estar ordenado ASCENDENTE (viejo -> reciente)
  // Vamos a asegurarnos:
  const sorted = [...historial]
    .filter(d => d.date && d.state)
    .sort((a, b) => String(a.date).localeCompare(String(b.date))); // ascendente

  let streak = 0;
  // Recorremos de la fechaReferencia hacia atrás (del día más reciente al más antiguo)
  for (let i = sorted.length - 1; i >= 0; i--) {
    const day = sorted[i];
    if (day.date > fechaReferencia) continue; // saltar futuras
    const estado = String(day.state).toUpperCase();
    if (["SIN NOVEDAD", "SERVICIO", "COMISIÓN DEL SERVICIO"].includes(estado)) {
      streak++;
    } else {
      break; // ¡En cuanto encuentra otra novedad, termina el conteo!
    }
  }
  return streak;
}

async function setDiasLaboradosTodos() {
  const fechaReferencia = reportDate.value; // o la fecha actual
  for (const agente of agents.value) {
    const url = `/admin/agents/${agente.id}/history`;
    // Saca TODO el historial (puedes limitar from si tu base es muy grande)
    const params = { from: '2000-01-01', to: fechaReferencia };
    try {
      const { data } = await axios.get(url, {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
        params
      });
      const historial = Array.isArray(data?.items) ? data.items : [];
      agente.diasLaborados = contarDiasLaborados(historial, fechaReferencia);
    } catch {
      agente.diasLaborados = 0;
    }
  }
}

// --- Modal Historial ---
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
  if (!historyModal.value.agent) return;
  const url = `/admin/agents/${historyModal.value.agent.id}/history`; // <-- SIEMPRE este endpoint
  const params = { from: monthFrom.value, to: monthTo.value };
  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
      params
    });
    historyItems.value = Array.isArray(data?.items) ? data.items : [];
  } catch (e) {
    console.warn('Error historial:', e?.response?.data || e);
    historyItems.value = [];
  }
}

// Navegación meses
async function prevMonth(){ monthCursor.value = addMonths(monthCursor.value,-1); await loadHistory() }
async function nextMonth(){ monthCursor.value = addMonths(monthCursor.value, 1); await loadHistory() }
async function todayMonth(){ monthCursor.value = new Date(); await loadHistory() }

// Calendario
const calendarCells = computed(() => {
  const start = startOfMonth(monthCursor.value)
  const end   = endOfMonth(monthCursor.value)
  const pad   = dowMonday0(start)
  const days  = end.getDate()
  const map   = new Map(historyItems.value.map(h => [String(h.date), h]))
  const cells = []
  for (let i=0;i<pad;i++) cells.push({ key:'pad-'+i, day:'', state:null, title:'' })
  for (let d=1; d<=days; d++){
    const dt = new Date(start); dt.setDate(d)
    const key = ymd(dt)
    const rec = map.get(key)
    const state = rec?.state || null
    const title = state ? `${key} — ${state}${rec?.municipalityName ? ' — '+rec.municipalityName : ''}` : key
    const isToday = key === ymd(new Date())
    cells.push({ key, day:d, state, title, isToday })
  }
  while (cells.length % 7) cells.push({ key:'tail-'+cells.length, day:'', state:null, title:'' })
  return cells
})

// Timeline
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

watch(reportDate, async () => {
  msg.value = ''
  await loadAgents()
  await checkIfReportExists()
})

onMounted(async () => {
  await loadMe()
  await loadMunicipalities()
  await loadAgents()
  await checkIfReportExists()
})


</script>

<style scoped>
.fade-enter-active,.fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from,.fade-leave-to { opacity: 0; }
</style>