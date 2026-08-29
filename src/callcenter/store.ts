import { reactive } from 'vue'
import {
  SAMPLE_CUSTOMERS, SAMPLE_ORDERS, MENU_CATEGORIES, MENU_ITEMS, BRANCHES, EMPLOYEES, DRIVERS, SYSTEM_SETTINGS,
  ORDER_STATUSES, PAYMENT_CHANNELS, PAYMENT_METHODS, CANCELLATION_REASONS, COMPLAINT_CATEGORIES,
} from './data'
import { todayISO, toCompanyWall, fromCompanyWall, companyToday, formatBusinessDate } from './utils'
import { tx, nameOf } from './lang'
import {
  session, currentCompany, contactBranches, contactRegions, contactProducts, contactCustomers, contactCreateOrder, contactSaveCustomer,
  contactBranchDays, contactBusinessDay, contactOpenDay, contactCloseDay, contactFixDay, contactOrders, contactStoppedItems,
  contactComplaints, contactCreateComplaint, contactCcStoppedItems, contactSetCcStopped, contactOrder,
  contactPaymentMethods, contactOrderTypes, contactOrderPolicy, contactUpdateOrder,
  contactCancelOrder, contactDeleteAddress, contactComplaint, contactComplaintUpdate, phoneE164,
} from '../api'
import type { ContactOrderInput } from '../api'

// ── حالة تطبيق مركز الاتصال (نفس AppState الأصلي، reactive بدل كائن عادي) ──
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
  // سياسة الشركة: هل طريقة الدفع إلزاميّة قبل نزول الطلب للفرع؟ الافتراضي **لا**
  // (تُقرأ من الخادم؛ فشلُ القراءة يبقى على الاختياريّ فلا يُقفَل الطلب بخطأ شبكة).
  paymentRequired: false,
  paymentModalOpen: false,     // مودال اختيار الدفع
  orderType: 'delivery',
  editingOrderId: null,
  cartTotal: 0,
  cartSubtotal: 0,
  deliveryFee: 0.5,
  selectedAddressIndex: -1,
  orderNotes: '',
  // رقم الطلب على المنصّة الخارجية — يكتبه الوكيل حين يأتي الطلب من طلبات/جاهز…
  // مستقلٌّ عن الملاحظات: يُبحَث به، ويظهر في الفرع خانةً واضحة لا سطراً مدفوناً.
  orderTag: '',

  // ── حجز (طلب مجدول) — ينزل الفرع في «قائمة الحجوزات» بموعده ──
  isReservation: false,        // تفعيل الحجز على الطلب الحالي
  reservationTime: '',         // datetime-local (YYYY-MM-DDTHH:mm)
  prepLeadMinutes: '',         // زمن التحضير قبل الموعد (فارغ = افتراضي الفرع)

  // طرق الدفع وأنواع الطلب **من الشركة** (فارغة = ارتدادٌ لقوائم data.ts)
  companyPaymentMethods: [],
  companyOrderTypes: [],
  // نوع الطلب المختار من أنواع الشركة (كائن) — `orderType` أدناه يبقى للشكل البنيوي
  selectedOrderType: null,

  // مجموعات البيانات (من data.ts)
  customers: [],
  orders: [],
  menuCategories: [],
  activeSubCategory: '',        // الفئة الفرعية المختارة ('' = كل أصناف الرئيسية)
  menuItems: [],
  branches: [],
  employees: [],
  drivers: [],
  // أصناف يوقفها مركز الاتصال لنفسه { branchId: itemId[] } — من الكلاود في الوضع
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
  noteItemId: null as string | null,   // سطر السلّة الذي تُحرَّر ملاحظته
  // صندوق التأكيد (بديل `confirm()` المتصفّح) — انظر `askConfirm`
  confirmBox: { open: false, title: '', body: '', okLabel: '', altLabel: '', cancelLabel: '', kind: 'danger' as 'danger' | 'warning' },
  // شاشة فتح يوم العمل — التاريخ يختاره الوكيل وأمامه أيام فروعه
  dayModal: { open: false, date: '', branches: [] as any[], loading: false, error: '', mode: 'normal' as 'normal' | 'fix' },
  noteItemText: '',
  itemModalOpenPrice: '',      // سعر الوحدة للصنف مفتوح السعر (نصّ ليقبل الحقل الفراغ)
  posStoppedItems: {},         // أصناف موقوفة من مطبخ الـPOS { branchId: itemId[] } (تُدفع من الكلاود)

  // ── حقول واجهة الطلب الجديد (كانت DOM inputs في النسخة الأصلية) ──
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

  // فلاتر شاشة «الطلبات المجدولة» — الشاشة كانت بلا فلترٍ إطلاقاً: قائمةٌ تطول
  // بلا حدٍّ ولا سبيل للوصول إلى حجزٍ بعينه إلا بالعين.
  schedFilterInvoice: '',
  schedFilterPhone: '',
  schedFilterBranch: '',
  schedFilterType: '',

  // فلاتر شاشة «جميع طلبات التوصيل» (view-orders)
  // خانةٌ لكل عمودٍ في صفّ فلترة الجدول — الشريط المنفصل فوقه كان يفلتر أربعة
  // أعمدةٍ من اثني عشر، والوكيل يبحث عن السائق أو الموظّف بالعين.
  allFilterDaily: '',
  allFilterInvoice: '',
  allFilterPhone: '',
  allFilterEmployee: '',
  allFilterType: '',
  allFilterTag: '',
  allFilterStatus: '',
  allFilterBranch: '',
  allFilterDriver: '',

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
  // ── مودالات شاشة الطلب الجديد ──
  notesModalOpen: false,       // ملاحظات الطلب
  historyModalOpen: false,     // سجل طلبات العميل
  historyOrders: [],           // نتائج السجل (من الخادم بالهاتف)
  historyLoading: false,
  reviewModalOpen: false,      // مراجعة الطلب قبل التأكيد
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
  live: false,                 // true = بيانات حقيقية من الخادم؛ false = مووك
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
    // طرق الدفع وأنواع الطلب من الشركة — فشلُها لا يُسقط الشاشة: نرتدّ لقوائم data.ts
    const [branches, regions, products, payMethods, orderTypes, policy] = await Promise.all([
      contactBranches(), contactRegions(), contactProducts(),
      contactPaymentMethods().catch(() => []),
      contactOrderTypes().catch(() => []),
      contactOrderPolicy().catch(() => ({ paymentRequired: false })),
    ])
    state.companyPaymentMethods = Array.isArray(payMethods) ? payMethods : []
    state.paymentRequired = !!(policy as any)?.paymentRequired
    state.companyOrderTypes = Array.isArray(orderTypes) ? orderTypes : []
    // نوعٌ مختار افتراضاً: أوّل نوعٍ يوافق الشكل البنيويّ الحالي (توصيل/استلام)
    syncSelectedOrderType()

    // الفروع: {id,name} — نضيف areas:[] حتى لا تنكسر مساعدات branchByArea.
    // ونحمل معها **جاهزيّة الفرع** كما حسبها الخادم (متصل/يوم عمله/هل يستقبل الآن):
    // بدونها يَعِد الوكيل العميلَ بنصف ساعة وطلبُه واقفٌ في الكلاود لا يعلم به أحد.
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
          name: p.categoryId != null ? (p.categoryNameAr || p.categoryNameEn || tx('تصنيف', 'Category')) : tx('غير مصنّف', 'Uncategorised'),
          nameEn: p.categoryNameEn || p.categoryNameAr || '',
          icon: '', color: '#6b7280', imageUrl: '',
          sort: p.categoryId != null ? p.categorySort : 9999,
        })
      }
    })
    const cats = Array.from(catMap.values()).sort((a: any, b: any) => a.sort - b.sort)
    // «عرض الكل» أوّل البطاقات لا آخرها: هي مدخل الوكيل حين لا يعرف قسم الصنف،
    // وكانت تقع خلف سبع بطاقاتٍ في آخر الصفّ.
    cats.unshift({ id: 'all', name: 'عرض الكل', nameEn: 'View All', icon: '', color: '#6b7280', imageUrl: '' })
    state.menuCategories = cats

    // المنتجات → شكل صنف الواجهة: بدون صور، مع الأحجام (variants) والإضافات (modifiers)
    state.menuItems = products.map((p: any) => ({
      id: p.id,
      categoryId: p.categoryId != null ? String(p.categoryId) : 'uncat',
      // الفئة الفرعية — بها يُبنى المستوى الثاني في المنيو
      subCategoryId: p.subCategoryId != null ? String(p.subCategoryId) : null,
      subCategoryName: p.subCategoryNameAr || p.subCategoryNameEn || '',
      subCategoryNameEn: p.subCategoryNameEn || p.subCategoryNameAr || '',
      subCategorySort: p.subCategorySort ?? 999,
      name: p.nameAr,
      nameEn: p.nameEn || '',
      price: p.price,
      description: '',
      // أحجام: لو فيها variants → مصفوفة الأسماء/الأسعار، وإلا null (صنف بسعر واحد)
      sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes : null,
      sizePrices: Array.isArray(p.sizePrices) && p.sizePrices.length ? p.sizePrices : null,
      // الأحجام كاملةً (id + الاسمان + السعر) — `sizes` أعلاه أسماءٌ عربية للتوافق
      variants: Array.isArray(p.variants) ? p.variants : [],
      // إضافات لكل صنف: [{ id, name, price }]
      extras: Array.isArray(p.extras) ? p.extras : [],
      // مجموعات الإضافات بقواعدها (مطلوب / أدنى / أقصى) — مصدر مودال الصنف
      modifierGroups: Array.isArray(p.modifierGroups) ? p.modifierGroups : [],
      imageUrl: '',
      isAvailable: p.isAvailable,
      // صنف بسعر مفتوح: لا سعر ثابت — الوكيل يُدخل سعر الوحدة في مودال الصنف
      isOpenPrice: !!p.isOpenPrice,
    }))

    state.availBranchId = state.branches[0] ? String(state.branches[0].id) : ''
    state.live = true
    void loadOrders()          // طلبات الشركة الحقيقية بدل المووك
    void loadStoppedItems()    // أصناف مطبخ الـPOS الموقوفة (لمنع ضربها)
    void loadCcStoppedItems()  // وأصناف أوقفها مركز الاتصال لنفسه (مشتركة بين الوكلاء)
  } catch {
    // فشل التحميل → نبقى على المووك بدون كسر الشاشة
    showToast(tx('تعذّر تحميل بيانات الشركة — سيتم استخدام بيانات تجريبية', 'Could not load company data — demo data will be used'), 'warning')
  }
}

/**
 * يوم **الفرع** تغيّر (فتح/إقفال على الـPOS) — يصل لحظياً عبر البثّ.
 *
 * يومُ الفرع شرطُ نزول الطلب، فتأخّرُ خبره يعني وكيلاً يَعِد العميل وطلبه واقف —
 * أو يظنّه واقفاً وقد نزل. نعيد حساب جاهزيّة الفروع فوراً بدل انتظار الدورة.
 */
export function applyBranchDay(branchId: number, businessDate: string | null) {
  const b = state.branches.find((x: any) => Number(x.id) === Number(branchId))
  if (!b) return
  b.posBusinessDate = businessDate
  b.dayKnown = businessDate !== null
  // الجاهزيّة تُحتسب في الخادم؛ نعيد الجلب لنأخذ السبب والرسالة كما يصوغهما هو
  void loadLiveData()
}

/**
 * يوم **مركز الاتصال** تغيّر — وكيلٌ آخر فتحه أو أنهاه.
 *
 * كان الباقون يرون اليوم القديم ويَعِدون عليه حتى يُحدّثوا الصفحة. النطاق يُفحَص:
 * فرنشايزٌ آخر لا يخصّنا.
 */
export function applyCcDay(e: { franchiseId?: number; businessDate?: string | null; status?: string; mode?: string }) {
  const mine = Number(e?.franchiseId ?? 0) === Number(session.franchiseId ?? 0)
  if (!mine) return
  if (e.status === 'open') {
    state.onlineDay = { businessDate: e.businessDate, status: 'open', mode: e.mode ?? 'normal' } as any
    if (e.businessDate) state.businessDate = String(e.businessDate).slice(0, 10)
  } else {
    // أُقفل: الخادم يفتح التالي فوراً ويبثّه، فلا نصفّر هنا كيلا تومض الشاشة «مقفول»
    // بين الحدثين. إعادةُ الجلب تحسم الحالة النهائية.
    void loadBusinessDay()
  }
  void loadLiveData()   // جاهزيّة الفروع تُحتسب مقابل اليوم الجديد
}

// ── يوم عمل مركز الاتصال (لازم يكون مفتوح لضرب طلب) ──
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
// ── فتح يوم العمل: التاريخ قرارُ الوكيل ──────────────────────────────────────
// كان الزرّ يفتح فوراً بتاريخٍ **يشتقّه الخادم من أيام الفروع**. فإن كان ذلك التاريخ
// قد فُتح وأُقفل من قبل، جاء الرفض «هذا اليوم مُغلق بالفعل» بلا مخرج — إلا أن يُقفَل
// يومُ فرعٍ ليتحرّك المشتقّ. وهو ربطٌ لا معنى له: النطاق فرنشايز لا فرع.
//
// صار الوكيل يختار التاريخ، **وأمامه أيام فروعه**: التطابق شرطُ نزول الطلب، فاختيارٌ
// على غير هدىً يعني طلباتٍ تقف. الشرط نفسه لم يتغيّر.
export async function openDayModal(mode: 'normal' | 'fix' = 'normal') {
  state.dayModal = { open: true, date: companyToday(), branches: [], loading: true, error: '', mode }
  try {
    state.dayModal.branches = await contactBranchDays()
  } catch { /* تعذّرت القائمة — الاختيار يبقى ممكناً بلا إرشاد */ }
  finally { state.dayModal.loading = false }
}

export function closeDayModal() { state.dayModal = { ...state.dayModal, open: false } }

/** أكثر أيام الفروع شيوعاً — اقتراحٌ بنقرة، لا فرضاً. */
export function suggestedDay(): string | null {
  const days = (state.dayModal.branches || []).map((b: any) => b.businessDate).filter(Boolean)
  if (!days.length) return null
  const tally = new Map<string, number>()
  for (const d of days) tally.set(d, (tally.get(d) ?? 0) + 1)
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0]
}

