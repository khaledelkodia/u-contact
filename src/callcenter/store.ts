import { reactive } from 'vue'
import {
  SAMPLE_CUSTOMERS, SAMPLE_ORDERS, MENU_CATEGORIES, MENU_ITEMS, BRANCHES, EMPLOYEES, DRIVERS, SYSTEM_SETTINGS,
  ORDER_STATUSES, PAYMENT_CHANNELS, PAYMENT_METHODS, CANCELLATION_REASONS, COMPLAINT_CATEGORIES,
} from './data'
import { todayISO } from './utils'
import {
  session, currentCompany, contactBranches, contactRegions, contactProducts, contactCustomers, contactCreateOrder, contactSaveCustomer,
  contactBusinessDay, contactOpenDay, contactOrders, contactStoppedItems,
  contactComplaints, contactCreateComplaint, contactCcStoppedItems, contactSetCcStopped, contactOrder,
  contactCancelOrder, contactComplaint, contactComplaintUpdate, phoneE164,
} from '../api'
import type { ContactOrderInput } from '../api'

// ── حالة تطبيق الكول‑سنتر (نفس AppState الأصلي، reactive بدل كائن عادي) ──
// كل الحقول مطابقة للأصل 1:1؛ التهيئة من data.ts. البيانات مووك حالياً — تُربط بالباك‑إند لاحقاً.
export const state = reactive<any>({
  currentUser: null,
  currentBranch: null,
  activeView: 'new-order',
  activeTab: 'menu',           // التبويب النشط افتراضياً = القائمة (مطابق للتصميم)

  businessDate: null,          // YYYY-MM-DD — يتغيّر بزر EOD (مش منتصف الليل)
  onlineDay: undefined,        // object=مفتوح · null=مقفول مؤكّد · undefined=غير معروف (فشل الفحص)
  dayLoading: false,
  branchOverrideId: null,      // تغيير الفرع يدوياً للطلب الحالي
  pendingOrderEvents: [],      // سجل عمليات الطلب الحالي → statusHistory عند التأكيد
  toasts: [],                  // إشعارات مرئية للوكيل { id, msg, type }

  // الطلب الحالي
  currentCustomer: null,
  cart: [],
  paymentChannel: null,        // phone | talabat | carriage | jahez | walkin
  paymentMethod: null,         // cash | knet | link
  paymentModalOpen: false,     // مودال اختيار الدفع
  orderType: 'delivery',
  editingOrderId: null,
  cartTotal: 0,
  cartSubtotal: 0,
  deliveryFee: 0.5,
  deliveryFeeOverride: null,
  selectedAddressIndex: -1,
  orderNotes: '',

  // ── حجز (طلب مجدول) — ينزل الفرع في «قائمة الحجوزات» بموعده ──
  isReservation: false,        // تفعيل الحجز على الطلب الحالي
  reservationTime: '',         // datetime-local (YYYY-MM-DDTHH:mm)
  prepLeadMinutes: '',         // زمن التحضير قبل الموعد (فارغ = افتراضي الفرع)

  // مجموعات البيانات (من data.ts)
  customers: [],
  orders: [],
  menuCategories: [],
  menuItems: [],
  branches: [],
  employees: [],
  drivers: [],
  // أصناف يوقفها الكول‑سنتر لنفسه { branchId: itemId[] } — من الكلاود في الوضع
  // الحقيقي (مشتركة بين كل الوكلاء)، ومن localStorage في المووك فقط.
  disabledBranchItems: {},

  // حالة المودال الحالي
  selectedMenuItem: null,
  selectedSize: null,
  selectedExtras: [],
  editingCartItemId: null,
  itemModalOpen: false,        // مودال تخصيص الصنف (حجم/إضافات/كمية/ملاحظة)
  itemModalQty: 1,
  itemModalNote: '',
  itemModalOpenPrice: '',      // سعر الوحدة للصنف مفتوح السعر (نصّ ليقبل الحقل الفراغ)
  posStoppedItems: {},         // أصناف موقوفة من مطبخ الـPOS { branchId: itemId[] } (تُدفع من الكلاود)

  // ── حقول واجهة الأوردر الجديد (كانت DOM inputs في النسخة الأصلية) ──
  phoneSearch: '',             // customer-phone-search
  showCustomerInfo: false,     // customer-info-bar (hidden toggle)
  branchMenuOpen: false,       // branch-override-menu

  // حالة المنيو
  menuView: 'categories',      // categories | items
  activeCategory: 'all',
  menuSearch: '',

  // فلاتر تبويب طلبات التوصيل
  filterInvoice: '',
  filterPhone: '',
  filterStatus: '',

  // فلاتر شاشة «جميع طلبات التوصيل» (view-orders)
  allFilterInvoice: '',
  allFilterPhone: '',
  allFilterStatus: '',
  allFilterBranch: '',

  // فلاتر شاشة الإعدادات — إتاحة الأصناف بالفروع
  availBranchId: '',           // id الفرع المستهدف (string لمطابقة قيمة الـselect)
  availCategory: 'all',        // التصنيف المختار
  availSearch: '',             // بحث باسم الصنف

  // الطلب المفتوح في لوحة التفاصيل (نقلاً عن dataset.openOrderId)
  openOrderId: null,           // null = مقفول؛ id = مفتوح (toggle)

  // مودالات لوحة التفاصيل (بدل modal-overlay/innerHTML الأصلي) — كل واحد بيخزّن id الطلب
  driverModalOrderId: null,    // تعيين سائق
  driverSearch: '',            // بحث قائمة السائقين
  cancelModalOrderId: null,    // إلغاء الطلب (اختيار سبب)
  txnModalOrderId: null,       // سجل العمليات
  // ── مودالات شاشة الأوردر الجديد ──
  notesModalOpen: false,       // ملاحظات الطلب
  feeModalOpen: false,         // رسوم التوصيل (تجاوز يدوي)
  historyModalOpen: false,     // سجل طلبات العميل
  historyOrders: [],           // نتائج السجل (من الخادم بالتليفون)
  historyLoading: false,
  reviewModalOpen: false,      // مراجعة الأوردر قبل التأكيد
  reorderBusy: false,          // جارٍ إعادة طلب سابق
  complaintModalOrderId: null, // تقديم شكوى
  // شكاوى الشركة من الكلاود: خريطة onlineOrderId → عدد الشكاوى. مصدرها الخادم لا
  // الذاكرة المحلية، وإلا مُسحت مع أول حدث SSE (mergeOrderRows يستبدل الصفّ كاملاً).
  complaintsByOrder: {},
  // ── شاشة الشكاوى ──
  complaintsList: [],          // صفوف الشكاوى المعروضة
  complaintsLoading: false,
  complaintsFilter: '',        // '' = الكل، وإلا open|in_progress|resolved|closed
  openComplaintId: null,       // الشكوى المفتوحة تفصيلاً
  openComplaint: null,         // تفاصيلها + تايم‑لاين تحديثاتها
  complaintBusy: false,

  // حقل بحث حالة الطلب
  statusSearch: '',
  statusResult: undefined,     // undefined = لسه لم يُبحث؛ null = لا يوجد؛ order = نتيجة

  // ── الربط بالباك‑إند الحقيقي (contact API) ──
  live: false,                 // true = بيانات حقيقية من السيرفر؛ false = مووك
  regions: [],                 // مناطق التوصيل (id, name, branchId, fee) من contactRegions()
  selectedRegionBranchId: null,// الفرع المشتق من المنطقة المختارة (للتوصيل)

  // بيانات فورم العميل (كانت cust-* inputs)
  form: {
    name: '', phone: '', phone2: '',
    area: '', block: '', street: '', building: '', floor: '', apartment: '',
    // `regionId` = **المدينة** (Area) — الاسم قديم وأُبقي لكثرة مواضعه.
    // `sectionId` = الحيّ، وهو حامل الفرع والرسوم الفعليّ (يتقدّم على المدينة).
    regionId: null, sectionId: null, addressText: '',
    notes: '', blacklist: false, pickupBranch: '',
  },
})

// ==========================================
// LIVE DATA (contact API) — تحميل الفروع/المناطق/المنتجات وتحويلها لشكل الواجهة
// ==========================================
export async function loadLiveData() {
  // لا نشغّلها إلا لوكيل معه شركة مختارة — غير كده نفضل على المووك
  if (!(session.mode === 'agent' && session.companyId)) return
  try {
    const [branches, regions, products] = await Promise.all([
      contactBranches(), contactRegions(), contactProducts(),
    ])

    // الفروع: {id,name} — نضيف areas:[] حتى لا تنكسر مساعدات branchByArea.
    // ونحمل معها **جاهزيّة الفرع** كما حسبها الخادم (متصل/يوم عمله/هل يستقبل الآن):
    // بدونها يَعِد الوكيل العميلَ بنصف ساعة وأوردرُه واقفٌ في الكلاود لا يعلم به أحد.
    state.branches = branches.map((b: any) => ({
      id: b.id, name: b.name, areas: [],
      online: !!b.online,
      posBusinessDate: b.posBusinessDate ?? null,
      callCenterDate: b.callCenterDate ?? null,
      dayKnown: b.dayKnown !== false,
      ready: b.ready !== false,          // خادم أقدم بلا الحقل ⇒ لا نُقلق الوكيل بلا داعٍ
      hold: b.hold ?? null,
      holdMessage: b.holdMessage ?? null,
    }))
    state.regions = regions

    // التصنيفات: مشتقة من تصنيفات المنتجات المميزة، مرتبة حسب categorySort (+ دلو غير مصنّف)
    const catMap = new Map<string, any>()
    products.forEach((p: any) => {
      const cid = p.categoryId != null ? String(p.categoryId) : 'uncat'
      if (!catMap.has(cid)) {
        catMap.set(cid, {
          id: cid,
          name: p.categoryId != null ? (p.categoryNameAr || p.categoryNameEn || 'تصنيف') : 'غير مصنّف',
          nameEn: p.categoryNameEn || p.categoryNameAr || '',
          icon: '', color: '#6b7280', imageUrl: '',
          sort: p.categoryId != null ? p.categorySort : 9999,
        })
      }
    })
    const cats = Array.from(catMap.values()).sort((a: any, b: any) => a.sort - b.sort)
    cats.push({ id: 'all', name: 'عرض الكل', nameEn: 'View All', icon: '', color: '#6b7280', imageUrl: '' })
    state.menuCategories = cats

    // المنتجات → شكل صنف الواجهة: بدون صور، مع الأحجام (variants) والإضافات (modifiers)
    state.menuItems = products.map((p: any) => ({
      id: p.id,
      categoryId: p.categoryId != null ? String(p.categoryId) : 'uncat',
      name: p.nameAr,
      nameEn: p.nameEn || '',
      price: p.price,
      description: '',
      // أحجام: لو فيها variants → مصفوفة الأسماء/الأسعار، وإلا null (صنف بسعر واحد)
      sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes : null,
      sizePrices: Array.isArray(p.sizePrices) && p.sizePrices.length ? p.sizePrices : null,
      // إضافات لكل صنف: [{ id, name, price }]
      extras: Array.isArray(p.extras) ? p.extras : [],
      imageUrl: '',
      isAvailable: p.isAvailable,
      // صنف بسعر مفتوح: لا سعر ثابت — الوكيل يُدخل سعر الوحدة في مودال الصنف
      isOpenPrice: !!p.isOpenPrice,
    }))

    state.availBranchId = state.branches[0] ? String(state.branches[0].id) : ''
    state.live = true
    void loadOrders()          // أوردرات الشركة الحقيقية بدل المووك
    void loadStoppedItems()    // أصناف مطبخ الـPOS الموقوفة (لمنع ضربها)
    void loadCcStoppedItems()  // وأصناف أوقفها الكول‑سنتر لنفسه (مشتركة بين الوكلاء)
  } catch {
    // فشل التحميل → نبقى على المووك بدون كسر الشاشة
    showToast('تعذّر تحميل بيانات الشركة — سيتم استخدام بيانات تجريبية', 'warning')
  }
}

// ── يوم عمل الكول‑سنتر (لازم يكون مفتوح لضرب أوردر) ──
export async function loadBusinessDay() {
  if (!(session.mode === 'agent' && session.companyId)) return
  state.dayLoading = true
  try {
    const day = await contactBusinessDay()   // يرجّع اليوم المفتوح أو null
    state.onlineDay = day || null
    if (day?.businessDate) state.businessDate = String(day.businessDate).slice(0, 10)
  } catch { state.onlineDay = undefined }     // فشل الفحص (صلاحية/شبكة) → غير معروف، لا نمنع
  finally { state.dayLoading = false }
}
export async function openBusinessDay() {
  if (!(session.mode === 'agent' && session.companyId)) return
  state.dayLoading = true
  try {
    const day = await contactOpenDay()
    state.onlineDay = day || null
    if (day?.businessDate) state.businessDate = String(day.businessDate).slice(0, 10)
    showToast('تم فتح يوم العمل — تقدر تضرب أوردر دلوقتي', 'success')
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'تعذّر فتح يوم العمل (تحتاج صلاحية فتح اليوم)', 'error')
  } finally { state.dayLoading = false }
}

