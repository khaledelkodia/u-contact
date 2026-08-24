<script setup lang="ts">
// مودالات شاشة الأوردر الجديد: ملاحظات الطلب · رسوم التوصيل · سجل طلبات العميل ·
// مراجعة الأوردر. مُجمَّعة في ملف واحد لأنها كلها تخصّ السلة وتُركَّب مرّة واحدة.
import { ref, watch, computed } from 'vue'
import {
  state,
  closeOrderNotesModal, saveOrderNotes,
  closeDeliveryFeeModal, applyDeliveryFeeOverride, resetDeliveryFeeOverride, derivedDeliveryFee, deliveryFeeIsOpen,
  closeHistoryModal, reorderItems,
  closeReviewModal, confirmReview, reviewSummary,
} from '../store'
import { formatCurrency, formatDate } from '../utils'
import { tx, lang, nameOf } from '../lang'
import { icon } from '../icons'

// ── ملاحظات الطلب ──
const noteText = ref('')
watch(() => state.notesModalOpen, (open) => { if (open) noteText.value = state.orderNotes || '' })

// ── رسوم التوصيل ──
const feeInput = ref('')
watch(() => state.feeModalOpen, (open) => {
  // نبدأ من القيمة السارية فعلاً (تجاوزٌ سابق إن وُجد، وإلا المشتقّة من المنطقة)
  if (open) feeInput.value = String(state.deliveryFeeOverride ?? derivedDeliveryFee())
})
const feeOverridden = computed(() => state.deliveryFeeOverride !== null && state.deliveryFeeOverride !== undefined)

// ── المراجعة ──
const review = computed<any>(() => (state.reviewModalOpen ? reviewSummary() : null))
</script>

