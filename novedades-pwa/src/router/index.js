import { createRouter, createWebHistory } from 'vue-router'
import ReportView from '../views/ReportView.vue'
import LoginView from '../views/LoginView.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminGroups from '../views/AdminGroups.vue'
import AdminUsers from '../views/AdminUsers.vue'
import AdminAgents from '../views/AdminAgents.vue'
import { http } from '../lib/http'
import AdminReportDetail from '../views/AdminReportDetail.vue'


const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginView },
  { path: '/report', component: ReportView },
  { path: '/admin', component: AdminDashboard },
  { path: '/admin/groups', component: AdminGroups },
  { path: '/admin/agents', component: AdminAgents },
  { path: '/admin/users', component: AdminUsers },
  { path: '/admin/report/:id', component: AdminReportDetail },
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

  if (!token && to.path !== '/login') return next('/login')
  if (to.path === '/login') return next()

  const me = await getMe()
  if (!me) return next('/login')

  const role = String(me.role || '').toLowerCase()

  if (role === 'admin') {
    if (!to.path.startsWith('/admin')) return next('/admin')
    return next()
  }
  if (role === 'leader') {
    if (to.path.startsWith('/admin')) return next('/report')
    return next()
  }
  return next('/login')
})

export default router
