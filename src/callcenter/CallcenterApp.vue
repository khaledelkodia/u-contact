<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import ccStyles from './style.css?inline'
import { state, initData, loadLiveData, loadBusinessDay, openDayModal, closeBusinessDay, loadOrders, loadStoppedItems, loadCcStoppedItems, mergeOrderRows, applyBranchPresence, applyBranchDay, applyCcDay, dismissToast, startNewOrder, resetOrdersBrowsing } from './store'
import { t, tx, lang, locale, toggleLang, applyDir } from './lang'
import { EMPLOYEES } from './data'
import { icon } from './icons'
import { session, currentCompany, currentFranchise, setCompany, setFranchise, logout as apiLogout, contactOrdersStreamUrl, trueNow, clockOff } from '../api'

const router = useRouter()
import ConfirmBox from './components/ConfirmBox.vue'
import OpenDayModal from './components/OpenDayModal.vue'
import DashboardView from './views/DashboardView.vue'
import DaySettingsView from './views/DaySettingsView.vue'
import RolesView from './views/RolesView.vue'
import NewOrderView from './views/NewOrderView.vue'
import OrdersView from './views/OrdersView.vue'
import ScheduledOrdersView from './views/ScheduledOrdersView.vue'
import SettingsView from './views/SettingsView.vue'
import StoppedItemsView from './views/StoppedItemsView.vue'
import ComplaintsView from './views/ComplaintsView.vue'
import OrderModals from './components/OrderModals.vue'
import PaymentModal from './components/PaymentModal.vue'
import ItemModal from './components/ItemModal.vue'
import UsersView from '../views/agent/Users.vue'   // إدارة المستخدمين (U-Contact) جوّه الشِل الموحّد

// ── حقن CSS التصميم فقط أثناء وجود الشاشة (عزل عن باقي U-Contact، بلا تغيير الـCSS) + Font Awesome ──
let styleEl: HTMLStyleElement | null = null
let faEl: HTMLLinkElement | null = null
const prevDir = document.documentElement.dir

// ── حالة الدخول (مووك 1:1 ضد EMPLOYEES — نقطة دمج: تُستبدل بـauth الوكيل لاحقاً) ──
const username = ref('')
const password = ref('')
const loginError = ref('')
const loggedIn = computed(() => !!state.currentUser)

function submitLogin() {
  const u = username.value.trim(); const p = password.value.trim()
  if (!u || !p) { loginError.value = 'الرجاء إدخال اسم المستخدم وكلمة المرور'; return }
  const user = state.employees.find((e: any) => e.username === u && e.password === p)
  if (!user) { loginError.value = 'اسم المستخدم أو كلمة المرور غير صحيحة'; return }
  loginError.value = ''
  localStorage.setItem('pos_user', JSON.stringify(user))
  loginSuccess(user)
}
function loginSuccess(user: any) {
  state.currentUser = user
  state.currentBranch = user.branch === 'all' ? state.branches[0] : (state.branches.find((b: any) => b.id === user.branch) || state.branches[0])
}
// الكول‑سنتر بقى واجهة الوكيل الموحّدة → «تسجيل الخروج» = خروج كامل ورجوع للّوجين
function logout() { apiLogout(); router.push('/login') }
const roleLabel = computed(() => {
  const r = state.currentUser?.role
  if (lang.value === 'en') return r === 'admin' ? 'System Admin' : r === 'supervisor' ? 'Supervisor' : 'Call Center Agent'
  return r === 'admin' ? 'مدير النظام' : r === 'supervisor' ? 'مشرف' : 'موظف كول سنتر'
})
// الدور هنا كان مشتقّاً من (فتح **أو** قفل) معاً، فمَن يملك الفتح وحده كان يرى زرّ
// الإنهاء. مفتاحٌ لكل زرّ: هذا الزرّ لـ`callcenter.close` وحدها.
const canEod = computed(() => can('callcenter.close'))

