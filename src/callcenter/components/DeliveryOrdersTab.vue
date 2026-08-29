<script setup lang="ts">
import { computed } from 'vue'
import { state, deliveryOrdersFiltered, clearTabOrderFilters, viewOrderDetail, canViewOrderTotals } from '../store'
import { t, tx, nameOf } from '../lang'
import { formatCurrency, formatDate } from '../utils'
import { icon } from '../icons'
import { ORDER_STATUSES } from '../data'

const orders = computed<any[]>(() => deliveryOrdersFiltered())
// القيمة النهائية عمودٌ بصلاحية مستقلّة: من يتابع الحالات ليس بالضرورة من يرى الأرقام
const showTotals = computed(() => canViewOrderTotals())
const colCount = computed(() => (showTotals.value ? 11 : 10))

// نقلاً عن getStatusBadge
function statusBadge(status: string): string {
  const s = ORDER_STATUSES.find((x: any) => x.id === status)
  if (!s) return `<span class="status-badge">${tx('غير معروف', 'Unknown')}</span>`
  return `<span class="status-badge status-${status}">${icon(s.icon, { size: 13 })} ${nameOf(s)}</span>`
}
// نقلاً عن getDriverCellHtml
function driverCell(order: any): string {
  if (order.type !== 'delivery') return '<span style="color:var(--text-muted); font-size:12px;">—</span>'
  if (order.driverId && order.driverName) {
    return `<div class="driver-cell"><span class="driver-cell-name">${icon('bike', { size: 14 })} ${order.driverName}</span><span class="driver-cell-phone" dir="ltr">${order.driverPhone || ''}</span></div>`
  }
  // نصٌّ داخل HTML مبنيّ بالسلاسل — لا تراه مسوحُ القوالب فبقي عربياً
  return `<span class="driver-cell-empty">${tx('لم يُعين بعد', 'Not assigned yet')}</span>`
}
// الصف الآتي من حجزٍ يحمل وسمه وموعده في التلميح — وإلا بدا طلباً عادياً
// ظهر فجأةً في جدول اليوم بلا سبب.
function schedChip(order: any): string {
  if (!order.scheduledDate) return ''
  return `<span class="sched-chip" title="${tx('موعد الحجز:', 'Scheduled for:')} ${formatDate(order.scheduledDate)}">${icon('clock', { size: 11 })} ${tx('مجدول', 'Scheduled')}</span>`
}
function typeCell(order: any): string {
  return `<span style="display:inline-flex; align-items:center; gap:6px;"><span style="color:var(--primary); display:inline-flex;">${icon(order.type === 'pickup' ? 'store' : 'bike', { size: 16 })}</span> ${order.type === 'pickup' ? tx('استلام', 'Pickup') : tx('توصيل', 'Delivery')}</span>${schedChip(order)}`
}
</script>

