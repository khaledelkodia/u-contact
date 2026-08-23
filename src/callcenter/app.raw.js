/**
 * ========================================
 * Premium POS - نظام كول سنتر المطاعم
 * المنطق الرئيسي للتطبيق (JavaScript)
 * ========================================
 */

// ==========================================
// STATE MANAGEMENT
// ==========================================
const AppState = {
  currentUser: null,
  currentBranch: null,
  activeView: 'new-order',
  activeTab: 'customer-data',

  // Business Day (تاريخ يوم العمل بتاع المطعم)
  businessDate: null, // YYYY-MM-DD - يتغير بزرار EOD مش بمنتصف الليل

  // Manual branch override للطلب الحالي - لو الموظف غير الفرع يدوياً
  branchOverrideId: null,

  // سجل العمليات المؤقت للطلب الحالي (إضافة صنف/كمية/إلخ) - بيتنقل لـ statusHistory عند تأكيد الطلب
  pendingOrderEvents: [],

  // Current Order State
  currentCustomer: null,
  cart: [],
  paymentChannel: null, // مصدر الطلب: phone | talabat | carriage | jahez | walkin
  paymentMethod: null,  // طريقة الدفع: cash | knet | link
  orderType: 'delivery',
  editingOrderId: null,
  cartTotal: 0,
  cartSubtotal: 0,
  deliveryFee: 0.500,
  deliveryFeeOverride: null, // قيمة يدوية للطلب الحالي - لو null بنرجع للـ deliveryFee الافتراضية
  selectedAddressIndex: -1,
  orderNotes: '',

  // Data Collections (initialized from data.js)
  customers: [],
  orders: [],
  menuCategories: [],
  menuItems: [],
  branches: [],
  employees: [],
  drivers: [],
  disabledBranchItems: {}, // Key: branchId, Value: Array of itemIds

  // Current Modal State
  selectedMenuItem: null,
  selectedSize: null,
  selectedExtras: [],
  editingCartItemId: null  // لو مش null، الـ modal في وضع تعديل صنف موجود في السلة
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize data from window globals (data.js)
  AppState.customers = [...SAMPLE_CUSTOMERS];
  AppState.orders = [...SAMPLE_ORDERS];
  AppState.menuCategories = [...MENU_CATEGORIES];
  AppState.menuItems = [...MENU_ITEMS];
  AppState.branches = [...BRANCHES];
  AppState.employees = [...EMPLOYEES];
  AppState.drivers = typeof DRIVERS !== 'undefined' ? [...DRIVERS] : [];
  AppState.deliveryFee = SYSTEM_SETTINGS.deliveryFee;

  // Load Business Date from localStorage (لو موجود)، غير كده ابدأ بتاريخ النهارده
  initBusinessDate();

  // Load disabled items per branch from localStorage
  const savedDisabledItems = localStorage.getItem('pos_disabled_branch_items');
  if (savedDisabledItems) {
    try {
      AppState.disabledBranchItems = JSON.parse(savedDisabledItems);
    } catch (e) {
      AppState.disabledBranchItems = {};
    }
  } else {
    AppState.disabledBranchItems = {};
  }

  // Initialize UI components
  initClock();
  initBranchSelects();
  initAreaSelect();
  initLogin();

  // Check login status
  const savedUser = localStorage.getItem('pos_user');
  if (savedUser) {
    loginSuccess(JSON.parse(savedUser));
  }
});

// ==========================================
// AUTHENTICATION
// ==========================================
function initLogin() {
  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');

    if (!usernameInput || !passwordInput) {
      showLoginError('الرجاء إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    const user = AppState.employees.find(emp =>
      emp.username === usernameInput && emp.password === passwordInput
    );

    if (user) {
      localStorage.setItem('pos_user', JSON.stringify(user));
      loginSuccess(user);
    } else {
      showLoginError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  });
}

function showLoginError(message) {
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');

  // Trigger shake animation
  errorEl.style.animation = 'none';
  errorEl.offsetHeight; // trigger reflow
  errorEl.style.animation = 'shake 0.4s ease';
}

function loginSuccess(user) {
  AppState.currentUser = user;

  // Set initial branch (default to first branch or user's branch)
  if (user.branch === 'all') {
    AppState.currentBranch = AppState.branches[0];
  } else {
    AppState.currentBranch = AppState.branches.find(b => b.id === user.branch) || AppState.branches[0];
  }

  // Hide login, show app
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Update UI with user info
  document.getElementById('sidebar-user-name').textContent = user.name;
  document.getElementById('sidebar-avatar').textContent = user.name.charAt(0);
  document.getElementById('sidebar-user-role').textContent = user.role === 'admin' ? 'مدير النظام' : (user.role === 'supervisor' ? 'مشرف' : 'موظف كول سنتر');

  document.getElementById('header-user-name').textContent = user.name;
  document.getElementById('header-avatar').textContent = user.name.charAt(0);

  updateBranchUI();
  applyRolePermissions();
  initializeApp();
}

function applyRolePermissions() {
  // زر EOD يظهر للأدمن والمشرف بس
  const eodBtn = document.getElementById('btn-eod');
  if (eodBtn) {
    const role = AppState.currentUser && AppState.currentUser.role;
    eodBtn.style.display = (role === 'admin' || role === 'supervisor') ? 'inline-flex' : 'none';
  }
}

function logout() {
  localStorage.removeItem('pos_user');
  AppState.currentUser = null;

  // Hide app, show login
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');

  // Clear inputs
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

// ==========================================
// CORE APP INITIALIZATION
// ==========================================
function initializeApp() {
  renderMenuCategories();
  showAllCategories();
  renderDeliveryOrders();
  renderAllOrders();
  updateDashboardStats();
  renderEmployeesList();

  // ارسم قائمة مصادر/طرق الدفع
  renderPaymentChannels();
  renderPaymentMethods();
  renderPaymentSummary();

  // Initialize availability settings list
  populateAvailabilityCategoryFilter();
  const availabilityBranchSelect = document.getElementById('settings-availability-branch');
  if (availabilityBranchSelect) {
    const defaultBranchId = AppState.currentBranch ? AppState.currentBranch.id : (AppState.branches[0] ? AppState.branches[0].id : 1);
    availabilityBranchSelect.value = defaultBranchId;
    renderBranchItemsSettings(defaultBranchId);
  }

  renderSidebarDisabledPanel();

  showView('new-order', document.querySelector('.nav-item[data-view="new-order"]'));
  showTab('menu', document.querySelector('.tab-btn[data-tab="menu"]'));
}

function applyLanguageToApp(lang = window.currentLang || 'ar') {
  const isEn = lang === 'en';

  document.title = isEn ? 'Premium POS - Restaurant Call Center System' : 'Premium POS - نظام كول سنتر المطاعم';

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', isEn ? 'Restaurant call center system for managing restaurant orders - Premium POS' : 'نظام كول سنتر لإدارة طلبات المطاعم - Premium POS');
  }

  const loginSubtitle = document.querySelector('.login-subtitle, .login-header p');
  if (loginSubtitle) loginSubtitle.textContent = isEn ? 'Restaurant Call Center System' : 'نظام كول سنتر المطاعم';

  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) loginBtn.textContent = isEn ? 'Login' : 'تسجيل الدخول';

  const sidebarLogo = document.querySelector('.sidebar-logo');
  if (sidebarLogo) sidebarLogo.textContent = 'Premium POS';

  const sidebarUserRole = document.getElementById('sidebar-user-role');
  if (sidebarUserRole && AppState.currentUser) {
    sidebarUserRole.textContent = isEn
      ? (AppState.currentUser.role === 'admin' ? 'System Admin' : AppState.currentUser.role === 'supervisor' ? 'Supervisor' : 'Call Center Agent')
      : (AppState.currentUser.role === 'admin' ? 'مدير النظام' : AppState.currentUser.role === 'supervisor' ? 'مشرف' : 'موظف كول سنتر');
  }

  const headerClock = document.getElementById('header-clock');
  if (headerClock) headerClock.setAttribute('dir', 'ltr');

  const ordersTitle = document.querySelector('#view-orders .orders-title');
  if (ordersTitle) ordersTitle.textContent = isEn ? 'Delivery Orders' : 'طلبات التوصيل';

  const reportsTitle = document.querySelector('#view-reports .dashboard-title');
  if (reportsTitle) reportsTitle.textContent = isEn ? 'Reports & Dashboard' : 'التقارير ولوحة التحكم';

  const settingsTitle = document.querySelector('#view-settings .dashboard-title');
  if (settingsTitle) settingsTitle.textContent = isEn ? 'Settings' : 'الإعدادات';

  const statusTitle = document.querySelector('#panel-order-status .empty-state-title');
  if (statusTitle) statusTitle.textContent = isEn ? 'Choose an order to track its status' : 'اختر طلب لمتابعة حالته';

  const statusDesc = document.querySelector('#panel-order-status .empty-state-desc');
  if (statusDesc) statusDesc.textContent = isEn ? 'Search by invoice or phone, or click any order from the table' : 'ابحث برقم الفاتورة أو التليفون أو اضغط على أي طلب من جدول الطلبات';

  const cycleTitle = document.querySelector('#panel-order-cycle .empty-state-title');
  if (cycleTitle) cycleTitle.textContent = isEn ? 'Order Cycle' : 'دورة حياة الطلب';

  const cycleDesc = document.querySelector('#panel-order-cycle .empty-state-desc');
  if (cycleDesc) cycleDesc.textContent = isEn ? 'Track the order journey from creation to delivery' : 'تتبع مراحل الطلب من الإنشاء حتى التسليم';

  const phoneSearch = document.getElementById('customer-phone-search');
  if (phoneSearch) phoneSearch.placeholder = isEn ? 'Enter phone number...' : 'أدخل رقم الهاتف...';

  const menuSearch = document.getElementById('menu-search-input');
  if (menuSearch) menuSearch.placeholder = isEn ? 'Search the menu...' : 'بحث في القائمة...';

  const orderNotesPreview = document.getElementById('order-notes-preview');
  if (orderNotesPreview && !AppState.orderNotes) {
    orderNotesPreview.textContent = isEn ? 'No notes' : 'لا توجد ملاحظات';
  }

  renderMenuCategories();
  const activeCat = document.querySelector('.category-card.active');
  if (activeCat) {
    selectCategory(activeCat.getAttribute('data-id'));
  } else {
    showAllCategories();
  }

  updateOrderNotesPreview();
  renderCart();
  renderDeliveryOrders();
  renderAllOrders();
  renderScheduledOrders();
  updateDashboardStats();
  renderEmployeesList();

  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    const tab = btn.getAttribute('data-tab');
    if (tab === 'customer-data') btn.textContent = isEn ? 'Customer Data' : 'بيانات العميل';
    if (tab === 'menu') btn.textContent = isEn ? 'Menu' : 'القائمة';
    if (tab === 'delivery-orders') btn.textContent = isEn ? 'Delivery Orders' : 'طلبات التوصيل';
    if (tab === 'order-status') btn.textContent = isEn ? 'Order Status' : 'حالة الطلب';
    if (tab === 'order-cycle') btn.textContent = isEn ? 'Order Cycle' : 'دورة الطلب';
  });
}

window.applyLanguageToApp = applyLanguageToApp;

// ==========================================
// UTILITIES
// ==========================================
function formatCurrency(amount) {
  return parseFloat(amount).toFixed(3) + ' د.ك';
}

function formatDate(dateString) {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  return new Date(dateString).toLocaleDateString('ar-KW', options);
}

function generateInvoiceNo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getDailyOrderNo() {
  // العداد بيتحسب على أساس يوم العمل (Business Date) مش التاريخ العادي
  const bd = AppState.businessDate || todayISO();
  const dayOrders = AppState.orders.filter(o => (o.businessDate || (o.createdAt || '').slice(0, 10)) === bd);
  return dayOrders.length + 1;
}

function initClock() {
  const clockEl = document.getElementById('header-clock');
  const reportDateEl = document.getElementById('report-date');
  const updateClockDisplay = () => {
    const now = new Date();
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('ar-KW', { hour12: false });
    if (reportDateEl) {
      const bd = AppState.businessDate ? new Date(AppState.businessDate + 'T00:00:00') : now;
      reportDateEl.textContent = 'يوم العمل: ' + bd.toLocaleDateString('ar-KW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  };

  updateClockDisplay();
  setInterval(updateClockDisplay, 1000);
}

// ==========================================
// BUSINESS DATE (يوم العمل بتاع المطعم)
// ==========================================
const BUSINESS_DATE_KEY = 'pos_business_date';

function todayISO() {
  // YYYY-MM-DD حسب توقيت الجهاز المحلي (مش UTC) علشان متخبطش بالتاريخ بسبب فروق التوقيت
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initBusinessDate() {
  const saved = localStorage.getItem(BUSINESS_DATE_KEY);
  AppState.businessDate = saved || todayISO();
  if (!saved) localStorage.setItem(BUSINESS_DATE_KEY, AppState.businessDate);
  renderBusinessDate();
}

function renderBusinessDate() {
  const el = document.getElementById('header-business-date-value');
  if (!el || !AppState.businessDate) return;
  const d = new Date(AppState.businessDate + 'T00:00:00');
  el.textContent = d.toLocaleDateString('ar-KW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function nextDayISO(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function closeBusinessDay() {
  // التحقق من الصلاحيات - الأدمن والمشرف بس
  const role = AppState.currentUser && AppState.currentUser.role;
  if (role !== 'admin' && role !== 'supervisor') {
    showToast('غير مصرح: قفل اليوم متاح للمدير والمشرف فقط', 'error');
    return;
  }

  // اجمع ملخص اليوم قبل ما نقفله
  const current = AppState.businessDate;
  const dayOrders = AppState.orders.filter(o => (o.businessDate || (o.createdAt || '').slice(0, 10)) === current);
  const total = dayOrders.length;
  const delivered = dayOrders.filter(o => o.status === 'delivered').length;
  const cancelled = dayOrders.filter(o => o.status === 'cancelled').length;
  const pending = dayOrders.filter(o => ['new', 'preparing', 'ready', 'onway'].includes(o.status)).length;
  const revenue = dayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);

  const currentLabel = new Date(current + 'T00:00:00').toLocaleDateString('ar-KW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const next = nextDayISO(current);
  const nextLabel = new Date(next + 'T00:00:00').toLocaleDateString('ar-KW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const warningHtml = pending > 0
    ? `<div class="cc-warning"><i class="fa-solid fa-triangle-exclamation"></i> فيه ${pending} طلب لسه شغال (مش متسلم/ملغي). تأكد من إنهاءهم قبل قفل اليوم.</div>`
    : '';

  const body = `
    <div class="eod-section">
      <div class="eod-section-label"><i class="fa-solid fa-calendar-day"></i> اليوم الحالي</div>
      <div class="eod-section-date">${currentLabel}</div>
      <div class="eod-stats-grid">
        <div class="eod-stat eod-stat-blue">
          <div class="eod-stat-label">إجمالي الطلبات</div>
          <div class="eod-stat-value">${total}</div>
        </div>
        <div class="eod-stat eod-stat-green">
          <div class="eod-stat-label">متسلمة</div>
          <div class="eod-stat-value">${delivered}</div>
        </div>
        <div class="eod-stat eod-stat-red">
          <div class="eod-stat-label">ملغية</div>
          <div class="eod-stat-value">${cancelled}</div>
        </div>
        <div class="eod-stat eod-stat-amber">
          <div class="eod-stat-label">معلقة</div>
          <div class="eod-stat-value">${pending}</div>
        </div>
      </div>
      <div class="eod-revenue">
        <span class="eod-revenue-label"><i class="fa-solid fa-money-bill-wave"></i> الإيرادات</span>
        <span class="eod-revenue-value">${revenue.toFixed(3)} د.ك</span>
      </div>
      ${warningHtml}
    </div>
    <div class="eod-arrow"><i class="fa-solid fa-arrow-down"></i></div>
    <div class="eod-section eod-section-next">
      <div class="eod-section-label"><i class="fa-solid fa-calendar-plus"></i> اليوم الجديد</div>
      <div class="eod-section-date">${nextLabel}</div>
    </div>
  `;

  const confirmed = await customConfirm({
    title: 'إنهاء يوم العمل (EOD)',
    body,
    confirmText: 'نعم، أنهِ اليوم',
    cancelText: 'تراجع',
    type: 'danger',
    icon: 'fa-solid fa-power-off'
  });
  if (!confirmed) return;

  // خزن EOD report في localStorage (سجل تاريخي)
  const eodHistoryKey = 'pos_eod_history';
  let history = [];
  try { history = JSON.parse(localStorage.getItem(eodHistoryKey) || '[]'); } catch (e) { history = []; }
  history.push({
    businessDate: current,
    closedAt: new Date().toISOString(),
    closedBy: AppState.currentUser ? AppState.currentUser.name : 'غير معروف',
    summary: { total, delivered, cancelled, pending, revenue }
  });
  localStorage.setItem(eodHistoryKey, JSON.stringify(history));

  // غير يوم العمل
  AppState.businessDate = next;
  localStorage.setItem(BUSINESS_DATE_KEY, AppState.businessDate);
  renderBusinessDate();

  // قفل أي تفاصيل طلب مفتوحة (تخص اليوم القديم)
  ['order-detail-container', 'all-order-detail-container', 'scheduled-order-detail-container'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = ''; el.dataset.openOrderId = ''; }
  });

  // حدث ال dashboard والـ orders
  if (typeof updateDashboardStats === 'function') updateDashboardStats();
  if (typeof renderDeliveryOrders === 'function') renderDeliveryOrders();
  if (typeof renderAllOrders === 'function') renderAllOrders();
  if (typeof renderScheduledOrders === 'function') renderScheduledOrders();

  showToast(`تم قفل يوم ${currentLabel} وبدء يوم جديد`, 'success');
}

// ==========================================
// NAVIGATION & VIEWS
// ==========================================
function showView(viewId, navItem) {
  // Update active view
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + viewId).classList.add('active');

  // Update active nav item
  if (navItem) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    navItem.classList.add('active');
  }

  AppState.activeView = viewId;

  // View specific logic
  if (viewId === 'orders') {
    renderAllOrders();
  } else if (viewId === 'reports') {
    updateDashboardStats();
  } else if (viewId === 'scheduled-orders') {
    renderScheduledOrders();
  } else if (viewId === 'items') {
    renderFullItemsView();
  } else if (viewId === 'stopped-items') {
    renderStoppedItemsView();
  }
}

function showTab(tabId, tabBtn) {
  // Hide all panels
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));

  // Show selected panel
  document.getElementById('panel-' + tabId).classList.add('active');

  // Update active tab button
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  if (tabBtn) tabBtn.classList.add('active');

  AppState.activeTab = tabId;

  // Specific tab logic
  if (tabId === 'delivery-orders') {
    const el = document.getElementById('order-detail-container');
    if (el) { el.innerHTML = ''; el.dataset.openOrderId = ''; }
  }
}

function startNewOrder() {
  showView('new-order', document.querySelector('.nav-item[data-view="new-order"]'));
  AppState.pendingOrderEvents = []; // ابدأ سجل عمليات نضيف للطلب الجديد
  clearCustomerData();
  AppState.cart = []; // فضي السلة بدون confirm
  AppState.orderNotes = '';
  AppState.editingOrderId = null;
  // امسح اختيار مصدر الطلب وطريقة الدفع وأي override للرسوم
  AppState.paymentChannel = null;
  AppState.paymentMethod = null;
  AppState.deliveryFeeOverride = null;
  if (typeof renderPaymentChannels === 'function') renderPaymentChannels();
  if (typeof renderPaymentMethods === 'function') renderPaymentMethods();
  if (typeof renderPaymentSummary === 'function') renderPaymentSummary();
  if (typeof updateOrderNotesPreview === 'function') updateOrderNotesPreview();
  if (typeof renderCart === 'function') renderCart();
  showTab('customer-data', document.querySelector('.tab-btn[data-tab="customer-data"]'));
  selectCategory('all');
  const customerNameInput = document.getElementById('cust-name');
  if (customerNameInput) customerNameInput.focus();
}

// ==========================================
// BRANCH & AREA MANAGEMENT
// ==========================================
function initBranchSelects() {
  const settingsSelect = document.getElementById('settings-branch');
  const allOrdersSelect = document.getElementById('all-filter-branch');
  const pickupBranchSelect = document.getElementById('cust-pickup-branch');
  const availabilityBranchSelect = document.getElementById('settings-availability-branch');

  let optionsHTML = '';
  AppState.branches.forEach(branch => {
    optionsHTML += `<option value="${branch.id}">${branch.name}</option>`;
  });

  if (settingsSelect) settingsSelect.innerHTML = optionsHTML;
  if (allOrdersSelect) {
    allOrdersSelect.innerHTML = `<option value="">كل الفروع</option>` + optionsHTML;
  }
  if (pickupBranchSelect) {
    pickupBranchSelect.innerHTML = `<option value="">اختر فرع الاستلام</option>` + optionsHTML;
  }
  if (availabilityBranchSelect) {
    availabilityBranchSelect.innerHTML = optionsHTML;
  }
}

