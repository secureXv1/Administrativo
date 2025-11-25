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
    <div class="max-w-[1500px] mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] gap-7 -mt-10 sm:-mt-12 md:-mt-12 relative z-10">
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
                  placeholder="Buscar código o nickname (ej: O101 o &quot;NOM.APE&quot;)..."
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
              class="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
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
                      >
                    </div>

                    <div>
                      <label class="text-[11px] font-medium text-slate-600 mb-1 block">
                        Hasta
                      </label>
                      <input
                        type="date"
                        class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
                        v-model="projDraft.to"
                      >
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
                  <!-- Grupo y Unidad destino SOLO si es COMISIÓN DEL SERVICIO -->
                  <div
                    v-if="projDraft.state === 'COMISIÓN DEL SERVICIO'"
                    class="mt-2 grid gap-2 sm:grid-cols-2"
                  >
                    <div>
                      <label class="text-[11px] font-medium text-slate-600 mb-1 block">
                        Grupo destino
                      </label>
                      <select
                        class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
                        v-model="projDraft.destGroupId"
                      >
                        <option :value="null" disabled>Selecciona grupo…</option>
                        <option
                          v-for="g in groups"
                          :key="g.id"
                          :value="g.id"
                        >
                          {{ g.code || g.name }}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label class="text-[11px] font-medium text-slate-600 mb-1 block">
                        Unidad destino
                      </label>
                      <select
                        class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
                        v-model="projDraft.destUnitId"
                        :disabled="!projDraft.destGroupId"
                      >
                        <option :value="null" disabled>Selecciona unidad…</option>
                        <option
                          v-for="u in (unitsByGroup[projDraft.destGroupId] || [])"
                          :key="u.id"
                          :value="u.id"
                        >
                          {{ u.name }}
                        </option>
                      </select>
                    </div>  

                    <!-- SOLO si la unidad seleccionada es GEO -->
                    <div v-if="isDeptUnitDraft" class="grid gap-1">
                      <!-- 👇 Lista chuleable de departamentos (máx 3) -->
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

                  <div
                    v-if="projTimelineSegments.length"
                    class="space-y-2 relative mt-1 max-h-56 overflow-auto pr-1"
                  >
                    <div class="absolute left-2 top-0 bottom-0 w-px bg-slate-300" />
                    <div
                      v-for="seg in projTimelineSegments"
                      :key="seg.index"
                      class="flex flex-wrap items-center gap-2 pl-4"
                    >
                      <div
                        class="w-3 h-3 rounded-full border-2 border-white shadow ring-1 ring-slate-200"
                        :class="colorClass(seg.state)?.dot || 'bg-slate-400'"
                      />

                      <div
                        class="inline-flex flex-wrap items-center gap-2 px-3 py-1  text-[10px] shadow-sm bg-white border border-slate-200"
                      >
                       
                        <!-- Fechas editables -->
                        <div class="flex items-center gap-1">
                          <input
                            type="date"
                            class="rounded-md border border-slate-300 px-1 py-0.5"
                            :value="seg.from"
                            @change="projUpdateSegmentField(seg.index, 'from', $event.target.value)"
                          />
                          <span>→</span>
                          <input
                            type="date"
                            class="rounded-md border border-slate-300 px-1 py-0.5"
                            :value="seg.to"
                            @change="projUpdateSegmentField(seg.index, 'to', $event.target.value)"
                          />
                          <!-- Estado editable -->
                          <select
                            class="rounded-md border border-slate-300 px-1 py-0.5 bg-white"
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
                          <span v-if="seg.state === 'COMISIÓN DEL SERVICIO' && seg.destUnitId" class="text-[10px] opacity-80">
                            {{ unitById[seg.destUnitId]?.name || 'Unidad' }}
                          </span>
                          <span
                            v-if="seg.depts && seg.depts.length"
                            class="text-[10px] opacity-80"
                          >
                            Deptos: {{ seg.depts.join(', ') }}
                          </span>


                        </div>

                        <span class="opacity-70">
                          {{ seg.count }} día(s)
                        </span>
                      </div>

                      <button
                        type="button"
                        class="ml-1 text-[11px] text-rose-700 hover:underline"
                        @click="projRemoveSegment(seg.index)"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>

                  <p v-else class="text-[11px] text-slate-500 mt-1">
                    Este funcionario no tiene rangos proyectados dentro del intervalo seleccionado.
                  </p>
                </div>
              </div>


              </div>

              <!-- === COLUMNA DERECHA: CALENDARIO CUADRADO === -->
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
                  class="grid grid-cols-7 gap-1 text-[10px] font-medium text-slate-500 mb-1"
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
                <div class="max-h-80 overflow-y-auto pr-1">
                  <div class="grid grid-cols-7 gap-1">
                    <div
                      v-for="cell in projCalendarCells"
                      :key="cell.key"
                      :title="cell.title"
                      class="h-14 rounded-lg border text-[10px] flex flex-col p-1 transition-all"
                      :class="[
                        cell.state
                          ? (colorClass(cell.state)?.bg || 'bg-slate-100')
                          : 'bg-white',
                        cell.isOutside && 'opacity-60',
                        projMissingDaysSet.has(cell.date) && '!border-rose-400 border-2'
                      ]"
                    >
                      <div class="text-[10px] font-medium text-slate-700">
                        {{ cell.day }}
                      </div>
                      <div
                        v-if="cell.state"
                        class="mt-auto text-center text-lg leading-none"
                      >
                        {{ iconFor(cell.state) }}
                      </div>
                      <div
                        v-if="cell.state"
                        class="text-[9px] text-center truncate"
                      >
                        {{ shortState(cell.state) }}
                      </div>
                      <div
                        v-else
                        class="mt-auto text-[9px] text-rose-500"
                      >
                        sin estado
                      </div>
                    </div>
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

