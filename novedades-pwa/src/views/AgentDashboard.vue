<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Hero superior -->
    <div class="bg-gradient-to-r from-slate-800 to-slate-700">
      <div class="max-w-6xl mx-auto px-4 py-8">
        <h1 class="text-white text-2xl font-semibold">Panel del agente</h1>
        <p class="text-slate-300 text-sm mt-1">Tu cuenta y operaciones diarias</p>
      </div>
    </div>

    <div class="max-w-[1500px] mx-auto px-4 -mt-6 pb-10">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <!-- SIDEBAR -->
        <aside class="md:col-span-3">
          <div class="bg-white rounded-2xl shadow p-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full bg-slate-100 grid place-content-center">
                <svg class="w-6 h-6 text-slate-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </div>
              <div class="min-w-0">
                <div class="text-slate-900 font-medium truncate">{{ me?.username }}</div>
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
          
          <!-- ================= MIS NOVEDADES (historial solo visual) ================= -->
          <!-- Calendario + Línea de tiempo -->
          <div v-show="section==='novedades'" class="bg-white rounded-2xl shadow">
            <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <h3 class="font-semibold text-slate-900">Calendario y línea de tiempo</h3>
            </div>

            <div class="p-4 space-y-4">
              <!-- Controles -->
              <div class="flex flex-wrap items-center gap-2">
                <button class="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50" @click="prevPeriod">◀</button>
                <button class="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50" @click="todayPeriod">Hoy</button>
                <button class="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50" @click="nextPeriod">▶</button>
              
                <span class="ml-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs bg-slate-100 text-slate-700 border border-slate-200">
                  {{ monthLabel }}
                </span>

                <span class="ml-auto text-xs text-slate-500">
                  Rango: {{ rangeFromTo().from }} → {{ rangeFromTo().to }}
                </span>
              </div>


              <!-- KPI: Racha actual -->
              <span
                class="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 text-purple-800 px-3 py-1"
                v-if="workStreak.days > 0"
                title="La racha se reinicia cuando el estado cambia entre: SIN NOVEDAD / SERVICIO / COMISIÓN DEL SERVICIO / PERMISO ACTIVIDAD PERSONAL"
              >
                ⏱️ <b>Días Laborados</b>:
                <span class="font-semibold">{{ workStreak.days }}</span> día(s)
              </span>

              <span
                v-else
                class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 text-slate-700 px-3 py-1"
              >
                ⏱️ Racha actual: 0 día(s)
              </span>

              <div class="grid md:grid-cols-2 gap-4">
                <!-- Calendarios (1 o 3) -->
                <div class="grid gap-4 md:grid-cols-1">
                  <div v-for="cal in calendarsByMonth" :key="cal.label" class="rounded-xl border border-slate-200 p-3">
                    <div class="text-sm font-semibold text-slate-800 mb-2">{{ cal.label }}</div>

                    <div class="grid grid-cols-7 gap-2 text-xs font-medium text-slate-600 mb-1">
                      <div class="text-center">L</div><div class="text-center">M</div><div class="text-center">X</div>
                      <div class="text-center">J</div><div class="text-center">V</div><div class="text-center">S</div>
                      <div class="text-center">D</div>
                    </div>

                    <div class="grid grid-cols-7 gap-2">
                      <div
                        v-for="cell in cal.cells"
                        :key="cell.key"
                        :title="cell.title"
                        class="h-20 rounded-xl p-2 flex flex-col transition border hover:shadow-sm hover:-translate-y-[1px]"
                        :class="[
                          cell.state ? (colorClass(cell.state)?.bg || 'bg-slate-100') : 'bg-white',
                          cell.isToday && 'ring-2 ring-blue-500/70',
                          !cell.state && 'border-slate-200',
                          cell.state && 'border-transparent',
                          cell.isOutside && 'opacity-60'   // 👈 atenuado fuera de mes
                        ]"
                      >
                        <div class="text-[11px] font-medium" :class="cell.isOutside ? 'text-slate-400' : 'opacity-60'">
                          {{ cell.day || '' }}
                        </div>
                        <div class="mt-auto text-center text-lg leading-none" v-if="cell.state">{{ iconFor(cell.state) }}</div>
                        <div v-if="cell.state" class="text-[11px] text-center truncate mt-1 opacity-85">
                          {{ shortState(cell.state) }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Línea de tiempo (rango visible) -->
                <div class="mt-4 space-y-3 relative">
                  <div class="text-sm font-semibold text-slate-800 mb-1">Línea de tiempo ({{ rangeFromTo().from }} → {{ rangeFromTo().to }})</div>
                  <div class="absolute left-3 top-6 bottom-0 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-slate-200" />
                  <div v-for="(s, i) in segments" :key="i" class="flex items-center gap-3 pl-4">
                    <div class="w-3 h-3 rounded-full border-2 border-white shadow ring-1 ring-slate-200" :class="colorClass(s.state)?.dot || 'bg-slate-400'"></div>
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs" :class="colorClass(s.state)?.pill || 'bg-slate-100 text-slate-700'">
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
          <!-- ================= VEHÍCULOS (tabs: asignaciones / usos) ================= -->
          <div v-show="section==='vehiculos'" class="space-y-6">
            <section class="bg-white rounded-2xl shadow">
              <!-- Tabs header -->
             <div class="px-4 pt-4">
                <div class="flex justify-between items-center">
                  <!-- Botones de pestañas -->
                  <div class="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      class="px-3 py-1.5 rounded-lg text-sm"
                      :class="vehTab==='asignaciones' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-800'"
                      @click="vehTab='asignaciones'"
                    >
                      Asignaciones
                    </button>
                    <button
                      class="px-3 py-1.5 rounded-lg text-sm"
                      :class="vehTab==='usos' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-800'"
                      @click="vehTab='usos'"
                    >
                      Usos
                    </button>
                  </div>

                  <!-- Botón Nuevo uso / aviso de uso abierto -->
                  <div v-if="vehTab==='usos'">
                    <!-- Si NO hay usos abiertos del agente, mostrar botón -->
                    <button
                      v-if="!myOpenUses.length"
                      class="px-3 py-1.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 text-sm"
                      @click="openNewUseFlow"
                    >
                      Nuevo uso
                    </button>

                    <!-- Si YA tiene un uso abierto, ocultar el botón y mostrar aviso suave -->
                    <div
                      v-else
                      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs"
                    >
                      <span class="text-lg leading-none">⚠️</span>
                      <div>
                        <div class="font-semibold">Ya tienes un uso abierto</div>
                        <div
                          v-if="myOpenUses[0]?.vehicle?.code"
                          class="text-[11px]"
                        >
                          Vehículo:
                          <span class="font-mono">
                            {{ myOpenUses[0].vehicle.code }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Toolbar -->
              <div class="px-4 pb-3 pt-2 flex items-center justify-between">
                
                <div class="flex items-center gap-2">
                  
                </div>
              </div>

              <!-- TAB: Asignaciones -->
              <div v-show="vehTab==='asignaciones'" class="p-4">
                <div v-if="loadingAssignmentsAll" class="text-sm text-slate-500">
                  Cargando asignaciones…
                </div>

                <div v-else-if="!assignmentsAll.length" class="text-sm text-slate-500">
                  No hay asignaciones registradas.
                </div>

                <div v-else class="rounded-xl border border-slate-200 bg-white">
                  <!-- 🖥️ Desktop: tabla clásica -->
                  <div class="overflow-x-auto rounded-xl hidden md:block">
                    <table class="min-w-full text-xs md:text-sm">
                      <thead class="bg-slate-800 text-white">
                        <tr>
                          <th class="text-left py-2 px-3 font-semibold">Vehículo</th>
                          <th class="text-left py-2 px-3 font-semibold">Inicio</th>
                          <th class="text-left py-2 px-3 font-semibold">Fin</th>
                          <th class="text-left py-2 px-3 font-semibold">Km inicio</th>
                          <!-- 🔹 Nueva columna -->
                          <th class="text-left py-2 px-3 font-semibold hidden lg:table-cell">
                            SOAT / Tecno / Aceite
                          </th>
                          <th class="text-left py-2 px-3 font-semibold">Nota</th>
                          <th class="text-left py-2 px-3 font-semibold">Aceptación</th>
                          <th class="text-left py-2 px-3 font-semibold">Usos en el período</th>
                        </tr>
                      </thead>
                      <tbody class="bg-white">
                        <!-- Bloque por asignación: fila principal + fila desplegable -->
                        <template v-for="row in assignmentsAll" :key="row.id">
                          <!-- FILA PRINCIPAL -->
                          <tr
                            class="border-t transition"
                            :class="!row.end_date
                              ? 'bg-amber-50/80 border-l-4 border-l-amber-500'   /* ASIGNACIÓN VIGENTE */
                              : 'bg-slate-50/40 text-slate-400'                   /* CERRADA (apagadita) */
                            "
                          >
                            <td class="py-2 px-3 font-medium">
                              {{ row.vehicle.code }}
                            </td>
                            <td class="py-2 px-3">{{ row.start_date }}</td>
                            <td class="py-2 px-3">{{ row.end_date || '—' }}</td>
                            <td class="py-2 px-3">{{ row.odometer_start ?? '—' }}</td>

                            <!-- 🔹 Celda SOAT/Tecno/Aceite (solo >= lg) -->
                            <td class="py-2 px-3 align-top hidden lg:table-cell">
                              <div class="space-y-1 text-[11px] text-slate-600">

                                <!-- SOAT -->
                                <div>
                                  SOAT:
                                  <span
                                    :class="expiryColor(daysUntil(row.vehicle.soat_until))"
                                  >
                                    {{ formatDateShort(row.vehicle.soat_until) }}
                                  </span>
                                </div>

                                <!-- Tecno -->
                                <div>
                                  Tecno:
                                  <span
                                    :class="expiryColor(daysUntil(row.vehicle.tecno_until))"
                                  >
                                    {{ formatDateShort(row.vehicle.tecno_until) }}
                                  </span>
                                </div>

                                <!-- Aceite -->
                                <div>
                                  <span class="font-medium">{{ formatOilInfo(row.vehicle) }}</span>
                                </div>

                              </div>
                            </td>


                            <td class="py-2 px-3">{{ row.notes || '—' }}</td>

                            <!-- Columna Aceptación -->
                            <td class="py-2 px-3">
                              <div class="space-y-1">
                                <!-- Estado actual -->
                                <div v-if="row.agent_ack_at">
                                  <div class="text-[11px] text-slate-500">
                                    Aceptada
                                    <span v-if="row.agent_ack_at">el {{ row.agent_ack_at }}</span>
                                  </div>
                                  <div
                                    v-if="row.agent_ack_note"
                                    class="text-xs text-emerald-700"
                                  >
                                    Nota: {{ row.agent_ack_note }}
                                  </div>
                                  <div
                                    v-if="row.agent_ack_extra_note"
                                    class="text-xs text-slate-600"
                                  >
                                    Nota extra: {{ row.agent_ack_extra_note }}
                                  </div>
                                </div>

                                <!-- Sin aceptación todavía -->
                                <div v-else>
                                  <!-- Solo pendiente si la asignación sigue abierta -->
                                  <template v-if="!row.end_date">
                                    <span class="inline-flex items-center gap-1 text-xs text-amber-700">
                                      <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                                      Pendiente de aceptación
                                    </span>
                                  </template>
                                  <!-- Si ya fue cerrada sin aceptar, mostramos estado informativo -->
                                  <template v-else>
                                    <span class="inline-flex items-center gap-1 text-xs text-slate-500">
                                      <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                                      Asignación cerrada sin aceptación
                                    </span>
                                  </template>
                                </div>

                                <!-- Acciones -->
                                <div class="flex flex-wrap gap-2 mt-1">
                                  <!-- Botón aceptar SOLO si no ha aceptado y la asignación sigue abierta -->
                                  <button
                                    v-if="!row.agent_ack_at && !row.end_date"
                                    type="button"
                                    class="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                    @click="openAccept(row)"
                                  >
                                    Aceptar y registrar nota
                                  </button>
                                </div>
                              </div>
                            </td>

                            <!-- Columna botón para ver usos -->
                            <td class="py-2 px-3">
                              <button
                                type="button"
                                class="px-2 py-1 rounded-md border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
                                @click="toggleAssignmentUses(row)"
                              >
                                {{
                                  expandedAssignmentId === row.id
                                    ? 'Ocultar usos'
                                    : 'Ver usos'
                                }}
                              </button>
                            </td>
                          </tr>

                          <!-- FILA DESPLEGABLE: usos dentro del período de la asignación -->
                          <tr v-if="expandedAssignmentId === row.id">
                            <td colspan="8" class="bg-slate-50 px-3 py-3">
                              <div class="text-xs text-slate-500 mb-2">
                                Usos del vehículo
                                <span class="font-semibold">{{ row.vehicle.code }}</span>
                                en el período
                                <span class="font-semibold">{{ row.start_date }}</span>
                                →
                                <span class="font-semibold">{{ row.end_date || 'actualidad' }}</span>
                              </div>

                              <div v-if="!usesForAssignment(row).length" class="text-xs text-slate-500">
                                No hay usos registrados en este período.
                              </div>

                              <div
                                v-else
                                class="overflow-x-auto rounded-lg border border-slate-200 bg-white"
                              >
                                <table class="min-w-full text-xs">
                                  <thead class="bg-slate-100 text-slate-700">
                                    <tr>
                                      <th class="text-left py-1.5 px-2 font-semibold">
                                        Inicio
                                      </th>
                                      <th class="text-left py-1.5 px-2 font-semibold">
                                        Fin
                                      </th>
                                      <th class="text-left py-1.5 px-2 font-semibold">
                                        Km salida
                                      </th>
                                      <th class="text-left py-1.5 px-2 font-semibold">
                                        Km entrada
                                      </th>
                                      <th class="text-left py-1.5 px-2 font-semibold">
                                        Funcionario
                                      </th>
                                      <th class="text-left py-1.5 px-2 font-semibold">
                                        Notas
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr
                                      v-for="u in usesForAssignment(row)"
                                      :key="u.id"
                                      class="border-t transition"
                                      :class="!u.ended_at
                                        ? 'bg-emerald-50/80 border-l-4 border-l-emerald-500'
                                        : 'bg-slate-50/40 text-slate-400'
                                      "
                                    >

                                      <td class="py-1.5 px-2">{{ u.started_at || '—' }}</td>
                                      <td class="py-1.5 px-2">{{ u.ended_at || '—' }}</td>
                                      <td class="py-1.5 px-2">
                                        {{ u.odometer_start ?? '—' }}
                                      </td>
                                      <td class="py-1.5 px-2">
                                        {{ u.odometer_end ?? '—' }}
                                      </td>
                                      <td class="py-1.5 px-2">
                                        {{ u.agent?.nickname || u.agent?.code || '—' }}
                                      </td>
                                      <td class="py-1.5 px-2">
                                        {{ (u.notes || '').trim() || '—' }}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        </template>
                      </tbody>
                    </table>
                  </div>

                  <!-- 📱 Móvil: tarjetas -->
                  <div class="md:hidden p-2 space-y-3">
                    <div
                      v-for="row in assignmentsAll"
                      :key="'m-'+row.id"
                      class="rounded-xl border p-3 shadow-sm transition"
                      :class="!row.end_date
                        ? 'bg-amber-50/80 border-amber-500'        /* VIGENTE */
                        : 'bg-slate-50/60 border-slate-300 text-slate-500' /* CERRADA */
                      "
                    >
                      <div class="flex items-center justify-between gap-2">
                        <div>
                          <div class="text-sm font-semibold text-slate-900">
                            Vehículo {{ row.vehicle.code }}
                          </div>
                          <div class="text-[11px] text-slate-500">
                            {{ row.start_date }} → {{ row.end_date || 'actualidad' }}
                          </div>
                        </div>
                        <button
                          type="button"
                          class="px-2 py-1 rounded-md border border-slate-300 text-[11px] text-slate-700 hover:bg-slate-50"
                          @click="toggleAssignmentUses(row)"
                        >
                          {{
                            expandedAssignmentId === row.id ? 'Ocultar usos' : 'Ver usos'
                          }}
                        </button>
                      </div>

                      <div class="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <!-- SOAT -->
                        <div>
                          <div class="font-medium text-slate-700">SOAT</div>
                          <div :class="expiryColor(daysUntil(row.vehicle.soat_until))">
                            {{ formatDateShort(row.vehicle.soat_until) }}
                          </div>
                        </div>
                        <!-- Tecno -->
                        <div>
                          <div class="font-medium text-slate-700">Tecno</div>
                          <div :class="expiryColor(daysUntil(row.vehicle.tecno_until))">
                            {{ formatDateShort(row.vehicle.tecno_until) }}
                          </div>
                        </div>

                        <!-- Aceite -->
                        <div class="col-span-2">
                          <div class="font-medium text-slate-700">Aceite</div>
                          <div>{{ formatOilInfo(row.vehicle) }}</div>
                        </div>
                      </div>


                      <div class="mt-2 text-[11px]">
                        <div class="font-medium text-slate-700">Nota de asignación</div>
                        <div>{{ row.notes || '—' }}</div>
                      </div>

                      <div class="mt-2 text-[11px]">
                        <div class="font-medium text-slate-700 mb-1">Aceptación</div>

                        <template v-if="row.agent_ack_at">
                          <div class="text-slate-500">
                            Aceptada el {{ row.agent_ack_at }}
                          </div>
                          <div
                            v-if="row.agent_ack_note"
                            class="text-emerald-700 mt-1"
                          >
                            Nota: {{ row.agent_ack_note }}
                          </div>
                          <div
                            v-if="row.agent_ack_extra_note"
                            class="text-slate-600 mt-1"
                          >
                            Nota extra: {{ row.agent_ack_extra_note }}
                          </div>
                        </template>

                        <template v-else>
                          <!-- Si la asignación sigue abierta -->
                          <template v-if="!row.end_date">
                            <div class="flex items-center gap-1 text-amber-700">
                              <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                              Pendiente de aceptación
                            </div>
                            <button
                              type="button"
                              class="mt-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                              @click="openAccept(row)"
                            >
                              Aceptar y registrar nota
                            </button>
                          </template>

                          <!-- Si ya está cerrada sin aceptar -->
                          <template v-else>
                            <div class="flex items-center gap-1 text-slate-500">
                              <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                              Asignación cerrada sin aceptación
                            </div>
                          </template>
                        </template>
                      </div>


                      <!-- Usos en el período (móvil) -->
                      <div
                        v-if="expandedAssignmentId === row.id"
                        class="mt-3 border-t border-slate-200 pt-2"
                      >
                        <div class="text-[11px] text-slate-500 mb-1">
                          Usos del vehículo en el período:
                        </div>

                        <div
                          v-if="!usesForAssignment(row).length"
                          class="text-[11px] text-slate-500"
                        >
                          No hay usos registrados en este período.
                        </div>

                        <div
                          v-else
                          class="space-y-2 max-h-64 overflow-y-auto pr-1"
                        >
                          <div
                            v-for="u in usesForAssignment(row)"
                            :key="u.id"
                            class="rounded-lg border p-2 text-[11px] transition"
                            :class="!u.ended_at
                              ? 'bg-emerald-50/80 border-emerald-500'
                              : 'bg-slate-50/60 border-slate-300 text-slate-500'
                            "
                          >
                            <div class="flex justify-between gap-2">
                              <div class="font-medium text-slate-800">
                                {{ u.started_at || '—' }}
                                <span class="text-slate-500">→ {{ u.ended_at || '—' }}</span>
                              </div>
                            </div>
                            <div class="mt-1 grid grid-cols-2 gap-1 text-slate-600">
                              <div>Km salida: {{ u.odometer_start ?? '—' }}</div>
                              <div>Km entrada: {{ u.odometer_end ?? '—' }}</div>
                              <div class="col-span-2">
                                Agente:  {{ u.agent?.nickname || u.agent?.code || '—' }}
                              </div>
                            </div>
                            <div class="mt-1 text-slate-700">
                              {{ (u.notes || '').trim() || '—' }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- /móvil -->
                </div>
              </div>

              <!-- TAB: Usos -->
              <div v-show="vehTab==='usos'" class="p-4">
                <div v-if="loadingUsesAll" class="text-sm text-slate-500">Cargando usos…</div>
                <div v-else-if="!usesAll.length" class="text-sm text-slate-500">No hay usos registrados.</div>
                <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
                  <table class="min-w-full text-sm">
                    <thead class="bg-slate-800 text-white">
                      <tr>
                        <th class="text-left py-2 px-3 font-semibold">Vehículo</th>
                        <th class="text-left py-2 px-3 font-semibold">Inicio</th>
                        <th class="text-left py-2 px-3 font-semibold">Fin</th>
                        <th class="text-left py-2 px-3 font-semibold">Km salida</th>
                        <th class="text-left py-2 px-3 font-semibold">Km entrada</th>
                        <th class="text-left py-2 px-3 font-semibold">Notas</th>
                        <th class="text-left py-2 px-3 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody class="bg-white">
                      <tr
                        v-for="u in usesAll"
                        :key="u.id"
                        class="border-t transition"
                        :class="!u.ended_at
                          ? 'bg-emerald-50/80 border-l-4 border-l-emerald-500'  /* USO ABIERTO */
                          : 'bg-slate-50/40 text-slate-400'                      /* USO CERRADO */
                        "
                      >
                        <td class="py-2 px-3 font-medium">{{ u.vehicle?.code || '—' }}</td>
                        <td class="py-2 px-3">{{ u.started_at }}</td>
                        <td class="py-2 px-3">{{ u.ended_at || '—' }}</td>
                        <td class="py-2 px-3">{{ u.odometer_start ?? '—' }}</td>
                        <td class="py-2 px-3">{{ u.odometer_end ?? '—' }}</td>
                        <td class="py-2 px-3">{{ (u.notes || '').trim() || '—' }}</td>
                        <td class="py-2 px-3 text-right">
                          <button
                            v-if="!u.ended_at"
                            class="px-3 py-1.5 rounded-md text-white bg-red-600 hover:bg-red-700 text-xs"
                            @click="endUseFromRow(u)"
                          >
                            Cerrar
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </section>
          </div>
          <!-- Modal: nuevo uso (reutiliza tu componente) -->
          <VehicleUsesModal
            v-if="showUsesModal"
            :agent-id="meAgentId"
            :vehicle="selectedVehicle || {}" 
            @close="onUsesModalClose"
            @created="onUseCreated"
          />
          <!-- Modal: seleccionar vehículo para nuevo uso -->
          <div v-if="showVehiclePicker" class="fixed inset-0 bg-black/40 z-50 grid place-items-center">
            <div class="bg-white rounded-2xl p-5 w-[96vw] max-w-lg relative">
              <button class="absolute top-2 right-2 text-xl text-slate-500" @click="closeVehiclePicker">&times;</button>
              <h3 class="font-semibold text-lg mb-3">Selecciona el vehículo</h3>

              <div class="relative">
                <input
                  ref="pickerInputRef"
                  v-model.trim="pickerQuery"
                  @input="pickerSearch"
                  @keydown.enter.prevent="pickerEnter"
                  @blur="pickerHideSoon"
                  type="text"
                  placeholder="Escribe placa o código…"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <!-- resultados -->
                <div
                  v-if="pickerVisible && pickerResults.length"
                  class="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow"
                >
                  <button
                    v-for="v in pickerResults"
                    :key="v.id"
                    class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                    @mousedown.prevent="pickVehicleForNewUse(v)"
                  >
                    <div class="font-medium">{{ v.code }}</div>
                    <div class="text-xs text-slate-500">
                      {{ (v.type || v.tipo || '').toString().toUpperCase() }} · {{ v.state || v.estado || '—' }}
                    </div>
                  </button>
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-4">
                <button class="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700" @click="closeVehiclePicker">Cancelar</button>
                <button
                  class="px-3 py-1.5 rounded-md bg-blue-600 text-white disabled:opacity-50"
                  :disabled="!pickerSelected"
                  @click="confirmPicker"
                >
                  Continuar
                </button>
              </div>
            </div>
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
  <!-- Modal Nota Extra >
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
  </div-->
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import axios from 'axios'
import { defineAsyncComponent } from 'vue'

const VehicleUsesModal = defineAsyncComponent(() =>
  import('@/components/vehicles/VehicleUsesModal.vue')
)
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

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  const target = new Date(dateStr)
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
  return diff
}

function expiryColor(diff) {
  if (diff === null) return 'text-slate-400'

  if (diff <= 0) return 'text-red-700 font-semibold'      // vencido
  if (diff <= 10) return 'text-red-600 font-semibold'      // muy cerca
  if (diff <= 30) return 'text-orange-500 font-semibold'   // pronto
  return 'text-emerald-600 font-semibold'                  // ok
}

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

// Tabs vehículos
const vehTab = ref('asignaciones') // 'asignaciones' | 'usos'

// Historiales
const assignmentsAll = ref([])
const loadingAssignmentsAll = ref(false)
const usesAll = ref([])
const loadingUsesAll = ref(false)

// Modal de nuevo uso
const showUsesModal = ref(false)
function openNewUseModal(){ showUsesModal.value = true }
async function onUseCreated(payload){
  showUsesModal.value = false

  // 👇 Si el backend envía advertencia de aceite, la mostramos
  if (payload && payload.oil_warning) {
    const { remaining, nextOil } = payload.oil_warning
    const remTxt =
      remaining != null
        ? `${remaining} km`
        : 'pocos kilómetros'

    alert(
      `⚠️ Aviso de mantenimiento\n\n` +
      `Al vehículo le faltan ${remTxt} para el próximo cambio de aceite` +
      (nextOil != null ? ` (programado alrededor de ${nextOil} km).` : '.')
    )
  }

  await Promise.all([
    loadUsesAll(),
    loadMyOpenUses()
  ])
}
function onUsesModalClose () {
  // cerrar modal
  showUsesModal.value = false

  // limpiar selección de vehículo para que el siguiente "Nuevo uso"
  // vuelva a mostrar el selector
  selectedVehicle.value = null

  // limpiar estado del picker de vehículo
  pickerSelected.value = null
  pickerQuery.value = ''
  pickerResults.value = []
  pickerVisible.value = false

  // (opcional) limpiar también el buscador viejo si no lo estás usando:
  vehicleQuery.value = ''
  vehicleResults.value = []
  vehicleResultsVisible.value = false
}


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

// —— Flujo "Nuevo uso" con selector de vehículo ——
const showVehiclePicker = ref(false)
const pickerQuery = ref('')
const pickerResults = ref([])
const pickerVisible = ref(false)
const pickerSelected = ref(null)
const pickerInputRef = ref(null)
const vehiclesById = ref({})

function openNewUseFlow(){
  // si ya hay uno seleccionado, abre directo el modal de uso
  if (selectedVehicle.value) {
    showUsesModal.value = true
    return
  }
  // si no, abre el picker
  showVehiclePicker.value = true
  pickerQuery.value = ''
  pickerResults.value = []
  pickerVisible.value = false
  pickerSelected.value = null
  nextTick(()=> pickerInputRef.value?.focus?.())
}

function closeVehiclePicker(){
  showVehiclePicker.value = false
  pickerQuery.value = ''
  pickerResults.value = []
  pickerVisible.value = false
  pickerSelected.value = null
}

let pickerTimer = null
async function pickerSearch(){
  if (pickerTimer) clearTimeout(pickerTimer)
  pickerTimer = setTimeout(async () => {
    const q = pickerQuery.value.trim()
    if (!q){ pickerResults.value = []; pickerVisible.value = false; return }
    const { data } = await apiGet('/vehicles', { params: { query: q, pageSize: 20 } })
    pickerResults.value = Array.isArray(data?.items) ? data.items : []
    pickerVisible.value = true
  }, 220)
}

async function ensureVehiclesCatalog () {
  // si ya los tenemos cargados, no vuelvas a pedirlos
  if (Object.keys(vehiclesById.value).length) return

  try {
    const { data } = await apiGet('/vehicles', { params: { pageSize: 1000 } })
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    const map = {}
    for (const v of items) {
      if (v && v.id != null) {
        map[String(v.id)] = v
      }
    }
    vehiclesById.value = map
    console.debug('[AgentDashboard] vehicles catalog loaded', Object.keys(map).length)
  } catch (e) {
    console.warn('[AgentDashboard] no se pudo cargar catálogo de vehículos', e)
  }
}

function getVehicleFromCatalog (id) {
  if (!id) return null
  return vehiclesById.value[String(id)] || null
}

function pickerHideSoon(){ setTimeout(()=> pickerVisible.value = false, 150) }

function pickVehicleForNewUse(v){
  pickerSelected.value = v
  // muestra seleccionado en el input
  pickerQuery.value = v.code
  pickerVisible.value = false
}

function pickerEnter(){
  // si hay resultados, toma el primero
  if (!pickerSelected.value && pickerResults.value.length){
    pickVehicleForNewUse(pickerResults.value[0])
  }
  confirmPicker()
}

async function confirmPicker(){
  if (!pickerSelected.value) return
  // fija el vehículo global de la vista
  selectedVehicle.value = pickerSelected.value
  // precarga info relacionada (odómetro, usos abiertos, etc.)
  await afterSelectVehicle()
  // cierra el picker y abre el modal de uso
  closeVehiclePicker()
  showUsesModal.value = true
}

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
    // ⬇️ RUTA /accept
    await apiPatch(`/vehicles/assignments/${acceptItem.value.id}/accept`, { note })

    showAccept.value = false
    acceptItem.value = null
    acceptNote.value = ''

    // 👈 AQUÍ ES DONDE FALTABA REFRESCAR TODO
    await Promise.all([
      loadMyActiveAssignments(), // panel de asignaciones vigentes del agente
      loadAssignmentsAll()       // tabla grande de "Asignaciones" en la pestaña vehículos
    ])
  } catch (e) {
    acceptErr.value =
      e?.response?.data?.error ||
      e?.message ||
      'No se pudo aceptar la asignación.'
  } finally {
    accepting.value = false
  }
}

