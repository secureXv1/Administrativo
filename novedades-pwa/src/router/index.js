import { createRouter, createWebHistory } from 'vue-router'
import ReportView from '../views/ReportView.vue'
import LoginView from '../views/LoginView.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminGroups from '../views/AdminGroups.vue'
import AdminUsers from '../views/AdminUsers.vue'
import AdminAgents from '../views/AdminAgents.vue'
import AdminReportDetail from '../views/AdminReportDetail.vue'
import Perfil from '../views/Perfil.vue'
import AdminUnits from '../views/AdminUnits.vue' // <--- IMPORTA TU VISTA DE UNIDADES NORMAL
import AdminMenuLayout from '../views/AdminMenuLayout.vue'
import { http } from '../lib/http'

// ===== Rutas principales =====
const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginView },
  { path: '/report', component: ReportView },
  // Redirección opcional para URLs viejas
  { path: '/perfil', redirect: '/admin/perfil' },

  // === Agrupa rutas de admin bajo el layout ===
  {
    path: '/admin',
    component: AdminMenuLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', component: AdminDashboard },              // /admin
      { path: 'groups', component: AdminGroups },           // /admin/groups
      { path: 'units', component: AdminUnits, meta: { roles: ['leader_group', 'superadmin', 'supervision'] } }, // /admin/units
      { path: 'users', component: AdminUsers },             // /admin/users
      { path: 'agents', component: AdminAgents },           // /admin/agents
      { path: 'report/:id', component: AdminReportDetail }, // /admin/report/:id
      { path: 'perfil', component: Perfil },                // /admin/perfil
    ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

// ========== Guarda y navegación ==========
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
  // Permitir acceso libre solo al login
  if (!token && to.path !== '/login') return next('/login')
  if (to.path === '/login') return next()

  const me = await getMe()
  if (!me) return next('/login')

  const role = String(me.role || '').toLowerCase()

  // Permitir acceso a /admin/perfil y /report para todos autenticados
  if (to.path === '/admin/perfil' || to.path === '/report') return next()

  // SUPERADMIN o SUPERVISION o LEADER_GROUP: acceso total a /admin/*
  if (role === 'superadmin' || role === 'supervision' || role === 'leader_group') {
    if (!to.path.startsWith('/admin')) return next('/admin')
    return next()
  }

  // LEADER_UNIT: acceso solo a /report
  if (role === 'leader_unit') {
    if (to.path !== '/report' && to.path !== '/admin/perfil') return next('/report')
    return next()
  }

  // Cualquier otro caso, fuera
  return next('/login')
})

export default router
