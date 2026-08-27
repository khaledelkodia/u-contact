<script setup lang="ts">
import { tx } from '../lang'
import { state, searchOrderStatus } from '../store'
import { t } from '../lang'
import { icon } from '../icons'
import { formatCurrency } from '../utils'
</script>

<template>
  <div id="panel-order-status" class="tab-panel" :class="{ active: state.activeTab === 'order-status' }">
    <div class="search-bar-container" style="margin-bottom: 20px; display: flex; gap: 10px;">
      <input type="text" id="status-search-input" :placeholder="tx('ابحث برقم الفاتورة أو الهاتف...', 'Search by invoice no. or phone…')" style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid var(--border);" v-model="state.statusSearch" @keyup.enter="searchOrderStatus()">
      <button class="btn btn-primary" @click="searchOrderStatus()">{{ tx('بحث', 'Search') }}</button>
    </div>
    <div id="order-status-content">
      <!-- حالة ابتدائية: لم يُبحث بعد -->
      <div v-if="state.statusResult === undefined" class="empty-state">
        <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
        <h3 class="empty-state-title">{{ t('choose_order_status') }}</h3>
        <p class="empty-state-desc">{{ t('status_help') }}</p>
      </div>
      <!-- لا يوجد طلب مطابق -->
      <div v-else-if="state.statusResult === null" class="empty-state">
        <div class="empty-state-icon" v-html="icon('search', { size: 48 })"></div>
        <h3 class="empty-state-title">{{ tx('لا يوجد طلب', 'No order') }}</h3>
        <p class="empty-state-desc">{{ tx('لم يتم العثور على طلب مطابق للبحث.', 'No order matched your search.') }}</p>
      </div>
      <!-- نتيجة مبسّطة (متتبّع الحالة الكامل في مرحلة لاحقة) -->
      <div v-else class="order-status-result" style="background: var(--white); padding: 18px; border-radius: var(--radius); box-shadow: var(--shadow-sm); border: 1px solid var(--border-light);">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <strong>{{ tx('فاتورة', 'Invoice') }} #{{ state.statusResult.invoiceNo }}</strong>
          <span style="font-weight:700;">{{ formatCurrency(state.statusResult.total) }}</span>
        </div>
        <div style="color:var(--text-muted); font-size:13px;">{{ state.statusResult.customerName }} — {{ state.statusResult.customerPhone }}</div>
        <div style="margin-top:8px;">{{ state.statusResult.branchName }}</div>
      </div>
    </div>
  </div>
</template>