// ── أوردرات الكلاود → شكل جدول الكول‑سنتر (لشاشات التوصيل/المجدولة) ──
// تحويل حالة الـPOS (new/received/preparing/ready/delivered/closed/cancelled/modified)
// + حالة السائق (on_way) → حالة عرض الكول‑سنتر (تفادي «غير معروف»)
function mapPosStatus(s: string, driverStatus?: string): string {
  if (s === 'delivered' || s === 'closed') return 'delivered'   // مقفول = تم التسليم
  if (driverStatus === 'on_way') return 'onway'
  switch (s) {
    case 'new': case 'preparing': case 'ready': case 'cancelled': return s
    case 'received': return 'new'
    case 'modified': return 'preparing'
    default: return 'new'   // أي قيمة غير متوقّعة → جديد بدل «غير معروف»
  }
}
/**
 * سجلّ عمليات الطلب من بيانات الكلاود لا من الذاكرة المحلية.
 *
 * كان `statusHistory` يُبنى محلياً بأفعال الوكيل وحده، فالطلب الحقيقي يفتح سجلّه
 * فارغاً (سطر «تم إنشاء الطلب» المُصطنَع) رغم أن الخادم يرسل توقيت كل خطوة.
 * نبني هنا من الحقول الواصلة فقط — **بلا اختراع توقيت**: خطوةٌ بلا وقت لا تُعرَض،
 * فلا يقرأ الوكيل زمناً غير حقيقي.
 */
function buildTimeline(r: any, statusLabel: string): any[] {
  const out: any[] = []
  const push = (type: string, at: any, by: string, note: string) => {
    if (!at) return
    out.push({ type, status: type, at, by, note })
  }

  push('created', r.createdAt, r.agentName || 'الكول‑سنتر', 'إنشاء الطلب من الكول‑سنتر')

  // نزول الفرع: لا توقيت مستقلّ له في الحمولة — نذكره بلا وقت مضلِّل حين يتأكّد
  if (r.posOrderId) {
    out.push({ type: 'branch', status: 'branch', at: r.posStatusAt || null, by: 'الفرع',
      note: `نزل الفرع — رقم الطلب هناك #${r.posOrderId}` })
  } else if (r.holdReason === 'no_branch') {
    out.push({ type: 'held', status: 'held', at: null, by: '—', note: 'محتجَز: لا فرع يخدم المنطقة — يحتاج تعييناً يدوياً' })
  }

  // حالة الفرع الأخيرة (المرآة التي يرفعها الكونكتور)
  if (r.posStatus && r.posStatusAt) {
    push('status', r.posStatusAt, 'الفرع', `حالة الفرع: ${statusLabel}`)
  }

  // السائق — يعيّنه الفرع، والكول‑سنتر يعرضه فقط
  if (r.driverName) {
    const dl = r.driverStatus === 'on_way' ? 'خرج للتوصيل'
      : r.driverStatus === 'delivered' ? 'سلّم الطلب'
      : r.driverStatus === 'assigned' ? 'تم تحميله' : (r.driverStatus || '')
    push('driver', r.driverAt, 'الفرع', `السائق: ${r.driverName}${dl ? ' — ' + dl : ''}`)
  }

  push('delivered', r.deliveredAt, 'الفرع', 'تم تسليم الطلب للعميل')

  if (r.status === 'cancelled' || r.posStatus === 'cancelled') {
    out.push({ type: 'cancelled', status: 'cancelled', at: r.posStatusAt || null,
      by: r.posStatus === 'cancelled' ? 'الفرع' : 'الكول‑سنتر', note: 'تم إلغاء الطلب' })
  }

  // الأقدم أولاً؛ ما لا وقت له يبقى في موضعه المنطقي بلا إزاحة
  return out.sort((a, b) => (a.at && b.at ? new Date(a.at).getTime() - new Date(b.at).getTime() : 0))
}

function mapCloudOrder(r: any): any {
  const type = r.orderTypeCode === 6 ? 'pickup' : 'delivery'
  // وصل الفرع؟ = اتنزّل POS (posOrderId) أو عنده مرآة حالة POS
  const reachedPos = !!r.posOrderId || !!r.posStatus
  // حالة العرض: ملغي → ملغي؛ لسه ماوصلش الفرع → «sent»؛ وصل → تحويل حالة الـPOS
  const status = (r.status === 'cancelled' || r.posStatus === 'cancelled') ? 'cancelled'
    : !reachedPos ? 'sent'
    : mapPosStatus(r.posStatus, r.driverStatus)
  return {
    id: r.id,
    // أرقام الفرع الظاهرة أولاً: اليومي والعالمي كما يراهما المطعم. `posOrderId`
    // معرّف صفٍّ داخليّ — عرضُه كان يعطي العميل رقماً لا يجده الفرع. ويبقى ارتداداً
    // للطلبات القديمة التي نزلت قبل أن يُرسَل الرقمان، ثم معرّف الكلاود لما لم ينزل بعد.
    dailyNo: r.posDailyNumber ?? r.posOrderId ?? r.id,
    invoiceNo: String(r.posOrderNumber ?? r.posOrderId ?? r.id),
    employeeName: r.agentName || '—',
    type, status,
    customerName: r.customerName, customerPhone: r.customerPhone,
    branchId: r.branchId, branchName: r.branchName || (r.holdReason === 'no_branch' ? 'بانتظار تعيين فرع' : '—'),
    subtotal: Number(r.subtotal) || 0, deliveryFee: Number(r.deliveryFee) || 0, total: Number(r.total) || 0,
    driverId: r.driverName ? -1 : null, driverName: r.driverName || null, driverPhone: '',
    // حجز: موعده يظهر في شاشة «الطلبات المجدولة»
    hasComplaint: !!state.complaintsByOrder[r.id], scheduledDate: r.reservationTime || null,
    // سجلّ العمليات من الخادم — يُعاد بناؤه مع كل تحديث لحظي فيبقى مطابقاً للواقع
    statusHistory: buildTimeline(r, ORDER_STATUSES.find((x: any) => x.id === status)?.name || status),
    prepLeadMinutes: r.prepLeadMinutes ?? null,
    posReservationId: r.posReservationId ?? null,
    businessDate: r.businessDate ? String(r.businessDate).slice(0, 10) : null,
    createdAt: r.createdAt,
    region: r.regionName, address: r.addressText,
    items: [],
  }
}

// تحميل أوردرات الشركة من الكلاود إلى state.orders (وضع live)
export async function loadOrders() {
  if (!(session.mode === 'agent' && session.companyId)) return
  // الشكاوى قبل التحويل: `mapCloudOrder` يقرأ `complaintsByOrder` ليضع علم الشكوى
  await loadComplaints()
  try {
    const rows = await contactOrders()
    state.orders = Array.isArray(rows) ? rows.map(mapCloudOrder) : []
  } catch { /* نُبقي الحالي */ }
}

/** شكاوى الشركة → خريطة (أوردر → عدد). صامتة عند نقص صلاحية `complaints.view`. */
export async function loadComplaints() {
  if (!(session.mode === 'agent' && session.companyId)) return
  if (!canViewComplaints()) return
  try {
    const rows = await contactComplaints()
    const map: any = {}
    for (const c of rows || []) {
      if (c.onlineOrderId == null) continue
      map[c.onlineOrderId] = (map[c.onlineOrderId] || 0) + 1
    }
    state.complaintsByOrder = map
  } catch { /* نُبقي الحالي */ }
}

// ── شاشة الشكاوى: قائمة + تفاصيل + متابعة ───────────────────────────────────
export const COMPLAINT_STATUSES = [
  { id: 'open',        label: 'مفتوحة',      color: '#dc2626' },
  { id: 'in_progress', label: 'قيد المعالجة', color: '#d97706' },
  { id: 'resolved',    label: 'تم حلّها',     color: '#16a34a' },
  { id: 'closed',      label: 'مغلقة',       color: '#64748b' },
]
export function complaintStatusLabel(id: string): string {
  return COMPLAINT_STATUSES.find((s) => s.id === id)?.label || id
}
export function complaintStatusColor(id: string): string {
  return COMPLAINT_STATUSES.find((s) => s.id === id)?.color || '#64748b'
}
export function complaintCategoryLabel(id: string): string {
  return COMPLAINT_CATEGORIES.find((c: any) => c.id === id)?.label || id
}

export function setComplaintsFilter(v: string) { state.complaintsFilter = v; void loadComplaintsList() }

/** قائمة الشكاوى بالفلتر الحالي. */
export async function loadComplaintsList() {
  if (!state.live) { state.complaintsList = []; return }
  if (!canViewComplaints()) return
  state.complaintsLoading = true
  try {
    const rows = await contactComplaints(state.complaintsFilter ? { status: state.complaintsFilter } : {})
    state.complaintsList = Array.isArray(rows) ? rows : []
  } catch {
    state.complaintsList = []
    showToast('تعذّر تحميل الشكاوى', 'error')
  } finally {
    state.complaintsLoading = false
  }
}

export async function openComplaintDetail(id: number) {
  state.openComplaintId = id
  state.openComplaint = null
  try {
    state.openComplaint = await contactComplaint(id)
  } catch {
    showToast('تعذّر تحميل تفاصيل الشكوى', 'error')
    state.openComplaintId = null
  }
}
export function closeComplaintDetail() { state.openComplaintId = null; state.openComplaint = null }

/**
 * متابعة الشكوى: ملاحظة و/أو تغيير حالة. الخادم يشترط أحدهما على الأقل ويسجّل
 * التغيير في التايم‑لاين، فنعيد قراءة التفاصيل بعدها بدل تخمين الشكل الجديد.
 */
export async function addComplaintUpdate(note: string, status: string) {
  const id = state.openComplaintId
  if (!id) return
  if (!canManageComplaints()) { showToast('لا تملك صلاحية متابعة الشكاوى', 'warning'); return }
  const n = (note || '').trim()
  const changed = status && status !== state.openComplaint?.status ? status : ''
  if (!n && !changed) { showToast('اكتب ملاحظة أو غيّر الحالة', 'warning'); return }
  state.complaintBusy = true
  try {
    const body: any = {}
    if (n) body.note = n
    if (changed) body.status = changed
    state.openComplaint = await contactComplaintUpdate(id, body)
    showToast('تم تسجيل المتابعة', 'success')
    await loadComplaintsList()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'تعذّر تسجيل المتابعة', 'error')
  } finally {
    state.complaintBusy = false
  }
}

/**
 * دمج صفوف وصلت داخل حدث SSE في القائمة الحالية — بلا أي طلب شبكة.
 *
 * لماذا: كان الحدث يصل فارغاً فيعيد **كل** وكيل جلب القائمة كاملة عند كل تغيّر
 * (يحدّه الـdebounce عند ~٢٫٥ طلب/ث لكل وكيل ⇒ ٢٥٠ طلب/ث عند ١٠٠ وكيل).
 * أغلب الأحداث تحديثُ حالةٍ لأوردر معروض بالفعل، فدمجه في مكانه يُلغي الطلب تماماً.
 *
 * نُحدِّث الموجود فقط. الأوردر الجديد (غير الموجود في القائمة) نتركه لإعادة الجلب،
 * لأن دخوله يعتمد على فلاتر الشاشة (التاريخ/الحالة/الفرع) التي لا يعرفها الحدث —
 * فلا نُدرج صفّاً قد لا يخصّ العرض الحالي. الإنشاء نادر (بسرعة كتابة الوكيل)،
 * والحجم كلّه في تحديثات الحالة القادمة من الفروع.
 *
 * @returns true لو غُطّيت كل الصفوف ⇒ لا حاجة لإعادة الجلب إطلاقاً.
 */
export function mergeOrderRows(rows: any[]): boolean {
  if (!Array.isArray(rows) || !rows.length) return false
  const byId = new Map<any, number>(state.orders.map((o: any, i: number) => [o.id, i]))
  let merged = 0
  for (const r of rows) {
    const i = byId.get(r.id)
    if (i === undefined) continue          // صفّ غير معروض — تتكفّل به إعادة الجلب
    state.orders[i] = mapCloudOrder(r)     // استبدال كامل بنفس التحويل المستخدم في القائمة
    merged++
  }
  return merged === rows.length
}

// تهيئة الداتا (نفس منطق DOMContentLoaded الأصلي)
export function initData() {
  state.customers = [...SAMPLE_CUSTOMERS]
  state.orders = [...SAMPLE_ORDERS]
  state.menuCategories = [...MENU_CATEGORIES]
  state.menuItems = [...MENU_ITEMS]
  state.branches = [...BRANCHES]
  state.employees = [...EMPLOYEES]
  state.drivers = Array.isArray(DRIVERS) ? [...DRIVERS] : []
  state.deliveryFee = (SYSTEM_SETTINGS as any).deliveryFee

  // الفرع الافتراضي لشاشة إتاحة الأصناف = أول فرع (نفس سلوك الأصل)
  state.availBranchId = state.branches[0] ? String(state.branches[0].id) : ''

  // أصناف موقوفة لكل فرع — من localStorage (نفس المفتاح الأصلي)
  const saved = localStorage.getItem('pos_disabled_branch_items')
  try { state.disabledBranchItems = saved ? JSON.parse(saved) : {} } catch { state.disabledBranchItems = {} }
}

export function saveDisabledItems() {
  // الوضع الحقيقي يحفظ على الكلاود عبر toggleBranchItemAvailability — لا نكتب نسخة
  // محلية توهم بأنها المصدر، فتُقرأ بعد إعادة التحميل قبل وصول قائمة الخادم.
  if (state.live) return
  localStorage.setItem('pos_disabled_branch_items', JSON.stringify(state.disabledBranchItems))
}

/**
 * قائمة إيقاف الكول‑سنتر من الكلاود (مشتركة بين الوكلاء).
 * ترجع نجاحها: فشلُ القراءة كان يُبتلَع بصمت، فتبقى الشاشة على تحديث تفاؤليّ لم
 * يُتحقَّق منه ويظهر الإيقاف «كأنه انحفظ» ثم يختفي عند أول تحميل.
 */
