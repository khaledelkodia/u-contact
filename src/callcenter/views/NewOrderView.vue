<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  state, searchCustomer, showNewCustomerForm, showOrderHistory, showTab,
  toggleBranchOverride, closeBranchOverrideMenu, selectBranchOverride, resetBranchOverride,
  getAutoBranchId, infoBranchName, infoAddress, customerTodayCount, resolvedBranchStatus,
} from '../store'
import { t } from '../lang'
import { icon } from '../icons'
import CustomerTab from '../components/CustomerTab.vue'
import MenuTab from '../components/MenuTab.vue'
import DeliveryOrdersTab from '../components/DeliveryOrdersTab.vue'
import OrderStatusTab from '../components/OrderStatusTab.vue'
import CartPanel from '../components/CartPanel.vue'
import CartModals from '../components/CartModals.vue'

const wrapRoot = ref<HTMLElement | null>(null)

const todayCount = computed(() => customerTodayCount())
const autoBranchId = computed(() => getAutoBranchId())
const overrideActiveId = computed(() => state.branchOverrideId || autoBranchId.value)
// جاهزيّة الفرع الذي سيستقبل هذا الأوردر. null = لم يُحدَّد فرع بعد ⇒ لا شريط.
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
            <span class="info-value" id="info-name" :class="{ 'info-name-today': todayCount > 0 }">{{ state.currentCustomer?.name || '-' }}</span>
            <span class="info-customer-today" :class="{ hidden: todayCount === 0 }" id="info-customer-today" title="هذا العميل لديه طلب في يوم العمل الحالي">
              <span class="today-dot"></span>
              <span class="today-text">طلب اليوم</span>
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
            <span class="info-branch-override-tag" :class="{ hidden: !state.branchOverrideId }" id="info-branch-override-tag" title="الفرع تم تغييره يدوياً">يدوي</span>
            <div class="branch-override-wrap" ref="wrapRoot">
              <button type="button" class="btn-change-branch" :class="{ open: state.branchMenuOpen }" id="btn-change-branch" @click="toggleBranchOverride()" title="تغيير الفرع المسؤول عن الطلب">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                <span>تغيير الفرع</span>
              </button>
              <div class="branch-override-menu" :class="{ hidden: !state.branchMenuOpen }" id="branch-override-menu">
                <div class="branch-override-title">اختر الفرع الذي سينفذ الطلب</div>
                <div class="branch-override-list" id="branch-override-list">
                  <button v-for="b in state.branches" :key="b.id" type="button" class="branch-override-option" :class="{ active: b.id === overrideActiveId }" @click="selectBranchOverride(b.id)">
                    <span>
                      {{ b.name }}<span v-if="b.id === autoBranchId" style="opacity:0.7; font-weight:500; font-size:11px;"> (تلقائي)</span>
                      <!-- حالة الفرع بجوار اسمه: الاختيار اليدوي بلا معرفة الحالة يوقف الأوردر صامتاً -->
                      <span v-if="b.ready === false" :title="b.holdMessage || ''"
                            style="margin-inline-start:6px; font-size:10px; font-weight:800; color:#b45309;">● واقف</span>
                      <span v-else-if="b.online" style="margin-inline-start:6px; font-size:10px; font-weight:800; color:#059669;">● متصل</span>
                    </span>
                    <span v-if="b.id === overrideActiveId" class="check" v-html="icon('check', { size: 14 })"></span>
                  </button>
                </div>
                <button type="button" class="branch-override-reset" :class="{ hidden: !state.branchOverrideId }" id="branch-override-reset" @click="resetBranchOverride()">↺ رجوع للفرع التلقائي</button>
              </div>
            </div>
          </div>
          <div class="info-item info-item-alert" :class="{ hidden: !state.currentCustomer?.isBlacklisted }" id="blacklist-alert">
            <span class="blacklist-alert-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></span>
            <span class="blacklist-alert-text">العميل في القائمة السوداء</span>
          </div>
        </div>

        <!-- حالة الفرع: هل يصل الأوردر المطبخ الآن أم يقف؟ -->
        <!-- الفرع يسحب أوردراته بنفسه حين يكون متصلاً وعلى نفس يوم العمل؛ وإلا وقف الأوردر
             في الكلاود صامتاً (لا يضيع، لكن لا أحد في المطبخ يراه). يظهر هذا الشريط قبل
             أن يَعِد الوكيل العميل بموعد. -->
        <div v-if="branchStatus && !branchStatus.ready" class="branch-hold-bar">
          <span class="bh-icon">⚠</span>
          <span>{{ branchStatus.holdMessage }}</span>
          <span class="bh-meta">{{ branchStatus.name }}</span>
        </div>
        <div v-else-if="branchStatus" class="branch-hold-bar is-ready">
          <span class="bh-icon">✓</span>
          <span>الفرع متصل ويومه مطابق — الأوردر ينزل فوراً.</span>
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

      <!-- CART PANEL (LEFT IN RTL) -->
      <CartPanel />

    </div>
    <!-- مودالات السلة: ملاحظات · رسوم التوصيل · سجل العميل · المراجعة -->
    <CartModals />
  </section>
</template>