// ── الساعة (setInterval كل ثانية) ──
// ساعة **الشركة** لا ساعة الجهاز: الوكيل قد يجلس في مصر ويخدم شركةً في عُمان، فساعته
// 11م وساعتها 12ص — يومان مختلفان. ويُصحَّح بانحراف ساعة جهازه عن الخادم، فلو كانت
// ساعته هي المضبوطة خطأً تظلّ ساعة الشركة صحيحة.
// بلا منطقة معروفة للشركة نرجع لساعة الجهاز — سلوك اليوم بالضبط، فلا ينكسر شيء.
const clock = ref('00:00:00')
const clockZone = ref<string | null>(null)   // اسم البلد بجوار الساعة (فارغ = ساعة الجهاز)
let clockTimer: any
function tick() {
  const c = currentCompany()
  const tz = c?.timezone || null
  const now = trueNow()
  if (tz) {
    try {
      clock.value = now.toLocaleTimeString(locale(), { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: tz })
      clockZone.value = c?.countryNameAr || tz
      return
    } catch { /* منطقة فاسدة — نسقط للجهاز */ }
  }
  clock.value = now.toLocaleTimeString(locale(), { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' })
  clockZone.value = null
}

// ── تحديث لحظي لحالات الطلبات عبر SSE (بدل البولينج) ──
let ordersES: EventSource | null = null
let ordersDebounce: any
function scheduleOrdersRefresh() {   // debounce: تجميع الأحداث المتتابعة في تحديث واحد
  clearTimeout(ordersDebounce)
  ordersDebounce = setTimeout(() => { if (state.live) void loadOrders() }, 400)
}
// الحدث صار يحمل الصفوف المتغيّرة: ندمجها في مكانها بلا أي طلب شبكة. إعادة الجلب تبقى
// للحالات التي لا يغطّيها الدمج فقط (طلب جديد غير معروض، أو حدث بلا حمولة من خادم قديم).
function onOrderEvent(ev: MessageEvent) {
  if (!state.live) return
  let rows: any[] | null = null
  try { rows = JSON.parse(ev.data)?.orders ?? null } catch { rows = null }   // خادم قديم يبعث رقماً
  if (rows && mergeOrderRows(rows)) return    // غُطّي كل شيء ⇒ لا إعادة جلب
  scheduleOrdersRefresh()
}
function openOrdersStream() {
  closeOrdersStream()
  const url = contactOrdersStreamUrl()
  if (!url) return
  ordersES = new EventSource(url)
  ordersES.addEventListener('order', onOrderEvent as EventListener)   // تغيّر طلب (إنشاء/حالة)
  // إيقاف/تشغيل صنف — من مطبخ الـPOS أو من وكيل كول‑سنتر آخر → حدّث القائمتين لحظياً
  ordersES.addEventListener('availability', () => { void loadStoppedItems(); void loadCcStoppedItems() })
  // حضور فرع (اتصل/انقطع): يحدّث شريط الجاهزيّة فوراً، ويُنبّه حين يعود فرعٌ عليه طلب واقف
  ordersES.addEventListener('branch', (ev: any) => {
    try {
      const d = JSON.parse(ev.data)
      if (d && typeof d.branchId === 'number') applyBranchPresence(d.branchId, !!d.online)
    } catch { /* حمولة غير متوقّعة — نتجاهلها بلا ضجيج */ }
  })
  // يوم الفرع تغيّر (قفل/فتح على الـPOS) — يصل لحظياً: الـPOS يبثّ محلياً ← الكونكتور
  // يسمعه فيبدأ دورةً فوراً ← الهاندشيك يحمل اليوم الجديد ← الكلاود يبثّه هنا.
  ordersES.addEventListener('branchDay', (ev: any) => {
    try {
      const d = JSON.parse(ev.data)
      if (d && typeof d.branchId === 'number') applyBranchDay(d.branchId, d.businessDate ?? null)
    } catch { /* حمولة غير متوقّعة — نتجاهلها بلا ضجيج */ }
  })
  // يوم الكول‑سنتر نفسه — وكيلٌ آخر فتحه أو أنهاه
  ordersES.addEventListener('ccDay', (ev: any) => {
    try { applyCcDay(JSON.parse(ev.data)) } catch { /* كما فوق */ }
  })
  // (نبضة keepalive «ping» تُتجاهل — مجرد إبقاء القناة حيّة)
}
function closeOrdersStream() {
  if (ordersES) { ordersES.close(); ordersES = null }
  clearTimeout(ordersDebounce)
}

// ── يوم العمل (localStorage) ──
const BUSINESS_DATE_KEY = 'pos_business_date'
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function initBusinessDate() {
  const saved = localStorage.getItem(BUSINESS_DATE_KEY)
  state.businessDate = saved || todayISO()
  if (!saved) localStorage.setItem(BUSINESS_DATE_KEY, state.businessDate)
}
/**
 * يوم العمل المعروض = **يوم الكول‑سنتر المفتوح على الخادم** لا تاريخ الجهاز.
 *
 * كان يُقرأ من `state.businessDate` وهو محليّ بحت (localStorage أو تاريخ اليوم)، فيعرض
 * الهيدر «اليوم» بينما الطلبات تُختَم بيومٍ مفتوحٍ قد يسبقه بأيام — وهو الرقم الذي
 * يقارنه حارسُ الكونكتور بيوم الفرع ليقرّر هل ينزل الطلب. عرضُ تاريخٍ غير الذي يعمل
 * به النظام يجعل الوكيل يظن اليومَين متطابقين وهما ليسا كذلك.
 */
const openDayISO = computed<string | null>(() => {
  const d = (state.onlineDay as any)?.businessDate
  return d ? String(d).slice(0, 10) : null
})
const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('ar-KW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const businessDateLabel = computed(() => {
  if (state.live) return openDayISO.value ? fmtDay(openDayISO.value) : 'لم يُفتح يوم'
  return state.businessDate ? fmtDay(state.businessDate) : '--'
})

// ── الوضع الليلي (body.dark-mode) ──
const dark = ref(false)
function toggleTheme() { dark.value = !dark.value; document.body.classList.toggle('dark-mode', dark.value) }

// ── الصلاحيات (من هوية الوكيل في U-Contact) — تتحكّم في ظهور عناصر السايدبار ──
const myPerms = computed<string[]>(() => currentCompany()?.permissions || [])
function can(perm: string) { return myPerms.value.includes(perm) }
function hasAny(perms: string[]) { return perms.some((p) => myPerms.value.includes(p)) }
// صلاحيات شاشة الكول‑سنتر (ضرب الطلب)، وصلاحيات تستحق لوحة التحكم الرئيسية
const ORDER_PERMS = ['callcenter.view', 'callcenter.create', 'callcenter.edit']
const DASH_PERMS = ['callcenter.users', 'complaints.view', 'complaints.manage', 'callcenter.manage']
const dashboardWorthy = computed(() => hasAny(DASH_PERMS))
const canOrders = computed(() => hasAny(ORDER_PERMS))
// عناصر الهيدر (التاريخ/طلب جديد/إنهاء اليوم) خاصة بشاشات الكول‑سنتر فقط — تختفي في الرئيسية
const CALLCENTER_VIEWS = ['new-order', 'orders', 'scheduled-orders']
const isCallcenterView = computed(() => CALLCENTER_VIEWS.includes(state.activeView))

// ── مبدّل الشركة/الفرنشايز في السايدبار الموحّد (لوكيل متعدّد الشركات/الفروع) ──
const cur = computed(() => currentCompany())
const curFr = computed(() => currentFranchise())
const coName = (c: any) => (lang.value === 'ar' ? (c?.nameAr || c?.name) : (c?.name || c?.nameAr))
function pickCompany(e: any) { setCompany(Number(e.target.value)) }        // يعيد تحميل فروع الشركة تلقائياً
function pickFranchise(e: any) { const v = e.target.value; setFranchise(v ? Number(v) : null) }

// ── التنقّل بين الشاشات ──
const NAV = [
  // الرئيسية = لوحة التحكم (تظهر لمن يملك صلاحيات تستحقها)
  { view: 'dashboard', label: 'home', fallback: 'الرئيسية', anyOf: DASH_PERMS, svg: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' },
  // الكول‑سنتر = مجموعة قائمة منسدلة فقط (بدون شاشة خاصة بها) — الكليك يفتح/يقفل القائمة
  { view: 'cc-group', label: 'call_center', fallback: 'الكول سنتر', anyOf: ORDER_PERMS, svg: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>', children: [
    { view: 'new-order', label: 'new_order', fallback: 'طلب جديد', anyOf: ORDER_PERMS, svg: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>' },
    { view: 'orders', label: 'delivery_orders', fallback: 'طلبات التوصيل', anyOf: ['callcenter.view'], svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>' },
    { view: 'scheduled-orders', label: 'scheduled_orders', fallback: 'طلبات مجدولة', anyOf: ['callcenter.view', 'callcenter.create'], svg: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>' },
  ] },
  { view: 'complaints', label: 'complaints', fallback: 'الشكاوى', anyOf: ['complaints.view', 'complaints.manage'], svg: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
  { view: 'settings', label: 'settings', fallback: 'الإعدادات', anyOf: ['callcenter.manage', 'callcenter.open', 'callcenter.close'], svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
  // إعدادات اليوم والأدوار — كلٌّ بمفتاحه المستقلّ، فلا يظهر لمن لا يملكه
  { view: 'day-settings', label: 'day_settings', fallback: 'إعدادات اليوم', anyOf: ['callcenter.day_settings'], svg: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
  { view: 'cc-roles', label: 'roles', fallback: 'الأدوار', anyOf: ['callcenter.roles'], svg: '<path d="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6z"/><polyline points="9 12 11 14 15 10"/>' },
  { view: 'users', label: 'users', fallback: 'المستخدمون', anyOf: ['callcenter.users'], svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
]
// «طلب جديد» ليس تبديلَ شاشة: يبدأ مسوّدةً نظيفة (بند القائمة وزرّ الهيدر سواء)
function showView(v: string) { if (v === 'new-order') { startNewOrder(); return } state.activeView = v }
function navLabel(n: any) { return t(n.label) === n.label ? n.fallback : t(n.label) }

// ── دروب‑داون مجموعات السايدبار (الكول‑سنتر) ──
const openGroups = reactive<Record<string, boolean>>({})
function groupHasActive(n: any) { return (n.children || []).some((c: any) => c.view === state.activeView) }
function isOpen(n: any) { return n.view in openGroups ? openGroups[n.view] : groupHasActive(n) }  // يفتح تلقائياً لو أنت داخل المجموعة
function toggleGroup(n: any) { openGroups[n.view] = !isOpen(n) }
// كليك على مجموعة = يفتح/يقفل القائمة فقط (لا يفتح شاشة)؛ كليك على عنصر عادي = يفتح شاشته
function clickNav(n: any) { if (n.children) toggleGroup(n); else showView(n.view) }
function navActive(n: any) { return n.children ? (groupHasActive(n) && !isOpen(n)) : state.activeView === n.view }
const viewComponent = computed(() => {
  switch (state.activeView) {
    case 'dashboard': return DashboardView
    case 'orders': return OrdersView
    case 'scheduled-orders': return ScheduledOrdersView
    case 'settings': return SettingsView
    case 'stopped-items': return StoppedItemsView
    case 'complaints': return ComplaintsView
    case 'users': return UsersView
    case 'day-settings': return DaySettingsView
    case 'cc-roles': return RolesView
    default: return NewOrderView
  }
})


onMounted(() => {
  // حقن CSS التصميم + Font Awesome، وضبط RTL
  styleEl = document.createElement('style'); styleEl.id = 'cc-styles'; styleEl.textContent = ccStyles; document.head.appendChild(styleEl)
  faEl = document.createElement('link'); faEl.rel = 'stylesheet'; faEl.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'; document.head.appendChild(faEl)
  // الاتجاه من اللغة لا مثبَّتاً: كان `rtl` دائماً، فتُعرَض الإنجليزية في تخطيطٍ
  // معكوس (السايدبار يميناً والنصّ محاذًى لليمين) حتى يبدّل المستخدم اللغة يدوياً.
  applyDir()

  initData(); initBusinessDate()
  tick(); clockTimer = setInterval(tick, 1000)
  openOrdersStream()   // بثّ لحظي لتغيّرات الطلبات (SSE)

  // دمج الدخول: نستخدم هوية وكيل U-Contact مباشرةً (لا شاشة login مووك). الوكيل وصل هنا وهو مسجّل
  // دخول في U-Contact (الحارس يضمن ذلك). الدور: مشرف لو يملك صلاحية فتح/قفل اليوم، وإلا موظف.
  const perms: string[] = currentCompany()?.permissions || []
  const role = (perms.includes('callcenter.open') || perms.includes('callcenter.close')) ? 'supervisor' : 'agent'
  loginSuccess({ name: session.name || 'وكيل', role, branch: 'all', username: 'agent' })

  // هبوط ذكي: من يملك صلاحيات إدارية يبدأ على لوحة التحكم الرئيسية، ومن معه الكول‑سنتر فقط يدخل عليه مباشرةً
  state.activeView = dashboardWorthy.value ? 'dashboard' : 'new-order'

  // تحميل البيانات الحقيقية (فروع/مناطق/منتجات) + حالة يوم العمل — يبقى على المووك لو فشل أو مفيش شركة
  void loadLiveData()
  void loadBusinessDay()
})

// عند تغيير الشركة/الفرنشايز → أعِد تحميل البيانات الحقيقية + يوم العمل (lookups تختلف)
watch(() => [session.companyId, session.franchiseId], () => { void loadLiveData(); void loadBusinessDay(); openOrdersStream() })
// تجديد التوكن ⇒ أعِد فتح التيّار بالتوكن الجديد وحده. (بلا تحميل بيانات: النطاق
// لم يتغيّر، وإعادةُ تحميلها كل ربع ساعة لكل وكيل حِملٌ بلا مقابل.)
watch(() => session.token, (t, prev) => { if (t && prev && t !== prev) openOrdersStream() })
// عند دخول شاشة الطلبات → حدّث من الكلاود
watch(() => state.activeView, (v) => { if (state.live && (v === 'orders' || v === 'scheduled-orders')) void loadOrders() })
// مغادرة القسم أو التبويب ⇒ تفاصيل الطلب المفتوحة تُطوى والفلاتر تُمسح. الحالة عامّة
// تتشاركها شاشات الطلبات الثلاث، فكان الوكيل ينتقل فيجد تفاصيل طلبٍ من شاشةٍ أخرى
// مفتوحةً أمامه، وفلتراً لم يكتبه هنا يُخفي صفوفاً بلا أن يرى سببها.
watch(() => [state.activeView, state.activeTab], () => resetOrdersBrowsing())
onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  closeOrdersStream()
  if (styleEl) styleEl.remove(); if (faEl) faEl.remove()
  document.body.classList.remove('dark-mode')
  document.documentElement.dir = prevDir
})

// ── الإشعارات: مضيفان — الركن للنجاح/المعلومة، ووسط الشاشة لما يوقف الوكيل ───────
// تحذير «اختر من: …» كان ينزل أسفل الركن خلف عتمة المودال، فيضغط الوكيل «إضافة»
// ولا يحدث شيء ولا يرى السبب. ما يمنع إتمام الخطوة يظهر في بؤرة نظره.
const cornerToasts = computed(() => (state.toasts || []).filter((x: any) => !x.center))
const centerToasts = computed(() => (state.toasts || []).filter((x: any) => x.center))
function toastIcon(type: string) {
  return type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'
}
</script>

<template>
  <!-- شاشة الدخول (نفس التصميم الأصلي 1:1) -->
  <div v-if="!loggedIn" id="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="login-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>
          <h1>U-Contact</h1>
          <p>{{ t('login_subtitle') }}</p>
        </div>
        <form class="login-form" @submit.prevent="submitLogin">
          <div class="form-group">
            <label>{{ tx('اسم المستخدم', 'Username') }}</label>
            <input type="text" v-model="username" :placeholder="tx('أدخل اسم المستخدم', 'Enter username')" autocomplete="username" />
          </div>
          <div class="form-group">
            <label>{{ tx('كلمة المرور', 'Password') }}</label>
            <input type="password" v-model="password" :placeholder="tx('أدخل كلمة المرور', 'Enter password')" autocomplete="current-password" />
          </div>
          <div v-if="loginError" class="login-error">{{ loginError }}</div>
          <button type="submit" class="login-btn">{{ t('login_button') }}</button>
        </form>
      </div>
    </div>
  </div>

  <!-- التطبيق -->
  <div v-else id="app">
    <!-- السايدبار -->
    <aside id="sidebar">
      <div class="sidebar-header"><span class="sidebar-logo">U-Contact</span></div>
      <div class="sidebar-user-info">
        <div class="sidebar-avatar">{{ (state.currentUser?.name || '?').charAt(0) }}</div>
        <div>
          <div class="sidebar-user-name">{{ state.currentUser?.name }}</div>
          <div class="sidebar-user-role">{{ roleLabel }}</div>
        </div>
      </div>

      <!-- مبدّل الشركة/الفرنشايز — يظهر فقط للوكيل متعدّد الشركات أو الفروع -->
      <div v-if="session.companies.length > 1 || session.franchises.length > 1" class="cc-switch">
        <label v-if="session.companies.length > 1">
          <span>{{ tx('الشركة', 'Company') }}</span>
          <select :value="cur?.id || ''" @change="pickCompany">
            <option v-for="c in session.companies" :key="c.id" :value="c.id">{{ coName(c) }}</option>
          </select>
        </label>
        <label v-if="session.franchises.length > 1">
          <span>{{ tx('الامتياز', 'Franchise') }}</span>
          <select :value="curFr?.id || ''" @change="pickFranchise">
            <option value="" disabled>{{ tx('اختر الفرع', 'Select branch') }}</option>
            <option v-for="f in session.franchises" :key="f.id" :value="f.id">{{ coName(f) }}</option>
          </select>
        </label>
      </div>

      <nav class="sidebar-nav">
        <template v-for="n in NAV" :key="n.view">
          <!-- كل مدخلٍ في غلافه. المجموعة المفتوحة تصير كتلةً واحدة (رأسٌ وبنودُه)
               بدل ثلاثة صفوفٍ سائبة لا يربطها برأسها شيء — وغلاف المدخل المفرد
               شفّافٌ بلا أنماط، فلا يتغيّر شكل بقيّة القائمة. -->
          <div v-show="!n.anyOf || hasAny(n.anyOf)" class="nav-group" :class="{ open: n.children && isOpen(n) }">
            <a class="nav-item" :class="{ active: navActive(n), 'nav-parent': n.children }" @click="clickNav(n)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="n.svg" />
              <span>{{ navLabel(n) }}</span>
              <!-- سهم الدروب‑داون (للأب فقط) — يتقلب حسب حالة الفتح -->
              <svg v-if="n.children" class="nav-caret" :class="{ open: isOpen(n) }" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </a>
            <!-- عناصر فرعية (طلب جديد/التوصيل/المجدولة) — يجمعها قضيبٌ رأسيّ -->
            <div v-if="n.children && isOpen(n)" class="nav-children">
              <a v-for="c in n.children" :key="c.view" v-show="!c.anyOf || hasAny(c.anyOf)" class="nav-item nav-sub" :class="{ active: state.activeView === c.view }" @click="showView(c.view)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="c.svg" />
                <span>{{ navLabel(c) }}</span>
              </a>
            </div>
          </div>
        </template>
      </nav>
      <div class="sidebar-footer" style="display:flex; flex-direction:column; gap:10px;">
        <button class="sidebar-logout" style="background:var(--surface); color:var(--text-primary);" @click="toggleLang()">{{ lang === 'ar' ? 'English' : 'العربية' }}</button>
        <button class="sidebar-logout" @click="logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>{{ tx('تسجيل الخروج', 'Sign out') }}</span>
        </button>
      </div>
    </aside>

    <!-- الهيدر -->
    <header id="header">
      <div class="header-right">
        <button v-if="canOrders && isCallcenterView" class="sidebar-new-order header-new-order-btn" @click="startNewOrder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span>{{ t('create_new_order') }}</span>
        </button>
      </div>
      <div class="header-center">
        <span v-if="isCallcenterView" class="header-clock" dir="ltr"
              :title="clockZone ? tx(`توقيت ${clockZone}`, `${clockZone} time`) : tx('توقيت جهازك', 'Your device clock')">{{ clock }}</span>
        <!-- اسم بلد الشركة بجوار الساعة: يوضّح أنها ساعة الشركة لا ساعة الوكيل -->
        <span v-if="isCallcenterView && clockZone" class="header-clock-zone">{{ clockZone }}</span>
        <!-- ساعة الجهاز منحرفة عن الخادم: الساعة المعروضة مصحَّحة، لكن الوكيل يجب أن يعلم -->
        <span v-if="isCallcenterView && clockOff()" class="header-clock-warn"
              :title="tx('ساعة جهازك غير مضبوطة — الساعة المعروضة مأخوذة من الخادم', 'Your device clock is off — the time shown comes from the server')">⚠ {{ tx('ساعة الجهاز', 'Device clock') }}</span>
        <span v-if="isCallcenterView" class="header-business-date">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span class="bd-label">{{ tx('يوم العمل:', 'Business day:') }}</span>
          <span class="bd-value">{{ businessDateLabel }}</span>
        </span>
        <span v-if="isCallcenterView" class="header-divider" aria-hidden="true"></span>
        <!-- يوم العمل مقفول → زر فتح (يظهر لمن يملك صلاحية الفتح) -->
        <button v-if="isCallcenterView && state.live && state.onlineDay === null && can('callcenter.open')" class="header-eod-btn" style="background:var(--success,#16a34a); color:#fff;" :disabled="state.dayLoading" @click="openDayModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
          <span class="eod-label">{{ state.dayLoading ? tx('جارٍ الفتح…', 'Opening…') : tx('افتح اليوم', 'Open day') }}</span>
        </button>
        <!-- «إصلاح يوم» — تاريخٌ بعينه للمراجعة، بلا ضربِ طلبات. مفتاحٌ مستقلّ. -->
        <button v-if="isCallcenterView && state.live && can('callcenter.fix_day')" class="header-eod-btn"
          style="background:#d97706; color:#fff;" :disabled="state.dayLoading"
          :title="tx('افتح تاريخاً بعينه للمراجعة — لا تُضرَب عليه طلبات', 'Open a specific date for review — no orders can be placed on it')"
          @click="openDayModal('fix')">
          <span class="inline-ico" v-html="icon('edit', { size: 15 })"></span>
          <span class="eod-label">{{ tx('إصلاح يوم', 'Fix a day') }}</span>
        </button>
        <!-- يوم مقفول ومفيش صلاحية فتح → تنبيه -->
        <span v-else-if="isCallcenterView && state.live && state.onlineDay === null" class="header-business-date" style="color:var(--danger,#dc2626);">
          <span class="bd-value">{{ tx('اليوم مقفول — لا يمكن ضرب طلب', 'Day is closed — orders cannot be placed') }}</span>
        </span>
<!-- لا يظهر إلا ويومٌ مفتوح فعلاً: «إنهاء اليوم» بلا يومٍ مفتوح زرٌّ لا معنى له -->
        <button v-if="canEod && isCallcenterView && state.live && state.onlineDay" class="header-eod-btn"
          :disabled="state.dayLoading" @click="closeBusinessDay()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64A9 9 0 0 1 20.77 15"/><path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"/><path d="M12 2v4"/></svg>
          <span class="eod-label">{{ state.dayLoading ? tx('جارٍ الإنهاء…', 'Ending…') : tx('إنهاء اليوم', 'End of day') }}</span>
          <span class="eod-badge">EOD</span>
        </button>
      </div>
      <div class="header-left">
        <button class="notification-btn" :title="tx('تبديل الوضع الليلي', 'Toggle dark mode')" @click="toggleTheme">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </header>

    <!-- المحتوى — الشاشة النشطة -->
    <main id="main-content">
      <component :is="viewComponent" />
    </main>

    <!-- مضيف مودالات الطلب (تعيين سائق / إلغاء / سجل العمليات / شكوى) — نسخة واحدة عامة -->
    <OrderModals />
    <PaymentModal />
    <ItemModal />

    <!-- الإشعارات — ركن الشاشة: النجاح والمعلومة (عودة فرع، حفظ تمّ…) فلا تحجب ما يعمل عليه الوكيل -->
    <div class="uc-toasts" aria-live="polite">
      <div v-for="tst in cornerToasts" :key="tst.id" class="uc-toast" :class="'is-' + tst.type"
           role="status" @click="dismissToast(tst.id)">
        <span class="uc-toast-icon">{{ toastIcon(tst.type) }}</span>
        <span class="uc-toast-msg">{{ tst.msg }}</span>
      </div>
    </div>

    <!-- وسط الشاشة: ما يوقف الوكيل — خانة ناقصة، اختيار مطلوب، خطأ. كان يظهر في ركنٍ
         بعيد خلف عتمة المودال، فيضغط الوكيل «إضافة» ولا يحدث شيء ولا يعرف السبب. -->
    <div v-if="centerToasts.length" class="uc-toasts is-center" aria-live="assertive">
      <div v-for="tst in centerToasts" :key="tst.id" class="uc-toast is-big" :class="'is-' + tst.type"
           role="alert" @click="dismissToast(tst.id)">
        <span class="uc-toast-icon">{{ toastIcon(tst.type) }}</span>
        <span class="uc-toast-msg">{{ tst.msg }}</span>
      </div>
    </div>

    <!-- صندوق التأكيد — على مستوى التطبيق فيُسأل من أي شاشة، وفوق أي مودالٍ مفتوح -->
    <OpenDayModal />
    <ConfirmBox />
  </div>
</template>

<style scoped>
/* مبدّل الشركة/الفرنشايز — منسّق مع السايدبار الأزرق (لا يمسّ style.css الأصلي) */
.cc-switch {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.cc-switch label { display: flex; flex-direction: column; gap: 5px; }
.cc-switch span { font-size: 11px; opacity: 0.7; font-weight: 600; }
.cc-switch select {
  width: 100%;
  padding: 9px 11px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: background 0.15s ease;
}
.cc-switch select:hover { background: rgba(255, 255, 255, 0.18); }
.cc-switch select option { color: #1e293b; }  /* عناصر القائمة على خلفية بيضاء */

/* ── مجموعة القائمة الجانبية ─────────────────────────────────────────────────
   البنود كانت تطفو تحت رأسها بلا رابطٍ بصريّ، وأرضيّةٌ بيضاء بشفافيّة ٧٪ لم تكن
   تُرى أصلاً على تدرّج السايدبار الأزرق. المجموعة المفتوحة الآن **لوحةٌ غائرة**:
   أرضيّةٌ أغمق من التدرّج بظلٍّ داخليّ، ورأسٌ يفصله خطّ عن بنوده، والبند الحاليّ
   **حبّةٌ بيضاء ممتلئة بنصٍّ أزرق** — لغةُ زرّ «طلب جديد» نفسها، لا يخطئها النظر. */
.nav-group.open {
  margin: 8px;
  padding: 6px;
  border-radius: var(--radius-lg, 14px);
  background: rgba(2, 15, 51, 0.26);
  box-shadow: inset 0 2px 6px rgba(2, 15, 51, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.09);
}
/* الهوامش من اللوحة نفسها — لا هامشٌ فوق هامش */
.nav-group.open > .nav-item { margin: 0 !important; }
/* ارتفاعُ صفٍّ واحد للجميع: الخطّ العربيّ بلا line-height صريح يعطي صندوقاً هائلاً
   (٣٨px لنصٍّ ١٤px). و«لا التفاف» لأن السايدبار ٢٠٠px ثابتة: اسمٌ أطول ينكسر سطرين
   ويرفع الصفّ — يُقصَّ بنقاطٍ بدل ذلك. */
.nav-group.open .nav-item span {
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* رأس المجموعة: عنوانٌ لا بندَ تنقّل — بوزنه الكامل ووضوحه الكامل */
.nav-group.open .nav-parent {
  opacity: 1;
  font-weight: 800;
  padding-block: 10px;
  padding-inline: 12px;   /* اللوحة أكلت من العرض — ٢٠px كانت تكسر «الكول سنتر» سطرين */
  border-radius: var(--radius-sm, 8px);
  background: transparent;
}
.nav-group.open .nav-parent:hover { background: rgba(255, 255, 255, 0.10); }
/* رأسٌ لا يحمل شريط «أنت هنا»: اللوحة كلها هي الإشارة، والحبّة تقول أين أنت منها */
.nav-group.open .nav-parent.active::before { display: none; }
.nav-children {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}

/* عناصر فرعية: أضيق من الرأس ومزاحةٌ عنه — تبعيّةٌ تُرى بلا خطوطٍ إضافيّة */
.nav-sub {
  margin-block: 0 !important;
  margin-inline: 12px 0 !important;
  padding: 10px 12px !important;
  border-radius: var(--radius-sm, 8px);
  font-size: 13px;
  opacity: 0.82;
}
.nav-sub span { font-size: 13px; }
.nav-sub:hover { opacity: 1; background: rgba(255, 255, 255, 0.14); }
/* «أنت هنا» = حبّةٌ بيضاء ممتلئة. والشريط العامّ (-8px) يُخفى — كان يقف خارج اللوحة.
   المُحدِّد يبدأ بـ.nav-children عمداً: ورقة الشِل تُحقَن وقت التركيب — أي **بعد**
   أنماط المكوّن — فتغلب عند تساوي الأولويّة. */
.nav-children .nav-sub.active {
  opacity: 1;
  /* لونان صريحان لا رموز: --white في الوضع الليلي تصير #1e293b،
     فكانت الحبّة تذوب في السايدبار بدل أن تُرى. */
  background: #ffffff;
  color: #12409e;
  font-weight: 800;
  box-shadow: 0 3px 10px rgba(2, 15, 51, 0.3);
}
.nav-children .nav-sub.active::before { display: none; }
/* سهم الدروب‑داون */
.nav-caret { margin-inline-start: auto; flex-shrink: 0; opacity: 0.75; transition: transform 0.2s ease; }
.nav-caret.open { transform: rotate(180deg); }
.nav-caret:hover { opacity: 1; }

/* ── الإشعارات ─────────────────────────────────────────────────────────────── */
/* أسفل يسار: بعيداً عن الهيدر وعن سلّة الطلب على اليمين، فلا تحجب ما يعمل عليه الوكيل */
.uc-toasts {
  position: fixed;
  inset-block-end: 18px;
  inset-inline-start: 18px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(380px, calc(100vw - 36px));
  pointer-events: none;
}
.uc-toast {
  pointer-events: auto;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 11px 14px;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.55;
  color: #0f172a;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.10);
  box-shadow: 0 8px 26px rgba(15, 23, 42, 0.17);
  animation: uc-toast-in 0.18s ease-out;
}
@keyframes uc-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.uc-toast-icon { flex: 0 0 auto; font-size: 14px; line-height: 1.4; }
.uc-toast-msg  { flex: 1 1 auto; }
.uc-toast.is-success { border-inline-start: 4px solid #10b981; }
.uc-toast.is-success .uc-toast-icon { color: #059669; }
.uc-toast.is-error   { border-inline-start: 4px solid #ef4444; }
.uc-toast.is-error   .uc-toast-icon { color: #dc2626; }
.uc-toast.is-warning { border-inline-start: 4px solid #f59e0b; }
.uc-toast.is-warning .uc-toast-icon { color: #b45309; }
.uc-toast.is-info    { border-inline-start: 4px solid #3b82f6; }
.uc-toast.is-info    .uc-toast-icon { color: #2563eb; }
/* وسط الشاشة: التحذير الذي يوقف الوكيل (خانة ناقصة/اختيار مطلوب) في بؤرة نظره، فوق المودال */
.uc-toasts.is-center {
  inset: 0;
  align-items: center;
  justify-content: center;
  max-width: none;
  padding: 24px;
  z-index: 10050;   /* فوق المودالات (5000) وصفحة الدخول (10000) */
}
.uc-toast.is-big {
  font-size: 15px;
  padding: 16px 20px;
  border-radius: 14px;
  max-width: min(460px, calc(100vw - 48px));
  border-inline-start-width: 5px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28);
  animation: uc-toast-pop 0.16s ease-out;
}
.uc-toast.is-big .uc-toast-icon { font-size: 17px; }
@keyframes uc-toast-pop {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}
:global(body.dark-mode) .uc-toast {
  color: #e2e8f0;
  background: #1e293b;
  border-color: rgba(148, 163, 184, 0.24);
}
</style>
