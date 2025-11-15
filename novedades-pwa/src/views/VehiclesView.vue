<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <!-- HEADER -->
    <div class="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 grid place-items-center text-white font-bold">V</div>
          <div>
            <h2 class="font-semibold text-slate-900">Gestión de vehículos</h2>
            <p class="text-slate-500 text-xs">Inventario, asignaciones y vencimientos</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Segmented control -->
          <div class="inline-flex rounded-2xl border border-slate-300 p-1 bg-white shadow-sm">
            <button
              :class="['px-3 py-1.5 rounded-xl text-sm flex items-center gap-2',
                      activeTab==='list' ? 'bg-slate-900 text-white shadow' : 'text-slate-700 hover:bg-slate-100']"
              @click="activeTab='list'">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h18M3 12h18M3 19h18"/></svg>
              Vehículos
            </button>
            <button
              :class="['px-3 py-1.5 rounded-xl text-sm flex items-center gap-2',
                      activeTab==='due' ? 'bg-slate-900 text-white shadow' : 'text-slate-700 hover:bg-slate-100']"
              @click="activeTab='due'">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
              Vencimientos
            </button>
          </div>

          <!-- Add -->
          <button class="btn-primary inline-flex items-center gap-2" @click="showAddVehicle = true">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Agregar
          </button>
        </div>
      </div>
    </div>

    <!-- FILTROS (solo lista) -->
    <div class="card" v-if="activeTab==='list'">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-3">
            <label class="label">Buscar</label>
            <input
              v-model="filters.query"
              class="input"
              placeholder="Placa, funcionario…"
              @input="onQueryInput" />
          </div>

          <div class="md:col-span-3">
            <label class="label">Grupo</label>
            <select
              v-model="filters.groupId"
              class="input"
              @change="filters.unitId=''; applyFilters()">
              <option value="">— Todos —</option>
              <option v-for="g in grupos" :key="g.id" :value="String(g.id)">{{ g.code }}</option>
            </select>
          </div>

          <div class="md:col-span-3">
            <label class="label">Unidad</label>
            <select v-model="filters.unitId" class="input" @change="applyFilters">
              <option value="">— Todas —</option>
              <option v-for="u in unidadesFiltrado" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
            </select>
          </div>

          <div class="md:col-span-3">
            <label class="label">Categoría</label>
            <select v-model="filters.category" class="input" @change="applyFilters">
              <option value="">— Todas —</option>
              <option value="CM">Camioneta</option>
              <option value="VH">Vehículo</option>
              <option value="MT">Moto</option>
            </select>
          </div>

          <div class="md:col-span-3">
            <label class="label">Estado</label>
            <select v-model="filters.estado" class="input" @change="applyFilters">
              <option value="">— Todos —</option>
              <option value="SERVICIO">SERVICIO</option>
              <option value="EN TALLER">EN TALLER</option>
              <option value="MANTENIMIENTO N.C">MANTENIMIENTO N.C</option>
            </select>
          </div>

          <div class="md:col-span-3 flex items-end gap-3">
            <label class="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" v-model="filters.onlyAssigned" @change="applyFilters" />
              <span>Solo asignados</span>
            </label>
            <label class="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" v-model="filters.hasOpenUse" @change="applyFilters" />
              <span>Con uso abierto</span>
            </label>
          </div>

          <div class="md:col-span-6 flex items-end justify-end gap-2">
            <button class="btn-secondary" @click="resetFilters">Limpiar</button>
            <!-- Botón Aplicar filtros eliminado -->
          </div>
        </div>
        <div v-if="loading" class="text-xs text-slate-500 mt-2">Actualizando…</div>
      </div>
    </div>

    <!-- Tabla vehículos -->
    <div class="card" v-if="activeTab==='list'">
      <div class="card-body overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left text-slate-600">
              <th class="py-2 pr-3">Placa</th>
              <th class="py-2 pr-3 w-[1%] whitespace-nowrap">Estado</th>
              <th class="py-2 pr-3">SOAT</th>
              <th class="py-2 pr-3">Tecno</th>
              <th class="py-2 pr-3">Km</th>
              <th class="py-2 pr-3">Próx. aceite</th>
              <th class="py-2 pr-3">Funcionario</th>
              <th class="py-2 pr-3">Grupo</th>
              <th class="py-2 pr-3">Unidad</th>
              <th class="py-2 pr-3">Asig./Usos</th>
              <th class="py-2 pr-3">Est./Hist</th>
              <th class="py-2 pr-3">Edit./Borr</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in vehicles" :key="v.id" class="border-t">
              <td class="py-2 pr-3 font-medium">{{ v.code }}</td>
              <td class="py-2 pr-3 w-[1%] whitespace-nowrap">
                <span :class="estadoClass(v.estado)">{{ v.estado }}</span>
              </td>
              <td class="py-2 pr-3">
                <!-- SOAT -->
                <span v-if="isExpired(v.soatDate)"
                      class="text-red-600 font-medium"
                      :title="formatDate(v.soatDate)">
                  SIN SOAT
                </span>
                <span v-else :class="dateColorClass(v.soatDate)">
                  {{ formatDate(v.soatDate) }}
                </span>
              </td>

              <td class="py-2 pr-3">
                <!-- Tecno -->
                <span v-if="isExpired(v.tecnoDate)"
                      class="text-red-600 font-medium"
                      :title="formatDate(v.tecnoDate)">
                  SIN TECNO
                </span>
                <span v-else :class="dateColorClass(v.tecnoDate)">
                  {{ formatDate(v.tecnoDate) }}
                </span>
              </td>
              <td class="py-2 pr-3">{{ v.odometer ?? '—' }}</td>
              <td class="py-2 pr-3">
                <span v-if="nextOilKm(v) != null" :class="oilClassByRemaining(v)">
                  {{ nextOilKm(v) }} <small class="text-slate-400"> ( {{ Math.max(0, kmsToNextOil(v) ?? 0) }} km)</small>
                </span>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td class="py-2 pr-3">
                <span v-if="v.agentCode">
                  <span class="font-mono text-xs">{{ v.agentCode }}</span>
                  <span class="text-slate-500">({{ v.agentNickname }})</span>
                </span>
                <span v-else class="text-slate-400">Sin asignar</span>
              </td>
              <td class="py-2 pr-3">{{ v.groupName || '—' }}</td>
              <td class="py-2 pr-3">{{ v.unitName || '—' }}</td>
              <td class="py-2 pr-3">
                <div class="flex flex-wrap gap-2">
                  <!-- Asignaciones -->
                  <button class="icon-btn" title="Asignaciones" @click="openAssignments(v)">
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                      :class="v.agentCode ? 'text-sky-600' : 'text-slate-400'"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </button>
                  <!-- Usos abiertos -->
                  <button class="icon-btn" title="Usos abiertos" @click="openUses(v)">
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      :class="v.hasOpenUse ? 'stroke-green-600' : 'stroke-slate-400'"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                    >
                      <rect x="3" y="11" width="18" height="6" rx="3" />
                      <circle cx="7.5" cy="16.5" r="2.5" />
                      <circle cx="16.5" cy="16.5" r="2.5" />
                      <path d="M3 11V7a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v4" />
                    </svg>
                  </button>
                </div>
              </td>
              <td class="py-2 pr-3">
                <div class="flex flex-wrap gap-2">
                  <!-- Cambiar estado -->
                  <button class="icon-btn" title="Cambiar estado" @click="openStateModal(v)">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 12h18M12 3v18" />
                    </svg>
                  </button>

                  <!-- Ver historial de estados -->
                  <button class="icon-btn" title="Ver historial" @click="openHistory(v)">
                    <!-- icono reloj / timeline -->
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 12a9 9 0 1 0 9-9" />
                      <path d="M3 3v6h6" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                  </button>
                </div>
              </td>
              <td class="py-2 pr-3">
                <div class="flex flex-wrap gap-2">
                  <!-- Editar -->
                  <button class="icon-btn" title="Editar vehículo" @click="openEditVehicle(v)">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 1 1 2.828 2.828L11.828 15.828a4 4 0 0 1-1.414.94l-4.243 1.415 1.415-4.243a4 4 0 0 1 .94-1.414z"/>
                    </svg>
                  </button>
                  <!-- Eliminar -->
                  <button class="icon-btn" title="Eliminar vehículo" @click="confirmDeleteVehicle(v)">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M3 6h18" />
                      <path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" />
                      <rect x="8" y="6" width="8" height="14" rx="2" />
                      <path d="M10 10v6" />
                      <path d="M14 10v6" />
                      <path d="M5 6l1-2h12l1 2" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && !vehicles.length">
              <td colspan="8" class="py-6 text-center text-slate-500">Sin resultados</td>
            </tr>
          </tbody>
        </table>
        <div v-if="loading" class="text-sm text-slate-500 mt-2">Cargando…</div>
      </div>
    </div>

    <!-- Vencimientos -->
    <div class="card" v-if="activeTab==='due'">
      <div class="card-body">
        <div class="flex items-center gap-3 mb-3">
          <label class="label">Alertar ≤ días</label>
          <input type="number" v-model.number="dueWithin" class="input w-32" min="0" />
          <button class="btn-primary" @click="loadDue">Actualizar</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="d in dueItems" :key="d.id" class="border rounded-xl p-4">
            <div class="font-semibold">
              {{ d.code }} <span class="text-slate-500">({{ d.sigla }})</span>
            </div>
            <div class="mt-2 text-sm">
              <div>
                SOAT: <strong>{{ d.soatDate }}</strong>
                <small class="text-slate-500" v-if="d.soat_in_days!=null"> ({{ d.soat_in_days }} días)</small>
              </div>
              <div>
                Tecno: <strong>{{ d.tecnoDate }}</strong>
                <small class="text-slate-500" v-if="d.tecno_in_days!=null"> ({{ d.tecno_in_days }} días)</small>
              </div>
            </div>
          </div>
        </div>

        <div v-if="loadingDue" class="text-sm text-slate-500 mt-2">Cargando…</div>
      </div>
    </div>

    <!-- Modales -->
    <VehicleAssignmentsModal
      v-if="showAssign"
      :vehicle="currentVehicle"
      @close="onCloseAssign"
    />

    <VehicleUsesModal
      v-if="showUses"
      :vehicle="currentVehicle"
      @close="onCloseUses"
      @iniciar-uso="onIniciarUso"
      @end="cerrarUso"
    />
  </div>

 <!-- Modal Agregar vehículo -->
  <div v-if="showAddVehicle" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-xl p-8 w-[96vw] max-w-md relative">
      <button
        class="absolute top-2 right-2 text-xl text-slate-500 hover:text-slate-800"
        @click="showAddVehicle = false"
        aria-label="Cerrar"
      >&times;</button>
      <h3 class="font-semibold text-lg mb-4">Agregar vehículo</h3>

      <form @submit.prevent="submitAddVehicle" class="space-y-4">
        <div>
          <label class="label">Placa</label>
          <input v-model="addVehicleForm.code" class="input w-full" maxlength="20" required />
        </div>

        <div>
          <label class="label">Estado</label>
          <select v-model="addVehicleForm.estado" class="input w-full" required>
            <option value="SERVICIO">SERVICIO</option>
            <option value="EN TALLER">EN TALLER</option>
            <option value="MANTENIMIENTO N.C">MANTENIMIENTO N.C</option>
          </select>
        </div>

        <div>
          <label class="label">Kilometraje</label>
          <input v-model.number="addVehicleForm.odometer" type="number" min="0" class="input w-full" required />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label">Km último cambio de aceite (opcional)</label>
            <input v-model.number="addVehicleForm.oil_last_km" type="number" min="0" class="input w-full" />
          </div>
          <div>
            <label class="label">Intervalo cambio aceite (km, opcional)</label>
            <input v-model.number="addVehicleForm.oil_interval_km" type="number" min="1" class="input w-full" />
          </div>
        </div>

        <div>
          <label class="label">SOAT (YYYY-MM-DD)</label>
          <input v-model="addVehicleForm.soatDate" type="date" class="input w-full" required />
        </div>

        <div>
          <label class="label">Tecno (YYYY-MM-DD)</label>
          <input v-model="addVehicleForm.tecnoDate" type="date" class="input w-full" required />
        </div>

        <div>
          <label class="label">Categoría</label>
          <select v-model="addVehicleForm.category" class="input" required>
            <option value="">— Selecciona —</option>
            <option value="CM">Camioneta</option>
            <option value="VH">Vehículo</option>
            <option value="MT">Moto</option>
          </select>
        </div>

        <div>
          <label class="label">Grupo</label>
          <select v-model="addVehicleForm.groupId" @change="addVehicleForm.unitId=''" class="input" required>
            <option value="">— Selecciona —</option>
            <option v-for="g in grupos" :key="g.id" :value="String(g.id)">{{ g.code }}</option>
          </select>
        </div>

        <div>
          <label class="label">Unidad</label>
          <select v-model="addVehicleForm.unitId" class="input" required>
            <option value="">— Selecciona —</option>
            <option v-for="u in unidadesPorGrupoAdd" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
          </select>
        </div>

        <div v-if="addVehicleError" class="text-red-600 text-sm">{{ addVehicleError }}</div>
        <div class="flex gap-3">
          <button class="btn-secondary flex-1" type="button" @click="showAddVehicle = false">Cancelar</button>
          <button class="btn-primary flex-1" :disabled="addVehicleLoading">
            <span v-if="addVehicleLoading">Guardando…</span>
            <span v-else>Guardar</span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal Editar vehículo -->
  <div v-if="showEditVehicle" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-xl p-8 w-[96vw] max-w-md relative">
      <button
        class="absolute top-2 right-2 text-xl text-slate-500 hover:text-slate-800"
        @click="showEditVehicle = false"
        aria-label="Cerrar"
      >&times;</button>
      <h3 class="font-semibold text-lg mb-4">Editar vehículo</h3>

      <form @submit.prevent="submitEditVehicle" class="space-y-4">
        <div>
          <label class="label">Placa</label>
          <input v-model="editVehicleForm.code" class="input w-full" maxlength="20" required />
        </div>

        <div>
          <label class="label">Estado</label>
          <select v-model="editVehicleForm.estado" class="input w-full" required>
            <option value="SERVICIO">SERVICIO</option>
            <option value="EN TALLER">EN TALLER</option>
            <option value="MANTENIMIENTO N.C">MANTENIMIENTO N.C</option>
          </select>
        </div>

        <div>
          <label class="label">Kilometraje</label>
          <input v-model.number="editVehicleForm.odometer" type="number" min="0" class="input w-full" required />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label">Km último cambio de aceite (opcional)</label>
            <input v-model.number="editVehicleForm.oil_last_km" type="number" min="0" class="input w-full" />
          </div>
          <div>
            <label class="label">Intervalo cambio aceite (km, opcional)</label>
            <input v-model.number="editVehicleForm.oil_interval_km" type="number" min="1" class="input w-full" />
          </div>
        </div>

        <div>
          <label class="label">SOAT</label>
          <input v-model="editVehicleForm.soatDate" type="date" class="input w-full" required />
        </div>

        <div>
          <label class="label">Tecno</label>
          <input v-model="editVehicleForm.tecnoDate" type="date" class="input w-full" required />
        </div>

        <div>
          <label class="label">Categoría</label>
          <select v-model="editVehicleForm.category" class="input w-full" required>
            <option value="CM">Camioneta</option>
            <option value="VH">Vehículo</option>
            <option value="MT">Moto</option>
          </select>
        </div>

        <div>
          <label class="label">Grupo</label>
          <select v-model="editVehicleForm.groupId" class="input w-full" required>
            <option v-for="g in grupos" :key="g.id" :value="String(g.id)">{{ g.code }}</option>
          </select>
        </div>

        <div>
          <label class="label">Unidad</label>
          <select v-model="editVehicleForm.unitId" class="input w-full" required>
            <option v-for="u in unidadesPorGrupoEdit" :key="u.id" :value="String(u.id)">
              {{ u.name }}
            </option>
          </select>
        </div>

        <div class="flex gap-3">
          <button class="btn-secondary flex-1" type="button" @click="showEditVehicle = false">Cancelar</button>
          <button class="btn-primary flex-1">Guardar cambios</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: Cambiar estado -->
  <div v-if="showState" class="fixed inset-0 bg-black/40 z-50 grid place-items-center">
    <div class="bg-white rounded-2xl p-6 w-[96vw] max-w-md relative">
      <button class="absolute top-2 right-2 text-xl text-slate-500" @click="closeStateModal">&times;</button>
      <h3 class="font-semibold text-lg mb-4">Cambiar estado</h3>

      <div v-if="stateError" class="text-red-600 text-sm mb-2">{{ stateError }}</div>

      <div>
        <label class="label">Nuevo estado</label>
        <select v-model="stateForm.new_status" class="input w-full">
          <option value="SERVICIO">SERVICIO</option>
          <option value="EN TALLER">EN TALLER</option>
          <option value="MANTENIMIENTO N.C">MANTENIMIENTO N.C</option>
        </select>
      </div>
      <div>
        <label class="label">Kilometraje actual</label>
        <input v-model.number="stateForm.odometer" type="number" min="0" class="input w-full" />
      </div>
      <div>
        <label class="label">Nota</label>
        <textarea v-model="stateForm.note" class="input w-full" rows="3" placeholder="Detalle del cambio..."></textarea>
      </div>

      <div v-if="canShowChangedOilCheckbox()" class="flex items-center gap-2">
        <input id="changed_oil" type="checkbox" v-model="stateForm.changed_oil" />
        <label for="changed_oil" class="text-sm">Se cambió aceite en este servicio</label>
      </div>

      <div class="flex gap-3 pt-2">
        <button class="btn-secondary flex-1" @click="showState=false">Cancelar</button>
        <button class="btn-primary flex-1" @click="submitState">Guardar</button>
      </div>

    </div>
  </div>

  <!-- Modal: Historial de cambios de estado -->
  <div v-if="showHistory" class="fixed inset-0 bg-black/40 z-50 grid place-items-center">
    <div class="bg-white rounded-2xl p-6 w-[96vw] max-w-2xl relative">
      <button class="absolute top-2 right-2 text-xl text-slate-500" @click="showHistory=false">&times;</button>
      <h3 class="font-semibold text-lg mb-4">Historial de estado — {{ currentVehicle?.code }}</h3>

      <div class="max-h-[60vh] overflow-auto divide-y">
        <div v-for="it in historyItems" :key="it.id" class="py-2 text-sm">
          <div class="flex justify-between">
            <div>
              <span :class="estadoClass(it.prevStatus)">{{ it.prevStatus }}</span>
              <span class="mx-2">→</span>
              <span :class="estadoClass(it.newStatus)">{{ it.newStatus }}</span>
              <span class="ml-3 text-slate-500">Odo: {{ it.odometer ?? '—' }}</span>
              <span v-if="it.changedOil" class="ml-2 text-emerald-600 font-medium">[aceite]</span>
            </div>
            <div class="text-slate-500">{{ it.changedAt }}</div>
          </div>
          <div class="mt-1 text-slate-700 whitespace-pre-wrap">{{ it.note || '—' }}</div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue' // ⬅️ añade onUnmounted