function initAreaSelect() {
  const areaSelect = document.getElementById('cust-area');
  let optionsHTML = '<option value="">اختر المنطقة</option>';

  // Flatten all areas from all branches
  const allAreas = [];
  AppState.branches.forEach(branch => {
    branch.areas.forEach(area => {
      allAreas.push({ name: area, branchId: branch.id });
    });
  });

  // Sort areas alphabetically
  allAreas.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  allAreas.forEach(area => {
    optionsHTML += `<option value="${area.name}" data-branch-id="${area.branchId}">${area.name}</option>`;
  });

  areaSelect.innerHTML = optionsHTML;

  // ابني list البحث وحدث الـ display
  buildAreaComboList();
  syncAreaComboDisplay();
}

function onAreaChange() {
  const areaSelect = document.getElementById('cust-area');
  const selectedOption = areaSelect.options[areaSelect.selectedIndex];

  if (selectedOption && selectedOption.value) {
    const branchId = parseInt(selectedOption.getAttribute('data-branch-id'));
    const branch = AppState.branches.find(b => b.id === branchId);

    if (branch) {
      showToast(`تم تحديد ${branch.name} تلقائياً بناءً على المنطقة`, 'info');
    }
  }
  syncAreaComboDisplay();
  refreshMenuDisplay();
  renderCart();
}

// ==========================================
// SEARCHABLE AREA COMBOBOX (قائمة بحث المنطقة)
// ==========================================
let _areaComboHighlightIndex = -1;

function buildAreaComboList(filter = '') {
  const list = document.getElementById('area-combo-list');
  const empty = document.getElementById('area-combo-empty');
  if (!list) return;

  const areaSelect = document.getElementById('cust-area');
  const selectedValue = areaSelect ? areaSelect.value : '';
  const q = filter.trim().toLowerCase();

  let html = '';
  let count = 0;
  Array.from(areaSelect.options).forEach(opt => {
    if (!opt.value) return; // skip placeholder
    const name = opt.value;
    if (q && !name.toLowerCase().includes(q)) return;

    const branchId = parseInt(opt.getAttribute('data-branch-id'));
    const branch = AppState.branches.find(b => b.id === branchId);
    const branchName = branch ? branch.name : '';
    const isSelected = name === selectedValue;

    // Highlight matched substring
    let label = name;
    if (q) {
      const idx = name.toLowerCase().indexOf(q);
      if (idx >= 0) {
        label = name.slice(0, idx) + '<mark>' + name.slice(idx, idx + q.length) + '</mark>' + name.slice(idx + q.length);
      }
    }

    html += `
      <button type="button" class="searchable-select-option ${isSelected ? 'selected' : ''}" data-area="${name.replace(/"/g, '&quot;')}" onclick="selectAreaCombo(this.dataset.area)">
        <span>${label}</span>
        <span class="opt-branch">${branchName}</span>
      </button>
    `;
    count++;
  });

  list.innerHTML = html;
  _areaComboHighlightIndex = -1;
  if (empty) empty.classList.toggle('hidden', count !== 0);
}

function syncAreaComboDisplay() {
  // حدث ال trigger button علشان يعرض القيمة الحالية للـ select المخفي
  const areaSelect = document.getElementById('cust-area');
  const valueEl = document.getElementById('area-combo-value');
  if (!areaSelect || !valueEl) return;

  const v = areaSelect.value;
  if (v) {
    valueEl.textContent = v;
    valueEl.classList.remove('placeholder');
  } else {
    valueEl.textContent = 'اختر المنطقة';
    valueEl.classList.add('placeholder');
  }
}

function toggleAreaCombo() {
  const popup = document.getElementById('area-combo-popup');
  const wrap = document.getElementById('area-combo');
  if (!popup || !wrap) return;

  const isHidden = popup.classList.contains('hidden');
  if (isHidden) {
    openAreaCombo();
  } else {
    closeAreaCombo();
  }
}

function openAreaCombo() {
  const popup = document.getElementById('area-combo-popup');
  const wrap = document.getElementById('area-combo');
  const search = document.getElementById('area-combo-search');
  if (!popup || !wrap) return;

  if (search) search.value = '';
  buildAreaComboList('');
  popup.classList.remove('hidden');
  wrap.classList.add('open');

  // اعمل scroll للمختار لو موجود
  setTimeout(() => {
    if (search) search.focus();
    const selected = popup.querySelector('.searchable-select-option.selected');
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }, 0);

  setTimeout(() => document.addEventListener('click', handleAreaComboOutsideClick), 0);
}

function closeAreaCombo() {
  const popup = document.getElementById('area-combo-popup');
  const wrap = document.getElementById('area-combo');
  if (popup) popup.classList.add('hidden');
  if (wrap) wrap.classList.remove('open');
  document.removeEventListener('click', handleAreaComboOutsideClick);
}

function handleAreaComboOutsideClick(e) {
  const wrap = document.getElementById('area-combo');
  if (wrap && !wrap.contains(e.target)) closeAreaCombo();
}

function filterAreaCombo() {
  const search = document.getElementById('area-combo-search');
  if (!search) return;
  buildAreaComboList(search.value);
}

function selectAreaCombo(areaName) {
  const areaSelect = document.getElementById('cust-area');
  if (!areaSelect) return;
  areaSelect.value = areaName;
  // dispatch change علشان كل الـ handlers الموجودة تشتغل
  areaSelect.dispatchEvent(new Event('change', { bubbles: true }));
  syncAreaComboDisplay();
  closeAreaCombo();
}

function onAreaComboKeyDown(e) {
  const list = document.getElementById('area-combo-list');
  if (!list) return;
  const options = Array.from(list.querySelectorAll('.searchable-select-option'));

  if (e.key === 'Escape') {
    e.preventDefault();
    closeAreaCombo();
    return;
  }

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (options.length === 0) return;
    if (e.key === 'ArrowDown') {
      _areaComboHighlightIndex = Math.min(_areaComboHighlightIndex + 1, options.length - 1);
    } else {
      _areaComboHighlightIndex = Math.max(_areaComboHighlightIndex - 1, 0);
    }
    options.forEach(o => o.classList.remove('highlighted'));
    const target = options[_areaComboHighlightIndex];
    if (target) {
      target.classList.add('highlighted');
      target.scrollIntoView({ block: 'nearest' });
    }
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    let target = options[_areaComboHighlightIndex];
    // لو مفيش highlight لكن فيه نتيجة وحدة بس، اختارها
    if (!target && options.length === 1) target = options[0];
    if (target) target.click();
  }
}

function onPickupBranchChange() {
  updateCustomerInfoAddress();
  refreshMenuDisplay();
  renderCart();
}

function updateBranchUI() {
  if (AppState.currentBranch) {
    const headerBranchName = document.getElementById('header-branch-name');
    if (headerBranchName) headerBranchName.textContent = AppState.currentBranch.name;
    const settingsSelect = document.getElementById('settings-branch');
    if (settingsSelect) settingsSelect.value = AppState.currentBranch.id;

    renderSidebarDisabledPanel();
  }
}

function changeBranch(branchId) {
  const branch = AppState.branches.find(b => b.id === parseInt(branchId));
  if (branch) {
    AppState.currentBranch = branch;
    updateBranchUI();
    renderSidebarDisabledPanel();
    showToast(`تم تغيير الفرع الحالي إلى ${branch.name}`, 'success');
  }
}

function getOrderBranchId() {
  if (AppState.orderType === 'pickup') {
    const pickupSelect = document.getElementById('cust-pickup-branch');
    if (pickupSelect && pickupSelect.value) {
      return parseInt(pickupSelect.value);
    }
  } else {
    // Delivery order
    const areaSelect = document.getElementById('cust-area');
    if (areaSelect && areaSelect.selectedIndex >= 0) {
      const selectedOption = areaSelect.options[areaSelect.selectedIndex];
      if (selectedOption && selectedOption.value) {
        const branchId = selectedOption.getAttribute('data-branch-id');
        if (branchId) return parseInt(branchId);
      }
    }
  }
  // Fallback to active system branch
  return AppState.currentBranch ? AppState.currentBranch.id : 1;
}

function getResolvedOrderBranchId() {
  if (AppState.orderType === 'pickup') {
    const pickupSelect = document.getElementById('cust-pickup-branch');
    if (pickupSelect && pickupSelect.value) {
      return parseInt(pickupSelect.value);
    }
    return null;
  }

  const areaSelect = document.getElementById('cust-area');
  if (areaSelect && areaSelect.selectedIndex >= 0) {
    const selectedOption = areaSelect.options[areaSelect.selectedIndex];
    if (selectedOption && selectedOption.value) {
      const branchId = selectedOption.getAttribute('data-branch-id');
      if (branchId) return parseInt(branchId);
    }
  }

  return null;
}

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================
function searchCustomer() {
  const phoneInput = document.getElementById('customer-phone-search');
  const phone = phoneInput.value.trim();

  if (!phone) {
    showToast('الرجاء إدخال رقم الهاتف للبحث', 'warning');
    phoneInput.focus();
    return;
  }

  const customer = AppState.customers.find(c => c.phone === phone || c.phone2 === phone);

  if (customer) {
    if (!AppState.currentCustomer || AppState.currentCustomer.id !== customer.id) {
      clearCartSilently();
    }
    loadCustomerData(customer);
    showToast('تم العثور على بيانات العميل — راجع البيانات ثم اختر القائمة', 'success');

    // افتح تبويب بيانات العميل علشان الموظف يقدر يراجع البيانات أو يضيف عنوان جديد
    showTab('customer-data', document.querySelector('.tab-btn[data-tab="customer-data"]'));
  } else {
    showToast('العميل غير موجود. يرجى إضافة بياناته.', 'info');
    clearCustomerData();
    clearCartSilently();
    document.getElementById('cust-phone').value = phone;
    showTab('customer-data', document.querySelector('.tab-btn[data-tab="customer-data"]'));
    document.getElementById('cust-name').focus();
  }
}

function clearCartSilently() {
  AppState.cart = [];
  AppState.orderNotes = '';
  updateOrderNotesPreview();
  renderCart();
}

function loadCustomerData(customer) {
  AppState.currentCustomer = customer;

  // Fill base form
  document.getElementById('cust-name').value = customer.name;
  document.getElementById('cust-phone').value = customer.phone;
  document.getElementById('cust-phone2').value = customer.phone2 || '';
  document.getElementById('cust-notes').value = customer.notes || '';
  document.getElementById('cust-blacklist').checked = customer.isBlacklisted || false;

  // Handle Addresses Selection
  if (customer.addresses && customer.addresses.length > 0) {
    if (AppState.selectedAddressIndex >= 0 && AppState.selectedAddressIndex < customer.addresses.length) {
      // Keep existing index if it's within bounds
    } else {
      AppState.selectedAddressIndex = 0;
    }
    fillAddressFields(customer.addresses[AppState.selectedAddressIndex]);
  } else {
    AppState.selectedAddressIndex = -1;
    clearAddressFields();
  }
  
  renderCustomerAddresses();

  // Update Info Bar
  document.getElementById('info-name').textContent = customer.name;
  document.getElementById('info-phone').textContent = customer.phone;

  // فلاج "طلب اليوم" - لو العميل عنده طلب في يوم العمل الحالي
  updateCustomerTodayBadge(customer);

  const blacklistAlert = document.getElementById('blacklist-alert');
  if (blacklistAlert) {
    blacklistAlert.classList.toggle('hidden', !customer.isBlacklisted);
  }

  updateCustomerInfoAddress();

  // Find assigned branch based on area
  const areaOption = Array.from(document.getElementById('cust-area').options).find(opt => opt.value === customer.addresses[AppState.selectedAddressIndex]?.area || customer.addresses[0]?.area || '');
  if (areaOption) {
    const branchId = parseInt(areaOption.getAttribute('data-branch-id'));
    const branch = AppState.branches.find(b => b.id === branchId);
    if (branch) {
      document.getElementById('info-branch').textContent = branch.name;
      AppState.currentBranch = branch;
      updateBranchUI();
    }
  }

  document.getElementById('customer-info-bar').classList.remove('hidden');
  updateCartActions();
  refreshMenuDisplay();
  renderCart();
}

function renderCustomerAddresses() {
  const container = document.getElementById('customer-addresses-list');
  const group = document.getElementById('address-selector-group');
  if (!container) return;

  const customer = AppState.currentCustomer;
  if (!customer || !customer.addresses || customer.addresses.length === 0) {
    group.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  // Only show address selector group if orderType is delivery
  if (AppState.orderType === 'delivery') {
    group.style.display = 'block';
  } else {
    group.style.display = 'none';
  }

  let html = '';
  customer.addresses.forEach((addr, idx) => {
    const isSelected = idx === AppState.selectedAddressIndex;
    const selectedClass = isSelected ? 'selected' : '';
    const checkHtml = isSelected ? `<span class="address-card-check">${icon('check', { size: 12 })} نشط</span>` : '';

    html += `
      <div class="address-card ${selectedClass}" onclick="selectAddress(${idx})">
        <div class="address-card-header">
          <span class="address-card-title">عنوان #${idx + 1}</span>
          ${checkHtml}
        </div>
        <div class="address-card-details">
          ${addr.area}، ق ${addr.block}، ش ${addr.street}، مبنى ${addr.building}
          ${addr.floor ? `، ط ${addr.floor}` : ''} ${addr.apartment ? `، شقة ${addr.apartment}` : ''}
        </div>
        <button type="button" class="address-card-delete-btn" onclick="deleteAddress(${idx}, event)" title="حذف العنوان">${icon('trash', { size: 14 })}</button>
      </div>
    `;
  });

  container.innerHTML = html;
}

function selectAddress(idx) {
  AppState.selectedAddressIndex = idx;
  const customer = AppState.currentCustomer;
  if (customer && customer.addresses[idx]) {
    fillAddressFields(customer.addresses[idx]);
    renderCustomerAddresses();
  }
  refreshMenuDisplay();
  renderCart();
}

function selectNewAddressState() {
  AppState.selectedAddressIndex = -1;
  clearAddressFields();
  renderCustomerAddresses();
  showToast('يمكنك الآن كتابة تفاصيل العنوان الجديد بالأسفل وضغط حفظ البيانات ليضاف للعميل', 'info');
  document.getElementById('cust-area').focus();
  refreshMenuDisplay();
  renderCart();
}

function deleteAddress(idx, event) {
  if (event) event.stopPropagation();

  if (!confirm('هل أنت متأكد من حذف هذا العنوان من سجل العميل؟')) return;

  const customer = AppState.currentCustomer;
  if (!customer || !customer.addresses) return;

  customer.addresses.splice(idx, 1);

  // Update in global customers database
  const cIndex = AppState.customers.findIndex(c => c.id === customer.id);
  if (cIndex !== -1) {
    AppState.customers[cIndex].addresses = [...customer.addresses];
  }

  // Adjust selected index
  if (AppState.selectedAddressIndex === idx) {
    AppState.selectedAddressIndex = customer.addresses.length > 0 ? 0 : -1;
  } else if (AppState.selectedAddressIndex > idx) {
    AppState.selectedAddressIndex--;
  }

  // Reload address display
  renderCustomerAddresses();

  // If we have remaining addresses, load the selected one. Else clear fields.
  if (AppState.selectedAddressIndex !== -1 && customer.addresses[AppState.selectedAddressIndex]) {
    fillAddressFields(customer.addresses[AppState.selectedAddressIndex]);
  } else {
    clearAddressFields();
  }

  showToast('تم حذف العنوان بنجاح', 'success');
}

function updateCustomerInfoAddress() {
  const area = document.getElementById('cust-area').value;
  const block = document.getElementById('cust-block').value;
  const street = document.getElementById('cust-street').value;
  const building = document.getElementById('cust-building').value;
  const floor = document.getElementById('cust-floor').value;
  const apartment = document.getElementById('cust-apartment').value;

  const addressParts = [];
  if (area) addressParts.push(area);
  if (block) addressParts.push(`ق ${block}`);
  if (street) addressParts.push(`ش ${street}`);
  if (building) addressParts.push(`مبنى ${building}`);
  if (floor) addressParts.push(`ط ${floor}`);
  if (apartment) addressParts.push(`شقة ${apartment}`);

  document.getElementById('info-address').textContent = addressParts.length > 0 ? addressParts.join('، ') : '-';

  // لو فيه override يدوي، اعرضه واخرج
  if (AppState.branchOverrideId) {
    const overrideBranch = AppState.branches.find(b => b.id === AppState.branchOverrideId);
    document.getElementById('info-branch').textContent = overrideBranch ? overrideBranch.name : '-';
    document.getElementById('info-branch-override-tag').classList.remove('hidden');
    return;
  }

  document.getElementById('info-branch-override-tag').classList.add('hidden');

  // Update Branch Name in info bar (الفرع التلقائي)
  if (AppState.orderType === 'pickup') {
    const pickupSelect = document.getElementById('cust-pickup-branch');
    if (pickupSelect && pickupSelect.value) {
      const b = AppState.branches.find(b => b.id === parseInt(pickupSelect.value));
      document.getElementById('info-branch').textContent = b ? b.name : '-';
    } else {
      document.getElementById('info-branch').textContent = '-';
    }
  } else {
    const areaOption = Array.from(document.getElementById('cust-area').options).find(opt => opt.value === area);
    if (areaOption) {
      const branchId = parseInt(areaOption.getAttribute('data-branch-id'));
      const branch = AppState.branches.find(b => b.id === branchId);
      document.getElementById('info-branch').textContent = branch ? branch.name : '-';
    } else {
      document.getElementById('info-branch').textContent = '-';
    }
  }
}

// ==========================================
// BRANCH OVERRIDE (تغيير الفرع يدوياً للطلب الحالي)
// ==========================================
function toggleBranchOverride() {
  const menu = document.getElementById('branch-override-menu');
  const btn = document.getElementById('btn-change-branch');
  if (!menu || !btn) return;

  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    renderBranchOverrideMenu();
    menu.classList.remove('hidden');
    btn.classList.add('open');
    // اقفل لو ضغط برة
    setTimeout(() => document.addEventListener('click', handleBranchOverrideOutsideClick), 0);
  } else {
    closeBranchOverrideMenu();
  }
}

function closeBranchOverrideMenu() {
  const menu = document.getElementById('branch-override-menu');
  const btn = document.getElementById('btn-change-branch');
  if (menu) menu.classList.add('hidden');
  if (btn) btn.classList.remove('open');
  document.removeEventListener('click', handleBranchOverrideOutsideClick);
}

function handleBranchOverrideOutsideClick(e) {
  const wrap = document.querySelector('.branch-override-wrap');
  if (wrap && !wrap.contains(e.target)) {
    closeBranchOverrideMenu();
  }
}

function getAutoBranchId() {
  // الفرع التلقائي حسب نوع الطلب
  if (AppState.orderType === 'pickup') {
    const pickupSelect = document.getElementById('cust-pickup-branch');
    if (pickupSelect && pickupSelect.value) return parseInt(pickupSelect.value);
  } else {
    const areaEl = document.getElementById('cust-area');
    if (areaEl) {
      const areaOption = Array.from(areaEl.options).find(opt => opt.value === areaEl.value);
      if (areaOption) {
        const id = parseInt(areaOption.getAttribute('data-branch-id'));
        if (!isNaN(id)) return id;
      }
    }
  }
  return AppState.currentBranch ? AppState.currentBranch.id : null;
}

function renderBranchOverrideMenu() {
  const list = document.getElementById('branch-override-list');
  const resetBtn = document.getElementById('branch-override-reset');
  if (!list) return;

  const autoBranchId = getAutoBranchId();
  const activeId = AppState.branchOverrideId || autoBranchId;

  let html = '';
  AppState.branches.forEach(b => {
    const isActive = b.id === activeId;
    const isAuto = b.id === autoBranchId;
    html += `
      <button type="button" class="branch-override-option ${isActive ? 'active' : ''}" onclick="selectBranchOverride(${b.id})">
        <span>${b.name}${isAuto ? ' <span style="opacity:0.7; font-weight:500; font-size:11px;">(تلقائي)</span>' : ''}</span>
        ${isActive ? `<span class="check">${icon('check', { size: 14 })}</span>` : ''}
      </button>
    `;
  });
  list.innerHTML = html;

  // زر "رجوع للتلقائي" يظهر بس لو فيه override
  if (resetBtn) {
    resetBtn.classList.toggle('hidden', !AppState.branchOverrideId);
  }
}

function selectBranchOverride(branchId) {
  const autoBranchId = getAutoBranchId();
  // لو اختار نفس الفرع التلقائي، يبقى زي ما يكون مفيش override
  if (branchId === autoBranchId) {
    AppState.branchOverrideId = null;
  } else {
    AppState.branchOverrideId = branchId;
    const b = AppState.branches.find(x => x.id === branchId);
    if (b) showToast(`تم تحويل الطلب إلى ${b.name}`, 'success');
  }
  updateCustomerInfoAddress();
  closeBranchOverrideMenu();
}

function resetBranchOverride() {
  AppState.branchOverrideId = null;
  updateCustomerInfoAddress();
  closeBranchOverrideMenu();
  showToast('تم الرجوع للفرع التلقائي', 'info');
}

function fillAddressFields(addr) {
  document.getElementById('cust-area').value = addr.area || '';
  document.getElementById('cust-block').value = addr.block || '';
  document.getElementById('cust-street').value = addr.street || '';
  document.getElementById('cust-building').value = addr.building || '';
  document.getElementById('cust-floor').value = addr.floor || '';
  document.getElementById('cust-apartment').value = addr.apartment || '';
  if (typeof syncAreaComboDisplay === 'function') syncAreaComboDisplay();
  updateCustomerInfoAddress();
}

