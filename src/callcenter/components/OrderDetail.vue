<script setup lang="ts">
import { computed } from 'vue'
import { state, getPaymentLabel, openCancelModal, openTxnModal, openComplaintModal, canManageComplaints, canCancelOrder, canCancelThisOrder } from '../store'
import { icon } from '../icons'
import { ORDER_STATUSES } from '../data'
import { formatCurrency, formatDate, formatTransactionTime } from '../utils'
import { tx, nameOf } from '../lang'

const props = defineProps<{ orderId: number }>()

const order = computed<any>(() => state.orders.find((o: any) => o.id === props.orderId) || null)

// نقلاً عن getStatusBadge
function statusBadge(status: string): string {
  const s = ORDER_STATUSES.find((x: any) => x.id === status)
  if (!s) return `<span class="status-badge">غير معروف</span>`
  return `<span class="status-badge status-${status}">${icon(s.icon, { size: 13 })} ${nameOf(s)}</span>`
}
// تفاصيل الصنف (حجم + إضافات) — نقلاً عن detailsStr
/**
 * وصف السطر: الحجم والإضافات — بلغة الواجهة.
 * السلّة تخزّن الاسمين (`sizeAr`/`sizeEn` و`modifiers`)، فلا يتجمّد الوصف على لغة
 * لحظة الاختيار. `extras` (أسماء عربية) تبقى ارتداداً لسطرٍ أُضيف قبل التغيير.
 */
function sizeLabel(item: any): string {
  return nameOf({ nameAr: item.sizeAr ?? item.size, nameEn: item.sizeEn })
}
function extrasLabel(item: any): string {
  const mods = Array.isArray(item.modifiers) && item.modifiers.length ? item.modifiers : null
  if (mods) return mods.map((m: any) => nameOf(m)).join(tx('، ', ', '))
  return Array.isArray(item.extras) ? item.extras.join(tx('، ', ', ')) : ''
}

function itemDetails(item: any): string {
  const sz = sizeLabel(item)
  let detailsStr = sz ? tx('حجم ', 'Size ') + sz : ''
  const ex = extrasLabel(item)
  if (ex) { detailsStr += detailsStr ? ' + ' : ''; detailsStr += ex }
  return detailsStr
}
</script>