import { http } from '@/lib/http'
import VehicleAssignmentsModal from '@/components/vehicles/VehicleAssignmentsModal.vue'
import VehicleUsesModal from '@/components/vehicles/VehicleUsesModal.vue'
import BadgeDate from '@/components/BadgeDate.vue'

const activeTab = ref('list')
const loading = ref(false)
const vehicles = ref([])

const showAssign = ref(false)
const showUses = ref(false)
const showControl = ref(false)
const currentVehicle = ref(null)
const showState = ref(false)


const showHistory = ref(false)
const historyItems = ref([])

const stateError = ref('');
function canShowChangedOilCheckbox() {
  const prev = currentVehicle.value?.estado;
  const next = stateForm.value.new_status;
  return prev === 'EN TALLER' && (next === 'SERVICIO' || next === 'MANTENIMIENTO N.C');
}

function estadoClass(estado) {
  switch (estado) {
    case 'SERVICIO': return 'bg-green-100 text-green-700 px-2 py-0.5 rounded';
    case 'EN TALLER': return 'bg-red-100 text-red-700 px-2 py-0.5 rounded';
    case 'MANTENIMIENTO N.C': return 'bg-amber-100 text-amber-700 px-2 py-0.5 rounded';
    default: return 'bg-slate-100 text-slate-600 px-2 py-0.5 rounded';
  }
}