export async function confirmOpenDay() {
  const date = String(state.dayModal.date || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { state.dayModal.error = tx('اختر تاريخاً صحيحاً', 'Choose a valid date'); return }
  state.dayModal.error = ''
  state.dayLoading = true
  try {
    const day = state.dayModal.mode === 'fix' ? await contactFixDay(date) : await contactOpenDay(date)
    state.onlineDay = day || null
    if (day?.businessDate) state.businessDate = String(day.businessDate).slice(0, 10)
    const wasFix = state.dayModal.mode === 'fix'
    state.dayModal = { ...state.dayModal, open: false }
    showToast(wasFix
      ? tx('تم فتح اليوم للإصلاح — لا تُضرَب عليه طلبات', 'Day opened for fixing — no orders can be placed on it')
      : tx('تم فتح يوم العمل — تقدر تضرب طلب دلوقتي', 'Business day opened — you can place orders now'), 'success')
    void loadLiveData()   // أيام الفروع وحالة جاهزيتها تُحتسب مقابل اليوم الجديد
  } catch (err: any) {
    // رسالة الخادم هي الأدقّ (تاريخٌ سبق قفلُه، أو بلا صلاحية) — تُعرض في المودال
    state.dayModal.error = err?.response?.data?.message
      || tx('تعذّر فتح يوم العمل', 'Could not open the business day')
  } finally { state.dayLoading = false }
}

export async function openBusinessDay() {
  if (!(session.mode === 'agent' && session.companyId)) return
  state.dayLoading = true
  try {
    const day = await contactOpenDay()
    state.onlineDay = day || null
    if (day?.businessDate) state.businessDate = String(day.businessDate).slice(0, 10)
    showToast(tx('تم فتح يوم العمل — تقدر تضرب طلب دلوقتي', 'Business day opened — you can place orders now'), 'success')
  } catch (err: any) {
    showToast(err?.response?.data?.message || tx('تعذّر فتح يوم العمل (تحتاج صلاحية فتح اليوم)', 'Could not open the business day (you need the open-day permission)'), 'error')
  } finally { state.dayLoading = false }
}

/**
 * إنهاء يوم مركز الاتصال.
 *
 * الخادم يرفض القفل وفي اليوم طلبٌ لسه واقف — والرفض يُعرَض كما جاء لأنه يحمل
 * **العدد**: «فيه ٢ طلب لسه واقف» يقول للوكيل ما يفعله، بخلاف «تعذّر القفل».
 *
 * وبعد القفل يبقى النطاق بلا يوم مفتوح ⇒ تظهر «افتح اليوم» (بصلاحيتها هي). ولا
 * نفتح تلقائياً هنا: القفلُ فعلٌ والفتحُ فعلٌ آخر بمفتاحٍ آخر، ودمجُهما يفتح يوماً
 * لمن يملك القفل وحده.
 */
export async function closeBusinessDay() {
  if (!(session.mode === 'agent' && session.companyId)) return
  // القفل يفتح التالي فوراً (كما في الفرع) — فلا وعدَ بانقطاعٍ لا يحدث
  const cur = (state.onlineDay as any)?.businessDate
  if (!(await askConfirm({
    title: tx('إنهاء يوم العمل؟', 'End the business day?'),
    body: cur
      ? tx(`يُقفَل يوم ${formatBusinessDate(String(cur).slice(0, 10))} ويُفتَح اليوم التالي فوراً.`,
           `Day ${formatBusinessDate(String(cur).slice(0, 10))} will be closed and the next day opened right away.`)
      : tx('يُقفَل اليوم الحالي ويُفتَح التالي فوراً.', 'The current day is closed and the next opened right away.'),
    okLabel: tx('إنهاء اليوم', 'End the day'), kind: 'warning',
  }))) return
  state.dayLoading = true
  try {
    // الردّ هو **اليوم الجديد المفتوح** لا فراغاً: النطاق لا يبقى بلا يومٍ مفتوح
    const day = await contactCloseDay()
    state.onlineDay = day || null
    if (day?.businessDate) state.businessDate = String(day.businessDate).slice(0, 10)
    showToast(day?.businessDate
      ? tx(`تم إنهاء اليوم — وفُتح يوم ${formatBusinessDate(String(day.businessDate).slice(0, 10))}`,
           `Day ended — ${formatBusinessDate(String(day.businessDate).slice(0, 10))} is now open`)
      : tx('تم إنهاء يوم العمل', 'Business day ended'), 'success')
    void loadLiveData()   // جاهزية الفروع تُحتسب مقابل اليوم الجديد
  } catch (err: any) {
    // رسالة الخادم تحمل سبب المنع وعدد الطلبات الواقفة — تُعرَض كما هي
    showToast(err?.response?.data?.message || tx('تعذّر إنهاء اليوم', 'Could not end the day'), 'error')
  } finally { state.dayLoading = false }
}

// ── طلبات الكلاود → شكل جدول مركز الاتصال (لشاشات التوصيل/المجدولة) ──
// تحويل حالة الـPOS (new/received/preparing/ready/delivered/closed/cancelled/modified)
// + حالة السائق (on_way) → حالة عرض مركز الاتصال (تفادي «غير معروف»)
/**
 * حالة العرض = حالة الفرع نفسها، لا تفسيرٌ لها.
 *
 * **القفل يتقدّم على راية السائق** — وكان العكس، فالقصّة كاملةً هنا كي لا تُعكَس مرّتين:
 *
 * راية السائق (`driver_status`) تتقدّم ولا تُصفَّر: `assigned` عند الإسناد، ثم `on_way`
 * عند الانطلاق، ولا يكتب فيها أحدٌ `delivered` إطلاقاً — الفرع يقرأ حالة **الطلب** لا
 * الراية. فلمّا قُدّمت الراية بقي الطلب المقفول «في الطريق» إلى الأبد (٣٣ طلباً في
 * قاعدة فرعٍ واحد، وصفر صفٍّ فيه `delivered`).
 *
 * وسببُ تقديمها أوّل مرّة أن الكاشير قد يقفل ماليّاً وهو يسلّم للسائق، فتُقرأ الحالة
 * «تم التسليم» والسائق لم يخرج بعد. **وذلك السبب سقط بتغيير التسمية**: `delivered`
 * تُعرَض الآن «مغلق / Closed» — وصفٌ ماليٌّ لما فعله الفرع، لا وعدٌ للعميل بأن الطلب
 * وصله. وهي نفسها تسمية شاشة الفرع للحظة ذاتها، فلا تفترق الشاشتان.
 */
function mapPosStatus(s: string, driverStatus?: string): string {
  if (s === 'cancelled') return 'cancelled'
  // **القفل نهاية المطاف** — يسبق راية السائق ولا تسبقه.
  //
  // حالة السائق في الفرع رايةٌ تتقدّم ولا تُصفَّر: تصير `on_way` حين ينطلق، ولا يكتب
  // فيها أحدٌ `delivered` أبداً — لأن الفرع يقرأ حالة **الطلب** لا رايةَ السائق، فيخرج
  // الطلب من «مع السائق» بالقفل. فلمّا قُدّمت الرايةُ هنا على القفل بقي الطلب المقفول
  // «في الطريق» إلى الأبد عند الوكيل، وهو مدفوعٌ ومنتهٍ منذ ساعات.
  if (s === 'closed') return 'delivered'
  // ودون القفل: السائق هو الحقيقة ما دام له سطر — به وحده يُفرَّق «مع السائق» عن «في
  // الطريق»، فحالة الطلب في الفرع تبقى 'delivered' في الحالتين.
  if (driverStatus === 'delivered') return 'delivered'
  if (driverStatus === 'on_way') return 'onway'
  if (driverStatus === 'assigned') return 'withdriver'
  // بلا سطر سائق (استلام/تيك أواي، أو سلّمه الكاشير بيده): حالة الفرع كما هي.
  // ('closed' لم يعد يُذكَر هنا — أُخذ في الأعلى قبل راية السائق.)
  if (s === 'delivered') return 'delivered'
  switch (s) {
    case 'new': case 'preparing': case 'ready': return s
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

  push('created', r.createdAt, r.agentName || tx('مركز الاتصال', 'Call center'), tx('إنشاء الطلب من مركز الاتصال', 'Order created from the call center'))

  // نزول الفرع: لا توقيت مستقلّ له في الحمولة — نذكره بلا وقت مضلِّل حين يتأكّد
  if (r.posOrderId) {
    out.push({ type: 'branch', status: 'branch', at: r.posStatusAt || null, by: tx('الفرع', 'Branch'),
      note: tx(`نزل الفرع — رقم الطلب هناك #${r.posOrderId}`, `Reached the branch — order no. there #${r.posOrderId}`) })
  } else if (r.holdReason === 'no_branch') {
    out.push({ type: 'held', status: 'held', at: null, by: '—', note: tx('محتجَز: لا فرع يخدم المنطقة — يحتاج تعييناً يدوياً', 'On hold: no branch serves this area — needs manual assignment') })
  }

  // حالة الفرع الأخيرة (المرآة التي يرفعها الكونكتور)
  if (r.posStatus && r.posStatusAt) {
    push('status', r.posStatusAt, tx('الفرع', 'Branch'), tx(`حالة الفرع: ${statusLabel}`, `Branch status: ${statusLabel}`))
  }

  // السائق — يعيّنه الفرع، ومركز الاتصال يعرضه فقط
  if (r.driverName) {
    const dl = r.driverStatus === 'on_way' ? tx('خرج للتوصيل', 'Out for delivery')
      : r.driverStatus === 'delivered' ? tx('سلّم الطلب', 'Delivered the order')
      : r.driverStatus === 'assigned' ? tx('تم تحميله', 'Picked up') : (r.driverStatus || '')
    push('driver', r.driverAt, tx('الفرع', 'Branch'), tx(`السائق: ${r.driverName}${dl ? ' — ' + dl : ''}`, `Driver: ${r.driverName}${dl ? ' — ' + dl : ''}`))
  }

  push('delivered', r.deliveredAt, tx('الفرع', 'Branch'), tx('تم تسليم الطلب للعميل', 'Order delivered to the customer'))

  if (r.status === 'cancelled' || r.posStatus === 'cancelled') {
    out.push({ type: 'cancelled', status: 'cancelled', at: r.posStatusAt || null,
      by: r.posStatus === 'cancelled' ? 'الفرع' : 'مركز الاتصال', note: tx('تم إلغاء الطلب', 'Order cancelled') })
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
    // تفصيل الدفع كما أُقفل في الفرع (قد يكون أكثر من سطر ومعه إكراميّة).
    // فارغٌ = لم يُقفَل بعد — ولا نخترع له طريقة.
    posPayments: Array.isArray(r.posPayments) ? r.posPayments : null,
    // طلب إلغاءٍ عند الفرع لم يردّ عليه بعد
    cancelRequested: !!r.cancelRequested,
    type, status,
    customerName: r.customerName, customerPhone: r.customerPhone,
    branchId: r.branchId,
    // الاسمان معاً: الوصف يتبع لغة الواجهة لا لغةَ لحظة الجلب
    branchName: nameOf({ nameAr: r.branchName, nameEn: r.branchNameEn })
      || (r.holdReason === 'no_branch' ? tx('بانتظار تعيين فرع', 'Awaiting branch assignment') : '—'),
    subtotal: Number(r.subtotal) || 0, deliveryFee: Number(r.deliveryFee) || 0, total: Number(r.total) || 0,
    driverId: r.driverName ? -1 : null, driverName: r.driverName || null, driverPhone: '',
    // حجز: موعده يظهر في شاشة «الطلبات المجدولة»
    hasComplaint: !!state.complaintsByOrder[r.id], scheduledDate: r.reservationTime || null,
    // سجلّ العمليات من الخادم — يُعاد بناؤه مع كل تحديث لحظي فيبقى مطابقاً للواقع
    statusHistory: buildTimeline(r, nameOf(ORDER_STATUSES.find((x: any) => x.id === status)) || status),
    prepLeadMinutes: r.prepLeadMinutes ?? null,
    posReservationId: r.posReservationId ?? null,
    businessDate: r.businessDate ? String(r.businessDate).slice(0, 10) : null,
    createdAt: r.createdAt,
    orderTag: r.orderTag || null,
    notes: r.notes || null,
    region: r.regionName, address: r.addressText,
    // البنود تُجلب عند فتح التفاصيل (القائمة لا تحملها) — `itemsLoaded` تمنع التكرار
    items: [], itemsLoaded: false,
  }
}

// تحميل طلبات الشركة من الكلاود إلى state.orders (وضع live)
export async function loadOrders() {
  if (!(session.mode === 'agent' && session.companyId)) return
  // الشكاوى قبل التحويل: `mapCloudOrder` يقرأ `complaintsByOrder` ليضع علم الشكوى
  await loadComplaints()
  try {
    const rows = await contactOrders()
    state.orders = Array.isArray(rows) ? rows.map(mapCloudOrder) : []
  } catch { /* نُبقي الحالي */ }
}

/** شكاوى الشركة → خريطة (طلب → عدد). صامتة عند نقص صلاحية `complaints.view`. */
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
  { id: 'open',        label: 'مفتوحة',      labelEn: 'Open',        color: '#dc2626' },
  { id: 'in_progress', label: 'قيد المعالجة', labelEn: 'In progress', color: '#d97706' },
  { id: 'resolved',    label: 'تم حلّها',     labelEn: 'Resolved',    color: '#16a34a' },
  { id: 'closed',      label: 'مغلقة',       labelEn: 'Closed',      color: '#64748b' },
]
export function complaintStatusLabel(id: string): string {
  return COMPLAINT_STATUSES.find((s) => s.id === id)?.label || id
}
export function complaintStatusColor(id: string): string {
  return COMPLAINT_STATUSES.find((s) => s.id === id)?.color || '#64748b'
}
export function complaintCategoryLabel(id: string): string {
  return nameOf(COMPLAINT_CATEGORIES.find((c: any) => c.id === id)) || id
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
    showToast(tx('تعذّر تحميل الشكاوى', 'Could not load complaints'), 'error')
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
    showToast(tx('تعذّر تحميل تفاصيل الشكوى', 'Could not load the complaint details'), 'error')
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
  if (!canManageComplaints()) { showToast(tx('لا تملك صلاحية متابعة الشكاوى', 'You do not have permission to follow up on complaints'), 'warning'); return }
  const n = (note || '').trim()
  const changed = status && status !== state.openComplaint?.status ? status : ''
  if (!n && !changed) { showToast(tx('اكتب ملاحظة أو غيّر الحالة', 'Write a note or change the status'), 'warning'); return }
  state.complaintBusy = true
  try {
    const body: any = {}
    if (n) body.note = n
    if (changed) body.status = changed
    state.openComplaint = await contactComplaintUpdate(id, body)
    showToast(tx('تم تسجيل المتابعة', 'Follow-up recorded'), 'success')
    await loadComplaintsList()
  } catch (err: any) {
    showToast(err?.response?.data?.message || tx('تعذّر تسجيل المتابعة', 'Could not record the follow-up'), 'error')
  } finally {
    state.complaintBusy = false
  }
}

/**
 * دمج صفوف وصلت داخل حدث SSE في القائمة الحالية — بلا أي طلب شبكة.
 *
 * لماذا: كان الحدث يصل فارغاً فيعيد **كل** وكيل جلب القائمة كاملة عند كل تغيّر
 * (يحدّه الـdebounce عند ~٢٫٥ طلب/ث لكل وكيل ⇒ ٢٥٠ طلب/ث عند ١٠٠ وكيل).
 * أغلب الأحداث تحديثُ حالةٍ لطلب معروض بالفعل، فدمجه في مكانه يُلغي الطلب تماماً.
 *
 * نُحدِّث الموجود فقط. الطلب الجديد (غير الموجود في القائمة) نتركه لإعادة الجلب،
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
 * قائمة إيقاف مركز الاتصال من الكلاود (مشتركة بين الوكلاء).
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
export function showToast(msg: string, type: string = 'info', ms = 5000, center?: boolean) {
  console.log(`[toast:${type}]`, msg)
  if (!Array.isArray(state.toasts)) state.toasts = []
  const id = ++toastSeq
  // مكان الظهور: ما يوقف الوكيل (تحذير/خطأ — خانة ناقصة، اختيار مطلوب، رفض من الخادم)
  // يظهر وسط الشاشة فلا يضيع في ركنٍ خلف عتمة المودال؛ والنجاح/المعلومة تبقى في الركن
  // فلا تحجب ما يعمل عليه. و`center` يكسر القاعدة لحالةٍ بعينها عند الحاجة.
  const atCenter = center === undefined ? (type === 'warning' || type === 'error') : !!center
  state.toasts.push({ id, msg, type, center: atCenter })
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
 * الوكيل حين يعود فرعٌ كان طلبه واقفاً عليه: طلبه نزل المطبخ الآن، وكان سيظلّ
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
  else if (!online && b.ready) { b.hold = 'offline'; b.ready = false; b.holdMessage = tx('الفرع غير متصل الآن — الطلب محفوظ وسينزل تلقائياً أول ما يرجع الاتصال.', 'The branch is offline right now — the order is saved and will go through automatically when it reconnects.') }
  if (was === online) return                       // لا تغيّر فعلي ⇒ لا إزعاج
  if (!online) return                              // الانقطاع يظهر في الشريط بلا إشعار
  // كم طلب كان واقفاً على هذا الفرع؟ («sent» = لم يصل الفرع بعد)
  const waiting = (state.orders || []).filter((o: any) => o.branchId === branchId && o.status === 'sent').length
  showToast(
    waiting > 0
      ? tx(`${b.name} رجع متّصلاً — ${waiting} طلب واقف هينزل عليه دلوقتي`, `${b.name} is back online — ${waiting} held order(s) will go through now`)
      : tx(`${b.name} رجع متّصلاً`, `${b.name} is back online`),
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
 * جاهزيّة الفرع الذي سيذهب إليه الطلب الحالي.
 *
 * الطلب لا يُدفع للفرع؛ الفرع يسحبه بنفسه حين يكون متصلاً وعلى نفس يوم العمل. فإن لم
 * يكن كذلك يقف الطلب في الكلاود **صامتاً** — لا يضيع، لكن لا أحد في المطبخ يراه. هذه
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
    // المرجع يحمل الاسمين (`name` عربيّ و`nameEn`) — فيتبع العرض لغة الواجهة
    if (area) parts.push(nameOf(area))
    if (sec) parts.push(nameOf(sec))
  }
  if (f.area) parts.push(f.area)
  if (f.block) parts.push(tx(`ق ${f.block}`, `Block ${f.block}`))
  if (f.street) parts.push(tx(`ش ${f.street}`, `St. ${f.street}`))
  if (f.building) parts.push(tx(`مبنى ${f.building}`, `Bldg ${f.building}`))
  if (f.floor) parts.push(tx(`ط ${f.floor}`, `Floor ${f.floor}`))
  if (f.apartment) parts.push(tx(`شقة ${f.apartment}`, `Apt ${f.apartment}`))
  return parts.length > 0 ? parts.join(tx('، ', ', ')) : '-'
}

export function onAreaChange() {
  const b = branchByArea(state.form.area)
  if (b) showToast(tx(`تم تحديد ${b.name} تلقائياً بناءً على المنطقة`, `${b.name} was selected automatically based on the area`), 'info')
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
    if (b) showToast(tx(`تم تحويل الطلب إلى ${b.name}`, `Order moved to ${b.name}`), 'success')
  }
  state.branchMenuOpen = false
}

export function resetBranchOverride() {
  state.branchOverrideId = null
  state.branchMenuOpen = false
  showToast(tx('تم الرجوع للفرع التلقائي', 'Back to the automatic branch'), 'info')
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
/**
 * قيمةُ حقلِ عنوانٍ محفوظ — والسلاسل `"null"`/`"undefined"` فراغ.
 *
 * عناوينُ قديمة خُزّنت بنصّ «null» حرفيّاً. قراءتُها كما هي تجعل الواجهة تبحث عن
 * مدينةٍ اسمها «null» فلا تجدها ⇒ لا مدينة ⇒ **لا فرع** في رأس الشاشة. تنظيفُ
 * الكتابة يمنع الجديد، وهذا يُنقذ ما هو مخزَّنٌ فعلاً.
 */
function addrText(v: any): string {
  const t = String(v ?? '').trim()
  return !t || t === 'null' || t === 'undefined' ? '' : t
}

function applyLiveAddress(addr: any) {
  state.form.addressText = addrText(addr?.address)
  // العنوان المركّب المحفوظ (قطعة/شارع/مبنى/دور/شقة)
  state.form.block = addrText(addr?.block)
  state.form.street = addrText(addr?.street)
  state.form.building = addrText(addr?.building)
  state.form.floor = addrText(addr?.floor)
  state.form.apartment = addrText(addr?.apartment)
  // العنوان محفوظ بالأسماء لا بالمعرّفات (لقطة وقت الطلب) — نطابقها لاستعادة الاختيار
  const rName = addrText(addr?.region)
  const r = rName ? state.regions.find((x: any) => x.name === rName) : null
  state.form.regionId = r ? r.id : null
  const sName = addrText(addr?.section)
  const sec = r && sName ? (r.sections || []).find((x: any) => x.name === sName) : null
  state.form.sectionId = sec ? sec.id : null
  applyPlace()
}
/**
 * العميل جاهز ⇒ افتح المنيو من رأسه.
 *
 * تُستدعى بعد **الحفظ** وحده: حينها يكون العنوان مؤكَّداً. أمّا عميلٌ وُجد بالبحث
 * فيبقى على تبويب بياناته ليختار عنواناً آخر أو يضيف جديداً — القفزُ للأصناف
 * حينها يُرسل الطلب لعنوان المرّة الماضية.
 */
function goToMenu() {
  state.activeTab = 'menu'
  showAllCategories()
}

function loadLiveCustomer(c: any) {
  // عميلٌ آخر = مكالمةٌ أخرى (نفس قاعدة `loadCustomerData`): بحثٌ عن عميلٍ جديد
  // كان يُبقي سلّة السابق ورقمَ منصّته ودفعه في هذا المسار وحده.
  const prev = state.currentCustomer
  const changed = !prev
    || (c?.id != null && prev.id != null && String(prev.id) !== String(c.id))
    || String(prev.phone || '') !== String(c?.phone || '')
  if (changed) resetDraftForNewCustomer()
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

/**
 * هل في الشاشة مسوّدة طلبٍ قائمة يُفقَد شيءٌ بتصفيرها؟
 * (سلّة، أو عميل، أو رقم يُبحث به، أو ملاحظات، أو رقم منصّة)
 */
export function hasOrderDraft(): boolean {
  return !!(
    (state.cart && state.cart.length) ||
    state.currentCustomer ||
    String(state.form?.phone || '').trim() ||
    String(state.orderNotes || '').trim() ||
    String(state.orderTag || '').trim()
  )
}

/**
 * يمسح مسوّدة الطلب الحالية بالكامل — صفحةٌ بيضاء.
 *
 * هي نفسها ما يُمسح بعد تأكيد طلبٍ ناجح: «بدأت طلباً جديداً» و«أنهيت طلباً» يجب
 * أن يتركا الشاشة في الحال نفسه، وإلا تسرّب شيءٌ من مكالمةٍ إلى التي تليها.
 */
export function resetOrderDraft() {
  clearCartSilently()          // السلّة + ملاحظات الطلب
  clearCustomerData()          // العميل + العنوان + الفرع اليدوي + خانة البحث
  resetPaymentSelection()      // المصدر وطريقة الدفع
  state.orderTag = ''
  state.isReservation = false
  state.reservationTime = ''
  state.prepLeadMinutes = ''
  state.pendingOrderEvents = []   // وإلا ورث الطلبُ التالي سجلَّ الذي قبله
  state.editingOrderId = null
  state.orderType = 'delivery'
  showAllCategories()             // ونبدأ من رأس المنيو لا من داخل تصنيفٍ سابق
}

/**
 * «طلب جديد» = صفحةٌ بيضاء.
 *
 * كان مجرّد تبديل شاشة: يعود الوكيل إليها فيجد عميل المكالمة السابقة وسلّتها،
 * فيضرب الطلب على حساب من قبله. والتصفير لا يكون صامتاً حين يكون هناك ما يُفقَد —
 * فبند القائمة نفسه هو طريق العودة إلى سلّةٍ قائمة بعد نظرةٍ على شاشة الطلبات.
 */
/**
 * تصفير مسوّدة الطلب **مع إبقاء العميل** — لاختيار عميلٍ جديد وسط الشاشة.
 *
 * اختيار عميلٍ آخر يعني مكالمةً أخرى: سلّة السابق وملاحظاته ورقم منصّته ودفعُه
 * وحجزُه لا تخصّ هذا العميل، وتركُها يعني ضربَ طلبٍ باسمه بأصناف غيره. لا نمسّ
 * نموذج العميل هنا لأنه على وشك أن يُملأ ببياناته هو.
 */
export function resetDraftForNewCustomer() {
  clearCartSilently()          // السلّة + ملاحظات الطلب
  resetPaymentSelection()      // المصدر وطريقة الدفع
  state.orderTag = ''          // رقم المنصّة الخارجية — صفةُ طلبٍ لا صفةُ عميل
  state.isReservation = false
  state.reservationTime = ''
  state.prepLeadMinutes = ''
  state.pendingOrderEvents = []
  state.editingOrderId = null
  showAllCategories()          // ونبدأ من رأس المنيو
}

export async function startNewOrder() {
  if (hasOrderDraft()) {
    // ثلاثة أبواب لا بابان: كان على الوكيل أن يمسح ما بناه أو يبقى مكانه — ولا
    // سبيل للعودة إلى طلبه المفتوح من زرّ «طلب جديد» إلا بإعادة إدخاله كلّه.
    const a = await askConfirm3({
      title: tx('في طلب شغّال دلوقتي', 'There is an order in progress'),
      body: tx('تكمّل الطلب المفتوح، ولا تبدأ واحداً جديداً وتمسح اللي قبله؟',
               'Continue the open order, or start a new one and discard it?'),
      okLabel: tx('ابدأ جديداً', 'Start new'),
      altLabel: tx('كمّل الطلب المفتوح', 'Continue the open order'),
    })
    if (a === 'cancel') return
    if (a === 'ok') { resetOrderDraft(); state.activeTab = 'menu' }
    // «كمّل» ⇒ لا مسحَ ولا تبديلَ تبويب: يعود إلى حيث ترك تماماً
    state.activeView = 'new-order'
    return
  }
  resetOrderDraft()
  state.activeTab = 'menu'
  state.activeView = 'new-order'
}

export function clearCartSilently() {
  state.cart = []
  state.orderNotes = ''
}

export function loadCustomerData(customer: any) {
  // عميلٌ آخر = مكالمةٌ أخرى: سلّة السابق وملاحظاته ورقم منصّته ودفعه وحجزه لا
  // تخصّ هذا العميل، وتركُها يعني ضربَ طلبٍ باسمه بأصناف غيره.
  //
  // الشرط «تغيّر العميل» لا «كل تحميل»: هذه الدالّة تُستدعى أيضاً بعد حفظ تعديلٍ
  // على العميل الحالي (تصحيح عنوان مثلاً) — والتصفير حينها يمحو سلّةً بناها الوكيل
  // للتوّ.
  const prev = state.currentCustomer
  const changed = !prev
    || (customer?.id != null && prev.id != null && String(prev.id) !== String(customer.id))
    || String(prev.phone || '') !== String(customer?.phone || '')
  if (changed) resetDraftForNewCustomer()
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
    showToast(tx('الرجاء إدخال رقم الهاتف للبحث', 'Enter a phone number to search'), 'warning')
    return
  }

  // ── الوضع الحقيقي: بحث بالهاتف عبر contact API ──
  if (state.live) {
    try {
      const list = await contactCustomers(phone)
      if (list && list.length > 0) {
        loadLiveCustomer(list[0])   // يصفّر المسوّدة عند تغيّر العميل
        // **لا ننتقل للمنيو هنا**: العميل القائم قد يطلب لعنوانٍ آخر من عناوينه أو
        // لعنوانٍ جديد تماماً — والقفز للأصناف يُرسل الطلب لعنوان المرّة الماضية.
        // الانتقال يكون بعد «حفظ» حين يكون العنوان مؤكَّداً.
        state.activeTab = 'customer-data'
        const n = (list[0]?.addresses || []).length
        showToast(
          n > 1
            ? tx(`تم العثور على العميل — له ${n} عناوين، اختر العنوان ثم احفظ`,
                 `Customer found — has ${n} addresses; pick one then save`)
            : tx('تم العثور على العميل — راجع العنوان أو أضف عنواناً جديداً ثم احفظ',
                 'Customer found — check the address or add a new one, then save'),
          'success',
        )
      } else {
        showToast(tx('العميل غير موجود. يرجى إضافة بياناته.', 'Customer not found. Please add their details.'), 'info')
        // مسوّدةٌ نظيفة تماماً: `clearCartSilently` وحدها كانت تُبقي رقم المنصّة
        // والدفع والحجز من المكالمة السابقة على عميلٍ جديد لم يُنشأ بعد.
        resetDraftForNewCustomer()
        clearCustomerData()
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
    loadCustomerData(customer)   // يصفّر المسوّدة عند تغيّر العميل
    state.activeTab = 'customer-data'
    const n = (customer?.addresses || []).length
    showToast(
      n > 1
        ? tx(`تم العثور على العميل — له ${n} عناوين، اختر العنوان ثم احفظ`,
             `Customer found — has ${n} addresses; pick one then save`)
        : tx('تم العثور على العميل — راجع العنوان أو أضف عنواناً جديداً ثم احفظ',
             'Customer found — check the address or add a new one, then save'),
      'success',
    )
  } else {
    showToast(tx('العميل غير موجود. يرجى إضافة بياناته.', 'Customer not found. Please add their details.'), 'info')
    resetDraftForNewCustomer()
    clearCustomerData()
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
  showToast(tx('يمكنك الآن كتابة تفاصيل العنوان الجديد بالأسفل وضغط حفظ البيانات ليضاف للعميل', 'You can now type the new address below and press save to add it to the customer'), 'info')
}

/** حذفُ عنوانٍ محفوظ — صلاحيةٌ مستقلّة: الحذف لا رجعةَ فيه. */
export function canDeleteAddress(): boolean {
  return !state.live || (currentCompany()?.permissions || []).includes('callcenter.delete_address')
}

/**
 * حذفُ العنوان — على الخادم أوّلاً ثم على الشاشة.
 *
 * كان يُشطَب من الذاكرة وحدها ويُقال «تم الحذف»، فيعود مع أوّل تحديثٍ للصفحة.
 * وعنوانٌ بلا معرّف لم يُحفَظ أصلاً (مسوّدةٌ في الشاشة) فيُزال محلّياً بلا نداء.
 */
export async function deleteAddress(idx: number, event?: Event) {
  if (event) event.stopPropagation()
  if (!canDeleteAddress()) { showToast(tx('لا تملك صلاحية حذف العناوين', 'You do not have permission to delete addresses'), 'warning'); return }
  if (!(await askConfirm({
    title: tx('حذف هذا العنوان؟', 'Delete this address?'),
    body: tx('سيُحذف من سجل العميل.', 'It will be removed from the customer record.'),
    okLabel: tx('حذف', 'Delete'),
  }))) return

  const customer = state.currentCustomer
  if (!customer || !customer.addresses) return

  // الخادم أوّلاً: لا نَعِد بحذفٍ لم يقع
  const addrId = Number(customer.addresses[idx]?.id) || null
  if (state.live && addrId) {
    try {
      await contactDeleteAddress(addrId)
    } catch (err: any) {
      showToast(err?.response?.data?.message || tx('تعذّر حذف العنوان', 'Could not delete the address'), 'error')
      return
    }
  }

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

  showToast(tx('تم حذف العنوان بنجاح', 'Address deleted'), 'success')
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
  if (!name || !phone) { showToast(tx('يرجى تعبئة الاسم ورقم الهاتف', 'Please fill in the name and mobile number'), 'error'); return }
  const isDelivery = state.orderType === 'delivery'
  if (isDelivery && !state.form.regionId) { showToast(tx('يرجى اختيار المدينة', 'Please choose a city'), 'error'); return }
  if (isDelivery && sectionRequired() && !state.form.sectionId) { showToast(tx('يرجى اختيار الحيّ', 'Please choose a district'), 'error'); return }
  const region = currentArea()
  const section = (region?.sections || []).find((x: any) => x.id === state.form.sectionId) || null
  // العنوان الذي اختاره الوكيل من قائمة العميل — يُعدَّل هو بعينه.
  // بدون معرّفه كان الخادم يطابق **بمحتوى** المدينة والحيّ والقطعة والشارع والمبنى،
  // وتغييرُ أيٍّ منها هو التعديل نفسه: فيُنشأ عنوانٌ ثانٍ ويبقى القديم مكانه.
  // «عنوان جديد» يصفّر التحديد (-1) فلا يُرسَل معرّف ويُنشأ فعلاً.
  const editing = state.selectedAddressIndex >= 0
    ? (state.currentCustomer?.addresses || [])[state.selectedAddressIndex]
    : null
  const editingId = Number(editing?.id) || null
  try {
    const saved = await contactSaveCustomer({
      name, phone: phoneE164(phone, companyDial()),
      addressId: editingId,
      regionName: region ? region.name : null,
      sectionName: section ? section.name : null,
      addressText: state.form.addressText || null,
      block: state.form.block || null, street: state.form.street || null,
      building: state.form.building || null, floor: state.form.floor || null, apartment: state.form.apartment || null,
    })
    showToast(tx('تم حفظ بيانات العميل بنجاح', 'Customer saved'), 'success')
    // الحفظ كان ينتهي هنا: `currentCustomer` يبقى فارغاً فيرفض التأكيد لاحقاً بـ
    // «يرجى إضافة بيانات العميل أولاً» رغم أن الوكيل حفظ العميل للتوّ — والتبويب
    // يبقى على البيانات فيضغط «القائمة» بيده في كل مكالمة.
    // إعادة الجلب بعد الحفظ: الخادم إمّا حدّث عنواناً قائماً أو أنشأ جديداً، وبناءُ
    // العميل من النموذج وحده يجعل عناوينه **عنواناً واحداً** فتختفي بقيّة عناوينه
    // من الشاشة. ونختار العنوان الذي حُفظ للتوّ لا الافتراضيّ.
    let placed = false
    try {
      const list = await contactCustomers(phone)
      if (list && list.length) {
        loadLiveCustomer(list[0])
        const adr = list[0].addresses || []
        // بالمعرّف الذي ردّه الخادم: المطابقة النصّية تُخطئ متى تشابه عنوانان في
        // الحقول الخمسة، وتبقى ارتداداً لخادمٍ أقدم لا يردّ المعرّف.
        const savedAddrId = Number((saved as any)?.addressId) || null
        let i = savedAddrId ? adr.findIndex((a: any) => Number(a.id) === savedAddrId) : -1
        if (i < 0) i = adr.findIndex((a: any) =>
          String(a.region || '') === String(region?.name || '') &&
          String(a.section || '') === String(section?.name || '') &&
          String(a.block || '') === String(state.form.block || '') &&
          String(a.street || '') === String(state.form.street || '') &&
          String(a.building || '') === String(state.form.building || ''))
        if (i >= 0) { state.selectedAddressIndex = i; applyLiveAddress(adr[i]) }
        placed = true
      }
    } catch { /* تعذّرت إعادة الجلب — نُكمل بما بنيناه من النموذج */ }

    if (!placed) {
      state.currentCustomer = {
        id: (saved as any)?.id ?? state.currentCustomer?.id ?? null,
        name, phone,
        addresses: isDelivery ? [{
          regionId: state.form.regionId, sectionId: state.form.sectionId,
          area: region ? region.name : '', section: section ? section.name : '',
          address: state.form.addressText || '',
          block: state.form.block || '', street: state.form.street || '',
          building: state.form.building || '', floor: state.form.floor || '', apartment: state.form.apartment || '',
        }] : [],
      }
      state.selectedAddressIndex = isDelivery ? 0 : -1
    }
    state.showCustomerInfo = true
    goToMenu()   // «حفظ» = العنوان مؤكَّد ⇒ إلى الأصناف
  } catch (err: any) {
    showToast(err?.response?.data?.message || tx('تعذّر حفظ العميل', 'Could not save the customer'), 'error')
  }
}

export function saveCustomer() {
  if (state.live) { void saveCustomerLive(); return }
  const name = state.form.name.trim()
  const phone = state.form.phone.trim()
  const area = state.form.area

  if (!name || !phone) {
    showToast(tx('يرجى تعبئة الحقول الأساسية: الاسم ورقم الهاتف', 'Please fill in the required fields: name and mobile number'), 'error')
    return
  }
  if (state.orderType === 'delivery' && !area) {
    showToast(tx('يرجى تعبئة الحقول الأساسية: الاسم، رقم الهاتف، والمنطقة', 'Please fill in the required fields: name, mobile number and area'), 'error')
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
    showToast(tx('تم تحديث بيانات العميل بنجاح', 'Customer updated'), 'success')
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
    showToast(tx('تم إضافة العميل بنجاح', 'Customer added'), 'success')
  }

  loadCustomerData(customerData)
  goToMenu()   // كان بتأخير نصف ثانية بلا سبب — الانتقال فوريّ
}

// ══════════════════════════════════════════════════════════════════════════════
// أنواع الطلب وطرق الدفع — من الشركة لا من كود الواجهة
// ══════════════════════════════════════════════════════════════════════════════
// كان `orderTypeCode` مثبَّتاً على 5 للتوصيل و6 للاستلام، وطرق الدفع ثلاثاً مكتوبةً
// في `data.ts`. شركةٌ تعمل على «طلبات» (4) أو تحصّل بـ«مدى» لا تجد شيئاً من ذلك،
// فيُسجَّل الطلب بنوعٍ وطريقةٍ لا وجود لهما عندها ويختلّ تقريرها.

/** الأنواع التي تحتاج عنواناً: التوصيل (5) وطلبات (4). ما عداها استلامٌ/داخل الفرع. */
const DELIVERY_CODES = [4, 5]
export const isDeliveryCode = (code: number) => DELIVERY_CODES.includes(Number(code))

/**
 * أنواع الطلب التي يراها وكيل مركز الاتصال: **طلبات (4) · توصيل (5) · استلام (6)**.
 *
 * كانت كلّ أنواع الشركة تُعرَض — صالة وتيك أواي وعربيّة… — وهي أنواعُ كاشيرٍ داخل
 * الفرع لا يأخذها أحدٌ بالهاتف، فتزحم الشريط وتُغري بنوعٍ خاطئ.
 *
 * وإن لم تُعرِّف الشركة «استلام» (6) يحلّ محلَّه «تيك أواي» (2) إن وُجد — هو نفسه
 * استلامٌ من الفرع باسمٍ آخر، فلا يفقد الوكيل المسار كلَّه لأن الشركة سمّته غير ذلك.
 * (فارغة = لم تصل بعد أو الشركة بلا أنواع ⇒ ارتدادٌ لبطاقتَي توصيل/استلام.)
 */
/** نوعان لا ثالث لهما في مركز الاتصال: **توصيل (5)** و**استلام (6)**. */
export const DELIVERY_TYPE_CODE = 5
export const PICKUP_TYPE_CODE = 6
const AGENT_ORDER_CODES = [DELIVERY_TYPE_CODE, PICKUP_TYPE_CODE]
export function companyOrderTypes(): any[] {
  const all = Array.isArray(state.companyOrderTypes) ? state.companyOrderTypes : []
  return all.filter((t: any) => AGENT_ORDER_CODES.includes(Number(t.code)))
}

/**
 * نوعُ الطلب المتاح **في هذا الفرع** لشكلٍ بعينه — أو `null`.
 *
 * الفحص على الفرع لا الشركة: نوعٌ مقصورٌ على فرعٍ واحد كان يبدو متاحاً للجميع،
 * فينزل الطلب بنوعٍ لا يستقبله الفرع الذي وصله. ومصفوفةٌ فارغة = بلا قيد.
 */
export function orderTypeForBranch(wantDelivery: boolean, branchId: any): any | null {
  const code = wantDelivery ? DELIVERY_TYPE_CODE : PICKUP_TYPE_CODE
  const b = Number(branchId)
  return companyOrderTypes().find((t: any) => {
    if (Number(t.code) !== code) return false
    const scope = Array.isArray(t.branchIds) ? t.branchIds : []
    return !scope.length || !b || scope.map(Number).includes(b)
  }) || null
}

/** رسالةُ المنع حين لا يستقبل الفرع الشكل المطلوب — تسمّي الفرع والنوع. */
export function orderTypeBlocker(): string | null {
  const wantDelivery = state.orderType === 'delivery'
  const bid = getResolvedOrderBranchId()
  if (orderTypeForBranch(wantDelivery, bid)) return null
  const br = (state.branches || []).find((x: any) => Number(x.id) === Number(bid))
  const brName = br ? nameOf(br) : (bid ? `#${bid}` : tx('الفرع المختار', 'the selected branch'))
  const kindAr = wantDelivery ? 'التوصيل' : 'الاستلام'
  const kindEn = wantDelivery ? 'delivery' : 'pickup'
  return tx(
    `فرع «${brName}» لا يستقبل طلبات ${kindAr} — اختر فرعاً آخر أو غيّر نوع الطلب`,
    `Branch “${brName}” does not accept ${kindEn} orders — pick another branch or change the order type`)
}
/** طرق دفع الشركة (فارغة = ارتدادٌ لقائمة `data.ts`). */
export function companyPaymentMethods(): any[] {
  const list = Array.isArray(state.companyPaymentMethods) ? state.companyPaymentMethods : []
  return list.length ? list : PAYMENT_METHODS
}

/** يُبقي النوع المختار موافقاً للشكل البنيويّ (توصيل/استلام) بعد كل تغيير. */
function syncSelectedOrderType() {
  const wantDelivery = state.orderType === 'delivery'
  // المتاح في الفرع المستهدَف؛ وإلا لا شيء — والحارس يشرح السبب عند الإرسال
  state.selectedOrderType = orderTypeForBranch(wantDelivery, getResolvedOrderBranchId())
}

/** اختيار نوعٍ من أنواع الشركة — يضبط الشكل البنيويّ معه (العنوان يظهر أو يختفي). */
export function selectOrderType(t: any) {
  if (!t) return
  state.selectedOrderType = t
  state.orderType = isDeliveryCode(t.code) ? 'delivery' : 'pickup'
}

export function setOrderType(type: string) {
  state.orderType = type
  syncSelectedOrderType()
}

export function showTab(tab: string) {
  state.activeTab = tab
}

// ==========================================
// MENU — تصفّحٌ على مستويين: رئيسية ← فرعية ← أصناف
// ==========================================
// كان المستوى الفرعيّ يسقط تماماً: الضغط على «بيتزا» يفتح كل أصنافها دفعةً واحدة —
// عشرات الكروت في شبكةٍ واحدة يمسحها الوكيل بعينه وهو يتكلّم. والكتالوج يحمل
// التقسيم أصلاً (Category ← SubCategory ← Product) ولم يكن يصل الواجهة.

/** الفئات الفرعية تحت فئةٍ رئيسية — مشتقّة من أصنافها، مرتّبةً كما في الكتالوج. */
export function subCategoriesOf(categoryId: string): any[] {
  if (!categoryId || categoryId === 'all') return []
  const map = new Map<string, any>()
  for (const it of state.menuItems) {
    if (it.categoryId !== categoryId) continue
    const sid = it.subCategoryId != null ? String(it.subCategoryId) : ''
    if (!sid) continue                     // صنفٌ بلا فئةٍ فرعية — يظهر في «كل الأصناف»
    if (!map.has(sid)) map.set(sid, { id: sid, name: it.subCategoryName, nameEn: it.subCategoryNameEn, sort: it.subCategorySort ?? 999 })
  }
  return Array.from(map.values()).sort((a, b) => a.sort - b.sort)
}

/** أصناف الفئة الرئيسية التي لا فئة فرعية لها — وإلا اختفت من الشاشة تماماً. */
export function looseItemsOf(categoryId: string): any[] {
  return state.menuItems.filter((i: any) => i.categoryId === categoryId && i.subCategoryId == null)
}

export function selectCategory(categoryId: string) {
  state.activeCategory = categoryId
  state.activeSubCategory = ''
  // «عرض الكل» وفئةٌ بلا تقسيمٍ فرعيّ تذهبان للأصناف مباشرةً: مستوىً بخيارٍ واحد
  // نقرةٌ زائدة لا فائدة منها.
  state.menuView = subCategoriesOf(categoryId).length ? 'subcategories' : 'items'
}

export function selectSubCategory(subId: string) {
  state.activeSubCategory = subId       // '' = كل أصناف الفئة الرئيسية
  state.menuView = 'items'
}

/** رجوعٌ خطوةً واحدة — لا قفزةٌ إلى الرأس. */
export function menuBack() {
  if (state.menuSearch) { state.menuSearch = ''; state.menuView = state.activeCategory ? 'items' : 'categories'; return }
  if (state.menuView === 'items' && subCategoriesOf(state.activeCategory).length) {
    state.activeSubCategory = ''
    state.menuView = 'subcategories'
    return
  }
  showAllCategories()
}

export function showAllCategories() {
  state.menuView = 'categories'
  state.menuSearch = ''
  state.activeCategory = ''
  state.activeSubCategory = ''
}

export function filterMenuItems(query: string) {
  state.menuSearch = query
  if (!query) { selectCategory('all'); return }
  state.menuView = 'items'
}

// مودال تخصيص الصنف (المرحلة الرابعة) — في الوضع الحقيقي (بدون أحجام/إضافات) نضيف الصنف مباشرةً
// موقوف لفرع معيّن = موقوف محلياً (إعدادات مركز الاتصال) أو موقوف من مطبخ الـPOS (يُدفع من الكلاود)
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
  if (bid && (state.posStoppedItems[bid] || []).includes(itemId)) return tx('الصنف موقوف من مطبخ الفرع', 'The item is stopped by the branch kitchen')
  return tx('الصنف موقوف لمركز الاتصال في فرع الطلب', 'The item is stopped for the call center at the order’s branch')
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
  // المجموعات هي المصدر الآن؛ `extras` المسطّحة تبقى للتوافق مع المووك
  const hasExtras = itemGroups(item).length > 0 || (Array.isArray(item.extras) && item.extras.length > 0)
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
    // استعادةٌ بالمعرّف لا بالاسم — الاسم يتغيّر بتغيّر اللغة فتضيع الاختيارات
    const prev: any[] = Array.isArray(ci?.modifiers) && ci.modifiers.length
      ? ci.modifiers
      : (item.extras || []).filter((e: any) => (ci?.extras || []).includes(e.name))
    state.selectedExtras = prev.map((e: any) => ({ ...e }))
    state.itemModalQty = ci?.quantity || 1
    state.itemModalNote = ci?.note || ''
    // تعديل سطر مفتوح السعر: السعر المخزَّن = سعر الوحدة ناقص الإضافات
    state.itemModalOpenPrice = isOpen && ci ? String(Math.max(0, (ci.price || 0) - (ci.extrasPrice || 0))) : ''
  } else {
    state.selectedSize = hasSizes ? item.sizes[0] : null
    state.selectedExtras = []
    autoSelectRequired(item)   // الإلزاميّ يُضاف من نفسه — ليس سؤالاً يُطرح كل مرة
    state.itemModalQty = 1
    state.itemModalNote = ''
    state.itemModalOpenPrice = ''
  }
  state.itemModalOpen = true
}
// ══════════════════════════════════════════════════════════════════════════════
// مجموعات الإضافات (modifier groups)
// ══════════════════════════════════════════════════════════════════════════════
// كانت الإضافات تصل كتلةً مسطّحة بلا قواعد: يختار الوكيل صوصين حيث يُسمح بواحد،
// ويُغفل إضافةً إلزامية فينزل الطلب للفرع ناقصاً. المجموعة تحمل قاعدتها الآن.

/**
 * المجموعة إلزامية؟ **`isRequired` وحدها**.
 *
 * كان الحكم على `minSelect > 0`، و`minSelect` عددٌ أدنى لا إعلانُ إلزام: مجموعة
 * «صوصات» عند العميل `isRequired=false` و`minSelect=1` — أي «إن اخترتَ فواحدٌ على
 * الأكثر»، لا «لا بدّ أن تختار». فصارت الصوصاتُ إجباريةً في مركز الاتصال وهي
 * اختياريةٌ في U‑Serve. ولوحة التحكم U‑Serve صريح: `isRequired` = «إلزامية (لازم
 * العميل يختار)»، و`minSelect` = «أقل عدد اختيار».
 */
export const isGroupRequired = (g: any) => !!g?.isRequired

/** أقلّ عددٍ يُلزَم به فعلاً — صفرٌ لغير الإلزامية مهما كان `minSelect`. */
export const groupMin = (g: any) => (isGroupRequired(g) ? Math.max(1, Number(g?.minSelect || 0)) : 0)

/** مجموعات الصنف (مرتّبة كما جاءت من الخادم). */
export function itemGroups(item?: any): any[] {
  const it = item ?? state.selectedMenuItem
  return Array.isArray(it?.modifierGroups) ? it.modifierGroups : []
}

/** كم خياراً مختاراً من هذه المجموعة الآن؟ */
export function groupSelectedCount(g: any): number {
  const ids = new Set((g?.options || []).map((o: any) => o.id))
  return state.selectedExtras.filter((e: any) => ids.has(e.id)).length
}

/** `maxSelect = 0` = بلا حدّ (اصطلاح الخادم). «مطلوب» تُعرض شارةً منفصلة. */
export function groupRule(g: any): string {
  const min = groupMin(g)
  const max = Number(g?.maxSelect || 0)
  if (max === 1) return tx('اختيار واحد', 'Choose one')
  if (max > 1) return tx(`حتى ${max} خيارات`, `Up to ${max}`)
  if (min > 0) return tx(`${min} على الأقل`, `At least ${min}`)
  return tx('اختياري', 'Optional')
}

/** بلغت حدّها الأقصى؟ (الباقي يُعرَض معطَّلاً بدل أن يُرفَض بعد الضغط) */
export function groupAtMax(g: any): boolean {
  const max = Number(g?.maxSelect || 0)
  return max > 0 && groupSelectedCount(g) >= max
}

/**
 * اختيار/إلغاء خيارٍ داخل مجموعته.
 *
 * `maxSelect = 1` تتصرّف كزرّ راديو: الاختيار الجديد يحلّ محلّ القديم بدل أن
 * يُرفَض — وهو ما يتوقّعه من يضغط «صوص باربيكيو» بعد «صوص الرانش».
 */
export function toggleGroupOption(g: any, opt: any) {
  const i = state.selectedExtras.findIndex((e: any) => e.id === opt.id)
  if (i >= 0) {
    const min = groupMin(g)
    if (min > 0 && groupSelectedCount(g) <= min) {
      showToast(tx(`${nameOf(g)}: لازم تختار ${min} على الأقل`, `${nameOf(g)}: choose at least ${min}`), 'warning')
      return
    }
    state.selectedExtras.splice(i, 1)
    return
  }
  const max = Number(g?.maxSelect || 0)
  if (max === 1) {
    // استبدالٌ داخل المجموعة وحدها — لا تُمسّ اختيارات المجموعات الأخرى
    const ids = new Set((g?.options || []).map((o: any) => o.id))
    state.selectedExtras = state.selectedExtras.filter((e: any) => !ids.has(e.id))
  } else if (max > 1 && groupSelectedCount(g) >= max) {
    showToast(tx(`${nameOf(g)}: الحدّ الأقصى ${max}`, `${nameOf(g)}: maximum ${max}`), 'warning')
    return
  }
  state.selectedExtras.push(pickOpt(g, opt))
}

/** خيارٌ بشكله المخزَّن: الاسمان معاً فلا يُجمَّد على لغة لحظة الاختيار. */
function pickOpt(g: any, o: any) {
  return { id: o.id, name: o.nameAr ?? o.name ?? '', nameEn: o.nameEn ?? null, price: Number(o.price) || 0, groupId: g?.id ?? null }
}

/** المجموعات التي لم يُستوفَ حدُّها الأدنى — تمنع التأكيد وتُسمّى للوكيل. */
export function missingGroups(): any[] {
  return itemGroups().filter((g: any) => groupSelectedCount(g) < groupMin(g))
}

/**
 * الإضافات الإلزامية تُضاف من نفسها.
 *
 * مجموعةٌ إلزامية بحدٍّ أدنى ليست سؤالاً — هي جزءٌ من الصنف. كان الوكيل يختارها في
 * كل مرة، وإن نسيها نزل الطلب ناقصاً. تُملأ حتى الحدّ الأدنى بترتيب الخيارات
 * (الأرخص ليس أذكى: الترتيب مقصودٌ من مُعِدّ الكتالوج).
 */
function autoSelectRequired(item: any) {
  for (const g of itemGroups(item)) {
    const min = groupMin(g)   // غير الإلزامية = صفر ⇒ لا تُملأ من نفسها
    if (min <= 0) continue
    for (const o of (g.options || [])) {
      if (groupSelectedCount(g) >= min) break
      if (!state.selectedExtras.some((e: any) => e.id === o.id)) state.selectedExtras.push(pickOpt(g, o))
    }
  }
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
  if (!itemModalValid()) { showToast(tx('حدّد سعر الصنف أولاً', 'Set the item price first'), 'warning'); return }
  const missing = missingGroups()
  if (missing.length) {
    showToast(tx(`اختر من: ${missing.map((g: any) => nameOf(g)).join('، ')}`, `Choose from: ${missing.map((g: any) => nameOf(g)).join(', ')}`), 'warning')
    return
  }
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
  // الحجم والإضافات ببنيتهما لا بأسمائهما: الاسم يتغيّر بتغيّر اللغة، والفرع يحتاج
  // المعرّفات ليعرف **ماذا** يُحضّر. `extras` (أسماء) تبقى لِما يعرضها اليوم.
  const variant = (item.variants || []).find((v: any) => (v.nameAr ?? v.name) === size || v.nameEn === size) || null
  const modifiers = selectedExtras.map((e: any) => ({
    id: e.id, name: e.name, nameEn: e.nameEn ?? null, price: Number(e.price) || 0, groupId: e.groupId ?? null,
  }))

  // ===== وضع تعديل =====
  if (state.editingCartItemId) {
    const idx = state.cart.findIndex((ci: any) => ci.cartItemId === state.editingCartItemId)
    if (idx > -1) {
      state.cart[idx] = {
        ...state.cart[idx],
        nameEn: item.nameEn || null,
        size,
        variantId: variant?.id ?? null,
        sizeAr: variant?.nameAr ?? (typeof size === 'string' ? size : null),
        sizeEn: variant?.nameEn ?? null,
        quantity: qty,
        price: unitPrice,
        extras: selectedExtras.map((e: any) => e.name),
        modifiers,
        extrasPrice,
        note: itemNote,
      }
      logPendingEvent({ type: 'item_edited', itemName: item.name, note: `تعديل ${item.name}` })
    }
    state.editingCartItemId = null
    showToast(tx(`تم تعديل ${item.name}`, `${item.name} updated`), 'success')
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
      nameEn: item.nameEn || null,
      size,
      quantity: qty,
      price: unitPrice,
      extras: selectedExtras.map((e: any) => e.name),
      variantId: variant?.id ?? null,
      sizeAr: variant?.nameAr ?? (typeof size === 'string' ? size : null),
      sizeEn: variant?.nameEn ?? null,
      modifiers,
      extrasPrice,
      note: itemNote,
    })
    logPendingEvent({ type: 'item_added', itemName: item.name, qtyAdded: qty, newQty: qty, note: `إضافة ${qty} × ${item.name}` })
  }
  // `silent`: إعادة الطلب تضيف عدة أصناف دفعةً واحدة — توست لكل صنف يغرق الشاشة
  if (!opts.silent) showToast(tx(`تم إضافة ${item.name} للسلة`, `${item.name} added to the cart`), 'success')
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

/**
 * حذف صنفٍ من السلّة — بضغطةٍ واحدة.
 *
 * كان الحذف ممكناً بطريقٍ واحد: «−» حتى تصل الكمية صفراً. صنفٌ كميّته خمسة يحتاج
 * خمس ضغطات، ولا شيء في الشاشة يقول إنّ ذلك يحذفه أصلاً — فكان الوكيل يظنّ الحذف
 * غير متاح. وهو يلزمه في الحالتين: وهو يبني الطلب، وهو يعدّل طلباً قائماً.
 *
 * بلا تأكيد: الصنف يُعاد بضغطةٍ من القائمة، والتعديل لا ينزل الفرع إلا بالحفظ.
 * والحدث يُسجَّل كما يُسجَّل الحذف بالكمية — نفس النوع، فلا ينقسم السجلّ لطريقين.
 */
export function removeCartItem(cartItemId: string) {
  const i = state.cart.findIndex((x: any) => x.cartItemId === cartItemId)
  if (i === -1) return
  const item = state.cart[i]
  state.cart.splice(i, 1)
  logPendingEvent({ type: 'item_removed', itemName: item.name, note: `حذف صنف: ${item.name}` })
}

export async function clearCart() {
  if (state.cart.length === 0) return
  const n = state.cart.length
  if (!(await askConfirm({
    title: tx('مسح كل أصناف السلة؟', 'Clear all items from the cart?'),
    body: tx(`${n} صنفاً سيُحذف.`, `${n} item(s) will be removed.`),
    okLabel: tx('مسح السلة', 'Clear cart'),
  }))) return
  state.cart = []
  state.orderNotes = ''
  logPendingEvent({ type: 'cart_cleared', note: `تم تفريغ السلة (${n} صنف)` })
}

// ==========================================
// DELIVERY FEE / TOTALS (نقلاً عن calculateCartTotals)
// ==========================================
/**
 * رسوم الطلب = رسوم ربط (الفرع ↔ المكان) لا غير. مركز الاتصال لا يُدخلها ولا يعدّلها:
 * تسعير التوصيل قرار الشركة في لوحة التحكم، و«المفتوحة» يحدّدها الفرع لكل مشوار.
 */
export function getEffectiveDeliveryFee(): number {
  return Number(state.deliveryFee || 0)
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
  // الوضع الحقيقي: يكفي اسم + هاتف + سلة (العميل يُنشأ تلقائياً عند الإرسال)
  if (state.live) {
    return state.cart.length > 0 && !!(state.form.phone || '').trim() && !!(state.form.name || '').trim()
  }
  return state.cart.length > 0 && !!state.currentCustomer
}

// زرّ التأكيد يمرّ بالمراجعة دائماً: الوكيل يقرأ الفرع والعنوان والرسوم والإجمالي
// قبل أن ينزل الطلب الفرعَ — والتصحيح بعد النزول يكون بالهاتف مع الفرع لا بضغطة.
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
  if (state.live && state.onlineDay === null) { showToast(tx('افتح يوم عمل مركز الاتصال أولاً قبل ضرب الطلب', 'Open the call-center business day before placing an order'), 'warning'); return }
  if (state.cart.length === 0) { showToast(tx('السلة فارغة', 'The cart is empty'), 'warning'); return }
  const phone = (state.form.phone || '').trim()
  const name = (state.form.name || '').trim()
  if (!phone || !name) { showToast(tx('يرجى إدخال اسم العميل ورقم الهاتف', 'Enter the customer name and mobile number'), 'warning'); return }

  const isDelivery = state.orderType === 'delivery'
  if (isDelivery && !state.form.regionId) { showToast(tx('يرجى اختيار المدينة', 'Please choose a city'), 'warning'); return }
  if (isDelivery && sectionRequired() && !state.form.sectionId) {
    showToast(tx('اختر الحيّ — المدينة دي مش مربوطة بفرع، الفرع بيتحدد من الحيّ', 'Choose the district — this city is not linked to a branch; the branch is derived from the district'), 'warning'); return
  }
  // بلا فرع الطلب يُنشأ «محتجزاً» في الكلاود ولا ينزل أي فرع، ولا يعرف الوكيل ولا
  // العميل. نمنعه هنا بدل أن يضيع بصمت.
  if (isDelivery && !getResolvedOrderBranchId()) {
    showToast(tx('مفيش فرع بيخدم المنطقة دي — اختر منطقة تانية أو حدّد الفرع يدوياً', 'No branch serves this area — pick another area or set the branch manually'), 'error'); return
  }
  // طريقة الدفع اختياريّة افتراضياً — تُلزَم فقط إن ضبطت الشركة ذلك في الإعدادات
  if (state.paymentRequired && !state.paymentMethod) { showToast(tx('يرجى تحديد طريقة الدفع (اضغط زر الدفع أسفل السلة)', 'Choose a payment method (press the payment button under the cart)'), 'warning'); return }
  // منع إرسال طلب فيه صنف موقوف لفرع الطلب (محلي أو مطبخ POS)
  {
    const bid = getResolvedOrderBranchId()
    const bad = state.cart.filter((i: any) => isItemStoppedForBranch(bid, i.itemId))
    if (bad.length) { showToast(tx(`الطلب فيه أصناف موقوفة لهذا الفرع: ${bad.map((i: any) => i.name).join('، ')}`, `The order contains items stopped for this branch: ${bad.map((i: any) => i.name).join(', ')}`), 'error'); return }
  }

  const region = currentArea()
  const section = (region?.sections || []).find((x: any) => x.id === state.form.sectionId) || null
  // كاش → تحصيل عند التسليم؛ كي‑نت/رابط → مدفوع إلكترونياً
  // طريقة الدفع المختارة من طرق الشركة (أو من قائمة `data.ts` حين لا تصل)
  const payMethod = companyPaymentMethods().find((m: any) => String(m.id) === String(state.paymentMethod)) || null
  // قائمة `data.ts` الاحتياطية لا تحمل `isCash` أصلاً: `!!undefined` كان يجعل الكاش
  // «مدفوعاً مسبقاً» فيُسجَّل الطلب بوضع دفعٍ خاطئ. نسأل عن وجود الحقل لا عن قيمته.
  // **بلا طريقةٍ أصلاً** (السياسة اختياريّة) ⇒ التحصيل عند التسليم. بدون هذا كان
  // الفرع الأخير يعطي false فيُسجَّل الطلب «مدفوعاً إلكترونياً» وهو لم يُحصَّل بعد.
  const isCashPay = !state.paymentMethod ? true
    : payMethod && 'isCash' in payMethod ? !!payMethod.isCash
    : String(state.paymentMethod ?? '') === 'cash'
  const paymentMode: 'cash_on_delivery' | 'prepaid_online' = isCashPay ? 'cash_on_delivery' : 'prepaid_online'
  // حجز: لازم موعد مستقبلي — الطلب ينزل الفرع فوراً ويظهر في قائمة الحجوزات بموعده
  if (state.isReservation) {
    const rt = state.reservationTime ? fromCompanyWall(state.reservationTime) : null
    if (!rt || isNaN(rt.getTime())) { showToast(tx('حدّد موعد الحجز', 'Set the reservation time'), 'warning'); return }
    if (rt.getTime() <= Date.now()) { showToast(tx('موعد الحجز لازم يكون في المستقبل', 'The reservation time must be in the future'), 'warning'); return }
  }

  const body: ContactOrderInput = {
    customerPhone: phoneE164(phone, companyDial()),
    customerName: name,
    paymentMode,
    // نوع الطلب من أنواع الشركة؛ وبلا أنواعٍ نرتدّ للثابت القديم (5/6)
    orderTypeCode: state.selectedOrderType?.code ?? (isDelivery ? 5 : 6),
    // معرّف طريقة الدفع كما عرّفتها الشركة — لم يكن يُرسَل إطلاقاً
    paymentMethodId: payMethod && typeof payMethod.id === 'number' ? payMethod.id : null,
    notes: (state.orderNotes || '').trim() || null,
    orderTag: (state.orderTag || '').trim() || null,
    // الفرع كان يستقبل اسماً وسعراً فقط: لا حجم ولا إضافات ولا ملاحظة الصنف —
    // فيصل «فراخ مشوية» بلا «صوص باربيكيو» و«بدون بصل»، والسعر وحده يشي بأن شيئاً
    // اختير. القاعدة تحمل الحقول أصلاً (`OnlineOrderItem`) ولم تكن تُملأ.
    items: state.cart.map((i: any) => ({
      productId: i.itemId,
      productName: i.name,
      productNameEn: i.nameEn || null,
      variantId: i.variantId ?? null,
      variantName: i.sizeAr ?? i.size ?? null,
      quantity: i.quantity,
      unitPrice: i.price,
      modifiers: Array.isArray(i.modifiers) && i.modifiers.length ? i.modifiers : undefined,
      notes: (i.note || '').trim() || null,
    })),
  }
  if (state.isReservation && state.reservationTime) {
    // ساعةُ حائط الشركة ⇒ لحظةٌ حقيقية. كان يُقرأ بمنطقة الجهاز، فوكيلٌ في مصر
    // يحجز «٨م» فينزل الفرعَ العُمانيَّ ١٠م.
    body.reservationTime = fromCompanyWall(state.reservationTime).toISOString()
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
    showToast(state.isReservation ? tx('تم إنشاء الحجز ونزوله للفرع', 'Reservation created and sent to the branch') : tx('تم إنشاء الطلب بنجاح', 'Order created'), 'success')
    resetOrderDraft()   // تجاوز الرسوم ورقم المنصّة والحجز خاصّةٌ بطلبٍ واحد لا تُورَّث
    await loadOrders()   // حدّث القائمة قبل التنقّل عشان يظهر الطلب الجديد
    state.activeView = 'orders'
  } catch (err: any) {
    showToast(err?.response?.data?.message || tx('فشل إنشاء الطلب', 'Could not create the order'), 'error')
  }
}

