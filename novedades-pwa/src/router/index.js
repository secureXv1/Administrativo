import { createRouter, createWebHistory } from 'vue-router'
import ReportView from '../views/ReportView.vue'
import LoginView from '../views/LoginView.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminGroups from '../views/AdminGroups.vue'
import AdminUsers from '../views/AdminUsers.vue'
import AdminAgents from '../views/AdminAgents.vue'
import Perfil from '../views/Perfil.vue'
import AdminUnits from '../views/AdminUnits.vue'
import AdminMenuLayout from '../views/AdminMenuLayout.vue'
const AdminReportDetail = () => import('../views/AdminReportDetail.vue')
import { http } from '../lib/http'

// Helper: redirigir por rol
function homeByRole(role) {
  const r = String(role || '').toLowerCase()
  if (r === 'leader_unit') return '/report'
  // superadmin / supervision / leader_group
  return '/admin'
}

// Rutas
const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginView },

  // Vista simple para líder de unidad
  { path: '/report', component: ReportView, meta: { requiresAuth: true, roles: ['leader_unit'] } },

  // Perfil accesible para cualquier rol autenticado
  {
    path: '/perfil',
    component: Perfil,
    meta: { requiresAuth: true, roles: ['superadmin','supervision','leader_group','leader_unit'] }
  },

  // Todo lo de admin bajo el layout
  {
    path: '/admin',
    component: AdminMenuLayout,
    meta: { requiresAuth: true },
    children: [
      // Dashboard (superadmin/supervision/leader_group)
      { path: '', name: 'AdminHome', component: AdminDashboard, meta: { roles: ['superadmin', 'supervision', 'leader_group'] } },

      // Grupos (superadmin/supervision)
      { path: 'groups', name: 'AdminGroups', component: AdminGroups, meta: { roles: ['superadmin', 'supervision'] } },

      // Unidades (superadmin/supervision/leader_group)
      { path: 'units',  name: 'AdminUnits',  component: AdminUnits,  meta: { roles: ['superadmin', 'supervision', 'leader_group'] } },

      // Usuarios: SOLO superadmin
      { path: 'users',  name: 'AdminUsers',  component: AdminUsers,  meta: { roles: ['superadmin'] } },

      // Agentes (superadmin/supervision/leader_group)
      { path: 'agents', name: 'AdminAgents', component: AdminAgents, meta: { roles: ['superadmin', 'supervision', 'leader_group'] } },

      // (Opcional) Perfil también bajo /admin, pero con roles explícitos (incluye leader_unit)
      { path: 'perfil', name: 'PerfilAdmin', component: Perfil, meta: { roles: ['superadmin','supervision','leader_group','leader_unit'] } },

      // Detalle de reporte: permitido a superadmin/supervision/leader_group
      { path: 'report/:id', name: 'ReportUnit', component: AdminReportDetail, meta: { roles: ['superadmin', 'supervision', 'leader_group'] } },
      { path: 'report',     name: 'ReportGroup', component: AdminReportDetail, meta: { roles: ['superadmin', 'supervision', 'leader_group'] } },

      // Log de eventos (solo superadmin)
      { path: 'audit', name: 'AuditLog', component: () => import('@/views/AdminAuditLog.vue'), meta: { roles: ['superadmin'] } },
    ]
  },

  // Fallback
  { path: '/:pathMatch(.*)*', redirect: '/admin' }
]

const router = createRouter({ history: createWebHistory(), routes })

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

  // /login libre: si ya hay token, manda al home por rol
  if (to.path === '/login') {
    if (!token) return next()
    const me = await getMe()
    if (!me) return next()
    return next(homeByRole(me.role))
  }

  // Resto requiere token
  if (!token) return next('/login')

  const me = await getMe()
  if (!me) return next('/login')

  const role = String(me.role || '').toLowerCase()

  // Si la ruta pide auth explícito, verificar
  if (to.meta?.requiresAuth || to.path.startsWith('/admin') || to.path === '/report') {
    // Si la ruta define roles, validar
    if (to.meta?.roles && Array.isArray(to.meta.roles) && to.meta.roles.length) {
      const allowed = to.meta.roles.map(r => r.toLowerCase())
      if (!allowed.includes(role)) {
        return next(homeByRole(role))
      }
      return next()
    }

    // Sin roles explícitos:
    if (to.path.startsWith('/admin')) {
      if (['superadmin', 'supervision', 'leader_group'].includes(role)) return next()
      if (role === 'leader_unit') return next('/report')
      return next('/login')
    }

    if (to.path === '/report') {
      // /report es solo leader_unit
      if (role === 'leader_unit') return next()
      return next(homeByRole(role))
    }
  }

  return next()
})

export default router