function isOpenValue(v){
  return (
    v == null ||
    v === '' ||
    v === false ||
    v === 0 ||
    (typeof v === 'string' && (v.trim()==='' || v.trim().toLowerCase()==='null' || v.startsWith('0000-00-00')))
  )
}
function sortOpenFirstThenStartDesc(a, b){
  const aOpen = isOpenValue(a.end_date ?? a.ended_at)
  const bOpen = isOpenValue(b.end_date ?? b.ended_at)
  if (aOpen !== bOpen) return aOpen ? -1 : 1
  const aStart = (a.start_date ?? a.started_at ?? '').toString()
  const bStart = (b.start_date ?? b.started_at ?? '').toString()
  return bStart.localeCompare(aStart)
}

function normalizeAssignmentRow (a) {
  const rawVehId =
    a.vehicle?.id ??
    a.vehicle_id ??
    a.vehicleId ??
    null

  // Vehículo que viene en la asignación (si viene)
  const vehFromAssignment = a.vehicle || {}

  // Vehículo enriquecido desde el catálogo global
  const vehFromCatalog = rawVehId ? getVehicleFromCatalog(rawVehId) || {} : {}

  // Mezclamos: catálogo → asignación
  const veh = {
    ...vehFromCatalog,
    ...vehFromAssignment
  }

  const vehId = rawVehId ?? veh.id ?? null
  const vehCode =
    veh.code ??
    a.vehicle_code ??
    a.vehicleCode ??
    a.code ??
    ''

  // 🔍 Intentamos sacar SOAT / TECNO tanto del vehículo como de la asignación
  const soatUntil =
    // desde vehículo (varias variantes típicas)
    veh.soat_until ??
    veh.soatUntil ??
    veh.soat_expire_at ??
    veh.soatExpireAt ??
    veh.soat_vencimiento ??
    veh.soatVencimiento ??
    veh.soat_date ??
    veh.soatDate ??
    // desde la propia asignación (por si el backend las “flatea”)
    a.soat_until ??
    a.soatUntil ??
    a.vehicle_soat_until ??
    a.vehicleSoatUntil ??
    a.soat_expire_at ??
    a.soatExpireAt ??
    a.soat_vencimiento ??
    a.soatVencimiento ??
    a.soat_date ??
    a.soatDate ??
    null

  const tecnoUntil =
    veh.tecno_until ??
    veh.tecnoUntil ??
    veh.tecno_expire_at ??
    veh.tecnoExpireAt ??
    veh.tecno_vencimiento ??
    veh.tecnoVencimiento ??
    veh.tecno_date ??
    veh.tecnoDate ??
    a.tecno_until ??
    a.tecnoUntil ??
    a.vehicle_tecno_until ??
    a.vehicleTecnoUntil ??
    a.tecno_expire_at ??
    a.tecnoExpireAt ??
    a.tecno_vencimiento ??
    a.tecnoVencimiento ??
    a.tecno_date ??
    a.tecnoDate ??
    null

  // Opcional: descomenta esto un momento para ver en consola qué está llegando:
  // console.log('[ASSIGN RAW]', a)
  // console.log('[VEH FROM CATALOG]', vehFromCatalog)
  // console.log('[NORMALIZED soatUntil, tecnoUntil]', soatUntil, tecnoUntil)

  return {
    id: a.id,
    start_date: a.start_date ?? a.startDate ?? '',
    end_date: a.end_date ?? a.endDate ?? null,
    odometer_start: a.odometer_start ?? a.odometerStart ?? null,
    notes: a.notes ?? a.note ?? '',
    agent_ack_at: a.accept_at ?? a.agent_ack_at ?? null,
    agent_ack_note: a.accept_note ?? a.agent_ack_note ?? null,

    vehicle: {
      id: vehId,
      code: vehCode,

      // 🔹 SOAT / Tecno ya con todos los fallbacks
      soat_until: soatUntil,
      tecno_until: tecnoUntil,

      // 🔹 Odómetro actual del vehículo (no el de inicio de la asignación)
      odometer:
        veh.odometer ??
        veh.odometro ??
        a.vehicle_odometer ??
        a.vehicleOdometer ??
        null,

      // 🔹 Aceite (último / intervalo / próximo)
      oil_next_km:
        veh.oil_next_km ??
        veh.oilNextKm ??
        a.oil_next_km ??
        a.oilNextKm ??
        null,

      oil_last_km:
        veh.oil_last_km ??
        veh.oilLastKm ??
        a.oil_last_km ??
        a.oilLastKm ??
        null,

      oil_interval_km:
        veh.oil_interval_km ??
        veh.oilIntervalKm ??
        a.oil_interval_km ??
        a.oilIntervalKm ??
        null
    }
  }
}



