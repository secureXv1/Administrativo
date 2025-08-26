import { createRouter, createWebHistory } from 'vue-router'
import ReportView from '../views/ReportView.vue'
import LoginView from '../views/LoginView.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminGroups from '../views/AdminGroups.vue'
import AdminUsers from '../views/AdminUsers.vue'
import AdminAgents from '../views/AdminAgents.vue'
import { http } from '../lib/http'
import AdminReportDetail from '../views/AdminReportDetail.vue'
import Perfil from '../views/Perfil.vue'




const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginView },
  { path: '/report', component: ReportView },
  { path: '/admin', component: AdminDashboard },
  { path: '/admin/groups', component: AdminGroups },
  { path: '/admin/agents', component: AdminAgents },
  { path: '/admin/users', component: AdminUsers },
  { path: '/admin/report/:id', component: AdminReportDetail },
  

  
  {
    path: '/perfil',
    name: 'Perfil',
    component: Perfil,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({ history: createWebHistory(), routes })

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

  // Permitir acceso a /perfil y /report para todos autenticados
  if (to.path === '/perfil' || to.path === '/report') return next()

  // SUPERADMIN o SUPERVISION o LEADER_GROUP: acceso total a /admin/*
  if (role === 'superadmin' || role === 'supervision' || role === 'leader_group') {
    if (!to.path.startsWith('/admin')) return next('/admin')
    return next()
  }

  
  // LEADER_UNIT: acceso solo a /report
  if (role === 'leader_unit') {
    if (to.path !== '/report' && to.path !== '/perfil') return next('/report')
    return next()
  }

  // Cualquier otro caso, fuera
  return next('/login')
})


export default router