export async function loadCcStoppedItems(): Promise<boolean> {
  if (!(session.mode === 'agent' && session.companyId)) return false
  try {
    const rows = await contactCcStoppedItems()   // [{ branchId, productIds }]
    const map: Record<number, number[]> = {}
    if (Array.isArray(rows)) rows.forEach((r: any) => { map[r.branchId] = Array.isArray(r.productIds) ? r.productIds : [] })
    state.disabledBranchItems = map
    return true
  } catch {
    return false   // نُبقي الحالي — والمستدعي يقرّر هل يُبلّغ
  }
}

// ==========================================
// مساعدات عامة (بدل showToast / logPendingEvent الأصليين)
// ==========================================
/**
 * إشعار مرئي للوكيل.
 *
 * كان `console.log` وحده («يُبنى لاحقاً»)، فكانت كل رسائل هذا الملفّ تختفي — بما فيها
 * «تعذّر فتح يوم العمل» و«تعذّر تحميل بيانات الشركة»: الوكيل يضغط ولا يحدث شيء ولا يُخبَر
 * بالسبب. الـconsole يبقى للتشخيص، ويُضاف العرض.
 */
let toastSeq = 0
export function showToast(msg: string, type: string = 'info', ms = 5000) {
  console.log(`[toast:${type}]`, msg)
  if (!Array.isArray(state.toasts)) state.toasts = []
  const id = ++toastSeq
  state.toasts.push({ id, msg, type })
  // 12 ثانية سقفٌ للرسائل المهمة، وتُزال يدوياً كذلك. الحدّ يمنع تراكماً بلا نهاية.
  setTimeout(() => dismissToast(id), Math.min(Math.max(ms, 1500), 12000))
  // لا نُبقي أكثر من 4 على الشاشة — الأقدم يخرج، فلا يغطّي الشريطُ الواجهةَ.
  if (state.toasts.length > 4) state.toasts.splice(0, state.toasts.length - 4)
  return id
}
export function dismissToast(id: number) {
  if (!Array.isArray(state.toasts)) return
  const i = state.toasts.findIndex((x: any) => x.id === id)
  if (i >= 0) state.toasts.splice(i, 1)
}

/**
 * وصل حدث حضورٍ لفرع (اتصل / انقطع) عبر البثّ اللحظي.
 *
 * يحدّث حالة الفرع في مكانها فيتغيّر شريط الجاهزيّة فوراً بلا إعادة تحميل، **وينبّه**
 * الوكيل حين يعود فرعٌ كان أوردره واقفاً عليه: أوردره نزل المطبخ الآن، وكان سيظلّ
 * يعتذر للعميل عن طلبٍ صار قيد التحضير فعلاً.
 *
 * يمسّ بُعد «الاتصال» وحده — أبعاد يوم العمل لا تتغيّر بحدث حضور، فتبقى كما قالها الخادم.
 */
export function applyBranchPresence(branchId: number, online: boolean) {
  const b: any = state.branches?.find((x: any) => x.id === branchId)
  if (!b) return
  const was = b.online
  b.online = online
  if (online && b.hold === 'offline') { b.hold = null; b.ready = true; b.holdMessage = null }
  else if (!online && b.ready) { b.hold = 'offline'; b.ready = false; b.holdMessage = 'الفرع غير متصل الآن — الأوردر محفوظ وسينزل تلقائياً أول ما يرجع الاتصال.' }
  if (was === online) return                       // لا تغيّر فعلي ⇒ لا إزعاج
  if (!online) return                              // الانقطاع يظهر في الشريط بلا إشعار
  // كم أوردر كان واقفاً على هذا الفرع؟ («sent» = لم يصل الفرع بعد)
  const waiting = (state.orders || []).filter((o: any) => o.branchId === branchId && o.status === 'sent').length
  showToast(
    waiting > 0
      ? `${b.name} رجع أونلاين — ${waiting} أوردر واقف هينزل عليه دلوقتي`
      : `${b.name} رجع أونلاين`,
    'success', waiting > 0 ? 9000 : 4000,
  )
}

export function logPendingEvent(ev: any) {
  if (!Array.isArray(state.pendingOrderEvents)) state.pendingOrderEvents = []
  state.pendingOrderEvents.push({ ...ev, at: new Date().toISOString() })
}

// ==========================================
// BRANCH & AREA (نقلاً عن getAutoBranchId / getResolvedOrderBranchId)
// ==========================================
function branchByArea(area: string): any {
  if (!area) return null
  return state.branches.find((b: any) => b.areas.includes(area)) || null
}

export function getAutoBranchId(): number | null {
  if (state.orderType === 'pickup') {
    if (state.form.pickupBranch) return parseInt(state.form.pickupBranch)
  } else {
    const b = branchByArea(state.form.area)
    if (b) return b.id
  }
  return state.currentBranch ? state.currentBranch.id : null
}

// getResolvedOrderBranchId: يرجّع null لو مفيش فرع محدد (يُستخدم للأصناف الموقوفة)
export function getResolvedOrderBranchId(): number | null {
  if (state.branchOverrideId) return state.branchOverrideId
  if (state.orderType === 'pickup') {
    return state.form.pickupBranch ? parseInt(state.form.pickupBranch) : null
  }
  if (state.live) return state.selectedRegionBranchId || null
  const b = branchByArea(state.form.area)
  return b ? b.id : null
}

/**
 * جاهزيّة الفرع الذي سيذهب إليه الأوردر الحالي.
 *
 * الأوردر لا يُدفع للفرع؛ الفرع يسحبه بنفسه حين يكون متصلاً وعلى نفس يوم العمل. فإن لم
 * يكن كذلك يقف الأوردر في الكلاود **صامتاً** — لا يضيع، لكن لا أحد في المطبخ يراه. هذه
 * الدالة تكشف تلك الحالة قبل أن يَعِد الوكيل العميل بموعد.
 *
 * null = لم يُحدَّد فرع بعد (لم يُدخَل العنوان)، أو الوضع التجريبي — فلا حكم.
 */
export function resolvedBranchStatus(): any | null {
  const id = getResolvedOrderBranchId()
  if (!id || !state.live) return null
  const b: any = state.branches.find((x: any) => x.id === id)
  if (!b) return null
  // خادم أقدم لا يرسل الحقول ⇒ لا ندّعي معرفةً ليست عندنا: نصمت بدل إنذارٍ كاذب.
  if (b.hold === undefined && b.online === undefined) return null
  return {
    id: b.id, name: b.name,
    online: !!b.online,
    ready: b.ready !== false,
    hold: b.hold ?? null,
    holdMessage: b.holdMessage ?? null,
    posBusinessDate: b.posBusinessDate ?? null,
    callCenterDate: b.callCenterDate ?? null,
  }
}

// الاسم المعروض في شريط المعلومات (نقلاً عن updateCustomerInfoAddress)
export function infoBranchName(): string {
  if (state.branchOverrideId) {
    const b = state.branches.find((x: any) => x.id === state.branchOverrideId)
    return b ? b.name : '-'
  }
  if (state.orderType === 'pickup') {
    if (state.form.pickupBranch) {
      const b = state.branches.find((x: any) => x.id === parseInt(state.form.pickupBranch))
      return b ? b.name : '-'
    }
    return '-'
  }
  // توصيل: في الـlive الفرع مشتق من المنطقة (selectedRegionBranchId)، وفي المووك من المنطقة النصّية
  if (state.live) {
    if (!state.selectedRegionBranchId) return '-'
    const b = state.branches.find((x: any) => x.id === state.selectedRegionBranchId)
    return b ? b.name : '-'
  }
  const b = branchByArea(state.form.area)
  return b ? b.name : '-'
}

// نص العنوان المجمّع (نقلاً عن updateCustomerInfoAddress)
export function infoAddress(): string {
  const f = state.form
  const parts: string[] = []
  // في الوضع الحقيقي المكان معرّفات لا نصّ: نعرض اسم المدينة والحيّ من المرجع،
  // وإلا ظهر شريط المعلومات بالعنوان التفصيلي بلا مدينة أصلاً.
  if (state.live) {
    const area = currentArea()
    const sec = (area?.sections || []).find((x: any) => x.id === f.sectionId) || null
    if (area) parts.push(area.name)
    if (sec) parts.push(sec.name)
  }
  if (f.area) parts.push(f.area)
  if (f.block) parts.push(`ق ${f.block}`)
  if (f.street) parts.push(`ش ${f.street}`)
  if (f.building) parts.push(`مبنى ${f.building}`)
  if (f.floor) parts.push(`ط ${f.floor}`)
  if (f.apartment) parts.push(`شقة ${f.apartment}`)
  return parts.length > 0 ? parts.join('، ') : '-'
}

export function onAreaChange() {
  const b = branchByArea(state.form.area)
  if (b) showToast(`تم تحديد ${b.name} تلقائياً بناءً على المنطقة`, 'info')
}

// ── فلاج "طلب اليوم" (نقلاً عن updateCustomerTodayBadge) ──
export function customerTodayCount(): number {
  const c = state.currentCustomer
  if (!c) return 0
  const bd = state.businessDate || todayISO()
  return state.orders.filter((o: any) =>
    o.customerId === c.id &&
    (o.businessDate || (o.createdAt || '').slice(0, 10)) === bd
  ).length
}

// ==========================================
// BRANCH OVERRIDE
// ==========================================
export function toggleBranchOverride() {
  state.branchMenuOpen = !state.branchMenuOpen
}
export function closeBranchOverrideMenu() { state.branchMenuOpen = false }

export function selectBranchOverride(branchId: number) {
  const autoBranchId = getAutoBranchId()
  if (branchId === autoBranchId) {
    state.branchOverrideId = null
  } else {
    state.branchOverrideId = branchId
    const b = state.branches.find((x: any) => x.id === branchId)
    if (b) showToast(`تم تحويل الطلب إلى ${b.name}`, 'success')
  }
  state.branchMenuOpen = false
}

export function resetBranchOverride() {
  state.branchOverrideId = null
  state.branchMenuOpen = false
  showToast('تم الرجوع للفرع التلقائي', 'info')
}

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================
function fillAddressFields(addr: any) {
  state.form.area = addr.area || ''
  state.form.block = addr.block || ''
  state.form.street = addr.street || ''
  state.form.building = addr.building || ''
  state.form.floor = addr.floor || ''
  state.form.apartment = addr.apartment || ''
}
function clearAddressFields() {
  state.form.area = ''
  state.form.block = ''
  state.form.street = ''
  state.form.building = ''
  state.form.floor = ''
  state.form.apartment = ''
  state.form.regionId = null
  state.form.sectionId = null
  state.form.addressText = ''
  state.selectedRegionBranchId = null
}

// ── العنوان الحقيقي (contact API): مدينة ← حيّ يُشتق منهما الفرع + الرسوم ──
/** المدينة المختارة حالياً. */
export function currentArea(): any {
  return state.regions.find((x: any) => x.id === state.form.regionId) || null
}
/** أحياء المدينة المختارة — للقائمة الثانية في الواجهة. */
export function areaSections(): any[] {
  return currentArea()?.sections || []
}
/**
 * الحيّ إلزاميّ متى كانت المدينة نفسها غير مربوطة بفرع ولها أحياء: الخادم يشتقّ
 * الفرع من BranchArea أولاً، فإرسال المدينة وحدها بلا ربط يُحتجَز الطلب بصمت.
 */
export function sectionRequired(): boolean {
  const a = currentArea()
  return !!a && !a.areaLinked && (a.sections || []).length > 0
}
/**
 * يطبّق الفرع والرسوم من المكان المختار — **الحيّ أولاً ثم المدينة**، نفس ترتيب
 * الخادم بالضبط فلا يختلف ما يراه الوكيل عمّا سينفّذ عند الإرسال.
 */
function applyPlace() {
  const area = currentArea()
  const section = area && state.form.sectionId
    ? (area.sections || []).find((x: any) => x.id === state.form.sectionId) || null
    : null
  // مدينة غير مربوطة: فرعها المعروض مأخوذ من أحد أحيائها (عرضٌ لا اشتقاق) — فلا
  // نتبنّاه إلا بعد اختيار الحيّ صراحةً.
  const link = section || (area && area.areaLinked ? area : null)
  state.selectedRegionBranchId = link ? (link.branchId ?? null) : null
  state.deliveryFee = link ? Number(link.fee || 0) : 0
  state.deliveryFeeOverride = null
}

export function selectRegion(regionId: any) {
  const rid = regionId === '' || regionId == null ? null : Number(regionId)
  const r = state.regions.find((x: any) => x.id === rid) || null
  state.form.regionId = r ? r.id : null
  state.form.sectionId = null           // تغيير المدينة يُسقط حيّها
  applyPlace()
}

export function selectSection(sectionId: any) {
  const sid = sectionId === '' || sectionId == null ? null : Number(sectionId)
  state.form.sectionId = sid
  applyPlace()
}

// تحميل عميل حقيقي (من contactCustomers) + تعبئة أول عنوان
function applyLiveAddress(addr: any) {
  state.form.addressText = addr?.address || ''
  // العنوان المركّب المحفوظ (قطعة/شارع/مبنى/دور/شقة)
  state.form.block = addr?.block || ''
  state.form.street = addr?.street || ''
  state.form.building = addr?.building || ''
  state.form.floor = addr?.floor || ''
  state.form.apartment = addr?.apartment || ''
  // العنوان محفوظ بالأسماء لا بالمعرّفات (لقطة وقت الطلب) — نطابقها لاستعادة الاختيار
  const r = addr?.region ? state.regions.find((x: any) => x.name === addr.region) : null
  state.form.regionId = r ? r.id : null
  const sec = r && addr?.section ? (r.sections || []).find((x: any) => x.name === addr.section) : null
  state.form.sectionId = sec ? sec.id : null
  applyPlace()
}
function loadLiveCustomer(c: any) {
  state.currentCustomer = c
  state.form.name = c.name || ''
  state.form.phone = c.phone || ''
  state.form.phone2 = ''
  state.form.notes = ''
  state.form.blacklist = false
  if (c.addresses && c.addresses.length > 0) {
    const def = c.addresses.find((a: any) => a.isDefault) || c.addresses[0]
    state.selectedAddressIndex = c.addresses.indexOf(def)
    applyLiveAddress(def)
  } else {
    state.selectedAddressIndex = -1
    state.form.regionId = null
    state.form.sectionId = null
    state.form.addressText = ''
    applyPlace()
  }
  state.showCustomerInfo = true
}