// ==========================================
// ORDER NOTES (نقلاً عن updateOrderNotesPreview)
// ==========================================
export function orderNotesPreview(): string {
  return state.orderNotes ? state.orderNotes : tx('لا توجد ملاحظات', 'No notes')
}

// ── ملاحظة الصنف من داخل السلّة ──────────────────────────────────────────────
// كانت تُكتب في مودال الصنف وحده. والصنف البسيط — بلا أحجام ولا إضافات ولا سعر
// مفتوح — لا يفتح مودالاً أصلاً (يُضاف بضغطة واحدة، وهو المقصود: الوكيل يتكلّم
// والسرعة تهمّ)، فلم يكن له سبيل إلى ملاحظةٍ إلا بزرّ «تعديل» — وهو لا يَعِد بذلك
// فلا يخطر ببال أحد. صارت لكل سطرٍ في السلّة بزرٍّ يقول ما يفعل.
export function openCartItemNote(cartItemId: string) {
  const ci = state.cart.find((c: any) => c.cartItemId === cartItemId)
  if (!ci) return
  state.noteItemId = cartItemId
  state.noteItemText = ci.note || ''
}

export function closeCartItemNote() { state.noteItemId = null }

/** سطر السلّة الذي تُحرَّر ملاحظته — والمودال يختفي إن اختفى السطر (مسحُ السلّة مثلاً). */
export function cartItemBeingNoted(): any {
  return state.noteItemId ? state.cart.find((c: any) => c.cartItemId === state.noteItemId) || null : null
}

