<script setup lang="ts">
import { computed } from 'vue'
import { state, deliveryOrdersFiltered, clearTabOrderFilters, viewOrderDetail } from '../store'
import { t } from '../lang'
import { icon } from '../icons'
import { ORDER_STATUSES } from '../data'
import OrderDetail from './OrderDetail.vue'

const orders = computed<any[]>(() => deliveryOrdersFiltered())

// نقلاً عن getStatusBadge
function statusBadge(status: string): string {
  const s = ORDER_STATUSES.find((x: any) => x.id === status)
  if (!s) return `<span class="status-badge">غير معروف</span>`
  return `<span class="status-badge status-${status}">${icon(s.icon, { size: 13 })} ${s.name}</span>`
}
// نقلاً عن getDriverCellHtml
function driverCell(order: any): string {
  if (order.type !== 'delivery') return '<span style="color:var(--text-muted); font-size:12px;">—</span>'
  if (order.driverId && order.driverName) {
    return `<div class="driver-cell"><span class="driver-cell-name">${icon('bike', { size: 14 })} ${order.driverName}</span><span class="driver-cell-phone" dir="ltr">${order.driverPhone || ''}</span></div>`
  }
  return '<span class="driver-cell-empty">لم يُعين بعد</span>'
}
function typeCell(order: any): string {
  return `<span style="display:inline-flex; align-items:center; gap:6px;"><span style="color:var(--primary); display:inline-flex;">${icon(order.type === 'pickup' ? 'store' : 'bike', { size: 16 })}</span> ${order.type === 'pickup' ? 'استلام' : 'توصيل'}</span>`
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
          <option value="new">جديد</option>
          <option value="preparing">جاري التحضير</option>
          <option value="ready">جاهز</option>
          <option value="onway">في الطريق</option>
          <option value="delivered">تم التسليم</option>
          <option value="cancelled">ملغي</option>
        </select>
      </div>
      <div>
        <button class="btn btn-secondary btn-sm" @click="clearTabOrderFilters()" style="padding: 8px 16px; white-space: nowrap; font-size: 13px;">إعادة تعيين</button>
      </div>
    </div>
    <div class="orders-table-wrapper">
      <table class="orders-table" id="orders-table">
        <thead>
          <tr>
            <th>الرقم اليومي</th>
            <th>رقم الفاتورة</th>
            <th>اسم الموظف</th>
            <th>النوع</th>
            <th>الجوال</th>
            <th>الحالة</th>
            <th>السائق</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody id="orders-table-body">
          <tr v-if="orders.length === 0"><td colspan="8" style="text-align:center; padding:30px;">لا توجد طلبات توصيل في يوم العمل الحالي</td></tr>
          <tr v-for="order in orders" :key="order.id" :class="{ 'order-row-cancelled': order.status === 'cancelled' }" @click="viewOrderDetail(order.id)">
            <td style="font-weight:700; font-size:16px;">{{ order.dailyNo }}</td>
            <td>#{{ order.invoiceNo }}</td>
            <td>{{ order.employeeName }}</td>
            <td><span v-html="typeCell(order)"></span></td>
            <td dir="ltr" style="text-align:right;">{{ order.customerPhone }}</td>
            <td><span v-html="statusBadge(order.status)"></span> <span v-if="order.hasComplaint" title="يوجد شكوى" style="color:var(--danger); display:inline-flex; vertical-align:middle;" v-html="icon('alert-triangle', { size: 14 })"></span></td>
            <td><span v-html="driverCell(order)"></span></td>
            <td>
              <button class="btn btn-sm btn-outline" @click.stop="viewOrderDetail(order.id, 'tab')">تفاصيل</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div id="order-detail-container">
      <OrderDetail v-if="state.openOrderId" :order-id="state.openOrderId" />
    </div>
  </div>
</template>