import axios from 'axios'
import { http } from '@/lib/http'
import { ref, computed, onMounted, watch, reactive } from 'vue'
import FechasBanner from '@/components/FechasBanner.vue'

const restViewer = reactive({
  from: '',      // 'YYYY-MM-DD'
  to: '',        // 'YYYY-MM-DD'
  agentId: null, // id del agente seleccionado (opcional para filtrar)
  loading: false,
  error: '',
  byAgent: {}    // { [agentId]: [ { from, to, state } ] }
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

const reportDate = ref(businessDateBogota(9)) // flip a las 05:00 Bogotá
const msg = ref('')
const msgClass = computed(() => msg.value.includes('✅') ? 'text-green-600' : 'text-red-600')

const agents = ref([])          // [{id, code, category, status, location, municipalityId}]
const municipalities = ref([])
const me = ref(null) // 👈 Para info usuario

const groups = ref([])
const units = ref([])
const depts = ref([])

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
    agents.value = (Array.isArray(data) ? data : []).map(a => ({
      ...a,
      municipalityName: a.municipalityName || '',
      novelty_start: a.novelty_start ? String(a.novelty_start).slice(0, 10) : '',
      novelty_end:   a.novelty_end   ? String(a.novelty_end).slice(0, 10)   : '',
      novelty_description: a.novelty_description || '',
      // ✅ MT viene de agent.mt desde el backend
      mt: a.mt || ''
    }))
      .sort((x, y) => (CATEG_ORDER[x.category] || 99) - (CATEG_ORDER[y.category] || 99))

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
  const params = q.length >= 2 ? { q } : {};
  const { data } = await axios.get('/catalogs/municipalities', {
    headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
    params
  });
  municipalities.value = data || [];
}

async function loadGroups () {
  const { data } = await axios.get('/rest-planning/groups', {
    headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
  })
  groups.value = Array.isArray(data) ? data : []
}

async function loadUnits () {
  const { data } = await axios.get('/rest-planning/units', {
    headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
  })
  units.value = Array.isArray(data) ? data : []
}

async function loadDepts () {
  try {
    const { data } = await axios.get('/admin/depts', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    // backend devuelve { items: ["ANTIOQUIA", "ATLÁNTICO", ...] }
    depts.value = Array.isArray(data?.items)
      ? data.items   // ← YA ES UN ARREGLO DE STRINGS
      : []
  } catch (e) {
    console.error('[loadDepts] error', e)
    depts.value = []
  }
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
      // ✅ Bloquea guardado si algún MT es inválido
      for (const a of agents.value) {
        if (isMtInvalid(a.mt)) {
          msg.value = `MT inválido para ${a.code}. Usa solo números y guiones.`
          return
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

          novelty_start: (isServicio || isHosp || needsDatesGeneric) ? (a.novelty_start || null) : null,
          novelty_end:   (isServicio || isSusp || needsDatesGeneric) ? (a.novelty_end   || null) : null,
          novelty_description:
            (isServicio || a.status === 'COMISIÓN DEL SERVICIO' || isHosp || isSusp || needsDatesGeneric)
              ? (a.novelty_description || null)
              : null,

          mt: a.mt ? a.mt.trim() : null // ✅ NUEVO
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
  'PERMISO ACTIVIDAD PERSONAL',
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
  'PERMISO ACTIVIDAD PERSONAL': 'PERMISO ACTIVIDAD PERSONAL',
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
    'LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO','LICENCIA PATERNIDAD','PERMISO', 'PERMISO ACTIVIDAD PERSONAL',
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

onMounted(async () => {
  await loadMe() // <--- Carga el usuario y unidad
  await loadMunicipalities();
  await loadGroups()   
  await loadUnits()  
  await loadDepts()  
  await loadAgents();
  await checkIfReportExists();
});

// === Sidebar/menú como AgentDashboard ===
const section = ref('captura')  // 'captura' | 'perfil'
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
function startOfWeekMonday(d){ const x=new Date(d); const off=(x.getDay()+6)%7; x.setDate(x.getDate()-off); x.setHours(0,0,0,0); return x }
function endOfWeekSunday(d){ const x=new Date(d); const off=(7-((x.getDay()+6)%7))-1; x.setDate(x.getDate()+off); x.setHours(0,0,0,0); return x }


// Rango para pedir al backend (3 meses: mes visible + 2 hacia atrás), extendido a semanas completas
const historyFrom = computed(() => ymd(startOfWeekMonday(startOfMonth(addMonths(monthCursor.value, -2)))))
const historyTo   = computed(()   => ymd(endOfWeekSunday(endOfMonth(monthCursor.value))))

// Rango VISUAL del calendario del mes actual (1 mes + padding lun-dom)
const calendarStartDate = computed(() => startOfWeekMonday(startOfMonth(monthCursor.value)))
const calendarEndDate   = computed(() => endOfWeekSunday(endOfMonth(monthCursor.value)))

// Etiquetas mostradas en el modal
const monthLabel = computed(() =>
  new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric'}).format(monthCursor.value)
)
const monthFrom = computed(() => ymd(calendarStartDate.value))
const monthTo   = computed(() => ymd(calendarEndDate.value))

// Colores/Iconos
function iconFor(state){
  const s = String(state || '').toUpperCase()
  const map = {
    'SIN NOVEDAD':'✅','SERVICIO':'🧭','COMISIÓN DEL SERVICIO':'📌','FRANCO FRANCO':'🛌',
    'VACACIONES':'🏖️','LICENCIA DE MATERNIDAD':'👶','LICENCIA DE LUTO':'🕊️',
    'LICENCIA REMUNERADA':'📝','LICENCIA NO REMUNERADA':'📝','EXCUSA DEL SERVICIO':'📝',
    'LICENCIA PATERNIDAD':'🍼','PERMISO':'⏳', 'PERMISO ACTIVIDAD PERSONAL':'⏳','COMISIÓN EN EL EXTERIOR':'✈️','COMISIÓN DE ESTUDIO':'🎓',
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
    if (["SIN NOVEDAD", "SERVICIO", "COMISIÓN DEL SERVICIO" , "PERMISO ACTIVIDAD PERSONAL"].includes(estado)) {
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
  try {
    const { data } = await axios.get(`/admin/agents/${historyModal.value.agent.id}/history`, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
      params: { from: historyFrom.value, to: historyTo.value }
    })
    historyItems.value = Array.isArray(data?.items) ? data.items : []
  } catch (e) {
    console.warn('Error historial:', e?.response?.data || e)
    historyItems.value = []
  }
}

// Navegación meses
async function prevMonth(){ monthCursor.value = addMonths(monthCursor.value,-1); await loadHistory() }
async function nextMonth(){ monthCursor.value = addMonths(monthCursor.value, 1); await loadHistory() }
async function todayMonth(){ monthCursor.value = new Date(); await loadHistory() }

// Calendario
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

    // ¿Este día pertenece al mes visible o es padding?
    const isPadding = dt.getMonth() !== monthCursor.value.getMonth()

    cells.push({ key, day: dt.getDate(), state, title, isToday, isPadding })
  }
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

// ======================= PROYECCIÓN DE DESCANSO =======================

// Rango global de proyección (por ej. 2025-11-25 → 2026-01-05)
const projRange = ref({
  from: '',
  to: ''
})

// Mapa: agentId -> [ { from, to, state } ]
const projByAgent = ref({})

// Draft de rango para el formulario
const projDraft = ref({
  from: '',
  to: '',
  state: '',
  destGroupId: null,
  destUnitId: null,
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

  // 👇 Si es COMISIÓN DEL SERVICIO, obligar grupo/unidad destino
  if (s === 'COMISIÓN DEL SERVICIO') {
    if (!projDraft.value.destGroupId || !projDraft.value.destUnitId) return false
  }

  return true
})

// Agente actualmente seleccionado en el editor
const projSelectedAgentId = ref(null)

// Mensajes
const projMsg = ref('')
const projMsgOk = ref(false)

// Cargar proyección existente desde el backend para el rango [from,to]
async function loadProjectionFromBackend () {
  const from = projRange.value.from
  const to   = projRange.value.to

  projMsg.value = ''
  projMsgOk.value = false

  // Si no hay rango, limpiamos proyección en memoria
  if (!from || !to) {
    projByAgent.value = {}
    return
  }

  const d1 = toDate(from)
  const d2 = toDate(to)
  if (!d1 || !d2 || d2 < d1) {
    projByAgent.value = {}
    return
  }

  try {
    const { data } = await axios.get('/rest-planning', {
      params: {
        from,
        to
        // NO enviamos unitId: el backend ya filtra por unidad del usuario
      },
      headers: {
        Authorization: 'Bearer ' + (localStorage.getItem('token') || '')
      }
    })

    const items = Array.isArray(data?.items) ? data.items : []

    const map = {}
    for (const it of items) {
      const aid = Number(it.agentId)
      if (!aid) continue

      // 👇 reconstruimos depts si el backend envía dept1/2/3 o array
      let segDepts = []
      if (Array.isArray(it.depts)) {
        segDepts = it.depts.filter(Boolean)
      } else {
        const tmp = []
        if (it.dept1) tmp.push(it.dept1)
        if (it.dept2) tmp.push(it.dept2)
        if (it.dept3) tmp.push(it.dept3)
        segDepts = tmp
      }

      if (!map[aid]) map[aid] = []
      map[aid].push({
        from: String(it.start_date).slice(0, 10),
        to:   String(it.end_date).slice(0, 10),
        state: it.state,
        destGroupId: it.destGroupId || null,
        destUnitId:  it.destUnitId  || null,
        depts: segDepts             // 👈 NUEVO
      })
    }


    // 🔄 sustituimos todo el mapa por lo que hay en BD
    projByAgent.value = map

    // Mantener selección si sigue teniendo rangos
    if (
      projSelectedAgentId.value &&
      map[projSelectedAgentId.value] &&
      map[projSelectedAgentId.value].length
    ) {
      // ok, dejamos la selección como está
    } else if (agents.value.length) {
      // Si no, elegimos alguno que tenga algo
      const withRanges = agents.value.find(a => map[a.id]?.length)
      projSelectedAgentId.value = withRanges?.id || null
    }
  } catch (err) {
    console.warn('Error cargando proyección existente:', err?.response?.data || err)
    projByAgent.value = {}
    projMsg.value =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      'No se pudo cargar la proyección existente.'
    projMsgOk.value = false
  }
}

// Devuelve el arreglo reactivo de rangos para el agente actual
const projCurrentAgentRanges = computed(() => {
  const id = projSelectedAgentId.value
  if (!id) return []
  if (!projByAgent.value[id]) {
    // inicializa array para ese agente
    projByAgent.value[id] = []
  }
  return projByAgent.value[id]
})

// Label amigable del agente actual
const projCurrentAgentLabel = computed(() => {
  const id = projSelectedAgentId.value
  if (!id) return ''
  const a = agents.value.find(x => x.id === id)
  if (!a) return ''
  return `${a.code}${a.nickname ? ' — "' + a.nickname + '"' : ''} (${displayCategory(a.category)})`
})

// Agente actual como objeto completo (para sugerencias de grupo/unidad)
const projCurrentAgent = computed(() => {
  if (!projSelectedAgentId.value) return null
  return agents.value.find(a => a.id === projSelectedAgentId.value) || null
})

// Helper: itera días entre dos YYYY-MM-DD (incluye ambos)
function projEnumerateDays(from, to) {
  const s = toDate(from)
  const e = toDate(to)
  const out = []
  if (!s || !e || e < s) return out
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(ymd(d))
  }
  return out
}
// 👇 Helper: ¿el rango es COMISIÓN y destino GIG / GEO?
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

// Límite máx. 3 departamentos en el draft
function limitDraftDepts() {
  if (!Array.isArray(projDraft.value.depts)) {
    projDraft.value.depts = []
    return
  }
  if (projDraft.value.depts.length > 3) {
    projDraft.value.depts = projDraft.value.depts.slice(0, 3)
  }
}

function toggleDept(dept, checked) {
  if (!Array.isArray(projDraft.value.depts)) {
    projDraft.value.depts = []
  }

  if (checked) {
    // ya estaba marcado → nada
    if (projDraft.value.depts.includes(dept)) return

    // límite de 3
    if (projDraft.value.depts.length >= 3) {
      // opcional: mostrar mensaje
      projMsg.value = 'Solo puedes seleccionar hasta 3 departamentos.'
      projMsgOk.value = false
      return
    }

    projDraft.value.depts = [...projDraft.value.depts, dept]
  } else {
    projDraft.value.depts = projDraft.value.depts.filter(d => d !== dept)
  }
}

// Construye mapa de días -> estado y detecta solapamientos
function projBuildDayMap(ranges) {
  const map = new Map()
  const overlaps = new Set()

  for (const r of ranges) {
    if (!r.from || !r.to || !r.state) continue
    const days = projEnumerateDays(r.from, r.to)
    for (const day of days) {
      if (map.has(day)) {
        overlaps.add(day)
      }
      map.set(day, r.state)
    }
  }
  return { map, overlaps }
}

// Set de días sin estado para el agente actual
const projMissingDaysSet = computed(() => {
  const missing = new Set()
  const id = projSelectedAgentId.value
  if (!id) return missing

  const ranges = projCurrentAgentRanges.value
  if (!ranges.length) return missing

  // Rango real de proyección de ESTE agente (no el global)
  let agentFrom = null
  let agentTo = null
  for (const r of ranges) {
    if (!r.from || !r.to) continue
    if (!agentFrom || r.from < agentFrom) agentFrom = r.from
    if (!agentTo || r.to > agentTo)       agentTo   = r.to
  }
  if (!agentFrom || !agentTo) return missing

  const { map } = projBuildDayMap(ranges)
  const days = projEnumerateDays(agentFrom, agentTo)
  for (const d of days) {
    if (!map.has(d)) missing.add(d)
  }
  return missing
})

// Días de vista previa (horizontal) para agente actual
const projPreviewDays = computed(() => {
  const from = projRange.value.from
  const to = projRange.value.to
  const id = projSelectedAgentId.value
  if (!from || !to || !id) return []

  const { map } = projBuildDayMap(projCurrentAgentRanges.value)
  const days = projEnumerateDays(from, to)
  return days.map(d => {
    const state = map.get(d) || null
    return {
      date: d,
      day: Number(d.slice(8, 10)),
      state,
      title: state ? `${d} — ${state}` : `${d} — sin estado`
    }
  })
})

// Errores de validación (solo UI, antes del guardado)
const projErrors = computed(() => {
  const errors = []

  const from = projRange.value.from
  const to = projRange.value.to
  if (!from || !to) {
    errors.push('Debes definir el rango completo de proyección (desde / hasta).')
    return errors
  }
  const d1 = toDate(from)
  const d2 = toDate(to)
  if (!d1 || !d2 || d2 < d1) {
    errors.push('El rango de proyección es inválido: "hasta" no puede ser menor que "desde".')
    return errors
  }

  // Si hay agente seleccionado, mostraremos errores de huecos/solapes de ese agente
  if (projSelectedAgentId.value) {
    const ranges = projCurrentAgentRanges.value
    const { overlaps } = projBuildDayMap(ranges)
    if (overlaps.size) {
      errors.push('Este funcionario tiene solapamientos de rangos (mismo día con dos estados distintos).')
    }
    if (projMissingDaysSet.value.size) {
      errors.push('Este funcionario tiene días sin estado dentro del rango proyectado.')
    }
  }

  return errors
})

// Puede guardar si:
// - hay rango válido
// - hay al menos un agente en la proyección
// - no hay errores globales (se validarán de nuevo en saveProjection)
const projCanSave = computed(() => {
  const from = projRange.value.from
  const to = projRange.value.to
  if (!from || !to) return false

  // ✅ Debe haber al menos UN funcionario con al menos un rango válido
  const hasAny = agents.value.some(a => {
    const arr = projByAgent.value[a.id] || []
    return arr.some(r => r.from && r.to && r.state)
  })

  return hasAny
})

// Añadir rango para el agente actual
function projAddRangeForCurrent() {
  projDraftError.value = ''
  const id = projSelectedAgentId.value
  if (!id) {
    projDraftError.value = 'Selecciona un funcionario primero.'
    return
  }

  const { from, to, state } = projDraft.value
  if (!from || !to || !state) {
    projDraftError.value = 'Completa fecha inicio, fin y estado.'
    return
  }

  const d1 = toDate(from)
  const d2 = toDate(to)
  if (!d1 || !d2 || d2 < d1) {
    projDraftError.value = 'El rango es inválido: la fecha fin no puede ser menor que la fecha inicio.'
    return
  }

  // Validar que caiga dentro del rango global (si está definido)
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

  // Evitar solapes con rangos ya existentes de ese agente
  for (const r of arr) {
    const r1 = toDate(r.from)
    const r2 = toDate(r.to)
    if (!r1 || !r2) continue
    // solapan si NO se cumple (nuevo antes de todos) ni (nuevo después de todos)
    const noOverlap = (d2 < r1) || (d1 > r2)
    if (!noOverlap) {
      projDraftError.value = `Este rango se solapa con ${r.from} → ${r.to}.`
      return
    }
  }

  // Añadir rango
  arr.push({
    from,
    to,
    state,
    destGroupId: projDraft.value.state === 'COMISIÓN DEL SERVICIO'
      ? Number(projDraft.value.destGroupId) || null
      : null,
    destUnitId: projDraft.value.state === 'COMISIÓN DEL SERVICIO'
      ? Number(projDraft.value.destUnitId) || null
      : null,
    depts:
      isGigGeoDraft(projDraft.value) && Array.isArray(projDraft.value.depts)
        ? projDraft.value.depts.slice(0, 3)    // máx 3
        : []                                   // otros casos sin depts
  })


  // Limpiar formulario
  projDraft.value = { from: '', to: '', state: '', destGroupId: null, destUnitId: null }
}

function onProjDraftStateChange() {
  const s = projDraft.value.state
  if (s === 'COMISIÓN DEL SERVICIO' && projCurrentAgent.value) {
    // Sugerir grupo y unidad actual del funcionario
    projDraft.value.destGroupId = projCurrentAgent.value.groupId || null
    projDraft.value.destUnitId  = projCurrentAgent.value.unitId  || null
  } else {
    // Para otros estados, no forzamos destino
    // (puedes limpiar si quieres)
    // projDraft.value.destGroupId = null
    // projDraft.value.destUnitId  = null
  }
}

// Quitar rango del agente actual
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

  // Pequeña validación de fechas si quieres ser estricto
  if (field === 'from' || field === 'to') {
    const otherField = field === 'from' ? 'to' : 'from'
    const tmp = { ...arr[segIndex], [field]: value }
    const d1 = toDate(tmp.from)
    const d2 = toDate(tmp.to)
    if (d1 && d2 && d2 < d1) {
      projMsg.value = 'La fecha fin no puede ser menor que la fecha inicio en ese rango.'
      projMsgOk.value = false
      return
    }
  }

  arr[segIndex] = {
    ...arr[segIndex],
    [field]: value
  }
}

// Validación completa para TODOS los agentes incluidos antes de guardar
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

  // ✅ Solo validamos a los funcionarios que REALMENTE tienen rangos
  for (const a of agents.value) {
    const arr = (projByAgent.value[a.id] || []).filter(
      r => r.from && r.to && r.state
    )

    if (!arr.length) {
      // Sin rangos para este agente → no es obligatorio proyectarlo
      continue
    }

    const { map, overlaps } = projBuildDayMap(arr)

    if (overlaps.size) {
      problems.push(`El agente ${a.code} tiene días con dos estados distintos en la proyección.`)
    }

    // 🔎 Rango propio de este agente (lo que él sí tiene proyectado)
    let agentFrom = null
    let agentTo = null
    for (const r of arr) {
      if (!agentFrom || r.from < agentFrom) agentFrom = r.from
      if (!agentTo   || r.to   > agentTo)   agentTo   = r.to
    }
    if (!agentFrom || !agentTo) continue

    const missing = []
    const agentDays = projEnumerateDays(agentFrom, agentTo)
    for (const d of agentDays) {
      if (!map.has(d)) missing.push(d)
    }
    if (missing.length) {
      problems.push(
        `El agente ${a.code} tiene días sin estado entre ${agentFrom} y ${agentTo} en su proyección.`
      )
    }
  }

  return problems
}

// --- Timeline de proyección para el agente actual ---
const projTimelineSegments = computed(() => {
  const id = projSelectedAgentId.value
  if (!id) return []

  const arr = projByAgent.value[id] || []
  const out = []

  arr.forEach((r, idx) => {
    if (!r.from || !r.to || !r.state) return
    out.push({
      index: idx,
      state: r.state,
      from: r.from,
      to:   r.to,
      count: projEnumerateDays(r.from, r.to).length,
      destGroupId: r.destGroupId || null,
      destUnitId:  r.destUnitId  || null,
      depts: Array.isArray(r.depts) ? r.depts : []   // 👈 NUEVO
    })
  })

  // Opcional: ordenar por fecha inicio, pero manteniendo index real
  out.sort((a, b) => String(a.from).localeCompare(String(b.from)))

  return out
})

// --- Calendario cuadrado de proyección para el agente actual ---
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

    cells.push({
      key: ymdStr,
      date: ymdStr,
      day: dt.getDate(),
      state,
      isOutside,
      title: state ? `${ymdStr} — ${state}` : `${ymdStr} — sin estado`
    })
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


// Guardar proyección
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

    // 🔑 Agentes “involucrados” en la proyección:
    // - los que ya tenían algo en BD (cargados en projByAgent)
    // - y los que se les agregó al menos un rango nuevo
    const involvedIds = new Set(
      Object.keys(projByAgent.value).map(id => Number(id))
    )

    // Por seguridad: si por alguna razón agregaste rangos a un agente
    // que no estaba en projByAgent, lo incluimos también.
    for (const a of agents.value) {
      const arr = projByAgent.value[a.id] || []
      if (arr.some(r => r.from && r.to && r.state)) {
        involvedIds.add(a.id)
      }
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
          destGroupId: r.state === 'COMISIÓN DEL SERVICIO'
            ? (r.destGroupId || null)
            : null,
          destUnitId: r.state === 'COMISIÓN DEL SERVICIO'
            ? (r.destUnitId || null)
            : null,
          depts:
            Array.isArray(r.depts)
              ? r.depts.slice(0, 3)    // enviamos máx 3
              : []
        }))


      // 🔁 IMPORTANTÍSIMO:
      // - Si segments.length > 0 → guardar/actualizar esos rangos
      // - Si segments.length === 0 → BORRAR proyección en ese rango global
      items.push({
        agentId: agentId,
        segments
      })
    }

    const payload = {
      from: globalFrom,
      to:   globalTo,
      items
    }

    await axios.post('/rest-planning/bulk', payload, {
      headers: {
        Authorization: 'Bearer ' + (localStorage.getItem('token') || '')
      }
    })

    projMsg.value = 'Proyección de descanso guardada correctamente. ✅'
    projMsgOk.value = true
  } catch (err) {
    projMsg.value =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.message ||
      'Error al guardar la proyección.'
    projMsgOk.value = false
  }
}