export function saveCartItemNote(text: string) {
  const ci = cartItemBeingNoted()
  state.noteItemId = null
  if (!ci) return
  const t = (text || '').trim()
  if (t === (ci.note || '')) return          // بلا تغيير: لا توست ولا سطر في السجلّ
  ci.note = t
  logPendingEvent({
    type: 'item_edited', itemName: ci.name,
    note: t ? `ملاحظة على ${ci.name}: ${t}` : `مسح ملاحظة ${ci.name}`,
  })
  showToast(t ? tx('تم حفظ الملاحظة', 'Note saved') : tx('تم مسح الملاحظة', 'Note cleared'), 'success')
}

// ── صندوق التأكيد ────────────────────────────────────────────────────────────
// كان `confirm()` المتصفّح: صندوقٌ رماديّ يكتب فوقه «u-contact.vercel.app says»،
// خارج تصميم التطبيق ولغته واتجاهه، ويُجمّد الصفحة حتى يُجاب. صار مودالاً من
// مودالات التطبيق نفسها — بوعدٍ (`Promise`) فيبقى نداؤه سطراً واحداً كما كان.
export type ConfirmKind = 'danger' | 'warning'
let confirmResolve: ((v: ConfirmAnswer) => void) | null = null

/**
 * سؤالٌ بنعم/لا. يُنتظَر بـ`await`:
 *   `if (!(await askConfirm({ title, body }))) return`
 */
