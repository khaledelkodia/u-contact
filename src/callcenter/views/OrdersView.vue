<script setup lang="ts">
import { computed } from 'vue'
import { state, allOrdersFiltered, clearAllOrderFilters, viewOrderDetail } from '../store'
import { icon } from '../icons'
import { ORDER_STATUSES } from '../data'
import { formatCurrency } from '../utils'
import { tx, nameOf } from '../lang'
import OrderDetail from '../components/OrderDetail.vue'

const orders = computed<any[]>(() => allOrdersFiltered())

// نقلاً عن getStatusBadge
function statusBadge(status: string): string {
  const s = ORDER_STATUSES.find((x: any) => x.id === status)
  if (!s) return `<span class="status-badge">غير معروف</span>`
  return `<span class="status-badge status-${status}">${icon(s.icon, { size: 13 })} ${nameOf(s)}</span>`
}
// نقلاً عن getDriverCellHtml
function driverCell(order: any): string {
  if (order.type !== 'delivery') return '<span style="color:var(--text-muted); font-size:12px;">—</span>'
  if (order.driverId && order.driverName) {
    return `<div class="driver-cell"><span class="driver-cell-name">${icon('bike', { size: 14 })} ${order.driverName}</span><span class="driver-cell-phone" dir="ltr">${order.driverPhone || ''}</span></div>`
  }
  return '<span class="driver-cell-empty">لم يُعين بعد</span>'
}
// نقلاً عن typeCell (توصيل/استلام)
function typeCell(order: any): string {
  const typeIconName = order.type === 'delivery' ? 'bike' : 'store'
  const typeName = order.type === 'delivery' ? 'توصيل' : 'استلام'
  return `<span style="display:inline-flex; align-items:center; gap:6px;">${icon(typeIconName, { size: 16 })} ${typeName}</span>`
}
</script>

<template>
  <section id="view-orders" class="view active">
    <div class="orders-section">
      <div class="orders-header" style="margin-bottom: 12px;">
        <div>
          <h2 class="orders-title">{{ tx('جميع طلبات التوصيل', 'All delivery orders') }}</h2>
        </div>
      </div>

      <!-- Search & Filter Bar (Main version) -->
      <div class="orders-search-filter-bar" style="display: flex; gap: 12px; align-items: center; background: var(--white); padding: 16px; border-radius: var(--radius-lg); margin-bottom: 20px; box-shadow: var(--shadow-sm); flex-wrap: wrap; border: 1px solid var(--border-light);">
        <div style="flex: 1.5; min-width: 180px;">
          <input type="text" id="all-search-invoice" :placeholder="tx('رقم الفاتورة...', 'Invoice no.…')" v-model="state.allFilterInvoice" style="padding: 10px 14px;">
        </div>
        <div style="flex: 1.5; min-width: 180px;">
          <input type="text" id="all-search-phone" :placeholder="tx('رقم الموبايل...', 'Mobile no.…')" v-model="state.allFilterPhone" style="padding: 10px 14px;">
        </div>
        <div style="flex: 1; min-width: 160px;">
          <select id="all-filter-status" v-model="state.allFilterStatus" style="padding: 10px 14px;">
            <option value="">{{ tx('كل الحالات', 'All statuses') }}</option>
            <option value="new">{{ tx('جديد', 'New') }}</option>
            <option value="preparing">{{ tx('جاري التحضير', 'Preparing') }}</option>
            <option value="ready">{{ tx('جاهز', 'Ready') }}</option>
            <option value="onway">{{ tx('في الطريق', 'On the way') }}</option>
            <option value="delivered">{{ tx('تم التسليم', 'Delivered') }}</option>
            <option value="cancelled">{{ tx('ملغي', 'Cancelled') }}</option>
          </select>
        </div>
        <div style="flex: 1; min-width: 160px;">
          <select id="all-filter-branch" v-model="state.allFilterBranch" style="padding: 10px 14px;">
            <option value="">{{ tx('كل الفروع', 'All branches') }}</option>
            <option v-for="b in state.branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
          </select>
        </div>
        <div>
          <button class="btn btn-secondary" @click="clearAllOrderFilters()" style="padding: 10px 20px; white-space: nowrap;">{{ tx('إعادة تعيين', 'Reset') }}</button>
        </div>
      </div>
      <div class="orders-table-wrapper">
        <table class="orders-table">
          <thead>
            <tr>
              <th>{{ tx('الرقم اليومي', 'Daily no.') }}</th>
              <th>{{ tx('رقم الفاتورة', 'Invoice no.') }}</th>
              <th>{{ tx('العميل', 'Customer') }}</th>
              <th>{{ tx('الفرع', 'Branch') }}</th>
              <th>{{ tx('الموظف', 'Agent') }}</th>
              <th>{{ tx('النوع', 'Type') }}</th>
              <th>{{ tx('الإجمالي', 'Total') }}</th>
              <th>{{ tx('الحالة', 'Status') }}</th>
              <th>{{ tx('السائق', 'Driver') }}</th>
              <th>{{ tx('إجراءات', 'Actions') }}</th>
            </tr>
          </thead>
          <tbody id="all-orders-table-body">
            <tr v-if="orders.length === 0"><td colspan="10" style="text-align:center; padding:30px;">{{ tx('لا توجد طلبات في يوم العمل الحالي', 'No orders in the current business day') }}</td></tr>
            <tr v-for="order in orders" :key="order.id" :class="{ 'order-row-cancelled': order.status === 'cancelled' }" @click="viewOrderDetail(order.id, 'all')">
              <td style="font-weight:700;">{{ order.dailyNo }}</td>
              <td style="color:var(--primary); font-weight:700;">#{{ order.invoiceNo }}</td>
              <td>
                <div class="order-customer-cell">
                  <div class="order-customer-phone">{{ order.customerPhone }}</div>
                  <div class="order-customer-name">{{ order.customerName }}</div>
                </div>
              </td>
              <td>{{ order.branchName }}</td>
              <td>{{ order.employeeName }}</td>
              <td><span v-html="typeCell(order)"></span></td>
              <td style="font-weight:700;">{{ formatCurrency(order.total) }}</td>
              <td><span v-html="statusBadge(order.status)"></span> <span v-if="order.hasComplaint" :title="tx('يوجد شكوى', 'Has a complaint')" style="color:var(--danger); display:inline-flex; vertical-align:middle;" v-html="icon('alert-triangle', { size: 14 })"></span></td>
              <td><span v-html="driverCell(order)"></span></td>
              <td>
                <button class="btn btn-sm btn-outline" @click.stop="viewOrderDetail(order.id, 'all')">{{ tx('تفاصيل', 'Details') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div id="all-order-detail-container">
        <OrderDetail v-if="state.openOrderId" :order-id="state.openOrderId" />
      </div>
    </div>
  </section>
</template>