function daysTo(dateStr) {
  if (!dateStr) return null
  const now = new Date()
  const d = new Date(String(dateStr))
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24))
}

function isExpired(dateStr) {
  const d = daysTo(dateStr)
  return d != null && d < 0
}

function dateColorClass(dateStr) {
  const d = daysTo(dateStr)
  if (d == null) return 'text-slate-400'
  if (d < 0) return 'text-red-600 font-medium'       // vencido (aunque arriba lo cubrimos con SIN SOAT/TECNO)
  if (d < 10) return 'text-red-600 font-medium'      // <10 rojo
  if (d < 30) return 'text-amber-500 font-medium'    // 10–29 amarillo
  return 'text-green-600 font-medium'                // ≥30 verde
}

function formatDate(val) {
  return val ? String(val).slice(0, 10) : ''
}

function nextOilKm(v) {
  const last = Number(v.oil_last_km ?? NaN);
  const interval = Number(v.oil_interval_km ?? NaN);
  if (Number.isNaN(last) || Number.isNaN(interval)) return null;
  return last + interval;
}
function kmsToNextOil(v) {
  const next = nextOilKm(v);
  if (next == null) return null;
  const odo = Number(v.odometer ?? NaN);
  if (Number.isNaN(odo)) return null;
  return next - odo;
}
function oilClassByRemaining(v) {
  const rem = kmsToNextOil(v);
  if (rem == null) return 'text-slate-400';
  if (rem > 1000) return 'text-green-600';
  if (rem >= 200) return 'text-amber-500';
  return 'text-red-600';
}

