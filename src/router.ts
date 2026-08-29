import { createRouter, createWebHistory } from 'vue-router'
import { session, isAuthed, scopeIncomplete, currentCompany } from './api'
import Login from './views/Login.vue'
import Agents from './views/admin/Agents.vue'
import Companies from './views/admin/Companies.vue'
import Reports from './views/admin/Reports.vue'
import CallcenterApp from './callcenter/CallcenterApp.vue'
import { CC_ROUTES, firstAllowed } from './callcenter/ccRoutes'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // غير مسجّل ⇒ شاشة الدخول الموحّدة. كان يوجَّه إلى `/admin/agents` فيرتدّ إلى دخول
    // المشرف العام، فيجد فاتحُ الرابط شاشةً ليست له. المسجّل يذهب لواجهته كما كان.
    { path: '/', redirect: () => (!isAuthed() ? '/login' : session.mode === 'agent' ? '/app' : '/admin/agents') },
    // دخول المستخدم العادي (افتراضي) — ودخول السوبر‑أدمن على مسار /admin منفصل
    { path: '/login', component: Login, meta: { admin: false } },
    { path: '/admin', component: Login, meta: { admin: true } },
    // Super-admin app
    { path: '/admin/agents', component: Agents, meta: { mode: 'admin' } },
    { path: '/admin/companies', component: Companies, meta: { mode: 'admin' } },
    { path: '/admin/reports', component: Reports, meta: { mode: 'admin' } },
    // ── تطبيق الوكيل: شاشةٌ لكل مسار ─────────────────────────────────────
    // كان المركز كلّه مساراً واحداً، وبجواره «شلٌّ قديم» بثلاث شاشاتٍ مكرَّرة
    // (`/app` و`/app/orders` و`/app/users`) لها نسخٌ أحدث داخل المركز — حُذفت،
    // فتحرّرت مساراتها للشاشات الحقيقية.
    ...CC_ROUTES.map((r) => ({
      path: r.path,
      component: CallcenterApp,
      meta: { mode: 'agent', fullLayout: true, view: r.view, anyOf: r.anyOf },
    })),
  ],
})

const isLoginRoute = (p: string) => p === '/login' || p === '/admin'

/**
 * وكيلٌ دخل ولم يؤكّد نطاقه بعد — مكانه شاشة الاختيار لا التطبيق.
 *
 * والنطاق ناقصٌ كذلك حين تكون للشركة امتيازات ولم يُختَر واحد: العمل على النطاق
 * `0` يعني بلا فرعٍ ولا منيو ولا يوم عمل، فيقف كلُّ طلبٍ صامتاً. يشمل هذا
 * الجلسات القديمة التي أُكِّدت قبل أن يصير الاختيار إلزامياً.
 */
const needsScope = () => isAuthed() && scopeIncomplete()

router.beforeEach((to) => {
  if (isLoginRoute(to.path)) {
    if (!isAuthed()) return true
    // ريفريش على شاشة «اختر الشركة»: يبقى عليها بدل أن يُقذف داخل التطبيق
    if (needsScope()) return true
    return session.mode === 'admin' ? '/admin/agents' : '/app'
  }
  if (!isAuthed()) return to.path.startsWith('/admin') ? '/admin' : '/login'
  if (to.meta.mode && to.meta.mode !== session.mode) return '/' // منع خلط الأدوار
  if (needsScope()) return '/login'
  // ── صلاحية الشاشة ──────────────────────────────────────────────────────
  // القائمة تُخفي ما لا يملكه الوكيل، لكن الرابط المباشر كان يفتحه: شاشةٌ بلا
  // صلاحية تُعرَض فارغةً أو تُطلق نداءات تُرَدّ 403. الحارس يوجّهه لأوّل شاشةٍ
  // يملكها بدل بابٍ خلفيّ.
  const need = (to.meta as any)?.anyOf as string[] | undefined
  if (need && need.length) {
    const perms: string[] = (currentCompany() as any)?.permissions || []
    if (!need.some((p) => perms.includes(p))) {
      const alt = firstAllowed(perms)
      return alt && alt.path !== to.path ? alt.path : '/login'
    }
  }
})

export default router