function clearAddressFields() {
  document.getElementById('cust-area').value = '';
  document.getElementById('cust-block').value = '';
  document.getElementById('cust-street').value = '';
  document.getElementById('cust-building').value = '';
  document.getElementById('cust-floor').value = '';
  document.getElementById('cust-apartment').value = '';
  if (typeof syncAreaComboDisplay === 'function') syncAreaComboDisplay();
  updateCustomerInfoAddress();
}

function showNewCustomerForm() {
  clearCustomerData();
  showTab('customer-data', document.querySelector('.tab-btn[data-tab="customer-data"]'));
  document.getElementById('cust-name').focus();
}

function updateCustomerTodayBadge(customer) {
  const badge = document.getElementById('info-customer-today');
  const countEl = document.getElementById('info-customer-today-count');
  const nameEl = document.getElementById('info-name');
  if (!badge || !nameEl) return;

  if (!customer) {
    badge.classList.add('hidden');
    nameEl.classList.remove('info-name-today');
    return;
  }

  const bd = AppState.businessDate || todayISO();
  // اعد كل طلبات العميل في يوم العمل الحالي (شامل الملغية)
  const todayOrders = AppState.orders.filter(o =>
    o.customerId === customer.id &&
    (o.businessDate || (o.createdAt || '').slice(0, 10)) === bd
  );

  if (todayOrders.length > 0) {
    badge.classList.remove('hidden');
    if (countEl) countEl.textContent = todayOrders.length;
    nameEl.classList.add('info-name-today');
    badge.title = `هذا العميل طلب ${todayOrders.length} مرة في يوم العمل الحالي`;
  } else {
    badge.classList.add('hidden');
    nameEl.classList.remove('info-name-today');
  }
}

function clearCustomerData() {
  AppState.currentCustomer = null;
  AppState.selectedAddressIndex = -1;
  AppState.branchOverrideId = null; // امسح override الفرع لو موجود
  const overrideTag = document.getElementById('info-branch-override-tag');
  if (overrideTag) overrideTag.classList.add('hidden');
  updateCustomerTodayBadge(null);
  document.getElementById('customer-form').reset();
  clearAddressFields();
  const pickupSelect = document.getElementById('cust-pickup-branch');
  if (pickupSelect) pickupSelect.value = '';
  document.getElementById('customer-info-bar').classList.add('hidden');
  document.getElementById('address-selector-group').style.display = 'none';
  document.getElementById('customer-phone-search').value = '';
  const blacklistAlert = document.getElementById('blacklist-alert');
  if (blacklistAlert) blacklistAlert.classList.add('hidden');
  updateCartActions();
  refreshMenuDisplay();
  renderCart();
}

function cancelCustomerForm() {
  if (AppState.currentCustomer) {
    // Revert to current customer data
    loadCustomerData(AppState.currentCustomer);
  } else {
    // Clear everything
    clearCustomerData();
  }
}

function saveCustomer() {
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const area = document.getElementById('cust-area').value;

  // Basic validation
  if (!name || !phone) {
    showToast('يرجى تعبئة الحقول الأساسية: الاسم ورقم الموبايل', 'error');
    return;
  }
  
  if (AppState.orderType === 'delivery' && !area) {
    showToast('يرجى تعبئة الحقول الأساسية: الاسم، رقم الموبايل، والمنطقة', 'error');
    return;
  }

  const customerData = {
    name,
    phone,
    phone2: document.getElementById('cust-phone2').value.trim(),
    notes: document.getElementById('cust-notes').value.trim(),
    isBlacklisted: document.getElementById('cust-blacklist').checked,
    addresses: []
  };
  
  const currentAddress = {
    id: Date.now(),
    area,
    block: document.getElementById('cust-block').value.trim(),
    street: document.getElementById('cust-street').value.trim(),
    building: document.getElementById('cust-building').value.trim(),
    floor: document.getElementById('cust-floor').value.trim(),
    apartment: document.getElementById('cust-apartment').value.trim()
  };

  if (AppState.currentCustomer) {
    customerData.id = AppState.currentCustomer.id;
    customerData.createdAt = AppState.currentCustomer.createdAt;
    customerData.addresses = [...(AppState.currentCustomer.addresses || [])];
    
    // Check if modifying an existing address or adding new (only if area exists)
    if (area) {
      const idx = AppState.selectedAddressIndex;
      if (idx !== -1 && customerData.addresses[idx]) {
        // Update existing address
        customerData.addresses[idx] = { ...customerData.addresses[idx], ...currentAddress, id: customerData.addresses[idx].id };
      } else {
        // Add new address
        customerData.addresses.push(currentAddress);
        AppState.selectedAddressIndex = customerData.addresses.length - 1; // Auto-select the newly added address
      }
    }
    
    const index = AppState.customers.findIndex(c => c.id === AppState.currentCustomer.id);
    if (index !== -1) {
      AppState.customers[index] = customerData;
    }
    showToast('تم تحديث بيانات العميل بنجاح', 'success');
  } else {
    customerData.id = Date.now();
    customerData.createdAt = new Date().toISOString();
    if (area) {
      customerData.addresses.push(currentAddress);
      AppState.selectedAddressIndex = 0;
    } else {
      AppState.selectedAddressIndex = -1;
    }
    AppState.customers.push(customerData);
    showToast('تم إضافة العميل بنجاح', 'success');
  }

  loadCustomerData(customerData);

  // Switch to menu tab to start ordering
  setTimeout(() => {
    showTab('menu', document.querySelector('.tab-btn[data-tab="menu"]'));
    showAllCategories();
  }, 500);
}

// ==========================================
// MENU MANAGEMENT
// ==========================================
function renderMenuCategories() {
  const container = document.getElementById('menu-categories');
  const isEn = window.currentLang === 'en';
  let html = '';

  AppState.menuCategories.forEach(cat => {
    // الصورة: imageUrl الخارجي (Unsplash) أو ملف محلي assets/images/<id>.png لو متوفر
    const imgSrc = cat.imageUrl || `assets/images/${cat.id}.png`;
    const hasImage = cat.id !== 'all'; // كارت "عرض الكل" يستخدم الإيموجي بدل صورة

    html += `
      <div class="category-card" data-id="${cat.id}" onclick="selectCategory('${cat.id}')">
        ${hasImage ?
          `<div class="category-card-img">
             <img src="${imgSrc}" alt="${cat.name}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'category-card-icon\\' style=\\'color:${cat.color}\\'>${cat.icon}</div>';">
           </div>` :
          `<div class="category-card-icon" style="color:${cat.color}">${cat.icon}</div>`
        }
        <div class="category-card-info">
          <div class="category-card-name">${isEn ? (cat.nameEn || cat.name) : cat.name}</div>
          <div class="category-card-name-en">${isEn ? cat.name : (cat.nameEn || '')}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function selectCategory(categoryId) {
  const isEn = window.currentLang === 'en';
  // Update active state
  document.querySelectorAll('.category-card').forEach(el => el.classList.remove('active'));
  const selectedCard = document.querySelector(`.category-card[data-id="${categoryId}"]`);
  if (selectedCard) selectedCard.classList.add('active');

  // Filter items
  let itemsToShow = [];
  if (categoryId === 'all') {
    itemsToShow = AppState.menuItems;
    document.getElementById('menu-items-title').textContent = isEn ? 'All Items' : 'جميع الأصناف';
  } else {
    itemsToShow = AppState.menuItems.filter(item => item.categoryId === categoryId);
    const category = AppState.menuCategories.find(c => c.id === categoryId);
    document.getElementById('menu-items-title').textContent = category ? (isEn ? (category.nameEn || category.name) : category.name) : (isEn ? 'Items' : 'الأصناف');
  }

  renderMenuItems(itemsToShow);

  // Show items page only, hide category grid
  document.getElementById('menu-categories').classList.add('hidden');
  document.getElementById('menu-items-section').classList.remove('hidden');
}

function showAllCategories() {
  const isEn = window.currentLang === 'en';
  document.getElementById('menu-categories').classList.remove('hidden');
  document.getElementById('menu-items-section').classList.add('hidden');
  document.querySelectorAll('.category-card').forEach(el => el.classList.remove('active'));
  document.getElementById('menu-search-input').value = '';
  document.getElementById('menu-items-title').textContent = isEn ? 'All Items' : 'جميع الأصناف';
}

function renderMenuItems(items) {
  const container = document.getElementById('menu-items');
  const isEn = window.currentLang === 'en';
  if (items.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">${isEn ? 'No items in this category' : 'لا توجد أصناف في هذا التصنيف'}</div>`;
    return;
  }

  const orderBranchId = getResolvedOrderBranchId();
  const disabledItems = orderBranchId ? (AppState.disabledBranchItems[orderBranchId] || []) : [];

  let html = '';
  items.forEach(item => {
    const category = AppState.menuCategories.find(c => c.id === item.categoryId);
    const catColor = category ? category.color : '#6b7280';
    const catName = category ? (isEn ? (category.nameEn || category.name) : category.name) : '';

    const isDisabled = disabledItems.includes(item.id);
    const disabledClass = isDisabled ? 'menu-item-disabled' : '';

    const hasMultipleSizes = item.sizes && item.sizes.length > 0;
    const priceHtml = hasMultipleSizes
      ? `<div class="menu-item-price menu-item-price-sized"><i class="fa-solid fa-layer-group"></i> ${isEn ? 'Choose size' : 'حسب الحجم'}</div>`
      : `<div class="menu-item-price">${formatCurrency(item.price)}</div>`;

    html += `
      <div class="menu-item-card ${disabledClass}" onclick="openItemModal(${item.id})" style="--cat-color:${catColor};">
        <div class="menu-item-cat-tag">${catName}</div>
        <div class="menu-item-name">${isEn ? (item.nameEn || item.name) : item.name}</div>
        <div class="menu-item-name-en">${isEn ? item.name : (item.nameEn || '')}</div>
        ${priceHtml}
      </div>
    `;
  });

  container.innerHTML = html;
}

function filterMenuItems(query) {
  if (!query) {
    selectCategory('all');
    return;
  }

  query = query.toLowerCase();
  const filtered = AppState.menuItems.filter(item =>
    item.name.toLowerCase().includes(query) ||
    item.nameEn.toLowerCase().includes(query)
  );

  document.getElementById('menu-categories').classList.remove('hidden');
  document.getElementById('menu-items-section').classList.remove('hidden');
  document.getElementById('menu-items-title').textContent = 'نتائج البحث';

  renderMenuItems(filtered);
}

function refreshMenuDisplay() {
  const menuItemsSection = document.getElementById('menu-items-section');
  if (menuItemsSection && !menuItemsSection.classList.contains('hidden')) {
    const activeCatCard = document.querySelector('.category-card.active');
    const activeCatId = activeCatCard ? activeCatCard.getAttribute('data-id') : 'all';
    const searchVal = document.getElementById('menu-search-input').value.trim();
    if (searchVal) {
      filterMenuItems(searchVal);
    } else {
      selectCategory(activeCatId);
    }
  }
}

// ==========================================
// ITEM MODAL (ADD TO CART)
// ==========================================
function openItemModal(itemId, cartItemId) {
  const item = AppState.menuItems.find(i => i.id === itemId);
  if (!item) return;

  // Check if item is disabled in the active branch of the order
  const orderBranchId = getResolvedOrderBranchId();
  const disabledItems = orderBranchId ? (AppState.disabledBranchItems[orderBranchId] || []) : [];
  if (orderBranchId && disabledItems.includes(item.id)) {
    const branch = AppState.branches.find(b => b.id === orderBranchId);
    const branchName = branch ? branch.name : 'هذا الفرع';
    showToast(`عذراً، ${item.name} غير متوفر حالياً في ${branchName}`, 'error');
    return;
  }

  // لو في وضع تعديل - جيب الصنف الموجود من السلة
  const editingCartItem = cartItemId ? AppState.cart.find(ci => ci.cartItemId === cartItemId) : null;
  AppState.editingCartItemId = editingCartItem ? cartItemId : null;

  AppState.selectedMenuItem = item;
  if (editingCartItem) {
    // Pre-fill من الصنف الموجود
    AppState.selectedSize = editingCartItem.size || (item.sizes ? item.sizes[0] : null);
    AppState.selectedExtras = (editingCartItem.extras || [])
      .map(exName => (typeof EXTRAS !== 'undefined') ? EXTRAS.find(e => e.name === exName) : null)
      .filter(Boolean);
  } else {
    AppState.selectedExtras = [];
    AppState.selectedSize = item.sizes ? item.sizes[0] : null;
  }

  const category = AppState.menuCategories.find(c => c.id === item.categoryId);
  const catIcon = category ? category.icon : '🍽️';

  let sizesHtml = '';
  if (item.sizes && item.sizes.length > 0) {
    sizesHtml = `
      <h4 style="margin-bottom: 10px; font-size: 14px;">اختر الحجم</h4>
      <div class="size-options">
        ${item.sizes.map((size, index) => {
          const isSelected = size === AppState.selectedSize;
          return `
          <div class="size-option ${isSelected ? 'selected' : ''}" onclick="selectItemSize('${size}', ${item.sizePrices[index]}, this)">
            <div class="size-option-name">${size}</div>
            <div class="size-option-price">${formatCurrency(item.sizePrices[index])}</div>
          </div>
        `;}).join('')}
      </div>
    `;
  }

  // Generate extras list (collapsible) - علم المختار بـ selected
  const selectedExtraIds = AppState.selectedExtras.map(e => e.id);
  const hasSelectedExtras = selectedExtraIds.length > 0;
  let extrasHtml = `
    <div class="modal-collapse ${hasSelectedExtras ? 'open' : ''}" id="modal-collapse-extras">
      <button type="button" class="modal-collapse-toggle" onclick="toggleModalSection('extras')">
        <span class="modal-collapse-title">
          <i class="fa-solid fa-plus modal-collapse-icon"></i>
          إضافات (اختياري)
        </span>
        <span class="modal-collapse-summary" id="modal-extras-summary">اضغط للاختيار</span>
        <i class="fa-solid fa-chevron-down modal-collapse-chev"></i>
      </button>
      <div class="modal-collapse-body">
        <div class="extras-list">
          ${EXTRAS.map(extra => {
            const isSelected = selectedExtraIds.includes(extra.id);
            return `
            <div class="extra-item ${isSelected ? 'selected' : ''}" onclick="toggleExtra(${extra.id}, this)">
              <div class="extra-item-info">
                <div class="extra-checkbox">${isSelected ? icon('check', { size: 12 }) : ''}</div>
                <span class="extra-item-name">${extra.name}</span>
              </div>
              <span class="extra-item-price">${extra.price > 0 ? '+' + formatCurrency(extra.price) : 'مجاناً'}</span>
            </div>
          `;}).join('')}
        </div>
      </div>
    </div>
  `;

  // Item note (collapsible)
  let noteHtml = `
    <div class="modal-collapse" id="modal-collapse-note">
      <button type="button" class="modal-collapse-toggle" onclick="toggleModalSection('note')">
        <span class="modal-collapse-title">
          <i class="fa-solid fa-pen modal-collapse-icon"></i>
          ملاحظات الصنف
        </span>
        <span class="modal-collapse-summary" id="modal-note-summary">اضغط للكتابة</span>
        <i class="fa-solid fa-chevron-down modal-collapse-chev"></i>
      </button>
      <div class="modal-collapse-body">
        <textarea id="modal-item-note" placeholder="مثال: بدون سكر، زيادة ثلج..." oninput="onModalNoteInput()" style="width:100%; border:1px solid var(--border); border-radius:8px; padding:10px; font-family:inherit; min-height:70px; resize:vertical;"></textarea>
      </div>
    </div>
  `;

  const isEditing = !!editingCartItem;
  const modalTitle = isEditing ? 'تعديل الصنف' : 'إضافة للطلب';
  const submitBtnLabel = isEditing ? 'حفظ التعديل' : 'إضافة للسلة';
  const initialQty = isEditing ? (editingCartItem.quantity || 1) : 1;
  const initialNote = isEditing ? (editingCartItem.note || '') : '';

  const modalHtml = `
    <div class="modal-header">
      <h3 class="modal-title">${modalTitle}</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="item-modal-header">
        <div class="item-modal-name">${item.name}</div>
        <div class="item-modal-name-en">${item.nameEn || ''}</div>
        <div class="item-modal-price" id="modal-total-price">${formatCurrency(item.sizes ? item.sizePrices[0] : item.price)}</div>
        <p style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">${item.description}</p>
      </div>

      ${sizesHtml}
      ${extrasHtml}
      ${noteHtml}

      <div style="margin-top: 20px;">
        <h4 style="margin-bottom: 10px; font-size: 14px;">الكمية</h4>
        <div class="qty-control" style="width: 120px; margin: 0 auto;">
          <button type="button" class="qty-btn" onclick="updateModalQty(-1)">-</button>
          <div class="qty-value" id="modal-qty">${initialQty}</div>
          <button type="button" class="qty-btn" onclick="updateModalQty(1)">+</button>
        </div>
      </div>
    </div>
    <div class="modal-footer" style="justify-content: space-between;">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" style="flex: 1; max-width: 200px;" onclick="addToCart()">
        ${submitBtnLabel}
      </button>
    </div>
  `;

  document.getElementById('modal-content').innerHTML = modalHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');

  // ملأ الملاحظة لو في وضع تعديل، وحدّث ملخص الملاحظات
  if (initialNote) {
    const noteTa = document.getElementById('modal-item-note');
    if (noteTa) {
      noteTa.value = initialNote;
      // افتح قسم الملاحظات علشان الموظف يشوفها فوراً
      const noteCollapse = document.getElementById('modal-collapse-note');
      if (noteCollapse) noteCollapse.classList.add('open');
      if (typeof onModalNoteInput === 'function') onModalNoteInput();
    }
  }
  if (isEditing && typeof updateExtrasSummary === 'function') updateExtrasSummary();
  if (typeof updateModalPrice === 'function') updateModalPrice();
}

function selectItemSize(size, price, el) {
  AppState.selectedSize = size;
  document.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('selected'));
  el.classList.add('selected');
  updateModalPrice();
}

function toggleExtra(extraId, el) {
  const extra = EXTRAS.find(e => e.id === extraId);
  if (!extra) return;

  const index = AppState.selectedExtras.findIndex(e => e.id === extraId);
  if (index > -1) {
    AppState.selectedExtras.splice(index, 1);
    el.classList.remove('selected');
    el.querySelector('.extra-checkbox').textContent = '';
  } else {
    AppState.selectedExtras.push(extra);
    el.classList.add('selected');
    el.querySelector('.extra-checkbox').innerHTML = icon('check', { size: 12 });
  }
  updateExtrasSummary();
  updateModalPrice();
}

function toggleModalSection(sectionKey) {
  const collapse = document.getElementById(`modal-collapse-${sectionKey}`);
  if (!collapse) return;
  collapse.classList.toggle('open');
  // لو الفتح خالص، ركّز على الـ textarea لو ملاحظات
  if (collapse.classList.contains('open') && sectionKey === 'note') {
    setTimeout(() => {
      const ta = document.getElementById('modal-item-note');
      if (ta) ta.focus();
    }, 200);
  }
}

function updateExtrasSummary() {
  const summary = document.getElementById('modal-extras-summary');
  if (!summary) return;
  const count = AppState.selectedExtras.length;
  if (count === 0) {
    summary.textContent = 'اضغط للاختيار';
    summary.classList.remove('has-value');
  } else {
    const extrasPrice = AppState.selectedExtras.reduce((sum, e) => sum + e.price, 0);
    summary.innerHTML = `<strong>${count}</strong> ${count === 1 ? 'إضافة' : 'إضافات'} • +${extrasPrice.toFixed(3)} د.ك`;
    summary.classList.add('has-value');
  }
}

function onModalNoteInput() {
  const ta = document.getElementById('modal-item-note');
  const summary = document.getElementById('modal-note-summary');
  if (!ta || !summary) return;
  const val = ta.value.trim();
  if (val) {
    const short = val.length > 30 ? val.slice(0, 30) + '…' : val;
    summary.textContent = short;
    summary.classList.add('has-value');
  } else {
    summary.textContent = 'اضغط للكتابة';
    summary.classList.remove('has-value');
  }
}

function updateModalQty(change) {
  const qtyEl = document.getElementById('modal-qty');
  let qty = parseInt(qtyEl.textContent) + change;
  if (qty < 1) qty = 1;
  if (qty > 50) qty = 50;
  qtyEl.textContent = qty;
  updateModalPrice();
}

function updateModalPrice() {
  const item = AppState.selectedMenuItem;
  if (!item) return;

  let basePrice = item.price;
  if (AppState.selectedSize && item.sizes) {
    const sizeIndex = item.sizes.indexOf(AppState.selectedSize);
    if (sizeIndex > -1) basePrice = item.sizePrices[sizeIndex];
  }

  const extrasPrice = AppState.selectedExtras.reduce((sum, extra) => sum + extra.price, 0);
  const qty = parseInt(document.getElementById('modal-qty').textContent);

  const total = (basePrice + extrasPrice) * qty;
  document.getElementById('modal-total-price').textContent = formatCurrency(total);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  AppState.selectedMenuItem = null;
  AppState.editingCartItemId = null;
}

function closeModalOnOverlay(e) {
  if (e.target.id === 'modal-overlay') {
    closeModal();
  }
}