export function clearCartSilently() {
  state.cart = []
  state.orderNotes = ''
}

export function loadCustomerData(customer: any) {
  state.currentCustomer = customer
  state.form.name = customer.name
  state.form.phone = customer.phone
  state.form.phone2 = customer.phone2 || ''
  state.form.notes = customer.notes || ''
  state.form.blacklist = customer.isBlacklisted || false

  if (customer.addresses && customer.addresses.length > 0) {
    if (state.selectedAddressIndex >= 0 && state.selectedAddressIndex < customer.addresses.length) {
      // نحافظ على الاختيار الحالي طالما ضمن الحدود
    } else {
      state.selectedAddressIndex = 0
    }
    fillAddressFields(customer.addresses[state.selectedAddressIndex])
  } else {
    state.selectedAddressIndex = -1
    clearAddressFields()
  }

  // ربط الفرع الحالي بالمنطقة
  const b = branchByArea(customer.addresses?.[state.selectedAddressIndex]?.area || customer.addresses?.[0]?.area || '')
  if (b) state.currentBranch = b

  state.showCustomerInfo = true
}

export async function searchCustomer() {
  const phone = (state.phoneSearch || '').trim()
  if (!phone) {
    showToast('الرجاء إدخال رقم الهاتف للبحث', 'warning')
    return
  }

  // ── الوضع الحقيقي: بحث بالتليفون عبر contact API ──
  if (state.live) {
    try {
      const list = await contactCustomers(phone)
      if (list && list.length > 0) {
        clearCartSilently()
        loadLiveCustomer(list[0])
        showToast('تم العثور على بيانات العميل — راجع البيانات ثم اختر القائمة', 'success')
        state.activeTab = 'customer-data'
      } else {
        showToast('العميل غير موجود. يرجى إضافة بياناته.', 'info')
        clearCustomerData()
        clearCartSilently()
        state.form.phone = phone
        state.activeTab = 'customer-data'
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'فشل البحث عن العميل', 'error')
    }
    return
  }

  const customer = state.customers.find((c: any) => c.phone === phone || c.phone2 === phone)
  if (customer) {
    if (!state.currentCustomer || state.currentCustomer.id !== customer.id) clearCartSilently()
    loadCustomerData(customer)
    showToast('تم العثور على بيانات العميل — راجع البيانات ثم اختر القائمة', 'success')
    state.activeTab = 'customer-data'
  } else {
    showToast('العميل غير موجود. يرجى إضافة بياناته.', 'info')
    clearCustomerData()
    clearCartSilently()
    state.form.phone = phone
    state.activeTab = 'customer-data'
  }
}

export function selectAddress(idx: number) {
  state.selectedAddressIndex = idx
  const customer = state.currentCustomer
  if (customer && customer.addresses[idx]) {
    if (state.live) applyLiveAddress(customer.addresses[idx])
    else fillAddressFields(customer.addresses[idx])
  }
}

export function selectNewAddressState() {
  state.selectedAddressIndex = -1
  clearAddressFields()
  showToast('يمكنك الآن كتابة تفاصيل العنوان الجديد بالأسفل وضغط حفظ البيانات ليضاف للعميل', 'info')
}

export function deleteAddress(idx: number, event?: Event) {
  if (event) event.stopPropagation()
  if (!confirm('هل أنت متأكد من حذف هذا العنوان من سجل العميل؟')) return

  const customer = state.currentCustomer
  if (!customer || !customer.addresses) return

  customer.addresses.splice(idx, 1)

  const cIndex = state.customers.findIndex((c: any) => c.id === customer.id)
  if (cIndex !== -1) state.customers[cIndex].addresses = [...customer.addresses]

  if (state.selectedAddressIndex === idx) {
    state.selectedAddressIndex = customer.addresses.length > 0 ? 0 : -1
  } else if (state.selectedAddressIndex > idx) {
    state.selectedAddressIndex--
  }

  if (state.selectedAddressIndex !== -1 && customer.addresses[state.selectedAddressIndex]) {
    fillAddressFields(customer.addresses[state.selectedAddressIndex])
  } else {
    clearAddressFields()
  }

  showToast('تم حذف العنوان بنجاح', 'success')
}

export function showNewCustomerForm() {
  clearCustomerData()
  state.activeTab = 'customer-data'
}

export function clearCustomerData() {
  state.currentCustomer = null
  state.selectedAddressIndex = -1
  state.branchOverrideId = null
  state.form.name = ''
  state.form.phone = ''
  state.form.phone2 = ''
  state.form.notes = ''
  state.form.blacklist = false
  state.form.pickupBranch = ''
  clearAddressFields()
  state.showCustomerInfo = false
  state.phoneSearch = ''
}

export function cancelCustomerForm() {
  if (state.currentCustomer) {
    loadCustomerData(state.currentCustomer)
  } else {
    clearCustomerData()
  }
}

// حفظ العميل + عنوانه المركّب على الكلاود (وضع live) — يستعمل regionId مش حقل area المووك
async function saveCustomerLive() {
  const name = state.form.name.trim()
  const phone = state.form.phone.trim()
  if (!name || !phone) { showToast('يرجى تعبئة الاسم ورقم الموبايل', 'error'); return }
  const isDelivery = state.orderType === 'delivery'
  if (isDelivery && !state.form.regionId) { showToast('يرجى اختيار المدينة', 'error'); return }
  if (isDelivery && sectionRequired() && !state.form.sectionId) { showToast('يرجى اختيار الحيّ', 'error'); return }
  const region = currentArea()
  const section = (region?.sections || []).find((x: any) => x.id === state.form.sectionId) || null
  try {
    await contactSaveCustomer({
      name, phone: phoneE164(phone, companyDial()),
      regionName: region ? region.name : null,
      sectionName: section ? section.name : null,
      addressText: state.form.addressText || null,
      block: state.form.block || null, street: state.form.street || null,
      building: state.form.building || null, floor: state.form.floor || null, apartment: state.form.apartment || null,
    })
    showToast('تم حفظ بيانات العميل بنجاح', 'success')
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'تعذّر حفظ العميل', 'error')
  }
}

export function saveCustomer() {
  if (state.live) { void saveCustomerLive(); return }
  const name = state.form.name.trim()
  const phone = state.form.phone.trim()
  const area = state.form.area

  if (!name || !phone) {
    showToast('يرجى تعبئة الحقول الأساسية: الاسم ورقم الموبايل', 'error')
    return
  }
  if (state.orderType === 'delivery' && !area) {
    showToast('يرجى تعبئة الحقول الأساسية: الاسم، رقم الموبايل، والمنطقة', 'error')
    return
  }

  const customerData: any = {
    name,
    phone,
    phone2: state.form.phone2.trim(),
    notes: state.form.notes.trim(),
    isBlacklisted: state.form.blacklist,
    addresses: [],
  }

  const currentAddress: any = {
    id: Date.now(),
    area,
    block: state.form.block.trim(),
    street: state.form.street.trim(),
    building: state.form.building.trim(),
    floor: state.form.floor.trim(),
    apartment: state.form.apartment.trim(),
  }

  if (state.currentCustomer) {
    customerData.id = state.currentCustomer.id
    customerData.createdAt = state.currentCustomer.createdAt
    customerData.addresses = [...(state.currentCustomer.addresses || [])]

    if (area) {
      const idx = state.selectedAddressIndex
      if (idx !== -1 && customerData.addresses[idx]) {
        customerData.addresses[idx] = { ...customerData.addresses[idx], ...currentAddress, id: customerData.addresses[idx].id }
      } else {
        customerData.addresses.push(currentAddress)
        state.selectedAddressIndex = customerData.addresses.length - 1
      }
    }

    const index = state.customers.findIndex((c: any) => c.id === state.currentCustomer.id)
    if (index !== -1) state.customers[index] = customerData
    showToast('تم تحديث بيانات العميل بنجاح', 'success')
  } else {
    customerData.id = Date.now()
    customerData.createdAt = new Date().toISOString()
    if (area) {
      customerData.addresses.push(currentAddress)
      state.selectedAddressIndex = 0
    } else {
      state.selectedAddressIndex = -1
    }
    state.customers.push(customerData)
    showToast('تم إضافة العميل بنجاح', 'success')
  }

  loadCustomerData(customerData)

  // انتقل لتبويب القائمة لبدء الطلب (نفس التأخير الأصلي)
  setTimeout(() => {
    state.activeTab = 'menu'
    showAllCategories()
  }, 500)
}

export function setOrderType(type: string) {
  state.orderType = type
}

export function showTab(tab: string) {
  state.activeTab = tab
}

// ==========================================
// MENU
// ==========================================
export function selectCategory(categoryId: string) {
  state.activeCategory = categoryId
  state.menuView = 'items'
}

export function showAllCategories() {
  state.menuView = 'categories'
  state.menuSearch = ''
  state.activeCategory = ''
}

export function filterMenuItems(query: string) {
  state.menuSearch = query
  if (!query) { selectCategory('all'); return }
  state.menuView = 'items'
}

// مودال تخصيص الصنف (المرحلة الرابعة) — في الوضع الحقيقي (بدون أحجام/إضافات) نضيف الصنف مباشرةً
// موقوف لفرع معيّن = موقوف محلياً (إعدادات الكول‑سنتر) أو موقوف من مطبخ الـPOS (يُدفع من الكلاود)
export function isItemStoppedForBranch(branchId: number | null | undefined, itemId: number): boolean {
  if (!branchId) return false
  const local = state.disabledBranchItems[branchId] || []
  const pos = state.posStoppedItems[branchId] || []
  return local.includes(itemId) || pos.includes(itemId)
}
// الصنف موقوف لفرع الطلب الحالي؟ (محلي + مطبخ POS)
/**
 * الفرع الذي تُقاس عليه إتاحة الأصناف في المنيو.
 *
 * `getResolvedOrderBranchId()` يرجع null قبل اختيار العميل/المنطقة، وكان المنيو
 * حينها **لا يمنع شيئاً إطلاقاً** — فالوكيل يفتح المنيو أولاً (وهو المعتاد) فيضرب
 * صنفاً أوقفه المطبخ. فرعٌ واحد للشركة/الفرنشايز ⇒ هو فرع الطلب حتماً، فنستعمله.
 */
export function menuBranchId(): number | null {
  const resolved = getResolvedOrderBranchId()
  if (resolved) return resolved
  if (state.branches.length === 1) return state.branches[0].id
  return null
}

export function isItemDisabledForOrder(itemId: number): boolean {
  const bid = menuBranchId()
  if (bid) return isItemStoppedForBranch(bid, itemId)
  // فروع متعدّدة ولم يُحدَّد فرع الطلب بعد: نمنع ما هو موقوف في **كل** الفروع
  // (موقوف حتماً أياً كان الفرع)، ونترك الباقي للفحص عند تحديد المنطقة وعند الإرسال.
  return state.branches.length > 0 && state.branches.every((b: any) => isItemStoppedForBranch(b.id, itemId))
}

/** سبب الإيقاف — رسالة أدقّ من «موقوف» المجرّدة. */
export function itemStopReason(itemId: number): string {
  const bid = menuBranchId()
  if (bid && (state.posStoppedItems[bid] || []).includes(itemId)) return 'الصنف موقوف من مطبخ الفرع'
  return 'الصنف موقوف للكول‑سنتر في فرع الطلب'
}
// أصناف مطبخ الـPOS الموقوفة (لكل فرع) من الكلاود
export async function loadStoppedItems() {
  if (!(session.mode === 'agent' && session.companyId)) return
  try {
    const rows = await contactStoppedItems()   // [{ branchId, productIds }]
    const map: Record<number, number[]> = {}
    if (Array.isArray(rows)) rows.forEach((r: any) => { map[r.branchId] = Array.isArray(r.productIds) ? r.productIds : [] })
    state.posStoppedItems = map
  } catch { /* نُبقي الحالي */ }
}