<template>
  <div v-if="order" class="order-detail-panel">
    <div class="order-detail-header">
      <div>
        <div class="order-detail-invoice">
          {{ tx('فاتورة', 'Invoice') }} #{{ order.invoiceNo }}
          <!-- رقم المنصّة الخارجية: الوكيل يقارنه بما يقوله العميل -->
          <span v-if="order.orderTag" class="order-tag" dir="ltr">{{ order.orderTag }}</span>
        </div>
        <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">{{ tx('تاريخ الإنشاء:', 'Created:') }} {{ formatDate(order.createdAt) }}</div>
        <div v-if="order.scheduledDate" style="font-size:13px; color:var(--danger); margin-top:4px; font-weight:bold;">{{ tx('مجدول إلى:', 'Scheduled for:') }} {{ formatDate(order.scheduledDate) }}</div>
        <div v-if="order.status === 'cancelled' && order.cancellationReason" class="order-cancel-reason"><i class="fa-solid fa-circle-xmark"></i> {{ tx('سبب الإلغاء:', 'Cancellation reason:') }} <strong>{{ order.cancellationReason.label }}</strong><template v-if="order.cancellationReason.note && order.cancellationReason.id !== 'other'"> — {{ order.cancellationReason.note }}</template></div>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <span v-html="statusBadge(order.status)"></span>
        <!-- الحالة والسائق يملكهما الفرع: تُحدَّث عنده وتصل هنا لحظياً عبر SSE.
             زرّ تغيير الحالة كان يُطبَّق على الشاشة وحدها ثم تُعيده مرآةُ الفرع بعد
             ثوانٍ، وقائمة السائقين كانت أسماءً مكتوبة في الكود لا سائقين حقيقيين. -->
        <span v-if="order.driverName" class="status-badge" style="background:rgba(6,182,212,0.14); color:#0e7490; display:inline-flex; align-items:center; gap:5px;">
          <span v-html="icon('bike', { size: 13 })"></span> {{ order.driverName }}
        </span>
        <button v-if="canCancelOrder() && canCancelThisOrder(order)" class="btn btn-danger" @click="openCancelModal(order.id)">{{ tx('إلغاء الطلب', 'Cancel order') }}</button>
        <button v-if="canManageComplaints()" class="btn btn-secondary" @click="openComplaintModal(order.id)" style="background:var(--danger-light); color:var(--danger); border-color:var(--danger-light); display:inline-flex; align-items:center; gap:6px;"><span v-html="icon('alert-triangle', { size: 14 })"></span> {{ tx('تقديم شكوى', 'File a complaint') }}</button>
        <button class="btn btn-transactions" @click="openTxnModal(order.id)" :title="tx('سجل العمليات على الطلب', 'Order activity log')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {{ tx('سجل العمليات', 'Activity log') }}
        </button>
      </div>
    </div>

    <div class="order-detail-grid">
      <div class="order-detail-field">
        <label>{{ tx('العميل', 'Customer') }}</label>
        <span>{{ order.customerName }}</span>
      </div>
      <div class="order-detail-field">
        <label>{{ tx('رقم الهاتف', 'Phone') }}</label>
        <span class="ltr-num">{{ order.customerPhone }}</span>
      </div>
      <div class="order-detail-field">
        <label>{{ tx('العنوان', 'Address') }}</label>
        <span>{{ order.address }}</span>
      </div>
      <div class="order-detail-field">
        <label>{{ tx('الفرع', 'Branch') }}</label>
        <span>{{ order.branchName }}</span>
      </div>
      <div class="order-detail-field">
        <label>{{ tx('الموظف المسؤول', 'Handled by') }}</label>
        <span>{{ order.employeeName }}</span>
      </div>
      <div class="order-detail-field">
        <label>{{ tx('الرقم اليومي', 'Daily no.') }}</label>
        <span style="font-size:18px; font-weight:800; color:var(--primary);">{{ order.dailyNo }}</span>
      </div>
      <!-- رقم المنصّة الخارجية: يُبحث به ويُقارَن بما يقوله العميل -->
      <div v-if="order.orderTag" class="order-detail-field">
        <label>{{ tx('رقم الطلب الخارجي', 'External order no.') }}</label>
        <span class="order-tag" dir="ltr">{{ order.orderTag }}</span>
      </div>
      <div v-if="order.type === 'delivery'" class="order-detail-field order-detail-field-driver">
        <label>{{ tx('السائق', 'Driver') }}</label>
        <div v-if="order.driverId" class="driver-detail-box">
          <div class="driver-detail-name"><span v-html="icon('bike', { size: 14 })"></span> {{ order.driverName }}</div>
          <div class="driver-detail-phone" dir="ltr">{{ order.driverPhone || '' }}</div>
          <div v-if="order.driverAssignedAt" class="driver-detail-time">{{ tx('تم التحميل:', 'Picked up:') }} {{ formatTransactionTime(order.driverAssignedAt) }}</div>
        </div>
        <span v-else style="color:var(--text-muted); font-weight:600;">{{ tx('لم يُعين سائق بعد', 'No driver assigned yet') }}</span>
      </div>
    </div>

    <div v-if="order.notes" style="background:var(--warning-light); padding:12px 16px; border-radius:var(--radius-sm); margin-bottom:16px; border-inline-start:4px solid var(--warning);">
      <strong style="color:var(--warning); font-size:13px;">{{ tx('ملاحظات:', 'Notes:') }}</strong>
      <span style="font-size:14px; margin-inline-start:8px;">{{ order.notes }}</span>
    </div>

    <table class="order-items-table">
      <thead>
        <tr>
          <th style="text-align:start;">{{ tx('الصنف', 'Item') }}</th>
          <th style="text-align:center;">{{ tx('الكمية', 'Qty') }}</th>
          <th style="text-align:start;">{{ tx('سعر الوحدة', 'Unit price') }}</th>
          <th style="text-align:start;">{{ tx('الإجمالي', 'Total') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!order.items || !order.items.length">
          <td colspan="4" style="text-align:center; padding:18px; color:var(--text-muted); font-size:12.5px;">
            {{ order.itemsLoaded ? tx('لا توجد أصناف في هذا الطلب', 'This order has no items') : tx('جارٍ تحميل الأصناف…', 'Loading items…') }}
          </td>
        </tr>
        <tr v-for="(item, idx) in order.items" :key="idx">
          <td>
            <div style="font-weight:600; color:var(--text-primary);">{{ nameOf(item) }}</div>
            <div v-if="itemDetails(item)" style="font-size:11px; color:var(--text-muted);">{{ itemDetails(item) }}</div>
            <!-- ملاحظة الصنف: يكتبها الوكيل ولم تكن تُعرض هنا إطلاقاً -->
            <div v-if="item.note" style="font-size:11px; color:var(--warning, #b45309); font-weight:700;">
              {{ tx('ملاحظة: ', 'Note: ') }}{{ item.note }}
            </div>
          </td>
          <td style="text-align:center;">{{ item.quantity }}</td>
          <td>{{ formatCurrency(item.price) }}</td>
          <td style="font-weight:700;">{{ formatCurrency(item.total || item.price * item.quantity) }}</td>
        </tr>
      </tbody>
    </table>

    <div style="display:flex; justify-content:flex-end; margin-top:20px;">
      <div style="width:300px; background:var(--bg); padding:16px; border-radius:var(--radius-sm);">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
          <span>{{ tx('المجموع الفرعي:', 'Subtotal:') }}</span>
          <span>{{ formatCurrency(order.subtotal) }}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px; padding-bottom:12px; border-bottom:1px solid var(--border);">
          <span>{{ tx('رسوم التوصيل:', 'Delivery fee:') }}</span>
          <span>{{ formatCurrency(order.deliveryFee) }}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:800; color:var(--primary);">
          <span>{{ tx('الإجمالي:', 'Total:') }}</span>
          <span>{{ formatCurrency(order.total) }}</span>
        </div>
        <div style="margin-top:12px; text-align:center; font-size:12px; color:var(--text-muted); padding-top:12px; border-top:1px dashed var(--border);">
          {{ tx('طريقة الدفع:', 'Payment method:') }} {{ order.paymentLabel || getPaymentLabel(order.paymentChannel || 'phone', order.paymentMethod || 'cash') }}
        </div>
      </div>
    </div>
  </div>
</template>
