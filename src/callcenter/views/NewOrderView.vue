<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  state, searchCustomer, showNewCustomerForm, showOrderHistory, showTab,
  toggleBranchOverride, closeBranchOverrideMenu, selectBranchOverride, resetBranchOverride,
  getAutoBranchId, infoBranchName, infoAddress, customerTodayCount, resolvedBranchStatus,
  customerFlag, customerFlagLabel,
  viewOrderDetail,
} from '../store'
import { t, tx } from '../lang'
import { icon } from '../icons'
import CustomerTab from '../components/CustomerTab.vue'
import MenuTab from '../components/MenuTab.vue'
import DeliveryOrdersTab from '../components/DeliveryOrdersTab.vue'
import OrderStatusTab from '../components/OrderStatusTab.vue'
import CartPanel from '../components/CartPanel.vue'
import OrderDetail from '../components/OrderDetail.vue'
import CartModals from '../components/CartModals.vue'

const wrapRoot = ref<HTMLElement | null>(null)

const todayCount = computed(() => customerTodayCount())
const autoBranchId = computed(() => getAutoBranchId())

/**
 * تفاصيل الطلب المفتوح تحلّ محلّ السلّة — لا تحت صفّه.
 *
 * جدول التوصيل عريض، وفتحُ اللوحة تحت الصفّ يدفع بقيّة الصفوف بعيداً فيفقد
 * الوكيل مكانه في القائمة. وعمود السلّة فارغٌ في هذه اللحظة (لا يُبنى طلبٌ
 * جديد أثناء متابعة طلبٍ قائم) — فهو المكان الطبيعيّ لها، بعرضٍ ثابتٍ لا يزحزح شيئاً.
 * والمسوّدة لا تُمَسّ: العرضُ وحده يتبدّل، وتعود كما هي بإغلاق التفاصيل.
 */
const orderInCart = computed(() => (state.activeTab === 'delivery-orders' || state.activeTab === 'order-status') && !!state.openOrderId)
const overrideActiveId = computed(() => state.branchOverrideId || autoBranchId.value)
// جاهزيّة الفرع الذي سيستقبل هذا الطلب. null = لم يُحدَّد فرع بعد ⇒ لا شريط.
// يعتمد على state.branches (يتحدّث مع تحميل البيانات) وعلى الفرع المشتقّ من العنوان،
// فيتغيّر تلقائياً بمجرّد اختيار المنطقة أو تبديل الفرع يدوياً.
const branchStatus = computed(() => resolvedBranchStatus())

function handleOutside(e: MouseEvent) {
  if (state.branchMenuOpen && wrapRoot.value && !wrapRoot.value.contains(e.target as Node)) closeBranchOverrideMenu()
}
onMounted(() => document.addEventListener('click', handleOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleOutside))
</script>