export function openItemModal(itemId: number, cartItemId?: string) {
  const item = state.menuItems.find((i: any) => i.id === itemId)
  if (!item) return
  // منع ضرب صنف موقوف لهذا الفرع (عند الإضافة، مش وقت المراجعة بس)
  if (!cartItemId && isItemDisabledForOrder(itemId)) {
    showToast(itemStopReason(itemId), 'warning')
    return
  }
  const hasSizes = Array.isArray(item.sizes) && item.sizes.length > 0
  const hasExtras = Array.isArray(item.extras) && item.extras.length > 0
  // صنف بسعر مفتوح يفتح المودال دائماً — السعر لا بد أن يُدخله الوكيل قبل الإضافة
  const isOpen = !!item.isOpenPrice
  // لا أحجام ولا إضافات ولا سعر مفتوح → أضف مباشرة (بدون مودال)
  if (!cartItemId && !hasSizes && !hasExtras && !isOpen) { addToCart(item, { qty: 1 }); return }

  // افتح المودال، وعبّئه من عنصر السلة لو وضع تعديل
  state.selectedMenuItem = item
  state.editingCartItemId = cartItemId || null
  if (cartItemId) {
    const ci = state.cart.find((c: any) => c.cartItemId === cartItemId)
    state.selectedSize = ci?.size ?? (hasSizes ? item.sizes[0] : null)
    const names: string[] = ci?.extras || []
    state.selectedExtras = (item.extras || []).filter((e: any) => names.includes(e.name))
    state.itemModalQty = ci?.quantity || 1
    state.itemModalNote = ci?.note || ''
    // تعديل سطر مفتوح السعر: السعر المخزَّن = سعر الوحدة ناقص الإضافات
    state.itemModalOpenPrice = isOpen && ci ? String(Math.max(0, (ci.price || 0) - (ci.extrasPrice || 0))) : ''
  } else {
    state.selectedSize = hasSizes ? item.sizes[0] : null
    state.selectedExtras = []
    state.itemModalQty = 1
    state.itemModalNote = ''
    state.itemModalOpenPrice = ''
  }
  state.itemModalOpen = true
}
// ── دوال مودال تخصيص الصنف ──
export function selectItemSize(size: string) { state.selectedSize = size }
export function toggleModalExtra(extra: any) {
  const i = state.selectedExtras.findIndex((e: any) => e.id === extra.id)
  if (i > -1) state.selectedExtras.splice(i, 1)
  else state.selectedExtras.push(extra)
}
export function isModalExtraSelected(extraId: number): boolean { return state.selectedExtras.some((e: any) => e.id === extraId) }
export function changeItemModalQty(delta: number) { state.itemModalQty = Math.max(1, (state.itemModalQty || 1) + delta) }
export function itemModalUnitPrice(): number {
  const item = state.selectedMenuItem
  if (!item) return 0
  // سعر مفتوح: الأساس هو ما يكتبه الوكيل (الكتالوج لا يحمل سعراً لهذا الصنف)
  let base = item.isOpenPrice ? (parseFloat(state.itemModalOpenPrice) || 0) : item.price
  if (!item.isOpenPrice && state.selectedSize && Array.isArray(item.sizes)) {
    const idx = item.sizes.indexOf(state.selectedSize)
    if (idx > -1 && Array.isArray(item.sizePrices)) base = item.sizePrices[idx]
  }
  const extrasPrice = state.selectedExtras.reduce((s: number, e: any) => s + (e.price || 0), 0)
  return base + extrasPrice
}
/** هل يصحّ تأكيد المودال؟ صنف مفتوح السعر يلزمه سعر أكبر من صفر. */
export function itemModalValid(): boolean {
  const item = state.selectedMenuItem
  if (!item) return false
  if (!item.isOpenPrice) return true
  return (parseFloat(state.itemModalOpenPrice) || 0) > 0
}
export function itemModalTotal(): number { return itemModalUnitPrice() * (state.itemModalQty || 1) }
export function closeItemModal() { state.itemModalOpen = false; state.editingCartItemId = null; state.selectedMenuItem = null }
export function confirmItemModal() {
  const item = state.selectedMenuItem
  if (!item) return
  if (!itemModalValid()) { showToast('حدّد سعر الصنف أولاً', 'warning'); return }
  addToCart(item, {
    qty: state.itemModalQty, size: state.selectedSize, extras: state.selectedExtras, note: state.itemModalNote,
    openPrice: item.isOpenPrice ? (parseFloat(state.itemModalOpenPrice) || 0) : undefined,
  })
  state.itemModalOpen = false
  state.selectedMenuItem = null
}

// ==========================================
// CART
// ==========================================
// نقل addToCart بأمانة، مع تمرير (الحجم/الإضافات/الكمية/الملاحظة) بدل قراءتها من DOM المودال
export function addToCart(item: any, opts: any = {}) {
  if (!item) return
  const qty = opts.qty ?? 1
  const size = opts.size ?? (item.sizes ? item.sizes[0] : null)
  const selectedExtras = opts.extras ?? []
  const itemNote = (opts.note ?? '').trim()

  // سعر مفتوح: السعر يأتي من الوكيل (opts.openPrice) لا من الكتالوج
  let basePrice = item.isOpenPrice ? (Number(opts.openPrice) || 0) : item.price
  if (!item.isOpenPrice && size && item.sizes) {
    const sizeIndex = item.sizes.indexOf(size)
    if (sizeIndex > -1) basePrice = item.sizePrices[sizeIndex]
  }
  const extrasPrice = selectedExtras.reduce((sum: number, extra: any) => sum + extra.price, 0)
  const unitPrice = basePrice + extrasPrice

  // ===== وضع تعديل =====
  if (state.editingCartItemId) {
    const idx = state.cart.findIndex((ci: any) => ci.cartItemId === state.editingCartItemId)
    if (idx > -1) {
      state.cart[idx] = {
        ...state.cart[idx],
        size,
        quantity: qty,
        price: unitPrice,
        extras: selectedExtras.map((e: any) => e.name),
        extrasPrice,
        note: itemNote,
      }
      logPendingEvent({ type: 'item_edited', itemName: item.name, note: `تعديل ${item.name}` })
    }
    state.editingCartItemId = null
    showToast(`تم تعديل ${item.name}`, 'success')
    return
  }

  // ===== وضع إضافة جديد =====
  const extrasNames = selectedExtras.map((e: any) => e.name).sort().join(',')
  const existingItemIndex = state.cart.findIndex((cartItem: any) =>
    cartItem.itemId === item.id &&
    cartItem.size === size &&
    cartItem.extras.slice().sort().join(',') === extrasNames &&
    cartItem.note === itemNote &&
    // السعر جزء من مفتاح الدمج: صنف مفتوح السعر قد يُباع بسعرين في الطلب الواحد فيبقيان
    // سطرين. للأصناف العادية السعر ثابت فالشرط صحيح دائماً ولا يغيّر السلوك.
    cartItem.price === unitPrice
  )

  if (existingItemIndex > -1) {
    state.cart[existingItemIndex].quantity += qty
    logPendingEvent({ type: 'item_added', itemName: item.name, qtyAdded: qty, newQty: state.cart[existingItemIndex].quantity, note: `إضافة ${qty} × ${item.name}` })
  } else {
    state.cart.push({
      cartItemId: Date.now().toString(),
      itemId: item.id,
      name: item.name,
      size,
      quantity: qty,
      price: unitPrice,
      extras: selectedExtras.map((e: any) => e.name),
      extrasPrice,
      note: itemNote,
    })
    logPendingEvent({ type: 'item_added', itemName: item.name, qtyAdded: qty, newQty: qty, note: `إضافة ${qty} × ${item.name}` })
  }
  // `silent`: إعادة الطلب تضيف عدة أصناف دفعةً واحدة — توست لكل صنف يغرق الشاشة
  if (!opts.silent) showToast(`تم إضافة ${item.name} للسلة`, 'success')
}

export function updateCartItemQty(cartItemId: string, change: number) {
  const itemIndex = state.cart.findIndex((i: any) => i.cartItemId === cartItemId)
  if (itemIndex === -1) return
  const item = state.cart[itemIndex]
  const prevQty = item.quantity
  item.quantity += change
  if (item.quantity < 1) {
    state.cart.splice(itemIndex, 1)
    logPendingEvent({ type: 'item_removed', itemName: item.name, note: `حذف صنف: ${item.name}` })
  } else {
    logPendingEvent({ type: change > 0 ? 'item_qty_up' : 'item_qty_down', itemName: item.name, prevQty, newQty: item.quantity, note: `${change > 0 ? 'زيادة' : 'تقليل'} كمية ${item.name}: ${prevQty} → ${item.quantity}` })
  }
}

export function clearCart() {
  if (state.cart.length === 0) return
  if (confirm('هل أنت متأكد من مسح جميع الأصناف من السلة؟')) {
    const itemsCount = state.cart.length
    state.cart = []
    state.orderNotes = ''
    logPendingEvent({ type: 'cart_cleared', note: `تم تفريغ السلة (${itemsCount} صنف)` })
  }
}

// ==========================================
// DELIVERY FEE / TOTALS (نقلاً عن calculateCartTotals)
// ==========================================
export function getEffectiveDeliveryFee(): number {
  if (state.deliveryFeeOverride !== null && state.deliveryFeeOverride !== undefined) {
    return parseFloat(state.deliveryFeeOverride)
  }
  return state.deliveryFee
}

export function getCartSubtotal(): number {
  return state.cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
}

export function getAppliedDeliveryFee(): number {
  if (state.orderType !== 'delivery' || state.cart.length === 0) return 0
  // الوضع الحقيقي: الرسوم تظهر بمجرد اختيار منطقة؛ المووك: يتطلب عميلاً محمّلاً
  // الرسوم رسومُ الربط (فرع ↔ مكان)، فلا تظهر قبل أن يكتمل المكان ويُشتقّ الفرع
  if (state.live) return state.selectedRegionBranchId ? getEffectiveDeliveryFee() : 0
  return state.currentCustomer ? getEffectiveDeliveryFee() : 0
}

export function getCartTotal(): number {
  return getCartSubtotal() + getAppliedDeliveryFee()
}

export function canSubmitOrder(): boolean {
  // الوضع الحقيقي: يكفي اسم + تليفون + سلة (العميل يُنشأ تلقائياً عند الإرسال)
  if (state.live) {
    return state.cart.length > 0 && !!(state.form.phone || '').trim() && !!(state.form.name || '').trim()
  }
  return state.cart.length > 0 && !!state.currentCustomer
}

// زرّ التأكيد يمرّ بالمراجعة دائماً: الوكيل يقرأ الفرع والعنوان والرسوم والإجمالي
// قبل أن ينزل الطلب الفرعَ — والتصحيح بعد النزول يكون بالتليفون مع الفرع لا بضغطة.
export function checkout() {
  if (state.live) {
    const blocker = liveReviewBlocker()
    if (blocker) { showToast(blocker, 'warning'); return }
    state.reviewModalOpen = true
    return
  }
  reviewOrder()
}

// بناء ContactOrderInput وإرساله (cash on delivery حالياً)
export async function submitOrder() {
  if (state.live && state.onlineDay === null) { showToast('افتح يوم عمل الكول‑سنتر أولاً قبل ضرب الأوردر', 'warning'); return }
  if (state.cart.length === 0) { showToast('السلة فارغة', 'warning'); return }
  const phone = (state.form.phone || '').trim()
  const name = (state.form.name || '').trim()
  if (!phone || !name) { showToast('يرجى إدخال اسم العميل ورقم الموبايل', 'warning'); return }

  const isDelivery = state.orderType === 'delivery'
  if (isDelivery && !state.form.regionId) { showToast('يرجى اختيار المدينة', 'warning'); return }
  if (isDelivery && sectionRequired() && !state.form.sectionId) {
    showToast('اختر الحيّ — المدينة دي مش مربوطة بفرع، الفرع بيتحدد من الحيّ', 'warning'); return
  }
  // بلا فرع الطلب يُنشأ «محتجزاً» في الكلاود ولا ينزل أي فرع، ولا يعرف الوكيل ولا
  // العميل. نمنعه هنا بدل أن يضيع بصمت.
  if (isDelivery && !getResolvedOrderBranchId()) {
    showToast('مفيش فرع بيخدم المنطقة دي — اختر منطقة تانية أو حدّد الفرع يدوياً', 'error'); return
  }
  if (!state.paymentMethod) { showToast('يرجى تحديد طريقة الدفع (اضغط زر الدفع أسفل السلة)', 'warning'); return }
  // منع إرسال أوردر فيه صنف موقوف لفرع الطلب (محلي أو مطبخ POS)
  {
    const bid = getResolvedOrderBranchId()
    const bad = state.cart.filter((i: any) => isItemStoppedForBranch(bid, i.itemId))
    if (bad.length) { showToast(`الطلب فيه أصناف موقوفة لهذا الفرع: ${bad.map((i: any) => i.name).join('، ')}`, 'error'); return }
  }

  const region = currentArea()
  const section = (region?.sections || []).find((x: any) => x.id === state.form.sectionId) || null
  // كاش → تحصيل عند التسليم؛ كي‑نت/لينك → مدفوع أونلاين
  const paymentMode: 'cash_on_delivery' | 'prepaid_online' = state.paymentMethod === 'cash' ? 'cash_on_delivery' : 'prepaid_online'
  const payLabel = getPaymentLabel(state.paymentChannel, state.paymentMethod)
  // حجز: لازم موعد مستقبلي — الطلب ينزل الفرع فوراً ويظهر في قائمة الحجوزات بموعده
  if (state.isReservation) {
    const rt = state.reservationTime ? new Date(state.reservationTime) : null
    if (!rt || isNaN(rt.getTime())) { showToast('حدّد موعد الحجز', 'warning'); return }
    if (rt.getTime() <= Date.now()) { showToast('موعد الحجز لازم يكون في المستقبل', 'warning'); return }
  }

  const body: ContactOrderInput = {
    customerPhone: phoneE164(phone, companyDial()),
    customerName: name,
    paymentMode,
    orderTypeCode: isDelivery ? 5 : 6,   // delivery=5, pickup=6
    notes: [state.orderNotes, payLabel ? `الدفع: ${payLabel}` : ''].filter(Boolean).join(' — ') || null,
    // التجاوز اليدوي فقط — بلا تجاوز يشتقّ الخادم الرسوم من ربط (فرع ↔ مكان)
    deliveryFeeOverride: state.deliveryFeeOverride !== null && state.deliveryFeeOverride !== undefined
      ? Number(state.deliveryFeeOverride) : null,
    items: state.cart.map((i: any) => ({ productId: i.itemId, productName: i.name, quantity: i.quantity, unitPrice: i.price })),
  }
  if (state.isReservation && state.reservationTime) {
    body.reservationTime = new Date(state.reservationTime).toISOString()
    const lead = parseInt(String(state.prepLeadMinutes), 10)
    body.prepLeadMinutes = isNaN(lead) ? null : Math.max(0, lead)
  }
  if (isDelivery) {
    // المدينة والحيّ: `areaId`/`sectionId` أساس الاشتقاق على الخادم،
    // و`regionId`/`regionName` اسمان قديمان للمدينة يُبعثان للتوافق.
    body.areaId = region ? region.id : null
    body.sectionId = section ? section.id : null
    body.sectionName = section ? section.name : null
    body.regionId = region ? region.id : null
    body.regionName = region ? region.name : null
    body.addressText = state.form.addressText || null
    // العنوان المركّب (قطعة/شارع/مبنى/دور/شقة)
    body.block = state.form.block || null
    body.street = state.form.street || null
    body.building = state.form.building || null
    body.floor = state.form.floor || null
    body.apartment = state.form.apartment || null
    body.branchId = state.selectedRegionBranchId || null
  } else {
    body.branchId = state.form.pickupBranch ? parseInt(state.form.pickupBranch) : null
  }

  try {
    await contactCreateOrder(body)
    showToast(state.isReservation ? 'تم إنشاء الحجز ونزوله للفرع' : 'تم إنشاء الأوردر بنجاح', 'success')
    clearCartSilently()
    clearCustomerData()
    resetPaymentSelection()
    state.deliveryFeeOverride = null   // تجاوز الرسوم خاصّ بطلب واحد لا يُورَّث للتالي
    state.isReservation = false; state.reservationTime = ''; state.prepLeadMinutes = ''
    await loadOrders()   // حدّث القائمة قبل التنقّل عشان يظهر الأوردر الجديد
    state.activeView = 'orders'
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'فشل إنشاء الأوردر', 'error')
  }
}