// ==========================================
// CUSTOM CONFIRM (بدلاً من confirm() المتصفح)
// ==========================================
/**
 * يفتح مودال تأكيد مخصص ويرجع Promise بـ true/false
 * opts: { title, body, confirmText, cancelText, type, icon }
 *   - type: 'danger' | 'primary' | 'warning'
 *   - icon: اسم FA أيقونة اختياري (مثلاً 'fa-solid fa-triangle-exclamation')
 */
function customConfirm(opts = {}) {
  const {
    title = 'تأكيد',
    body = '',
    confirmText = 'تأكيد',
    cancelText = 'إلغاء',
    type = 'primary',
    icon = null
  } = opts;

  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (!overlay || !content) {
      // fallback لو الـ DOM مش جاهز لأي سبب
      resolve(window.confirm(title));
      return;
    }

    const iconHtml = icon ? `<div class="cc-icon cc-icon-${type}"><i class="${icon}"></i></div>` : '';

    content.innerHTML = `
      <div class="modal-header cc-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" data-cc-action="cancel" type="button">×</button>
      </div>
      <div class="modal-body cc-body">
        ${iconHtml}
        <div class="cc-content">${body}</div>
      </div>
      <div class="modal-footer cc-footer">
        <button class="btn btn-secondary cc-btn" data-cc-action="cancel" type="button">${cancelText}</button>
        <button class="btn btn-${type} cc-btn cc-btn-primary" data-cc-action="confirm" type="button">${confirmText}</button>
      </div>
    `;

    const cleanup = (result) => {
      content.removeEventListener('click', handler);
      document.removeEventListener('keydown', keyHandler);
      overlay.classList.add('hidden');
      resolve(result);
    };

    const handler = (e) => {
      const target = e.target.closest('[data-cc-action]');
      if (!target) return;
      cleanup(target.dataset.ccAction === 'confirm');
    };

    const keyHandler = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };

    content.addEventListener('click', handler);
    document.addEventListener('keydown', keyHandler);
    overlay.classList.remove('hidden');

    // ركّز على زرار التأكيد
    setTimeout(() => {
      const focusBtn = content.querySelector('[data-cc-action="confirm"]');
      if (focusBtn) focusBtn.focus();
    }, 0);
  });
}

// ==========================================
// CART MANAGEMENT
// ==========================================
function logPendingEvent(evt) {
  if (!AppState.pendingOrderEvents) AppState.pendingOrderEvents = [];
  AppState.pendingOrderEvents.push({
    at: new Date().toISOString(),
    by: AppState.currentUser ? AppState.currentUser.name : 'موظف',
    ...evt
  });
}

function addToCart() {
  const item = AppState.selectedMenuItem;
  if (!item) return;

  const qty = parseInt(document.getElementById('modal-qty').textContent);

  let basePrice = item.price;
  if (AppState.selectedSize && item.sizes) {
    const sizeIndex = item.sizes.indexOf(AppState.selectedSize);
    if (sizeIndex > -1) basePrice = item.sizePrices[sizeIndex];
  }

  const extrasPrice = AppState.selectedExtras.reduce((sum, extra) => sum + extra.price, 0);
  const unitPrice = basePrice + extrasPrice;
  const itemNote = document.getElementById('modal-item-note').value.trim();

  // اوصاف مختصرة للصنف (الحجم + الإضافات) للظهور في سجل العمليات
  const itemDescParts = [];
  if (AppState.selectedSize) itemDescParts.push(`حجم ${AppState.selectedSize}`);
  if (AppState.selectedExtras.length > 0) itemDescParts.push('إضافات: ' + AppState.selectedExtras.map(e => e.name).join('، '));
  const itemDesc = itemDescParts.join(' • ');

  // ===== وضع تعديل: عدّل الصنف الموجود في السلة بدل ما تضيف جديد =====
  if (AppState.editingCartItemId) {
    const idx = AppState.cart.findIndex(ci => ci.cartItemId === AppState.editingCartItemId);
    if (idx > -1) {
      const oldItem = { ...AppState.cart[idx] };
      AppState.cart[idx] = {
        ...AppState.cart[idx],
        size: AppState.selectedSize,
        quantity: qty,
        price: unitPrice,
        extras: AppState.selectedExtras.map(e => e.name),
        extrasPrice: extrasPrice,
        note: itemNote
      };
      // سجل التعديل
      const changes = [];
      if (oldItem.size !== AppState.selectedSize) changes.push(`الحجم من ${oldItem.size || '-'} إلى ${AppState.selectedSize || '-'}`);
      if (oldItem.quantity !== qty) changes.push(`الكمية من ${oldItem.quantity} إلى ${qty}`);
      if ((oldItem.note || '') !== itemNote) changes.push(`الملاحظة من "${oldItem.note || '(بدون)'}" إلى "${itemNote || '(بدون)'}"`);
      const oldExtras = (oldItem.extras || []).sort().join(',');
      const newExtras = AppState.selectedExtras.map(e => e.name).sort().join(',');
      if (oldExtras !== newExtras) changes.push(`الإضافات: ${newExtras || '(بدون)'}`);

      logPendingEvent({
        type: 'item_edited',
        itemName: item.name,
        itemDesc,
        note: changes.length > 0
          ? `تعديل ${item.name}: ${changes.join(' • ')}`
          : `فتح ${item.name} للتعديل بدون تغييرات`
      });
    }
    AppState.editingCartItemId = null;
    closeModal();
    renderCart();
    showToast(`تم تعديل ${item.name}`, 'success');
    return;
  }

  // ===== وضع إضافة جديد =====
  // Check if identical item already in cart (same size, same extras, same note)
  const extrasNames = AppState.selectedExtras.map(e => e.name).sort().join(',');

  const existingItemIndex = AppState.cart.findIndex(cartItem =>
    cartItem.itemId === item.id &&
    cartItem.size === AppState.selectedSize &&
    cartItem.extras.sort().join(',') === extrasNames &&
    cartItem.note === itemNote
  );

  if (existingItemIndex > -1) {
    const prevQty = AppState.cart[existingItemIndex].quantity;
    AppState.cart[existingItemIndex].quantity += qty;
    logPendingEvent({
      type: 'item_added',
      itemName: item.name,
      itemDesc,
      qtyAdded: qty,
      newQty: AppState.cart[existingItemIndex].quantity,
      note: `إضافة ${qty} × ${item.name}${itemDesc ? ' (' + itemDesc + ')' : ''} — الكمية أصبحت ${AppState.cart[existingItemIndex].quantity}`
    });
  } else {
    AppState.cart.push({
      cartItemId: Date.now().toString(),
      itemId: item.id,
      name: item.name,
      size: AppState.selectedSize,
      quantity: qty,
      price: unitPrice,
      extras: AppState.selectedExtras.map(e => e.name),
      extrasPrice: extrasPrice,
      note: itemNote
    });
    logPendingEvent({
      type: 'item_added',
      itemName: item.name,
      itemDesc,
      qtyAdded: qty,
      newQty: qty,
      note: `إضافة ${qty} × ${item.name}${itemDesc ? ' (' + itemDesc + ')' : ''}`
    });
  }

  closeModal();
  renderCart();
  showToast(`تم إضافة ${item.name} للسلة`, 'success');

  // Flash cart panel
  const cartPanel = document.getElementById('cart-panel');
  cartPanel.style.boxShadow = 'inset 0 0 0 2px var(--primary)';
  setTimeout(() => { cartPanel.style.boxShadow = ''; }, 300);
}

function updateCartItemQty(cartItemId, change) {
  const itemIndex = AppState.cart.findIndex(i => i.cartItemId === cartItemId);
  if (itemIndex === -1) return;

  const item = AppState.cart[itemIndex];
  const prevQty = item.quantity;
  item.quantity += change;

  if (item.quantity < 1) {
    AppState.cart.splice(itemIndex, 1);
    logPendingEvent({
      type: 'item_removed',
      itemName: item.name,
      note: `حذف صنف: ${item.name}`
    });
  } else {
    logPendingEvent({
      type: change > 0 ? 'item_qty_up' : 'item_qty_down',
      itemName: item.name,
      prevQty,
      newQty: item.quantity,
      note: `${change > 0 ? 'زيادة' : 'تقليل'} كمية ${item.name}: ${prevQty} → ${item.quantity}`
    });
  }

  renderCart();
}

function clearCart() {
  if (AppState.cart.length === 0) return;

  if (confirm('هل أنت متأكد من مسح جميع الأصناف من السلة؟')) {
    const itemsCount = AppState.cart.length;
    AppState.cart = [];
    AppState.orderNotes = '';
    logPendingEvent({
      type: 'cart_cleared',
      note: `تم تفريغ السلة (${itemsCount} صنف)`
    });
    updateOrderNotesPreview();
    renderCart();
  }
}

function updateOrderNotesPreview() {
  const preview = document.getElementById('order-notes-preview');
  if (!preview) return;
  preview.textContent = AppState.orderNotes ? AppState.orderNotes : 'لا توجد ملاحظات';
}

function openOrderNotesModal() {
  const modalHtml = `
    <div class="modal-header">
      <h3 class="modal-title">ملاحظات هامة على الطلب</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <textarea id="order-notes-input" class="order-notes-modal-textarea" placeholder="اكتب الملاحظة هنا...">${AppState.orderNotes || ''}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveOrderNotes()">حفظ الملاحظة</button>
    </div>
  `;

  document.getElementById('modal-content').innerHTML = modalHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => {
    const input = document.getElementById('order-notes-input');
    if (input) input.focus();
  }, 0);
}

function saveOrderNotes() {
  const input = document.getElementById('order-notes-input');
  AppState.orderNotes = input ? input.value.trim() : '';
  updateOrderNotesPreview();
  closeModal();
}

function setOrderType(type) {
  AppState.orderType = type;
  const deliveryCard = document.querySelector('.btn-type-delivery');
  const pickupCard = document.querySelector('.btn-type-pickup');

  [deliveryCard, pickupCard].forEach(card => {
    if (!card) return;
    card.classList.remove('active');
    card.style.opacity = '1';
  });

  const pickupGroup = document.getElementById('pickup-branch-group');
  const addressSelectorGroup = document.getElementById('address-selector-group');

  if (type === 'delivery') {
    if (deliveryCard) deliveryCard.classList.add('active');
    if (pickupGroup) pickupGroup.style.display = 'none';
    // Show address fields
    ['cust-area', 'cust-block', 'cust-street', 'cust-building', 'cust-floor', 'cust-apartment'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement) el.parentElement.style.display = 'flex';
    });
  } else {
    if (pickupCard) pickupCard.classList.add('active');
    if (pickupGroup) pickupGroup.style.display = 'block';
    // Hide address fields
    ['cust-area', 'cust-block', 'cust-street', 'cust-building', 'cust-floor', 'cust-apartment'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement) el.parentElement.style.display = 'none';
    });
  }
  
  // Re-render address selector cards
  renderCustomerAddresses();
  
  // Also update the customer info branch display
  updateCustomerInfoAddress();
  
  calculateCartTotals();
}

// ==========================================
// PAYMENT (مصدر الطلب × طريقة الدفع)
// ==========================================
function getPaymentLabel(channelId, methodId) {
  const ch = (typeof PAYMENT_CHANNELS !== 'undefined') ? PAYMENT_CHANNELS.find(c => c.id === channelId) : null;
  const m  = (typeof PAYMENT_METHODS  !== 'undefined') ? PAYMENT_METHODS.find(x => x.id === methodId)  : null;
  const chLabel = ch ? ch.name : channelId;
  const mLabel  = m  ? m.name  : methodId;
  return `${chLabel}  •  ${mLabel}`;
}

function updatePaymentButton() {
  // الزرار في السلة بيعرض الاختيار الحالي أو نص افتراضي
  const btn = document.getElementById('btn-payment-picker');
  const title = document.getElementById('bpp-title');
  const sub = document.getElementById('bpp-sub');
  if (!btn || !title || !sub) return;

  if (AppState.paymentChannel && AppState.paymentMethod) {
    const ch = PAYMENT_CHANNELS.find(c => c.id === AppState.paymentChannel);
    const m  = PAYMENT_METHODS.find(x => x.id === AppState.paymentMethod);
    const chVisual = ch && ch.logo
      ? `<span class="bpp-channel-mini-logo">${ch.logo}</span>`
      : (ch ? `<i class="${ch.icon}" style="color:${ch.color || 'currentColor'};"></i>` : '');
    title.innerHTML = ch ? `${chVisual} ${ch.name}` : '';
    sub.innerHTML = m ? `<i class="${m.icon}" style="color:${m.color || 'currentColor'};"></i> ${m.name}` : '';
    btn.classList.add('is-selected');
  } else {
    title.textContent = 'طريقة الدفع';
    sub.textContent = 'اضغط للاختيار';
    btn.classList.remove('is-selected');
  }
}

function openPaymentModal() {
  const modalHtml = `
    <div class="modal-header">
      <h3 class="modal-title">طريقة الدفع</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="padding:18px 22px;">
      <div class="pm-step">
        <div class="pm-step-label"><span class="pm-step-num">1</span> اختر المصدر</div>
        <div class="pm-channels" id="pm-channels"></div>
      </div>
      <div class="pm-step pm-step-methods" id="pm-step-methods" style="display:none;">
        <div class="pm-step-label"><span class="pm-step-num">2</span> اختر طريقة الدفع</div>
        <div class="pm-methods" id="pm-methods"></div>
      </div>
      <div class="pm-summary hidden" id="pm-summary">
        <span class="pm-summary-icon">${icon('check', { size: 14 })}</span>
        <span class="pm-summary-text" id="pm-summary-text"></span>
      </div>
    </div>
    <div class="modal-footer" style="justify-content: space-between;">
      <button class="btn btn-secondary" onclick="resetPaymentSelection()">إعادة تعيين</button>
      <button class="btn btn-primary" id="pm-confirm-btn" onclick="confirmPaymentSelection()" disabled>تأكيد</button>
    </div>
  `;
  document.getElementById('modal-content').innerHTML = modalHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
  renderModalChannels();
  renderModalMethods();
  renderModalSummary();
}

function renderModalChannels() {
  const container = document.getElementById('pm-channels');
  if (!container || typeof PAYMENT_CHANNELS === 'undefined') return;
  container.innerHTML = PAYMENT_CHANNELS.map(ch => {
    const isActive = AppState.paymentChannel === ch.id;
    const iconColor = isActive ? '#fff' : (ch.color || 'var(--primary)');
    const visual = ch.logo
      ? `<span class="pm-channel-logo">${ch.logo}</span>`
      : `<span class="pm-channel-icon"><i class="${ch.icon}" style="color:${iconColor};"></i></span>`;
    return `
      <button type="button" class="pm-channel ${isActive ? 'active' : ''}"
              data-channel="${ch.id}" onclick="setPaymentChannel('${ch.id}')">
        ${visual}
        <span class="pm-channel-name">${ch.name}</span>
      </button>
    `;
  }).join('');
}

function renderModalMethods() {
  const section = document.getElementById('pm-step-methods');
  const container = document.getElementById('pm-methods');
  if (!section || !container || typeof PAYMENT_CHANNELS === 'undefined') return;

  const channel = PAYMENT_CHANNELS.find(c => c.id === AppState.paymentChannel);
  if (!channel) {
    section.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  section.style.display = '';
  container.innerHTML = channel.methods.map(mid => {
    const m = PAYMENT_METHODS.find(x => x.id === mid);
    if (!m) return '';
    const isActive = AppState.paymentMethod === m.id;
    const iconColor = isActive ? '#fff' : (m.color || '#047857');
    return `
      <button type="button" class="pm-method ${isActive ? 'active' : ''}"
              data-method="${m.id}" onclick="setPaymentMethod('${m.id}')">
        <span class="pm-method-icon"><i class="${m.icon}" style="color:${iconColor};"></i></span>
        <span class="pm-method-name">${m.name}</span>
      </button>
    `;
  }).join('');
}

function renderModalSummary() {
  const summary = document.getElementById('pm-summary');
  const text = document.getElementById('pm-summary-text');
  const confirmBtn = document.getElementById('pm-confirm-btn');
  if (!summary || !text) return;

  if (AppState.paymentChannel && AppState.paymentMethod) {
    text.textContent = getPaymentLabel(AppState.paymentChannel, AppState.paymentMethod);
    summary.classList.remove('hidden');
    if (confirmBtn) confirmBtn.disabled = false;
  } else {
    summary.classList.add('hidden');
    if (confirmBtn) confirmBtn.disabled = true;
  }
}

function setPaymentChannel(channelId) {
  const channel = (typeof PAYMENT_CHANNELS !== 'undefined') ? PAYMENT_CHANNELS.find(c => c.id === channelId) : null;
  if (!channel) return;
  AppState.paymentChannel = channelId;
  // لو ال method الحالي مش متاح في القناة دي، امسحه
  if (AppState.paymentMethod && !channel.methods.includes(AppState.paymentMethod)) {
    AppState.paymentMethod = null;
  }
  renderModalChannels();
  renderModalMethods();
  renderModalSummary();
  updatePaymentButton();
  if (typeof updateCartActions === 'function') updateCartActions();
}

function setPaymentMethod(method) {
  // back-compat: لو اتنادت من غير ما يحدد قناة، اعتبر "الفون" هي الافتراضية
  if (!AppState.paymentChannel) {
    AppState.paymentChannel = 'phone';
  }
  // back-compat: 'card' كان اسمه القديم لـ knet
  if (method === 'card') method = 'knet';
  AppState.paymentMethod = method;
  renderModalChannels();
  renderModalMethods();
  renderModalSummary();
  updatePaymentButton();
  if (typeof updateCartActions === 'function') updateCartActions();
}

function confirmPaymentSelection() {
  if (!AppState.paymentChannel || !AppState.paymentMethod) {
    showToast('اختر المصدر وطريقة الدفع أولاً', 'warning');
    return;
  }
  closeModal();
  updatePaymentButton();
}

function resetPaymentSelection() {
  AppState.paymentChannel = null;
  AppState.paymentMethod = null;
  renderModalChannels();
  renderModalMethods();
  renderModalSummary();
  updatePaymentButton();
  if (typeof updateCartActions === 'function') updateCartActions();
}

// Wrappers يحافظوا على التوافق مع الكود القديم اللي بينده الأسماء دي
function renderPaymentChannels() { updatePaymentButton(); }
function renderPaymentMethods() { /* لا يوجد render inline بعد دلوقتي */ }
function renderPaymentSummary() { updatePaymentButton(); }

function getEffectiveDeliveryFee() {
  // لو الموظف عدّل الرسوم يدوياً (override) نستخدمها، وإلا الرسوم الافتراضية للفرع
  if (AppState.deliveryFeeOverride !== null && AppState.deliveryFeeOverride !== undefined) {
    return parseFloat(AppState.deliveryFeeOverride);
  }
  return AppState.deliveryFee;
}

function calculateCartTotals() {
  AppState.cartSubtotal = AppState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  // Delivery fee is applied if there's a customer, items, and it's a delivery order
  const fee = getEffectiveDeliveryFee();
  const actualDeliveryFee = (AppState.cart.length > 0 && AppState.currentCustomer && AppState.orderType === 'delivery') ? fee : 0;
  AppState.cartTotal = AppState.cartSubtotal + actualDeliveryFee;

  document.getElementById('cart-subtotal').textContent = formatCurrency(AppState.cartSubtotal);
  document.getElementById('cart-delivery-fee').textContent = formatCurrency(actualDeliveryFee);
  document.getElementById('cart-total').textContent = formatCurrency(AppState.cartTotal);

  // علامة "يدوي" جنب رسوم التوصيل
  const tag = document.getElementById('fee-override-tag');
  if (tag) tag.classList.toggle('hidden', AppState.deliveryFeeOverride === null || AppState.deliveryFeeOverride === undefined);

  // زرار التعديل بيختفي لما يكون الطلب استلام
  const editBtn = document.getElementById('btn-edit-delivery-fee');
  if (editBtn) editBtn.style.display = AppState.orderType === 'delivery' ? '' : 'none';

  updateCartActions();
}

// ==========================================
// DELIVERY FEE OVERRIDE (تعديل رسوم التوصيل للطلب الحالي)
// ==========================================
function openDeliveryFeeModal() {
  if (AppState.orderType !== 'delivery') {
    showToast('تعديل رسوم التوصيل متاح لطلبات التوصيل فقط', 'warning');
    return;
  }

  const defaultFee = AppState.deliveryFee || 0;
  const currentFee = getEffectiveDeliveryFee();
  const isOverridden = AppState.deliveryFeeOverride !== null && AppState.deliveryFeeOverride !== undefined;

  // اقتراحات سريعة شائعة
  const presets = [0, 0.250, 0.500, 0.750, 1.000, 1.500];

  const presetsHtml = presets.map(p => `
    <button type="button" class="fee-preset ${Math.abs(p - currentFee) < 0.001 ? 'active' : ''}" data-fee="${p}" onclick="setDeliveryFeeFromPreset(${p})">
      ${p.toFixed(3)} <span class="fee-preset-unit">د.ك</span>
    </button>
  `).join('');

  const modalHtml = `
    <div class="modal-header">
      <h3 class="modal-title">رسوم التوصيل لهذا الطلب</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="padding:18px 22px;">
      <div class="fee-info-box">
        <div class="fee-info-row">
          <span class="fee-info-label"><i class="fa-solid fa-store"></i> الفرع الافتراضي</span>
          <span class="fee-info-value">${defaultFee.toFixed(3)} د.ك</span>
        </div>
      </div>

      <div class="fee-step-label">اختر بسرعة</div>
      <div class="fee-presets-grid">
        ${presetsHtml}
      </div>

      <div class="fee-step-label" style="margin-top:14px;">أو اكتب القيمة يدوياً</div>
      <div class="fee-input-wrap">
        <input type="number" id="delivery-fee-input" min="0" step="0.050" value="${currentFee.toFixed(3)}"
               oninput="onFeeInputChange()" inputmode="decimal"
               placeholder="0.000" />
        <span class="fee-input-currency">د.ك</span>
      </div>
      <div class="fee-hint" id="fee-hint"></div>
    </div>
    <div class="modal-footer" style="justify-content: space-between;">
      <button class="btn btn-secondary" onclick="resetDeliveryFee()" ${!isOverridden ? 'disabled' : ''}>
        <i class="fa-solid fa-rotate-left"></i> رجوع للافتراضي
      </button>
      <button class="btn btn-primary" onclick="applyDeliveryFee()">تطبيق</button>
    </div>
  `;

  document.getElementById('modal-content').innerHTML = modalHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => {
    const inp = document.getElementById('delivery-fee-input');
    if (inp) inp.focus();
  }, 0);
}

