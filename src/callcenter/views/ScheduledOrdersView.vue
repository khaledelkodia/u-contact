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
watch([() => state.schedFilterInvoice, () => state.schedFilterPhone,
       () => state.schedFilterBranch, () => state.schedFilterType, pageSize], () => { page.value = 1 })
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


      <!-- التفاصيل تنسدل تحت صفّها داخل الجدول — لا عمودَ جانبيّ يأكل من عرضه -->
      <div class="orders-table-wrapper od-wrap">
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
            <!-- صفّ الفلترة تحت رأس الجدول — لا شريطٌ منفصل فوقه -->
            <tr class="uc-frow">
              <th></th>
              <th><input class="uc-fcell" v-model="state.schedFilterInvoice" :placeholder="tx('فاتورة', 'Invoice')"></th>
              <th><input class="uc-fcell" v-model="state.schedFilterPhone" :placeholder="tx('اسم أو رقم', 'Name or no.')"></th>
              <th>
                <select class="uc-fcell" v-model="state.schedFilterBranch">
                  <option value="">{{ tx('الكل', 'All') }}</option>
                  <option v-for="b in state.branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
                </select>
              </th>
              <th>
                <select class="uc-fcell" v-model="state.schedFilterType">
                  <option value="">{{ tx('الكل', 'All') }}</option>
                  <option value="delivery">{{ tx('توصيل', 'Delivery') }}</option>
                  <option value="pickup">{{ tx('استلام', 'Pickup') }}</option>
                </select>
              </th>
              <th></th>
              <th><button type="button" class="uc-fclear" @click="clearScheduledFilters()">{{ tx('مسح الفلاتر', 'Clear') }}</button></th>
            </tr>
          </thead>
          <tbody id="scheduled-orders-table-body">
            <tr v-if="orders.length === 0"><td colspan="7" style="text-align:center; padding:30px;">{{ tx('لا توجد طلبات مجدولة', 'No scheduled orders') }}</td></tr>
            <template v-for="order in orders" :key="order.id">
            <tr
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
            <!-- لوحة التفاصيل: صفٌّ يمتدّ على الأعمدة كلها تحت صفّه مباشرةً -->
            <tr v-if="state.openOrderId === order.id" class="od-inline">
              <td colspan="7">
                <div class="od-inline-box" id="scheduled-order-detail-container">
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