function normalizeUseRow (u) {
  // Vehículo
  const vId =
    u.vehicle?.id ??
    u.vehicle_id ??
    u.vehicleId ??
    null

  const vCode =
    u.vehicle?.code ??
    u.vehicle_code ??
    u.vehicleCode ??
    ''

  // Agente (soportando varios formatos de backend)
  const aId =
    u.agent?.id ??
    u.agent_id ??
    u.agentId ??
    null

  const aCode =
    u.agent?.code ??
    u.agent_code ??
    u.agentCode ??
    u.agent?.username ??
    null

  const aNickname =
    u.agent?.nickname ??
    u.agent_nickname ??
    null

  const aName =
    u.agent?.name ??
    u.agent_name ??
    null

  return {
    id: u.id,
    started_at: u.started_at ?? u.startedAt ?? u.start_date ?? '',
    ended_at: u.ended_at ?? u.endedAt ?? u.end_date ?? null,
    odometer_start: u.odometer_start ?? u.odometerStart ?? null,
    odometer_end: u.odometer_end ?? u.odometerEnd ?? null,
    notes: u.notes ?? u.note ?? '',
    vehicle: {
      id: vId,
      code: vCode
    },
    agent: {
      id: aId,
      code: aCode,
      nickname: aNickname,
      name: aName
    }
  }
}

