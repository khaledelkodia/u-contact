<script setup lang="ts">
import { computed } from 'vue'
import { tx, nameOf } from '../lang'
import { state, searchOrderStatus, viewOrderDetail, canViewOrderTotals, phoneShow } from '../store'
import { t } from '../lang'
import { icon } from '../icons'
import { ORDER_STATUSES } from '../data'
import { formatCurrency, formatTxnClock } from '../utils'

// نفس شارة الحالة المستعملة في الجدولين — لا شكلٌ ثالثٌ للحالة نفسها
function statusBadge(status: string): string {
  const s = ORDER_STATUSES.find((x: any) => x.id === status)
  if (!s) return `<span class="status-badge">${tx('غير معروف', 'Unknown')}</span>`
  return `<span class="status-badge status-${status}">${icon(s.icon, { size: 13 })} ${nameOf(s)}</span>`
}

const results = computed<any[]>(() => (Array.isArray(state.statusResult) ? state.statusResult : []))
const showTotals = computed(() => canViewOrderTotals())
</script>

<template>
  <div id="panel-order-status" class="tab-panel" :class="{ active: state.activeTab === 'order-status' }">
    <div class="search-bar-container" style="margin-bottom: 16px; display: flex; gap: 10px;">
      <input type="text" id="status-search-input"
        :placeholder="tx('رقم الفاتورة أو الطلب اليومي أو الهاتف أو رقم المنصّة…', 'Invoice, daily no., phone or platform no.…')"
        style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid var(--border);"
        v-model="state.statusSearch" @keyup.enter="searchOrderStatus()">
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
        <!-- نقول أين بحثنا: نتيجةٌ فارغة بلا نطاقٍ معلوم تُقرأ «الطلب غير موجود» وهو موجودٌ أمس -->
        <p class="empty-state-desc">{{ tx('لا طلب مطابق في طلبات يوم العمل المفتوح.', 'No matching order in the open business day.') }}</p>
      </div>
      <!-- النتائج: كلُّها لا أوّلها، وكلُّ بطاقةٍ تفتح لوحة التفاصيل الكاملة -->
      <div v-else class="os-list">
        <p class="os-count">
          {{ results.length === 1 ? tx('نتيجة واحدة', 'One result')
             : tx(`${results.length} نتائج — الأحدث أولاً`, `${results.length} results — newest first`) }}
        </p>
        <div v-for="o in results" :key="o.id" class="os-card" :class="{ open: state.openOrderId === o.id }"
          @click="viewOrderDetail(o.id, 'status')"
          :title="tx('اضغط لعرض التفاصيل الكاملة', 'Click for full details')">
          <div class="os-row">
            <strong class="os-inv">{{ tx('فاتورة', 'Invoice') }} #{{ o.invoiceNo }}</strong>
            <span v-if="showTotals" class="os-total">{{ formatCurrency(o.total) }}</span>
          </div>
          <!-- الحالة أوّلاً: هي سبب هذا التبويب أصلاً، وكانت لا تُعرَض إطلاقاً -->
          <div class="os-row os-status-row">
            <span v-html="statusBadge(o.status)"></span>
            <span v-if="o.driverName" class="os-driver"><span v-html="icon('bike', { size: 13 })"></span> {{ o.driverName }}</span>
            <span class="os-time">{{ formatTxnClock(o.createdAt) }}</span>
          </div>
          <div class="os-meta">{{ o.customerName }} — <span dir="ltr">{{ phoneShow(o.customerPhone) }}</span></div>
          <div class="os-meta">{{ o.branchName }} · {{ tx('طلب رقم', 'Order no.') }} {{ o.dailyNo }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.os-count { font-size: 11.5px; font-weight: 700; color: var(--text-muted, #94a3b8); margin-bottom: 8px; }
.os-list { display: flex; flex-direction: column; gap: 10px; }
/* بطاقةٌ تُنقَر: نفس لغة بطاقات العناوين — حافّةٌ تتلوّن، وشريطٌ في أوّل المفتوحة */
.os-card {
  background: var(--white, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
}
.os-card:hover { border-color: var(--primary, #1a56db); box-shadow: 0 2px 8px rgba(15, 23, 42, .08); }
.os-card.open { border-color: var(--primary, #1a56db); box-shadow: inset -3px 0 0 0 var(--primary, #1a56db); }
:global([dir="ltr"]) .os-card.open { box-shadow: inset 3px 0 0 0 var(--primary, #1a56db); }
.os-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.os-status-row { justify-content: flex-start; gap: 10px; margin: 7px 0 5px; flex-wrap: wrap; }
.os-inv { font-size: 13.5px; }
.os-total { font-weight: 800; font-size: 13.5px; white-space: nowrap; }
.os-driver { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #64748b); }
.os-time { font-size: 11px; font-weight: 700; color: var(--text-muted, #94a3b8); margin-inline-start: auto; }
.os-meta { font-size: 12px; color: var(--text-muted, #94a3b8); line-height: 1.6; }
</style>