// ==========================================
// ORDER NOTES (نقلاً عن updateOrderNotesPreview)
// ==========================================
export function orderNotesPreview(): string {
  return state.orderNotes ? state.orderNotes : 'لا توجد ملاحظات'
}

export function openOrderNotesModal() { state.notesModalOpen = true }
export function closeOrderNotesModal() { state.notesModalOpen = false }
export function saveOrderNotes(text: string) {
  state.orderNotes = (text || '').trim()
  state.notesModalOpen = false
  showToast(state.orderNotes ? 'تم حفظ ملاحظات الطلب' : 'تم مسح ملاحظات الطلب', 'success')
}

// صلاحية مستقلّة: تغيير الرسوم قرار ماليّ لا يلزم أن يملكه كل من يأخذ الأوردر
export function canChangeDeliveryFee(): boolean {
  return !state.live || (currentCompany()?.permissions || []).includes('callcenter.delivery_fee')
}
/**
 * رسوم «مفتوحة» = ربط الفرع بالمكان رسومه صفر بلا علم «مجاني» ⇒ غير محدَّدة، يُدخلها
 * الفرع لكل مشوار. نميّزها عن «مجاني» الصريح فلا يظنّ الوكيل التوصيلَ بلا رسوم.
 */
export function deliveryFeeIsOpen(): boolean {
  if (!state.live || state.orderType !== 'delivery') return false
  const area = currentArea()
  if (!area) return false
  const sec = (area.sections || []).find((x: any) => x.id === state.form.sectionId) || null
  const link = sec || area
  return Number(link?.fee || 0) === 0 && !link?.isFree
}
export function openDeliveryFeeModal() {
  if (!canChangeDeliveryFee()) { showToast('لا تملك صلاحية تغيير رسوم التوصيل', 'warning'); return }
  state.feeModalOpen = true
}
export function closeDeliveryFeeModal() { state.feeModalOpen = false }
/** الرسوم المشتقّة من الربط (قبل أي تجاوز) — لعرضها في المودال كمرجع وللرجوع إليها. */
export function derivedDeliveryFee(): number { return Number(state.deliveryFee || 0) }
export function applyDeliveryFeeOverride(value: any) {
  const v = parseFloat(String(value))
  if (isNaN(v) || v < 0) { showToast('أدخل رسوماً صحيحة', 'warning'); return }
  state.deliveryFeeOverride = v
  state.feeModalOpen = false
  showToast(`تم ضبط رسوم التوصيل على ${v}`, 'success')
}
export function resetDeliveryFeeOverride() {
  state.deliveryFeeOverride = null
  state.feeModalOpen = false
  showToast('رجعت الرسوم للقيمة الافتراضية للمنطقة', 'info')
}

// ── مودال الدفع (المصدر + الطريقة) ──
export function openPaymentModal() { state.paymentModalOpen = true }
export function closePaymentModal() { state.paymentModalOpen = false }
export function setPaymentChannel(id: string) {
  if (state.paymentChannel !== id) state.paymentMethod = null   // تغيير المصدر يصفّر الطريقة
  state.paymentChannel = id
}
export function setPaymentMethod(id: string) { state.paymentMethod = id }
export function resetPaymentSelection() { state.paymentChannel = null; state.paymentMethod = null }
export function confirmPaymentSelection() {
  if (!state.paymentChannel || !state.paymentMethod) { showToast('اختر المصدر وطريقة الدفع', 'warning'); return }
  state.paymentModalOpen = false
}

// ── سجل طلبات العميل ─────────────────────────────────────────────────────────
export function closeHistoryModal() { state.historyModalOpen = false }

export async function showOrderHistory() {
  const phone = (state.form.phone || state.currentCustomer?.phone || '').trim()
  if (!phone) { showToast('ابحث عن العميل بالتليفون أولاً لرؤية سجل طلباته', 'warning'); return }
  state.historyModalOpen = true
  if (!state.live) {
    // المووك: نفلتر القائمة الحالية بالعميل
    state.historyOrders = state.orders.filter((o: any) => o.customerPhone === phone)
    return
  }
  state.historyLoading = true
  try {
    // الخادم يفلتر بالتليفون — القائمة المحمّلة قد لا تحمل إلا طلبات اليوم
    const rows = await contactOrders({ phone, limit: 50 })
    state.historyOrders = Array.isArray(rows) ? rows.map(mapCloudOrder) : []
  } catch {
    state.historyOrders = []
    showToast('تعذّر تحميل سجل الطلبات', 'error')
  } finally {
    state.historyLoading = false
  }
}

/**
 * إعادة طلب سابق: نضيف بنوده للسلة **بأسعار الكتالوج الحالية** لا أسعار وقت الطلب،
 * ونُبلّغ الوكيل بكل فارق قبل أن يؤكّد — فلا يقرأ سعراً قديماً على العميل:
 *   • صنف لم يعد في المنيو  ⇒ يُتخطّى مع تنبيه
 *   • صنف موقوف الآن (مطبخ الفرع أو الكول‑سنتر) ⇒ يُتخطّى مع تنبيه
 *   • تغيّر السعر ⇒ يُضاف بالسعر الجديد مع ذكر القديم والجديد
 * البنود تأتي من `GET /contact/orders/:id` لأن قائمة الأوردرات لا تحمل بنوداً.
 */
export async function reorderItems(orderId: number) {
  if (state.reorderBusy) return
  state.reorderBusy = true
  try {
    let items: any[] = []
    if (state.live) {
      const detail = await contactOrder(orderId)
      items = Array.isArray(detail?.items) ? detail.items : []
    } else {
      const o = state.orders.find((x: any) => x.id === orderId)
      items = Array.isArray(o?.items) ? o.items : []
    }
    if (!items.length) { showToast('الطلب ده مفيهوش أصناف', 'warning'); return }

    const branchId = getResolvedOrderBranchId()
    const missing: string[] = []
    const stopped: string[] = []
    const priced: string[] = []
    let added = 0

    for (const it of items) {
      const oldName = it.productName || it.name || 'صنف'
      const pid = it.productId ?? it.itemId ?? null
      const menuItem = pid != null ? state.menuItems.find((m: any) => m.id === pid) : null
      if (!menuItem) { missing.push(oldName); continue }
      if (isItemStoppedForBranch(branchId, menuItem.id)) { stopped.push(menuItem.name); continue }

      const qty = Math.max(1, Math.trunc(Number(it.quantity) || 1))
      // الإضافات: نُبقي ما زال موجوداً في الكتالوج فقط (بسعره الحالي)
      const wanted: any[] = Array.isArray(it.modifiers) ? it.modifiers : []
      const extras = wanted
        .map((w: any) => (menuItem.extras || []).find((e: any) => e.id === (w.id ?? w.optionId)))
        .filter(Boolean)
      // المقاس: لو لم يعد موجوداً نرجع للافتراضي
      const size = it.variantName && (menuItem.sizes || []).includes(it.variantName) ? it.variantName : undefined

      // السعر الحالي بنفس معادلة addToCart (أساس/مقاس + إضافات) — نحسبه قبل الإضافة
      let base = Number(menuItem.price) || 0
      if (size && Array.isArray(menuItem.sizes)) {
        const si = menuItem.sizes.indexOf(size)
        if (si > -1) base = Number(menuItem.sizePrices?.[si]) || base
      }
      const newUnit = base + extras.reduce((sum: number, e: any) => sum + (Number(e.price) || 0), 0)
      const oldUnit = Number(it.unitPrice) || 0
      if (oldUnit > 0 && Math.abs(newUnit - oldUnit) > 0.009) {
        priced.push(`${menuItem.name}: ${oldUnit} ← ${newUnit}`)
      }

      addToCart(menuItem, { qty, size, extras, note: it.notes || '', silent: true })
      added++
    }

    // تنبيه واحد مجمَّع بدل سيل من التوستات
    const notes: string[] = []
    if (added) notes.push(`تمت إضافة ${added} صنف`)
    if (priced.length) notes.push(`تغيّر السعر: ${priced.join(' · ')}`)
    if (stopped.length) notes.push(`موقوف حالياً ولم يُضَف: ${stopped.join('، ')}`)
    if (missing.length) notes.push(`لم يعد في المنيو: ${missing.join('، ')}`)
    const hasProblem = priced.length || stopped.length || missing.length
    showToast(notes.join(' — ') || 'لا شيء لإضافته', hasProblem ? 'warning' : 'success')
    if (added) { state.historyModalOpen = false; state.activeTab = 'menu' }
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'تعذّر إعادة الطلب', 'error')
  } finally {
    state.reorderBusy = false
  }
}

// ==========================================
// ORDER SUBMISSION (reviewOrder — تحقق + stub للمودال)
// ==========================================
export function reviewOrder() {
  if (state.cart.length === 0) { showToast('السلة فارغة', 'warning'); return }
  if (!state.currentCustomer) { showToast('يرجى إضافة بيانات العميل أولاً', 'warning'); return }
  if (!state.paymentChannel) { showToast('يرجى تحديد مصدر الطلب أولاً (الفون / طلبات / كاري / ...)', 'warning'); return }
  if (!state.paymentMethod) { showToast('يرجى تحديد طريقة الدفع (كاش / كي نت / لينك)', 'warning'); return }

  const orderBranchId = getResolvedOrderBranchId()
  const disabledItems = orderBranchId ? (state.disabledBranchItems[orderBranchId] || []) : []
  const invalidCartItems = state.cart.filter((item: any) => disabledItems.includes(item.itemId))
  if (invalidCartItems.length > 0) {
    const branch = state.branches.find((b: any) => b.id === orderBranchId)
    const branchName = branch ? branch.name : 'الفرع المحدد'
    const itemNames = invalidCartItems.map((i: any) => i.name).join('، ')
    showToast(`الطلب يحتوي على أصناف غير متوفرة في ${branchName}: (${itemNames})`, 'error')
    return
  }

  state.reviewModalOpen = true
}
export function closeReviewModal() { state.reviewModalOpen = false }

/**
 * تحقّق المراجعة في الوضع الحقيقي: نفس شروط `submitOrder` لكن **قبل** فتح المودال،
 * فلا يراجع الوكيل طلباً سيُرفَض. تُرجع أول مانع أو null.
 */
function liveReviewBlocker(): string | null {
  if (state.onlineDay === null) return 'افتح يوم عمل الكول‑سنتر أولاً قبل ضرب الأوردر'
  if (state.cart.length === 0) return 'السلة فارغة'
  if (!(state.form.phone || '').trim() || !(state.form.name || '').trim()) return 'يرجى إدخال اسم العميل ورقم الموبايل'
  if (state.orderType === 'delivery') {
    if (!state.form.regionId) return 'يرجى اختيار المدينة'
    if (sectionRequired() && !state.form.sectionId) return 'اختر الحيّ — الفرع بيتحدد منه'
    if (!getResolvedOrderBranchId()) return 'مفيش فرع بيخدم المنطقة دي'
  }
  if (!state.paymentMethod) return 'يرجى تحديد طريقة الدفع'
  const bid = getResolvedOrderBranchId()
  const bad = state.cart.filter((i: any) => isItemStoppedForBranch(bid, i.itemId))
  if (bad.length) return `الطلب فيه أصناف موقوفة: ${bad.map((i: any) => i.name).join('، ')}`
  return null
}

/** ملخّص المراجعة — مصدر واحد يقرأه المودال بدل تكرار الحسابات في الواجهة. */
export function reviewSummary(): any {
  const area = currentArea()
  const sec = (area?.sections || []).find((x: any) => x.id === state.form.sectionId) || null
  return {
    customerName: state.form.name || state.currentCustomer?.name || '—',
    customerPhone: state.form.phone || state.currentCustomer?.phone || '—',
    orderType: state.orderType,
    branchName: infoBranchName(),
    areaName: area?.name || null,
    sectionName: sec?.name || null,
    address: infoAddress(),
    payment: getPaymentLabel(state.paymentChannel, state.paymentMethod) || '—',
    items: state.cart,
    subtotal: getCartSubtotal(),
    deliveryFee: getAppliedDeliveryFee(),
    feeIsOverridden: state.deliveryFeeOverride !== null && state.deliveryFeeOverride !== undefined,
    feeIsOpen: deliveryFeeIsOpen(),
    total: getCartTotal(),
    notes: state.orderNotes || '',
    isReservation: !!state.isReservation,
    reservationTime: state.reservationTime || '',
  }
}