<template>
  <section id="view-new-order" class="view active">
    <div class="new-order-layout">

      <!-- ORDER MAIN CONTENT (RIGHT IN RTL) -->
      <div class="order-main">

        <!-- Customer Search -->
        <div class="customer-search-section">
          <div class="search-box">
            <span class="search-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
            <input type="text" id="customer-phone-search" :placeholder="t('customer_phone_placeholder')" maxlength="15" v-model="state.phoneSearch" @keypress.enter="searchCustomer()">
            <button class="btn-search" @click="searchCustomer()"><span>{{ t('search') }}</span></button>
          </div>
          <button class="btn-new-customer" @click="showNewCustomerForm()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            <span>{{ t('add_customer') }}</span>
          </button>
          <button class="btn-order-history" @click="showOrderHistory()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>{{ t('order_history') }}</span>
          </button>
        </div>

        <!-- Customer Info Bar -->
        <div id="customer-info-bar" class="customer-info-bar" :class="{ hidden: !state.showCustomerInfo }">
          <div class="info-item">
            <span class="info-label">{{ t('customer_label') }}</span>
            <!-- نفس علامة حقل الاسم: الشريط هو ما تراه العين أوّلاً وهي مفتوحةٌ طوال
                 المكالمة، فحصرُ اللون في تبويب البيانات يخفيه ما إن ينتقل الوكيل للمنيو. -->
            <span class="info-value" id="info-name" :class="customerFlag() ? 'ifl-' + customerFlag() : null"
              :title="customerFlagLabel() || undefined">{{ state.currentCustomer?.name || '-' }}</span>
            <span class="info-customer-today" :class="{ hidden: todayCount === 0 }" id="info-customer-today" :title="tx('هذا العميل لديه طلب في يوم العمل الحالي', 'This customer already has an order in the current business day')">
              <span class="today-dot"></span>
              <span class="today-text">{{ tx('طلب اليوم', 'Today’s order') }}</span>
              <span class="today-count" id="info-customer-today-count">{{ todayCount }}</span>
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('phone_label') }}</span>
            <span class="info-value" id="info-phone">{{ state.currentCustomer?.phone || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('address_label') }}</span>
            <span class="info-value" id="info-address">{{ infoAddress() }}</span>
          </div>
          <div class="info-item info-item-branch">
            <span class="info-label">{{ t('branch_label') }}</span>
            <span class="info-value info-branch-badge" id="info-branch">{{ infoBranchName() }}</span>
            <span class="info-branch-override-tag" :class="{ hidden: !state.branchOverrideId }" id="info-branch-override-tag" :title="tx('الفرع تم تغييره يدوياً', 'Branch was changed manually')">{{ tx('يدوي', 'Manual') }}</span>
            <div class="branch-override-wrap" ref="wrapRoot">
              <button type="button" class="btn-change-branch" :class="{ open: state.branchMenuOpen }" id="btn-change-branch" @click="toggleBranchOverride()" :title="tx('تغيير الفرع المسؤول عن الطلب', 'Change the branch handling this order')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                <span>{{ tx('تغيير الفرع', 'Change branch') }}</span>
              </button>
              <div class="branch-override-menu" :class="{ hidden: !state.branchMenuOpen }" id="branch-override-menu">
                <div class="branch-override-title">{{ tx('اختر الفرع الذي سينفذ الطلب', 'Choose the branch that will fulfil the order') }}</div>
                <div class="branch-override-list" id="branch-override-list">
                  <button v-for="b in state.branches" :key="b.id" type="button" class="branch-override-option" :class="{ active: b.id === overrideActiveId }" @click="selectBranchOverride(b.id)">
                    <span>
                      {{ b.name }}<span v-if="b.id === autoBranchId" style="opacity:0.7; font-weight:500; font-size:11px;"> ({{ tx('تلقائي', 'auto') }})</span>
                      <!-- حالة الفرع بجوار اسمه: الاختيار اليدوي بلا معرفة الحالة يوقف الطلب صامتاً -->
                      <span v-if="b.ready === false" :title="b.holdMessage || ''"
                            style="margin-inline-start:6px; font-size:10px; font-weight:800; color:#b45309;">● {{ tx('واقف', 'On hold') }}</span>
                      <span v-else-if="b.online" style="margin-inline-start:6px; font-size:10px; font-weight:800; color:#059669;">● {{ tx('متصل', 'Online') }}</span>
                    </span>
                    <span v-if="b.id === overrideActiveId" class="check" v-html="icon('check', { size: 14 })"></span>
                  </button>
                </div>
                <button type="button" class="branch-override-reset" :class="{ hidden: !state.branchOverrideId }" id="branch-override-reset" @click="resetBranchOverride()">↺ {{ tx('رجوع للفرع التلقائي', 'Back to the automatic branch') }}</button>
              </div>
            </div>
          </div>
          <div class="info-item info-item-alert" :class="{ hidden: !state.currentCustomer?.isBlacklisted }" id="blacklist-alert">
            <span class="blacklist-alert-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></span>
            <span class="blacklist-alert-text">{{ tx('العميل في القائمة السوداء', 'Customer is blacklisted') }}</span>
          </div>
        </div>

        <!-- حالة الفرع: هل يصل الطلب المطبخ الآن أم يقف؟ -->
        <!-- الفرع يسحب طلباته بنفسه حين يكون متصلاً وعلى نفس يوم العمل؛ وإلا وقف الطلب
             في الكلاود صامتاً (لا يضيع، لكن لا أحد في المطبخ يراه). يظهر هذا الشريط قبل
             أن يَعِد الوكيل العميل بموعد. -->
        <div v-if="branchStatus && !branchStatus.ready" class="branch-hold-bar">
          <span class="bh-icon">⚠</span>
          <span>{{ branchStatus.holdMessage }}</span>
          <span class="bh-meta">{{ branchStatus.name }}</span>
        </div>
        <div v-else-if="branchStatus" class="branch-hold-bar is-ready">
          <span class="bh-icon">✓</span>
          <span>{{ tx('الفرع متصل ويومه مطابق — الطلب ينزل فوراً.', 'Branch is online and on the same business day — the order goes through immediately.') }}</span>
          <span class="bh-meta">{{ branchStatus.name }}</span>
        </div>

        <!-- Content Tabs -->
        <div class="content-tabs">
          <button class="tab-btn" :class="{ active: state.activeTab === 'customer-data' }" data-tab="customer-data" @click="showTab('customer-data')">{{ t('customer_data') }}</button>
          <button class="tab-btn" :class="{ active: state.activeTab === 'menu' }" data-tab="menu" @click="showTab('menu')">{{ t('menu') }}</button>
          <button class="tab-btn" :class="{ active: state.activeTab === 'delivery-orders' }" data-tab="delivery-orders" @click="showTab('delivery-orders')">{{ t('delivery_orders_tab') }}</button>
          <button class="tab-btn" :class="{ active: state.activeTab === 'order-status' }" data-tab="order-status" @click="showTab('order-status')">{{ t('order_status_tab') }}</button>
        </div>

        <!-- Tab Panels -->
        <div class="tab-panels">
          <CustomerTab />
          <MenuTab />
          <DeliveryOrdersTab />
          <OrderStatusTab />
        </div>
      </div>

      <!-- CART PANEL (LEFT IN RTL) — أو تفاصيل الطلب المفتوح من تبويب التوصيل -->
      <div v-if="orderInCart" class="cart-panel cart-panel-detail">
        <div class="cpd-head">
          <span class="cpd-title">{{ tx('تفاصيل الطلب', 'Order details') }}</span>
          <button type="button" class="cpd-close" @click="viewOrderDetail(state.openOrderId)"
            :title="tx('رجوع للسلّة', 'Back to the cart')" v-html="icon('x', { size: 15 })"></button>
        </div>
        <div class="cpd-body"><OrderDetail :order-id="state.openOrderId" /></div>
      </div>
      <CartPanel v-else />

    </div>
    <!-- مودالات السلة: ملاحظات · رسوم التوصيل · سجل العميل · المراجعة -->
    <CartModals />
  </section>