async function loadRestProjection() {
  if (!restViewer.from || !restViewer.to) return

  restViewer.loading = true
  restViewer.error = ''
  try {
    const { data } = await http.get('/rest-planning', {
      params: {
        from: restViewer.from,
        to:   restViewer.to,
        // Para líder de unidad NO es obligatorio enviar unitId,
        // el backend usa req.user.unitId.
        agentId: restViewer.agentId || undefined
      }
    })

    const map = {}

    for (const r of (data.items || [])) {
      if (!map[r.agentId]) map[r.agentId] = []
      map[r.agentId].push({
        from: r.start_date,   // viene así del backend
        to:   r.end_date,
        state: r.state
      })
    }

    restViewer.byAgent = map
  } catch (err) {
    console.error('Error cargando /rest-planning', err)
    restViewer.error =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      'Error al cargar la proyección de descanso'
  } finally {
    restViewer.loading = false
  }
}

// Quitar un segmento directamente desde la línea de tiempo
function projRemoveSegment(idx) {
  const id = projSelectedAgentId.value
  if (!id) return
  const arr = projByAgent.value[id]
  if (!arr) return
  if (idx < 0 || idx >= arr.length) return
  if (!confirm('¿Quitar este rango de la proyección?')) return
  arr.splice(idx, 1)
}

// ✅ MT: solo dígitos y guiones, opcional, hasta 32 chars
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

// GEO y UNCO pueden seleccionar departamentos
const isDeptUnitDraft = computed(() => {
  const unitId =
    projDraft.value.destUnitId ??
    projDraft.value.unitId ??
    null

  if (!unitId) return false

  const u = units.value.find(x => Number(x.id) === Number(unitId))
  if (!u) return false

  const name = String(u.name || '').toUpperCase()

  return name.includes('GEO') || name.includes('UNCO')
})

</script>

<style scoped>
.fade-enter-active,.fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from,.fade-leave-to { opacity: 0; }
</style>