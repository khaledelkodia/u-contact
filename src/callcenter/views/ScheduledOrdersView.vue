<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { tx } from '../lang'
import { state, scheduledOrdersFiltered, clearScheduledFilters, viewOrderDetail } from '../store'
import { icon } from '../icons'
import { formatCurrency, formatDate } from '../utils'
import OrderDetail from '../components/OrderDetail.vue'
import Pager from '../components/Pager.vue'

const allRows = computed<any[]>(() => scheduledOrdersFiltered())

// ── الصفحات ─────────────────────────────────────────────────────────────────
const page = ref(1)
const pageSize = ref(25)
const total = computed(() => allRows.value.length)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
watch([() => state.schedFilterInvoice, () => state.schedFilterPhone, () => state.schedFilterBranch,
       () => state.schedFilterType, () => state.schedFilterFrom, () => state.schedFilterTo, pageSize],
      () => { page.value = 1 })
watch(pageCount, (n) => { if (page.value > n) page.value = n })
const orders = computed(() => allRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

// نقلاً عن typeCell (توصيل/استلام) — كان النصّ عربياً ثابتاً فلا يتبع لغة الواجهة
function typeCell(order: any): string {
  const typeIconName = order.type === 'delivery' ? 'bike' : 'store'
  const typeName = order.type === 'delivery' ? tx('توصيل', 'Delivery') : tx('استلام', 'Pickup')
  return `<span style="display:inline-flex; align-items:center; gap:6px;">${icon(typeIconName, { size: 16 })} ${typeName}</span>`
}
</script>

<template>
  <section id="view-scheduled-orders" class="view active">
    <div class="orders-section">
      <div class="orders-header" style="margin-bottom: 12px;">
        <div>
          <h2 class="orders-title">{{ tx('الطلبات المجدولة', 'Scheduled orders') }}</h2>
        </div>
      </div>

      <!-- الفلاتر: الشاشة كانت بلا فلترٍ إطلاقاً — قائمةٌ تطول بلا سبيلٍ لحجزٍ بعينه -->
      <div class="orders-search-filter-bar" style="display: flex; gap: 12px; align-items: center; background: var(--white); padding: 16px; border-radius: var(--radius-lg); margin-bottom: 20px; box-shadow: var(--shadow-sm); flex-wrap: wrap; border: 1px solid var(--border-light);">
        <div style="flex: 1.5; min-width: 170px;">
          <input type="text" id="sched-search-invoice" :placeholder="tx('رقم الفاتورة...', 'Invoice no.…')" v-model="state.schedFilterInvoice" style="padding: 10px 14px;">
        </div>
        <div style="flex: 1.5; min-width: 170px;">
          <input type="text" id="sched-search-phone" :placeholder="tx('رقم الموبايل...', 'Mobile no.…')" v-model="state.schedFilterPhone" style="padding: 10px 14px;">
        </div>
        <div style="flex: 1; min-width: 150px;">
          <select id="sched-filter-branch" v-model="state.schedFilterBranch" style="padding: 10px 14px;">
            <option value="">{{ tx('كل الفروع', 'All branches') }}</option>
            <option v-for="b in state.branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
          </select>
        </div>
        <div style="flex: 1; min-width: 140px;">
          <select id="sched-filter-type" v-model="state.schedFilterType" style="padding: 10px 14px;">
            <option value="">{{ tx('كل الأنواع', 'All types') }}</option>
            <option value="delivery">{{ tx('توصيل', 'Delivery') }}</option>
            <option value="pickup">{{ tx('استلام', 'Pickup') }}</option>
          </select>
        </div>
        <!-- مدى تاريخ الجدولة: أكثر ما يُبحث به في الحجوزات — «حجوزات بكرة» -->
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <label style="font-size:12px; font-weight:700; color:var(--text-secondary);">{{ tx('من', 'From') }}</label>
          <input type="date" id="sched-filter-from" v-model="state.schedFilterFrom" style="padding: 9px 12px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-secondary);">{{ tx('إلى', 'To') }}</label>
          <input type="date" id="sched-filter-to" v-model="state.schedFilterTo" style="padding: 9px 12px;">
        </div>
        <div>
          <button class="btn btn-secondary" @click="clearScheduledFilters()" style="padding: 10px 20px; white-space: nowrap;">{{ tx('إعادة تعيين', 'Reset') }}</button>
        </div>
      </div>

      <!-- الجدول ولوحة التفاصيل جنباً إلى جنب — كانت اللوحة تحت الجدول فلا تُرى إلا بتمرير -->
      <div class="od-split" :class="{ 'has-detail': state.openOrderId }">
        <div class="od-main">
          <div class="orders-table-wrapper">
            <table class="orders-table">
              <thead>
                <tr>
                  <th>{{ tx('تاريخ الجدولة', 'Scheduled for') }}</th>
                  <th>{{ tx('رقم الفاتورة', 'Invoice no.') }}</th>
                  <th>{{ tx('العميل', 'Customer') }}</th>
                  <th>{{ tx('الفرع', 'Branch') }}</th>
                  <th>{{ tx('النوع', 'Type') }}</th>
                  <th>{{ tx('الإجمالي', 'Total') }}</th>
                  <th>{{ tx('إجراءات', 'Actions') }}</th>
                </tr>
              </thead>
              <tbody id="scheduled-orders-table-body">
                <tr v-if="orders.length === 0"><td colspan="7" style="text-align:center; padding:30px;">{{ tx('لا توجد طلبات مجدولة', 'No scheduled orders') }}</td></tr>
                <tr v-for="order in orders" :key="order.id"
                    :class="{ 'row-open': state.openOrderId === order.id }"
                    @click="viewOrderDetail(order.id, 'scheduled')">
                  <td style="font-weight:700; color:var(--primary);">{{ formatDate(order.scheduledDate) }}</td>
                  <td style="font-weight:700;">#{{ order.invoiceNo }}</td>
                  <td>
                    <div style="font-weight:600;">{{ order.customerName }}</div>
                    <div style="font-size:11px; color:var(--text-muted);" dir="ltr">{{ order.customerPhone }}</div>
                  </td>
                  <td>{{ order.branchName }}</td>
                  <td><span v-html="typeCell(order)"></span></td>
                  <td style="font-weight:700;">{{ formatCurrency(order.total) }}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" @click.stop="viewOrderDetail(order.id, 'scheduled')">{{ tx('تفاصيل', 'Details') }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
        </div>

        <div v-if="state.openOrderId" id="scheduled-order-detail-container" class="od-detail">
          <OrderDetail :order-id="state.openOrderId" />
        </div>
      </div>
    </div>
  </section>
</template>