<template>
  <div id="panel-delivery-orders" class="tab-panel" :class="{ active: state.activeTab === 'delivery-orders' }">
    <div class="orders-header" style="margin-bottom: 10px;">
      <h3 class="orders-title">{{ t('delivery_orders_title') }}</h3>
    </div>

    <div class="orders-search-filter-bar" style="display: flex; gap: 10px; align-items: center; background: var(--white); padding: 12px; border-radius: var(--radius); margin-bottom: 16px; box-shadow: var(--shadow-sm); flex-wrap: wrap; border: 1px solid var(--border-light);">
      <div style="flex: 1.5; min-width: 140px;">
        <input type="text" id="tab-search-invoice" :placeholder="t('search_invoice')" v-model="state.filterInvoice" style="padding: 8px 12px; font-size: 13px;">
      </div>
      <div style="flex: 1.5; min-width: 140px;">
        <input type="text" id="tab-search-phone" :placeholder="t('search_phone')" v-model="state.filterPhone" style="padding: 8px 12px; font-size: 13px;">
      </div>
      <div style="flex: 1; min-width: 120px;">
        <select id="filter-status" v-model="state.filterStatus" style="padding: 8px 12px; font-size: 13px;">
          <option value="">{{ t('all_status') }}</option>
          <option value="sent">{{ tx('لم يصل الفرع', 'Sent') }}</option>
          <option value="new">{{ tx('جديد', 'New') }}</option>
          <option value="preparing">{{ tx('جاري التحضير', 'Preparing') }}</option>
          <option value="ready">{{ tx('جاهز', 'Ready') }}</option>
          <option value="withdriver">{{ tx('مع السائق', 'Assigned') }}</option>
          <option value="onway">{{ tx('في الطريق', 'On the way') }}</option>
          <option value="delivered">{{ tx('مغلق', 'Closed') }}</option>
          <option value="cancelled">{{ tx('ملغي', 'Cancelled') }}</option>
        </select>
      </div>
      <div>
        <button class="btn btn-secondary btn-sm" @click="clearTabOrderFilters()" style="padding: 8px 16px; white-space: nowrap; font-size: 13px;">{{ tx('إعادة تعيين', 'Reset') }}</button>
      </div>
    </div>
    <div class="orders-table-wrapper">
      <table class="orders-table" id="orders-table">
        <thead>
          <tr>
            <th>{{ tx('الرقم اليومي', 'Daily no.') }}</th>
            <th>{{ tx('رقم الفاتورة', 'Invoice no.') }}</th>
            <th>{{ tx('اسم الموظف', 'Agent') }}</th>
            <th>{{ tx('النوع', 'Type') }}</th>
            <th>{{ tx('رقم الطلب الخارجي', 'External no.') }}</th>
            <th v-if="showTotals">{{ tx('القيمة النهائية', 'Final value') }}</th>
            <th>{{ tx('الجوال', 'Mobile') }}</th>
            <th>{{ tx('الحالة', 'Status') }}</th>
            <th>{{ tx('السائق', 'Driver') }}</th>
            <th>{{ tx('إجراءات', 'Actions') }}</th>
          </tr>
        </thead>
        <tbody id="orders-table-body">
          <tr v-if="orders.length === 0"><td :colspan="colCount" style="text-align:center; padding:30px;">{{ tx('لا توجد طلبات توصيل في يوم العمل الحالي', 'No delivery orders in the current business day') }}</td></tr>
          <template v-for="order in orders" :key="order.id">
          <tr :class="{ 'order-row-cancelled': order.status === 'cancelled', 'row-open': state.openOrderId === order.id }" @click="viewOrderDetail(order.id, 'tab')">
            <td style="font-weight:700; font-size:16px;">{{ order.dailyNo }}</td>
            <td>
              #{{ order.invoiceNo }}
              <!-- رقم المنصّة الخارجية: يقارنه الوكيل بما يقوله العميل -->
              <span v-if="order.orderTag" class="order-tag" dir="ltr">{{ order.orderTag }}</span>
            </td>
            <td>{{ order.employeeName }}</td>
            <td><span v-html="typeCell(order)"></span></td>
            <td>
              <span v-if="order.orderTag" class="order-tag" dir="ltr">{{ order.orderTag }}</span>
              <span v-else style="color:var(--text-muted);">—</span>
            </td>
            <td v-if="showTotals" style="font-weight:800;">{{ formatCurrency(order.total) }}</td>
            <td class="ltr-num">{{ order.customerPhone }}</td>
            <td><span v-html="statusBadge(order.status)"></span> <span v-if="order.hasComplaint" :title="tx('يوجد شكوى', 'Has a complaint')" style="color:var(--danger); display:inline-flex; vertical-align:middle;" v-html="icon('alert-triangle', { size: 14 })"></span></td>
            <td><span v-html="driverCell(order)"></span></td>
            <td>
              <button class="btn btn-sm btn-outline" @click.stop="viewOrderDetail(order.id, 'tab')">{{ tx('تفاصيل', 'Details') }}</button>
            </td>
          </tr>
          <!-- لا لوحةَ تحت الصفّ: التفاصيل تُعرَض في عمود السلّة (`NewOrderView`),
               فلا تُزحزَح الصفوف ولا يفقد الوكيل مكانه. ويبقى `row-open` وحده
               ليدلّ على الصفّ المعروض. -->
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