const submittingState = ref(false)
const stateForm = ref({
  id: null,               // setéalo cuando abras el modal
  new_status: 'SERVICIO', // por defecto
  odometer: null,
  note: ''
})
const stateErrors = ref({
  new_status: '',
  odometer: '',
  note: '',
  general: ''
})

function openStateModal(vehicle) {
  currentVehicle.value = vehicle
  stateForm.value = {
    id: vehicle.id,
    new_status: vehicle.estado || 'SERVICIO',
    odometer: Number(vehicle.odometer ?? 0),
    note: ''
  }
  // limpia errores
  stateErrors.value = { new_status: '', odometer: '', note: '', general: '' }
  showState.value = true
}

function closeStateModal() {
  showState.value = false
  submittingState.value = false
  stateErrors.value = { new_status: '', odometer: '', note: '', general: '' }
}

// borra error de un campo al editar
function clearFieldError(field) {
  if (stateErrors.value[field]) stateErrors.value[field] = ''
}

// Validaciones front
function validateStateForm() {
  const v = currentVehicle.value || {}
  const nuevoKm = Number(stateForm.value.odometer ?? 0)
  const actualKm = Number(v.odometer ?? 0)
  const nuevaNota = String(stateForm.value.note || '').trim()
  const nuevoEstado = stateForm.value.new_status

  // limpia previos
  stateErrors.value = { new_status: '', odometer: '', note: '', general: '' }

  let ok = true

  // 1) KM no menor al actual
  if (Number.isNaN(nuevoKm) || nuevoKm < actualKm) {
    stateErrors.value.odometer = `El kilometraje no puede ser menor al actual (${actualKm} km).`
    ok = false
  }

  // 2) Nota obligatoria
  if (!nuevaNota) {
    stateErrors.value.note = 'Debes ingresar una nota para registrar el cambio de estado.'
    ok = false
  }

  // 3) (Opcional) mismo estado → confirmación
  if (nuevoEstado === v.estado) {
    const confirmSame = confirm(`El vehículo ya está en estado "${v.estado}". ¿Registrar igualmente el cambio?`)
    if (!confirmSame) ok = false
  }

  return ok
}

