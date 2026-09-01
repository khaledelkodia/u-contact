<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { state, allOrdersFiltered, clearAllOrderFilters, viewOrderDetail, canViewOrderTotals, phoneShow } from '../store'
import { icon } from '../icons'
import { ORDER_STATUSES } from '../data'
import { formatCurrency } from '../utils'
import { tx, nameOf } from '../lang'
import OrderDetail from '../components/OrderDetail.vue'
import Pager from '../components/Pager.vue'

const allRows = computed<any[]>(() => allOrdersFiltered())
// القيمة النهائية عمودٌ بصلاحية مستقلّة: من يتابع الحالات ليس بالضرورة من يرى الأرقام
const showTotals = computed(() => canViewOrderTotals())
// عدد الأعمدة يتغيّر بالصلاحية — صفّ «لا توجد طلبات» يمتدّ عليها كلّها
const colCount = computed(() => (showTotals.value ? 12 : 11))

// ── الصفحات ─────────────────────────────────────────────────────────────────
// كانت كل صفوف اليوم تُرسَم دفعةً واحدة: مع كثرة الطلبات يطول الجدول بلا حدّ
// ويصير البحث تمريراً. الصفحة تحدّ ما يُرسم وتعطي موضعاً معلوماً.
const page = ref(1)
const pageSize = ref(25)
const total = computed(() => allRows.value.length)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
// أي تغييرٍ في الفلاتر أو حجم الصفحة يرجع للأولى — وإلا بقي الوكيل على صفحةٍ فارغة
watch([() => state.allFilterDaily, () => state.allFilterInvoice, () => state.allFilterPhone,
       () => state.allFilterEmployee, () => state.allFilterType, () => state.allFilterTag,
       () => state.allFilterStatus, () => state.allFilterBranch, () => state.allFilterDriver,
       pageSize], () => { page.value = 1 })
