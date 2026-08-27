<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  state,
  cancellationReasons, confirmCancelOrder, closeCancelModal,
  orderTransactions, getTransactionMeta, closeTxnModal,
  submitComplaint, closeComplaintModal,
} from '../store'
import { icon } from '../icons'
import { ORDER_STATUSES, COMPLAINT_CATEGORIES } from '../data'
import { formatCurrency, formatTransactionTime, txnDayKey, formatTxnDay, formatTxnClock } from '../utils'
import { tx, nameOf } from '../lang'

// نقلاً عن getStatusBadge (يُستخدم في ملخّص الحركات)
function statusBadge(status: string): string {
  const s = ORDER_STATUSES.find((x: any) => x.id === status)
  if (!s) return `<span class="status-badge">غير معروف</span>`
  return `<span class="status-badge status-${status}">${icon(s.icon, { size: 13 })} ${nameOf(s)}</span>`
}

// ── الطلبات المرتبطة بكل مودال ──
const cancelOrder = computed<any>(() => state.orders.find((o: any) => o.id === state.cancelModalOrderId) || null)
const txnOrder = computed<any>(() => state.orders.find((o: any) => o.id === state.txnModalOrderId) || null)
const complaintOrder = computed<any>(() => state.orders.find((o: any) => o.id === state.complaintModalOrderId) || null)

// ── مودال الإلغاء (اختيار السبب) ──
const selectedReason = ref<any>(null)
const otherNote = ref('')
watch(() => state.cancelModalOrderId, (v) => { if (v) { selectedReason.value = null; otherNote.value = '' } })
function pickReason(r: any) { selectedReason.value = { id: r.id, label: r.label } }
const canConfirmCancel = computed(() => {
  if (!selectedReason.value) return false
  if (selectedReason.value.id === 'other') return !!otherNote.value.trim()
  return true
})
function doConfirmCancel() {
  if (!canConfirmCancel.value || !cancelOrder.value) return
  const result: any = { id: selectedReason.value.id, label: selectedReason.value.label }
  if (selectedReason.value.id === 'other' && otherNote.value.trim()) {
    result.note = otherNote.value.trim()
    result.label = otherNote.value.trim()
  }
  confirmCancelOrder(cancelOrder.value.id, result)
}

// ── مودال الحركات ──
const txns = computed<any[]>(() => (txnOrder.value ? orderTransactions(txnOrder.value) : []))

// تجميعٌ في أيام: أكثر السجلّات ليومٍ واحد، فتكرارُ التاريخ في كل سطرٍ ضجيج.
// الرأس يؤرّخ، والسطر يحمل ساعته وحدها. و«_i» تحفظ ترتيبَ القيد لتمييز الأحدث.
const txnDays = computed(() => {
  const groups: Array<{ key: string; label: string; items: any[] }> = []
  txns.value.forEach((e: any, i: number) => {
    const key = txnDayKey(e.at)
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) { g = { key, label: formatTxnDay(e.at), items: [] }; groups.push(g) }
    g.items.push({ ...e, _i: i })
  })
  return groups
})

// ── مودال الشكوى ──
const complaintText = ref('')
const complaintCategory = ref('other')   // الخادم يشترط category غير فارغ
watch(() => state.complaintModalOrderId, (v) => {
  if (v) { complaintText.value = ''; complaintCategory.value = 'other' }
})
function doSubmitComplaint() {
  if (!complaintOrder.value) return
  submitComplaint(complaintOrder.value.id, complaintText.value, complaintCategory.value)
}
</script>