async function submitState() {
  stateError.value = '';
  try {
    const kmVeh = Number(currentVehicle.value?.odometer ?? 0);
    const kmNew = Number(stateForm.value.odometer ?? NaN);
    const note = String(stateForm.value.note || '').trim();

    if (!note) {
      stateError.value = 'La nota es obligatoria.';
      return;
    }
    if (Number.isNaN(kmNew)) {
      stateError.value = 'Debes ingresar el kilometraje actual.';
      return;
    }
    if (kmNew < kmVeh) {
      stateError.value = `El kilometraje no puede ser menor al actual (${kmVeh}).`;
      return;
    }

    await http.post(`/vehicles/${stateForm.value.id}/state-change`, {
      new_status: stateForm.value.new_status,
      odometer: kmNew,
      note,
      changed_oil: !!stateForm.value.changed_oil
    });

    showState.value = false;
    stateForm.value.changed_oil = false;
    await loadVehicles();
  } catch (e) {
    stateError.value =
      e?.response?.data?.error ||
      e?.response?.data?.detail ||
      'No se pudo guardar el cambio de estado.';
  }
}

async function openHistory(v) {
  currentVehicle.value = v;
  const { data } = await http.get(`/vehicles/${v.id}/status-history`, { params:{ limit: 100 } });
  historyItems.value = data.items || [];
  showHistory.value = true;
}
async function loadStatusHistory(vehicleId) {
  try {
    const { data } = await http.get(`/vehicles/${vehicleId}/status-history`)
    historyItems.value = data.items || []
  } catch (e) {
    historyItems.value = []
  }
}