/**
 * صندوقٌ **ثلاثيّ**: فِعلٌ (غالباً خطر) · بديلٌ آمن · إلغاء.
 *
 * `altLabel` فارغٌ ⇒ زرّان كما كان. والبديل ليس «إلغاءً بثوبٍ آخر»: الإلغاء يترك
 * الوكيل مكانه، والبديل فِعلٌ مختلف (مثال: «كمّل الطلب المفتوح» يذهب إليه بلا مسح).
 */
export type ConfirmAnswer = 'ok' | 'alt' | 'cancel'
export function askConfirm3(opts: {
  title: string; body?: string; okLabel?: string; altLabel?: string; cancelLabel?: string; kind?: ConfirmKind
}): Promise<ConfirmAnswer> {
  // سؤالٌ سابقٌ ما زال مفتوحاً (نقرتان سريعتان): نُغلقه بالإلغاء فلا يبقى وعدٌ معلّقاً
  if (confirmResolve) { confirmResolve('cancel'); confirmResolve = null }
  state.confirmBox = {
    open: true,
    title: opts.title,
    body: opts.body || '',
    okLabel: opts.okLabel || tx('تأكيد', 'Confirm'),
    altLabel: opts.altLabel || '',
    cancelLabel: opts.cancelLabel || tx('إلغاء', 'Cancel'),
    kind: opts.kind || 'danger',
  }
  return new Promise<ConfirmAnswer>((resolve) => { confirmResolve = resolve })
}