/** تأكيد المراجعة → الإرسال الفعلي (الحقيقي) أو رسالة المووك. */
export function confirmReview() {
  state.reviewModalOpen = false
  if (state.live) { void submitOrder(); return }
  showToast('تم تأكيد الطلب (بيانات تجريبية)', 'success')
}

// ==========================================
// ORDER STATUS SEARCH (نقلاً عن searchOrderStatus)
// ==========================================
export function searchOrderStatus() {
  const query = (state.statusSearch || '').trim().toLowerCase()
  if (!query) { state.statusResult = undefined; return }
  const order = state.orders.find((o: any) =>
    o.invoiceNo.toLowerCase() === query || o.customerPhone.includes(query)
  )
  state.statusResult = order || null
}

// ==========================================
// DELIVERY ORDERS TAB (نقلاً عن renderDeliveryOrders / filterOrders)
// ==========================================
export function deliveryOrdersFiltered(): any[] {
  const bd = state.businessDate || todayISO()
  let filtered = state.orders.filter((o: any) =>
    o.type === 'delivery' &&
    !o.scheduledDate &&
    (state.live || (o.businessDate || (o.createdAt || '').slice(0, 10)) === bd)
  )
  if (state.filterStatus) filtered = filtered.filter((o: any) => o.status === state.filterStatus)
  const inv = (state.filterInvoice || '').trim().toLowerCase()
  if (inv) filtered = filtered.filter((o: any) => o.invoiceNo.toLowerCase().includes(inv))
  const ph = (state.filterPhone || '').trim().toLowerCase()
  if (ph) filtered = filtered.filter((o: any) => o.customerPhone.includes(ph))
  return filtered
}

export function clearTabOrderFilters() {
  state.filterInvoice = ''
  state.filterPhone = ''
  state.filterStatus = ''
}

// ==========================================
// ALL ORDERS VIEW (نقلاً عن renderAllOrders / filterAllOrders / clearAllOrderFilters)
// ==========================================
export function allOrdersFiltered(): any[] {
  const bd = state.businessDate || todayISO()
  let filtered = state.orders.filter((o: any) =>
    !o.scheduledDate &&
    (state.live || (o.businessDate || (o.createdAt || '').slice(0, 10)) === bd)
  )
  if (state.allFilterStatus) filtered = filtered.filter((o: any) => o.status === state.allFilterStatus)
  if (state.allFilterBranch) filtered = filtered.filter((o: any) => o.branchId === parseInt(state.allFilterBranch))
  const inv = (state.allFilterInvoice || '').trim().toLowerCase()
  if (inv) filtered = filtered.filter((o: any) => o.invoiceNo.toLowerCase().includes(inv))
  const ph = (state.allFilterPhone || '').trim().toLowerCase()
  if (ph) filtered = filtered.filter((o: any) => o.customerPhone.includes(ph))
  return filtered
}

export function clearAllOrderFilters() {
  state.allFilterInvoice = ''
  state.allFilterPhone = ''
  state.allFilterStatus = ''
  state.allFilterBranch = ''
}

// ==========================================
// SCHEDULED ORDERS VIEW (نقلاً عن renderScheduledOrders)
// ==========================================
export function scheduledOrdersList(): any[] {
  return state.orders
    .filter((o: any) => o.scheduledDate)
    .slice()
    .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
}

// ==========================================
// SETTINGS — AVAILABILITY (نقلاً عن renderBranchItemsSettings / renderStoppedItemsView / toggleBranchItemAvailability)
// ==========================================
// مصادر onchange/oninput الأصلية — تُحدّث الحالة التفاعلية فقط (الـgetter يعيد الحساب تلقائياً)
export function onAvailabilityBranchChange(branchId: string) { state.availBranchId = branchId }
export function onAvailabilityCategoryChange(categoryId: string) { state.availCategory = categoryId }
export function onAvailabilitySearchChange(query: string) { state.availSearch = query }

// قائمة الأصناف مجمّعة حسب التصنيف للفرع/التصنيف/البحث الحالي (نقلاً عن renderBranchItemsSettings)
export function availabilityGroups(): any[] {
  const branchIdInt = parseInt(state.availBranchId)
  const disabledItems = state.disabledBranchItems[branchIdInt] || []
  // موقوف من مطبخ الفرع: يظهر موقوفاً ومفتاحه مقفول — إعادة تشغيله قرار الفرع لا الوكيل
  const posStopped = state.posStoppedItems[branchIdInt] || []
  const activeCategory = state.availCategory || 'all'
  const searchQuery = (state.availSearch || '').trim().toLowerCase()

  const groups: any[] = []
  state.menuCategories.forEach((cat: any) => {
    if (cat.id === 'all') return
    if (activeCategory !== 'all' && activeCategory !== cat.id) return

    let catItems = state.menuItems.filter((item: any) => item.categoryId === cat.id)
    if (searchQuery) {
      catItems = catItems.filter((item: any) =>
        (item.name || '').toLowerCase().includes(searchQuery) ||
        (item.nameEn || '').toLowerCase().includes(searchQuery)
      )
    }
    if (catItems.length === 0) return

    groups.push({
      cat,
      items: catItems.map((item: any) => ({
        item,
        isAvailable: !disabledItems.includes(item.id) && !posStopped.includes(item.id),
        fromPos: posStopped.includes(item.id),
      })),
    })
  })
  return groups
}

// الأصناف الموقوفة مجمّعة حسب الفرع (نقلاً عن renderStoppedItemsView)
export function stoppedItemsGroups(): any[] {
  const groups: any[] = []
  state.branches.forEach((branch: any) => {
    // المصدران معاً: إيقاف الكول‑سنتر + إيقاف مطبخ الفرع. الشاشة كانت تعرض الأول
    // وحده، فصنفٌ أوقفه المطبخ يُمنع عند الضرب بلا أن يظهر موقوفاً في أي شاشة.
    const cc = state.disabledBranchItems[branch.id] || []
    const pos = state.posStoppedItems[branch.id] || []
    const ids = new Set([...cc, ...pos])
    const items = state.menuItems
      .filter((item: any) => ids.has(item.id))
      .map((item: any) => ({ ...item, fromPos: pos.includes(item.id) }))
    if (!items.length) return
    groups.push({ branch, items })
  })
  return groups
}

// صلاحية إيقاف/تشغيل الأصناف — مفتاح مستقلّ (`callcenter.stop_items`) لا `manage`:
// إيقاف صنف قرار تشغيليّ يومي، بينما `manage` مفتاح إدارة عام لا يُمنح لكل مشرف وردية.
export function canManageItemAvailability(): boolean {
  const perms: string[] = currentCompany()?.permissions || []
  return !state.live || perms.includes('callcenter.stop_items')
}
/**
 * يرجع `false` لو رُفض التبديل — فتُعيد الشاشة المفتاح لموضعه.
 * بدون ذلك يبقى المفتاح مقلوباً بصرياً بعد الرفض: ربط `:checked` لا يُعيد الرسم
 * لأن القيمة التفاعلية لم تتغيّر أصلاً، فيظن المستخدم أن الإيقاف تمّ.
 */
export function toggleBranchItemAvailability(branchId: number | string, itemId: number, isAvailable: boolean): boolean {
  if (!canManageItemAvailability()) { showToast('لا تملك صلاحية إيقاف/تشغيل الأصناف', 'warning'); return false }
  const bid = parseInt(String(branchId))
  // الصنف الموقوف من مطبخ الفرع يرجع بإيقافه هناك — لا يملك الكول‑سنتر تشغيله
  if (isAvailable && (state.posStoppedItems[bid] || []).includes(itemId)) {
    showToast('الصنف موقوف من مطبخ الفرع — تشغيله يكون من الفرع', 'warning'); return false
  }
  if (!state.disabledBranchItems[bid]) state.disabledBranchItems[bid] = []
  const index = state.disabledBranchItems[bid].indexOf(itemId)

  const item = state.menuItems.find((i: any) => i.id === itemId)
  const branch = state.branches.find((b: any) => b.id === bid)
  const itemName = item ? item.name : 'الصنف'
  const branchName = branch ? branch.name : 'الفرع'

  if (isAvailable) {
    if (index > -1) state.disabledBranchItems[bid].splice(index, 1)
  } else {
    if (index === -1) state.disabledBranchItems[bid].push(itemId)
  }

  // الوضع الحقيقي: القائمة على الكلاود مشتركة بين كل الوكلاء. نُحدِّث الشاشة فوراً
  // (تفاؤلياً) ثم نكتب؛ وأي فشل يُرجع التغيير بدل أن تبقى الشاشة كاذبة.
  if (state.live) {
    contactSetCcStopped({ branchId: bid, productId: itemId, stopped: !isAvailable })
      // إعادة القراءة من الخادم بعد الكتابة: الشاشة تعرض ما هو **محفوظ** لا ما نتمنّاه.
      // بدونها كان التحديث التفاؤلي يبقى معروضاً حتى لو لم يُحفظ شيء، ثم يعود عند أول
      // مزامنة فيبدو كأن الإيقاف «رجع لوحده».
      .then(async () => {
        const ok = await loadCcStoppedItems()
        if (!ok) { showToast('تعذّر التأكّد من الحفظ — حدّث الصفحة وراجع الحالة', 'warning'); return }
        const saved = (state.disabledBranchItems[bid] || []).includes(itemId)
        if (saved === isAvailable) { showToast('لم يُحفظ التغيير على الخادم — حاول ثانية', 'error'); return }
        showToast(
          isAvailable ? `تم تنشيط وإتاحة ${itemName} في ${branchName}` : `تم إيقاف ${itemName} في ${branchName} — للكول‑سنتر فقط`,
          isAvailable ? 'success' : 'warning')
      })
      .catch((err: any) => {
        const arr = state.disabledBranchItems[bid] || []
        const i = arr.indexOf(itemId)
        if (isAvailable) { if (i === -1) arr.push(itemId) } else if (i > -1) arr.splice(i, 1)
        showToast(err?.response?.data?.message || 'تعذّر حفظ الإيقاف', 'error')
      })
    return true   // قُبل التبديل محلياً؛ نتيجة الخادم تُعالَج أعلاه
  }

  showToast(
    isAvailable ? `تم تنشيط وإتاحة ${itemName} في ${branchName}` : `تم تعطيل وإيقاف ${itemName} في ${branchName}`,
    isAvailable ? 'success' : 'warning')
  saveDisabledItems()
  return true
}

// ==========================================
// ORDER DETAIL PANEL (نقلاً عن viewOrderDetail / updateOrderStatus)
// ==========================================
// تبديل عرض لوحة التفاصيل: نفس id مفتوح → يقفل؛ غير كده → يفتح (مطابق toggle الأصل عبر dataset.openOrderId)
export function viewOrderDetail(orderId: number, _source?: string) {
  state.openOrderId = state.openOrderId === orderId ? null : orderId
}

// نص طريقة الدفع (نقلاً عن getPaymentLabel)
export function getPaymentLabel(channelId: string, methodId: string): string {
  const ch = PAYMENT_CHANNELS.find((c: any) => c.id === channelId)
  const m = PAYMENT_METHODS.find((x: any) => x.id === methodId)
  const chLabel = ch ? ch.name : channelId
  const mLabel = m ? m.name : methodId
  return `${chLabel}  •  ${mLabel}`
}

// حالة الطلب التالية في المسار (نقلاً عن statusFlow في viewOrderDetail)
const STATUS_FLOW = ['new', 'preparing', 'ready', 'onway', 'delivered']
export function orderNextStatusObj(order: any): any {
  const currentIndex = STATUS_FLOW.indexOf(order.status)
  const nextStatus = currentIndex > -1 && currentIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIndex + 1] : null
  return nextStatus ? ORDER_STATUSES.find((s: any) => s.id === nextStatus) : null
}

// تقديم الطلب لحالته التالية (نقلاً عن updateOrderStatus مع 'next')
export function advanceOrderStatus(orderId: number) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return
  const currentIndex = STATUS_FLOW.indexOf(order.status)
  if (currentIndex < 0 || currentIndex >= STATUS_FLOW.length - 1) return
  const prevStatus = order.status
  const newStatus = STATUS_FLOW[currentIndex + 1]
  order.status = newStatus
  order.updatedAt = new Date().toISOString()

  const statusObjNew = ORDER_STATUSES.find((s: any) => s.id === newStatus)
  const statusObjOld = ORDER_STATUSES.find((s: any) => s.id === prevStatus)
  order.statusHistory = order.statusHistory || []
  order.statusHistory.push({
    type: 'status',
    status: newStatus,
    fromStatus: prevStatus,
    at: order.updatedAt,
    by: state.currentUser ? state.currentUser.name : 'موظف',
    note: `تغيير الحالة من "${statusObjOld ? statusObjOld.name : prevStatus}" إلى "${statusObjNew ? statusObjNew.name : newStatus}"`,
  })
  showToast(`تم تحديث حالة الطلب #${order.invoiceNo} إلى: ${statusObjNew ? statusObjNew.name : newStatus}`, 'success')
}

// ==========================================
// ASSIGN DRIVER MODAL (نقلاً عن showAssignDriverModal / filterDriverList / selectDriverForOrder / unassignDriverFromOrder)
// ==========================================
export function openAssignDriverModal(orderId: number) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return
  if (order.type !== 'delivery') {
    showToast('تعيين السائق متاح لطلبات التوصيل فقط', 'warning')
    return
  }
  state.driverSearch = ''
  state.driverModalOrderId = orderId
}
export function closeDriverModal() { state.driverModalOrderId = null }

