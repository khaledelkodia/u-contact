import axios from 'axios'
import { reactive } from 'vue'

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE || 'https://u-serve.uisapp.com/api' })

// ── الجلسة: نوع الدخول (admin=مشرف عام | agent=مستخدم) + التوكن + بيانات الوكيل/شركاته ──
type Mode = 'admin' | 'agent'
export interface Company {
  id: number; name: string; nameAr?: string; permissions: string[]; ceiling: string[]; dialCode?: string | null;
  // نطاق الفرنشايز لهذا الوكيل في هذه الشركة — **فارغ = كل فرنشايزات الشركة**
  franchiseIds?: number[];
  // ── توقيت الشركة ──────────────────────────────────────────────────────────
  // الوكيل قد يجلس في مصر ويخدم شركةً في عُمان: ساعته 11م وساعتها 12ص — **يومان
  // مختلفان**. كل وقتٍ يخصّ الشركة يُعرض بمنطقتها هي لا بمنطقة جهازه.
  timezone?: string | null;        // IANA — يحمل التوقيت الصيفي/الشتوي وتغيّراته
  countryNameAr?: string | null;
  serverTime?: string | null;      // لحظة الخادم عند التحميل — لقياس انحراف ساعة الجهاز
}

/**
 * انحراف ساعة جهاز الوكيل عن الخادم (بالمللي). يُقاس مرة عند تسجيل الدخول.
 *
 * لماذا: عرض ساعة الشركة يُحسب من ساعة الجهاز + المنطقة. فلو كانت ساعة الجهاز نفسها
 * مضبوطةً خطأً، لظهرت ساعة الشركة خاطئةً كذلك — والوكيل يثق بها ويَعِد العميل عليها.
 * بإضافة الانحراف تصير القراءة مبنيّةً على ساعة الخادم فعلياً.
 */
let clockSkewMs = 0
export function noteServerTime(serverIso?: string | null) {
  if (!serverIso) return
  const t = new Date(serverIso).getTime()
  if (!isNaN(t)) clockSkewMs = t - Date.now()
}
/** اللحظة الحالية مصحَّحةً بانحراف الساعة. */
export const trueNow = () => new Date(Date.now() + clockSkewMs)
/** هل ساعة جهاز الوكيل بعيدة عن الخادم بما يستحقّ التنبيه؟ (أكثر من 5 دقائق) */
export const clockOff = () => Math.abs(clockSkewMs) > 5 * 60 * 1000

