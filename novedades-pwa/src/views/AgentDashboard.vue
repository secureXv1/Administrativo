<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Hero superior -->
    <div class="bg-gradient-to-r from-slate-800 to-slate-700">
      <div class="max-w-6xl mx-auto px-4 py-8">
        <h1 class="text-white text-2xl font-semibold">Panel del agente</h1>
        <p class="text-slate-300 text-sm mt-1">Tu cuenta y operaciones diarias</p>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-4 -mt-6 pb-10">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <!-- SIDEBAR -->
        <aside class="md:col-span-3">
          <div class="bg-white rounded-2xl shadow p-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full bg-slate-100 grid place-content-center">
                <svg class="w-6 h-6 text-slate-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </div>
              <div class="min-w-0">
                <div class="text-slate-900 font-medium truncate">{{ me?.name || 'Agente' }}</div>
                <div class="text-xs text-slate-500 truncate">{{ me?.email || '—' }}</div>
              </div>
            </div>
            <button
              @click="logout"
              class="mt-3 w-full px-3 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
            >
              Cerrar sesión
            </button>
          </div>

          <nav class="mt-4 bg-white rounded-2xl shadow p-2">
            <button
              v-for="item in menu"
              :key="item.key"
              @click="section=item.key"
              class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm"
              :class="section===item.key
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50'"
            >
              <span class="truncate">{{ item.label }}</span>
              <svg v-if="section===item.key" class="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </nav>
        </aside>

        <!-- CONTENT -->
        <section class="md:col-span-9 space-y-6">
          <!-- Encabezado local + breadcrumb -->
          <div class="bg-white rounded-2xl shadow p-4 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-500">Inicio / <span class="capitalize">{{ section }}</span></div>
              <h2 class="text-slate-900 font-semibold text-lg mt-0.5">
                {{ titleBySection }}
              </h2>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="section==='vehiculos'"
                class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                @click="loadMyActiveAssignments"
                :disabled="loadingAssignments"
              >
                {{ loadingAssignments ? 'Actualizando…' : 'Actualizar' }}
              </button>
              <button
                v-if="section==='novedades'"
                class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                @click="loadDailyHistory"
                :disabled="dailyHistoryLoading"
              >
                {{ dailyHistoryLoading ? 'Cargando…' : 'Actualizar' }}
              </button>
            </div>
          </div>

          <!-- ================= MIS NOVEDADES (historial solo visual) ================= -->
          <!-- Calendario + Línea de tiempo -->
          <div v-show="section==='novedades'" class="bg-white rounded-2xl shadow">
            <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <h3 class="font-semibold text-slate-900">Calendario y línea de tiempo</h3>
            </div>

            <div class="p-4 space-y-4">
              <!-- Controles -->
              <div class="flex flex-wrap items-center gap-2">
                <button class="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                        @click="prevMonth">◀</button>
                <button class="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                        @click="todayMonth">Hoy</button>
                <button class="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                        @click="nextMonth">▶</button>

                <span class="ml-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs bg-slate-100 text-slate-700 border border-slate-200">
                  {{ monthLabel }}
                </span>
                <span class="ml-auto text-xs text-slate-500">Rango: {{ monthFrom }} → {{ monthTo }}</span>
              </div>

              <div class="grid md:grid-cols-2 gap-4">
                <!-- Calendario -->
                <div>
                  <div class="grid grid-cols-7 gap-2 text-xs font-medium text-slate-600 mb-1">
                    <div class="text-center">L</div><div class="text-center">M</div><div class="text-center">X</div>
                    <div class="text-center">J</div><div class="text-center">V</div><div class="text-center">S</div>
                    <div class="text-center">D</div>
                  </div>

                  <div class="grid grid-cols-7 gap-2">
                    <div v-for="cell in calendarCells" :key="cell.key" :title="cell.title"
                        class="h-20 rounded-xl p-2 flex flex-col transition border hover:shadow-sm hover:-translate-y-[1px]"
                        :class="[
                          cell.state ? (colorClass(cell.state)?.bg || 'bg-slate-100') : 'bg-white',
                          cell.isToday && 'ring-2 ring-blue-500/70',
                          !cell.state && 'border-slate-200',
                          cell.state && 'border-transparent'
                        ]">
                      <div class="text-[11px] font-medium opacity-60">{{ cell.day || '' }}</div>
                      <div class="mt-auto text-center text-lg leading-none" v-if="cell.state">{{ iconFor(cell.state) }}</div>
                      <div v-if="cell.state" class="text-[11px] text-center truncate mt-1 opacity-85">{{ shortState(cell.state) }}</div>
                    </div>
                  </div>
                </div>

                <!-- Línea de tiempo -->
                <div class="space-y-3 relative">
                  <div class="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-slate-200" />
                  <div v-for="(s, i) in segments" :key="i" class="flex items-center gap-3 pl-4">
                    <div class="w-3 h-3 rounded-full border-2 border-white shadow ring-1 ring-slate-200"
                        :class="colorClass(s.state)?.dot || 'bg-slate-400'"></div>
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs"
                        :class="colorClass(s.state)?.pill || 'bg-slate-100 text-slate-700'">
                      {{ iconFor(s.state) }}
                      <span>{{ s.state }}</span>
                      <span v-if="s.municipalityName" class="opacity-70">• {{ s.municipalityName }}</span>
                      <span class="opacity-70">({{ s.from }} → {{ s.to }})</span>
                      <span class="opacity-70">x{{ s.count }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Leyenda -->
              <div class="pt-2 flex flex-wrap gap-2 text-xs">
                <span v-for="st in legendStates" :key="st" class="inline-flex items-center gap-1 px-2 py-1 rounded-full"
                      :class="colorClass(st)?.pill">
                  {{ iconFor(st) }} <span>{{ st }}</span>
                </span>
              </div>
            </div>
          </div>
          <!-- ================= VEHÍCULOS (tu flujo tal cual) ================= -->
          <div v-show="section==='vehiculos'" class="space-y-6">
            <!-- Mis asignaciones vigentes -->
            <section class="bg-white rounded-2xl shadow">
              <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                <h3 class="font-semibold text-slate-900">Mis asignaciones vigentes</h3>
              </div>
              <div class="p-4">
                <div v-if="loadingAssignments" class="text-sm text-slate-500">Cargando asignaciones…</div>
                <div v-else-if="!myAssignments.length" class="text-sm text-slate-500">No tienes asignaciones vigentes.</div>
                <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
                  <table class="min-w-full text-sm">
                    <thead class="bg-slate-800 text-white">
                      <tr>
                        <th class="text-left py-2 px-3 font-semibold">Vehículo</th>
                        <th class="text-left py-2 px-3 font-semibold">Inicio</th>
                        <th class="text-left py-2 px-3 font-semibold">Km inicio</th>
                        <th class="text-left py-2 px-3 font-semibold">Nota</th>
                        <th class="text-left py-2 px-3 font-semibold">Aceptación</th> <!-- NUEVO -->
                        <th class="text-left py-2 px-3 font-semibold"></th>           <!-- Acciones -->
                      </tr>
                    </thead>
                    <tbody class="bg-white">
                      <tr v-for="row in myAssignments" :key="row.id" class="border-t">
                        <td class="py-2 px-3 font-medium">{{ row.vehicle.code }}</td>
                        <td class="py-2 px-3">{{ row.start_date }}</td>
                        <td class="py-2 px-3">{{ row.odometer_start ?? '—' }}</td>
                        <td class="py-2 px-3">{{ row.notes || '—' }}</td>

                        <td class="py-2 px-3">
                          <div v-if="row.agent_ack_at">
                            <span class="text-emerald-700 text-xs font-medium">Aceptada</span>
                            <div class="text-xs text-slate-600">
                              {{ row.agent_ack_note || '—' }}
                            </div>
                          </div>
                          <div v-else>
                            <span class="text-amber-600 text-xs font-medium">Pendiente</span>
                          </div>
                        </td>

                        <td class="py-2 px-3">
                          <button
                            v-if="!row.agent_ack_at"
                            class="px-3 py-1.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 text-sm"
                            @click="openAccept(row)"
                          >
                            Aceptar
                          </button>
                          <button
                            v-else-if="row.agent_ack_at && !row.agent_ack_extra_at"
                            class="px-3 py-1.5 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 text-sm"
                            @click="openAckExtraModal(row)"
                          >
                            Nota extra
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
            <!-- ================= MIS USOS VIGENTES (nuevo bloque) ================= -->
            <section class="bg-white rounded-2xl shadow">
              <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl flex items-center justify-between">
                <h3 class="font-semibold text-slate-900">Mis usos vigentes</h3>
                <button
                  class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                  @click="loadMyOpenUses" :disabled="loadingOpenUses"
                >
                  {{ loadingOpenUses ? 'Actualizando…' : 'Actualizar' }}
                </button>
              </div>
              <div class="p-4">
                <div v-if="loadingOpenUses" class="text-sm text-slate-500">Cargando usos…</div>
                <div v-else-if="!myOpenUses.length" class="text-sm text-slate-500">No tienes usos abiertos.</div>
                <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
                  <table class="min-w-full text-sm">
                    <thead class="bg-slate-800 text-white">
                      <tr>
                        <th class="text-left py-2 px-3 font-semibold">Vehículo</th>
                        <th class="text-left py-2 px-3 font-semibold">Inicio</th>
                        <th class="text-left py-2 px-3 font-semibold">Km salida</th>
                        <th class="text-left py-2 px-3 font-semibold">Nota</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white">
                      <tr v-for="u in myOpenUses" :key="u.id" class="border-t">
                        <td class="py-2 px-3 font-medium">
                          {{ u.vehicle?.code }}
                        </td>
                        <td class="py-2 px-3">{{ u.started_at }}</td>
                        <td class="py-2 px-3">{{ u.odometer_start ?? '—' }}</td>
                        <td class="py-2 px-3">{{ u.notes?.trim() || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>


            <!-- Buscar vehículo e iniciar/cerrar uso -->
            <section class="bg-white rounded-2xl shadow">
              <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                <h3 class="font-semibold text-slate-900">Iniciar / cerrar uso</h3>
              </div>
              <div class="p-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div class="md:col-span-2">
                    <label class="text-xs font-medium text-slate-600 mb-1 block">Buscar vehículo (código o sigla)</label>
                    <div class="relative">
                      <input
                        v-model="vehicleQuery"
                        @input="searchVehicles"
                        class="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Escribe código del vehículo (ej: 06-004)"
                        autocomplete="off"
                      />
                      <div
                        v-if="vehicleResultsVisible"
                        class="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow max-h-64 overflow-auto"
                        @mouseleave="hideDropdownSoon"
                      >
                        <button
                          v-for="v in vehicleResults"
                          :key="v.id"
                          class="w-full text-left px-3 py-2 hover:bg-slate-50"
                          @click="pickVehicle(v)"
                        >
                          <div class="font-medium text-sm">{{ v.code }}</div>
                          <div class="text-[11px] text-slate-500">Grupo: {{ v.groupName || '—' }} · Unidad: {{ v.unitName || '—' }}</div>
                        </button>
                        <div v-if="!vehicleResults.length" class="px-3 py-2 text-sm text-slate-500">Sin resultados…</div>
                      </div>
                    </div>
                  </div>

                  <div class="md:col-span-1">
                    <label class="text-xs font-medium text-slate-600 mb-1 block">Seleccionado</label>
                    <div class="h-[42px] px-3 rounded-lg border flex items-center text-sm bg-slate-50">
                      <span v-if="selectedVehicle">{{ selectedVehicle.code }}</span>
                      <span v-else class="text-slate-400">Ninguno</span>
                    </div>
                  </div>
                </div>

                <div v-if="selectedVehicle" class="mt-4 border-t pt-3">
                  <div class="flex flex-col md:flex-row md:items-end gap-3">
                    <div class="flex-1">
                      <label class="text-xs font-medium text-slate-600 mb-1 block">Odómetro inicial</label>
                      <input
                        type="number"
                        v-model="form.odometer_start"
                        class="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        :placeholder="lastOdoHint != null ? `Sugerido: ${lastOdoHint}` : 'Odómetro inicial'"
                        :disabled="!!openUseId"
                      />
                      <p v-if="lastOdoHint != null" class="text-[11px] text-slate-500 mt-1">
                        Último odómetro final registrado: <span class="font-medium">{{ lastOdoHint }}</span>
                      </p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        class="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                        @click="startUse"
                        :disabled="starting || !!openUseId"
                        v-if="!openUseId"
                      >
                        {{ starting ? 'Iniciando…' : 'Iniciar uso' }}
                      </button>
                      <button
                        class="px-3 py-2 rounded-md text-white font-semibold bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition"
                        @click="endUse"
                        :disabled="ending || !openUseId"
                        v-else
                      >
                        {{ ending ? 'Cerrando…' : 'Cerrar uso' }}
                      </button>
                    </div>
                  </div>

                  <!-- Novedades del uso abierto -->
                  <div v-if="openUseInfo" class="mt-3 text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div class="font-medium mb-1">Tienes un uso abierto para este vehículo.</div>
                    <div>Inicio: <strong>{{ openUseInfo.started_at }}</strong></div>
                    <div>Odómetro salida: <strong>{{ openUseInfo.odometer_start ?? '—' }}</strong></div>

                    <div v-if="openUseNovedades.length" class="mt-2">
                      <b>Novedades de este uso:</b>
                      <ul class="list-disc pl-6 text-xs mt-1">
                        <li v-for="n in openUseNovedades" :key="n.id">
                          {{ n.description }}
                          <a v-if="n.photoUrl" :href="`/${n.photoUrl}`" target="_blank" class="text-blue-600 underline ml-1">foto</a>
                          <span class="text-slate-400 ml-2">{{ n.created_at }}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- Novedades previas (sin uso abierto) -->
                <div v-if="selectedVehicle && !openUseId" class="mt-6 bg-slate-50 rounded-xl p-3 border">
                  <div class="flex items-center justify-between mb-2">
                    <h3 class="font-medium">Novedades recientes</h3>
                    <button
                      class="px-2 py-1 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                      @click="loadStagingNovedades"
                    >Actualizar</button>
                  </div>
                  <div v-if="loadingNovedades" class="text-xs text-slate-400">Cargando novedades…</div>
                  <div v-else>
                    <div v-if="!novedadesStaging.length" class="text-xs text-slate-400">No hay novedades registradas aún.</div>
                    <div v-for="n in novedadesStaging" :key="n.id" class="text-xs border-b py-1 flex items-center justify-between">
                      <div>
                        • {{ n.description }}
                        <a v-if="n.photoUrl" :href="`/${n.photoUrl}`" target="_blank" class="text-blue-600 underline ml-1">foto</a>
                        <span class="text-slate-400 ml-2">{{ n.created_at }}</span>
                      </div>
                      <button class="text-red-600 hover:text-red-800 font-medium text-[11px]" @click="deleteNovedad(n.id)">
                        Eliminar
                      </button>
                    </div>
                    <div class="mt-2 flex gap-2">
                      <input v-model="newNovedad.description"
                             class="flex-1 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                             placeholder="Descripción de novedad" maxlength="500" />
                      <input type="file" @change="onPhoto" accept="image/*"
                             class="rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32" />
                      <button class="px-3 py-1.5 text-xs rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                              @click="addNovedad">
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Historial de usos -->
            <section v-if="selectedVehicle" class="bg-white rounded-2xl shadow">
              <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                <h3 class="font-semibold text-slate-900">Mis usos de este vehículo</h3>
              </div>
              <div class="p-4">
                <div class="overflow-x-auto rounded-xl border border-slate-200">
                  <table class="min-w-full text-sm">
                    <thead class="bg-slate-800 text-white">
                      <tr>
                        <th class="text-left py-2 px-3 font-semibold">#</th>
                        <th class="text-left py-2 px-3 font-semibold">Inicio</th>
                        <th class="text-left py-2 px-3 font-semibold">Fin</th>
                        <th class="text-left py-2 px-3 font-semibold">Km salida</th>
                        <th class="text-left py-2 px-3 font-semibold">Km entrada</th>
                        <th class="text-left py-2 px-3 font-semibold">Notas</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white">
                      <tr v-for="u in uses" :key="u.id" class="border-t">
                        <td class="py-2 px-3">#{{ u.id }}</td>
                        <td class="py-2 px-3">{{ u.started_at }}</td>
                        <td class="py-2 px-3">{{ u.ended_at || '—' }}</td>
                        <td class="py-2 px-3">{{ u.odometer_start ?? '—' }}</td>
                        <td class="py-2 px-3">{{ u.odometer_end ?? '—' }}</td>
                        <td class="py-2 px-3">{{ u.notes || '—' }}</td>
                      </tr>
                      <tr v-if="!loadingUses && !uses.length">
                        <td colspan="6" class="py-6 text-center text-slate-500">Sin usos</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-if="loadingUses" class="text-sm text-slate-500 mt-2">Cargando…</div>
              </div>
            </section>
          </div>

          <!-- ================= SERVICIOS ================= -->
          <div v-show="section==='servicios'" class="space-y-6">
            <div class="bg-white rounded-2xl shadow p-4">
              <h3 class="font-semibold text-slate-900">Servicios</h3>
              <p class="text-sm text-slate-500">En desarrollo…</p>
            </div>
          </div>

          <!-- ================= PERFIL (en la misma vista) ================= -->
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

                <p v-if="pwdMsg" class="text-sm mt-2" :class="pwdMsgOk ? 'text-emerald-700' : 'text-rose-700'">
                  {{ pwdMsg }}
                </p>
              </form>
            </div>
          </div>

        </section>
      </div>
    </div>
  </div>
  <!-- al final del template -->
  <div v-if="showAccept" class="fixed inset-0 bg-black/40 z-50 grid place-items-center">
    <div class="bg-white rounded-2xl p-6 w-[96vw] max-w-md relative">
      <button class="absolute top-2 right-2 text-xl text-slate-500" @click="closeAccept">&times;</button>
      <h3 class="font-semibold text-lg mb-3">Aceptar asignación</h3>
      <p class="text-sm text-slate-600 mb-3">
        Confirma la aceptación de la asignación y registra una nota (solo se puede enviar una vez).
      </p>

      <div>
        <label class="label">Nota (obligatoria, máx. 300)</label>
        <textarea v-model="acceptNote" class="input w-full" rows="4" maxlength="300" />
        <p class="text-xs text-slate-500 mt-1">{{ (acceptNote||'').length }}/300</p>
        <p v-if="acceptErr" class="text-sm text-rose-600 mt-2">{{ acceptErr }}</p>
      </div>

      <div class="flex gap-3 pt-3">
        <button class="btn-secondary flex-1" @click="closeAccept" :disabled="accepting">Cancelar</button>
        <button class="btn-primary flex-1" @click="submitAccept" :disabled="accepting || !(acceptNote||'').trim()">
          {{ accepting ? 'Enviando…' : 'Aceptar' }}
        </button>
      </div>
    </div>
  </div>
  <!-- Modal Nota Extra -->
  <div v-if="showAckExtra" class="fixed inset-0 bg-black/40 z-50 grid place-items-center">
    <div class="bg-white rounded-2xl p-6 w-[96vw] max-w-md relative">
      <button class="absolute top-2 right-2 text-xl text-slate-500" @click="closeAckExtra">&times;</button>
      <h3 class="font-semibold text-lg mb-3">Agregar nota extra</h3>
      <p class="text-sm text-slate-600 mb-3">
        Puedes dejar una nota complementaria una única vez después de aceptar la asignación.
      </p>

      <div>
        <label class="label">Nota extra (obligatoria, máx. 500)</label>
        <textarea v-model="ackExtraNote" class="input w-full" rows="4" maxlength="500" />
        <p class="text-xs text-slate-500 mt-1">{{ (ackExtraNote||'').length }}/500</p>
        <p v-if="ackExtraErr" class="text-sm text-rose-600 mt-2">{{ ackExtraErr }}</p>
      </div>

      <div class="flex gap-3 pt-3">
        <button class="btn-secondary flex-1" @click="closeAckExtra" :disabled="sendingAckExtra">Cancelar</button>
        <button class="btn-primary flex-1" @click="submitAckExtra" :disabled="sendingAckExtra || !(ackExtraNote||'').trim()">
          {{ sendingAckExtra ? 'Enviando…' : 'Guardar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import axios from 'axios'
const api = axios.create({ baseURL: '/', timeout: 20000 })
api.interceptors.request.use((config) => {
  const t = localStorage.getItem('token')
  if (t) config.headers.Authorization = 'Bearer ' + t
  return config
})
api.interceptors.response.use((r)=>r,(err)=>{
  const msg = err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Network error'
  console.error('[API /login]', err?.config?.method?.toUpperCase(), err?.config?.url, msg)
  return Promise.reject(err)
})

// helpers simples
const apiGet    = (p,o)   => api.get(p,o)
const apiPost   = (p,b,o) => api.post(p,b,o)
const apiPatch  = (p,b,o) => api.patch(p,b,o)
const apiDelete = (p,o)   => api.delete(p,o)

// Cliente dedicado a /login
const httpLogin = axios.create({ baseURL: '/login', timeout: 20000 })
httpLogin.interceptors.request.use((config) => {
  const t = localStorage.getItem('token')
  if (t) config.headers.Authorization = 'Bearer ' + t
  return config
})
httpLogin.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.message || 'Network error'
    console.error('[HTTP /login]', err?.config?.method?.toUpperCase(), err?.config?.url, msg)
    return Promise.reject(err)
  }
)

/**
 * Prefer /login y si:
 *  - status === 404
 *  - o la respuesta NO parece JSON (content-type text/html, etc)
 * entonces cae al raíz (http).
 */
async function preferLoginThenRoot(method, path, bodyOrOpts, maybeOpts){
  const call = async (client, m, p, b, o) =>
    client[m](p, ...(m==='get'||m==='delete' ? [o] : [b, o]))

  const [body, opts] = (method==='get'||method==='delete')
    ? [null, bodyOrOpts]
    : [bodyOrOpts, maybeOpts]

  try {
    const res = await call(httpLogin, method, path, body, opts)
    const ct = String(res?.headers?.['content-type'] || '')
    const looksJson = ct.includes('application/json') || typeof res?.data === 'object'
    if (!looksJson) {
      // fuerza fallback si nos devolvieron HTML del SPA
      throw { __forceFallback: true }
    }
    return res
  } catch (e){
    if (e?.response?.status === 404 || e?.__forceFallback) {
      try {
        const resRoot = await call(http, method, path, body, opts)
        return resRoot
      } catch (eroot) {
        // 2) si raíz también dice "base URL = /login/", reintenta explícitamente en /login
        const hint = String(eroot?.response?.data || '')
        if (eroot?.response?.status === 404 && hint.includes('/login/')) {
          return await call(httpLogin, method, path, body, opts)
        }
        throw eroot
      }
    }
    throw e
  }
}
// === Helpers "login-only" (NO fallback) ===
/* ===== Sidebar / navegación ===== */
const section = ref('novedades') // 'novedades' | 'vehiculos' | 'servicios'
const menu = [
  { key: 'novedades', label: 'Mis novedades' },
  { key: 'vehiculos', label: 'Vehículos' },
  { key: 'servicios', label: 'Servicios' },
  { key: 'perfil',    label: 'Perfil' },
]
const titleBySection = computed(() => ({
  novedades: 'Mis novedades — Historial',
  vehiculos: 'Gestión de vehículos',
  servicios: 'Servicios',
  perfil:    'Perfil',
}[section.value]))

/* ===== Usuario ===== */
const me = ref(null)
async function loadMe(){
  const { data } = await apiGet('/me')
  me.value = data
  console.debug('[AgentDashboard] /me =>', JSON.stringify(data))
}

function logout(){ 
  localStorage.removeItem('token');
  localStorage.removeItem('AGENT_ID');
  window.location.href='/login/';
 }

/* ===== Vehículos (tu lógica tal cual) ===== */
const vehicleQuery = ref('')
const vehicleResults = ref([])
const vehicleResultsVisible = ref(false)
const selectedVehicle = ref(null)
const myOpenUses = ref([])           
const loadingOpenUses = ref(false)

const lastOdoHint = ref(null)
const openUseId = ref(null)
const openUseInfo = ref(null)

const form = ref({ odometer_start: '' })
const starting = ref(false)
const ending = ref(false)

const myAssignments = ref([])
const loadingAssignments = ref(false)

const uses = ref([])
const loadingUses = ref(false)

const novedadesStaging = ref([])
const loadingNovedades = ref(false)
const newNovedad = ref({ description: '', file: null })

const openUseNovedades = ref([])

const showAccept   = ref(false)
const acceptItem   = ref(null)
const acceptNote   = ref('')
const acceptErr    = ref('')
const accepting    = ref(false)
const agentResolveMsg = ref('') // Mensaje visible si no hay vínculo user↔agent

function openAccept(row){
  acceptItem.value = row
  acceptNote.value = ''
  acceptErr.value = ''
  showAccept.value = true
}
function closeAccept(){
  showAccept.value = false
  acceptItem.value = null
  acceptNote.value = ''
  acceptErr.value = ''
}

async function submitAccept(){
  acceptErr.value = ''
  const note = (acceptNote.value || '').trim()
  if (!note) { acceptErr.value = 'La nota es obligatoria.'; return }
  if (note.length > 300) { acceptErr.value = 'Máximo 300 caracteres.'; return }
  if (!acceptItem.value?.id) { acceptErr.value = 'Asignación inválida.'; return }

  accepting.value = true
  try {
    // ⬇️ NUEVA RUTA /ack
    await apiPatch(`/vehicles/assignments/${acceptItem.value.id}/accept`, { note })
    showAccept.value = false
    await loadMyActiveAssignments()
  } catch (e) {
    acceptErr.value = e?.response?.data?.error || e?.message || 'No se pudo aceptar la asignación.'
  } finally {
    accepting.value = false
  }
}

const showAckExtra   = ref(false)
const ackExtraItem   = ref(null)
const ackExtraNote   = ref('')
const ackExtraErr    = ref('')
const sendingAckExtra = ref(false)

function openAckExtraModal(row){
  ackExtraItem.value = row
  ackExtraNote.value = ''
  ackExtraErr.value = ''
  showAckExtra.value = true
}
function closeAckExtra(){
  showAckExtra.value = false
  ackExtraItem.value = null
  ackExtraNote.value = ''
  ackExtraErr.value = ''
}

async function submitAckExtra(){
  ackExtraErr.value = ''
  const note = (ackExtraNote.value || '').trim()
  if (!note) { ackExtraErr.value = 'La nota extra es obligatoria.'; return }
  if (note.length > 500) { ackExtraErr.value = 'Máximo 500 caracteres.'; return }
  if (!ackExtraItem.value?.id) { ackExtraErr.value = 'Asignación inválida.'; return }

  sendingAckExtra.value = true
  try {
    // ⬇️ NUEVA RUTA /extra
    await apiPatch(`/vehicles/assignments/${ackExtraItem.value.id}/extra`, { note })
    showAckExtra.value = false
    await loadMyActiveAssignments()
  } catch (e) {
    ackExtraErr.value = e?.response?.data?.error || e?.message || 'No se pudo guardar la nota extra.'
  } finally {
    sendingAckExtra.value = false
  }
}


function hideDropdownSoon(){ setTimeout(()=>vehicleResultsVisible.value=false,150) }
function onPhoto(e){ newNovedad.value.file = e.target.files?.[0] || null }

async function addNovedad(){
  if (!selectedVehicle.value || !newNovedad.value.description) return
  const fd = new FormData()
  fd.append('description', newNovedad.value.description)
  if (newNovedad.value.file) fd.append('photo', newNovedad.value.file)
  await apiPost(`/vehicles/vehicle/${selectedVehicle.value.id}/novelties`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  newNovedad.value = { description: '', file: null }
  await loadStagingNovedades()
}

async function deleteNovedad(id){ await apiDelete(`/vehicles/novelties/${id}`); await loadStagingNovedades() }

async function loadStagingNovedades(){
  novedadesStaging.value = []
  if (!selectedVehicle.value) return
  loadingNovedades.value = true
  try {
    const { data } = await apiGet(`/vehicles/${selectedVehicle.value.id}/novelties/recent`)
    novedadesStaging.value = data.items || []
  } finally { loadingNovedades.value = false }
}

async function loadOpenUseNovedades(){
  openUseNovedades.value = []
  if (!openUseInfo.value) return
  const { data } = await apiGet(`/vehicles/uses/${openUseInfo.value.id}/novelties`)
  openUseNovedades.value = data.items || []
}

async function loadMyActiveAssignments () {
  loadingAssignments.value = true
  try {
    // 👇 Asegura agentId aquí
    await ensureAgentId()
    const agentIdVal = meAgentId.value
    if (!agentIdVal) { myAssignments.value = []; return }

    const normalizeAssignment = (a, vehicleData = null) => {
      const endRaw = a.end_date ?? a.endDate ?? a.ended_at ?? a.endedAt ?? a.end ?? null
      const isOpen = (
        endRaw == null ||
        endRaw === '' ||
        endRaw === false ||
        endRaw === 0 ||
        (typeof endRaw === 'string' && (endRaw.trim()==='' || endRaw.trim().toLowerCase()==='null' || endRaw.startsWith('0000-00-00')))
      )
      return {
        id: a.id,
        start_date: a.start_date ?? a.startDate ?? '',
        odometer_start: a.odometer_start ?? a.odometerStart ?? null,
        notes: a.notes ?? a.note ?? '',
        agent_ack_at: a.accept_at ?? a.agent_ack_at ?? null,
        agent_ack_note: a.accept_note ?? a.agent_ack_note ?? null,
        agent_ack_extra_note: a.agent_ack_extra_note ?? null,
        agent_ack_extra_at: a.agent_ack_extra_at ?? null,
        vehicle: vehicleData || { id: a.vehicle_id ?? a.vehicleId ?? null, code: a.vehicle_code ?? a.code ?? '' },
        isOpen
      }
    }

    // Opción A: /agents/:id/assignments
    try {
      const { data } = await apiGet(`/agents/${agentIdVal}/assignments`, { params: { active: 1, pageSize: 500 } })
      const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
      if (list.length) {
        myAssignments.value = list.map(a => normalizeAssignment(a, a.vehicle)).filter(a => a.isOpen)
          .sort((a,b) => (b.start_date || '').localeCompare(a.start_date || ''))
        return
      }
    } catch {}

    // Opción B: recorrer vehículos asignados (acotado)
    const { data: vehsRes } = await apiGet('/vehicles', { params: { pageSize: 500, onlyAssigned: 1 } })
    const vehicles = Array.isArray(vehsRes?.items) ? vehsRes.items : []
    const out = []
    await Promise.all(vehicles.map(async v => {
      try {
        const { data: asgRes } = await apiGet(`/vehicles/${v.id}/assignments`, { params: { pageSize: 200 } })
        const list = Array.isArray(asgRes?.items) ? asgRes.items : (Array.isArray(asgRes) ? asgRes : [])
        for (const a of list) {
          const aAgent = a.agent_id ?? a.agentId ?? a.agent?.id
          if (String(aAgent) === String(agentIdVal)) {
            const item = normalizeAssignment(a, { id: v.id, code: v.code })
            if (item.isOpen) out.push(item)
          }
        }
      } catch {}
    }))
    out.sort((a,b) => (b.start_date || '').localeCompare(a.start_date || ''))
    myAssignments.value = out
  } finally {
    loadingAssignments.value = false
  }
}

async function loadMyOpenUses() {
  loadingOpenUses.value = true
  try {
    await ensureAgentId()
    const agentIdVal = meAgentId.value
    if (!agentIdVal) { myOpenUses.value = []; return }

    // Opción A: endpoint directo
    try {
      const { data } = await apiGet('/vehicles/uses', { params: { agent_id: agentIdVal, open: 1, pageSize: 500 } })
      const items = data?.items ?? data ?? []
      if (Array.isArray(items)) { myOpenUses.value = items.map(mapUseRow); return }
    } catch {}

    // Fallback por vehículo
    const { data: vehs } = await apiGet('/vehicles', { params: { pageSize: 500 } })
    const vehicles = vehs?.items ?? []
    const out = []
    await Promise.all(vehicles.map(async v => {
      try {
        const { data: usesRes } = await apiGet('/vehicles/uses', {
          params: { vehicle_id: v.id, agent_id: agentIdVal, open: 1, pageSize: 200 }
        })
        const list = usesRes?.items ?? usesRes ?? []
        list.forEach(u => out.push(mapUseRow(u, v)))
      } catch {}
    }))
    myOpenUses.value = out
  } finally {
    loadingOpenUses.value = false
  }
}

// Normaliza un registro de uso a las columnas que mostramos
function mapUseRow(u, vehOpt) {
  const started = u.started_at ?? u.startedAt ?? u.start_date ?? u.startDate ?? u.start ?? ''
  const odoStart = u.odometer_start ?? u.odometerStart ?? u.km_salida ?? u.kmStart ?? null
  const notes = u.notes ?? u.note ?? u.observation ?? ''
  const v = u.vehicle || vehOpt || {}
  const vCode = v.code ?? u.vehicle_code ?? ''
  const vId = v.id ?? u.vehicle_id
  return {
    id: u.id,
    started_at: started,
    odometer_start: odoStart,
    notes,
    vehicle: { id: vId, code: vCode }
  }
}

let searchTimer = null
function searchVehicles(){
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    const q = vehicleQuery.value.trim()
    if (!q){ vehicleResults.value = []; vehicleResultsVisible.value = false; return }
    const { data } = await apiGet('/vehicles', { params: { query: q, pageSize: 20 } })
    vehicleResults.value = data.items || []
    vehicleResultsVisible.value = true
  }, 220)
}

async function pickVehicle(v){
  selectedVehicle.value = v
  vehicleQuery.value = `${v.code}`
  vehicleResultsVisible.value = false
  await afterSelectVehicle()
}

async function afterSelectVehicle(){
  await Promise.all([
    loadLastAssignOdometer(),
    checkOpenUse(),
    loadUsesForSelected(),
    loadStagingNovedades(),
    loadOpenUseNovedades()
  ])
}

async function loadLastAssignOdometer(){
  lastOdoHint.value = null
  if (!selectedVehicle.value) return
  try {
    const { data } = await apiGet(`/vehicles/${selectedVehicle.value.id}/last-assignment-odometer`)
    lastOdoHint.value = data?.lastOdometer ?? null
    if (!form.value.odometer_start && lastOdoHint.value != null) {
      form.value.odometer_start = String(lastOdoHint.value)
    }
  } catch {}
}

async function checkOpenUse(){
  await ensureAgentId()
  openUseId.value = null; openUseInfo.value = null
  if (!selectedVehicle.value || !meAgentId.value) return
  const { data } = await apiGet('/vehicles/uses', { params: { vehicle_id: selectedVehicle.value.id, agent_id: meAgentId.value, open: 1 } })
  const list = data.items || []
  if (list.length){ openUseId.value = list[0].id; openUseInfo.value = list[0]; await loadOpenUseNovedades() }
  else { openUseNovedades.value = [] }
}

async function loadUsesForSelected(){
  loadingUses.value = true
  try {
    await ensureAgentId()
    if (!selectedVehicle.value || !meAgentId.value) return
    const { data } = await apiGet('/vehicles/uses', { params: { vehicle_id: selectedVehicle.value.id, agent_id: meAgentId.value } })
    uses.value = data.items || []
  } finally { loadingUses.value = false }
}

async function startUse(){
  if (!selectedVehicle.value) return
  if (openUseId.value) return alert('Ya hay un uso abierto para este vehículo.')
  await ensureAgentId()
  if (!meAgentId.value) { agentResolveMsg.value ||= 'No se pudo determinar tu agente. Informa al administrador.'; return }

  starting.value = true
  try {
    await apiPost('/vehicles/uses/start', {
      vehicle_id: selectedVehicle.value.id,
      agent_id: meAgentId.value,
      odometer_start: form.value.odometer_start || null
    })
    await Promise.all([checkOpenUse(), loadUsesForSelected(), loadStagingNovedades()])
    alert('Uso iniciado correctamente.')
  } catch (e) {
    alert(e?.response?.data?.error || 'Error al iniciar uso')
  } finally {
    starting.value = false
  }
}

async function endUse(){
  if (!openUseId.value) return
  const od = prompt('Odómetro final (opcional, deja vacío si no aplica):', '')
  let odNum = null
  if (od!=null && od!==''){ const n = Number(od); if(!Number.isFinite(n) || n<0) return alert('Odómetro inválido'); odNum=n }
  ending.value = true
  try {
    await apiPatch(`/vehicles/uses/${openUseId.value}/end`, { odometer_end: odNum })
    await Promise.all([checkOpenUse(), loadUsesForSelected(), loadStagingNovedades()])
    alert('Uso cerrado correctamente.')
  } catch (e) { alert(e?.response?.data?.error || 'Error al cerrar uso') }
  finally { ending.value = false }
}

/* ====== Calendario + timeline (historial mensual del agente logueado) ====== */
const monthCursor = ref(new Date())
const historyItems = ref([]) // [{ date:'YYYY-MM-DD', state:'...', municipalityName?: '...' }, ...]

function ymdLocal(d){
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
function startOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x }
function endOfMonth(d){ const x=new Date(d); x.setMonth(x.getMonth()+1,0); x.setHours(0,0,0,0); return x }
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x }
function dowMonday0(d){ return (d.getDay()+6)%7 }

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric'}).format(monthCursor.value)
)
const monthFrom = computed(() => ymdLocal(startOfMonth(monthCursor.value)))
const monthTo   = computed(() => ymdLocal(endOfMonth(monthCursor.value)))