<template>
  <!-- مودال «تعيين سائق» أُزيل: السائق يعيّنه الفرع، والكول‑سنتر يعرض اسمه فقط -->
  <!-- ========== إلغاء الطلب (اختيار السبب) ========== -->
  <div v-if="cancelOrder" class="modal-overlay" @click.self="closeCancelModal()">
    <div class="modal-content">
      <div class="modal-header cc-header">
        <h3 class="modal-title">{{ tx('إلغاء الطلب', 'Cancel order') }}</h3>
        <button class="modal-close" type="button" @click="closeCancelModal()">×</button>
      </div>
      <div class="modal-body cc-body" style="text-align:start;">
        <div class="cc-icon cc-icon-danger" style="margin: 4px auto 14px;" v-html="icon('x-circle', { size: 22 })"></div>
        <div class="cancel-confirm-body">
          <p class="cancel-confirm-text" style="text-align:center;">{{ tx('هل أنت متأكد من إلغاء هذا الطلب؟', 'Are you sure you want to cancel this order?') }}</p>
          <div class="cancel-confirm-order">
            <div class="cancel-confirm-row">
              <span class="cancel-confirm-label">{{ tx('رقم الفاتورة', 'Invoice no.') }}</span>
              <span class="cancel-confirm-value">#{{ cancelOrder.invoiceNo }}</span>
            </div>
            <div class="cancel-confirm-row">
              <span class="cancel-confirm-label">{{ tx('العميل', 'Customer') }}</span>
              <span class="cancel-confirm-value">{{ cancelOrder.customerName }}</span>
            </div>
            <div class="cancel-confirm-row">
              <span class="cancel-confirm-label">{{ tx('الإجمالي', 'Total') }}</span>
              <span class="cancel-confirm-value">{{ formatCurrency(cancelOrder.total) }}</span>
            </div>
          </div>

          <div class="cancel-reason-step-label">{{ tx('اختر سبب الإلغاء', 'Choose a cancellation reason') }}</div>
          <div class="cancel-reasons-grid" id="cancel-reasons-grid">
            <button v-for="r in cancellationReasons" :key="r.id" type="button" class="cancel-reason-option" :class="{ selected: selectedReason && selectedReason.id === r.id }" @click="pickReason(r)">
              <span class="cancel-reason-icon" v-html="icon(r.icon, { size: 16 })"></span>
              <span class="cancel-reason-label">{{ nameOf(r) }}</span>
              <span class="cancel-reason-check" v-html="icon('check', { size: 12 })"></span>
            </button>
          </div>

          <div class="cancel-other-wrap" :class="{ hidden: !(selectedReason && selectedReason.id === 'other') }" id="cancel-other-wrap">
            <label class="cancel-other-label" for="cancel-other-note">{{ tx('اكتب السبب بالتفصيل', 'Write the reason in detail') }}</label>
            <textarea id="cancel-other-note" :placeholder="tx('مثال: تأخر التوصيل لأكثر من ساعة...', 'e.g. delivery was over an hour late…')" rows="3" v-model="otherNote"></textarea>
          </div>

          <div class="cancel-confirm-note"><span class="inline-ico" v-html="icon('info', { size: 13 })"></span> {{ tx('لا يمكن التراجع عن هذه العملية', 'This action cannot be undone') }}</div>
        </div>
      </div>
      <div class="modal-footer cc-footer">
        <button class="btn btn-secondary cc-btn" type="button" @click="closeCancelModal()">{{ tx('تراجع', 'Back') }}</button>
        <button class="btn btn-danger cc-btn cc-btn-primary" id="cancel-confirm-btn" type="button" :disabled="!canConfirmCancel" @click="doConfirmCancel()">{{ tx('نعم، ألغِ الطلب', 'Yes, cancel the order') }}</button>
      </div>
    </div>
  </div>

  <!-- ========== سجل العمليات ========== -->
  <div v-if="txnOrder" class="modal-overlay" @click.self="closeTxnModal()">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">{{ tx('سجل العمليات على الطلب', 'Activity log for order') }} #{{ txnOrder.invoiceNo }}</h3>
        <button class="modal-close" @click="closeTxnModal()">×</button>
      </div>
      <div class="modal-body" style="padding:0;">
        <div class="txn-summary">
          <div class="txn-summary-item">
            <span class="txn-summary-label">{{ tx('العميل', 'Customer') }}</span>
            <span class="txn-summary-value">{{ txnOrder.customerName }}</span>
          </div>
          <div class="txn-summary-item">
            <span class="txn-summary-label">{{ tx('الحالة الحالية', 'Current status') }}</span>
            <span class="txn-summary-value" v-html="statusBadge(txnOrder.status)"></span>
          </div>
          <div class="txn-summary-item">
            <span class="txn-summary-label">{{ tx('عدد العمليات', 'Entries') }}</span>
            <span class="txn-summary-value" style="font-weight:800; color:var(--primary);">{{ txns.length }}</span>
          </div>
        </div>
        <div class="txn-timeline">
          <div v-if="txns.length === 0" class="txn-empty">{{ tx('لا توجد عمليات مسجلة', 'No activity recorded') }}</div>
          <template v-for="g in txnDays" :key="g.key">
            <div class="txn-day">{{ g.label }}</div>
          <div v-for="entry in g.items" :key="entry._i" class="txn-item" :class="{ 'txn-item-latest': entry._i === 0 }">
            <div class="txn-icon" :style="{ background: getTransactionMeta(entry).bg, color: getTransactionMeta(entry).color }">
              <span v-html="icon(getTransactionMeta(entry).icon, { size: 18 })"></span>
            </div>
            <div class="txn-body">
              <div class="txn-row">
                <span class="txn-title">{{ getTransactionMeta(entry).title }}</span>
                <span class="txn-time" :title="formatTransactionTime(entry.at)">{{ formatTxnClock(entry.at) }}</span>
              </div>
              <div v-if="entry.note" class="txn-note">{{ entry.note }}</div>
              <div v-if="entry.by" class="txn-by"><span v-html="icon('user', { size: 12 })"></span> {{ entry.by }}</div>
            </div>
          </div>
          </template>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" @click="closeTxnModal()">{{ tx('إغلاق', 'Close') }}</button>
      </div>
    </div>
  </div>

  <!-- ========== تقديم شكوى ========== -->
  <div v-if="complaintOrder" class="modal-overlay" @click.self="closeComplaintModal()">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">{{ tx('تقديم شكوى على الطلب', 'File a complaint for order') }} #{{ complaintOrder.invoiceNo }}</h3>
        <button class="modal-close" @click="closeComplaintModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-weight:700;">{{ tx('نوع الشكوى', 'Complaint type') }}</label>
          <select v-model="complaintCategory" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px; font-family:inherit;">
            <option v-for="c in COMPLAINT_CATEGORIES" :key="c.id" :value="c.id">{{ nameOf(c) }}</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight:700;">{{ tx('تفاصيل الشكوى', 'Complaint details') }}</label>
          <textarea id="complaint-text" :placeholder="tx('اكتب تفاصيل الشكوى هنا...', 'Write the complaint details here…')" style="width:100%; min-height:100px; padding:10px; border:1px solid var(--border); border-radius:6px; resize:vertical; font-family:inherit;" v-model="complaintText"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="closeComplaintModal()">{{ tx('إلغاء', 'Cancel') }}</button>
        <button class="btn btn-danger" @click="doSubmitComplaint()">{{ tx('حفظ الشكوى', 'Save complaint') }}</button>
      </div>
    </div>
  </div>
</template>