// NUEVOS filtros (reemplaza la línea actual de filters)
const filters = ref({
  query: '',
  groupId: '',
  unitId: '',
  category: '',
  estado: '',
  onlyAssigned: false,
  hasOpenUse: false,
})

// Computed para dependencias Grupo -> Unidad (añadir)
const unidadesFiltrado = computed(() => {
  if (!filters.value.groupId) return unidades.value
  return unidades.value.filter(u => String(u.groupId) === String(filters.value.groupId))
})

// reset (actualiza para limpiar todo y recargar)
function resetFilters() {
  filters.value = {
    query: '',
    groupId: '',
    unitId: '',
    category: '',
    estado: '',
    onlyAssigned: false,
    hasOpenUse: false,
  }
  loadVehicles()
}

// loadVehicles (actualiza para enviar los nuevos filtros)
async function loadVehicles() {
  loading.value = true
  try {
    const params = {
      page: 1,
      pageSize: 500,
      query: filters.value.query || undefined,
      groupId: filters.value.groupId || undefined,
      unitId: filters.value.unitId || undefined,
      category: filters.value.category || undefined,
      estado: filters.value.estado || undefined,
      onlyAssigned: filters.value.onlyAssigned ? 1 : undefined,
      hasOpenUse: filters.value.hasOpenUse ? 1 : undefined,
    }
    const { data } = await http.get('/vehicles', { params })
    vehicles.value = data.items || []
  } catch (e) {
    console.error('[VehiclesView] loadVehicles error', e)
    vehicles.value = []
  } finally {
    loading.value = false
  }
}

