<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- HEADER estilo Expenses -->
    <div class="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 grid place-items-center text-white font-bold">
            G
          </div>
          <div>
            <h2 class="font-semibold text-slate-900">Gastos — Comisiones de servicio</h2>
            <p class="text-slate-500 text-xs">
              Administra las comisiones de servicio validadas por
              <strong>vigencia</strong> y sus subvigencias.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 1: Vigencia + filtros (estilo tarjeta blanca) -->
    <section class="bg-white rounded-2xl shadow border border-slate-200 p-4 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">
            Vigencia, subvigencias y filtros
          </h2>
          <p class="text-xs text-slate-500">
            Selecciona una vigencia, crea subvigencias dentro de su rango y filtra por estado y unidad para ver las comisiones certificadas.
          </p>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-[minmax(0,1.6fr),repeat(3,minmax(0,1fr))] items-end">
        <!-- Vigencia -->
        <div>
          <label class="text-xs font-medium text-slate-700 mb-1 block">
            Vigencia
          </label>
          <select
            v-model="selectedVigenciaId"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200 bg-white"
          >
            <option value="">Selecciona una vigencia…</option>
            <option
              v-for="p in periods"
              :key="p.id"
              :value="String(p.id)"
            >
              {{ p.name }} — {{ p.from }} → {{ p.to }}
            </option>
          </select>
          <p v-if="loadingPeriods" class="text-[11px] text-slate-400 mt-1">
            Cargando vigencias…
          </p>
          <p v-else-if="currentPeriod" class="text-[11px] text-slate-500 mt-1">
            Rango: <strong>{{ currentPeriod.from }}</strong> → <strong>{{ currentPeriod.to }}</strong>
          </p>
          <p v-if="currentPeriod && subperiods.length" class="text-[11px] text-slate-500 mt-1">
            Subvigencias: <strong>{{ subperiods.length }}</strong>
          </p>
        </div>

        <!-- Filtro unidad -->
        <div>
          <label class="text-xs font-medium text-slate-700 mb-1 block">
            Unidad
          </label>
          <select
            v-model="unitFilter"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200 bg-white"
            :disabled="!units.length"
          >
            <option :value="null">Todas las unidades</option>
            <option
              v-for="u in units"
              :key="u.id"
              :value="u.id"
            >
              {{ u.short || u.name || ('Unidad ' + u.id) }}
            </option>
          </select>
        </div>

        <!-- Filtro estado -->
        <div>
          <label class="text-xs font-medium text-slate-700 mb-1 block">
            Estado
          </label>
          <select
            v-model="statusFilter"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="APROBADA">Aprobadas</option>
            <option value="ANULADA">Anuladas</option>
          </select>
        </div>

        <!-- Botones derecha -->
        <div class="flex flex-col items-end gap-2">
          <button
            class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
            @click="loadCommissions"
            :disabled="loadingCommissions || !selectedVigenciaId"
          >
            {{ loadingCommissions ? 'Cargando…' : 'Actualizar' }}
          </button>
        </div>
      </div>
    </section>

        <!-- PESTAÑAS -->
    <div class="mt-2 border-b border-slate-200">
      <nav class="flex gap-4 px-1 text-xs">
        <button
          type="button"
          class="pb-2 border-b-2 -mb-px font-medium transition-colors"
          :class="activeTab === 'commissions'
            ? 'border-slate-900 text-slate-900'
            : 'border-transparent text-slate-500 hover:text-slate-800'"
          @click="activeTab = 'commissions'"
        >
          Comisiones
        </button>
        <button
          type="button"
          class="pb-2 border-b-2 -mb-px font-medium transition-colors"
          :class="activeTab === 'periods'
            ? 'border-slate-900 text-slate-900'
            : 'border-transparent text-slate-500 hover:text-slate-800'"
          @click="activeTab = 'periods'"
        >
          Vigencias y subvigencias
        </button>
      </nav>
    </div>

    <!-- TAB 1: COMISIONES -->
    <section
      v-if="activeTab === 'commissions'"
      class="bg-white rounded-2xl shadow border border-slate-200 p-4 mt-3"
    >
      <header class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 class="text-slate-900 font-semibold text-sm">
            Comisiones certificadas (gastos)
          </h2>
          <p class="text-xs text-slate-500">
            Rango real que se reconocerá como comisión de servicio dentro de la vigencia seleccionada.
            Puedes ajustar fechas, asignar subvigencias y cambiar su estado.
          </p>
        </div>
        <div class="text-[11px] text-slate-500" v-if="currentPeriod">
          {{ filteredCommissions.length }} comisión(es) en {{ currentPeriod.name }}
        </div>
      </header>

      <div v-if="!selectedVigenciaId" class="text-sm text-slate-500 py-8 text-center">
        Selecciona una vigencia para ver las comisiones certificadas.
      </div>
      <div v-else-if="loadingCommissions" class="text-sm text-slate-500 py-8 text-center">
        Cargando comisiones…
      </div>
      <div v-else-if="!filteredCommissions.length" class="text-sm text-slate-500 py-8 text-center">
        No hay comisiones registradas para la vigencia seleccionada y los filtros aplicados.
      </div>
      <div v-else class="overflow-auto rounded-xl border border-slate-200">
        <table class="min-w-full text-xs">
          <thead class="bg-slate-900 text-white">
            <tr>
              <th class="text-left px-3 py-2 font-semibold">Agente</th>
              <th class="text-left px-3 py-2 font-semibold">Rango real</th>
              <th class="text-left px-3 py-2 font-semibold">Subvigencia</th>
              <th class="text-left px-3 py-2 font-semibold">Destino</th>
              <th class="text-left px-3 py-2 font-semibold">Días</th>
              <th class="text-left px-3 py-2 font-semibold">Estado</th>
              <th class="text-left px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr
              v-for="c in filteredCommissions"
              :key="c.id"
              class="border-t border-slate-100 hover:bg-slate-50"
            >
              <!-- Agente -->
              <td class="px-3 py-2 align-top">
                <div class="font-semibold text-slate-900">
                  {{ c.agentCode }}
                  <span class="text-[11px] text-slate-500">
                    ({{ displayCategory(c.agentCategory) }})
                  </span>
                </div>
                <div v-if="c.agentNickname" class="text-[11px] text-slate-500">
                  "{{ c.agentNickname }}"
                </div>
                <div class="text-[11px] text-slate-400">
                  {{ c.unitName || '-' }}
                </div>
              </td>

              <!-- Rango real (fechas editables) -->
              <td class="px-3 py-2 align-top">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-1">
                    <input
                      type="date"
                      v-model="c.start_date"
                      class="w-28 rounded-md border border-slate-300 px-2 py-1 text-[11px] focus:ring-1 focus:ring-indigo-200"
                    >
                    <span class="text-[11px]">→</span>
                    <input
                      type="date"
                      v-model="c.end_date"
                      class="w-28 rounded-md border border-slate-300 px-2 py-1 text-[11px] focus:ring-1 focus:ring-indigo-200"
                    >
                  </div>
                  <p v-if="c.subperiodId && c.subperiodName" class="text-[10px] text-slate-400">
                    Ajustada por: {{ c.subperiodName }}
                  </p>
                </div>
              </td>

              <!-- Subvigencia (selector) -->
              <td class="px-3 py-2 text-[11px] align-top">
                <div v-if="subperiods.length">
                  <select
                    v-model="c.subperiodId"
                    class="w-40 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] focus:ring-1 focus:ring-indigo-200"
                  >
                    <option :value="null">Sin subvigencia</option>
                    <option
                      v-for="sp in subperiods"
                      :key="sp.id"
                      :value="sp.id"
                    >
                      {{ sp.name }} ({{ sp.from }} → {{ sp.to }})
                    </option>
                  </select>
                </div>
                <div v-else class="text-slate-400">
                  No hay subvigencias definidas.
                </div>
              </td>

              <!-- Destino -->
              <td class="px-3 py-2 text-[11px] align-top">
                <div v-if="c.destGroupName || c.destUnitName">
                  {{ c.destGroupName || 'Grupo' }} / {{ c.destUnitName || 'Unidad' }}
                </div>
                <div v-else class="text-slate-400">Sin destino explícito</div>
              </td>

              <!-- Días -->
              <td class="px-3 py-2 text-[11px] align-top">
                {{ countDays(c.start_date, c.end_date) }}
              </td>

              <!-- Estado + botones -->
              <td class="px-3 py-2 align-top">
                <span
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  :class="statusPillClass(c.status)"
                >
                  {{ c.status }}
                </span>
                <div class="mt-1 flex flex-wrap gap-1">
                  <button
                    v-for="st in ['DRAFT','APROBADA','ANULADA']"
                    :key="st"
                    type="button"
                    class="px-2 py-0.5 rounded-md border text-[10px]"
                    :class="c.status === st
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'"
                    @click="changeStatus(c, st)"
                  >
                    {{ st }}
                  </button>
                </div>
              </td>

              <!-- Guardar -->
              <td class="px-3 py-2 text-right align-top">
                <button
                  class="px-3 py-1 rounded-lg text-[11px] font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 mr-1"
                  @click="saveRow(c)"
                >
                  Guardar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        v-if="msg"
        class="mt-3 text-xs"
        :class="msgOk ? 'text-emerald-700' : 'text-rose-700'"
      >
        {{ msg }}
      </p>
    </section>

    <!-- TAB 2: GESTIÓN DE VIGENCIAS Y SUBVIGENCIAS -->
    <section
      v-else
      class="bg-white rounded-2xl shadow border border-slate-200 p-4 mt-3 space-y-4"
    >
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-slate-900 font-semibold text-sm">
            Gestión de vigencias y subvigencias
          </h2>
          <p class="text-xs text-slate-500">
            Administra el catálogo de vigencias y sus subvigencias: cambia nombre, ajusta fechas
            o elimina registros que ya no se usan.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
            @click="openCreateModal"
          >
            Crear vigencia
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed"
            @click="openSubModal"
            :disabled="!selectedVigenciaId || !currentPeriod"
          >
            Crear subvigencia
          </button>
        </div>
      </header>

      <div class="grid gap-4 md:grid-cols-2">
        <!-- LISTADO / EDICIÓN DE VIGENCIAS -->
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="px-3 py-2 bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-between">
            <span>Vigencias</span>
            <span v-if="loadingPeriods" class="opacity-75">Cargando…</span>
          </div>

          <div v-if="!periods.length" class="p-3 text-[11px] text-slate-500">
            No hay vigencias creadas aún. Usa el botón "Crear vigencia" para agregar la primera.
          </div>

          <div v-else class="max-h-80 overflow-auto">
            <table class="min-w-full text-[11px]">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="text-left px-2 py-1 font-semibold">Nombre</th>
                  <th class="text-left px-2 py-1 font-semibold">Rango</th>
                  <th class="text-left px-2 py-1 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in periods"
                  :key="p.id"
                  class="border-b border-slate-100 hover:bg-slate-50"
                  :class="String(p.id) === selectedVigenciaId ? 'bg-indigo-50/40' : ''"
                >
                  <!-- Nombre -->
                  <td class="px-2 py-1 align-top">
                    <input
                      v-model="p.name"
                      type="text"
                      class="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] focus:ring-1 focus:ring-indigo-200"
                    >
                    <p v-if="p.created_at" class="text-[10px] text-slate-400 mt-0.5">
                      Creada: {{ String(p.created_at).slice(0,10) }}
                    </p>
                  </td>

                  <!-- Rango -->
                  <td class="px-2 py-1 align-top">
                    <div class="flex items-center gap-1">
                      <input
                        type="date"
                        v-model="p.from"
                        class="w-26 rounded-md border border-slate-300 px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-200"
                      >
                      <span>→</span>
                      <input
                        type="date"
                        v-model="p.to"
                        class="w-26 rounded-md border border-slate-300 px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-200"
                      >
                    </div>
                    <button
                      type="button"
                      class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px]"
                      :class="String(p.id) === selectedVigenciaId
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'"
                      @click="selectedVigenciaId = String(p.id)"
                    >
                      Usar en vista
                    </button>
                  </td>

                  <!-- Acciones -->
                  <td class="px-2 py-1 align-top text-right">
                    <div class="flex flex-col gap-1 items-end">
                      <button
                        type="button"
                        class="px-2 py-0.5 rounded-md text-[10px] font-medium border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        @click="updatePeriod(p)"
                        :disabled="savingPeriodId === p.id"
                      >
                        {{ savingPeriodId === p.id ? 'Guardando…' : 'Guardar' }}
                      </button>
                      <button
                        type="button"
                        class="px-2 py-0.5 rounded-md text-[10px] font-medium border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        @click="deletePeriod(p)"
                        :disabled="deletingPeriodId === p.id"
                      >
                        {{ deletingPeriodId === p.id ? 'Eliminando…' : 'Eliminar' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- LISTADO / EDICIÓN DE SUBVIGENCIAS -->
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="px-3 py-2 bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-between">
            <span>Subvigencias de la vigencia seleccionada</span>
            <span v-if="currentPeriod" class="opacity-75">
              {{ currentPeriod.name }} ({{ currentPeriod.from }} → {{ currentPeriod.to }})
            </span>
          </div>

          <div v-if="!currentPeriod" class="p-3 text-[11px] text-slate-500">
            Selecciona una vigencia para ver y administrar sus subvigencias.
          </div>

          <div v-else-if="!subperiods.length" class="p-3 text-[11px] text-slate-500">
            Esta vigencia no tiene subvigencias. Puedes crearlas con "Crear subvigencia".
          </div>

          <div v-else class="max-h-80 overflow-auto">
            <table class="min-w-full text-[11px]">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="text-left px-2 py-1 font-semibold">Nombre</th>
                  <th class="text-left px-2 py-1 font-semibold">Rango</th>
                  <th class="text-left px-2 py-1 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="sp in subperiods"
                  :key="sp.id"
                  class="border-b border-slate-100 hover:bg-slate-50"
                >
                  <!-- Nombre -->
                  <td class="px-2 py-1 align-top">
                    <input
                      v-model="sp.name"
                      type="text"
                      class="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] focus:ring-1 focus:ring-indigo-200"
                    >
                  </td>

                  <!-- Rango -->
                  <td class="px-2 py-1 align-top">
                    <div class="flex items-center gap-1">
                      <input
                        type="date"
                        v-model="sp.from"
                        class="w-26 rounded-md border border-slate-300 px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-200"
                      >
                      <span>→</span>
                      <input
                        type="date"
                        v-model="sp.to"
                        class="w-26 rounded-md border border-slate-300 px-2 py-1 text-[10px] focus:ring-1 focus:ring-indigo-200"
                      >
                    </div>
                  </td>

                  <!-- Acciones -->
                  <td class="px-2 py-1 align-top text-right">
                    <div class="flex flex-col gap-1 items-end">
                      <button
                        type="button"
                        class="px-2 py-0.5 rounded-md text-[10px] font-medium border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        @click="updateSubperiod(sp)"
                        :disabled="savingSubperiodId === sp.id"
                      >
                        {{ savingSubperiodId === sp.id ? 'Guardando…' : 'Guardar' }}
                      </button>
                      <button
                        type="button"
                        class="px-2 py-0.5 rounded-md text-[10px] font-medium border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        @click="deleteSubperiod(sp)"
                        :disabled="deletingSubperiodId === sp.id"
                      >
                        {{ deletingSubperiodId === sp.id ? 'Eliminando…' : 'Eliminar' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p
        v-if="msg"
        class="mt-3 text-xs"
        :class="msgOk ? 'text-emerald-700' : 'text-rose-700'"
      >
        {{ msg }}
      </p>
    </section>



    <!-- Modal crear vigencia -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40"
    >
      <div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5">
        <header class="flex items-center justify-between mb-3">
          <div>
            <h3 class="text-sm font-semibold text-slate-900">
              Crear nueva vigencia
            </h3>
            <p class="text-xs text-slate-500">
              Asigna un nombre y un rango de fechas para la vigencia.
            </p>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 text-lg leading-none"
            @click="closeCreateModal"
          >
            ×
          </button>
        </header>

        <div class="space-y-3">
          <div>
            <label class="text-xs font-medium text-slate-700 mb-1 block">
              Nombre (ej: DIC25)
            </label>
            <input
              type="text"
              v-model="newPeriod.name"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
              placeholder="DIC25"
            >
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-medium text-slate-700 mb-1 block">
                Desde
              </label>
              <input
                type="date"
                v-model="newPeriod.from"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
              >
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700 mb-1 block">
                Hasta
              </label>
              <input
                type="date"
                v-model="newPeriod.to"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
              >
            </div>
          </div>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
            @click="closeCreateModal"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            @click="createVigencia"
            :disabled="creatingPeriod"
          >
            {{ creatingPeriod ? 'Creando…' : 'Crear vigencia' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal crear subvigencia -->
    <div
      v-if="showSubModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40"
    >
      <div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5">
        <header class="flex items-center justify-between mb-3">
          <div>
            <h3 class="text-sm font-semibold text-slate-900">
              Crear subvigencia
            </h3>
            <p class="text-xs text-slate-500" v-if="currentPeriod">
              Dentro de la vigencia
              <strong>{{ currentPeriod.name }}</strong>
              ({{ currentPeriod.from }} → {{ currentPeriod.to }}).
            </p>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 text-lg leading-none"
            @click="closeSubModal"
          >
            ×
          </button>
        </header>

        <div class="space-y-3">
          <div>
            <label class="text-xs font-medium text-slate-700 mb-1 block">
              Nombre (ej: SEM1, SEM2, D1-D10)
            </label>
            <input
              type="text"
              v-model="newSubperiod.name"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
              placeholder="SEM1"
            >
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-medium text-slate-700 mb-1 block">
                Desde
              </label>
              <input
                type="date"
                v-model="newSubperiod.from"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
              >
            </div>
            <div>
              <label class="text-xs font-medium text-slate-700 mb-1 block">
                Hasta
              </label>
              <input
                type="date"
                v-model="newSubperiod.to"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-200"
              >
            </div>
          </div>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
            @click="closeSubModal"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            @click="createSubvigencia"
            :disabled="creatingSubperiod"
          >
            {{ creatingSubperiod ? 'Creando…' : 'Crear subvigencia' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import { ref, onMounted, watch, computed } from 'vue'

const commissions = ref([])
const loadingCommissions = ref(false)

const statusFilter = ref('')
const unitFilter = ref(null)
const units = ref([])

const msg = ref('')
const msgOk = ref(false)
const activeTab = ref('commissions') // 'commissions' | 'periods'

// Vigencias
const periods = ref([])              // { id, name, from, to, created_at }
const selectedVigenciaId = ref('')
const loadingPeriods = ref(false)

// Subvigencias
const subperiods = ref([])           // { id, name, from, to, periodId }
const showSubModal = ref(false)
const newSubperiod = ref({
  name: '',
  from: '',
  to: ''
})
const creatingSubperiod = ref(false)

// Estados de guardado/eliminación en gestión
const savingPeriodId = ref(null)
const deletingPeriodId = ref(null)
const savingSubperiodId = ref(null)
const deletingSubperiodId = ref(null)

// Modal crear vigencia
const showCreateModal = ref(false)
const newPeriod = ref({
  name: '',
  from: '',
  to: ''
})
const creatingPeriod = ref(false)

function displayCategory (c) {
  return String(c || '') === 'SO' ? 'ME' : c
}

function countDays (start, end) {
  if (!start || !end) return 0
  const d1 = new Date(start + 'T00:00:00')
  const d2 = new Date(end + 'T00:00:00')
  const ms = d2.getTime() - d1.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1
}

function statusPillClass (status) {
  if (status === 'APROBADA') { return 'bg-emerald-100 text-emerald-800 border border-emerald-200' }
  if (status === 'ANULADA') { return 'bg-rose-100 text-rose-800 border border-rose-200' }
  return 'bg-slate-100 text-slate-800 border border-slate-200'
}

const currentPeriod = computed(() => {
  const id = selectedVigenciaId.value ? Number(selectedVigenciaId.value) : null
  if (!id) return null
  return periods.value.find(p => Number(p.id) === id) || null
})

const filteredCommissions = computed(() => {
  let out = commissions.value || []

  if (unitFilter.value) {
    out = out.filter(c => Number(c.unitId || 0) === Number(unitFilter.value))
  }

  if (statusFilter.value) {
    out = out.filter(c => c.status === statusFilter.value)
  }

  return out
})

async function fetchPeriods () {
  loadingPeriods.value = true
  try {
    const { data } = await axios.get('/rest-planning/periods', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    const items = Array.isArray(data?.items) ? data.items : []
    periods.value = items.map(p => ({
      id: p.id,
      name: p.name || `Vigencia #${p.id}`,
      from: String(p.from_date).slice(0, 10),
      to: String(p.to_date).slice(0, 10),
      created_at: p.created_at || null
    }))

    if (!selectedVigenciaId.value && periods.value.length) {
      selectedVigenciaId.value = String(periods.value[0].id)
    }
  } catch (e) {
    console.error('[fetchPeriods] error', e)
    periods.value = []
  } finally {
    loadingPeriods.value = false
  }
}

async function loadUnits () {
  try {
    const { data } = await axios.get('/admin/units', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    units.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error('[loadUnits] error', e)
    units.value = []
  }
}

async function loadSubperiods () {
  if (!selectedVigenciaId.value) {
    subperiods.value = []
    return
  }
  try {
    const { data } = await axios.get('/rest-planning/subperiods', {
      params: { vigenciaId: selectedVigenciaId.value },
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    const items = Array.isArray(data?.items) ? data.items : []
    subperiods.value = items.map(sp => ({
      id: sp.id,
      periodId: sp.periodId || sp.period_id || null,
      name: sp.name,
      from: String(sp.from_date).slice(0, 10),
      to: String(sp.to_date).slice(0, 10)
    }))
  } catch (e) {
    console.error('[loadSubperiods] error', e)
    subperiods.value = []
  }
}

async function loadCommissions () {
  if (!selectedVigenciaId.value) {
    commissions.value = []
    return
  }
  loadingCommissions.value = true
  msg.value = ''
  try {
    const { data } = await axios.get('/service-commissions', {
      params: {
        vigenciaId: selectedVigenciaId.value,
        status: statusFilter.value || undefined
      },
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    commissions.value = Array.isArray(data?.items)
      ? data.items.map(c => ({
          ...c,
          start_date: String(c.start_date).slice(0, 10),
          end_date: String(c.end_date).slice(0, 10)
        }))
      : []
  } catch (e) {
    console.error(e)
    msg.value = e?.response?.data?.error || 'Error al cargar comisiones'
    msgOk.value = false
    commissions.value = []
  } finally {
    loadingCommissions.value = false
  }
}

// Guardar cambios de una fila (fechas, destino, subvigencia, etc.)
async function saveRow (c) {
  msg.value = ''
  msgOk.value = false
  try {
    await axios.put(`/service-commissions/${c.id}`, {
      start_date: c.start_date,
      end_date: c.end_date,
      state: c.state || 'COMISIÓN DEL SERVICIO',
      destGroupId: c.destGroupId || null,
      destUnitId: c.destUnitId || null,
      municipalityId: c.municipalityId || null,
      subperiodId: c.subperiodId || null
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    msg.value = `Comisión actualizada para ${c.agentCode}`
    msgOk.value = true
    await loadCommissions()
  } catch (e) {
    console.error(e)
    msg.value = e?.response?.data?.error || 'Error al actualizar comisión'
    msgOk.value = false
  }
}

// Cambiar status (DRAFT / APROBADA / ANULADA)
async function changeStatus (c, newStatus) {
  if (c.status === newStatus) return
  msg.value = ''
  msgOk.value = false
  try {
    await axios.patch(`/service-commissions/${c.id}/status`, {
      status: newStatus
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    c.status = newStatus
    msg.value = `Estado actualizado a ${newStatus} para ${c.agentCode}`
    msgOk.value = true
  } catch (e) {
    console.error(e)
    msg.value = e?.response?.data?.error || 'Error al cambiar estado'
    msgOk.value = false
  }
}

// Modal helpers - vigencia
function openCreateModal () {
  msg.value = ''
  msgOk.value = false
  showCreateModal.value = true
}

function closeCreateModal () {
  if (creatingPeriod.value) return
  showCreateModal.value = false
  newPeriod.value.name = ''
  newPeriod.value.from = ''
  newPeriod.value.to = ''
}

// Crear nueva vigencia
async function createVigencia () {
  msg.value = ''
  msgOk.value = false

  const name = String(newPeriod.value.name || '').trim()
  const from = newPeriod.value.from
  const to = newPeriod.value.to

  if (!name || !from || !to) {
    msg.value = 'Nombre, desde y hasta son requeridos para crear una vigencia.'
    msgOk.value = false
    return
  }

  if (to < from) {
    msg.value = 'La fecha final no puede ser menor que la inicial.'
    msgOk.value = false
    return
  }

  creatingPeriod.value = true
  try {
    const { data } = await axios.post('/rest-planning/periods', {
      name,
      from,
      to
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })

    const newId = data?.id
    if (newId) {
      await fetchPeriods()
      selectedVigenciaId.value = String(newId)
      await loadSubperiods()
      await loadCommissions()
      msg.value = `Vigencia ${name} creada correctamente.`
      msgOk.value = true
      closeCreateModal()
    } else {
      msg.value = 'No se pudo crear la vigencia.'
      msgOk.value = false
    }
  } catch (e) {
    console.error('[createVigencia] error', e)
    msg.value = e?.response?.data?.error || 'Error al crear vigencia'
    msgOk.value = false
  } finally {
    creatingPeriod.value = false
  }
}

// Actualizar una vigencia (nombre y rango)
async function updatePeriod (p) {
  msg.value = ''
  msgOk.value = false

  const name = String(p.name || '').trim()
  const from = p.from
  const to = p.to

  if (!name || !from || !to) {
    msg.value = 'Nombre, desde y hasta son requeridos para actualizar la vigencia.'
    msgOk.value = false
    return
  }

  if (to < from) {
    msg.value = 'La fecha final de la vigencia no puede ser menor que la inicial.'
    msgOk.value = false
    return
  }

  savingPeriodId.value = p.id
  try {
    await axios.put(`/rest-planning/periods/${p.id}`, {
      name,
      from,
      to
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })

    msg.value = `Vigencia ${name} actualizada correctamente.`
    msgOk.value = true

    // Recargar listado manteniendo la vigencia seleccionada
    const current = selectedVigenciaId.value
    await fetchPeriods()
    if (current) {
      selectedVigenciaId.value = current
    }
  } catch (e) {
    console.error('[updatePeriod] error', e)
    msg.value = e?.response?.data?.error || 'Error al actualizar vigencia'
    msgOk.value = false
  } finally {
    savingPeriodId.value = null
  }
}

// Eliminar una vigencia
async function deletePeriod (p) {
  if (!window.confirm(`¿Eliminar la vigencia "${p.name}" y sus subvigencias (si las tiene)?`)) {
    return
  }

  msg.value = ''
  msgOk.value = false
  deletingPeriodId.value = p.id

  try {
    await axios.delete(`/rest-planning/periods/${p.id}`, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })

    // Actualizar estado local
    periods.value = periods.value.filter(x => x.id !== p.id)

    if (String(p.id) === selectedVigenciaId.value) {
      if (periods.value.length) {
        selectedVigenciaId.value = String(periods.value[0].id)
      } else {
        selectedVigenciaId.value = ''
        subperiods.value = []
        commissions.value = []
      }
    }

    msg.value = `Vigencia "${p.name}" eliminada correctamente.`
    msgOk.value = true
  } catch (e) {
    console.error('[deletePeriod] error', e)
    msg.value = e?.response?.data?.error || 'Error al eliminar vigencia'
    msgOk.value = false
  } finally {
    deletingPeriodId.value = null
  }
}

// Modal helpers - subvigencia
function openSubModal () {
  msg.value = ''
  msgOk.value = false
  if (!currentPeriod.value) return
  // por defecto, toda la vigencia
  newSubperiod.value.name = ''
  newSubperiod.value.from = currentPeriod.value.from
  newSubperiod.value.to = currentPeriod.value.to
  showSubModal.value = true
}

function closeSubModal () {
  if (creatingSubperiod.value) return
  showSubModal.value = false
  newSubperiod.value.name = ''
  newSubperiod.value.from = ''
  newSubperiod.value.to = ''
}

// Crear nueva subvigencia
async function createSubvigencia () {
  msg.value = ''
  msgOk.value = false

  if (!selectedVigenciaId.value || !currentPeriod.value) {
    msg.value = 'Debes seleccionar una vigencia antes de crear una subvigencia.'
    msgOk.value = false
    return
  }

  const name = String(newSubperiod.value.name || '').trim()
  const from = newSubperiod.value.from
  const to = newSubperiod.value.to

  if (!name || !from || !to) {
    msg.value = 'Nombre, desde y hasta son requeridos para crear una subvigencia.'
    msgOk.value = false
    return
  }

  if (to < from) {
    msg.value = 'La fecha final de la subvigencia no puede ser menor que la inicial.'
    msgOk.value = false
    return
  }

  // Validar que quede dentro de la vigencia
  if (from < currentPeriod.value.from || to > currentPeriod.value.to) {
    msg.value = `La subvigencia debe estar dentro del rango de la vigencia (${currentPeriod.value.from} → ${currentPeriod.value.to}).`
    msgOk.value = false
    return
  }

  creatingSubperiod.value = true
  try {
    const { data } = await axios.post('/rest-planning/subperiods', {
      periodId: Number(selectedVigenciaId.value),
      name,
      from,
      to
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })

    if (data?.id) {
      await loadSubperiods()
      await loadCommissions()
      msg.value = `Subvigencia ${name} creada correctamente.`
      msgOk.value = true
      closeSubModal()
    } else {
      msg.value = 'No se pudo crear la subvigencia.'
      msgOk.value = false
    }
  } catch (e) {
    console.error('[createSubvigencia] error', e)
    msg.value = e?.response?.data?.error || 'Error al crear subvigencia'
    msgOk.value = false
  } finally {
    creatingSubperiod.value = false
  }
}

// Actualizar una subvigencia
async function updateSubperiod (sp) {
  msg.value = ''
  msgOk.value = false

  const name = String(sp.name || '').trim()
  const from = sp.from
  const to = sp.to

  if (!name || !from || !to) {
    msg.value = 'Nombre, desde y hasta son requeridos para actualizar la subvigencia.'
    msgOk.value = false
    return
  }

  if (to < from) {
    msg.value = 'La fecha final de la subvigencia no puede ser menor que la inicial.'
    msgOk.value = false
    return
  }

  if (currentPeriod.value) {
    if (from < currentPeriod.value.from || to > currentPeriod.value.to) {
      msg.value = `La subvigencia debe estar dentro del rango de la vigencia (${currentPeriod.value.from} → ${currentPeriod.value.to}).`
      msgOk.value = false
      return
    }
  }

  savingSubperiodId.value = sp.id
  try {
    await axios.put(`/rest-planning/subperiods/${sp.id}`, {
      name,
      from,
      to
    }, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })

    msg.value = `Subvigencia ${name} actualizada correctamente.`
    msgOk.value = true

    // Recargar subvigencias para asegurar coherencia
    await loadSubperiods()
    await loadCommissions()
  } catch (e) {
    console.error('[updateSubperiod] error', e)
    msg.value = e?.response?.data?.error || 'Error al actualizar subvigencia'
    msgOk.value = false
  } finally {
    savingSubperiodId.value = null
  }
}

// Eliminar una subvigencia
async function deleteSubperiod (sp) {
  if (!window.confirm(`¿Eliminar la subvigencia "${sp.name}"?`)) {
    return
  }

  msg.value = ''
  msgOk.value = false
  deletingSubperiodId.value = sp.id

  try {
    await axios.delete(`/rest-planning/subperiods/${sp.id}`, {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
    })

    subperiods.value = subperiods.value.filter(x => x.id !== sp.id)

    msg.value = `Subvigencia "${sp.name}" eliminada correctamente.`
    msgOk.value = true

    // Opcional: recargar comisiones por si alguna usaba esta subvigencia
    await loadCommissions()
  } catch (e) {
    console.error('[deleteSubperiod] error', e)
    msg.value = e?.response?.data?.error || 'Error al eliminar subvigencia'
    msgOk.value = false
  } finally {
    deletingSubperiodId.value = null
  }
}


onMounted(async () => {
  await Promise.all([
    fetchPeriods(),
    loadUnits()
  ])
  if (selectedVigenciaId.value) {
    await loadSubperiods()
    await loadCommissions()
  }
})

// Refiltrar/recargar comisiones cuando cambie el statusFilter
watch(statusFilter, async () => {
  if (selectedVigenciaId.value) {
    await loadCommissions()
  }
})

// Cuando cambie la vigencia seleccionada, recargar subvigencias y comisiones
watch(selectedVigenciaId, async () => {
  msg.value = ''
  msgOk.value = false
  if (selectedVigenciaId.value) {
    await loadSubperiods()
    await loadCommissions()
  } else {
    subperiods.value = []
    commissions.value = []
  }
})
</script>
