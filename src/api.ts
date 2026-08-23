import axios from 'axios'
import { reactive } from 'vue'

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE || 'https://u-serve.uisapp.com/api' })

// ── الجلسة: نوع الدخول (admin=مشرف عام | agent=يوزر) + التوكن + بيانات الوكيل/شركاته ──
type Mode = 'admin' | 'agent'
export interface Company {
  id: number; name: string; nameAr?: string; permissions: string[]; ceiling: string[]; dialCode?: string | null;
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
// العميل يُعرَّف بـ(الشركة + التليفون)، والأرقام تدخل بأشكال مختلفة (محلي بصفر بادئ
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
export interface Franchise { id: number; name: string; nameAr?: string }
export const session = reactive<{
  mode: Mode | null; token: string | null; name: string;
  companies: Company[]; companyId: number | null;
  franchises: Franchise[]; franchiseId: number | null;
}>({
  mode: (localStorage.getItem('uc_mode') as Mode) || null,
  token: localStorage.getItem('uc_token'),
  name: localStorage.getItem('uc_name') || '',
  companies: JSON.parse(localStorage.getItem('uc_companies') || '[]'),
  companyId: Number(localStorage.getItem('uc_company')) || null,
  franchises: JSON.parse(localStorage.getItem('uc_franchises') || '[]'),
  franchiseId: Number(localStorage.getItem('uc_franchise')) || null,
})

function persist() {
  if (session.token) localStorage.setItem('uc_token', session.token); else localStorage.removeItem('uc_token')
  if (session.mode) localStorage.setItem('uc_mode', session.mode); else localStorage.removeItem('uc_mode')
  localStorage.setItem('uc_name', session.name)
  localStorage.setItem('uc_companies', JSON.stringify(session.companies))
  localStorage.setItem('uc_franchises', JSON.stringify(session.franchises))
  if (session.companyId) localStorage.setItem('uc_company', String(session.companyId)); else localStorage.removeItem('uc_company')
  if (session.franchiseId) localStorage.setItem('uc_franchise', String(session.franchiseId)); else localStorage.removeItem('uc_franchise')
}
export const isAuthed = () => !!session.token
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
  session.mode = null; session.token = null; session.name = ''; session.companies = []; session.companyId = null
  session.franchises = []; session.franchiseId = null
  ;['uc_token', 'uc_mode', 'uc_name', 'uc_companies', 'uc_company', 'uc_franchises', 'uc_franchise'].forEach((k) => localStorage.removeItem(k))
}

api.interceptors.request.use((cfg) => {
  if (session.token) cfg.headers.Authorization = `Bearer ${session.token}`
  if (session.mode === 'agent' && session.companyId) cfg.headers['x-company-id'] = String(session.companyId)
  if (session.mode === 'agent' && session.franchiseId) cfg.headers['x-franchise-id'] = String(session.franchiseId)
  return cfg
})
api.interceptors.response.use((r) => r, (e) => {
  if (e?.response?.status === 401) { logout(); if (location.pathname !== '/login') location.assign('/login') }
  return Promise.reject(e)
})