// Vencimientos
const dueWithin = ref(30)
const loadingDue = ref(false)
const dueItems = ref([])

async function loadDue() {
  loadingDue.value = true
  try {
    const { data } = await http.get('/vehicles/due', {
      params: { within: dueWithin.value }
    })
    dueItems.value = data.items || []
  } catch (e) {
    console.error('[VehiclesView] loadDue error', e)
    dueItems.value = []
  } finally {
    loadingDue.value = false
  }
}

async function confirmDeleteVehicle(v) {
  if (confirm(`¿Eliminar vehículo ${v.code} (${v.sigla})? Esta acción no se puede deshacer.`)) {
    try {
      await http.delete(`/vehicles/${v.id}`)
      loadVehicles()
    } catch (e) {
      alert(e?.response?.data?.error || 'Error al eliminar vehículo')
    }
  }
}

const grupos = ref([])
const unidades = ref([])

const showAddVehicle = ref(false)
const addVehicleLoading = ref(false)
const addVehicleError = ref('')

const unidadesPorGrupoAdd = computed(() => {
  if (!addVehicleForm.value.groupId) return unidades.value
  return unidades.value.filter(u => String(u.groupId) === String(addVehicleForm.value.groupId))
})
const unidadesPorGrupoEdit = computed(() => {
  if (!editVehicleForm.value.groupId) return unidades.value
  return unidades.value.filter(u => String(u.groupId) === String(editVehicleForm.value.groupId))
})