function setDeliveryFeeFromPreset(value) {
  const inp = document.getElementById('delivery-fee-input');
  if (inp) {
    inp.value = parseFloat(value).toFixed(3);
    onFeeInputChange();
  }
  document.querySelectorAll('.fee-preset').forEach(b => {
    const v = parseFloat(b.dataset.fee);
    b.classList.toggle('active', Math.abs(v - value) < 0.001);
  });
}

function onFeeInputChange() {
  const inp = document.getElementById('delivery-fee-input');
  const hint = document.getElementById('fee-hint');
  if (!inp || !hint) return;
  const v = parseFloat(inp.value);
  if (isNaN(v) || v < 0) {
    hint.textContent = 'القيمة يجب أن تكون 0 أو أكبر';
    hint.className = 'fee-hint fee-hint-error';
  } else if (v === AppState.deliveryFee) {
    hint.textContent = 'نفس قيمة الفرع الافتراضية';
    hint.className = 'fee-hint';
  } else if (v > AppState.deliveryFee) {
    hint.textContent = `أعلى من الافتراضي بـ ${(v - AppState.deliveryFee).toFixed(3)} د.ك`;
    hint.className = 'fee-hint fee-hint-warn';
  } else {
    hint.textContent = `أقل من الافتراضي بـ ${(AppState.deliveryFee - v).toFixed(3)} د.ك`;
    hint.className = 'fee-hint fee-hint-info';
  }
  // حدّث الـ presets active state
  document.querySelectorAll('.fee-preset').forEach(b => {
    const pv = parseFloat(b.dataset.fee);
    b.classList.toggle('active', !isNaN(v) && Math.abs(pv - v) < 0.001);
  });
}

function applyDeliveryFee() {
  const inp = document.getElementById('delivery-fee-input');
  if (!inp) return;
  const v = parseFloat(inp.value);
  if (isNaN(v) || v < 0) {
    showToast('الرجاء إدخال قيمة صحيحة', 'warning');
    return;
  }
  // لو القيمة نفس الافتراضي، نعتبره ما فيش override
  if (Math.abs(v - AppState.deliveryFee) < 0.001) {
    AppState.deliveryFeeOverride = null;
    showToast('تم استخدام رسوم الفرع الافتراضية', 'info');
  } else {
    AppState.deliveryFeeOverride = v;
    showToast(`تم تعديل رسوم التوصيل إلى ${v.toFixed(3)} د.ك`, 'success');
  }
  calculateCartTotals();
  closeModal();
}

function resetDeliveryFee() {
  AppState.deliveryFeeOverride = null;
  calculateCartTotals();
  showToast('تم الرجوع للرسوم الافتراضية للفرع', 'info');
  closeModal();
}

function renderCart() {
  const container = document.getElementById('cart-items');

  if (AppState.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">${icon('shopping-cart', { size: 48 })}</div>
        <p>السلة فارغة</p>
        <p style="font-size:12px; margin-top:4px;">اختر أصناف من القائمة</p>
      </div>
    `;
    calculateCartTotals();
    return;
  }

  const orderBranchId = getResolvedOrderBranchId();
  const disabledItems = orderBranchId ? (AppState.disabledBranchItems[orderBranchId] || []) : [];

  let html = '';
  AppState.cart.forEach(item => {
    let detailsStr = '';
    if (item.size) detailsStr += `حجم ${item.size}`;
    if (item.extras && item.extras.length > 0) {
      if (detailsStr) detailsStr += ' + ';
      detailsStr += item.extras.join('، ');
    }
    if (item.note) {
      if (detailsStr) detailsStr += '<br>';
      detailsStr += `<span style="color:var(--danger); font-size:11px;">ملاحظة: ${item.note}</span>`;
    }

    const isItemDisabled = disabledItems.includes(item.itemId);
    const itemDisabledClass = isItemDisabled ? 'cart-item-disabled' : '';

    html += `
      <div class="cart-item ${itemDisabledClass}">
        <div class="cart-item-top">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatCurrency(item.price * item.quantity)}</div>
        </div>
        ${detailsStr ? `<div class="cart-item-details">${detailsStr}</div>` : ''}
        <div class="cart-item-bottom">
          <button class="cart-item-edit" onclick="openItemModal(${item.itemId}, '${item.cartItemId}')">تعديل</button>
          <div class="qty-control">
            <button class="qty-btn" onclick="updateCartItemQty('${item.cartItemId}', -1)">-</button>
            <div class="qty-value">${item.quantity}</div>
            <button class="qty-btn" onclick="updateCartItemQty('${item.cartItemId}', 1)">+</button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  calculateCartTotals();
  updateOrderNotesPreview();
}

function updateCartActions() {
  const submitBtn = document.getElementById('btn-submit-order');
  if (AppState.cart.length > 0 && AppState.currentCustomer) {
    submitBtn.disabled = false;
  } else {
    submitBtn.disabled = true;
  }
}

