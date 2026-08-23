<script setup lang="ts">
import { computed } from 'vue'
import { state, scheduledOrdersList, viewOrderDetail } from '../store'
import { icon } from '../icons'
import { formatCurrency, formatDate } from '../utils'
import OrderDetail from '../components/OrderDetail.vue'

const orders = computed<any[]>(() => scheduledOrdersList())

// نقلاً عن typeCell (توصيل/استلام)
function typeCell(order: any): string {
  const typeIconName = order.type === 'delivery' ? 'bike' : 'store'
  const typeName = order.type === 'delivery' ? 'توصيل' : 'استلام'
  return `<span style="display:inline-flex; align-items:center; gap:6px;">${icon(typeIconName, { size: 16 })} ${typeName}</span>`
}
</script>

<template>
  <section id="view-scheduled-orders" class="view active">
    <div class="orders-section">
      <div class="orders-header">
        <div>
          <h2 class="orders-title">الطلبات المجدولة</h2>
        </div>
      </div>
      <div class="orders-table-wrapper">
        <table class="orders-table">
          <thead>
            <tr>
              <th>تاريخ الجدولة</th>
              <th>رقم الفاتورة</th>
              <th>العميل</th>
              <th>الفرع</th>
              <th>النوع</th>
              <th>الإجمالي</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody id="scheduled-orders-table-body">
            <tr v-if="orders.length === 0"><td colspan="7" style="text-align:center; padding:30px;">لا توجد طلبات مجدولة</td></tr>
            <tr v-for="order in orders" :key="order.id" @click="viewOrderDetail(order.id, 'scheduled')">
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
                <button class="btn btn-sm btn-outline" @click.stop="viewOrderDetail(order.id, 'scheduled')">تفاصيل</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div id="scheduled-order-detail-container">
        <OrderDetail v-if="state.openOrderId" :order-id="state.openOrderId" />
      </div>
    </div>
  </section>
</template>