// Helpers para números opcionales (convierte ''/undefined en null)
function numOrNull(v) {
  if (v === '' || v === undefined || v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// ====== ADD ======
const addVehicleForm = ref({
  code: '',
  estado: 'SERVICIO',
  odometer: null,          // requerido (≥0)
  oil_last_km: null,       // opcional (≥0)
  oil_interval_km: null,   // opcional (>0)
  soatDate: '',
  tecnoDate: '',
  category: '',
  groupId: '',
  unitId: ''
})

async function submitAddVehicle() {
  addVehicleLoading.value = true
  addVehicleError.value = ''
  try {
    // Validación rápida en front (odometer requerido)
    if (addVehicleForm.value.odometer === null || addVehicleForm.value.odometer < 0) {
      addVehicleError.value = 'Kilometraje requerido (≥ 0).'
      return
    }

    const payload = {
      code: addVehicleForm.value.code,
      estado: addVehicleForm.value.estado,
      odometer: Number(addVehicleForm.value.odometer),
      oil_last_km: numOrNull(addVehicleForm.value.oil_last_km),
      oil_interval_km: numOrNull(addVehicleForm.value.oil_interval_km),
      soatDate: addVehicleForm.value.soatDate,
      tecnoDate: addVehicleForm.value.tecnoDate,
      category: addVehicleForm.value.category,
      groupId: addVehicleForm.value.groupId,
      unitId: addVehicleForm.value.unitId
    }

    await http.post('/vehicles', payload)

    showAddVehicle.value = false
    addVehicleForm.value = {
      code: '',
      estado: 'SERVICIO',
      odometer: null,
      oil_last_km: null,
      oil_interval_km: null,
      soatDate: '',
      tecnoDate: '',
      category: '',
      groupId: '',
      unitId: ''
    }
    loadVehicles()
  } catch (e) {
    addVehicleError.value = e?.response?.data?.error || 'Error al agregar vehículo'
  } finally {
    addVehicleLoading.value = false
  }
}

// ====== EDIT ======
const showEditVehicle = ref(false)
const editVehicleForm = ref({
  id: null,
  code: '',
  estado: 'SERVICIO',
  odometer: null,
  oil_last_km: null,
  oil_interval_km: null,
  soatDate: '',
  tecnoDate: '',
  category: '',
  groupId: null,
  unitId: null
})

function openEditVehicle(v) {
  editVehicleForm.value = {
    id: v.id,
    code: v.code,
    estado: v.estado || 'SERVICIO',
    odometer: v.odometer ?? null,
    oil_last_km: v.oil_last_km ?? null,
    oil_interval_km: v.oil_interval_km ?? null,
    soatDate: v.soatDate ? String(v.soatDate).slice(0,10) : '',
    tecnoDate: v.tecnoDate ? String(v.tecnoDate).slice(0,10) : '',
    category: v.category || '',
    groupId: v.groupId ? String(v.groupId) : '',
    unitId: v.unitId ? String(v.unitId) : ''
  }
  showEditVehicle.value = true
}

async function submitEditVehicle() {
  try {
    // Validación rápida (odometer si viene, ≥0)
    if (editVehicleForm.value.odometer !== null && editVehicleForm.value.odometer < 0) {
      alert('Kilometraje debe ser ≥ 0')
      return
    }

    const payload = {
      code: editVehicleForm.value.code,
      estado: editVehicleForm.value.estado,
      odometer: numOrNull(editVehicleForm.value.odometer),
      oil_last_km: numOrNull(editVehicleForm.value.oil_last_km),
      oil_interval_km: numOrNull(editVehicleForm.value.oil_interval_km),
      soatDate: editVehicleForm.value.soatDate,
      tecnoDate: editVehicleForm.value.tecnoDate,
      category: editVehicleForm.value.category,
      groupId: editVehicleForm.value.groupId,
      unitId: editVehicleForm.value.unitId
    }

    await http.put(`/vehicles/${editVehicleForm.value.id}`, payload)
    showEditVehicle.value = false
    loadVehicles()
  } catch (e) {
    alert(e?.response?.data?.error || 'Error al actualizar vehículo')
  }
}


// Catálogos
async function cargarCatalogos() {
  try {
    const [{ data: g }, { data: u }] = await Promise.all([
      http.get('/vehicles/catalogs/groups'),
      http.get('/vehicles/catalogs/units')
    ])
    grupos.value = g.items || []
    unidades.value = u.items || []
  } catch (e) {
    console.error('[VehiclesView] cargarCatalogos error', e)
    grupos.value = []
    unidades.value = []
  }
}

// Acciones modales
function openAssignments(v) {
  currentVehicle.value = v
  showAssign.value = true
}
function openUses(v) {
  currentVehicle.value = v
  showUses.value = true
}
function startUse(v) {
  currentVehicle.value = v
  showControl.value = true
}
function onControlDone() {
  showControl.value = false
  if (activeTab.value === 'due') loadDue()
  else loadVehicles()
}
function onCloseAssign () {
  // cerrar modal
  showAssign.value = false

  // 🔄 refrescar listado de vehículos (placa, asignado, hasOpenUse, etc.)
  loadVehicles()

  // (opcional) si estás en la pestaña de vencimientos, también recárgalos
  if (activeTab.value === 'due') {
    loadDue()
  }
}

function onCloseUses () {
  // cerrar modal
  showUses.value = false

  // 🔄 recargar listado para reflejar usos abiertos/cerrados
  loadVehicles()

  // si quisieras que la tarjeta de vencimientos tenga siempre kms frescos,
  // también podrías recargar due:
  // if (activeTab.value === 'due') loadDue()
}

function onIniciarUso(vehicle) {
  currentVehicle.value = vehicle
  showUses.value = false
  setTimeout(() => {
    showControl.value = true
  }, 150)
}
async function cerrarUso(useId) {
  if (!useId) return
  try {
    if (!confirm('¿Seguro que quieres cerrar este uso?')) return
    await http.patch(`/vehicles/uses/${useId}/end`, {
      odometer_end: null,
      notes: null
    })
    showUses.value = false
    loadVehicles()
  } catch (e) {
    alert(e?.response?.data?.error || 'Error al cerrar el uso')
  }
}
function applyFilters() {
  loadVehicles();
}

let queryTimer = null;
function onQueryInput() {
  clearTimeout(queryTimer);
  queryTimer = setTimeout(() => {
    loadVehicles();
  }, 350); // debounce
}

onUnmounted(() => {
  clearTimeout(queryTimer);
});

onMounted(async () => {
  await cargarCatalogos()
  await loadVehicles()
  await loadDue()
})


</script>