async function loadAssignmentsAll () {
  loadingAssignmentsAll.value = true
  try {
    await ensureAgentId()
    const agentIdVal = meAgentId.value
    if (!agentIdVal) {
      assignmentsAll.value = []
      return
    }

    // 👇 Aseguramos catálogo de vehículos (para soat/tecno/aceite)
    await ensureVehiclesCatalog()

    // Usamos el catálogo ya cargado en vez de llamar otra vez a /vehicles
    const vehicles = Object.values(vehiclesById.value || {})
    const acc = []

    await Promise.all(
      vehicles.map(async (v) => {
        try {
          const { data: asgRes } = await apiGet(`/vehicles/${v.id}/assignments`, {
            params: { pageSize: 500 }
          })
          const items = Array.isArray(asgRes?.items)
            ? asgRes.items
            : (Array.isArray(asgRes) ? asgRes : [])

          for (const a of items) {
            const aAgent = a.agent_id ?? a.agentId ?? a.agent?.id
            if (String(aAgent) === String(agentIdVal)) {
              // Mezclamos la info del vehículo dentro de la asignación
              acc.push({
                ...a,
                vehicle: {
                  ...(a.vehicle || {}),
                  id: v.id,
                  code: v.code
                }
              })
            }
          }
        } catch (e) {
          console.warn(
            '[loadAssignmentsAll] error cargando asignaciones de vehículo',
            v.id,
            e
          )
        }
      })
    )

    assignmentsAll.value = acc
      .map(normalizeAssignmentRow)
      .sort(sortOpenFirstThenStartDesc)
  } finally {
    loadingAssignmentsAll.value = false
  }
}

