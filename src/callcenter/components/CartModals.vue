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
        <h3 class="modal-title">ملاحظات الطلب</h3>
        <button class="modal-close" @click="closeOrderNotesModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label style="font-weight:700;">تظهر للفرع مع الطلب</label>
          <textarea
            placeholder="مثال: الجرس مقطوع — اتصل عند الوصول · بدون بصل · كيس إضافي"
            style="width:100%; min-height:110px; padding:10px; border:1px solid var(--border); border-radius:6px; resize:vertical; font-family:inherit;"
            v-model="noteText"></textarea>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn btn-secondary" @click="noteText = ''">مسح</button>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary" @click="closeOrderNotesModal()">إلغاء</button>
          <button class="btn btn-primary" @click="saveOrderNotes(noteText)">حفظ</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ========== رسوم التوصيل ========== -->
  <div v-if="state.feeModalOpen" class="modal-overlay" @click.self="closeDeliveryFeeModal()">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">رسوم التوصيل</h3>
        <button class="modal-close" @click="closeDeliveryFeeModal()">×</button>
      </div>
      <div class="modal-body">
        <!-- المشتقّة من ربط (الفرع ↔ المنطقة) — مرجع الوكيل قبل أن يتجاوزها -->
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-radius:8px; background:var(--bg); border:1px solid var(--border); margin-bottom:14px;">
          <span style="color:var(--text-secondary); font-size:13px;">رسوم المنطقة</span>
          <span style="font-weight:700;">{{ formatCurrency(derivedDeliveryFee()) }}</span>
        </div>

        <div v-if="deliveryFeeIsOpen()" style="display:flex; gap:8px; align-items:flex-start; padding:10px 12px; border-radius:8px; background:var(--warning-light, #fffbeb); border:1px solid var(--warning, #f59e0b); font-size:12px; margin-bottom:14px;">
          <span v-html="icon('alert-triangle', { size: 14 })"></span>
          <span>المنطقة دي رسومها <strong>مفتوحة</strong> — يعني بتتحدد لكل مشوار. اكتب الرسوم هنا، وإلا الفرع هو اللي هيحددها.</span>
        </div>

        <div class="form-group">
          <label style="font-weight:700;">رسوم هذا الطلب</label>
          <input type="number" step="0.01" min="0" v-model="feeInput"
            style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px; font-family:inherit;" />
        </div>

        <p v-if="feeOverridden" style="font-size:12px; color:var(--text-secondary); margin-top:8px;">
          الرسوم دلوقتي متغيّرة يدوياً لهذا الطلب. «رجوع للافتراضي» يرجّعها لرسوم المنطقة.
        </p>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn btn-secondary" :disabled="!feeOverridden" @click="resetDeliveryFeeOverride()">رجوع للافتراضي</button>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary" @click="closeDeliveryFeeModal()">إلغاء</button>
          <button class="btn btn-primary" @click="applyDeliveryFeeOverride(feeInput)">حفظ</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ========== سجل طلبات العميل ========== -->
  <div v-if="state.historyModalOpen" class="modal-overlay" @click.self="closeHistoryModal()">
    <div class="modal-content" style="max-width:760px;" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">سجل طلبات العميل</h3>
        <button class="modal-close" @click="closeHistoryModal()">×</button>
      </div>
      <div class="modal-body" style="max-height:60vh; overflow-y:auto;">
        <p v-if="state.historyLoading" style="text-align:center; padding:24px; color:var(--text-muted);">جارٍ التحميل…</p>
        <p v-else-if="!state.historyOrders.length" style="text-align:center; padding:24px; color:var(--text-muted);">لا توجد طلبات سابقة لهذا العميل</p>
        <table v-else class="orders-table">
          <thead>
            <tr><th>التاريخ</th><th>رقم الفاتورة</th><th>الفرع</th><th>الإجمالي</th><th>الحالة</th><th></th></tr>
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
                  {{ state.reorderBusy ? '...' : 'إعادة الطلب' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p style="font-size:11px; color:var(--text-muted); margin-top:12px; line-height:1.7;">
          «إعادة الطلب» بتضيف أصناف الطلب للسلة <strong>بأسعار النهاردة</strong>. لو صنف اتغير سعره أو اتوقف أو اتشال من المنيو، هيتقالّك في تنبيه.
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="closeHistoryModal()">إغلاق</button>
      </div>
    </div>
  </div>

  <!-- ========== مراجعة الأوردر ========== -->
  <div v-if="state.reviewModalOpen && review" class="modal-overlay" @click.self="closeReviewModal()">
    <div class="modal-content" style="max-width:640px;" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">مراجعة الطلب قبل التأكيد</h3>
        <button class="modal-close" @click="closeReviewModal()">×</button>
      </div>
      <div class="modal-body" style="max-height:62vh; overflow-y:auto;">
        <!-- العميل والوجهة -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 16px; padding:12px; border-radius:8px; background:var(--bg); border:1px solid var(--border); font-size:13px;">
          <div><span style="color:var(--text-secondary);">العميل:</span> <strong>{{ review.customerName }}</strong></div>
          <div dir="ltr" style="text-align:end;"><strong>{{ review.customerPhone }}</strong></div>
          <div><span style="color:var(--text-secondary);">النوع:</span> <strong>{{ review.orderType === 'delivery' ? 'توصيل' : 'استلام' }}</strong></div>
          <div><span style="color:var(--text-secondary);">الفرع:</span> <strong>{{ review.branchName }}</strong></div>
          <div v-if="review.areaName" style="grid-column:1 / -1;">
            <span style="color:var(--text-secondary);">المنطقة:</span>
            <strong>{{ review.areaName }}<template v-if="review.sectionName"> — {{ review.sectionName }}</template></strong>
          </div>
          <div v-if="review.orderType === 'delivery'" style="grid-column:1 / -1;">
            <span style="color:var(--text-secondary);">العنوان:</span> <strong>{{ review.address }}</strong>
          </div>
          <div><span style="color:var(--text-secondary);">الدفع:</span> <strong>{{ review.payment }}</strong></div>
          <div v-if="review.isReservation" style="color:var(--primary); font-weight:700;">حجز: {{ review.reservationTime }}</div>
        </div>

        <!-- الأصناف -->
        <table class="orders-table" style="margin-top:14px;">
          <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
          <tbody>
            <tr v-for="i in review.items" :key="i.cartItemId">
              <td>
                {{ i.name }}
                <span v-if="i.size" style="color:var(--text-muted); font-size:11px;"> · {{ i.size }}</span>
                <div v-if="i.extras && i.extras.length" style="font-size:11px; color:var(--text-muted);">{{ i.extras.join('، ') }}</div>
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
            <span style="color:var(--text-secondary);">المجموع</span><span>{{ formatCurrency(review.subtotal) }}</span>
          </div>
          <div v-if="review.orderType === 'delivery'" style="display:flex; justify-content:space-between; padding:3px 0;">
            <span style="color:var(--text-secondary);">
              رسوم التوصيل
              <span v-if="review.feeIsOverridden" style="color:var(--warning, #b45309); font-weight:700;">(متغيّرة يدوياً)</span>
              <span v-else-if="review.feeIsOpen" style="color:var(--warning, #b45309); font-weight:700;">(مفتوحة — يحدّدها الفرع)</span>
            </span>
            <span>{{ formatCurrency(review.deliveryFee) }}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:8px 0 0; margin-top:6px; border-top:1px solid var(--border); font-weight:800; font-size:15px;">
            <span>الإجمالي</span><span>{{ formatCurrency(review.total) }}</span>
          </div>
        </div>

        <div v-if="review.notes" style="margin-top:12px; padding:10px 12px; border-radius:8px; background:var(--warning-light, #fffbeb); border:1px solid var(--warning, #f59e0b); font-size:12px;">
          <strong>ملاحظات:</strong> {{ review.notes }}
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn btn-secondary" @click="closeReviewModal()">رجوع للتعديل</button>
        <button class="btn btn-primary" @click="confirmReview()">تأكيد وإرسال للفرع</button>
      </div>
    </div>
  </div>
</template>