/** الشكل الثنائيّ — «إلغاء» والبديل كلاهما `false`. */
export function askConfirm(opts: {
  title: string; body?: string; okLabel?: string; cancelLabel?: string; kind?: ConfirmKind
}): Promise<boolean> {
  return askConfirm3(opts).then((a) => a === 'ok')
}

/** إجابة الصندوق — يستدعيها المودال وحده. (يقبل القديم `true/false` تسامحاً.) */
export function answerConfirm(answer: ConfirmAnswer | boolean) {
  state.confirmBox = { ...state.confirmBox, open: false }
  const r = confirmResolve
  confirmResolve = null
  if (r) r(typeof answer === 'boolean' ? (answer ? 'ok' : 'cancel') : answer)
}

export function openOrderNotesModal() { state.notesModalOpen = true }
export function closeOrderNotesModal() { state.notesModalOpen = false }
export function saveOrderNotes(text: string) {
  state.orderNotes = (text || '').trim()
  state.notesModalOpen = false
  showToast(state.orderNotes ? tx('تم حفظ ملاحظات الطلب', 'Order notes saved') : tx('تم مسح ملاحظات الطلب', 'Order notes cleared'), 'success')
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

// ── مودال الدفع (المصدر + الطريقة) ──
export function openPaymentModal() { state.paymentModalOpen = true }
export function closePaymentModal() { state.paymentModalOpen = false }
export function setPaymentChannel(id: string) {
  // كان تغيير المصدر يصفّر الطريقة لأن الطرق كانت تابعةً له (`channel.methods`).
  // الطرق من الشركة الآن ولا تتبعه — فالتصفير يمحو اختياراً صحيحاً بلا سبب.
  // والضغط على المصدر المختار يلغيه: المصدر اختياريّ فلا بدّ من طريقٍ للتراجع.
  state.paymentChannel = state.paymentChannel === id ? null : id
}
export function setPaymentMethod(id: any) { state.paymentMethod = id }
export function resetPaymentSelection() { state.paymentChannel = null; state.paymentMethod = null }
export function confirmPaymentSelection() {
  // المصدر (الهاتف/طلبات/كاري…) اختياريّ: عميلٌ يدفع كاشاً على الباب لا مصدرَ له.
  // الطريقة وحدها إلزامية — بها يُحسَب وضع الدفع ويُسجَّل التقرير.
  if (!state.paymentMethod) { showToast(tx('اختر طريقة الدفع', 'Choose the payment method'), 'warning'); return }
  state.paymentModalOpen = false
}

// ── سجل طلبات العميل ─────────────────────────────────────────────────────────
export function closeHistoryModal() { state.historyModalOpen = false }

export async function showOrderHistory() {
  const phone = (state.form.phone || state.currentCustomer?.phone || '').trim()
  if (!phone) { showToast(tx('ابحث عن العميل بالهاتف أولاً لرؤية سجل طلباته', 'Search for the customer by phone first to see their order history'), 'warning'); return }
  state.historyModalOpen = true
  if (!state.live) {
    // المووك: نفلتر القائمة الحالية بالعميل
    state.historyOrders = state.orders.filter((o: any) => o.customerPhone === phone)
    return
  }
  state.historyLoading = true
  try {
    // الخادم يفلتر بالهاتف — القائمة المحمّلة قد لا تحمل إلا طلبات اليوم
    const rows = await contactOrders({ phone, limit: 50 })
    state.historyOrders = Array.isArray(rows) ? rows.map(mapCloudOrder) : []
  } catch {
    state.historyOrders = []
    showToast(tx('تعذّر تحميل سجل الطلبات', 'Could not load the order history'), 'error')
  } finally {
    state.historyLoading = false
  }
}

/**
 * إعادة طلب سابق: نضيف بنوده للسلة **بأسعار الكتالوج الحالية** لا أسعار وقت الطلب،
 * ونُبلّغ الوكيل بكل فارق قبل أن يؤكّد — فلا يقرأ سعراً قديماً على العميل:
 *   • صنف لم يعد في المنيو  ⇒ يُتخطّى مع تنبيه
 *   • صنف موقوف الآن (مطبخ الفرع أو مركز الاتصال) ⇒ يُتخطّى مع تنبيه
 *   • تغيّر السعر ⇒ يُضاف بالسعر الجديد مع ذكر القديم والجديد
 * البنود تأتي من `GET /contact/orders/:id` لأن قائمة الطلبات لا تحمل بنوداً.
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
    if (!items.length) { showToast(tx('الطلب ده مفيهوش أصناف', 'This order has no items'), 'warning'); return }

    const branchId = getResolvedOrderBranchId()
    const missing: string[] = []
    const stopped: string[] = []
    const priced: string[] = []
    let added = 0

    for (const it of items) {
      const oldName = it.productName || it.name || tx('صنف', 'item')
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
    if (added) notes.push(tx(`تمت إضافة ${added} صنف`, `${added} item(s) added`))
    if (priced.length) notes.push(tx(`تغيّر السعر: ${priced.join(' · ')}`, `Price changed: ${priced.join(' · ')}`))
    if (stopped.length) notes.push(tx(`موقوف حالياً ولم يُضَف: ${stopped.join('، ')}`, `Currently stopped and not added: ${stopped.join(', ')}`))
    if (missing.length) notes.push(tx(`لم يعد في المنيو: ${missing.join('، ')}`, `No longer on the menu: ${missing.join(', ')}`))
    const hasProblem = priced.length || stopped.length || missing.length
    showToast(notes.join(' — ') || tx('لا شيء لإضافته', 'Nothing to add'), hasProblem ? 'warning' : 'success')
    if (added) { state.historyModalOpen = false; state.activeTab = 'menu' }
  } catch (err: any) {
    showToast(err?.response?.data?.message || tx('تعذّر إعادة الطلب', 'Could not reorder'), 'error')
  } finally {
    state.reorderBusy = false
  }
}

// ==========================================
// ORDER SUBMISSION (reviewOrder — تحقق + stub للمودال)
// ==========================================
export function reviewOrder() {
  if (state.cart.length === 0) { showToast(tx('السلة فارغة', 'The cart is empty'), 'warning'); return }
  if (!state.currentCustomer) { showToast(tx('يرجى إضافة بيانات العميل أولاً', 'Add the customer details first'), 'warning'); return }
  if (state.paymentRequired && !state.paymentMethod) { showToast(tx('يرجى تحديد طريقة الدفع (نقدي / كي نت / رابط)', 'Choose a payment method (Cash / KNET / Link)'), 'warning'); return }

  const orderBranchId = getResolvedOrderBranchId()
  const disabledItems = orderBranchId ? (state.disabledBranchItems[orderBranchId] || []) : []
  const invalidCartItems = state.cart.filter((item: any) => disabledItems.includes(item.itemId))
  if (invalidCartItems.length > 0) {
    const branch = state.branches.find((b: any) => b.id === orderBranchId)
    const branchName = branch ? branch.name : tx('الفرع المحدد', 'the selected branch')
    const itemNames = invalidCartItems.map((i: any) => i.name).join('، ')
    showToast(tx(`الطلب يحتوي على أصناف غير متوفرة في ${branchName}: (${itemNames})`, `The order contains items unavailable at ${branchName}: (${itemNames})`), 'error')
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
  if (state.onlineDay === null) return tx('افتح يوم عمل مركز الاتصال أولاً قبل ضرب الطلب', 'Open the call-center business day before placing an order')
  if (state.cart.length === 0) return tx('السلة فارغة', 'The cart is empty')
  if (!(state.form.phone || '').trim() || !(state.form.name || '').trim()) return tx('يرجى إدخال اسم العميل ورقم الهاتف', 'Enter the customer name and mobile number')
  if (state.orderType === 'delivery') {
    if (!state.form.regionId) return tx('يرجى اختيار المدينة', 'Please choose a city')
    if (sectionRequired() && !state.form.sectionId) return tx('اختر الحيّ — الفرع بيتحدد منه', 'Choose the district — the branch is derived from it')
    if (!getResolvedOrderBranchId()) return tx('مفيش فرع بيخدم المنطقة دي', 'No branch serves this area')
  }
  // نوعُ الطلب متاحٌ في الفرع الذي سينزل عليه؟ — قبل الدفع فالمنع أوضح
  const otBlock = orderTypeBlocker()
  if (otBlock) return otBlock
  if (state.paymentRequired && !state.paymentMethod) return tx('يرجى تحديد طريقة الدفع', 'Choose a payment method')
  const bid = getResolvedOrderBranchId()
  const bad = state.cart.filter((i: any) => isItemStoppedForBranch(bid, i.itemId))
  if (bad.length) return tx(`الطلب فيه أصناف موقوفة: ${bad.map((i: any) => i.name).join('، ')}`, `The order contains stopped items: ${bad.map((i: any) => i.name).join(', ')}`)
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
    orderTypeName: state.selectedOrderType ? nameOf(state.selectedOrderType) : '',
    branchName: infoBranchName(),
    areaName: area ? nameOf(area) : null,
    sectionName: sec ? nameOf(sec) : null,
    address: infoAddress(),
    payment: getPaymentLabel(state.paymentChannel, state.paymentMethod) || '—',
    items: state.cart,
    subtotal: getCartSubtotal(),
    deliveryFee: getAppliedDeliveryFee(),
    feeIsOpen: deliveryFeeIsOpen(),
    total: getCartTotal(),
    notes: state.orderNotes || '',
    orderTag: (state.orderTag || '').trim(),
    isReservation: !!state.isReservation,
    reservationTime: state.reservationTime || '',
    // زمن التحضير المسبق: يُراجَع مع الموعد لا بعد نزول الطلب
    prepLeadMinutes: parseInt(String(state.prepLeadMinutes), 10) || 0,
  }
}

/** تأكيد المراجعة → الإرسال الفعلي (الحقيقي) أو رسالة المووك. */
export function confirmReview() {
  state.reviewModalOpen = false
  if (state.live) { void submitOrder(); return }
  showToast(tx('تم تأكيد الطلب (بيانات تجريبية)', 'Order confirmed (demo data)'), 'success')
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

/**
 * الحجز الذي بدأ الفرع ينفّذه يغادر «المجدولة» إلى «طلبات التوصيل».
 *
 * «المجدولة» قائمةُ انتظارٍ لمواعيد لم تحن، وأعمدتها مواعيد لا حالات. فما إن يجهّز
 * الفرع الحجز يصير طلباً جارياً كأيّ طلب — له سائقٌ وحالةٌ تتغيّر حتى التسليم —
 * وكان يظلّ حبيس جدولٍ لا يتابع شيئاً من ذلك، فيقرأه الوكيل «مجدولاً» وهو في الطريق.
 *
 * «تم تجهيزه» = `ready` وما بعدها؛ وما بعدها داخلٌ عمداً لأن فرعاً قد يقفز من
 * «تحضير» إلى «مع السائق» مباشرةً، فاشتراطُ `ready` وحدها كان يترك الطلب عالقاً.
 *
 * ولا نشترط أن يكون الموعد قد حلّ: الفرع قد يجهّز مبكّراً، وتلك أحوجُ اللحظات
 * لمتابعته لا لإخفائه. والتوصيل وحده ينتقل — الاستلام لا جدولَ توصيلٍ يتابعه.
 */
const SCHED_LIVE_STATUSES = ['ready', 'withdriver', 'onway', 'delivered']
export function schedWentLive(o: any): boolean {
  return !!o.scheduledDate && o.type === 'delivery' && SCHED_LIVE_STATUSES.includes(o.status)
}

// ==========================================
// DELIVERY ORDERS TAB (نقلاً عن renderDeliveryOrders / filterOrders)
// ==========================================
export function deliveryOrdersFiltered(): any[] {
  const bd = state.businessDate || todayISO()
  let filtered = state.orders.filter((o: any) =>
    o.type === 'delivery' &&
    (!o.scheduledDate || schedWentLive(o)) &&
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
// RESERVATION TIME — الموعد الافتراضي على التاريخ الحقيقي
// ==========================================

/**
 * الموعد الافتراضي للحجز — على **التاريخ الحقيقي** (٧م اليوم).
 *
 * كان يُبنى على يوم العمل. ويوم العمل عدّادٌ لا تاريخ: يتقدّم بزرّ الإقفال لا بمنتصف
 * الليل، فينزاح عن التقويم ويبقى منزاحاً — والحجز موعدٌ حقيقيّ يجيء فيه العميل بساعة
 * الحائط. فربطُه بعدّادٍ منزاح يضع الحجوزات في أيامٍ لا تخصّها.
 */
export function defaultReservationTime(): string {
  // ٧م **بساعة الشركة**: الحقل يعرض ساعة حائطها، فبناؤه من مكوّنات الجهاز يعطي
  // موعداً آخر عند فرعٍ في بلدٍ آخر.
  const soonest = new Date(Date.now() + 60 * 60 * 1000)
  const at7pm = fromCompanyWall(toCompanyWall().slice(0, 10) + 'T19:00')
  return toCompanyWall(at7pm.getTime() > soonest.getTime() ? at7pm : soonest)
}

/** أقلّ موعدٍ يقبله الإرسال — يمنع المنتقي من عرض ماضٍ يُرفَض بعد الضغط. */
export function earliestReservationTime(): string { return toCompanyWall() }

/**
 * فتح الحجز وإغلاقه — ويُبذَر الموعد عند الفتح بالتاريخ الحقيقي.
 * الموعد القائم لا يُمسّ: إغلاقٌ ثم فتحٌ (أو تحريرُ حجزٍ قائم) لا يمحو ما اختاره الوكيل.
 */
export function toggleReservation() {
  state.isReservation = !state.isReservation
  if (state.isReservation && !state.reservationTime) state.reservationTime = defaultReservationTime()
}

// ==========================================
// ALL ORDERS VIEW (نقلاً عن renderAllOrders / filterAllOrders / clearAllOrderFilters)
// ==========================================
/** ترشيحٌ نصّيٌّ متسامح: فارغٌ = بلا أثر، والمقارنة بلا حالة أحرفٍ ولا فراغاتٍ طرفيّة. */
function byText(list: any[], q: any, pick: (o: any) => any): any[] {
  const t = String(q || '').trim().toLowerCase()
  if (!t) return list
  return list.filter((o: any) => String(pick(o) ?? '').toLowerCase().includes(t))
}

export function allOrdersFiltered(): any[] {
  const bd = state.businessDate || todayISO()
  let filtered = state.orders.filter((o: any) =>
    !o.scheduledDate &&
    (state.live || (o.businessDate || (o.createdAt || '').slice(0, 10)) === bd)
  )
  if (state.allFilterStatus) filtered = filtered.filter((o: any) => o.status === state.allFilterStatus)
  if (state.allFilterBranch) filtered = filtered.filter((o: any) => o.branchId === parseInt(state.allFilterBranch))
  if (state.allFilterType) filtered = filtered.filter((o: any) => o.type === state.allFilterType)
  filtered = byText(filtered, state.allFilterDaily, (o) => o.dailyNo)
  filtered = byText(filtered, state.allFilterInvoice, (o) => o.invoiceNo)
  // خانة العميل تبحث في الاسم **والرقم** معاً: الوكيل يعرف أحدهما لا كليهما
  filtered = byText(filtered, state.allFilterPhone, (o) => `${o.customerName} ${o.customerPhone}`)
  filtered = byText(filtered, state.allFilterEmployee, (o) => o.employeeName)
  filtered = byText(filtered, state.allFilterTag, (o) => o.orderTag)
  filtered = byText(filtered, state.allFilterDriver, (o) => o.driverName)
  return filtered
}

export function clearAllOrderFilters() {
  state.allFilterDaily = ''
  state.allFilterInvoice = ''
  state.allFilterPhone = ''
  state.allFilterEmployee = ''
  state.allFilterType = ''
  state.allFilterTag = ''
  state.allFilterStatus = ''
  state.allFilterBranch = ''
  state.allFilterDriver = ''
}

/**
 * مغادرة شاشة طلبات ⇒ لوحة التفاصيل تُطوى والفلاتر تُمسح.
 *
 * `openOrderId` والفلاتر حالةٌ **عامّة واحدة** تتشاركها ثلاث شاشات: تبويب «طلبات
 * التوصيل» و«كل الطلبات» و«الطلبات المجدولة». فالطلب الذي يفتحه الوكيل في شاشةٍ كان
 * يظهر مفتوحاً في الشاشة التالية — تفاصيلُ طلبٍ ليس من قائمتها — وفلترُ الأولى يُخفي
 * صفوف الثانية بلا سببٍ ظاهر، فتبدو الشاشة فارغةً أو ناقصة.
 */
export function resetOrdersBrowsing() {
  state.openOrderId = null
  clearTabOrderFilters()
  clearAllOrderFilters()
  clearScheduledFilters()
}

// ==========================================
// SCHEDULED ORDERS VIEW (نقلاً عن renderScheduledOrders)
// ==========================================
/** الحجوزات بعد الفلاتر — رقم فاتورة · هاتف · فرع · نوع. */
export function scheduledOrdersFiltered(): any[] {
  let list = scheduledOrdersList()
  list = byText(list, state.schedFilterInvoice, (o) => o.invoiceNo)
  list = byText(list, state.schedFilterPhone, (o) => `${o.customerName} ${o.customerPhone}`)
  if (state.schedFilterBranch) list = list.filter((o: any) => o.branchId === parseInt(state.schedFilterBranch))
  if (state.schedFilterType) list = list.filter((o: any) => o.type === state.schedFilterType)
  return list
}

export function clearScheduledFilters() {
  state.schedFilterInvoice = ''
  state.schedFilterPhone = ''
  state.schedFilterBranch = ''
  state.schedFilterType = ''
}
export function scheduledOrdersList(): any[] {
  return state.orders
    .filter((o: any) => o.scheduledDate && !schedWentLive(o))
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
    // المصدران معاً: إيقاف مركز الاتصال + إيقاف مطبخ الفرع. الشاشة كانت تعرض الأول
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
/** تغيير سياسة أخذ الطلب — مفتاحٌ مستقلّ لا يرثه من يفتح اليوم. */
export function canOrderSettings(): boolean {
  return (currentCompany()?.permissions || []).includes('callcenter.order_settings')
}

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
  if (!canManageItemAvailability()) { showToast(tx('لا تملك صلاحية إيقاف/تشغيل الأصناف', 'You do not have permission to stop or resume items'), 'warning'); return false }
  const bid = parseInt(String(branchId))
  // الصنف الموقوف من مطبخ الفرع يرجع بإيقافه هناك — لا يملك مركز الاتصال تشغيله
  if (isAvailable && (state.posStoppedItems[bid] || []).includes(itemId)) {
    showToast(tx('الصنف موقوف من مطبخ الفرع — تشغيله يكون من الفرع', 'The item is stopped by the branch kitchen — it can only be resumed at the branch'), 'warning'); return false
  }
  if (!state.disabledBranchItems[bid]) state.disabledBranchItems[bid] = []
  const index = state.disabledBranchItems[bid].indexOf(itemId)

  const item = state.menuItems.find((i: any) => i.id === itemId)
  const branch = state.branches.find((b: any) => b.id === bid)
  const itemName = item ? item.name : tx('الصنف', 'the item')
  const branchName = branch ? branch.name : tx('الفرع', 'the branch')

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
        if (!ok) { showToast(tx('تعذّر التأكّد من الحفظ — حدّث الصفحة وراجع الحالة', 'Could not confirm the save — refresh the page and check the state'), 'warning'); return }
        const saved = (state.disabledBranchItems[bid] || []).includes(itemId)
        if (saved === isAvailable) { showToast(tx('لم يُحفظ التغيير على الخادم — حاول ثانية', 'The change was not saved on the server — try again'), 'error'); return }
        showToast(
          isAvailable ? tx(`تم تنشيط وإتاحة ${itemName} في ${branchName}`, `${itemName} resumed at ${branchName}`) : tx(`تم إيقاف ${itemName} في ${branchName} — لمركز الاتصال فقط`, `${itemName} stopped at ${branchName} — call center only`),
          isAvailable ? 'success' : 'warning')
      })
      .catch((err: any) => {
        const arr = state.disabledBranchItems[bid] || []
        const i = arr.indexOf(itemId)
        if (isAvailable) { if (i === -1) arr.push(itemId) } else if (i > -1) arr.splice(i, 1)
        showToast(err?.response?.data?.message || tx('تعذّر حفظ الإيقاف', 'Could not save the stop'), 'error')
      })
    return true   // قُبل التبديل محلياً؛ نتيجة الخادم تُعالَج أعلاه
  }

  showToast(
    isAvailable ? tx(`تم تنشيط وإتاحة ${itemName} في ${branchName}`, `${itemName} resumed at ${branchName}`) : tx(`تم تعطيل وإيقاف ${itemName} في ${branchName}`, `${itemName} disabled and stopped at ${branchName}`),
    isAvailable ? 'success' : 'warning')
  saveDisabledItems()
  return true
}

// ==========================================
// ORDER DETAIL PANEL (نقلاً عن viewOrderDetail / updateOrderStatus)
// ==========================================
// تبديل عرض لوحة التفاصيل: نفس id مفتوح → يقفل؛ غير كده → يفتح (مطابق toggle الأصل عبر dataset.openOrderId)
/**
 * فتح/طيّ تفاصيل الطلب — **ويجلب بنوده**.
 *
 * كانت تقلب `openOrderId` وحده، و`mapCloudOrder` تضع `items: []` لأن قائمة الخادم
 * لا تحمل البنود: فيُفتح جدول «الصنف/الكمية/السعر» فارغاً دائماً، ولا تظهر إضافةٌ
 * ولا ملاحظةٌ ولا حجم. المسار `GET /contact/orders/:id` يحملها كلّها ولم يكن يُستدعى.
 */
export async function viewOrderDetail(orderId: number, _source?: string) {
  if (state.openOrderId === orderId) { state.openOrderId = null; return }
  state.openOrderId = orderId
  const idx = state.orders.findIndex((o: any) => o.id === orderId)
  if (idx < 0 || !state.live) return
  if (state.orders[idx].itemsLoaded) return          // جُلبت قبلاً — لا نكرّر
  try {
    const d = await contactOrder(orderId)
    const items = (d?.items || []).map((it: any) => ({
      id: it.id,
      productId: it.productId ?? null,   // لازمٌ للتعديل — كان يسقط فيعود الصنف بلا هويّة
      variantId: it.variantId ?? null,
      name: it.productName,
      nameEn: it.productNameEn || null,
      // الحجم والإضافات كما خزّنهما الخادم — بالاسمين فيتبع العرضُ لغةَ الواجهة
      size: it.variantName || null,
      sizeAr: it.variantName || null,
      sizeEn: null,
      modifiers: Array.isArray(it.modifiers) ? it.modifiers : [],
      note: it.notes || '',
      quantity: Number(it.quantity) || 1,
      price: Number(it.unitPrice) || 0,
      total: Number(it.totalPrice) || 0,
    }))
    state.orders[idx] = { ...state.orders[idx], items, itemsLoaded: true, notes: d?.notes ?? state.orders[idx].notes }
  } catch {
    showToast(tx('تعذّر تحميل تفاصيل الطلب', 'Could not load the order details'), 'error')
  }
}

/** صلاحية رؤية قيمة الطلب النهائية (عمودٌ في القائمة). */
export function canViewOrderTotals(): boolean {
  return !state.live || (currentCompany()?.permissions || []).includes('callcenter.view_totals')
}

// نص طريقة الدفع (نقلاً عن getPaymentLabel)
export function getPaymentLabel(channelId: string, methodId: any): string {
  const ch = PAYMENT_CHANNELS.find((c: any) => c.id === channelId)
  // الطريقة من طرق الشركة (وإلا من قائمة `data.ts`) — والاسم يتبع لغة الواجهة
  const m = companyPaymentMethods().find((x: any) => String(x.id) === String(methodId))
  const mLabel = m ? nameOf(m) : String(methodId ?? '')
  // بلا مصدر: الطريقة وحدها — لا فاصلٌ معلّقٌ بلا طرف
  if (!channelId) return mLabel
  return `${ch ? nameOf(ch) : channelId}  •  ${mLabel}`
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
  showToast(tx(`تم تحديث حالة الطلب #${order.invoiceNo} إلى: ${statusObjNew ? statusObjNew.name : newStatus}`, `Order #${order.invoiceNo} status updated to: ${statusObjNew ? statusObjNew.name : newStatus}`), 'success')
}

// ==========================================
// ASSIGN DRIVER MODAL (نقلاً عن showAssignDriverModal / filterDriverList / selectDriverForOrder / unassignDriverFromOrder)
// ==========================================
export function openAssignDriverModal(orderId: number) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return
  if (order.type !== 'delivery') {
    showToast(tx('تعيين السائق متاح لطلبات التوصيل فقط', 'Assigning a driver is only available for delivery orders'), 'warning')
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

  showToast(tx(`تم تعيين السائق ${driver.name} للطلب #${order.invoiceNo}`, `Driver ${driver.name} assigned to order #${order.invoiceNo}`), 'success')
  closeDriverModal()
}

export async function unassignDriverFromOrder(orderId: number) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return
  if (!(await askConfirm({
    title: tx('إلغاء تعيين السائق؟', 'Unassign the driver?'),
    body: tx('سيعود الطلب بلا سائق.', 'The order will go back to having no driver.'),
    okLabel: tx('إلغاء التعيين', 'Unassign'), kind: 'warning',
  }))) return

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

  showToast(tx('تم إلغاء تعيين السائق', 'Driver unassigned'), 'info')
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
/** صلاحية تعديل طلبٍ قائم — مفتاحٌ مستقلّ عن الإلغاء وعن تعيين الفرع. */
export function canEditOrder(): boolean {
  return !state.live || (currentCompany()?.permissions || []).includes('callcenter.edit_order')
}
/**
 * هذا الطلب بعينه: قبل «جاهز» فقط.
 * ما إن يصير جاهزاً فقد خرج من المطبخ — والخادم يرفضه كذلك، وهذا حارس الشاشة
 * كي لا يبني الوكيل تعديلاً يُرفض بعد بنائه.
 */
export function canEditThisOrder(order: any): boolean {
  if (!order) return false
  return ['sent', 'new', 'preparing'].includes(String(order.status))
}

/**
 * فتح طلبٍ قائم للتعديل: يُحمَّل محتواه في السلّة وتتبدّل الشاشة لوضع التعديل.
 *
 * **العنوان والفرع لا يُعدَّلان** (الخادم لا يقبلهما): تغييرهما يُعيد اشتقاق الفرع
 * ويوم العمل لطلبٍ يمسكه فرعٌ بالفعل. العنوان الخطأ يُلغى ويُعاد إنشاؤه.
 */
export function startEditOrder(orderId: number) {
  if (!canEditOrder()) { showToast(tx('لا تملك صلاحية تعديل الطلبات', 'You do not have permission to edit orders'), 'warning'); return }
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) { showToast(tx('الطلب غير موجود', 'Order not found'), 'error'); return }
  if (!canEditThisOrder(order)) { showToast(tx('الطلب بقى جاهز — التعديل يكون من الفرع', 'The order is ready — edit it at the branch'), 'warning'); return }
  if (!order.itemsLoaded || !Array.isArray(order.items) || !order.items.length) {
    showToast(tx('جارٍ تحميل أصناف الطلب — افتح تفاصيله ثم أعد المحاولة', 'Loading the order items — open its details and try again'), 'warning')
    void viewOrderDetail(orderId)
    return
  }

  resetOrderDraft()            // يُخرج من أي تعديلٍ سابق ويُفرغ المسوّدة
  state.editingOrderId = orderId
  // السلّة من بنود الطلب — بنفس شكل سطر السلّة كي تعمل عليها كل أدوات الشاشة
  state.cart = order.items.map((it: any, k: number) => ({
    cartItemId: 'e' + orderId + '-' + k,
    itemId: it.productId ?? null,
    name: it.name,
    nameEn: it.nameEn || null,
    size: it.sizeAr ?? it.size ?? null,
    quantity: Number(it.quantity) || 1,
    price: Number(it.price) || 0,
    extras: [],
    variantId: it.variantId ?? null,
    sizeAr: it.sizeAr ?? it.size ?? null,
    sizeEn: it.sizeEn ?? null,
    modifiers: Array.isArray(it.modifiers) ? it.modifiers : [],
    extrasPrice: 0,
    note: it.note || '',
  }))
  state.orderNotes = order.notes || ''
  state.orderTag = order.orderTag || ''
  state.paymentMethod = order.paymentMethodId ?? null
  state.orderType = order.type === 'delivery' ? 'delivery' : 'pickup'
  state.openOrderId = null     // لوحة التفاصيل تُطوى — الشاشة انتقلت للتعديل
  state.activeView = 'new-order'
  state.activeTab = 'menu'
  showToast(tx(`تعديل الطلب #${order.invoiceNo} — العنوان والفرع لا يتغيّران`, `Editing order #${order.invoiceNo} — address and branch stay as they are`), 'info')
}