// Asignación expandida (para mostrar/ocultar usos)
const expandedAssignmentId = ref(null)
// mapa: { [assignmentId]: [usos normalizados] }
const assignUsesMap = ref({})

function toggleAssignmentUses(row) {
  if (expandedAssignmentId.value === row.id) {
    // si ya está abierta, la cerramos
    expandedAssignmentId.value = null
    return
  }
  // abrimos esta
  expandedAssignmentId.value = row.id

  // si aún no hemos cargado los usos de esta asignación, los pedimos
  if (!assignUsesMap.value[row.id]) {
    loadUsesForAssignment(row)
  }
}

// Parseo seguro de fechas
function parseDateSafe(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// Carga los usos de un vehículo y filtra por el período de la asignación
async function loadUsesForAssignment (row) {
  const vehId = row?.vehicle?.id
  if (!vehId) return

  // 1) Pedimos TODOS los usos de ese vehículo (sin filtrar por agente)
  const { data } = await apiGet('/vehicles/uses', {
    params: {
      vehicle_id: vehId,
      pageSize: 2000
    }
  })

  const rawItems = data?.items ?? data ?? []

  // 2) Rango de la asignación (solo fecha, sin hora)
  const startStr = (row.start_date || '').slice(0, 10)
  const endRaw   = row.end_date || null
  const endStr   = endRaw ? endRaw.slice(0, 10) : null

  // 3) Filtramos en el front: usos cuyo started_at caiga dentro del rango
  const filtered = rawItems.filter(u => {
    const d = (
      u.started_at ||
      u.startedAt ||
      u.start_date ||
      u.startDate ||
      u.start ||
      u.created_at ||
      ''
    ).slice(0, 10)

    if (!d) return false
    if (startStr && d < startStr) return false
    if (endStr && d > endStr) return false
    return true
  })

  // 4) Guardamos en el mapa, normalizados
  assignUsesMap.value = {
    ...assignUsesMap.value,
    [row.id]: filtered
      .map(normalizeUseRow)
      .sort(sortOpenFirstThenStartDesc)
  }
}

/**
 * Devuelve los usos de usesAll que se cruzan con el período de una asignación
 * Criterio: mismo vehículo y el intervalo de uso intersecta el intervalo de la asignación.
 */
function usesForAssignment (row) {
  return assignUsesMap.value[row.id] || []
}


async function loadUsesAll () {
  loadingUsesAll.value = true
  try {
    await ensureAgentId()
    const agentIdVal = meAgentId.value
    if (!agentIdVal) { usesAll.value = []; return }

    const { data } = await apiGet('/vehicles/uses', { params: { agent_id: agentIdVal, pageSize: 2000 } })
    const items = data?.items ?? data ?? []
    usesAll.value = items.map(normalizeUseRow).sort(sortOpenFirstThenStartDesc)
  } finally {
    loadingUsesAll.value = false
  }
}

async function endUseFromRow(u){
  if (!u?.id) return
  const od = prompt(`Odómetro final para ${u.vehicle?.code || 'vehículo'} (opcional):`, '')
  let odNum = null
  if (od!=null && od!==''){
    const n = Number(od)
    if(!Number.isFinite(n) || n<0) return alert('Odómetro inválido')
    odNum = n
  }
  try {
    await apiPatch(`/vehicles/uses/${u.id}/end`, { odometer_end: odNum })
    await Promise.all([ loadUsesAll(), loadMyOpenUses() ])
    alert('Uso cerrado correctamente.')
  } catch (e) {
    alert(e?.response?.data?.error || 'Error al cerrar uso')
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
    await ensureAgentId()
    const agentIdVal = meAgentId.value
    if (!agentIdVal) {
      myAssignments.value = []
      return
    }

    const normalizeAssignment = (a, vehicleData = null) => {
      const endRaw =
        a.end_date ?? a.endDate ?? a.ended_at ?? a.endedAt ?? a.end ?? null

      const isOpen =
        endRaw == null ||
        endRaw === '' ||
        endRaw === false ||
        endRaw === 0 ||
        (typeof endRaw === 'string' &&
          (endRaw.trim() === '' ||
            endRaw.trim().toLowerCase() === 'null' ||
            endRaw.startsWith('0000-00-00')))

      return {
        id: a.id,
        start_date: a.start_date ?? a.startDate ?? '',
        odometer_start: a.odometer_start ?? a.odometerStart ?? null,
        notes: a.notes ?? a.note ?? '',
        agent_ack_at: a.accept_at ?? a.agent_ack_at ?? null,
        agent_ack_note: a.accept_note ?? a.agent_ack_note ?? null,
        agent_ack_extra_note: a.agent_ack_extra_note ?? null,
        agent_ack_extra_at: a.agent_ack_extra_at ?? null,
        vehicle:
          vehicleData || {
            id: a.vehicle_id ?? a.vehicleId ?? null,
            code: a.vehicle_code ?? a.code ?? ''
          },
        isOpen
      }
    }

    // 🔹 DIRECTO a vehículos → /vehicles/:id/assignments (sin /agents/:id/assignments)
    const { data: vehsRes } = await apiGet('/vehicles', {
      params: { pageSize: 500, onlyAssigned: 1 }
    })
    const vehicles = Array.isArray(vehsRes?.items)
      ? vehsRes.items
      : (Array.isArray(vehsRes) ? vehsRes : [])

    const out = []

    await Promise.all(
      vehicles.map(async (v) => {
        try {
          const { data: asgRes } = await apiGet(`/vehicles/${v.id}/assignments`, {
            params: { pageSize: 200 }
          })
          const list = Array.isArray(asgRes?.items)
            ? asgRes.items
            : (Array.isArray(asgRes) ? asgRes : [])

          for (const a of list) {
            const aAgent = a.agent_id ?? a.agentId ?? a.agent?.id
            if (String(aAgent) === String(agentIdVal)) {
              const item = normalizeAssignment(a, { id: v.id, code: v.code })
              if (item.isOpen) out.push(item)
            }
          }
        } catch (e) {
          // opcional: console.warn('Error cargando asignaciones activas de vehículo', v.id, e)
        }
      })
    )

    out.sort((a, b) =>
      (b.start_date || '').localeCompare(a.start_date || '')
    )

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
// Normaliza un registro de uso a las columnas que mostramos
function mapUseRow(u, vehOpt) {
  const started = u.started_at ?? u.startedAt ?? u.start_date ?? u.startDate ?? u.start ?? ''
  const odoStart = u.odometer_start ?? u.odometerStart ?? u.km_salida ?? u.kmStart ?? null
  const notes = u.notes ?? u.note ?? u.observation ?? ''

  // Backend actual devuelve vehicleId / vehicleCode (camelCase)
  // Además soportamos vehicle_id / vehicle_code (snake_case) y objeto vehicle.
  const vId =
    u.vehicle?.id ??
    u.vehicle_id ??
    u.vehicleId ??
    vehOpt?.id ??
    null

  const vCode =
    u.vehicle?.code ??
    u.vehicle_code ??
    u.vehicleCode ??
    vehOpt?.code ??
    ''

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
function formatDateShort (v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) {
    return String(v).slice(0, 10) || '—'
  }
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
}

function formatOilInfo (veh) {
  if (!veh) return '—'
  const next  = veh.oil_next_km
  const last  = veh.oil_last_km
  const inter = veh.oil_interval_km

  if (next != null && next !== '') {
    return `Próx. aceite: ${next} km`
  }
  if (last != null && inter != null) {
    const n = Number(last) + Number(inter)
    if (Number.isFinite(n)) {
      return `Próx. aceite: ${n} km`
    }
  }
  if (last != null && last !== '') {
    return `Último cambio: ${last} km`
  }
  return '—'
}

function startOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x }
function endOfMonth(d){ const x=new Date(d); x.setMonth(x.getMonth()+1,0); x.setHours(0,0,0,0); return x }
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x }
function dowMonday0(d){ return (d.getDay()+6)%7 }
function rangeFromTo() {
  // SIEMPRE 3M: desde inicio de (cursor-2) hasta fin de (cursor)
  const start = startOfMonth(addMonths(monthCursor.value, -2))
  const end   = endOfMonth(monthCursor.value)
  return { from: ymdLocal(start), to: ymdLocal(end) }
}

// Navegación sensible al rango
async function prevPeriod(){
  monthCursor.value = addMonths(monthCursor.value, -1)
  await loadHistory()
}
async function nextPeriod(){
  monthCursor.value = addMonths(monthCursor.value, +1)
  await loadHistory()
}
async function todayPeriod(){
  monthCursor.value = new Date()
  await loadHistory()
}

// Etiqueta de rango para el chip
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
  await ensureAgentId()
  if (!meAgentId.value) { historyItems.value = []; return }

  const { from, to } = rangeFromTo()
  const candidates = [
    { url: `/agents/${meAgentId.value}/history`, params: { from, to } },
    { url: `/admin/agents/${meAgentId.value}/history`, params: { from, to } },
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
    try { const { data } = await apiGet(c.url, { params: c.params }); historyItems.value = normalize(data); break } catch {}
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
    'LICENCIA PATERNIDAD':'🍼','PERMISO':'⏳','PERMISO ACTIVIDAD PERSONAL':'⏳','COMISIÓN EN EL EXTERIOR':'✈️','COMISIÓN DE ESTUDIO':'🎓',
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

// Calendarios por mes (array de 1 o 3 entradas)
const calendarsByMonth = computed(() => {
  const map = new Map(historyItems.value.map(h => [String(h.date), h]))

  function buildCells(mDate){
    const start    = startOfMonth(mDate)
    const end      = endOfMonth(mDate)
    const pad      = dowMonday0(start)        // lunes=0
    const days     = end.getDate()
    const cells    = []

    // --- días del mes ANTERIOR para completar primera fila ---
    const prevRef  = addMonths(start, -1)
    const prevLast = endOfMonth(prevRef).getDate()
    for (let i = pad; i > 0; i--){
      const d   = prevLast - i + 1
      const dt  = new Date(prevRef); dt.setDate(d)
      const key = ymdLocal(dt)
      const rec = map.get(key)
      const state = rec?.state || null
      const title = state ? `${key} — ${state}${rec?.municipalityName ? ' — '+rec.municipalityName : ''}` : key
      const isToday = key === ymdLocal(new Date())
      cells.push({ key:`prev-${key}-${+mDate}`, day:d, state, title, isToday, isOutside:true })
    }

    // --- días del MES ACTUAL ---
    for (let d=1; d<=days; d++){
      const dt  = new Date(start); dt.setDate(d)
      const key = ymdLocal(dt)
      const rec = map.get(key)
      const state = rec?.state || null
      const title = state ? `${key} — ${state}${rec?.municipalityName ? ' — '+rec.municipalityName : ''}` : key
      const isToday = key === ymdLocal(new Date())
      cells.push({ key:`cur-${key}-${+mDate}`, day:d, state, title, isToday, isOutside:false })
    }

    // --- días del mes SIGUIENTE para completar última fila ---
    const rest = (7 - (cells.length % 7)) % 7
    if (rest){
      const nextRef = addMonths(start, +1)
      for (let d=1; d<=rest; d++){
        const dt  = new Date(nextRef); dt.setDate(d)
        const key = ymdLocal(dt)
        const rec = map.get(key)
        const state = rec?.state || null
        const title = state ? `${key} — ${state}${rec?.municipalityName ? ' — '+rec.municipalityName : ''}` : key
        const isToday = key === ymdLocal(new Date())
        cells.push({ key:`next-${key}-${+mDate}`, day:d, state, title, isToday, isOutside:true })
      }
    }
    return cells
  }

  // 👇 SIEMPRE 1 mes (el del cursor)
  const m = new Date(monthCursor.value)
  return [{
    label: new Intl.DateTimeFormat('es-CO',{month:'long', year:'numeric'}).format(m),
    cells: buildCells(m)
  }]
})

// Timeline (ya lo tenías). Solo se alimenta del rango vigente.
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

// === DÍAS LABORADOS (YTD) ===
const WORK_STATES = ['SERVICIO', 'COMISIÓN DEL SERVICIO']

const workYTD = ref({
  total: 0,
  byState: {},   // { 'SERVICIO': n, 'COMISIÓN DEL SERVICIO': m }
  from: '',
  to: ''
})

const currentYear = new Date().getFullYear()
function ymd(d){ return d.toISOString().slice(0,10) }

function normalizeHistoryPayload(raw){
  const items = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : [])
  return items.map(r => ({
    date: String(r.date ?? r.reportDate ?? r.day ?? r.fecha ?? '').slice(0,10),
    state: String(r.state ?? r.status ?? r.estado ?? r.novelty_state ?? r.novedad ?? 'SIN NOVEDAD').trim() || 'SIN NOVEDAD'
  })).filter(x => x.date)
}

async function loadWorkdaysYTD () {
  await ensureAgentId()
  if (!meAgentId.value) { workYTD.value = { total:0, byState:{}, from:'', to:'' }; return }

  const from = `${currentYear}-01-01`
  const to   = ymd(new Date())

  // Intenta self, luego admin (por si el rol lo permite)
  const candidates = [
    { url: `/agents/${meAgentId.value}/history`, params: { from, to } },
    { url: `/admin/agents/${meAgentId.value}/history`, params: { from, to } },
  ]
  let rows = []
  for (const c of candidates) {
    try {
      const { data } = await apiGet(c.url, { params: c.params })
      rows = normalizeHistoryPayload(data)
      break
    } catch {/* sigue al siguiente */}
  }

  const byState = {}
  let total = 0
  for (const r of rows){
    const s = String(r.state || '').toUpperCase()
    if (WORK_STATES.includes(s)){
      total += 1
      byState[s] = (byState[s] || 0) + 1
    }
  }
  workYTD.value = { total, byState, from, to }
}

// === Racha actual (se reinicia al cambiar entre los 4 estados) ===
const TRACK_STATES = [
  'SIN NOVEDAD',
  'SERVICIO',
  'COMISIÓN DEL SERVICIO',
  'PERMISO ACTIVIDAD PERSONAL'
]

const historyYTD = ref([]) // crudo YTD para streak
const workStreak = ref({ days: 0, state: null, from: null, to: null })

function normalizeHistoryYTD(raw){
  const items = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : [])
  return items.map(r => ({
    date: String(r.date ?? r.reportDate ?? r.day ?? r.fecha ?? '').slice(0,10),
    state: String(r.state ?? r.status ?? r.estado ?? r.novelty_state ?? r.novedad ?? 'SIN NOVEDAD').trim() || 'SIN NOVEDAD'
  })).filter(x => x.date)
}