<template>
  <!-- ========== ملاحظات الطلب ========== -->
  <div v-if="state.notesModalOpen" class="modal-overlay" @click.self="closeOrderNotesModal()">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ tx('ملاحظات الطلب', 'Order notes') }}</h3>
        <button class="modal-close" @click="closeOrderNotesModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label style="font-weight:700;">{{ tx('تظهر للفرع مع الطلب', 'Shown to the branch with the order') }}</label>
          <textarea
            :placeholder="tx('مثال: الجرس مقطوع — اتصل عند الوصول · بدون بصل · كيس إضافي', 'e.g. doorbell is broken — call on arrival · no onion · extra bag')"
            style="width:100%; min-height:110px; padding:10px; border:1px solid var(--border); border-radius:6px; resize:vertical; font-family:inherit;"
            v-model="noteText"></textarea>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn btn-secondary" @click="noteText = ''">{{ tx('مسح', 'Clear') }}</button>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary" @click="closeOrderNotesModal()">{{ tx('إلغاء', 'Cancel') }}</button>
          <button class="btn btn-primary" @click="saveOrderNotes(noteText)">{{ tx('حفظ', 'Save') }}</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ========== رسوم التوصيل ========== -->
  <div v-if="state.feeModalOpen" class="modal-overlay" @click.self="closeDeliveryFeeModal()">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ tx('رسوم التوصيل', 'Delivery fee') }}</h3>
        <button class="modal-close" @click="closeDeliveryFeeModal()">×</button>
      </div>
      <div class="modal-body">
        <!-- المشتقّة من ربط (الفرع ↔ المنطقة) — مرجع الوكيل قبل أن يتجاوزها -->
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-radius:8px; background:var(--bg); border:1px solid var(--border); margin-bottom:14px;">
          <span style="color:var(--text-secondary); font-size:13px;">{{ tx('رسوم المنطقة', 'Area fee') }}</span>
          <span style="font-weight:700;">{{ formatCurrency(derivedDeliveryFee()) }}</span>
        </div>

        <div v-if="deliveryFeeIsOpen()" style="display:flex; gap:8px; align-items:flex-start; padding:10px 12px; border-radius:8px; background:var(--warning-light, #fffbeb); border:1px solid var(--warning, #f59e0b); font-size:12px; margin-bottom:14px;">
          <span v-html="icon('alert-triangle', { size: 14 })"></span>
          <span v-if="lang === 'ar'">المنطقة دي رسومها <strong>مفتوحة</strong> — يعني بتتحدد لكل مشوار. اكتب الرسوم هنا، وإلا الفرع هو اللي هيحددها.</span>
            <span v-else>This area has an <strong>open</strong> fee — it is set per trip. Enter it here, otherwise the branch will set it.</span>
        </div>

        <div class="form-group">
          <label style="font-weight:700;">{{ tx('رسوم هذا الطلب', 'Fee for this order') }}</label>
          <input type="number" step="0.01" min="0" v-model="feeInput"
            style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px; font-family:inherit;" />
        </div>

        <p v-if="feeOverridden" style="font-size:12px; color:var(--text-secondary); margin-top:8px;">
          {{ tx('الرسوم دلوقتي متغيّرة يدوياً لهذا الطلب. «رجوع للافتراضي» يرجّعها لرسوم المنطقة.', 'The fee is currently overridden for this order. “Back to default” restores the area fee.') }}
        </p>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn btn-secondary" :disabled="!feeOverridden" @click="resetDeliveryFeeOverride()">{{ tx('رجوع للافتراضي', 'Back to default') }}</button>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary" @click="closeDeliveryFeeModal()">{{ tx('إلغاء', 'Cancel') }}</button>
          <button class="btn btn-primary" @click="applyDeliveryFeeOverride(feeInput)">{{ tx('حفظ', 'Save') }}</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ========== سجل طلبات العميل ========== -->
  <div v-if="state.historyModalOpen" class="modal-overlay" @click.self="closeHistoryModal()">
    <div class="modal-content" style="max-width:760px;" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ tx('سجل طلبات العميل', 'Customer order history') }}</h3>
        <button class="modal-close" @click="closeHistoryModal()">×</button>
      </div>
      <div class="modal-body" style="max-height:60vh; overflow-y:auto;">
        <p v-if="state.historyLoading" style="text-align:center; padding:24px; color:var(--text-muted);">{{ tx('جارٍ التحميل…', 'Loading…') }}</p>
        <p v-else-if="!state.historyOrders.length" style="text-align:center; padding:24px; color:var(--text-muted);">{{ tx('لا توجد طلبات سابقة لهذا العميل', 'No previous orders for this customer') }}</p>
        <table v-else class="orders-table">
          <thead>
            <tr><th>{{ tx('التاريخ', 'Date') }}</th><th>{{ tx('رقم الفاتورة', 'Invoice no.') }}</th><th>{{ tx('الفرع', 'Branch') }}</th><th>{{ tx('الإجمالي', 'Total') }}</th><th>{{ tx('الحالة', 'Status') }}</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="o in state.historyOrders" :key="o.id">
              <td>{{ formatDate(o.businessDate || o.createdAt) }}</td>
              <td style="font-weight:700;">#{{ o.invoiceNo }}</td>
              <td>{{ o.branchName }}</td>
              <td style="font-weight:700;">{{ formatCurrency(o.total) }}</td>
              <td>{{ o.status }}</td>
              <td>
                <button class="btn btn-sm btn-primary" :disabled="state.reorderBusy" @click="reorderItems(o.id)">
                  {{ state.reorderBusy ? '...' : tx('إعادة الطلب', 'Reorder') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p style="font-size:11px; color:var(--text-muted); margin-top:12px; line-height:1.7;">
          <template v-if="lang === 'ar'">«إعادة الطلب» بتضيف أصناف الطلب للسلة <strong>بأسعار النهاردة</strong>. لو صنف اتغير سعره أو اتوقف أو اتشال من المنيو، هيتقالّك في تنبيه.</template>
          <template v-else>“Reorder” adds the order’s items to the cart <strong>at today’s prices</strong>. If an item changed price, was stopped, or was removed from the menu, you will be told in a notice.</template>
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="closeHistoryModal()">{{ tx('إغلاق', 'Close') }}</button>
      </div>
    </div>
  </div>

  <!-- ========== مراجعة الأوردر ========== -->
  <div v-if="state.reviewModalOpen && review" class="modal-overlay" @click.self="closeReviewModal()">
    <div class="modal-content" style="max-width:640px;" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ tx('مراجعة الطلب قبل التأكيد', 'Review the order before confirming') }}</h3>
        <button class="modal-close" @click="closeReviewModal()">×</button>
      </div>
      <div class="modal-body" style="max-height:62vh; overflow-y:auto;">
        <!-- العميل والوجهة -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 16px; padding:12px; border-radius:8px; background:var(--bg); border:1px solid var(--border); font-size:13px;">
          <div><span style="color:var(--text-secondary);">{{ tx('العميل:', 'Customer:') }}</span> <strong>{{ review.customerName }}</strong></div>
          <div dir="ltr" style="text-align:end;"><strong>{{ review.customerPhone }}</strong></div>
          <div><span style="color:var(--text-secondary);">{{ tx('النوع:', 'Type:') }}</span> <strong>{{ review.orderType === 'delivery' ? tx('توصيل', 'Delivery') : tx('استلام', 'Pickup') }}</strong></div>
          <div><span style="color:var(--text-secondary);">{{ tx('الفرع:', 'Branch:') }}</span> <strong>{{ review.branchName }}</strong></div>
          <div v-if="review.areaName" style="grid-column:1 / -1;">
            <span style="color:var(--text-secondary);">{{ tx('المنطقة:', 'Area:') }}</span>
            <strong>{{ review.areaName }}<template v-if="review.sectionName"> — {{ review.sectionName }}</template></strong>
          </div>
          <div v-if="review.orderType === 'delivery'" style="grid-column:1 / -1;">
            <span style="color:var(--text-secondary);">{{ tx('العنوان:', 'Address:') }}</span> <strong>{{ review.address }}</strong>
          </div>
          <div><span style="color:var(--text-secondary);">{{ tx('الدفع:', 'Payment:') }}</span> <strong>{{ review.payment }}</strong></div>
          <div v-if="review.orderTag">
            <span style="color:var(--text-secondary);">{{ tx('رقم المنصّة:', 'Platform no.:') }}</span> <strong dir="ltr">{{ review.orderTag }}</strong>
          </div>
          <div v-if="review.isReservation" style="color:var(--primary); font-weight:700;">{{ tx('حجز:', 'Reservation:') }} {{ review.reservationTime }}</div>
        </div>

        <!-- الأصناف -->
        <table class="orders-table" style="margin-top:14px;">
          <thead><tr><th>{{ tx('الصنف', 'Item') }}</th><th>{{ tx('الكمية', 'Qty') }}</th><th>{{ tx('السعر', 'Price') }}</th><th>{{ tx('الإجمالي', 'Total') }}</th></tr></thead>
          <tbody>
            <tr v-for="i in review.items" :key="i.cartItemId">
              <td>
                {{ i.name }}
                <span v-if="i.size" style="color:var(--text-muted); font-size:11px;"> · {{ nameOf({ nameAr: i.sizeAr ?? i.size, nameEn: i.sizeEn }) }}</span>
                <div v-if="(i.modifiers && i.modifiers.length) || (i.extras && i.extras.length)" style="font-size:11px; color:var(--text-muted);">
                  {{ (i.modifiers && i.modifiers.length ? i.modifiers.map((m: any) => nameOf(m)) : i.extras).join(tx('، ', ', ')) }}
                </div>
                <div v-if="i.note" style="font-size:11px; color:var(--warning, #b45309);">{{ i.note }}</div>
              </td>
              <td>{{ i.quantity }}</td>
              <td>{{ formatCurrency(i.price) }}</td>
              <td style="font-weight:700;">{{ formatCurrency(i.price * i.quantity) }}</td>
            </tr>
          </tbody>
        </table>

        <!-- الإجماليات -->
        <div style="margin-top:14px; padding:12px; border-radius:8px; background:var(--bg); border:1px solid var(--border); font-size:13px;">
          <div style="display:flex; justify-content:space-between; padding:3px 0;">
            <span style="color:var(--text-secondary);">{{ tx('المجموع', 'Subtotal') }}</span><span>{{ formatCurrency(review.subtotal) }}</span>
          </div>
          <div v-if="review.orderType === 'delivery'" style="display:flex; justify-content:space-between; padding:3px 0;">
            <span style="color:var(--text-secondary);">
              {{ tx('رسوم التوصيل', 'Delivery fee') }}
              <span v-if="review.feeIsOverridden" style="color:var(--warning, #b45309); font-weight:700;">({{ tx('متغيّرة يدوياً', 'manually overridden') }})</span>
              <span v-else-if="review.feeIsOpen" style="color:var(--warning, #b45309); font-weight:700;">({{ tx('مفتوحة — يحدّدها الفرع', 'open — set by the branch') }})</span>
            </span>
            <span>{{ formatCurrency(review.deliveryFee) }}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:8px 0 0; margin-top:6px; border-top:1px solid var(--border); font-weight:800; font-size:15px;">
            <span>{{ tx('الإجمالي', 'Total') }}</span><span>{{ formatCurrency(review.total) }}</span>
          </div>
        </div>

        <div v-if="review.notes" style="margin-top:12px; padding:10px 12px; border-radius:8px; background:var(--warning-light, #fffbeb); border:1px solid var(--warning, #f59e0b); font-size:12px;">
          <strong>{{ tx('ملاحظات:', 'Notes:') }}</strong> {{ review.notes }}
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn btn-secondary" @click="closeReviewModal()">{{ tx('رجوع للتعديل', 'Back to edit') }}</button>
        <button class="btn btn-primary" @click="confirmReview()">{{ tx('تأكيد وإرسال للفرع', 'Confirm and send to the branch') }}</button>
      </div>
    </div>
  </div>
</template>