const meAgentId = computed(() => {
  const m = me.value || {}
  return (
    m.agentId ??
    m.agent_id ??
    m.agent?.id ??
    null
  )
})

async function loadHistory () {
  if (!meAgentId.value) { await loadMe() }
  if (!meAgentId.value) { historyItems.value = []; return }

  const from = monthFrom.value, to = monthTo.value

  // En AgentDashboard.vue -> loadHistory()
const candidates = [
  { url: `/agents/${meAgentId.value}/history`, params: { from, to } }, // self
  { url: `/admin/agents/${meAgentId.value}/history`, params: { from, to } }, // fallback si el rol tiene permisos
]



  const normalize = (raw) => {
    const items = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : [])
    return items.map(r => ({
      date: String(r.date ?? r.reportDate ?? r.day ?? r.fecha ?? '').slice(0,10),
      state: String(r.state ?? r.status ?? r.estado ?? r.novelty_state ?? r.novedad ?? 'SIN NOVEDAD').trim() || 'SIN NOVEDAD',
      municipalityName: String(r.municipalityName ?? r.municipio ?? r.municipality ?? r.city ?? '') || ''
    })).filter(x => x.date)
  }

  for (const c of candidates) {
    try {
      const { data } = await apiGet(c.url, { params: c.params })
      historyItems.value = normalize(data)
      break
    } catch {}
  }
}