export function cancelOrderEdit() {
  resetOrderDraft()
  state.activeView = 'orders'
}

/** حفظ التعديل — البنود والملاحظات والدفع فقط (الخادم يرفض غيرها). */
export async function saveOrderEdit() {
  const id = state.editingOrderId
  if (!id) return
  if (!state.cart.length) { showToast(tx('السلة فارغة', 'The cart is empty'), 'warning'); return }
  const payMethod = companyPaymentMethods().find((m: any) => String(m.id) === String(state.paymentMethod)) || null
  const isCashPay = !state.paymentMethod ? true
    : payMethod && 'isCash' in payMethod ? !!payMethod.isCash
    : String(state.paymentMethod ?? '') === 'cash'
  try {
    await contactUpdateOrder(id, {
      paymentMode: isCashPay ? 'cash_on_delivery' : 'prepaid_online',
      paymentMethodId: payMethod && typeof payMethod.id === 'number' ? payMethod.id : null,
      notes: (state.orderNotes || '').trim() || null,
      orderTag: (state.orderTag || '').trim() || null,
      items: state.cart.map((i: any) => ({
        productId: i.itemId,
        productName: i.name,
        productNameEn: i.nameEn || null,
        variantId: i.variantId ?? null,
        variantName: i.sizeAr ?? i.size ?? null,
        quantity: i.quantity,
        unitPrice: i.price,
        modifiers: Array.isArray(i.modifiers) && i.modifiers.length ? i.modifiers : undefined,
        notes: (i.note || '').trim() || null,
      })),
    })
    showToast(tx('تم حفظ التعديل — الفرع هيستلم الفرق', 'Saved — the branch will get the difference'), 'success')
    resetOrderDraft()
    await loadOrders()
    state.activeView = 'orders'
  } catch (err: any) {
    showToast(err?.response?.data?.message || tx('تعذّر حفظ التعديل', 'Could not save the edit'), 'error')
  }
}