// ── تسجيل الدخول ────────────────────────────────────────────────────────────────
export async function adminLogin(email: string, password: string) {
  const { data } = await api.post('/auth/admin/login', { email, password })
  session.mode = 'admin'; session.token = data.accessToken; session.name = data.user?.name || data.user?.email || ''
  session.companies = []; session.companyId = null; persist()
}
export async function agentLogin(email: string, password: string) {
  const { data } = await api.post('/contact/auth/login', { email, password })
  session.mode = 'agent'; session.token = data.accessToken; session.name = data.agent?.name || data.agent?.email || ''
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

// ── يوزر الشركة (تفويض) ──────────────────────────────────────────────────────────
export const listUsers = () => api.get('/contact/users').then((r) => r.data)
export const createUser = (body: any) => api.post('/contact/users', body).then((r) => r.data)
export const updateUser = (id: number, body: any) => api.patch(`/contact/users/${id}`, body).then((r) => r.data)
export const setUserPassword = (id: number, password: string) => api.post(`/contact/users/${id}/password`, { password }).then((r) => r.data)

// ── شاشة ضرب الأوردر: lookups + إنشاء الأوردر + يوم العمل (كلها بهيدرز x-company-id/x-franchise-id تلقائياً) ──
// الفروع: مفلترة بالفرنشايز المختار (الباك‑إند يقرأ x-franchise-id)
export const contactBranches = () => api.get('/contact/lookup/branches').then((r) => r.data as { id: number; name: string }[])
// المنتجات: id + اسم(ع/إن) + سعر + التصنيف (بدون صور). بحث اختياري بالاسم
export const contactProducts = (q?: string) =>
  api.get('/contact/lookup/products', { params: q ? { q } : {} }).then((r) => r.data as ContactProduct[])
// بحث العميل بالتليفون → العميل + عناوينه المحفوظة
export const contactCustomers = (phone: string) =>
  api.get('/contact/lookup/customers', { params: { phone } }).then((r) => r.data as ContactCustomer[])
// حفظ/تحديث عميل + عنوانه المركّب مستقلاً (بدون أوردر)
export const contactSaveCustomer = (body: { name: string; phone: string; regionName?: string | null; sectionName?: string | null; addressText?: string | null; block?: string | null; street?: string | null; building?: string | null; floor?: string | null; apartment?: string | null }) =>
  api.post('/contact/customers', body).then((r) => r.data as { id: number })
// مناطق التوصيل → الفرع المشتق + الرسوم
export const contactRegions = () => api.get('/contact/lookup/regions').then((r) => r.data as ContactRegion[])
// إنشاء أوردر (ينشئ/يربط العميل تلقائياً بالتليفون)
export const contactCreateOrder = (body: ContactOrderInput) => api.post('/contact/orders', body).then((r) => r.data)
// قائمة الأوردرات + يوم العمل الحالي
export const contactOrders = (params: any = {}) => api.get('/contact/orders', { params }).then((r) => r.data)
// تفاصيل أوردر ببنوده — القائمة لا تحمل البنود، وإعادة الطلب تحتاجها
export const contactOrder = (id: number) => api.get(`/contact/orders/${id}`).then((r) => r.data)
// إلغاء أوردر — الخادم يرفضه بعد نزوله الفرع («الإلغاء يكون من الفرع»)
export const contactCancelOrder = (id: number) => api.post(`/contact/orders/${id}/cancel`).then((r) => r.data)
export const contactBusinessDay = () => api.get('/contact/business-day/current').then((r) => r.data)
// رابط بثّ SSE لتغيّرات الأوردرات (EventSource — auth عبر query لأنه لا يدعم الترويسات)
export function contactOrdersStreamUrl(): string | null {
  if (!session.token || !session.companyId) return null
  const base = String(api.defaults.baseURL || '').replace(/\/$/, '')
  const p = new URLSearchParams({ access_token: session.token, company_id: String(session.companyId) })
  if (session.franchiseId) p.set('franchise_id', String(session.franchiseId))
  return `${base}/contact/orders/stream?${p.toString()}`
}
// ── الشكاوى ──
// نفس سجلّ الشكاوى الذي يراه موظف الشركة من داشبورد U‑Serve؛ الشكوى المُنشأة من هنا
// تُنسب للوكيل فتظهر في تقارير الوكلاء.
export const contactComplaints = (params: any = {}) =>
  api.get('/contact/complaints', { params }).then((r) => r.data as ContactComplaint[])
export const contactCreateComplaint = (body: ContactComplaintInput) =>
  api.post('/contact/complaints', body).then((r) => r.data as ContactComplaint)
// تفاصيل شكوى بتايم‑لاين تحديثاتها
export const contactComplaint = (id: number) => api.get(`/contact/complaints/${id}`).then((r) => r.data)
// إضافة متابعة: ملاحظة و/أو تغيير حالة (open | in_progress | resolved | closed)
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

// فتح يوم كول‑سنتر (يتطلّب صلاحية callcenter.open)
export const contactOpenDay = (businessDate?: string) => api.post('/contact/business-day/open', businessDate ? { businessDate } : {}).then((r) => r.data)

export interface ContactExtra { id: number; name: string; nameEn: string | null; price: number }
export interface ContactProduct { id: number; nameAr: string; nameEn: string | null; price: number; isAvailable: boolean; categoryId: number | null; categoryNameAr: string | null; categoryNameEn: string | null; categorySort: number; sizes: string[]; sizePrices: number[]; extras: ContactExtra[] }
// الأصناف الموقوفة من الـPOS (لكل فرع) — تُدفع للكول‑سنتر
export interface ContactStoppedBranch { branchId: number; productIds: number[] }
export const contactStoppedItems = () => api.get('/contact/lookup/stopped-items').then((r) => r.data as ContactStoppedBranch[])
// أصناف أوقفها الكول‑سنتر لنفسه — مشتركة بين كل الوكلاء، ولا تصل الفرع إطلاقاً
export const contactCcStoppedItems = () => api.get('/contact/lookup/cc-stopped-items').then((r) => r.data as ContactStoppedBranch[])
export const contactSetCcStopped = (body: { branchId: number; productId: number; stopped: boolean }) =>
  api.post('/contact/cc-stopped-items', body).then((r) => r.data as { ok: boolean })
export interface ContactAddress { id: number; label: string | null; region: string | null; section: string | null; address: string | null; isDefault: boolean; block: string | null; street: string | null; building: string | null; floor: string | null; apartment: string | null }
export interface ContactCustomer { id: number; name: string; phone: string; addresses: ContactAddress[] }
// الحيّ — حامل الفرع والرسوم الفعليّ. `branchId` هنا محسوب على الخادم: ربطه الخاص
// إن وُجد، وإلا ربط مدينته بالوراثة — فلا تكرّر القاعدة على الواجهة.
export interface ContactSection { id: number; name: string; nameEn: string | null; branchId: number | null; fee: number; isFree: boolean }
// «المنطقة» في هذه الواجهة = **المدينة** (Area). `areaLinked` = المدينة نفسها مربوطة
// بفرع؛ لو false فالفرع يأتي من الحيّ وحده ويصير اختياره إلزامياً.
export interface ContactRegion { id: number; name: string; nameEn: string | null; areaLinked: boolean; branchId: number | null; fee: number; isFree: boolean; sections: ContactSection[] }
export interface ContactOrderItemInput { productId?: number | null; productName: string; quantity: number; unitPrice: number; notes?: string | null }
export interface ContactOrderInput {
  customerPhone: string; customerName: string
  // `areaId`/`sectionId` هما ما يشتقّ منهما الخادم الفرع والرسوم (الحيّ ثم المدينة).
  // `regionId`/`regionName` اسمان قديمان للمدينة يُبعثان للتوافق فقط.
  areaId?: number | null; sectionId?: number | null; sectionName?: string | null
  regionId?: number | null; regionName?: string | null; addressText?: string | null
  block?: string | null; street?: string | null; building?: string | null; floor?: string | null; apartment?: string | null
  branchId?: number | null; orderTypeCode?: number | null
  paymentMode: 'cash_on_delivery' | 'prepaid_online'; paymentMethodId?: number | null
  discountAmount?: number; notes?: string | null
  // تجاوز رسوم التوصيل المشتقّة — يتطلّب صلاحية callcenter.delivery_fee على الخادم
  deliveryFeeOverride?: number | null
  // حجز (طلب مجدول): وجود reservationTime ينزّل الطلب في «قائمة الحجوزات» بالفرع
  // ويبدأ تحضيره قبل الموعد بـprepLeadMinutes (فارغ = افتراضي الفرع)
  reservationTime?: string | null; prepLeadMinutes?: number | null
  items: ContactOrderItemInput[]
}

export default api
