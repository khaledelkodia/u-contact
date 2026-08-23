<script setup lang="ts">
import { computed } from 'vue'
import { state, allOrdersFiltered, clearAllOrderFilters, viewOrderDetail } from '../store'
import { icon } from '../icons'
import { ORDER_STATUSES } from '../data'
import { formatCurrency } from '../utils'
import OrderDetail from '../components/OrderDetail.vue'

const orders = computed<any[]>(() => allOrdersFiltered())

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
          <h2 class="orders-title">جميع طلبات التوصيل</h2>
        </div>
      </div>

      <!-- Search & Filter Bar (Main version) -->
      <div class="orders-search-filter-bar" style="display: flex; gap: 12px; align-items: center; background: var(--white); padding: 16px; border-radius: var(--radius-lg); margin-bottom: 20px; box-shadow: var(--shadow-sm); flex-wrap: wrap; border: 1px solid var(--border-light);">
        <div style="flex: 1.5; min-width: 180px;">
          <input type="text" id="all-search-invoice" placeholder="رقم الفاتورة..." v-model="state.allFilterInvoice" style="padding: 10px 14px;">
        </div>
        <div style="flex: 1.5; min-width: 180px;">
          <input type="text" id="all-search-phone" placeholder="رقم الموبايل..." v-model="state.allFilterPhone" style="padding: 10px 14px;">
        </div>
        <div style="flex: 1; min-width: 160px;">
          <select id="all-filter-status" v-model="state.allFilterStatus" style="padding: 10px 14px;">
            <option value="">كل الحالات</option>
            <option value="new">جديد</option>
            <option value="preparing">جاري التحضير</option>
            <option value="ready">جاهز</option>
            <option value="onway">في الطريق</option>
            <option value="delivered">تم التسليم</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>
        <div style="flex: 1; min-width: 160px;">
          <select id="all-filter-branch" v-model="state.allFilterBranch" style="padding: 10px 14px;">
            <option value="">كل الفروع</option>
            <option v-for="b in state.branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
          </select>
        </div>
        <div>
          <button class="btn btn-secondary" @click="clearAllOrderFilters()" style="padding: 10px 20px; white-space: nowrap;">إعادة تعيين</button>
        </div>
      </div>
      <div class="orders-table-wrapper">
        <table class="orders-table">
          <thead>
            <tr>
              <th>الرقم اليومي</th>
              <th>رقم الفاتورة</th>
              <th>العميل</th>
              <th>الفرع</th>
              <th>الموظف</th>
              <th>النوع</th>
              <th>الإجمالي</th>
              <th>الحالة</th>
              <th>السائق</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody id="all-orders-table-body">
            <tr v-if="orders.length === 0"><td colspan="10" style="text-align:center; padding:30px;">لا توجد طلبات في يوم العمل الحالي</td></tr>
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
              <td><span v-html="statusBadge(order.status)"></span> <span v-if="order.hasComplaint" title="يوجد شكوى" style="color:var(--danger); display:inline-flex; vertical-align:middle;" v-html="icon('alert-triangle', { size: 14 })"></span></td>
              <td><span v-html="driverCell(order)"></span></td>
              <td>
                <button class="btn btn-sm btn-outline" @click.stop="viewOrderDetail(order.id, 'all')">تفاصيل</button>
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