async function loadHistoryYTDForStreak(){
  await ensureAgentId()
  if (!meAgentId.value) { historyYTD.value = []; workStreak.value = { days:0, state:null, from:null, to:null }; return }

  const from = `${new Date().getFullYear()}-01-01`
  const to   = ymdLocal(new Date())

  const candidates = [
    { url: `/agents/${meAgentId.value}/history`, params: { from, to } },
    { url: `/admin/agents/${meAgentId.value}/history`, params: { from, to } },
  ]
  let rows = []
  for (const c of candidates) {
    try {
      const { data } = await apiGet(c.url, { params: c.params })
      rows = normalizeHistoryYTD(data)
      break
    } catch {}
  }
  historyYTD.value = rows
  computeWorkStreak()
}

function computeWorkStreak(){
  // Mapa fecha->estado; si un día no viene, tomamos 'SIN NOVEDAD'
  const map = new Map(historyYTD.value.map(x => [x.date, (x.state || 'SIN NOVEDAD').toUpperCase()]))
  const today = new Date()
  const fmt = (d)=> ymdLocal(d)

  const todayState = (map.get(fmt(today)) || 'SIN NOVEDAD').toUpperCase()
  if (!TRACK_STATES.includes(todayState)){
    workStreak.value = { days:0, state:null, from:null, to:fmt(today) }
    return
  }

  let days = 0
  let cursor = new Date(today)
  const target = todayState
  const from = new Date(today)

  while (true){
    const key = fmt(cursor)
    const st  = (map.get(key) || 'SIN NOVEDAD').toUpperCase()
    if (st !== target) break
    days += 1
    from.setDate(from.getDate() - 1)
    cursor.setDate(cursor.getDate() - 1)

    // por seguridad, corta si nos vamos antes del 1 de enero
    const jan1 = new Date(today.getFullYear(), 0, 1)
    if (cursor < jan1) break
  }

  // 'from' quedó un día antes del primer día válido de la racha; corrige +1
  from.setDate(from.getDate() + 1)

  workStreak.value = {
    days,
    state: target,
    from: fmt(from),
    to: fmt(today)
  }
}

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
  await Promise.all([
    loadDailyHistory(),
    loadWorkdaysYTD(),
    loadHistoryYTDForStreak()     // ⬅️ nuevo
  ])
  if (section.value === 'vehiculos') {
    await loadMyActiveAssignments()
    await loadMyOpenUses()
  } else {
    await loadMyActiveAssignments()
    await loadMyOpenUses()
  }
  await Promise.all([
    loadAssignmentsAll(),
    loadUsesAll()
  ])
})

