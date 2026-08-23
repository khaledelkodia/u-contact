import { createRouter, createWebHistory } from 'vue-router'
import { session, isAuthed } from './api'
import Login from './views/Login.vue'
import Agents from './views/admin/Agents.vue'
import Companies from './views/admin/Companies.vue'
import Reports from './views/admin/Reports.vue'
import AgentHome from './views/agent/Home.vue'
import Users from './views/agent/Users.vue'
import Orders from './views/agent/Orders.vue'
import CallcenterApp from './callcenter/CallcenterApp.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: () => (session.mode === 'agent' ? '/app/callcenter' : '/admin/agents') },
    // دخول اليوزر العادي (افتراضي) — ودخول السوبر‑أدمن على مسار /admin منفصل
    { path: '/login', component: Login, meta: { admin: false } },
    { path: '/admin', component: Login, meta: { admin: true } },
    // Super-admin app
    { path: '/admin/agents', component: Agents, meta: { mode: 'admin' } },
    { path: '/admin/companies', component: Companies, meta: { mode: 'admin' } },
    { path: '/admin/reports', component: Reports, meta: { mode: 'admin' } },
    // Agent app
    { path: '/app', component: AgentHome, meta: { mode: 'agent' } },
    { path: '/app/orders', component: Orders, meta: { mode: 'agent' } },
    { path: '/app/callcenter', component: CallcenterApp, meta: { mode: 'agent', fullLayout: true } },
    { path: '/app/users', component: Users, meta: { mode: 'agent' } },
  ],
})

const isLoginRoute = (p: string) => p === '/login' || p === '/admin'

router.beforeEach((to) => {
  if (isLoginRoute(to.path)) {
    if (!isAuthed()) return true
    return session.mode === 'admin' ? '/admin/agents' : '/app/callcenter'
  }
  if (!isAuthed()) return to.path.startsWith('/admin') ? '/admin' : '/login'
  if (to.meta.mode && to.meta.mode !== session.mode) return '/' // منع خلط الأدوار
})

export default router
