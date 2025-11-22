// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import ReportView from '../views/ReportView.vue'
import LoginView from '../views/LoginView.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminGroups from '../views/AdminGroups.vue'
import AdminUsers from '../views/AdminUsers.vue'
import Perfil from '../views/Perfil.vue'
import AdminUnits from '../views/AdminUnits.vue'
import AdminAgents from '../views/AdminAgents.vue'
import MainDashboard from '../views/MainDashboard.vue'
import VehiclesView from '../views/VehiclesView.vue'
import AgentDashboard from '../views/AgentDashboard.vue'
import Parte from '../views/Parte.vue'
import ExpensesView from '../views/ExpensesView.vue' 
import ServiceCommissionsView from '@/views/ServiceCommissionsView.vue'

// ⬇️ Usa el layout con sidebar:
import AdminMenuLayout0 from '../views/AdminMenuLayout0.vue'

const AdminReportDetail = () => import('../views/AdminReportDetail.vue')
import { http } from '../lib/http'

// Helper: redirigir por rol
function homeByRole(role) {
  const r = String(role || '').toLowerCase()
  if (r === 'leader_unit') return '/report'
  if (r === 'agent') return '/agent'
  // superadmin / supervision / leader_group / leader_vehicles
  return '/admin'
}

// Rutas
const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginView },
  { path: '/agent', component: AgentDashboard, meta: { requiresAuth: true, roles: ['agent'] } },

  // Vista simple para líder de unidad
  { path: '/report', component: ReportView, meta: { requiresAuth: true, roles: ['leader_unit'] } },

  // Perfil accesible para cualquier rol autenticado (admin-side)
  {
    path: '/perfil',
    component: Perfil,
    meta: { requiresAuth: true, roles: ['superadmin', 'supervision', 'leader_group', 'leader_unit'] }
  },

  // Todo lo de admin bajo el layout con sidebar
  {
    path: '/admin',
    component: AdminMenuLayout0,
    meta: { requiresAuth: true },
    children: [
      // Home del admin
      {
        path: '',
        name: 'AdminHome',
        component: AdminDashboard,
        meta: { roles: ['superadmin', 'supervision', 'leader_group'] }
      },

      // Dashboard principal
      {
        path: 'dashboard',              // 👈 sin /admin delante
        name: 'MainDashboard',
        component: MainDashboard,
        meta: { roles: ['superadmin', 'supervision', 'leader_group'] }
      },

      // Grupos
      {
        path: 'groups',
        name: 'AdminGroups',
        component: AdminGroups,
        meta: { roles: ['superadmin', 'supervision'] }
      },

      // Unidades
      {
        path: 'units',
        name: 'AdminUnits',
        component: AdminUnits,
        meta: { roles: ['superadmin', 'supervision', 'leader_group'] }
      },

      // Usuarios
      {
        path: 'users',
        name: 'AdminUsers',
        component: AdminUsers,
        meta: { roles: ['superadmin'] }
      },

      // Funcionarios
      {
        path: 'agents',
        name: 'AdminAgents',
        component: AdminAgents,
        meta: { roles: ['superadmin', 'supervision', 'leader_group'] }
      },

      // Perfil dentro del layout admin (si lo usas)
      {
        path: 'perfil',
        name: 'PerfilAdmin',
        component: Perfil,
        meta: { roles: ['superadmin', 'supervision', 'leader_group', 'leader_unit'] }
      },

      // Detalle de reportes
      {
        path: 'report/:id',
        name: 'ReportUnit',
        component: AdminReportDetail,
        meta: { roles: ['superadmin', 'supervision', 'leader_group'] }
      },
      {
        path: 'report',
        name: 'ReportGroup',
        component: AdminReportDetail,
        meta: { roles: ['superadmin', 'supervision', 'leader_group'] }
      },

      // Log de eventos
      {
        path: 'audit',
        name: 'AuditLog',
        component: () => import('@/views/AdminAuditLog.vue'),
        meta: { roles: ['superadmin'] }
      },

      // Parte
      { 
        path: 'parte',
        name: 'Parte',
        component: Parte,
        meta: { roles: ['superadmin', 'supervision', 'leader_group'] }
      },

      // Vehículos
      {
        path: 'vehicles',
        name: 'AdminVehicles',
        component: VehiclesView,
        meta: { roles: ['superadmin', 'leader_vehicles'] }
      },

      // 💰 GASTOS (aquí se ve tu tabla de proyección para COMISIÓN DEL SERVICIO)
      {
        path: 'expenses',
        name: 'AdminExpenses',
        component: ExpensesView,
        meta: { roles: ['superadmin'] }
      },
      // 🧾 Comisiones de servicio (derivadas de la proyección)
      {
        path: 'service-commissions',
        name: 'ServiceCommissions',
        component: ServiceCommissionsView,
        meta: { roles: ['superadmin', 'supervision', 'gastos'] }
      }
    ]
  },

  // Fallback
  { path: '/:pathMatch(.*)*', redirect: '/admin' }
]

const router = createRouter({
  history: createWebHistory('/login/'),
  routes
})

// ====== Guarda de navegación ======
async function getMe() {
  try {
    const { data } = await http.get('/me')
    return data
  } catch {
    return null
  }
}

router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('token')

  // 1) /login: si hay token, mandamos al home por rol (pero evitando bucle)
  if (to.path === '/login') {
    if (!token) return next()

    const me = await getMe()
    if (!me) {
      localStorage.removeItem('token')
      return next()
    }

    const target = homeByRole(me.role)
    if (target === to.path) return next() // ya estamos donde toca
    return next(target)
  }

  // 2) / : root → manda al home por rol o a /login
  if (to.path === '/') {
    if (!token) return next('/login')

    const me = await getMe()
    if (!me) {
      localStorage.removeItem('token')
      return next('/login')
    }

    const target = homeByRole(me.role)
    if (target === to.path) return next()
    return next(target)
  }

  // 3) Resto de rutas requiere token
  if (!token) return next('/login')

  const me = await getMe()
  if (!me) {
    localStorage.removeItem('token')
    return next('/login')
  }

  const role = String(me.role || '').toLowerCase()

  // 4) Si la ruta pide auth explícito o es /admin*/report
  if (to.meta?.requiresAuth || to.path.startsWith('/admin') || to.path === '/report') {
    // 4.1) Roles declarados en meta
    if (to.meta?.roles && Array.isArray(to.meta.roles) && to.meta.roles.length) {
      const allowed = to.meta.roles.map(r => r.toLowerCase())
      if (!allowed.includes(role)) {
        const target = homeByRole(role)
        if (target === to.path) return next()
        return next(target)
      }
      return next()
    }

    // 4.2) Sin roles explícitos
    if (to.path.startsWith('/admin')) {
      // Admin general
      if (['superadmin', 'supervision', 'leader_group'].includes(role)) {
        return next()
      }

      // leader_vehicles → solo /admin/vehicles
      if (role === 'leader_vehicles') {
        if (to.path.startsWith('/admin/vehicles')) {
          return next()
        }
        if (to.path !== '/admin/vehicles') {
          return next('/admin/vehicles')
        }
        return next()
      }

      if (role === 'leader_unit') return next('/report')
      if (role === 'agent') return next('/agent')

      return next('/login')
    }

    // /report es solo leader_unit
    if (to.path === '/report') {
      if (role === 'leader_unit') return next()
      const target = homeByRole(role)
      if (target === to.path) return next()
      return next(target)
    }
  }

  // 5) Rutas que no requieren nada especial
  return next()
})

export default router