const dailyHistoryLoading = ref(false)

async function loadDailyHistory() {
  dailyHistoryLoading.value = true
  try {
    await loadHistory()  // 👈 reutiliza la misma fuente
  } finally {
    dailyHistoryLoading.value = false
  }
}

async function prevMonth(){ monthCursor.value = addMonths(monthCursor.value,-1); await loadHistory() }
async function nextMonth(){ monthCursor.value = addMonths(monthCursor.value, 1); await loadHistory() }
async function todayMonth(){ monthCursor.value = new Date(); await loadHistory() }

// Colores / iconos / abreviador (idénticos a ReportView)
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

// Calendario (celdas del mes)
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
    const key = ymdLocal(dt)
    const rec = map.get(key)
    const state = rec?.state || null
    const title = state ? `${key} — ${state}${rec?.municipalityName ? ' — '+rec.municipalityName : ''}` : key
    const isToday = key === ymdLocal(new Date())
    cells.push({ key, day:d, state, title, isToday })
  }
  while (cells.length % 7) cells.push({ key:'tail-'+cells.length, day:'', state:null, title:'' })
  return cells
})

// Timeline (segmentos comprimidos consecutivos)
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
    await apiPost('/me/change-password', { oldPassword: formPwd.value.old, newPassword: formPwd.value.new1 })
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