// ==========================================
// ORDER SUBMISSION & REVIEW
// ==========================================
function reviewOrder() {
  if (AppState.cart.length === 0) {
    showToast('السلة فارغة', 'warning');
    return;
  }
  if (!AppState.currentCustomer) {
    showToast('يرجى إضافة بيانات العميل أولاً', 'warning');
    return;
  }
  if (!AppState.paymentChannel) {
    showToast('يرجى تحديد مصدر الطلب أولاً (الفون / طلبات / كاري / ...)', 'warning');
    return;
  }
  if (!AppState.paymentMethod) {
    showToast('يرجى تحديد طريقة الدفع (كاش / كي نت / لينك)', 'warning');
    return;
  }

  // Validate items availability in the active branch
  const orderBranchId = getResolvedOrderBranchId();
  const disabledItems = orderBranchId ? (AppState.disabledBranchItems[orderBranchId] || []) : [];
  const invalidCartItems = AppState.cart.filter(item => disabledItems.includes(item.itemId));
  if (invalidCartItems.length > 0) {
    const branch = AppState.branches.find(b => b.id === orderBranchId);
    const branchName = branch ? branch.name : 'الفرع المحدد';
    const itemNames = invalidCartItems.map(i => i.name).join('، ');
    showToast(`الطلب يحتوي على أصناف غير متوفرة في ${branchName}: (${itemNames})`, 'error');
    return;
  }

  const c = AppState.currentCustomer;
  let itemsHtml = AppState.cart.map(item => `
    <div style="display:flex; justify-content:space-between; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border-light);">
      <div>
        <div style="font-weight:700;">${item.quantity}x ${item.name}</div>
        <div style="font-size:12px; color:var(--text-muted);">
          ${item.size ? `حجم ${item.size}` : ''}
          ${item.extras && item.extras.length ? ` + ${item.extras.join('، ')}` : ''}
          ${item.note ? `<br><span style="color:var(--danger)">ملاحظة: ${item.note}</span>` : ''}
        </div>
      </div>
      <div style="font-weight:700;">${formatCurrency(item.price * item.quantity)}</div>
    </div>
  `).join('');

  const typeName = AppState.orderType === 'pickup' ? 'استلام من الفرع' : 'توصيل';
  
  const modalHtml = `
    <div class="modal-header">
      <h3 class="modal-title">مراجعة الطلب قبل التأكيد</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
      <div style="background:var(--bg); padding:16px; border-radius:var(--radius-md); margin-bottom:16px;">
        <h4 style="margin-bottom:8px; color:var(--primary);">بيانات العميل</h4>
        <div><strong>الاسم:</strong> ${c.name}</div>
        <div><strong>الرقم:</strong> <span dir="ltr">${c.phone}</span></div>
        <div><strong>نوع الطلب:</strong> ${typeName}</div>
      </div>
      
      <h4 style="margin-bottom:12px; color:var(--primary);">الأصناف</h4>
      <div style="margin-bottom:16px;">
        ${itemsHtml}
      </div>
      
      <div style="background:var(--primary-lighter); padding:16px; border-radius:var(--radius-md);">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span>المجموع الفرعي:</span>
          <span>${formatCurrency(AppState.cartSubtotal)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span>رسوم التوصيل:</span>
          <span>${formatCurrency(AppState.orderType === 'delivery' ? getEffectiveDeliveryFee() : 0)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-weight:800; font-size:18px; color:var(--primary); margin-top:8px; padding-top:8px; border-top:1px solid var(--border);">
          <span>الإجمالي:</span>
          <span>${formatCurrency(AppState.cartTotal)}</span>
        </div>
      </div>
      
      <div style="margin-top:16px;">
        <h4 style="margin-bottom:8px; color:var(--primary);">ملاحظات الطلب</h4>
        <div style="background:var(--danger-light); color:var(--danger); padding:12px; border-radius:var(--radius-md); font-weight:600;">
          ${AppState.orderNotes || 'لا يوجد'}
        </div>
      </div>
      
      <div style="margin-top:16px;">
        <h4 style="margin-bottom:8px; color:var(--primary);">جدولة الطلب (اختياري)</h4>
        <input type="datetime-local" id="order-schedule-date" style="width:100%; padding:10px; border-radius:var(--radius-md); border:1px solid var(--border); font-family:inherit;">
        <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">اترك الحقل فارغاً إذا كان الطلب للتنفيذ الفوري</p>
      </div>
    </div>
    <div class="modal-footer" style="justify-content: space-between;">
      <button class="btn btn-secondary" onclick="closeModal()">رجوع للتعديل</button>
      <button class="btn btn-primary" style="flex: 1; max-width: 200px;" onclick="finalizeOrder()">
        إرسال الطلب نهائياً
      </button>
    </div>
  `;

  document.getElementById('modal-content').innerHTML = modalHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function finalizeOrder() {
  // Validate items availability in the active branch
  const orderBranchId = getResolvedOrderBranchId();
  const disabledItems = orderBranchId ? (AppState.disabledBranchItems[orderBranchId] || []) : [];
  const invalidCartItems = AppState.cart.filter(item => disabledItems.includes(item.itemId));
  if (invalidCartItems.length > 0) {
    const branch = AppState.branches.find(b => b.id === orderBranchId);
    const branchName = branch ? branch.name : 'الفرع المحدد';
    const itemNames = invalidCartItems.map(i => i.name).join('، ');
    showToast(`الطلب يحتوي على أصناف غير متوفرة في ${branchName}: (${itemNames})`, 'error');
    return;
  }

  closeModal();
  const submitBtn = document.getElementById('btn-submit-order');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loader"></span> جاري الإرسال...';

  const c = AppState.currentCustomer;
  
  // Construct full address string from current form
  const area = document.getElementById('cust-area').value;
  const block = document.getElementById('cust-block').value;
  const street = document.getElementById('cust-street').value;
  const building = document.getElementById('cust-building').value;
  const floor = document.getElementById('cust-floor').value;
  const apartment = document.getElementById('cust-apartment').value;
  
  const addressParts = [];
  if (area) addressParts.push(area);
  if (block) addressParts.push(`ق ${block}`);
  if (street) addressParts.push(`ش ${street}`);
  if (building) addressParts.push(`مبنى ${building}`);
  if (floor) addressParts.push(`ط ${floor}`);
  if (apartment) addressParts.push(`شقة ${apartment}`);
  let fullAddress = addressParts.join('، ');

  let finalBranchId = AppState.currentBranch ? AppState.currentBranch.id : 1;
  let finalBranchName = AppState.currentBranch ? AppState.currentBranch.name : 'الفرع الرئيسي';

  if (AppState.orderType === 'pickup') {
    const pickupSelect = document.getElementById('cust-pickup-branch');
    if (pickupSelect && pickupSelect.value) {
      finalBranchId = parseInt(pickupSelect.value);
      const b = AppState.branches.find(b => b.id === finalBranchId);
      if (b) finalBranchName = b.name;
    }
    fullAddress = 'استلام من ' + finalBranchName;
  } else {
    // Delivery validation
    if (!area || !block || !street || !building) {
      showToast('يرجى التأكد من استكمال تفاصيل العنوان (المنطقة، القطعة، الشارع، المبنى) لطلب التوصيل', 'warning');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'إرسال الطلب نهائياً';
      return;
    }
    
    // Determine branch based on area for delivery
    const areaOption = Array.from(document.getElementById('cust-area').options).find(opt => opt.value === area);
    if (areaOption) {
      finalBranchId = parseInt(areaOption.getAttribute('data-branch-id'));
      const b = AppState.branches.find(b => b.id === finalBranchId);
      if (b) finalBranchName = b.name;
    }
  }

  // لو الموظف غير الفرع يدوياً، استخدم اختياره بدل التلقائي
  if (AppState.branchOverrideId) {
    const overrideBranch = AppState.branches.find(b => b.id === AppState.branchOverrideId);
    if (overrideBranch) {
      finalBranchId = overrideBranch.id;
      finalBranchName = overrideBranch.name;
    }
  }

  const scheduledDateInput = document.getElementById('order-schedule-date');
  const scheduledDate = scheduledDateInput && scheduledDateInput.value ? scheduledDateInput.value : null;

  // Simulate API call delay
  setTimeout(() => {
    let orderToSave;

    if (AppState.editingOrderId) {
      // Update existing order
      const orderIndex = AppState.orders.findIndex(o => o.id === AppState.editingOrderId);
      if (orderIndex > -1) {
        orderToSave = {
          ...AppState.orders[orderIndex],
          type: AppState.orderType,
          items: [...AppState.cart],
          subtotal: AppState.cartSubtotal,
          deliveryFee: AppState.orderType === 'delivery' ? getEffectiveDeliveryFee() : 0,
          total: AppState.cartTotal,
          paymentChannel: AppState.paymentChannel,
          paymentMethod: AppState.paymentMethod,
          paymentLabel: getPaymentLabel(AppState.paymentChannel, AppState.paymentMethod),
          address: fullAddress,
          branchId: finalBranchId,
          branchName: finalBranchName,
          notes: AppState.orderNotes,
          scheduledDate: scheduledDate,
          updatedAt: new Date().toISOString()
        };
        // سجل عملية التعديل في تاريخ الطلب (مع كل أحداث السلة اللي حصلت أثناء التعديل)
        const existingHistory = AppState.orders[orderIndex].statusHistory || [];
        orderToSave.statusHistory = [
          ...existingHistory,
          ...(AppState.pendingOrderEvents || []),
          {
            type: 'edited',
            status: orderToSave.status,
            at: orderToSave.updatedAt,
            by: AppState.currentUser ? AppState.currentUser.name : 'موظف',
            note: `تم حفظ تعديلات الطلب`
          }
        ];
        AppState.orders[orderIndex] = orderToSave;
        AppState.pendingOrderEvents = [];
        showToast(`تم تحديث الطلب بنجاح. رقم الفاتورة: #${orderToSave.invoiceNo}`, 'success');
      }
      AppState.editingOrderId = null;
    } else {
      // Create new order
      const nowIso = new Date().toISOString();
      orderToSave = {
        id: Date.now(),
        invoiceNo: generateInvoiceNo(),
        dailyNo: getDailyOrderNo(),
        customerId: c.id,
        customerName: c.name,
        customerPhone: c.phone,
        branchId: finalBranchId,
        branchName: finalBranchName,
        employeeId: AppState.currentUser.id,
        employeeName: AppState.currentUser.name,
        type: AppState.orderType,
        status: 'new',
        items: [...AppState.cart], // clone cart
        subtotal: AppState.cartSubtotal,
        deliveryFee: AppState.orderType === 'delivery' ? AppState.deliveryFee : 0,
        total: AppState.cartTotal,
        paymentChannel: AppState.paymentChannel,
        paymentMethod: AppState.paymentMethod,
        paymentLabel: getPaymentLabel(AppState.paymentChannel, AppState.paymentMethod),
        address: fullAddress,
        notes: AppState.orderNotes,
        scheduledDate: scheduledDate,
        businessDate: AppState.businessDate || todayISO(),
        createdAt: nowIso,
        updatedAt: nowIso,
        hasComplaint: false,
        statusHistory: [
          // الأحداث اللي حصلت في السلة قبل التأكيد (إضافة أصناف، تغيير كميات، إلخ)
          ...(AppState.pendingOrderEvents || []),
          {
            type: 'created',
            status: 'new',
            at: nowIso,
            by: AppState.currentUser.name,
            note: `تأكيد الطلب وإرساله للفرع`
          }
        ]
      };
      AppState.orders.unshift(orderToSave); // Add to beginning of array
      AppState.pendingOrderEvents = []; // امسح الـ buffer
      showToast(`تم إنشاء الطلب بنجاح. رقم الفاتورة: #${orderToSave.invoiceNo}`, 'success');
    }

    // Update UI components
    renderDeliveryOrders();
    renderAllOrders();
    updateDashboardStats();

    // Reset cart and form
    AppState.cart = [];
    AppState.paymentChannel = null;
    AppState.paymentMethod = null;
    AppState.deliveryFeeOverride = null;
    renderPaymentChannels();
    renderPaymentMethods();
    renderPaymentSummary();
    AppState.orderNotes = '';
    AppState.editingOrderId = null;
    updateOrderNotesPreview();
    renderCart();

    submitBtn.innerHTML = 'تأكيد الطلب';
    updateCartActions();

    // Increment invoice number for next UI display
    const cartOrderNoEl = document.getElementById('cart-order-no');
    if (cartOrderNoEl) cartOrderNoEl.textContent = '#' + (parseInt(orderToSave.invoiceNo) + 1);

    // بعد التأكيد، حول الموظف على شاشة قايمة طلبات التوصيل (السايدبار)
    const ordersNav = document.querySelector('.nav-item[data-view="orders"]');
    if (ordersNav) showView('orders', ordersNav);

  }, 800);
}

// ==========================================
// ORDERS VIEWS (TABLES & DETAILS)
// ==========================================
function getStatusBadge(status) {
  const statusObj = ORDER_STATUSES.find(s => s.id === status);
  if (!statusObj) return `<span class="status-badge">غير معروف</span>`;
  return `<span class="status-badge status-${status}">${icon(statusObj.icon, { size: 13 })} ${statusObj.name}</span>`;
}

// ==========================================
// DRIVER ASSIGNMENT (تعيين سائق للطلب)
// ==========================================
function getDriverCellHtml(order) {
  if (order.type !== 'delivery') {
    return '<span style="color:var(--text-muted); font-size:12px;">—</span>';
  }
  if (order.driverId && order.driverName) {
    return `
      <div class="driver-cell">
        <span class="driver-cell-name">${icon('bike', { size: 14 })} ${order.driverName}</span>
        <span class="driver-cell-phone" dir="ltr">${order.driverPhone || ''}</span>
      </div>
    `;
  }
  return '<span class="driver-cell-empty">لم يُعين بعد</span>';
}

function showAssignDriverModal(orderId) {
  const order = AppState.orders.find(o => o.id === orderId);
  if (!order) return;
  if (order.type !== 'delivery') {
    showToast('تعيين السائق متاح لطلبات التوصيل فقط', 'warning');
    return;
  }

  // فلتر السائقين على فرع الطلب أولاً، وعرض الباقي تحت
  const branchDrivers = AppState.drivers.filter(d => d.branchId === order.branchId);
  const otherDrivers = AppState.drivers.filter(d => d.branchId !== order.branchId);

  const renderDriver = (d) => `
    <button type="button" class="driver-option ${order.driverId === d.id ? 'selected' : ''}" onclick="selectDriverForOrder(${order.id}, ${d.id})">
      <div class="driver-option-info">
        <span class="driver-option-name">${icon('bike', { size: 14 })} ${d.name}</span>
        <span class="driver-option-phone" dir="ltr">${d.phone}</span>
      </div>
      ${order.driverId === d.id ? `<span class="driver-option-check">${icon('check', { size: 14 })}</span>` : '<span class="driver-option-select-label">تعيين</span>'}
    </button>
  `;

  let listHtml = '';
  if (branchDrivers.length > 0) {
    listHtml += `<div class="driver-group-title">سائقي ${order.branchName}</div>`;
    listHtml += branchDrivers.map(renderDriver).join('');
  }
  if (otherDrivers.length > 0) {
    listHtml += `<div class="driver-group-title">سائقين من فروع أخرى</div>`;
    listHtml += otherDrivers.map(renderDriver).join('');
  }
  if (!listHtml) {
    listHtml = '<div style="padding:20px; text-align:center; color:var(--text-muted);">لا يوجد سائقين متاحين</div>';
  }

  const currentDriverHtml = order.driverId ? `
    <div class="driver-current">
      <div class="driver-current-label">السائق الحالي:</div>
      <div class="driver-current-name">${icon('bike', { size: 14 })} ${order.driverName}</div>
      <div class="driver-current-phone" dir="ltr">${order.driverPhone || ''}</div>
      <button type="button" class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="unassignDriverFromOrder(${order.id})">إلغاء التعيين</button>
    </div>
  ` : '';

  const modalHtml = `
    <div class="modal-header">
      <h3 class="modal-title">تعيين سائق للطلب #${order.invoiceNo}</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="padding:18px 22px;">
      <div class="driver-search-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="driver-search-input" placeholder="ابحث باسم السائق أو الرقم..." oninput="filterDriverList()">
      </div>
      ${currentDriverHtml}
      <div class="driver-list" id="driver-list">${listHtml}</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إغلاق</button>
    </div>
  `;

  document.getElementById('modal-content').innerHTML = modalHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function filterDriverList() {
  const input = document.getElementById('driver-search-input');
  const q = (input ? input.value : '').trim().toLowerCase();
  const list = document.getElementById('driver-list');
  if (!list) return;
  list.querySelectorAll('.driver-option').forEach(opt => {
    const name = (opt.querySelector('.driver-option-name')?.textContent || '').toLowerCase();
    const phone = (opt.querySelector('.driver-option-phone')?.textContent || '').toLowerCase();
    opt.style.display = (!q || name.includes(q) || phone.includes(q)) ? '' : 'none';
  });
}

function selectDriverForOrder(orderId, driverId) {
  const orderIndex = AppState.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return;
  const driver = AppState.drivers.find(d => d.id === driverId);
  if (!driver) return;

  const order = AppState.orders[orderIndex];
  const prevDriverName = order.driverName;
  const nowIso = new Date().toISOString();

  order.driverId = driver.id;
  order.driverName = driver.name;
  order.driverPhone = driver.phone;
  order.driverAssignedAt = nowIso;
  order.updatedAt = nowIso;

  // سجل العملية في تاريخ الطلب
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({
    type: 'driver_assigned',
    at: nowIso,
    by: AppState.currentUser ? AppState.currentUser.name : 'موظف',
    driverName: driver.name,
    driverPhone: driver.phone,
    note: prevDriverName
      ? `تم تغيير السائق من ${prevDriverName} إلى ${driver.name} (${driver.phone})`
      : `تم تحميل الطلب على السائق ${driver.name} (${driver.phone})`
  });

  // لو الطلب لسه "جاهز"، حول حالته لـ "في الطريق" تلقائياً
  if (order.status === 'ready') {
    order.status = 'onway';
    const statusObjOld = ORDER_STATUSES.find(s => s.id === 'ready');
    const statusObjNew = ORDER_STATUSES.find(s => s.id === 'onway');
    order.statusHistory.push({
      type: 'status',
      status: 'onway',
      fromStatus: 'ready',
      at: nowIso,
      by: AppState.currentUser ? AppState.currentUser.name : 'موظف',
      note: `تغيير الحالة من "${statusObjOld.name}" إلى "${statusObjNew.name}" تلقائياً عند تعيين السائق`
    });
  }

  AppState.orders[orderIndex] = order;
  showToast(`تم تعيين السائق ${driver.name} للطلب #${order.invoiceNo}`, 'success');
  closeModal();

  renderDeliveryOrders();
  renderAllOrders();
  updateDashboardStats();

  // إعادة عرض تفاصيل الطلب لو مفتوحة
  const detailContainer = document.getElementById('order-detail-container');
  if (detailContainer && detailContainer.innerHTML.includes(order.invoiceNo)) viewOrderDetail(order.id, 'tab', { force: true });
  const allDetail = document.getElementById('all-order-detail-container');
  if (allDetail && allDetail.innerHTML.includes(order.invoiceNo)) viewOrderDetail(order.id, 'all', { force: true });
}

function unassignDriverFromOrder(orderId) {
  const orderIndex = AppState.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return;
  if (!confirm('هل تريد إلغاء تعيين السائق من هذا الطلب؟')) return;

  const order = AppState.orders[orderIndex];
  const prevDriverName = order.driverName;
  const nowIso = new Date().toISOString();

  order.driverId = null;
  order.driverName = null;
  order.driverPhone = null;
  order.driverAssignedAt = null;
  order.updatedAt = nowIso;

  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({
    type: 'driver_unassigned',
    at: nowIso,
    by: AppState.currentUser ? AppState.currentUser.name : 'موظف',
    note: `تم إلغاء تعيين السائق ${prevDriverName || ''}`
  });

  AppState.orders[orderIndex] = order;
  showToast('تم إلغاء تعيين السائق', 'info');
  closeModal();

  renderDeliveryOrders();
  renderAllOrders();
  const detailContainer = document.getElementById('order-detail-container');
  if (detailContainer && detailContainer.innerHTML.includes(order.invoiceNo)) viewOrderDetail(order.id, 'tab', { force: true });
  const allDetail = document.getElementById('all-order-detail-container');
  if (allDetail && allDetail.innerHTML.includes(order.invoiceNo)) viewOrderDetail(order.id, 'all', { force: true });
}

// Delivery Orders Tab (Current Branch/Active)
function renderDeliveryOrders() {
  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('filter-status') ? document.getElementById('filter-status').value : '';
  const invoiceQuery = document.getElementById('tab-search-invoice') ? document.getElementById('tab-search-invoice').value.trim().toLowerCase() : '';
  const phoneQuery = document.getElementById('tab-search-phone') ? document.getElementById('tab-search-phone').value.trim().toLowerCase() : '';

  // طلبات يوم العمل الحالي بس - بعد EOD، طلبات الأيام السابقة تختفي من هنا
  // الطلبات المجدولة بتظهر بس في شاشة "طلبات مجدولة" مش هنا
  const bd = AppState.businessDate || todayISO();
  let filtered = AppState.orders.filter(o =>
    o.type === 'delivery' &&
    !o.scheduledDate &&
    (o.businessDate || (o.createdAt || '').slice(0, 10)) === bd
  );

  if (statusFilter) {
    filtered = filtered.filter(o => o.status === statusFilter);
  }

  if (invoiceQuery) {
    filtered = filtered.filter(o => o.invoiceNo.toLowerCase().includes(invoiceQuery));
  }

  if (phoneQuery) {
    filtered = filtered.filter(o => o.customerPhone.includes(phoneQuery));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">لا توجد طلبات توصيل في يوم العمل الحالي</td></tr>';
    return;
  }

  let html = '';
  filtered.forEach(order => {
    html += `
      <tr class="${order.status === 'cancelled' ? 'order-row-cancelled' : ''}" onclick="viewOrderDetail(${order.id})">
        <td style="font-weight:700; font-size:16px;">${order.dailyNo}</td>
        <td>#${order.invoiceNo}</td>
        <td>${order.employeeName}</td>
        <td><span style="display:inline-flex; align-items:center; gap:6px;"><span style="color:var(--primary); display:inline-flex;">${icon(order.type === 'pickup' ? 'store' : 'bike', { size: 16 })}</span> ${order.type === 'pickup' ? 'استلام' : 'توصيل'}</span></td>
        <td dir="ltr" style="text-align:right;">${order.customerPhone}</td>
        <td>${getStatusBadge(order.status)} ${order.hasComplaint ? `<span title="يوجد شكوى" style="color:var(--danger); display:inline-flex; vertical-align:middle;">${icon('alert-triangle', { size: 14 })}</span>` : ''}</td>
        <td>${getDriverCellHtml(order)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); viewOrderDetail(${order.id}, 'tab')">تفاصيل</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function filterOrders() {
  renderDeliveryOrders();
}

function clearTabOrderFilters() {
  if (document.getElementById('tab-search-invoice')) document.getElementById('tab-search-invoice').value = '';
  if (document.getElementById('tab-search-phone')) document.getElementById('tab-search-phone').value = '';
  if (document.getElementById('filter-status')) document.getElementById('filter-status').value = '';
  renderDeliveryOrders();
}

// All Orders View (Master list)
function renderAllOrders() {
  const tbody = document.getElementById('all-orders-table-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('all-filter-status') ? document.getElementById('all-filter-status').value : '';
  const branchFilter = document.getElementById('all-filter-branch') ? document.getElementById('all-filter-branch').value : '';
  const invoiceQuery = document.getElementById('all-search-invoice') ? document.getElementById('all-search-invoice').value.trim().toLowerCase() : '';
  const phoneQuery = document.getElementById('all-search-phone') ? document.getElementById('all-search-phone').value.trim().toLowerCase() : '';

  // كل طلبات يوم العمل الحالي - بعد EOD، طلبات الأيام السابقة تختفي
  // الطلبات المجدولة بتظهر بس في شاشة "طلبات مجدولة" مش هنا
  const bd = AppState.businessDate || todayISO();
  let filtered = AppState.orders.filter(o =>
    !o.scheduledDate &&
    (o.businessDate || (o.createdAt || '').slice(0, 10)) === bd
  );

  if (statusFilter) {
    filtered = filtered.filter(o => o.status === statusFilter);
  }

  if (branchFilter) {
    filtered = filtered.filter(o => o.branchId === parseInt(branchFilter));
  }

  if (invoiceQuery) {
    filtered = filtered.filter(o => o.invoiceNo.toLowerCase().includes(invoiceQuery));
  }

  if (phoneQuery) {
    filtered = filtered.filter(o => o.customerPhone.includes(phoneQuery));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px;">لا توجد طلبات في يوم العمل الحالي</td></tr>';
    return;
  }

  let html = '';
  filtered.forEach(order => {
    const typeIconName = order.type === 'delivery' ? 'bike' : 'store';
    const typeName = order.type === 'delivery' ? 'توصيل' : 'استلام';

    html += `
      <tr class="${order.status === 'cancelled' ? 'order-row-cancelled' : ''}" onclick="viewOrderDetail(${order.id}, 'all')">
        <td style="font-weight:700;">${order.dailyNo}</td>
        <td style="color:var(--primary); font-weight:700;">#${order.invoiceNo}</td>
        <td>
          <div class="order-customer-cell">
            <div class="order-customer-phone">${order.customerPhone}</div>
            <div class="order-customer-name">${order.customerName}</div>
          </div>
        </td>
        <td>${order.branchName}</td>
        <td>${order.employeeName}</td>
        <td><span style="display:inline-flex; align-items:center; gap:6px;">${icon(typeIconName, { size: 16 })} ${typeName}</span></td>
        <td style="font-weight:700;">${formatCurrency(order.total)}</td>
        <td>${getStatusBadge(order.status)} ${order.hasComplaint ? `<span title="يوجد شكوى" style="color:var(--danger); display:inline-flex; vertical-align:middle;">${icon('alert-triangle', { size: 14 })}</span>` : ''}</td>
        <td>${getDriverCellHtml(order)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); viewOrderDetail(${order.id}, 'all')">تفاصيل</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function filterAllOrders() {
  renderAllOrders();
}

function clearAllOrderFilters() {
  if (document.getElementById('all-search-invoice')) document.getElementById('all-search-invoice').value = '';
  if (document.getElementById('all-search-phone')) document.getElementById('all-search-phone').value = '';
  if (document.getElementById('all-filter-status')) document.getElementById('all-filter-status').value = '';
  if (document.getElementById('all-filter-branch')) document.getElementById('all-filter-branch').value = '';
  renderAllOrders();
}

// Scheduled Orders View
function renderScheduledOrders() {
  const tbody = document.getElementById('scheduled-orders-table-body');
  if (!tbody) return;

  const filtered = AppState.orders.filter(o => o.scheduledDate).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">لا توجد طلبات مجدولة</td></tr>';
    return;
  }

  let html = '';
  filtered.forEach(order => {
    const typeIconName = order.type === 'delivery' ? 'bike' : 'store';
    const typeName = order.type === 'delivery' ? 'توصيل' : 'استلام';

    html += `
      <tr onclick="viewOrderDetail(${order.id}, 'scheduled')">
        <td style="font-weight:700; color:var(--primary);">${formatDate(order.scheduledDate)}</td>
        <td style="font-weight:700;">#${order.invoiceNo}</td>
        <td>
          <div style="font-weight:600;">${order.customerName}</div>
          <div style="font-size:11px; color:var(--text-muted);" dir="ltr" style="text-align:right;">${order.customerPhone}</div>
        </td>
        <td>${order.branchName}</td>
        <td><span style="display:inline-flex; align-items:center; gap:6px;">${icon(typeIconName, { size: 16 })} ${typeName}</span></td>
        <td style="font-weight:700;">${formatCurrency(order.total)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); viewOrderDetail(${order.id}, 'scheduled')">تفاصيل</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function viewOrderDetail(orderId, context = 'tab', opts = {}) {
  const order = AppState.orders.find(o => o.id === orderId);
  if (!order) return;

  let containerId = 'order-detail-container';
  if (context === 'all') containerId = 'all-order-detail-container';
  if (context === 'scheduled') containerId = 'scheduled-order-detail-container';

  const container = document.getElementById(containerId);
  if (!container) return;

  // Toggle: لو نفس الطلب معروض دلوقتي، اقفل التفاصيل وارجع
  // الاستثناء: لما يكون force=true (من refresh بعد تغيير حالة/تعديل/إلخ)
  if (!opts.force && container.dataset.openOrderId === String(orderId)) {
    container.innerHTML = '';
    container.dataset.openOrderId = '';
    return;
  }
  container.dataset.openOrderId = String(orderId);

  // Next logical status logic
  const statusFlow = ['new', 'preparing', 'ready', 'onway', 'delivered'];
  const currentIndex = statusFlow.indexOf(order.status);
  const nextStatus = currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : null;
  const nextStatusObj = nextStatus ? ORDER_STATUSES.find(s => s.id === nextStatus) : null;

  let itemsHtml = '';
  order.items.forEach(item => {
    let detailsStr = item.size ? `حجم ${item.size}` : '';
    if (item.extras && item.extras.length > 0) {
      detailsStr += detailsStr ? ' + ' : '';
      detailsStr += item.extras.join('، ');
    }

    itemsHtml += `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${item.name}</div>
          ${detailsStr ? `<div style="font-size:11px; color:var(--text-muted);">${detailsStr}</div>` : ''}
        </td>
        <td style="text-align:center;">${item.quantity}</td>
        <td>${formatCurrency(item.price)}</td>
        <td style="font-weight:700;">${formatCurrency(item.price * item.quantity)}</td>
      </tr>
    `;
  });

  const html = `
    <div class="order-detail-panel">
      <div class="order-detail-header">
        <div>
          <div class="order-detail-invoice">فاتورة #${order.invoiceNo}</div>
          <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">تاريخ الإنشاء: ${formatDate(order.createdAt)}</div>
          ${order.scheduledDate ? `<div style="font-size:13px; color:var(--danger); margin-top:4px; font-weight:bold;">مجدول إلى: ${formatDate(order.scheduledDate)}</div>` : ''}
          ${order.status === 'cancelled' && order.cancellationReason ? `<div class="order-cancel-reason"><i class="fa-solid fa-circle-xmark"></i> سبب الإلغاء: <strong>${order.cancellationReason.label}</strong>${order.cancellationReason.note && order.cancellationReason.id !== 'other' ? ` — ${order.cancellationReason.note}` : ''}</div>` : ''}
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          ${getStatusBadge(order.status)}
          ${order.status !== 'cancelled' && order.status !== 'delivered' ?
            `<button class="btn btn-primary" onclick="editOrder(${order.id})">تعديل الطلب</button>
             <button class="btn btn-danger" onclick="updateOrderStatus(${order.id}, 'cancelled')">إلغاء الطلب</button>` : ''
          }
          ${order.type === 'delivery' && order.status !== 'cancelled' && order.status !== 'delivered' ?
            `<button class="btn btn-assign-driver" onclick="showAssignDriverModal(${order.id})" title="تعيين أو تغيير السائق">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/></svg>
               ${order.driverId ? 'تغيير السائق' : 'تعيين سائق'}
             </button>` : ''
          }
          <button class="btn btn-secondary" onclick="showComplaintModal(${order.id})" style="background:var(--danger-light); color:var(--danger); border-color:var(--danger-light); display:inline-flex; align-items:center; gap:6px;">${icon('alert-triangle', { size: 14 })} تقديم شكوى</button>
          <button class="btn btn-transactions" onclick="showOrderTransactions(${order.id})" title="سجل العمليات على الطلب">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            سجل العمليات
          </button>
        </div>
      </div>

      <div class="order-detail-grid">
        <div class="order-detail-field">
          <label>العميل</label>
          <span>${order.customerName}</span>
        </div>
        <div class="order-detail-field">
          <label>رقم الهاتف</label>
          <span dir="ltr" style="text-align:right;">${order.customerPhone}</span>
        </div>
        <div class="order-detail-field">
          <label>العنوان</label>
          <span>${order.address}</span>
        </div>
        <div class="order-detail-field">
          <label>الفرع</label>
          <span>${order.branchName}</span>
        </div>
        <div class="order-detail-field">
          <label>الموظف المسؤول</label>
          <span>${order.employeeName}</span>
        </div>
        <div class="order-detail-field">
          <label>الرقم اليومي</label>
          <span style="font-size:18px; font-weight:800; color:var(--primary);">${order.dailyNo}</span>
        </div>
        ${order.type === 'delivery' ? `
          <div class="order-detail-field order-detail-field-driver">
            <label>السائق</label>
            ${order.driverId ? `
              <div class="driver-detail-box">
                <div class="driver-detail-name">${icon('bike', { size: 14 })} ${order.driverName}</div>
                <div class="driver-detail-phone" dir="ltr">${order.driverPhone || ''}</div>
                ${order.driverAssignedAt ? `<div class="driver-detail-time">تم التحميل: ${formatTransactionTime(order.driverAssignedAt)}</div>` : ''}
              </div>
            ` : '<span style="color:var(--text-muted); font-weight:600;">لم يُعين سائق بعد</span>'}
          </div>
        ` : ''}
      </div>

      ${order.notes ? `
        <div style="background:var(--warning-light); padding:12px 16px; border-radius:var(--radius-sm); margin-bottom:16px; border-right:4px solid var(--warning);">
          <strong style="color:var(--warning); font-size:13px;">ملاحظات:</strong>
          <span style="font-size:14px; margin-right:8px;">${order.notes}</span>
        </div>
      ` : ''}

      <table class="order-items-table">
        <thead>
          <tr>
            <th style="text-align:right;">الصنف</th>
            <th style="text-align:center;">الكمية</th>
            <th style="text-align:right;">سعر الوحدة</th>
            <th style="text-align:right;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:20px;">
        <div style="width:300px; background:var(--bg); padding:16px; border-radius:var(--radius-sm);">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
            <span>المجموع الفرعي:</span>
            <span>${formatCurrency(order.subtotal)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px; padding-bottom:12px; border-bottom:1px solid var(--border);">
            <span>رسوم التوصيل:</span>
            <span>${formatCurrency(order.deliveryFee)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:800; color:var(--primary);">
            <span>الإجمالي:</span>
            <span>${formatCurrency(order.total)}</span>
          </div>
          <div style="margin-top:12px; text-align:center; font-size:12px; color:var(--text-muted); padding-top:12px; border-top:1px dashed var(--border);">
            طريقة الدفع: ${order.paymentLabel || getPaymentLabel(order.paymentChannel || 'phone', order.paymentMethod || 'cash')}
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Scroll to detail if in tabs
  if (context === 'tab') {
    setTimeout(() => {
      container.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);

    // Update status tracker tab
    updateOrderStatusTracker(order);
  }
}

// ==========================================
// CANCEL ORDER MODAL (مع اختيار سبب الإلغاء)
// ==========================================
function openCancelOrderModal(order) {
  return new Promise((resolve) => {
    const reasonsHtml = (typeof CANCELLATION_REASONS !== 'undefined' ? CANCELLATION_REASONS : []).map(r => `
      <button type="button" class="cancel-reason-option" data-reason-id="${r.id}" data-reason-label="${r.label}">
        <span class="cancel-reason-icon"><i class="${r.icon}"></i></span>
        <span class="cancel-reason-label">${r.label}</span>
        <span class="cancel-reason-check"><i class="fa-solid fa-check"></i></span>
      </button>
    `).join('');

    const modalHtml = `
      <div class="modal-header cc-header">
        <h3 class="modal-title">إلغاء الطلب</h3>
        <button class="modal-close" data-cc-action="cancel" type="button">×</button>
      </div>
      <div class="modal-body cc-body" style="text-align:start;">
        <div class="cc-icon cc-icon-danger" style="margin: 4px auto 14px;"><i class="fa-solid fa-circle-xmark"></i></div>
        <div class="cancel-confirm-body">
          <p class="cancel-confirm-text" style="text-align:center;">هل أنت متأكد من إلغاء هذا الطلب؟</p>
          <div class="cancel-confirm-order">
            <div class="cancel-confirm-row">
              <span class="cancel-confirm-label">رقم الفاتورة</span>
              <span class="cancel-confirm-value">#${order.invoiceNo}</span>
            </div>
            <div class="cancel-confirm-row">
              <span class="cancel-confirm-label">العميل</span>
              <span class="cancel-confirm-value">${order.customerName}</span>
            </div>
            <div class="cancel-confirm-row">
              <span class="cancel-confirm-label">الإجمالي</span>
              <span class="cancel-confirm-value">${formatCurrency(order.total)}</span>
            </div>
          </div>

          <div class="cancel-reason-step-label">اختر سبب الإلغاء</div>
          <div class="cancel-reasons-grid" id="cancel-reasons-grid">
            ${reasonsHtml}
          </div>

          <div class="cancel-other-wrap hidden" id="cancel-other-wrap">
            <label class="cancel-other-label" for="cancel-other-note">اكتب السبب بالتفصيل</label>
            <textarea id="cancel-other-note" placeholder="مثال: تأخر التوصيل لأكثر من ساعة..." rows="3"></textarea>
          </div>

          <div class="cancel-confirm-note"><i class="fa-solid fa-circle-info"></i> لا يمكن التراجع عن هذه العملية</div>
        </div>
      </div>
      <div class="modal-footer cc-footer">
        <button class="btn btn-secondary cc-btn" data-cc-action="cancel" type="button">تراجع</button>
        <button class="btn btn-danger cc-btn cc-btn-primary" id="cancel-confirm-btn" type="button" disabled>نعم، ألغِ الطلب</button>
      </div>
    `;

    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = modalHtml;
    overlay.classList.remove('hidden');

    let selectedReason = null;

    const grid = document.getElementById('cancel-reasons-grid');
    const otherWrap = document.getElementById('cancel-other-wrap');
    const otherNote = document.getElementById('cancel-other-note');
    const confirmBtn = document.getElementById('cancel-confirm-btn');

    const updateConfirmState = () => {
      let canConfirm = !!selectedReason;
      if (selectedReason && selectedReason.id === 'other') {
        canConfirm = !!(otherNote.value.trim());
      }
      confirmBtn.disabled = !canConfirm;
    };

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.cancel-reason-option');
      if (!btn) return;
      grid.querySelectorAll('.cancel-reason-option').forEach(o => o.classList.remove('selected'));
      btn.classList.add('selected');
      selectedReason = { id: btn.dataset.reasonId, label: btn.dataset.reasonLabel };
      otherWrap.classList.toggle('hidden', selectedReason.id !== 'other');
      if (selectedReason.id === 'other') {
        setTimeout(() => otherNote.focus(), 100);
      }
      updateConfirmState();
    });

    otherNote.addEventListener('input', updateConfirmState);

    const cleanup = (result) => {
      content.removeEventListener('click', clickHandler);
      document.removeEventListener('keydown', keyHandler);
      overlay.classList.add('hidden');
      resolve(result);
    };

    const clickHandler = (e) => {
      const target = e.target.closest('[data-cc-action]');
      if (!target) return;
      if (target.dataset.ccAction === 'cancel') {
        cleanup(null);
      }
    };

    confirmBtn.addEventListener('click', () => {
      if (confirmBtn.disabled || !selectedReason) return;
      const result = { id: selectedReason.id, label: selectedReason.label };
      if (selectedReason.id === 'other' && otherNote.value.trim()) {
        result.note = otherNote.value.trim();
        result.label = otherNote.value.trim();
      }
      cleanup(result);
    });

    const keyHandler = (e) => {
      if (e.key === 'Escape') cleanup(null);
    };

    content.addEventListener('click', clickHandler);
    document.addEventListener('keydown', keyHandler);
  });
}

async function updateOrderStatus(orderId, newStatus) {
  const orderIndex = AppState.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return;

  const order = AppState.orders[orderIndex];

  // If 'next' was passed, calculate the next logical status
  if (newStatus === 'next') {
    const statusFlow = ['new', 'preparing', 'ready', 'onway', 'delivered'];
    const currentIndex = statusFlow.indexOf(order.status);
    if (currentIndex < statusFlow.length - 1) {
      newStatus = statusFlow[currentIndex + 1];
    } else {
      return; // Already delivered or cancelled
    }
  }

  // Confirm cancellation - مع اختيار سبب الإلغاء
  let cancellationReason = null;
  if (newStatus === 'cancelled') {
    cancellationReason = await openCancelOrderModal(order);
    if (!cancellationReason) return; // المستخدم رفض/تراجع
  }

  const prevStatus = AppState.orders[orderIndex].status;
  const nowIso = new Date().toISOString();
  AppState.orders[orderIndex].status = newStatus;
  AppState.orders[orderIndex].updatedAt = nowIso;

  // لو إلغاء، احفظ السبب على الطلب
  if (newStatus === 'cancelled' && cancellationReason) {
    AppState.orders[orderIndex].cancellationReason = cancellationReason;
  }

  // سجل تغيير الحالة في تاريخ الطلب
  const statusObjNew = ORDER_STATUSES.find(s => s.id === newStatus);
  const statusObjOld = ORDER_STATUSES.find(s => s.id === prevStatus);
  AppState.orders[orderIndex].statusHistory = AppState.orders[orderIndex].statusHistory || [];
  const baseNote = `تغيير الحالة من "${statusObjOld ? statusObjOld.name : prevStatus}" إلى "${statusObjNew ? statusObjNew.name : newStatus}"`;
  const reasonNote = (newStatus === 'cancelled' && cancellationReason)
    ? `\nالسبب: ${cancellationReason.label}${cancellationReason.note ? ' — ' + cancellationReason.note : ''}`
    : '';
  AppState.orders[orderIndex].statusHistory.push({
    type: newStatus === 'cancelled' ? 'cancelled' : 'status',
    status: newStatus,
    fromStatus: prevStatus,
    at: nowIso,
    by: AppState.currentUser ? AppState.currentUser.name : 'موظف',
    cancellationReason: newStatus === 'cancelled' ? cancellationReason : undefined,
    note: baseNote + reasonNote
  });

  const statusObj = ORDER_STATUSES.find(s => s.id === newStatus);
  showToast(`تم تحديث حالة الطلب #${order.invoiceNo} إلى: ${statusObj.name}`, 'success');

  // Re-render views
  renderDeliveryOrders();
  renderAllOrders();
  updateDashboardStats();

  // If detail view is open for this order, re-render it
  const detailContainer = document.getElementById('order-detail-container');
  if (detailContainer.innerHTML.includes(order.invoiceNo)) {
    viewOrderDetail(order.id, 'tab', { force: true });
  }

  const allDetailContainer = document.getElementById('all-order-detail-container');
  if (allDetailContainer.innerHTML.includes(order.invoiceNo)) {
    viewOrderDetail(order.id, 'all', { force: true });
  }
}

function updateOrderStatusTracker(order) {
  const container = document.getElementById('order-status-content');
  if (!container) return;

  const statusFlow = ['new', 'preparing', 'ready', 'onway', 'delivered'];
  const currentIndex = statusFlow.indexOf(order.status);

  // If cancelled, show special state
  if (order.status === 'cancelled') {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" style="color:var(--danger);">${icon('x-circle', { size: 48 })}</div>
        <h3 class="empty-state-title" style="color:var(--danger);">الطلب ملغي</h3>
        <p class="empty-state-desc">تم إلغاء هذا الطلب</p>
      </div>
    `;
    return;
  }

  let html = `<div style="text-align:center; margin-bottom:30px;">
    <h3 style="font-size:18px; font-weight:800; color:var(--primary);">تتبع طلب #${order.invoiceNo}</h3>
    <p style="color:var(--text-secondary); font-size:14px; margin-top:4px;">العميل: ${order.customerName} | العنوان: ${order.address}</p>
  </div>
  <div class="status-tracker">`;

  statusFlow.forEach((status, index) => {
    const statusObj = ORDER_STATUSES.find(s => s.id === status);
    const isCompleted = index < currentIndex;
    const isActive = index === currentIndex;
    let stepClass = '';
    if (isCompleted) stepClass = 'completed';
    if (isActive) stepClass = 'active';

    html += `
      <div class="status-step ${stepClass}">
        <div class="status-step-icon">${isCompleted ? icon('check', { size: 16 }) : icon(statusObj.icon, { size: 16 })}</div>
        <div class="status-step-label">${statusObj.name}</div>
      </div>
    `;

    if (index < statusFlow.length - 1) {
      html += `<div class="status-connector ${index < currentIndex ? 'completed' : ''}"></div>`;
    }
  });

  html += `</div>`;
  container.innerHTML = html;
}

function searchOrderStatus() {
  const query = document.getElementById('status-search-input').value.trim().toLowerCase();
  const container = document.getElementById('order-status-content');
  if (!query) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('package', { size: 48 })}</div>
        <h3 class="empty-state-title">اختر طلب لمتابعة حالته</h3>
        <p class="empty-state-desc">ابحث برقم الفاتورة أو التليفون أو اضغط على أي طلب من جدول الطلبات</p>
      </div>`;
    return;
  }
  
  const order = AppState.orders.find(o => 
    o.invoiceNo.toLowerCase() === query || 
    o.customerPhone.includes(query)
  );
  
  if (order) {
    updateOrderStatusTracker(order);
  } else {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('search', { size: 48 })}</div>
        <h3 class="empty-state-title">لا يوجد طلب</h3>
        <p class="empty-state-desc">لم يتم العثور على طلب مطابق للبحث.</p>
      </div>`;
  }
}

// ==========================================
// ORDER HISTORY (MODAL)
// ==========================================
function showOrderHistory() {
  if (!AppState.currentCustomer) {
    showToast('يجب البحث عن عميل أولاً لرؤية سجل طلباته', 'warning');
    return;
  }

  const customerId = AppState.currentCustomer.id;
  const customerOrders = AppState.orders.filter(o => o.customerId === customerId)
                                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let contentHtml = '';

  if (customerOrders.length === 0) {
    contentHtml = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div class="empty-state-icon">${icon('clipboard-list', { size: 48 })}</div>
        <h3 class="empty-state-title">لا يوجد سجل طلبات</h3>
        <p class="empty-state-desc">هذا العميل لم يقم بأي طلبات سابقة.</p>
      </div>
    `;
  } else {
    contentHtml = `<div class="history-list">`;
    customerOrders.forEach(order => {
      contentHtml += `
        <div class="history-item" onclick="reorderItems(${order.id})">
          <div class="history-item-top">
            <span class="history-item-invoice">فاتورة #${order.invoiceNo}</span>
            <span class="history-item-date">${formatDate(order.createdAt)}</span>
          </div>
          <div class="history-item-bottom">
            <span>${getStatusBadge(order.status)}</span>
            <span style="font-weight:700;">${formatCurrency(order.total)}</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">
            اضغط لإعادة طلب نفس الأصناف
          </div>
        </div>
      `;
    });
    contentHtml += `</div>`;
  }

  const modalHtml = `
    <div class="modal-header">
      <h3 class="modal-title">سجل طلبات: ${AppState.currentCustomer.name}</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      ${contentHtml}
    </div>
  `;

  document.getElementById('modal-content').innerHTML = modalHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function reorderItems(orderId) {
  const order = AppState.orders.find(o => o.id === orderId);
  if (!order || !order.items) return;

  // Clone items to cart
  const newItems = order.items.map(item => ({
    ...item,
    cartItemId: Date.now().toString() + Math.random().toString(36).substr(2, 5) // new unique ID
  }));

  AppState.cart = [...AppState.cart, ...newItems];
  updateOrderNotesPreview();

  closeModal();
  renderCart();
  showToast('تمت إضافة أصناف الطلب السابق إلى السلة', 'success');

  // Switch to Menu tab to review/add more
  showTab('menu', document.querySelector('.tab-btn[data-tab="menu"]'));
}

// ==========================================
// THEME & MISC
// ==========================================
function toggleTheme() {
  const body = document.body;
  const btn = document.getElementById('btn-theme-toggle');
  
  if (body.classList.contains('dark-mode')) {
    body.classList.remove('dark-mode');
    btn.innerHTML = icon('moon', { size: 18 });
  } else {
    body.classList.add('dark-mode');
    btn.innerHTML = icon('sun', { size: 18 });
  }
  
  // Refresh charts if on reports view
  if (AppState.activeView === 'reports') {
    updateDashboardStats();
  }
}

function editOrder(orderId) {
  const order = AppState.orders.find(o => o.id === orderId);
  if (!order) return;

  // امسح أي override قديم وسجل أحداث قديم قبل تحميل الطلب
  AppState.branchOverrideId = null;
  AppState.deliveryFeeOverride = null;
  AppState.pendingOrderEvents = [];

  // Set current customer
  const customer = AppState.customers.find(c => c.id === order.customerId);
  if (customer) {
    loadCustomerData(customer);
  }

  // Load items to cart
  AppState.cart = [...order.items];

  // Set order type, payment channel + method, notes
  setOrderType(order.type || 'delivery');
  // back-compat: لو الطلب القديم معندوش paymentChannel، خليه phone افتراضياً
  if (order.paymentChannel) {
    setPaymentChannel(order.paymentChannel);
  } else {
    AppState.paymentChannel = 'phone';
  }
  if (order.paymentMethod) setPaymentMethod(order.paymentMethod);
  AppState.orderNotes = order.notes || '';
  updateOrderNotesPreview();

  // لو الطلب المحفوظ كان مرحل لفرع غير التلقائي، استعد ال override
  const autoBranchId = getAutoBranchId();
  if (order.branchId && autoBranchId && order.branchId !== autoBranchId) {
    AppState.branchOverrideId = order.branchId;
  }
  // لو الطلب المحفوظ فيه رسوم توصيل مختلفة عن الافتراضية، استعد الـ override
  if (order.type === 'delivery' && typeof order.deliveryFee === 'number' && Math.abs(order.deliveryFee - AppState.deliveryFee) > 0.001) {
    AppState.deliveryFeeOverride = order.deliveryFee;
  }
  updateCustomerInfoAddress();

  // Set editing state
  AppState.editingOrderId = order.id;
  
  renderCart();
  showToast('تم فتح الطلب للتعديل. يرجى مراجعة السلة.', 'info');
  
  // Navigate to New Order view and Menu tab
  showView('new-order', document.querySelector('.nav-item[data-view="new-order"]'));
  showTab('menu', document.querySelector('.tab-btn[data-tab="menu"]'));
}

// ==========================================
// ORDER TRANSACTION LOG (سجل العمليات على الطلب)
// ==========================================
function showOrderTransactions(orderId) {
  const order = AppState.orders.find(o => o.id === orderId);
  if (!order) return;

  // لو الطلب قديم ومعندوش statusHistory، ابنيها من الـ createdAt/updatedAt
  let history = order.statusHistory || [];
  if (history.length === 0) {
    history = [{
      type: 'created',
      status: 'new',
      at: order.createdAt,
      by: order.employeeName || 'موظف',
      note: 'تم إنشاء الطلب'
    }];
    if (order.status && order.status !== 'new') {
      const statusObj = ORDER_STATUSES.find(s => s.id === order.status);
      history.push({
        type: order.status === 'cancelled' ? 'cancelled' : 'status',
        status: order.status,
        at: order.updatedAt || order.createdAt,
        by: order.employeeName || 'موظف',
        note: `الحالة الحالية: ${statusObj ? statusObj.name : order.status}`
      });
    }
  }

  // رتب تنازلياً (الأحدث أولاً)
  const sorted = [...history].sort((a, b) => new Date(b.at) - new Date(a.at));

  // ابني timeline
  let timelineHtml = '';
  sorted.forEach((entry, idx) => {
    const meta = getTransactionMeta(entry);
    const timeLabel = formatTransactionTime(entry.at);
    timelineHtml += `
      <div class="txn-item ${idx === 0 ? 'txn-item-latest' : ''}">
        <div class="txn-icon" style="background:${meta.bg}; color:${meta.color};">
          ${icon(meta.icon, { size: 18 })}
        </div>
        <div class="txn-body">
          <div class="txn-row">
            <span class="txn-title">${meta.title}</span>
            <span class="txn-time">${timeLabel}</span>
          </div>
          ${entry.note ? `<div class="txn-note">${entry.note}</div>` : ''}
          ${entry.by ? `<div class="txn-by">${icon('user', { size: 12 })} ${entry.by}</div>` : ''}
        </div>
      </div>
    `;
  });

  const modalHtml = `
    <div class="modal-header">
      <h3 class="modal-title">سجل العمليات على الطلب #${order.invoiceNo}</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="padding:0;">
      <div class="txn-summary">
        <div class="txn-summary-item">
          <span class="txn-summary-label">العميل</span>
          <span class="txn-summary-value">${order.customerName}</span>
        </div>
        <div class="txn-summary-item">
          <span class="txn-summary-label">الحالة الحالية</span>
          <span class="txn-summary-value">${getStatusBadge(order.status)}</span>
        </div>
        <div class="txn-summary-item">
          <span class="txn-summary-label">عدد العمليات</span>
          <span class="txn-summary-value" style="font-weight:800; color:var(--primary);">${sorted.length}</span>
        </div>
      </div>
      <div class="txn-timeline">
        ${timelineHtml || '<div style="padding:20px; text-align:center; color:var(--text-muted);">لا توجد عمليات مسجلة</div>'}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="closeModal()">إغلاق</button>
    </div>
  `;

  document.getElementById('modal-content').innerHTML = modalHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function getTransactionMeta(entry) {
  switch (entry.type) {
    case 'item_added':
      return { icon: 'shopping-cart', title: `إضافة صنف: ${entry.itemName || ''}`, bg: 'rgba(59, 130, 246, 0.12)', color: '#1d4ed8' };
    case 'item_qty_up':
      return { icon: 'plus', title: `زيادة كمية: ${entry.itemName || ''}`, bg: 'rgba(16, 185, 129, 0.12)', color: '#047857' };
    case 'item_qty_down':
      return { icon: 'minus', title: `تقليل كمية: ${entry.itemName || ''}`, bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' };
    case 'item_removed':
      return { icon: 'trash', title: `حذف صنف: ${entry.itemName || ''}`, bg: 'rgba(239, 68, 68, 0.13)', color: '#b91c1c' };
    case 'item_edited':
      return { icon: 'edit', title: `تعديل صنف: ${entry.itemName || ''}`, bg: 'rgba(139, 92, 246, 0.14)', color: '#6d28d9' };
    case 'cart_cleared':
      return { icon: 'broom', title: 'تفريغ السلة', bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' };
    case 'driver_assigned':
      return { icon: 'bike', title: `تحميل على السائق: ${entry.driverName || ''}`, bg: 'rgba(6, 182, 212, 0.14)', color: '#0e7490' };
    case 'driver_unassigned':
      return { icon: 'ban', title: 'إلغاء تعيين السائق', bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' };
    case 'created':
      return { icon: 'check-circle', title: 'تأكيد الطلب', bg: 'rgba(37, 99, 235, 0.14)', color: '#1d4ed8' };
    case 'edited':
      return { icon: 'edit', title: 'تعديل الطلب', bg: 'rgba(139, 92, 246, 0.14)', color: '#6d28d9' };
    case 'complaint':
      return { icon: 'alert-triangle', title: 'تقديم شكوى', bg: 'rgba(239, 68, 68, 0.13)', color: '#b91c1c' };
    case 'cancelled':
      return { icon: 'x-circle', title: 'إلغاء الطلب', bg: 'rgba(239, 68, 68, 0.13)', color: '#b91c1c' };
    case 'status':
    default: {
      const statusObj = ORDER_STATUSES.find(s => s.id === entry.status);
      return {
        icon: statusObj ? statusObj.icon : 'history',
        title: statusObj ? `الحالة: ${statusObj.name}` : 'تحديث الحالة',
        bg: 'rgba(16, 185, 129, 0.12)',
        color: '#047857'
      };
    }
  }
}

function formatTransactionTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const date = d.toLocaleDateString('ar-KW', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${date} • ${time}`;
}

function showComplaintModal(orderId) {
  const order = AppState.orders.find(o => o.id === orderId);
  if (!order) return;

  const modalHtml = `
    <div class="modal-header">
      <h3 class="modal-title">تقديم شكوى على الطلب #${order.invoiceNo}</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label style="font-weight:700;">تفاصيل الشكوى</label>
        <textarea id="complaint-text" placeholder="اكتب تفاصيل الشكوى هنا..." style="width:100%; min-height:100px; padding:10px; border:1px solid var(--border); border-radius:6px; resize:vertical; font-family:inherit;"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-danger" onclick="submitComplaint(${order.id})">حفظ الشكوى</button>
    </div>
  `;

  document.getElementById('modal-content').innerHTML = modalHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function submitComplaint(orderId) {
  const text = document.getElementById('complaint-text').value.trim();
  if (!text) {
    showToast('الرجاء كتابة تفاصيل الشكوى', 'warning');
    return;
  }

  const orderIndex = AppState.orders.findIndex(o => o.id === orderId);
  if (orderIndex > -1) {
    AppState.orders[orderIndex].hasComplaint = true;
    AppState.orders[orderIndex].complaintText = text;

    // Add note to order notes
    AppState.orders[orderIndex].notes = (AppState.orders[orderIndex].notes ? AppState.orders[orderIndex].notes + '\\n\\n' : '') + 'شكوى: ' + text;

    // سجل عملية تقديم الشكوى في تاريخ الطلب
    AppState.orders[orderIndex].statusHistory = AppState.orders[orderIndex].statusHistory || [];
    AppState.orders[orderIndex].statusHistory.push({
      type: 'complaint',
      status: AppState.orders[orderIndex].status,
      at: new Date().toISOString(),
      by: AppState.currentUser ? AppState.currentUser.name : 'موظف',
      note: 'تم تقديم شكوى: ' + text
    });

    showToast('تم تسجيل الشكوى بنجاح', 'success');
    closeModal();
    
    // Refresh view
    renderDeliveryOrders();
    renderAllOrders();
    viewOrderDetail(orderId, 'all'); // or 'tab' depending on context, but this forces refresh
  }
}

// ==========================================
// REPORTS & DASHBOARD
// ==========================================
let employeeChartInstance = null;
let branchChartInstance = null;

function updateDashboardStats() {
  // الإحصائيات بتعتمد على يوم العمل (Business Date) مش التاريخ العادي
  const bd = AppState.businessDate || todayISO();
  const todaysOrders = AppState.orders.filter(o => (o.businessDate || (o.createdAt || '').slice(0, 10)) === bd);

  const totalOrders = todaysOrders.length;
  const deliveredOrders = todaysOrders.filter(o => o.status === 'delivered').length;
  const pendingOrders = todaysOrders.filter(o => ['new', 'preparing', 'ready', 'onway'].includes(o.status)).length;
  const revenue = todaysOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0);

  const totalEl = document.getElementById('stat-total-orders');
  const deliveredEl = document.getElementById('stat-delivered');
  const pendingEl = document.getElementById('stat-pending');
  const revenueEl = document.getElementById('stat-revenue');

  if (totalEl) totalEl.textContent = totalOrders;
  if (deliveredEl) deliveredEl.textContent = deliveredOrders;
  if (pendingEl) pendingEl.textContent = pendingOrders;
  if (revenueEl) revenueEl.textContent = revenue.toFixed(3);

  renderCharts(todaysOrders);
}

function renderCharts(orders) {
  // Aggregate revenue by employee
  const employeeRevenue = {};
  orders.forEach(o => {
    if (o.status !== 'cancelled') {
      employeeRevenue[o.employeeName] = (employeeRevenue[o.employeeName] || 0) + o.total;
    }
  });

  // Sort employee data
  const empLabels = Object.keys(employeeRevenue).sort((a, b) => employeeRevenue[b] - employeeRevenue[a]);
  const empData = empLabels.map(name => employeeRevenue[name]);

  // Aggregate revenue by branch
  const branchRevenue = {};
  orders.forEach(o => {
    if (o.status !== 'cancelled') {
      branchRevenue[o.branchName] = (branchRevenue[o.branchName] || 0) + o.total;
    }
  });

  const branchLabels = Object.keys(branchRevenue).sort((a, b) => branchRevenue[b] - branchRevenue[a]);
  const branchData = branchLabels.map(name => branchRevenue[name]);

  // Chart Colors based on dark mode or light mode
  const isDark = document.body.classList.contains('dark-mode');
  const textColor = isDark ? '#f9fafb' : '#1f2937';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  const chartOptions = {
    responsive: true,
    scales: {
      y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
      x: { grid: { color: gridColor }, ticks: { color: textColor } }
    },
    plugins: {
      legend: { display: false }
    }
  };

  // Employee Chart
  const ctxEmp = document.getElementById('employeeChart');
  if (ctxEmp) {
    if (employeeChartInstance) employeeChartInstance.destroy();
    employeeChartInstance = new Chart(ctxEmp, {
      type: 'bar',
      data: {
        labels: empLabels,
        datasets: [{
          label: 'الإيرادات (د.ك)',
          data: empData,
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: chartOptions
    });
  }

  // Branch Chart
  const ctxBranch = document.getElementById('branchChart');
  if (ctxBranch) {
    if (branchChartInstance) branchChartInstance.destroy();
    branchChartInstance = new Chart(ctxBranch, {
      type: 'bar',
      data: {
        labels: branchLabels,
        datasets: [{
          label: 'الإيرادات (د.ك)',
          data: branchData,
          backgroundColor: '#10b981',
          borderRadius: 4
        }]
      },
      options: chartOptions
    });
  }
}

// ==========================================
// SETTINGS
// ==========================================
function renderEmployeesList() {
  const tbody = document.getElementById('employees-table-body');
  if (!tbody) return;

  let html = '';
  AppState.employees.forEach(emp => {
    let roleBadge = '';
    if (emp.role === 'admin') roleBadge = '<span class="info-branch-badge" style="background:var(--danger-light); color:var(--danger);">مدير</span>';
    else if (emp.role === 'supervisor') roleBadge = '<span class="info-branch-badge" style="background:var(--warning-light); color:var(--warning);">مشرف</span>';
    else roleBadge = '<span class="info-branch-badge">موظف</span>';

    html += `
      <tr>
        <td style="font-weight:600;">${emp.name}</td>
        <td dir="ltr" style="text-align:right;">${emp.username}</td>
        <td>${roleBadge}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function getItemAvailabilityMeta(itemId) {
  const availableBranches = [];
  const disabledBranches = [];

  AppState.branches.forEach(branch => {
    const disabledItems = AppState.disabledBranchItems[branch.id] || [];
    if (disabledItems.includes(itemId)) {
      disabledBranches.push(branch);
    } else {
      availableBranches.push(branch);
    }
  });

  return { availableBranches, disabledBranches };
}

function renderFullItemsView() {
  const container = document.getElementById('full-items-view-list');
  if (!container) return;

  let html = '';
  AppState.menuCategories.forEach(cat => {
    if (cat.id === 'all') return;

    const catItems = AppState.menuItems.filter(item => item.categoryId === cat.id);
    if (!catItems.length) return;

    html += `
      <div class="category-section">
        <div class="category-section-title">
          <span>${cat.icon} ${cat.name}</span>
          <span class="category-section-subtitle">${cat.nameEn}</span>
        </div>
        <div class="item-availability-grid">
    `;

    catItems.forEach(item => {
      const meta = getItemAvailabilityMeta(item.id);
      const total = AppState.branches.length;
      const statusClass = meta.disabledBranches.length === 0 ? 'available' : meta.availableBranches.length === 0 ? 'disabled' : 'mixed';
      const statusText = meta.disabledBranches.length === 0 ? 'متاح' : meta.availableBranches.length === 0 ? 'موقوف' : 'متفاوت';

      html += `
        <div class="item-availability-card" onclick="openItemAvailabilityModal(${item.id})">
          <div class="item-availability-top">
            <div class="item-availability-name">${item.name}</div>
            <span class="availability-chip ${statusClass}">${statusText}</span>
          </div>
          <div class="item-availability-meta">
            <span>السعر: ${formatCurrency(item.price)}</span>
            <span>متاح في ${meta.availableBranches.length}/${total}</span>
            <span>موقوف في ${meta.disabledBranches.length}</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html || '<div class="sidebar-item-empty">لا توجد أصناف</div>';
}

function renderStoppedItemsView() {
  const container = document.getElementById('stopped-items-view-list');
  if (!container) return;

  let html = '';
  let totalStopped = 0;

  AppState.branches.forEach(branch => {
    const disabledIds = AppState.disabledBranchItems[branch.id] || [];
    const items = AppState.menuItems.filter(item => disabledIds.includes(item.id));

    if (!items.length) return;
    totalStopped += items.length;

    html += `
      <div class="branch-section">
        <div class="branch-section-title">
          <span>${branch.name}</span>
          <span class="branch-section-count">${items.length} صنف</span>
        </div>
        <div class="item-availability-grid">
    `;

    items.forEach(item => {
      html += `
        <div class="item-availability-card disabled" onclick="openItemAvailabilityModal(${item.id})">
          <div class="item-availability-top">
            <div class="item-availability-name">${item.name}</div>
            <span class="availability-chip disabled">موقوف</span>
          </div>
          <div class="item-availability-meta">
            <span>السعر: ${formatCurrency(item.price)}</span>
            <span>اضغط لعرض الفروع</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  if (!html) {
    html = '<div class="sidebar-item-empty">لا توجد أصناف موقوفة في أي فرع</div>';
  }

  container.innerHTML = html;
}

function renderBranchItemsSettings(branchId) {
  const container = document.getElementById('settings-branch-items-list');
  if (!container) return;

  const branchIdInt = parseInt(branchId);
  const disabledItems = AppState.disabledBranchItems[branchIdInt] || [];

  // اقرأ فلاتر التصنيف والبحث
  const catSelect = document.getElementById('settings-availability-category');
  const searchInput = document.getElementById('settings-availability-search');
  const activeCategory = catSelect ? catSelect.value : 'all';
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let html = '';
  let totalShown = 0;

  // Render items grouped by category (excluding 'all')
  AppState.menuCategories.forEach(cat => {
    if (cat.id === 'all') return;
    // فلتر التصنيف
    if (activeCategory !== 'all' && activeCategory !== cat.id) return;

    let catItems = AppState.menuItems.filter(item => item.categoryId === cat.id);
    // فلتر البحث
    if (searchQuery) {
      catItems = catItems.filter(item =>
        (item.name || '').toLowerCase().includes(searchQuery) ||
        (item.nameEn || '').toLowerCase().includes(searchQuery)
      );
    }
    if (catItems.length === 0) return;

    let itemsHtml = '';
    catItems.forEach(item => {
      const isAvailable = !disabledItems.includes(item.id);
      itemsHtml += `
        <div class="settings-item-row">
          <div class="settings-item-row-info">
            <span class="settings-item-row-name">${item.name}</span>
            <span class="settings-item-row-name-en">${item.nameEn}</span>
          </div>
          <label class="availability-switch">
            <input type="checkbox" ${isAvailable ? 'checked' : ''} onchange="toggleBranchItemAvailability(${branchIdInt}, ${item.id}, this.checked)">
            <span class="availability-slider"></span>
          </label>
        </div>
      `;
    });

    totalShown += catItems.length;

    html += `
      <div class="settings-cat-section">
        <h4 class="settings-cat-title">
          <span>${cat.icon}</span>
          <span>${cat.name} (${cat.nameEn})</span>
          <span class="settings-cat-count">${catItems.length}</span>
        </h4>
        <div class="settings-items-grid">
          ${itemsHtml}
        </div>
      </div>
    `;
  });

  if (totalShown === 0) {
    html = `
      <div class="settings-empty">
        <i class="fa-solid fa-magnifying-glass"></i>
        <div>لا توجد أصناف تطابق الفلتر الحالي</div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function populateAvailabilityCategoryFilter() {
  const sel = document.getElementById('settings-availability-category');
  if (!sel) return;
  let html = '<option value="all">كل التصنيفات</option>';
  AppState.menuCategories.forEach(cat => {
    if (cat.id === 'all') return;
    html += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
  });
  sel.innerHTML = html;
}

function onAvailabilityBranchChange(branchId) {
  renderBranchItemsSettings(branchId);
}

function onAvailabilityCategoryChange(_categoryId) {
  const branchSelect = document.getElementById('settings-availability-branch');
  const branchId = branchSelect ? branchSelect.value : (AppState.branches[0] && AppState.branches[0].id);
  renderBranchItemsSettings(branchId);
}

function onAvailabilitySearchChange(_query) {
  const branchSelect = document.getElementById('settings-availability-branch');
  const branchId = branchSelect ? branchSelect.value : (AppState.branches[0] && AppState.branches[0].id);
  renderBranchItemsSettings(branchId);
}

function getBranchAvailabilitySummary(itemId) {
  const availableBranches = [];
  const disabledBranches = [];

  AppState.branches.forEach(branch => {
    const disabledItems = AppState.disabledBranchItems[branch.id] || [];
    if (disabledItems.includes(itemId)) {
      disabledBranches.push(branch);
    } else {
      availableBranches.push(branch);
    }
  });

  return { availableBranches, disabledBranches };
}

function getCurrentBranchDisabledItems() {
  const branchId = AppState.currentBranch ? AppState.currentBranch.id : 1;
  return AppState.disabledBranchItems[branchId] || [];
}

function renderSidebarDisabledPanel() {
  const listEl = document.getElementById('sidebar-disabled-list');
  const countEl = document.getElementById('disabled-panel-count');
  const labelEl = document.getElementById('disabled-panel-label');
  if (!listEl || !countEl || !labelEl) return;

  const branch = AppState.currentBranch || AppState.branches[0];
  const branchId = branch ? branch.id : 1;
  const disabledItems = AppState.disabledBranchItems[branchId] || [];

  labelEl.textContent = `أصناف موقوفة${branch ? ' - ' + branch.name : ''}`;

  const total = disabledItems.length;
  if (total > 0) {
    countEl.textContent = total;
    countEl.style.display = 'inline-block';
  } else {
    countEl.style.display = 'none';
  }

  if (total === 0) {
    listEl.innerHTML = `<div class="sidebar-disabled-empty">${icon('check-circle', { size: 14 })} لا توجد أصناف موقوفة في هذا الفرع</div>`;
    return;
  }

  let html = '';
  disabledItems.forEach(itemId => {
    const item = AppState.menuItems.find(i => i.id === itemId);
    if (!item) return;
    const category = AppState.menuCategories.find(c => c.id === item.categoryId);
    const catIcon = category ? category.icon : '🍽️';
    html += `
      <div class="sidebar-disabled-item" onclick="openItemAvailabilityModal(${item.id})">
        <div class="sidebar-disabled-item-info">
          <span class="sidebar-disabled-item-name">${catIcon} ${item.name}</span>
          <span class="sidebar-disabled-item-branch">${branch ? branch.name : 'هذا الفرع'}</span>
        </div>
        <button class="sidebar-disabled-item-activate" onclick="event.stopPropagation(); openItemAvailabilityModal(${item.id})">
          الفروع
        </button>
      </div>
    `;
  });

  listEl.innerHTML = html;
}

function renderSidebarItemsPanel() {
  const listEl = document.getElementById('sidebar-items-list');
  const countEl = document.getElementById('items-panel-count');
  const searchWrap = document.getElementById('sidebar-items-search-wrap');
  const searchInput = document.getElementById('sidebar-items-search');
  if (!listEl || !countEl) return;

  const currentBranch = AppState.currentBranch || AppState.branches[0];
  const currentBranchId = currentBranch ? currentBranch.id : 1;
  const currentDisabled = AppState.disabledBranchItems[currentBranchId] || [];
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  countEl.textContent = query ? AppState.menuItems.filter(item => item.name.toLowerCase().includes(query) || (item.nameEn || '').toLowerCase().includes(query)).length : AppState.menuItems.length;
  if (searchWrap) searchWrap.style.display = itemsPanelOpen ? 'block' : 'none';

  let html = '';
  AppState.menuCategories.forEach(cat => {
    if (cat.id === 'all') return;

    const catItems = AppState.menuItems.filter(item => {
      if (item.categoryId !== cat.id) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query) || (item.nameEn || '').toLowerCase().includes(query);
    });
    if (!catItems.length) return;

    html += `<div class="sidebar-item-category">`;
    html += `<div class="sidebar-item-category-title">${cat.name}</div>`;

    catItems.forEach(item => {
      const summary = getBranchAvailabilitySummary(item.id);
      const isDisabledHere = currentDisabled.includes(item.id);
      const statusClass = summary.disabledBranches.length === 0
        ? 'available'
        : summary.availableBranches.length === 0
          ? 'disabled'
          : 'mixed';
      const statusText = summary.disabledBranches.length === 0
        ? 'متاح'
        : summary.availableBranches.length === 0
          ? 'موقوف'
          : 'متعدد';
      const branchText = `${summary.availableBranches.length} متاح / ${summary.disabledBranches.length} موقوف`;

      html += `
        <div class="sidebar-item-row ${isDisabledHere ? 'disabled' : ''}" onclick="openItemAvailabilityModal(${item.id})">
          <div class="sidebar-item-info">
            <span class="sidebar-item-name">${item.name}</span>
            <span class="sidebar-item-branches">${branchText}</span>
          </div>
          <span class="sidebar-item-status ${statusClass}">${statusText}</span>
        </div>
      `;
    });

    html += `</div>`;
  });

  listEl.innerHTML = html || `<div class="sidebar-item-empty">لا توجد أصناف</div>`;
}

function filterSidebarItemsPanel(query) {
  renderSidebarItemsPanel();
}

function buildAvailabilityModal(item) {
  const category = AppState.menuCategories.find(c => c.id === item.categoryId);
  const catIcon = category ? category.icon : '🍽️';
  const availabilityRows = AppState.branches.map(branch => {
    const disabledItems = AppState.disabledBranchItems[branch.id] || [];
    const isAvailable = !disabledItems.includes(item.id);
    const areasText = branch.areas.slice(0, 3).join('، ') + (branch.areas.length > 3 ? '...' : '');

    return `
      <div class="availability-branch-row ${isAvailable ? 'available' : 'disabled'}">
        <div class="availability-branch-left">
          <div class="availability-branch-name">${branch.name}</div>
          <div class="availability-branch-areas">${areasText}</div>
        </div>
        <button type="button" class="availability-branch-badge ${isAvailable ? 'on' : 'off'}" onclick="event.stopPropagation(); toggleBranchItemAvailability(${branch.id}, ${item.id}, ${!isAvailable})">
          ${isAvailable ? `متاح ${icon('check', { size: 12 })}` : `موقوف ${icon('x', { size: 12 })}`}
        </button>
      </div>
    `;
  }).join('');

  const summary = getBranchAvailabilitySummary(item.id);
  const totalBranches = AppState.branches.length;

  return `
    <div class="modal-header">
      <h3 class="modal-title">إتاحة الصنف عبر الفروع</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="item-modal-header">
        <div class="item-modal-icon">${catIcon}</div>
        <div class="item-modal-name">${item.name}</div>
        <div class="item-modal-price">${formatCurrency(item.price)}</div>
        <p style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">${item.nameEn || ''}</p>
        <p style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">متاح في ${summary.availableBranches.length} من ${totalBranches} فروع</p>
      </div>
      <div class="availability-modal-list">
        ${availabilityRows}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إغلاق</button>
    </div>
  `;
}

function openItemAvailabilityModal(itemId) {
  const item = AppState.menuItems.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('modal-content').innerHTML = buildAvailabilityModal(item);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function toggleBranchItemAvailability(branchId, itemId, isAvailable) {
  if (!AppState.disabledBranchItems[branchId]) {
    AppState.disabledBranchItems[branchId] = [];
  }

  const index = AppState.disabledBranchItems[branchId].indexOf(itemId);

  const item = AppState.menuItems.find(i => i.id === itemId);
  const branch = AppState.branches.find(b => b.id === branchId);
  const itemName = item ? item.name : 'الصنف';
  const branchName = branch ? branch.name : 'الفرع';

  if (isAvailable) {
    // Remove from disabled list
    if (index > -1) {
      AppState.disabledBranchItems[branchId].splice(index, 1);
    }
    showToast(`تم تنشيط وإتاحة ${itemName} في ${branchName}`, 'success');
  } else {
    // Add to disabled list
    if (index === -1) {
      AppState.disabledBranchItems[branchId].push(itemId);
    }
    showToast(`تم تعطيل وإيقاف ${itemName} في ${branchName}`, 'warning');
  }

  // Persist to localStorage
  localStorage.setItem('pos_disabled_branch_items', JSON.stringify(AppState.disabledBranchItems));

  // Refresh menu displays in case it's currently viewed
  refreshMenuDisplay();

  // Refresh cart rendering in case item status changes
  renderCart();

  // Refresh availability modal immediately so the row color updates in place
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.querySelector('.modal-title');
  if (modalOverlay && !modalOverlay.classList.contains('hidden') && modalTitle && modalTitle.textContent.includes('إتاحة الصنف')) {
    openItemAvailabilityModal(itemId);
  }

  renderSidebarDisabledPanel();

  // Also refresh the settings branch list if open (keep toggles in sync)
  const availBranchSelect = document.getElementById('settings-availability-branch');
  if (availBranchSelect && availBranchSelect.value) {
    renderBranchItemsSettings(availBranchSelect.value);
  }

  // حدث شاشة "الأصناف الموقوفة" لو مفتوحة علشان الصنف اللي اتنشط يختفي فوراً
  const stoppedView = document.getElementById('view-stopped-items');
  if (stoppedView && stoppedView.classList.contains('active') && typeof renderStoppedItemsView === 'function') {
    renderStoppedItemsView();
  }

  // وكمان شاشة "الأصناف" الكاملة لو مفتوحة
  const itemsView = document.getElementById('view-items');
  if (itemsView && itemsView.classList.contains('active') && typeof renderFullItemsView === 'function') {
    renderFullItemsView();
  }
}


// ==========================================
// DISABLED ITEMS QUICK PANEL
// ==========================================
let disabledPanelOpen = false;

function quickActivateItem(branchId, itemId) {
  // Re-enable this item in the given branch
  toggleBranchItemAvailability(branchId, itemId, true);

  // Auto-open panel if it was closed so user sees the update
  if (!disabledPanelOpen) {
    // keep closed, just update count
  }
}

function toggleDisabledPanel() {
  disabledPanelOpen = !disabledPanelOpen;
  const listEl = document.getElementById('sidebar-disabled-list');
  const chevron = document.getElementById('disabled-panel-chevron');

  if (disabledPanelOpen) {
    listEl.style.display = 'block';
    if (chevron) chevron.classList.add('open');
    renderSidebarDisabledPanel();
  } else {
    listEl.style.display = 'none';
    if (chevron) chevron.classList.remove('open');
  }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'x-circle';
  if (type === 'warning') iconName = 'alert-triangle';

  toast.innerHTML = `
    <div class="toast-icon">${icon(iconName, { size: 20 })}</div>
    <div class="toast-message">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideInLeft 0.3s ease reverse forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}