</template>

<style scoped>
/* علامةُ حالة العميل — حبّةٌ واحدة على الاسم في الشريط (والحقل يبقى أبيض: لونان
   لمعنًى واحد يشتّتان، والشريط هو المفتوح طوال المكالمة).
   نقطةٌ قبل الاسم تقول الحالة حتى لمن لا يميّز الألوان، وتدرّجٌ خفيف وظلٌّ يرفعانها
   عن الشريط فتُقرأ حبّةً لا خلفيّةً ملوّنة. */
#info-name.ifl-today, #info-name.ifl-comment, #info-name.ifl-blocked {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 11px; border-radius: 999px;
  font-weight: 800; letter-spacing: .01em; line-height: 1.7;
  box-shadow: 0 1px 3px rgba(15, 23, 42, .18);
}
#info-name.ifl-today::before, #info-name.ifl-comment::before, #info-name.ifl-blocked::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%;
  background: currentColor; opacity: .8; flex-shrink: 0;
}
#info-name.ifl-today   { background-image: linear-gradient(135deg, #22c55e, #15803d); color: #fff; }
#info-name.ifl-comment { background-image: linear-gradient(135deg, #fbbf24, #d97706); color: #3f2004; }
#info-name.ifl-blocked { background-image: linear-gradient(135deg, #f87171, #b91c1c); color: #fff; }
/* عمود التفاصيل: نفس هيكل السلّة (عرضٌ ثابت · لاصقٌ · عمود) + رأسٌ ثابتٌ وجسمٌ يمرّر. */
.cart-panel-detail { padding: 0; }
.cpd-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--border, #e5e7eb); flex-shrink: 0;
}
.cpd-title { font-size: 13px; font-weight: 800; color: var(--text-primary, #0f172a); }
.cpd-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: none; border-radius: 8px;
  background: transparent; color: var(--text-muted, #94a3b8); cursor: pointer;
  transition: background .14s, color .14s;
}
.cpd-close:hover { background: var(--bg, #f8fafc); color: var(--text-primary, #0f172a); }
/* الجسم وحده يمرّر — الرأس يبقى مرئيّاً مهما طال الطلب */
.cpd-body { flex: 1; overflow-y: auto; padding: 12px 14px; }
/* اللوحة داخل عمودٍ ضيّق: بلا هوامشَ ولا ظلٍّ يضيّقانها أكثر */
.cpd-body :deep(.order-detail-panel) { margin: 0; padding: 0; box-shadow: none; background: transparent; }
</style>