/* ===== Init ===== */
/* ===== Init ===== */
const AGENT_ID_CACHE_KEY = 'AGENT_ID'

function extractAgentIdFromMe(obj){
  if (!obj) return null
  return (
    obj.agentId ??
    obj.agent_id ??
    obj.agent?.id ??
    null
  )
}

async function ensureAgentId () {
  agentResolveMsg.value = ''

  // A) Si ya lo tenemos en memoria, listo
  if (meAgentId.value) return

  // B) Cache (si ya resolvimos antes)
  const cached = localStorage.getItem(AGENT_ID_CACHE_KEY)
  if (cached && /^\d+$/.test(cached)) {
    me.value = { ...(me.value||{}), agentId: Number(cached) }
    return
  }

  // C) Asegura /me
  if (!me.value) {
    try { await loadMe() }
    catch (e) { agentResolveMsg.value = 'No se pudo leer /me (revisa token/sesión).'; return }
  }
  // ¿/me trae el agentId?
  const fromMe = extractAgentIdFromMe(me.value)
  if (fromMe) {
    localStorage.setItem(AGENT_ID_CACHE_KEY, String(fromMe))
    me.value = { ...(me.value||{}), agentId: fromMe }
    return
  }

  // D) Construye candidatos para buscar por distintos campos
  const userId   = me.value?.id || me.value?.user?.id || null
  const username = me.value?.username || me.value?.user?.username || null
  const email    = me.value?.email || me.value?.user?.email || null
  const code     = username || null   // tu regla: username == code del agente

  // E) Secuencia de intentos (el primero que responda con un ID, gana)
  const trySteps = [
    // Catálogo por code (ya lo tenías)
    async () => {
      if (!code) return null
      const { data } = await apiGet('/catalogs/agents', { params: { code, pageSize: 1 } })
      const item = Array.isArray(data?.items) ? data.items[0] : (Array.isArray(data) ? data[0] : data)
      return item?.id ?? item?.agentId ?? null
    },
    // Búsqueda por code
    async () => {
      if (!code) return null
      const { data } = await apiGet('/agents/search', { params: { code, pageSize: 1 } })
      const item = Array.isArray(data?.items) ? data.items[0] : (Array.isArray(data) ? data[0] : data)
      return item?.id ?? item?.agentId ?? null
    },
    // Endpoint directo si existe
    async () => {
      const { data } = await apiGet('/agents/self')
      return data?.id ?? data?.agentId ?? null
    },
    // Buscar por user_id si tu backend lo soporta
    async () => {
      if (!userId) return null
      const { data } = await apiGet('/agents', { params: { user_id: userId, pageSize: 1 } })
      const item = Array.isArray(data?.items) ? data.items[0] : (Array.isArray(data) ? data[0] : data)
      return item?.id ?? item?.agentId ?? null
    },
    // Buscar por email (común en APIs)
    async () => {
      if (!email) return null
      const { data } = await apiGet('/agents', { params: { email, pageSize: 1 } })
      const item = Array.isArray(data?.items) ? data.items[0] : (Array.isArray(data) ? data[0] : data)
      return item?.id ?? item?.agentId ?? null
    },
    // Buscar por username (si lo modelan)
    async () => {
      if (!username) return null
      const { data } = await apiGet('/agents', { params: { username, pageSize: 1 } })
      const item = Array.isArray(data?.items) ? data.items[0] : (Array.isArray(data) ? data[0] : data)
      return item?.id ?? item?.agentId ?? null
    },
  ]

  for (const step of trySteps) {
    try {
      const id = await step()
      if (id) {
        localStorage.setItem(AGENT_ID_CACHE_KEY, String(id))
        me.value = { ...(me.value||{}), agentId: id }
        return
      }
    } catch { /* silencioso: seguimos probando */ }
  }

  // F) Si llegamos aquí, no se pudo resolver
  agentResolveMsg.value = 'Tu usuario no está vinculado a un agente. Verifica que username=code y que exista el agente.'
  console.warn('[ensureAgentId] no se pudo determinar agentId')
}

onMounted(async () => {
  await loadMe()
  await ensureAgentId()
  await nextTick()
  await loadDailyHistory()
  if (section.value === 'vehiculos') {
    await loadMyActiveAssignments()
    await loadMyOpenUses()
  } else {
    await loadMyActiveAssignments() // si quieres precargar
    await loadMyOpenUses()
  }
})

watch(() => meAgentId.value, async (id) => {
  if (!id) return
  if (!myOpenUses.value.length && !loadingOpenUses.value) await loadMyOpenUses()
  if (!myAssignments.value.length && !loadingAssignments.value) await loadMyActiveAssignments()
})

watch(section, async (s) => {
  if (s !== 'vehiculos') return
  if (!meAgentId.value) await ensureAgentId()
  if (!myOpenUses.value.length && !loadingOpenUses.value) await loadMyOpenUses()
  if (!myAssignments.value.length && !loadingAssignments.value) await loadMyActiveAssignments()
})

</script>