// نقصان النتائج (وصول تحديثٍ لحظيّ مثلاً) يجب ألّا يترك المؤشّر خارج المدى
watch(pageCount, (n) => { if (page.value > n) page.value = n })
const orders = computed(() => allRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

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
    return `<div class="driver-cell"><span class="driver-cell-name">${icon('bike', { size: 14 })} ${order.driverName}</span><span class="driver-cell-phone" dir="ltr">${phoneShow(order.driverPhone || '')}</span></div>`
  }
  // نصٌّ داخل HTML مبنيّ بالسلاسل — لا تراه مسوحُ القوالب فبقي عربياً
  return `<span class="driver-cell-empty">${tx('لم يُعين بعد', 'Not assigned yet')}</span>`
}
// نقلاً عن typeCell (توصيل/استلام)
function typeCell(order: any): string {
  const typeIconName = order.type === 'delivery' ? 'bike' : 'store'
  const typeName = order.type === 'delivery' ? tx('توصيل', 'Delivery') : tx('استلام', 'Pickup')
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


      <!-- التفاصيل تنسدل تحت صفّها داخل الجدول — لا عمودَ جانبيّ يأكل من عرضه -->
      <div class="orders-table-wrapper od-wrap">
        <table class="orders-table">
          <thead>
            <tr>
              <th>{{ tx('الرقم اليومي', 'Daily no.') }}</th>
              <th>{{ tx('رقم الفاتورة', 'Invoice no.') }}</th>
              <th>{{ tx('العميل', 'Customer') }}</th>
              <th>{{ tx('الفرع', 'Branch') }}</th>
              <th>{{ tx('الموظف', 'Agent') }}</th>
              <th>{{ tx('النوع', 'Type') }}</th>
              <th>{{ tx('رقم الطلب الخارجي', 'External no.') }}</th>
              <th>{{ tx('المجموع', 'Subtotal') }}</th>
              <th v-if="showTotals">{{ tx('القيمة النهائية', 'Final value') }}</th>
              <th>{{ tx('الحالة', 'Status') }}</th>
              <th>{{ tx('السائق', 'Driver') }}</th>
              <th>{{ tx('إجراءات', 'Actions') }}</th>
            </tr>
            <!-- صفّ الفلترة: خانةٌ تحت رأس العمود الذي تخصّه — لا شريطٌ منفصل
                 يفلتر أربعة أعمدةٍ من اثني عشر ولا يقول أيَّ خانةٍ تخصّ أيَّ عمود. -->
            <tr class="uc-frow">
              <th><input class="uc-fcell" v-model="state.allFilterDaily" :placeholder="tx('رقم', 'No.')"></th>
              <th><input class="uc-fcell" v-model="state.allFilterInvoice" :placeholder="tx('فاتورة', 'Invoice')"></th>
              <th><input class="uc-fcell" v-model="state.allFilterPhone" :placeholder="tx('اسم أو رقم', 'Name or no.')"></th>
              <th>
                <select class="uc-fcell" v-model="state.allFilterBranch">
                  <option value="">{{ tx('الكل', 'All') }}</option>
                  <option v-for="b in state.branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
                </select>
              </th>
              <th><input class="uc-fcell" v-model="state.allFilterEmployee" :placeholder="tx('الموظف', 'Agent')"></th>
              <th>
                <select class="uc-fcell" v-model="state.allFilterType">
                  <option value="">{{ tx('الكل', 'All') }}</option>
                  <option value="delivery">{{ tx('توصيل', 'Delivery') }}</option>
                  <option value="pickup">{{ tx('استلام', 'Pickup') }}</option>
                </select>
              </th>
              <th><input class="uc-fcell" v-model="state.allFilterTag" :placeholder="tx('رقم خارجي', 'External')"></th>
              <th></th>
              <th v-if="showTotals"></th>
              <th>
                <select class="uc-fcell" v-model="state.allFilterStatus">
                  <option value="">{{ tx('الكل', 'All') }}</option>
                  <option value="sent">{{ tx('لم يصل الفرع', 'Sent') }}</option>
                  <option value="new">{{ tx('جديد', 'New') }}</option>
                  <option value="preparing">{{ tx('جاري التحضير', 'Preparing') }}</option>
                  <option value="ready">{{ tx('جاهز', 'Ready') }}</option>
                  <option value="withdriver">{{ tx('مع السائق', 'Assigned') }}</option>
                  <option value="onway">{{ tx('في الطريق', 'On the way') }}</option>
                  <option value="delivered">{{ tx('مغلق', 'Closed') }}</option>
                  <option value="cancelled">{{ tx('ملغي', 'Cancelled') }}</option>
                </select>
              </th>
              <th><input class="uc-fcell" v-model="state.allFilterDriver" :placeholder="tx('السائق', 'Driver')"></th>
              <th><button type="button" class="uc-fclear" @click="clearAllOrderFilters()">{{ tx('مسح الفلاتر', 'Clear') }}</button></th>
            </tr>
          </thead>
          <tbody id="all-orders-table-body">
            <tr v-if="orders.length === 0"><td :colspan="colCount" style="text-align:center; padding:30px;">{{ tx('لا توجد طلبات في يوم العمل الحالي', 'No orders in the current business day') }}</td></tr>
            <template v-for="order in orders" :key="order.id">
            <tr
                :class="{ 'order-row-cancelled': order.status === 'cancelled', 'row-open': state.openOrderId === order.id }"
                @click="viewOrderDetail(order.id, 'all')">
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
              <td>
                <span v-if="order.orderTag" class="order-tag" dir="ltr">{{ order.orderTag }}</span>
                <span v-else style="color:var(--text-muted);">—</span>
              </td>
              <td>{{ formatCurrency(order.subtotal) }}</td>
              <td v-if="showTotals" style="font-weight:800;">{{ formatCurrency(order.total) }}</td>
              <td><span v-html="statusBadge(order.status)"></span> <span v-if="order.hasComplaint" :title="tx('يوجد شكوى', 'Has a complaint')" style="color:var(--danger); display:inline-flex; vertical-align:middle;" v-html="icon('alert-triangle', { size: 14 })"></span></td>
              <td><span v-html="driverCell(order)"></span></td>
              <td>
                <button class="btn btn-sm btn-outline" @click.stop="viewOrderDetail(order.id, 'all')">{{ tx('تفاصيل', 'Details') }}</button>
              </td>
            </tr>
            <!-- لوحة التفاصيل: صفٌّ يمتدّ على الأعمدة كلها تحت صفّه مباشرةً -->
            <tr v-if="state.openOrderId === order.id" class="od-inline">
              <td :colspan="colCount">
                <div class="od-inline-box" id="all-order-detail-container">
                  <OrderDetail :order-id="order.id" />
                </div>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>
      <Pager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </div>
  </section>
</template>