/** ساعة الشركة الآن نصّاً — أو null لو لا منطقة معروفة. */
export function companyClock(c?: Company | null, withDate = false): string | null {
  const tz = c?.timezone
  if (!tz) return null
  try {
    return trueNow().toLocaleString('ar-EG', withDate
      ? { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }
      : { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  } catch { return null }
}

/** تاريخ اليوم عند الشركة (YYYY-MM-DD) — للمقارنة بيوم عمل الفرع. */
export function companyDate(c?: Company | null): string | null {
  const tz = c?.timezone
  if (!tz) return null
  try {
    // en-CA يعطي YYYY-MM-DD مباشرةً — أوثق من تركيب النصّ بأيدينا.
    return trueNow().toLocaleDateString('en-CA', { timeZone: tz })
  } catch { return null }
}

// ── أرقام الهواتف — نفس منطق الخادم (cloud/api/src/common/phone.ts) ──────────
// العميل يُعرَّف بـ(الشركة + الهاتف)، والأرقام تدخل بأشكال مختلفة (محلي بصفر بادئ
// من الـPOS، ودولي من هنا). نوحّد ما نرسله فلا يتكرّر الشخص الواحد.
// كان النمط `/D+/g` — بلا باك‑سلاش. `\D` = «ما ليس رقماً»، أمّا `D` فحرفُ D نفسه: فلم
// يكن التنظيف ينظّف شيئاً. الرقم النظيف («01012345678») ينجو بالصدفة، لكن أي رقمٍ فيه
// مسافة أو شرطة أو + — وهو ما يكتبه الوكيل فعلاً — يمرّ كما هو فيُركَّب عليه الكود مرة
// ثانية: «+20» + «+20 101…» ⇒ `+20+20 101…`. الباك‑سلاش يُبتلع صامتاً حين يُكتب الملف
// عبر heredoc في الصدفة، والكود يترجم ويعمل — فلا شيء يشير إلى الخطأ.
const digitsOnly = (raw: any): string => String(raw ?? '').replace(/\D+/g, '')

export function phoneNational(raw: any, dial?: string | null): string {
  let d = digitsOnly(raw)
  if (!d) return ''
  if (d.startsWith('00')) d = d.slice(2)
  const code = digitsOnly(dial)
  if (code && d.startsWith(code) && d.length > code.length) d = d.slice(code.length)
  return d.replace(/^0+/, '')
}
export function phoneE164(raw: any, dial?: string | null): string {
  const nat = phoneNational(raw, dial)
  if (!nat) return String(raw ?? '').trim()
  const code = digitsOnly(dial)
  return code ? `+${code}${nat}` : nat
}

/**
 * الرقم **للعرض**: كود الدولة بين قوسين ثم الرقم المحلّي — «(20+) 9876543210».
 *
 * المخزَّن E.164 ملتصقٌ («+209876543210»)، ويُعرَض داخل سطرٍ عربيّ ملفوفاً بـ
 * `dir="ltr"`. فتقع علامة الزائد في أقصى طرف الرقم منفصلةً عن كودها — تُقرأ عند
 * المستخدم «خطاً» أو علامةً سائبة لا كودَ دولة. القوسان يجمعان الكود بعلامته
 * فيُقرآن وحدةً واحدة، والفراغ يفصلهما عن الرقم المحلّي فيُقرأ الرقم كما يُنطَق.
 *
 * ورقمٌ لا يبدأ بكود الشركة يُترك **كما هو**: قد يكون من دولةٍ أخرى، وإلباسُه
 * كودَنا يكذب على الوكيل. وكذلك حين لا كودَ للشركة أصلاً.
 */
export function phoneDisplay(raw: any, dial?: string | null): string {
  const s = String(raw ?? '').trim()
  const code = digitsOnly(dial)
  if (!code) return s
  let d = digitsOnly(raw)
  if (d.startsWith('00')) d = d.slice(2)
  if (!d.startsWith(code) || d.length <= code.length) return s
  return `(+${code}) ${d.slice(code.length).replace(/^0+/, '')}`
}
export interface Franchise { id: number; name: string; nameAr?: string }
export const session = reactive<{
  mode: Mode | null; token: string | null; refreshToken: string | null; name: string;
  companies: Company[]; companyId: number | null;
  franchises: Franchise[]; franchiseId: number | null;
}>({
  mode: (localStorage.getItem('uc_mode') as Mode) || null,
  token: localStorage.getItem('uc_token'),
  refreshToken: localStorage.getItem('uc_refresh'),
  name: localStorage.getItem('uc_name') || '',
  companies: JSON.parse(localStorage.getItem('uc_companies') || '[]'),
  companyId: Number(localStorage.getItem('uc_company')) || null,
  franchises: JSON.parse(localStorage.getItem('uc_franchises') || '[]'),
  franchiseId: Number(localStorage.getItem('uc_franchise')) || null,
})

function persist() {
  if (session.token) localStorage.setItem('uc_token', session.token); else localStorage.removeItem('uc_token')
  if (session.refreshToken) localStorage.setItem('uc_refresh', session.refreshToken); else localStorage.removeItem('uc_refresh')
  if (session.mode) localStorage.setItem('uc_mode', session.mode); else localStorage.removeItem('uc_mode')
  localStorage.setItem('uc_name', session.name)
  localStorage.setItem('uc_companies', JSON.stringify(session.companies))
  localStorage.setItem('uc_franchises', JSON.stringify(session.franchises))
  if (session.companyId) localStorage.setItem('uc_company', String(session.companyId)); else localStorage.removeItem('uc_company')
  if (session.franchiseId) localStorage.setItem('uc_franchise', String(session.franchiseId)); else localStorage.removeItem('uc_franchise')
}
export const isAuthed = () => !!session.token

// ── تأكيد النطاق ────────────────────────────────────────────────────────────
// توكنٌ صالح ≠ نطاقٌ مختار: الوكيل الذي يقف على شاشة «اختر الشركة» مسجَّلُ دخولٍ
// بالفعل، فأيّ ريفريش كان يراه الحارسُ داخلاً فيقذفه إلى التطبيق بشركةٍ وفرنشايز
// لم يؤكّدهما — يعمل على «كل الفروع» وهو كان في طريقه لاختيار فرعٍ بعينه. تُرفَع
// هذه الراية عند ضغط «دخول» وحده (أو حين لا يكون هناك ما يُختار أصلاً).
export const scopeConfirmed = () => localStorage.getItem('uc_scope') === '1'
/**
 * النطاق ناقص: لم يُؤكَّد بعد، **أو** للشركة امتيازات ولم يُختَر واحد.
 * مصدرٌ واحد يقرؤه الحارس وشاشةُ الاختيار معاً فلا يفترقان.
 */
export const scopeIncomplete = () =>
  session.mode === 'agent' &&
  (!scopeConfirmed() || (session.franchises.length > 0 && !session.franchiseId))
export const confirmScope = () => localStorage.setItem('uc_scope', '1')
export const resetScope = () => localStorage.removeItem('uc_scope')
export const currentCompany = () => session.companies.find((c) => c.id === session.companyId) || null
export const currentFranchise = () => session.franchises.find((f) => f.id === session.franchiseId) || null
export function setFranchise(id: number | null) { session.franchiseId = id; persist() }
// تحميل فرنشايزات الشركة المختارة — يختار تلقائياً لو واحد فقط
export async function loadFranchises() {
  if (session.mode !== 'agent' || !session.companyId) { session.franchises = []; session.franchiseId = null; persist(); return }
  try { session.franchises = (await api.get('/contact/franchises')).data } catch { session.franchises = [] }
  if (session.franchises.length === 1) session.franchiseId = session.franchises[0].id
  else if (session.franchiseId && !session.franchises.some((f) => f.id === session.franchiseId)) session.franchiseId = null
  persist()
}
export function setCompany(id: number) {
  session.companyId = id; session.franchiseId = null; session.franchises = []; persist()
  void loadFranchises()   // الفرنشايزات تختلف بين الشركات → أعد تحميلها
}
export function logout() {
  session.mode = null; session.token = null; session.refreshToken = null; session.name = ''; session.companies = []; session.companyId = null
  session.franchises = []; session.franchiseId = null
  ;['uc_token', 'uc_refresh', 'uc_mode', 'uc_name', 'uc_companies', 'uc_company', 'uc_franchises', 'uc_franchise', 'uc_scope'].forEach((k) => localStorage.removeItem(k))
}

api.interceptors.request.use((cfg) => {
  if (session.token) cfg.headers.Authorization = `Bearer ${session.token}`
  if (session.mode === 'agent' && session.companyId) cfg.headers['x-company-id'] = String(session.companyId)
  if (session.mode === 'agent' && session.franchiseId) cfg.headers['x-franchise-id'] = String(session.franchiseId)
  return cfg
})
// ──────────────────────────────────────────────────────────────────────────────
// تجديد الجلسة عند 401.
//
// كان أيُّ 401 يطرد الوكيل إلى شاشة الدخول — وتوكن الوصول عمره ١٥ دقيقة، فكانت
// الجلسة تنقطع كل ربع ساعة **وسط مكالمة**. الآن: 401 ⇒ جدِّد ثم أعد الطلب، ولا
// يُطرَد إلا إذا سقط التجديد نفسه (توكن التجديد منتهٍ أو الحساب أُوقف).
//
// **طلبٌ واحد للتجديد مهما تزامنت الإخفاقات**: شاشة مركز الاتصال تُطلق نداءاتٍ
// متوازية، فانتهاءُ التوكن يُفشلها كلها في اللحظة نفسها. بلا هذا الحارس ينطلق
// تجديدٌ لكل واحدٍ منها، فيدوس بعضُها بعضاً (كلٌّ يُصدر توكناً يُبطل ما قبله)
// ويلتهم حدَّ الطلبات. `inflight` يجعل الجميع ينتظرون تجديداً واحداً.
let inflight: Promise<boolean> | null = null

async function renew(): Promise<boolean> {
  if (!session.refreshToken) return false
  const path = session.mode === 'admin' ? '/auth/refresh' : '/contact/auth/refresh'
  try {
    // نداءٌ عارٍ (axios لا api) — حتى لا يمرّ بهذا المعترِض نفسه فيتكرّر بلا نهاية
    const { data } = await axios.post(String(api.defaults.baseURL || '').replace(/\/$/, '') + path,
      { refreshToken: session.refreshToken })
    if (!data?.accessToken) return false
    session.token = data.accessToken
    // تدويرٌ: الخادم يعيد توكن تجديدٍ جديداً — نحفظه، وإلا انتهى القديم بعد أسبوع
    if (data.refreshToken) session.refreshToken = data.refreshToken
    persist()
    return true
  } catch {
    return false
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// إبقاءُ الجلسة حيّة استباقياً.
//
// المعترِض وحده يجدّد **عند الفشل** — وهذا يكفي وكيلاً يعمل، لا وكيلاً ساكتاً:
// شاشةٌ مفتوحة بلا نداءات ربعَ ساعة يموت توكنها، ويبقى رابط البثّ اللحظي حاملاً
// توكناً منتهياً؛ فأوّل انقطاعٍ للشبكة لا يعود بعده (EventSource لا يعيد المحاولة
// بعد ردٍّ غير 200) ⇒ شاشةٌ متجمّدة يظنّها الوكيل حيّة.
//
// فحصٌ كل دقيقة: إن بقي للتوكن أقلّ من ثلاث دقائق جُدِّد. والفحص الدوريّ — لا
// مؤقّتٌ محسوبٌ مرّةً — لأن الجهاز ينام ويصحو، فيوقظه أوّل تكّةٍ بعد الصحو.
const EXPIRY_MARGIN_S = 180

/** `exp` من حمولة التوكن بلا تحقّق — قراءةُ وقتٍ لا إذن. */
function tokenExpiry(t: string | null): number {
  if (!t) return 0
  try { return Number(JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))?.exp) || 0 }
  catch { return 0 }
}

setInterval(() => {
  if (!session.token || !session.refreshToken) return
  const exp = tokenExpiry(session.token)
  if (!exp) return
  // `clockSkewMs` يجعل المقارنة بساعة الخادم — جهازٌ ساعته متأخّرة كان يظنّ التوكن
  // حيّاً حتى يموت فعلاً، وجهازٌ متقدّمة يجدّد بلا داعٍ.
  const nowS = (Date.now() + clockSkewMs) / 1000
  if (exp - nowS <= EXPIRY_MARGIN_S) { inflight = inflight || renew().finally(() => { inflight = null }) }
}, 60_000)

api.interceptors.response.use((r) => r, async (e) => {
  const cfg = e?.config
  const is401 = e?.response?.status === 401
  // `_retried` يمنع الحلقة: طلبٌ فشل بعد التجديد لا يُجدَّد له ثانيةً
  const renewable = is401 && cfg && !cfg._retried && session.refreshToken &&
    !String(cfg.url || '').includes('/auth/refresh') && !String(cfg.url || '').includes('/login')
  if (renewable) {
    inflight = inflight || renew().finally(() => { inflight = null })
    if (await inflight) {
      cfg._retried = true
      return api.request(cfg)     // المعترِض الطالب يركّب التوكن الجديد تلقائياً
    }
  }
  if (is401) { logout(); if (location.pathname !== '/login') location.assign('/login') }
  return Promise.reject(e)
})

// ── تسجيل الدخول ────────────────────────────────────────────────────────────────
export async function adminLogin(email: string, password: string) {
  const { data } = await api.post('/auth/admin/login', { email, password })
  session.mode = 'admin'; session.token = data.accessToken; session.refreshToken = data.refreshToken || null
  session.name = data.user?.name || data.user?.email || ''
  session.companies = []; session.companyId = null; persist()
  confirmScope()   // المشرف العام بلا نطاقٍ يُختار
}
export async function agentLogin(email: string, password: string) {
  const { data } = await api.post('/contact/auth/login', { email, password })
  session.mode = 'agent'; session.token = data.accessToken; session.refreshToken = data.refreshToken || null
  session.name = data.agent?.name || data.agent?.email || ''
  resetScope()     // دخولٌ جديد ⇒ النطاق يُختار من جديد
  session.companies = data.companies || []
  // لحظة الخادم تصل مع كل شركة (نفس القيمة) — نقيس بها انحراف ساعة الجهاز مرةً واحدة.
  noteServerTime(session.companies[0]?.serverTime)
  session.companyId = session.companies.length === 1 ? session.companies[0].id : null
  session.franchises = []; session.franchiseId = null
  persist()
  if (session.companyId) await loadFranchises()   // شركة واحدة → حمّل فرنشايزاتها فوراً
}

// ── سوبر‑أدمن (platform) ─────────────────────────────────────────────────────────
export const listAgents = () => api.get('/contact/admin/agents').then((r) => r.data)
export const createAgent = (body: any) => api.post('/contact/admin/agents', body).then((r) => r.data)
export const updateAgent = (id: number, body: any) => api.patch(`/contact/admin/agents/${id}`, body).then((r) => r.data)
export const setAgentPassword = (id: number, password: string) => api.post(`/contact/admin/agents/${id}/password`, { password }).then((r) => r.data)
export const setAgentCompanies = (id: number, companies: any[]) => api.put(`/contact/admin/agents/${id}/companies`, { companies }).then((r) => r.data)
export const listCompanies = () => api.get('/contact/admin/companies').then((r) => r.data)
export const setCompanyCeiling = (id: number, permissions: string[]) => api.put(`/contact/admin/companies/${id}/ceiling`, { permissions }).then((r) => r.data)
export const agentReports = (params: any = {}) => api.get('/contact/admin/reports/agents', { params }).then((r) => r.data)

// ── مستخدم الشركة (تفويض) ──────────────────────────────────────────────────────────
export const listUsers = () => api.get('/contact/users').then((r) => r.data)
export const createUser = (body: any) => api.post('/contact/users', body).then((r) => r.data)
export const updateUser = (id: number, body: any) => api.patch(`/contact/users/${id}`, body).then((r) => r.data)
export const setUserPassword = (id: number, password: string) => api.post(`/contact/users/${id}/password`, { password }).then((r) => r.data)

// ── شاشة ضرب الطلب: lookups + إنشاء الطلب + يوم العمل (كلها بهيدرز x-company-id/x-franchise-id تلقائياً) ──
// الفروع: مفلترة بالفرنشايز المختار (الباك‑إند يقرأ x-franchise-id)
export const contactBranches = () => api.get('/contact/lookup/branches').then((r) => r.data as { id: number; name: string }[])
// المنتجات: id + اسم(ع/إن) + سعر + التصنيف (بدون صور). بحث اختياري بالاسم
export const contactProducts = (q?: string) =>
  api.get('/contact/lookup/products', { params: q ? { q } : {} }).then((r) => r.data as ContactProduct[])
// بحث العميل بالهاتف → العميل + عناوينه المحفوظة
export const contactCustomers = (phone: string) =>
  api.get('/contact/lookup/customers', { params: { phone } }).then((r) => r.data as ContactCustomer[])
// حفظ/تحديث عميل + عنوانه المركّب مستقلاً (بدون طلب)
// `addressId`: العنوان الذي يعدّله الوكيل. بدونه يطابق الخادم بالمحتوى فيُنشئ عنواناً
// ثانياً متى غُيّر أحد حقول المطابقة — وهو جوهر التعديل. والردّ يحمله ليُنتقى بالمعرّف.
export const contactSaveCustomer = (body: { name: string; phone: string; ccNotes?: string | null; addressId?: number | null; regionName?: string | null; sectionName?: string | null; addressText?: string | null; block?: string | null; street?: string | null; building?: string | null; floor?: string | null; apartment?: string | null }) =>
  api.post('/contact/customers', body).then((r) => r.data as { id: number })
// حذف عنوانٍ محفوظ — محروسٌ بـ`callcenter.delete_address` على الخادم
// حظر عميل / فكّ حظره — محروسٌ بـ`callcenter.block_customer` على الخادم
export const contactSetCustomerBlocked = (customerId: number, blocked: boolean) =>
  api.post(`/contact/customers/${customerId}/block`, { blocked }).then((r) => r.data as { isBlocked: boolean })
export const contactDeleteAddress = (addressId: number) =>
  api.delete(`/contact/customers/addresses/${addressId}`).then((r) => r.data)
// قواعد الخصم الحيّة للشركة — الواجهة تفلترها باليوم والفرع وقت التطبيق
export interface ContactDiscount {
  id: number; name: string; type: 'percent' | 'fixed'; value: number
  appliesTo: 'order' | 'category' | 'product'
  categoryIds: number[]; mainCategoryIds: number[]; productIds: number[]; variantIds: number[]
  excludeProductIds: number[]; isAuto: boolean; sortOrder: number
  scopeBranchIds: number[]; daysOfWeek: number[]
  startsAt?: string | null; endsAt?: string | null
}
export const contactDiscounts = () => api.get('/contact/lookup/discounts').then((r) => r.data as ContactDiscount[])
export interface ContactPromotion {
  id: number; name: string; nameAr: string | null
  triggerScope: 'product' | 'category'
  triggerProductIds: number[]; triggerVariantIds: number[]; triggerCategoryIds: number[]; triggerQty: number
  rewardScope: 'product' | 'category' | 'maincategory'
  rewardProductIds: number[]; rewardVariantIds: number[]
  rewardCategoryIds: number[]; rewardMainCategoryIds: number[]; rewardQty: number
  maxApplications: number | null
  scopeBranchIds: number[]; daysOfWeek: number[]
  startsAt: string | null; endsAt: string | null
}
export const contactPromotions = () => api.get('/contact/lookup/promotions').then((r) => r.data as ContactPromotion[])
// مناطق التوصيل → الفرع المشتق + الرسوم
export const contactRegions = () => api.get('/contact/lookup/regions').then((r) => r.data as ContactRegion[])
// طرق الدفع وأنواع الطلب كما عرّفتها الشركة — كانت مكتوبةً في كود الواجهة
export const contactPaymentMethods = () =>
  api.get('/contact/lookup/payment-methods').then((r) => r.data as ContactPaymentMethod[])
export const contactOrderTypes = () =>
  api.get('/contact/lookup/order-types').then((r) => r.data as ContactOrderType[])
export const contactExternalPlatforms = () =>
  api.get('/contact/lookup/external-platforms').then((r) => r.data as ContactExternalPlatform[])
// إنشاء طلب (ينشئ/يربط العميل تلقائياً بالهاتف)
export const contactCreateOrder = (body: ContactOrderInput) => api.post('/contact/orders', body).then((r) => r.data)
// قائمة الطلبات + يوم العمل الحالي
export const contactOrders = (params: any = {}) => api.get('/contact/orders', { params }).then((r) => r.data)
// تفاصيل طلب ببنوده — القائمة لا تحمل البنود، وإعادة الطلب تحتاجها
export const contactOrder = (id: number) => api.get(`/contact/orders/${id}`).then((r) => r.data)
// إلغاء طلب — الخادم يرفضه بعد نزوله الفرع («الإلغاء يكون من الفرع»)
// تعيينُ فرعٍ لطلبٍ وقف بلا فرع — المسار موجودٌ في الخادم ولم تكن الشاشة تناديه
export const contactAssignBranch = (id: number, branchId: number) =>
  api.post(`/contact/orders/${id}/assign-branch`, { branchId }).then((r) => r.data)

export const contactCancelOrder = (id: number, reason?: string) => api.post(`/contact/orders/${id}/cancel`, { reason }).then((r) => r.data)
export const contactBusinessDay = () => api.get('/contact/business-day/current').then((r) => r.data)
// رابط بثّ SSE لتغيّرات الطلبات (EventSource — auth عبر query لأنه لا يدعم الترويسات)
export function contactOrdersStreamUrl(): string | null {
  if (!session.token || !session.companyId) return null
  const base = String(api.defaults.baseURL || '').replace(/\/$/, '')
  const p = new URLSearchParams({ access_token: session.token, company_id: String(session.companyId) })
  if (session.franchiseId) p.set('franchise_id', String(session.franchiseId))
  return `${base}/contact/orders/stream?${p.toString()}`
}
// ── الشكاوى ──
// نفس سجلّ الشكاوى الذي يراه موظف الشركة من لوحة التحكم U‑Serve؛ الشكوى المُنشأة من هنا
// تُنسب للوكيل فتظهر في تقارير الوكلاء.
export const contactComplaints = (params: any = {}) =>
  api.get('/contact/complaints', { params }).then((r) => r.data as ContactComplaint[])
export const contactCreateComplaint = (body: ContactComplaintInput) =>
  api.post('/contact/complaints', body).then((r) => r.data as ContactComplaint)
// تفاصيل شكوى بتايم‑لاين تحديثاتها
export const contactComplaint = (id: number) => api.get(`/contact/complaints/${id}`).then((r) => r.data)
// إضافة متابعة: ملاحظة و/أو تغيير حالة (open | in_progress | resolved | closed)
// تقرير تشغيل مركز الاتصال: الوكلاء وأوقات الذروة والفروع
export const contactCcOverview = (params: any = {}) =>
  api.get('/contact/reports/overview', { params }).then((r) => r.data)

// تقرير الشكاوى: أعدادٌ مجمَّعة لا صفوف — الخادم يجمّعها فلا تُنقَل آلافُ الصفوف
export const contactComplaintsReport = (params: any = {}) =>
  api.get('/contact/complaints/report', { params }).then((r) => r.data)

export const contactComplaintUpdate = (id: number, body: { note?: string; status?: string }) =>
  api.post(`/contact/complaints/${id}/updates`, body).then((r) => r.data)

export interface ContactComplaint {
  id: number; companyId: number; branchId: number | null; customerId: number | null
  onlineOrderId: number | null; category: string; description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  resolution: string | null; createdAt: string
}
export interface ContactComplaintInput {
  onlineOrderId?: number | null; customerId?: number | null; branchId?: number | null
  category: string; description: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

// فتح يوم مركز اتصال (يتطلّب صلاحية callcenter.open)
export const contactOpenDay = (businessDate?: string) => api.post('/contact/business-day/open', businessDate ? { businessDate } : {}).then((r) => r.data)
export const contactCloseDay = () => api.post('/contact/business-day/close').then((r) => r.data)
// مخرج «القفلة المزدوجة»: يقفل اليوم ويرحّل الطلبات الواقفة لليوم التالي رغم منع
// القفل — طلبٌ على يومٍ لا فرعَ عليه لن ينزل بنفسه أبداً. مفتاحه callcenter.carry_stuck
export const contactCarryStuckDay = () => api.post('/contact/business-day/carry-stuck').then((r) => r.data)
// أيام فروع النطاق — إرشادُ شاشة فتح اليوم قبل اختيار التاريخ (شرط التطابق لم يتغيّر)
export const contactBranchDays = () => api.get('/contact/business-day/branches').then((r) => r.data)
// «إصلاح يوم»: يفتح تاريخاً بعينه (جديداً أو قديماً) للمراجعة — لا تُضرَب عليه طلبات
export const contactFixDay = (businessDate: string) => api.post('/contact/business-day/fix', { businessDate }).then((r) => r.data)

// إعدادات يوم الشركة: block = امنع القفل وفيه طلب واقف · carry = اقفل ورحّل
// سياسة أخذ الطلب — القراءة لمن يأخذ الطلب، والتغيير بمفتاحه المستقلّ.
// تعديل محتوى طلبٍ قائم — الخادم يرفض ما تجاوز التحضير، والفرع يطبع الفرق وحده.
export const contactUpdateOrder = (id: number, payload: any) =>
  api.put(`/contact/orders/${id}`, payload).then((r) => r.data)

export const contactOrderPolicy = () => api.get('/contact/lookup/order-policy').then((r) => r.data)
// سياسة أخذ الطلب: إلزام الدفع · ومراحل السماح بالتعديل. كلٌّ يُرسَل وحده فلا
// يمسح أحدُهما الآخر (الخادم يتجاهل الغائب).
export const contactSetOrderPolicy = (body: { paymentRequired?: boolean; editStages?: string[] }) =>
  api.put('/contact/order-settings', body).then((r) => r.data as { paymentRequired: boolean; editStages: string[] })

export const contactDaySettings = () => api.get('/contact/day-settings').then((r) => r.data)
export const contactSetDaySettings = (closeWithOpenOrders: 'block' | 'carry') =>
  api.put('/contact/day-settings', { closeWithOpenOrders }).then((r) => r.data)

// أدوار الوكلاء — مجموعة صلاحياتٍ باسمٍ واحد
export const contactRoles = () => api.get('/contact/roles').then((r) => r.data)
export const contactCreateRole = (body: any) => api.post('/contact/roles', body).then((r) => r.data)
export const contactUpdateRole = (id: number, body: any) => api.put(`/contact/roles/${id}`, body).then((r) => r.data)
export const contactDeleteRole = (id: number) => api.delete(`/contact/roles/${id}`).then((r) => r.data)

export interface ContactExtra { id: number; name: string; nameEn: string | null; price: number }
export interface ContactProduct { id: number; nameAr: string; nameEn: string | null; price: number; isAvailable: boolean; categoryId: number | null; categoryNameAr: string | null; categoryNameEn: string | null; categorySort: number; sizes: string[]; sizePrices: number[]; extras: ContactExtra[] }
// الأصناف الموقوفة من الـPOS (لكل فرع) — تُدفع لمركز الاتصال
export interface ContactStoppedBranch { branchId: number; productIds: number[] }
export const contactStoppedItems = () => api.get('/contact/lookup/stopped-items').then((r) => r.data as ContactStoppedBranch[])
// أصناف أوقفها مركز الاتصال لنفسه — مشتركة بين كل الوكلاء، ولا تصل الفرع إطلاقاً
export const contactCcStoppedItems = () => api.get('/contact/lookup/cc-stopped-items').then((r) => r.data as ContactStoppedBranch[])
export const contactSetCcStopped = (body: { branchId: number; productId: number; stopped: boolean }) =>
  api.post('/contact/cc-stopped-items', body).then((r) => r.data as { ok: boolean })
export interface ContactAddress { id: number; label: string | null; region: string | null; section: string | null; address: string | null; isDefault: boolean; block: string | null; street: string | null; building: string | null; floor: string | null; apartment: string | null }
export interface ContactCustomer { id: number; name: string; phone: string; ccNotes?: string | null; isBlocked?: boolean; blockedAt?: string | null; addresses: ContactAddress[] }
// الحيّ — حامل الفرع والرسوم الفعليّ. `branchId` هنا محسوب على الخادم: ربطه الخاص
// إن وُجد، وإلا ربط مدينته بالوراثة — فلا تكرّر القاعدة على الواجهة.
export interface ContactSection { id: number; name: string; nameEn: string | null; branchId: number | null; fee: number; isFree: boolean }
// «المنطقة» في هذه الواجهة = **المدينة** (Area). `areaLinked` = المدينة نفسها مربوطة
// بفرع؛ لو false فالفرع يأتي من الحيّ وحده ويصير اختياره إلزامياً.
export interface ContactRegion { id: number; name: string; nameEn: string | null; areaLinked: boolean; branchId: number | null; fee: number; isFree: boolean; sections: ContactSection[] }
/** طريقة دفعٍ للشركة. `isCash` تحدّد `paymentMode` المُرسَل مع الطلب. */
export interface ContactPaymentMethod { id: number; nameAr: string; nameEn: string; isCash: boolean; isCredit: boolean; sortOrder: number }
/** نوع طلبٍ للشركة. `code` (1..8) هو ما يفهمه الفرع؛ 4/5 يحتاجان عنواناً. */
export interface ContactOrderType { id: number; code: number; nameAr: string; nameEn: string }
/**
 * منصّة خارجية — مصدر «الطلب الخارجي» (code 9).
 * `mode` يقرّر شكل الشاشة عند الوكيل: delivery ⇒ عنوانٌ ورسوم، pickup ⇒ استلامٌ من الفرع.
 */
export interface ContactExternalPlatform { id: number; nameAr: string; nameEn: string; mode: 'delivery' | 'pickup'; branchIds?: number[] }
export interface ContactOrderModifierInput { id?: number | null; name: string; nameEn?: string | null; price?: number; groupId?: number | null }
export interface ContactOrderItemInput {
  productId?: number | null; productName: string; productNameEn?: string | null
  // الحجم (variant) والإضافات — الخادم يخزّنهما في `OnlineOrderItem` ويمرّرهما للفرع
  variantId?: number | null; variantName?: string | null
  quantity: number; unitPrice: number
  modifiers?: ContactOrderModifierInput[]
  notes?: string | null
}
export interface ContactOrderInput {
  customerPhone: string; customerName: string
  // `areaId`/`sectionId` هما ما يشتقّ منهما الخادم الفرع والرسوم (الحيّ ثم المدينة).
  // `regionId`/`regionName` اسمان قديمان للمدينة يُبعثان للتوافق فقط.
  areaId?: number | null; sectionId?: number | null; sectionName?: string | null
  regionId?: number | null; regionName?: string | null; addressText?: string | null
  block?: string | null; street?: string | null; building?: string | null; floor?: string | null; apartment?: string | null
  branchId?: number | null; orderTypeCode?: number | null
  // المنصّة الخارجية — تُرسَل مع orderTypeCode = 9 وحده
  externalPlatformId?: number | null
  paymentMode: 'cash_on_delivery' | 'prepaid_online'; paymentMethodId?: number | null
  discountAmount?: number; discountName?: string | null; discountBreakdown?: any[]; notes?: string | null
  // سجلّ عمليات الوكيل على السلّة — يُخزَّن مع الطلب ويظهر في خطّه الزمنيّ
  events?: any[]
  // رقم الطلب على المنصّة الخارجية (طلبات/جاهز/كاريدج…)
  orderTag?: string | null
  // حجز (طلب مجدول): وجود reservationTime ينزّل الطلب في «قائمة الحجوزات» بالفرع
  // ويبدأ تحضيره قبل الموعد بـprepLeadMinutes (فارغ = افتراضي الفرع)
  reservationTime?: string | null; prepLeadMinutes?: number | null
  items: ContactOrderItemInput[]
}

export default api
