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

// Rutas
const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginView },
  { path: '/report', component: ReportView },       // vista simple para leader_unit
  { path: '/perfil', redirect: '/admin/perfil' },

  // Todo lo de admin bajo el layout
  {
    path: '/admin',
    component: AdminMenuLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'AdminHome', component: AdminDashboard },

      // Grupos: solo superadmin/supervision/supervisor
      { path: 'groups', name: 'AdminGroups', component: AdminGroups, meta: { roles: ['superadmin', 'supervision', 'supervisor'] } },

      // Unidades: leader_group + admin + supervision + supervisor (UI controla edición)
      { path: 'units', name: 'AdminUnits', component: AdminUnits, meta: { roles: ['leader_group', 'superadmin', 'supervision', 'supervisor'] } },

      { path: 'users', name: 'AdminUsers', component: AdminUsers },
      { path: 'agents', name: 'AdminAgents', component: AdminAgents },

      { path: 'perfil', name: 'Perfil', component: Perfil },

      // Detalle por UNIDAD (id de dailyreport)
      { path: 'report/:id', name: 'ReportUnit', component: AdminReportDetail },

      // Detalle por GRUPO (admin/supervision/supervisor) -> /admin/report?date=YYYY-MM-DD&groupId=123
      { path: 'report', name: 'ReportGroup', component: AdminReportDetail, meta: { roles: ['superadmin', 'supervision', 'supervisor'] } }
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

  // Solo /login es libre
  if (!token && to.path !== '/login') return next('/login')
  if (to.path === '/login') return next()

  const me = await getMe()
  if (!me) return next('/login')

  const role = String(me.role || '').toLowerCase()

  // Accesos siempre permitidos
  if (to.path === '/report' || to.path === '/admin/perfil') return next()

  // Rutas con roles explícitos
  if (to.meta?.roles && Array.isArray(to.meta.roles)) {
    if (!to.meta.roles.map(r => r.toLowerCase()).includes(role)) {
      // Si no tiene el rol, intenta mandarlo a su “home” válido
      if (['superadmin', 'supervision', 'supervisor', 'leader_group'].includes(role)) {
        return next('/admin')
      }
      if (role === 'leader_unit') return next('/report')
      return next('/login')
    }
    return next()
  }

  // Acceso general a /admin/*
  if (to.path.startsWith('/admin')) {
    // incluye supervisor
    if (['superadmin', 'supervision', 'supervisor', 'leader_group'].includes(role)) {
      return next()
    }
    if (role === 'leader_unit') return next('/report')
    return next('/login')
  }

  return next()
})

export default router