watch(() => meAgentId.value, async (id) => {
  if (!id) return
  await Promise.all([
    loadWorkdaysYTD(),
    loadHistoryYTDForStreak()     // ⬅️ recalcula cuando resolvemos el agentId
  ])
  if (!myOpenUses.value.length && !loadingOpenUses.value) await loadMyOpenUses()
  if (!myAssignments.value.length && !loadingAssignments.value) await loadMyActiveAssignments()
})

// Cuando entro a la sección "vehiculos" preparo todo
watch(section, async (s) => {
  if (s !== 'vehiculos') return

  await ensureAgentId()
  // Historial completo de asignaciones/usos (tabs)
  if (!assignmentsAll.value.length && !loadingAssignmentsAll.value) {
    await loadAssignmentsAll()
  }
  if (!usesAll.value.length && !loadingUsesAll.value) {
    await loadUsesAll()
  }

  // Bloques “vigentes” que ya tenías
  if (!myOpenUses.value.length && !loadingOpenUses.value) {
    await loadMyOpenUses()
  }
  if (!myAssignments.value.length && !loadingAssignments.value) {
    await loadMyActiveAssignments()
  }
})

watch(vehTab, async (t) => {
  if (section.value !== 'vehiculos') return
  if (t === 'asignaciones') {
    if (!assignmentsAll.value.length && !loadingAssignmentsAll.value) {
      await loadAssignmentsAll()
    }
  } else if (t === 'usos') {
    if (!usesAll.value.length && !loadingUsesAll.value) {
      await loadUsesAll()
    }
  }
})


watch(monthCursor, () => { loadHistory() })


</script>