/**
 * الإلغاء متاحٌ ما لم يبدأ التحضير.
 *
 * كان مقصوراً على `sent` — أي قبل أن ينزل الفرع أصلاً؛ فطلبٌ وصل الفرع ولم يلمسه
 * أحد بعدُ كان يحتاج مكالمةً هاتفيّة لإلغائه. و«جاري التحضير» فما بعدها تبقى
 * ممنوعة: المكوّنات خرجت والوقت صُرف، فالقرار للفرع.
 *
 * وهذا حدُّ الواجهة لا الحقيقة: الفرع يفحص حالته اللحظية ويردّ، لأن ما نراه هنا
 * مرآةٌ قد تتأخّر دورةَ رفعٍ كاملة.
 */
export function canCancelThisOrder(order: any): boolean {
  if (!order || order.status === 'cancelled') return false
  if (!state.live) return true
  if (order.cancelRequested) return false      // طلبٌ معلّق — لا يُكرَّر
  return order.status === 'sent' || order.status === 'new'
}
export function openCancelModal(orderId: number) {
  const order = state.orders.find((o: any) => o.id === orderId)
  if (!order) return
  if (!canCancelOrder()) { showToast(tx('لا تملك صلاحية إلغاء الطلبات', 'You do not have permission to cancel orders'), 'warning'); return }
  if (!canCancelThisOrder(order)) {
    showToast(order.cancelRequested
      ? tx('طلب الإلغاء عند الفرع بالفعل — في انتظار ردّه', 'Cancellation already sent to the branch — awaiting its reply')
      : tx('الطلب دخل التجهيز عند الفرع — الإلغاء يكون من الفرع', 'The order is being prepared at the branch — cancel it from the branch'), 'warning')
    return
  }
  state.cancelModalOrderId = orderId
}
export function closeCancelModal() { state.cancelModalOrderId = null }

// تطبيق الإلغاء بالسبب المختار (reason = { id, label, note? }) — نقلاً عن منطق updateOrderStatus
/**
 * الإلغاء على الخادم أولاً ثم على الشاشة. كان محلياً بالكامل: الوكيل يلغي فيختفي
 * الطلب من أمامه بينما ينزل الفرع ويُصنَع ويُحمَّل على سائق. السبب لا يقبله
 * الـendpoint فنسجّله شكوى‑أثراً في الملاحظات المحلية فقط (سجلّ الوكيل).
 */
async function confirmCancelOrderLive(orderId: number, reason: any) {
  try {
    const res: any = await contactCancelOrder(orderId, reason?.label || reason?.id || undefined)
    // نزل الفرع ⇒ الردّ طلبٌ معلّق لا إلغاءٌ واقع. لا نُقفله على الشاشة: الوكيل
    // سيقول للعميل «أُلغي» بينما المطبخ قد يكون بدأ، فننتظر ردّ الفرع.
    const done = res?.status === 'cancelled'
    if (done) applyLocalCancel(orderId, reason)
    showToast(done
      ? tx('تم إلغاء الطلب', 'Order cancelled')
      : tx('طلب الإلغاء أُرسل للفرع — يتأكّد خلال ثوانٍ', 'Cancellation sent to the branch — confirming shortly'), done ? 'success' : 'info')
    closeCancelModal()
    await loadOrders()
  } catch (err: any) {
    showToast(err?.response?.data?.message || tx('تعذّر إلغاء الطلب', 'Could not cancel the order'), 'error')
  }
}

export function confirmCancelOrder(orderId: number, reason: any) {
  if (state.live) {
    if (!canCancelOrder()) { showToast(tx('لا تملك صلاحية إلغاء الطلبات', 'You do not have permission to cancel orders'), 'warning'); return }
    if (!reason) { showToast(tx('اختر سبب الإلغاء', 'Choose a cancellation reason'), 'warning'); return }
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

  showToast(tx(`تم تحديث حالة الطلب #${order.invoiceNo} إلى: ${statusObjNew ? statusObjNew.name : 'ملغي'}`, `Order #${order.invoiceNo} status updated to: ${statusObjNew ? statusObjNew.name : 'Cancelled'}`), 'success')
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
      return { icon: 'shopping-cart', title: tx(`إضافة صنف: ${entry.itemName || ''}`, `Item added: ${entry.itemName || ''}`), bg: 'rgba(59, 130, 246, 0.12)', color: '#1d4ed8' }
    case 'item_qty_up':
      return { icon: 'plus', title: tx(`زيادة كمية: ${entry.itemName || ''}`, `Qty increased: ${entry.itemName || ''}`), bg: 'rgba(16, 185, 129, 0.12)', color: '#047857' }
    case 'item_qty_down':
      return { icon: 'minus', title: tx(`تقليل كمية: ${entry.itemName || ''}`, `Qty decreased: ${entry.itemName || ''}`), bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' }
    case 'item_removed':
      return { icon: 'trash', title: tx(`حذف صنف: ${entry.itemName || ''}`, `Item removed: ${entry.itemName || ''}`), bg: 'rgba(239, 68, 68, 0.13)', color: '#b91c1c' }
    case 'item_edited':
      return { icon: 'edit', title: tx(`تعديل صنف: ${entry.itemName || ''}`, `Item edited: ${entry.itemName || ''}`), bg: 'rgba(139, 92, 246, 0.14)', color: '#6d28d9' }
    case 'cart_cleared':
      return { icon: 'broom', title: tx('تفريغ السلة', 'Cart cleared'), bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' }
    case 'driver_assigned':
      return { icon: 'bike', title: tx(`تحميل على السائق: ${entry.driverName || ''}`, `Handed to driver: ${entry.driverName || ''}`), bg: 'rgba(6, 182, 212, 0.14)', color: '#0e7490' }
    case 'driver_unassigned':
      return { icon: 'ban', title: tx('إلغاء تعيين السائق', 'Driver unassigned'), bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' }
    case 'created':
      return { icon: 'check-circle', title: tx('تأكيد الطلب', 'Order confirmed'), bg: 'rgba(37, 99, 235, 0.14)', color: '#1d4ed8' }
    // أنواع السجلّ القادم من الكلاود (buildTimeline)
    case 'branch':
      return { icon: 'store', title: tx('نزل الفرع', 'Reached the branch'), bg: 'rgba(37, 99, 235, 0.14)', color: '#1d4ed8' }
    case 'held':
      return { icon: 'alert-triangle', title: tx('محتجَز — بانتظار تعيين فرع', 'On hold — awaiting branch assignment'), bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' }
    case 'driver':
      return { icon: 'bike', title: tx('السائق', 'Driver'), bg: 'rgba(6, 182, 212, 0.14)', color: '#0e7490' }
    case 'delivered':
      return { icon: 'check-circle', title: tx('تم التسليم', 'Delivered'), bg: 'rgba(16, 185, 129, 0.12)', color: '#047857' }
    case 'edited':
      return { icon: 'edit', title: tx('تعديل الطلب', 'Order edited'), bg: 'rgba(139, 92, 246, 0.14)', color: '#6d28d9' }
    case 'complaint':
      return { icon: 'alert-triangle', title: tx('تقديم شكوى', 'Complaint filed'), bg: 'rgba(239, 68, 68, 0.13)', color: '#b91c1c' }
    case 'cancelled':
      return { icon: 'x-circle', title: tx('إلغاء الطلب', 'Order cancelled'), bg: 'rgba(239, 68, 68, 0.13)', color: '#b91c1c' }
    case 'status':
    default: {
      const statusObj = ORDER_STATUSES.find((s: any) => s.id === entry.status)
      return {
        icon: statusObj ? statusObj.icon : 'history',
        title: statusObj ? tx(`الحالة: ${nameOf(statusObj)}`, `Status: ${nameOf(statusObj)}`) : tx('تحديث الحالة', 'Status update'),
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

/** إرسال الشكوى للكلاود (وضع live) — تُنسب للوكيل وتظهر لموظف الشركة في لوحة التحكم. */
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
    showToast(tx('تم تسجيل الشكوى بنجاح', 'Complaint recorded'), 'success')
    closeComplaintModal()
  } catch (err: any) {
    showToast(err?.response?.data?.message || tx('تعذّر تسجيل الشكوى', 'Could not record the complaint'), 'error')
  }
}

export function submitComplaint(orderId: number, text: string, category: string = 'other') {
  const t = (text || '').trim()
  if (!t) {
    showToast(tx('الرجاء كتابة تفاصيل الشكوى', 'Please write the complaint details'), 'warning')
    return
  }
  if (state.live) {
    if (!canManageComplaints()) { showToast(tx('لا تملك صلاحية تقديم الشكاوى', 'You do not have permission to file complaints'), 'warning'); return }
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

  showToast(tx('تم تسجيل الشكوى بنجاح', 'Complaint recorded'), 'success')
  closeComplaintModal()
}