// قائمة السائقين مقسّمة: سائقي فرع الطلب أولاً ثم الباقي — مع فلتر البحث (نقلاً عن filterDriverList)
export function driverGroups(order: any): { branchDrivers: any[]; otherDrivers: any[] } {
  const q = (state.driverSearch || '').trim().toLowerCase()
  const match = (d: any) => !q || (d.name || '').toLowerCase().includes(q) || (d.phone || '').toLowerCase().includes(q)
  return {
    branchDrivers: state.drivers.filter((d: any) => d.branchId === order.branchId && match(d)),
    otherDrivers: state.drivers.filter((d: any) => d.branchId !== order.branchId && match(d)),
  }
}

export function selectDriverForOrder(orderId: number, driverId: number) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return
  const driver = state.drivers.find((d: any) => d.id === driverId)
  if (!driver) return

  const prevDriverName = order.driverName
  const nowIso = new Date().toISOString()

  order.driverId = driver.id
  order.driverName = driver.name
  order.driverPhone = driver.phone
  order.driverAssignedAt = nowIso
  order.updatedAt = nowIso

  order.statusHistory = order.statusHistory || []
  order.statusHistory.push({
    type: 'driver_assigned',
    at: nowIso,
    by: state.currentUser ? state.currentUser.name : 'موظف',
    driverName: driver.name,
    driverPhone: driver.phone,
    note: prevDriverName
      ? `تم تغيير السائق من ${prevDriverName} إلى ${driver.name} (${driver.phone})`
      : `تم تحميل الطلب على السائق ${driver.name} (${driver.phone})`,
  })

  // لو الطلب لسه "جاهز"، حوّل حالته لـ "في الطريق" تلقائياً
  if (order.status === 'ready') {
    order.status = 'onway'
    const statusObjOld = ORDER_STATUSES.find((s: any) => s.id === 'ready')
    const statusObjNew = ORDER_STATUSES.find((s: any) => s.id === 'onway')
    order.statusHistory.push({
      type: 'status',
      status: 'onway',
      fromStatus: 'ready',
      at: nowIso,
      by: state.currentUser ? state.currentUser.name : 'موظف',
      note: `تغيير الحالة من "${statusObjOld?.name}" إلى "${statusObjNew?.name}" تلقائياً عند تعيين السائق`,
    })
  }

  showToast(`تم تعيين السائق ${driver.name} للطلب #${order.invoiceNo}`, 'success')
  closeDriverModal()
}

export function unassignDriverFromOrder(orderId: number) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return
  if (!confirm('هل تريد إلغاء تعيين السائق من هذا الطلب؟')) return

  const prevDriverName = order.driverName
  const nowIso = new Date().toISOString()

  order.driverId = null
  order.driverName = null
  order.driverPhone = null
  order.driverAssignedAt = null
  order.updatedAt = nowIso

  order.statusHistory = order.statusHistory || []
  order.statusHistory.push({
    type: 'driver_unassigned',
    at: nowIso,
    by: state.currentUser ? state.currentUser.name : 'موظف',
    note: `تم إلغاء تعيين السائق ${prevDriverName || ''}`,
  })

  showToast('تم إلغاء تعيين السائق', 'info')
  closeDriverModal()
}

// ==========================================
// CANCEL ORDER MODAL (نقلاً عن openCancelOrderModal + updateOrderStatus 'cancelled')
// ==========================================
export const cancellationReasons = CANCELLATION_REASONS
// صلاحية إلغاء الطلب — مفتاحها المستقلّ
export function canCancelOrder(): boolean {
  return !state.live || (currentCompany()?.permissions || []).includes('callcenter.cancel')
}
/**
 * الإلغاء ممكن **قبل نزول الطلب الفرع فقط**؛ بعدها يملكه الفرع (الخادم يرفض صراحةً).
 * الحالة `sent` = لم يصل الفرع بعد. نُخفي الزرّ بدل أن يضغطه الوكيل فيُرفَض.
 */
export function canCancelThisOrder(order: any): boolean {
  if (!order || order.status === 'cancelled') return false
  if (!state.live) return true
  return order.status === 'sent'
}
export function openCancelModal(orderId: number) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return
  if (!canCancelOrder()) { showToast('لا تملك صلاحية إلغاء الطلبات', 'warning'); return }
  if (!canCancelThisOrder(order)) { showToast('الطلب نزل الفرع بالفعل — الإلغاء يكون من الفرع', 'warning'); return }
  state.cancelModalOrderId = orderId
}
export function closeCancelModal() { state.cancelModalOrderId = null }

// تطبيق الإلغاء بالسبب المختار (reason = { id, label, note? }) — نقلاً عن منطق updateOrderStatus
/**
 * الإلغاء على السيرفر أولاً ثم على الشاشة. كان محلياً بالكامل: الوكيل يلغي فيختفي
 * الطلب من أمامه بينما ينزل الفرع ويُصنَع ويُحمَّل على سائق. السبب لا يقبله
 * الـendpoint فنسجّله شكوى‑أثراً في الملاحظات المحلية فقط (سجلّ الوكيل).
 */
async function confirmCancelOrderLive(orderId: number, reason: any) {
  try {
    await contactCancelOrder(orderId)
    applyLocalCancel(orderId, reason)
    showToast('تم إلغاء الطلب', 'success')
    closeCancelModal()
    await loadOrders()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'تعذّر إلغاء الطلب', 'error')
  }
}

export function confirmCancelOrder(orderId: number, reason: any) {
  if (state.live) {
    if (!canCancelOrder()) { showToast('لا تملك صلاحية إلغاء الطلبات', 'warning'); return }
    if (!reason) { showToast('اختر سبب الإلغاء', 'warning'); return }
    void confirmCancelOrderLive(orderId, reason)
    return
  }
  applyLocalCancel(orderId, reason)
}

function applyLocalCancel(orderId: number, reason: any) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order || !reason) return
  const prevStatus = order.status
  const nowIso = new Date().toISOString()
  order.status = 'cancelled'
  order.updatedAt = nowIso
  order.cancellationReason = reason

  const statusObjNew = ORDER_STATUSES.find((s: any) => s.id === 'cancelled')
  const statusObjOld = ORDER_STATUSES.find((s: any) => s.id === prevStatus)
  order.statusHistory = order.statusHistory || []
  const baseNote = `تغيير الحالة من "${statusObjOld ? statusObjOld.name : prevStatus}" إلى "${statusObjNew ? statusObjNew.name : 'ملغي'}"`
  const reasonNote = `\nالسبب: ${reason.label}${reason.note ? ' — ' + reason.note : ''}`
  order.statusHistory.push({
    type: 'cancelled',
    status: 'cancelled',
    fromStatus: prevStatus,
    at: nowIso,
    by: state.currentUser ? state.currentUser.name : 'موظف',
    cancellationReason: reason,
    note: baseNote + reasonNote,
  })

  showToast(`تم تحديث حالة الطلب #${order.invoiceNo} إلى: ${statusObjNew ? statusObjNew.name : 'ملغي'}`, 'success')
  closeCancelModal()
}

// ==========================================
// ORDER TRANSACTIONS MODAL (نقلاً عن showOrderTransactions / getTransactionMeta)
// ==========================================
export function openTxnModal(orderId: number) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return
  state.txnModalOrderId = orderId
}
export function closeTxnModal() { state.txnModalOrderId = null }

export function getTransactionMeta(entry: any): any {
  switch (entry.type) {
    case 'item_added':
      return { icon: 'shopping-cart', title: `إضافة صنف: ${entry.itemName || ''}`, bg: 'rgba(59, 130, 246, 0.12)', color: '#1d4ed8' }
    case 'item_qty_up':
      return { icon: 'plus', title: `زيادة كمية: ${entry.itemName || ''}`, bg: 'rgba(16, 185, 129, 0.12)', color: '#047857' }
    case 'item_qty_down':
      return { icon: 'minus', title: `تقليل كمية: ${entry.itemName || ''}`, bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' }
    case 'item_removed':
      return { icon: 'trash', title: `حذف صنف: ${entry.itemName || ''}`, bg: 'rgba(239, 68, 68, 0.13)', color: '#b91c1c' }
    case 'item_edited':
      return { icon: 'edit', title: `تعديل صنف: ${entry.itemName || ''}`, bg: 'rgba(139, 92, 246, 0.14)', color: '#6d28d9' }
    case 'cart_cleared':
      return { icon: 'broom', title: 'تفريغ السلة', bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' }
    case 'driver_assigned':
      return { icon: 'bike', title: `تحميل على السائق: ${entry.driverName || ''}`, bg: 'rgba(6, 182, 212, 0.14)', color: '#0e7490' }
    case 'driver_unassigned':
      return { icon: 'ban', title: 'إلغاء تعيين السائق', bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' }
    case 'created':
      return { icon: 'check-circle', title: 'تأكيد الطلب', bg: 'rgba(37, 99, 235, 0.14)', color: '#1d4ed8' }
    // أنواع السجلّ القادم من الكلاود (buildTimeline)
    case 'branch':
      return { icon: 'store', title: 'نزل الفرع', bg: 'rgba(37, 99, 235, 0.14)', color: '#1d4ed8' }
    case 'held':
      return { icon: 'alert-triangle', title: 'محتجَز — بانتظار تعيين فرع', bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' }
    case 'driver':
      return { icon: 'bike', title: 'السائق', bg: 'rgba(6, 182, 212, 0.14)', color: '#0e7490' }
    case 'delivered':
      return { icon: 'check-circle', title: 'تم التسليم', bg: 'rgba(16, 185, 129, 0.12)', color: '#047857' }
    case 'edited':
      return { icon: 'edit', title: 'تعديل الطلب', bg: 'rgba(139, 92, 246, 0.14)', color: '#6d28d9' }
    case 'complaint':
      return { icon: 'alert-triangle', title: 'تقديم شكوى', bg: 'rgba(239, 68, 68, 0.13)', color: '#b91c1c' }
    case 'cancelled':
      return { icon: 'x-circle', title: 'إلغاء الطلب', bg: 'rgba(239, 68, 68, 0.13)', color: '#b91c1c' }
    case 'status':
    default: {
      const statusObj = ORDER_STATUSES.find((s: any) => s.id === entry.status)
      return {
        icon: statusObj ? statusObj.icon : 'history',
        title: statusObj ? `الحالة: ${statusObj.name}` : 'تحديث الحالة',
        bg: 'rgba(16, 185, 129, 0.12)',
        color: '#047857',
      }
    }
  }
}

// سجل عمليات الطلب مرتّب تنازلياً مع بناء افتراضي لو مفيش تاريخ (نقلاً عن showOrderTransactions)
export function orderTransactions(order: any): any[] {
  let history = order.statusHistory || []
  if (history.length === 0) {
    history = [{
      type: 'created',
      status: 'new',
      at: order.createdAt,
      by: order.employeeName || 'موظف',
      note: 'تم إنشاء الطلب',
    }]
    if (order.status && order.status !== 'new') {
      const statusObj = ORDER_STATUSES.find((s: any) => s.id === order.status)
      history.push({
        type: order.status === 'cancelled' ? 'cancelled' : 'status',
        status: order.status,
        at: order.updatedAt || order.createdAt,
        by: order.employeeName || 'موظف',
        note: `الحالة الحالية: ${statusObj ? statusObj.name : order.status}`,
      })
    }
  }
  return [...history].sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

// ==========================================
// COMPLAINT MODAL (نقلاً عن showComplaintModal / submitComplaint)
// ==========================================
export function openComplaintModal(orderId: number) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return
  state.complaintModalOrderId = orderId
}
export function closeComplaintModal() { state.complaintModalOrderId = null }

/** كود اتصال دولة الشركة الحالية — يُسبق به كل رقم يُرسَل. */
export function companyDial(): string {
  return String(currentCompany()?.dialCode || '')
}

export function canViewComplaints(): boolean {
  return !state.live || (currentCompany()?.permissions || []).includes('complaints.view')
}
export function canManageComplaints(): boolean {
  return !state.live || (currentCompany()?.permissions || []).includes('complaints.manage')
}

/** إرسال الشكوى للكلاود (وضع live) — تُنسب للوكيل وتظهر لموظف الشركة في الداشبورد. */
async function submitComplaintLive(orderId: number, text: string, category: string) {
  const order = state.orders.find((o: any) => o.id === orderId)
  try {
    await contactCreateComplaint({
      onlineOrderId: orderId,
      branchId: order?.branchId ?? null,
      category: category || 'other',
      description: text,
    })
    state.complaintsByOrder[orderId] = (state.complaintsByOrder[orderId] || 0) + 1
    if (order) order.hasComplaint = true
    showToast('تم تسجيل الشكوى بنجاح', 'success')
    closeComplaintModal()
  } catch (err: any) {
    showToast(err?.response?.data?.message || 'تعذّر تسجيل الشكوى', 'error')
  }
}

export function submitComplaint(orderId: number, text: string, category: string = 'other') {
  const t = (text || '').trim()
  if (!t) {
    showToast('الرجاء كتابة تفاصيل الشكوى', 'warning')
    return
  }
  if (state.live) {
    if (!canManageComplaints()) { showToast('لا تملك صلاحية تقديم الشكاوى', 'warning'); return }
    void submitComplaintLive(orderId, t, category)
    return
  }
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return

  order.hasComplaint = true
  order.complaintText = t
  order.notes = (order.notes ? order.notes + '\n\n' : '') + 'شكوى: ' + t

  order.statusHistory = order.statusHistory || []
  order.statusHistory.push({
    type: 'complaint',
    status: order.status,
    at: new Date().toISOString(),
    by: state.currentUser ? state.currentUser.name : 'موظف',
    note: 'تم تقديم شكوى: ' + t,
  })

  showToast('تم تسجيل الشكوى بنجاح', 'success')
  closeComplaintModal()
}
