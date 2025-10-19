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
          <div class="hidden md:flex gap-3">
            <router-link
              to="/perfil"
              class="px-3 py-1.5 rounded-lg text-white/90 hover:text-white border border-white/20 hover:bg-white/10 text-sm"
            >
              Perfil
            </router-link>
            <button
              @click="logout"
              class="px-3 py-1.5 rounded-lg text-white bg-slate-900/40 hover:bg-slate-900/60 text-sm"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Banner de fechas (tu componente) -->
    <FechasBanner top-offset="top-14" color="amber" />

    <!-- CONTENIDO -->
    <main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <!-- Unidad / Grupo -->
      <div v-if="me" class="text-sm text-slate-600">
        <div class="inline-flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
          <span>Unidad: <b class="text-slate-900">{{ me.unitName || '—' }}</b></span>
          <span class="text-slate-300">|</span>
          <span>Grupo: <b class="text-slate-900">{{ me.groupCode || '—' }}</b></span>
        </div>
      </div>

      <!-- Tarjeta principal -->
      <section class="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
        <!-- Header de tarjeta -->
        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 class="text-slate-900 font-semibold">Captura de novedades</h2>
            <p class="text-xs text-slate-500 -mt-0.5">Selecciona la fecha, agrega agentes y define su estado</p>
          </div>
          <div class="flex items-center gap-2">
            <router-link
              to="/perfil"
              class="md:hidden px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
            >Perfil</router-link>
            <button
              @click="logout"
              class="md:hidden px-3 py-1.5 rounded-lg text-white bg-slate-800 hover:bg-slate-900 text-sm"
            >Cerrar sesión</button>
          </div>
        </div>

        <!-- Body -->
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
                    <th class="text-left py-2 px-3 font-semibold">Categoría</th>
                    <th class="text-left py-2 px-3 font-semibold">Estado</th>
                    <th class="text-left py-2 px-3 font-semibold">Ubicación / Detalle</th>
                    <th class="text-left py-2 px-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody class="bg-white">
                  <tr v-for="(a, i) in agents" :key="a.id" class="border-t">
                    <td class="py-2 px-3 align-top">
                      <div class="font-medium text-slate-900">{{ a.code }}</div>
                      <div v-if="a.nickname" class="text-xs text-slate-500 mt-0.5">({{ a.nickname }})</div>
                    </td>
                    <td class="py-2 px-3 align-top">{{ displayCategory(a.category) }}</td>
                    <td class="py-2 px-3 align-top">
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
                    <td class="py-2 px-3 align-top">
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

          <!-- Tarjetas móvil -->
          <div class="block md:hidden space-y-4">
            <div
              v-for="(a, i) in agents"
              :key="a.id"
              class="bg-white border border-slate-200 shadow rounded-xl p-4 flex flex-col gap-2"
            >
              <div class="flex justify-between items-start">
                <div>
                  <div class="font-semibold text-slate-900">
                    {{ a.code }}
                    <span class="font-normal text-xs text-slate-600">({{ displayCategory(a.category) }})</span>
                    <span v-if="a.nickname" class="font-normal text-xs text-slate-500"> — {{ a.nickname }}</span>
                  </div>
                  <div class="text-xs text-slate-500 mt-1">Estado</div>
                </div>
                <button class="text-red-600 text-xs underline" @click="removeAgent(a.id)">Quitar</button>
              </div>

              <select
                class="rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
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

              <!-- Campos dinámicos (móvil) -->
              <div v-if="a.status === 'SIN NOVEDAD'">
                <input class="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 shadow-sm" :value="a.municipalityName || 'CUNDINAMARCA - Bogotá'" readonly />
              </div>

              <div v-else-if="a.status === 'SERVICIO'">
                <input class="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 shadow-sm" :value="a.municipalityName || 'CUNDINAMARCA - Bogotá'" readonly />
                <div class="flex gap-2 mt-2">
                  <input class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200" type="date" v-model="a.novelty_start" :class="{'!border-red-500': agentHasRangeError(a)}" />
                  <input class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200" type="date" v-model="a.novelty_end" :class="{'!border-red-500': agentHasRangeError(a)}" />
                </div>
                <p v-if="agentHasRangeError(a)" class="text-xs text-red-600 mt-1">La fecha fin no puede ser menor a la fecha inicio.</p>
                <textarea class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200 mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
              </div>

              <div v-else-if="a.status === 'COMISIÓN DEL SERVICIO'">
                <input class="w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-2"
                       :class="{
                         'border-green-500 focus:ring-green-200 bg-white': a.municipalityId,
                         'border-red-500 focus:ring-red-200 bg-white': a.municipalityName && !a.municipalityId,
                         'border-slate-300 focus:ring-indigo-200 bg-white': !a.municipalityName
                       }"
                       list="municipios-list"
                       v-model="a.municipalityName"
                       @input="onMuniInput(a)"
                       placeholder="Buscar municipio..."
                       autocomplete="off" />
                <datalist id="municipios-list">
                  <option v-for="m in municipalities" :key="m.id" :value="m.dept + ' - ' + m.name" />
                </datalist>
                <span v-if="a.municipalityName && !a.municipalityId" class="text-red-500 text-xs">Debe seleccionar un municipio válido</span>
                <textarea class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200 mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
              </div>

              <div v-else-if="a.status === 'FRANCO FRANCO'">
                <span class="text-xs text-slate-400">Sin datos adicionales</span>
              </div>

              <div v-else-if="a.status === 'SUSPENDIDO'">
                <div class="flex gap-2 mt-2">
                  <input class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200" type="date" v-model="a.novelty_start" :class="{'!border-red-500': agentHasRangeError(a)}" />
                  <input class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200" type="date" v-model="a.novelty_end" :class="{'!border-red-500': agentHasRangeError(a)}" />
                </div>
                <p v-if="agentHasRangeError(a)" class="text-xs text-red-600 mt-1">La fecha fin no puede ser menor a la fecha inicio.</p>
                <textarea class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200 mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
              </div>

              <div v-else-if="a.status === 'HOSPITALIZADO'">
                <div class="flex gap-2 mt-2">
                  <input class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200" type="date" v-model="a.novelty_start" />
                </div>
                <textarea class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200 mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
              </div>

              <div v-else>
                <div class="flex gap-2 mt-2">
                  <input class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200" type="date" v-model="a.novelty_start" :class="{'!border-red-500': agentHasRangeError(a)}" />
                  <input class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200" type="date" v-model="a.novelty_end" :class="{'!border-red-500': agentHasRangeError(a)}" />
                </div>
                <p v-if="agentHasRangeError(a)" class="text-xs text-red-600 mt-1">La fecha fin no puede ser menor a la fecha inicio.</p>
                <textarea class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:ring-2 focus:ring-indigo-200 mt-2" v-model="a.novelty_description" placeholder="Descripción..." rows="1" />
              </div>
            </div>

            <div v-if="agents.length === 0" class="text-center text-slate-500 py-4">Sin agentes en tu Unidad.</div>
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
  </div>
</template>