<script setup lang="ts">
// مودالات شاشة الأوردر الجديد: ملاحظات الطلب · رسوم التوصيل · سجل طلبات العميل ·
// مراجعة الأوردر. مُجمَّعة في ملف واحد لأنها كلها تخصّ السلة وتُركَّب مرّة واحدة.
import { ref, watch, computed, nextTick } from 'vue'
import {
  state,
  closeOrderNotesModal, saveOrderNotes,
  closeHistoryModal, reorderItems,
  closeReviewModal, confirmReview, reviewSummary,
  closeCartItemNote, saveCartItemNote, cartItemBeingNoted,
} from '../store'
import { formatCurrency, formatDate, formatDateTimeLocal } from '../utils'
import { tx, lang, nameOf } from '../lang'
import { icon } from '../icons'

// ── ملاحظات الطلب ──
const noteText = ref('')
watch(() => state.notesModalOpen, (open) => { if (open) noteText.value = state.orderNotes || '' })


// ── ملاحظة صنفٍ في السلّة ──
const notedItem = computed<any>(() => (state.noteItemId ? cartItemBeingNoted() : null))
const itemNoteText = ref('')
const itemNoteBox = ref<HTMLTextAreaElement | null>(null)
// الوكيل يضغط «ملاحظة» وهو يستمع للعميل — المؤشّر جاهز فيكتب بلا نقرةٍ ثانية
watch(notedItem, (ci) => {
  if (!ci) return
  itemNoteText.value = state.noteItemText
  void nextTick(() => itemNoteBox.value?.focus())
})

// ── المراجعة ──
const review = computed<any>(() => (state.reviewModalOpen ? reviewSummary() : null))

/**
 * إضافات السطر بأسمائها **وأسعارها**.
 * كانت تُعرض أسماءً مفصولةً بفواصل بلا سعر: يُراجع الوكيل إجمالياً لا يعرف من أين
 * جاء، ولا يكتشف إضافةً اختيرت بالغلط إلا بعد نزول الطلب.
 * و`extras` (أسماء فقط) ارتدادٌ لسطرٍ أُضيف قبل أن تُخزَّن الإضافات ببنيتها.
 */
function itemMods(i: any): { name: string; price: number }[] {
  if (Array.isArray(i?.modifiers) && i.modifiers.length) {
    return i.modifiers.map((m: any) => ({ name: nameOf(m), price: Number(m.price) || 0 }))
  }
  return Array.isArray(i?.extras) ? i.extras.map((n: string) => ({ name: String(n), price: 0 })) : []
}
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

  <!-- ========== ملاحظة صنفٍ في السلّة ========== -->
  <!-- سطرٌ بعينه لا الطلب كلّه: «بدون بصل» تخصّ ساندويتشاً واحداً، ووضعُها في ملاحظة
       الطلب يجعل المطبخ يخمّن أيَّها المقصود. -->
  <div v-if="notedItem" class="modal-overlay" @click.self="closeCartItemNote()">
    <div class="modal-content" style="max-width:460px;" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ tx('ملاحظة على', 'Note on') }} {{ nameOf(notedItem) }}</h3>
        <button class="modal-close" @click="closeCartItemNote()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label style="font-weight:700;">{{ tx('تُطبَع على تذكرة المطبخ مع الصنف', 'Printed on the kitchen ticket with the item') }}</label>
          <textarea ref="itemNoteBox"
            :placeholder="tx('مثال: بدون بصل · مستوي جداً · الصوص جانباً', 'e.g. no onion · well done · sauce on the side')"
            style="width:100%; min-height:96px; padding:10px; border:1px solid var(--border); border-radius:6px; resize:vertical; font-family:inherit;"
            v-model="itemNoteText" @keydown.ctrl.enter="saveCartItemNote(itemNoteText)"></textarea>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn btn-secondary" @click="itemNoteText = ''">{{ tx('مسح', 'Clear') }}</button>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary" @click="closeCartItemNote()">{{ tx('إلغاء', 'Cancel') }}</button>
          <button class="btn btn-primary" @click="saveCartItemNote(itemNoteText)">{{ tx('حفظ', 'Save') }}</button>
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
        <!-- ── العميل والوجهة ──────────────────────────────────────────────────
             خانتان في الصفّ لا ثلاث: بثلاثٍ كان يبقى ثقبٌ في آخر صفٍّ كلما لم يكن
             عدد الحقول من مضاعفاتها — «الدفع» وحده وسط صفٍّ نصفه فراغ. والوجهة
             (منطقة · عنوان · موعد حجز) صفوفٌ كاملة تحت خطٍّ فاصل: هويّةٌ فوق ووجهةٌ
             تحت، فتُقرأ الشاشة بالنظرة لا بالتفتيش. -->
        <div class="rv-head">
          <div class="rv-grid">
            <div class="rv-cell">
              <span class="rv-l">{{ tx('العميل', 'Customer') }}</span>
              <span class="rv-v">{{ review.customerName }}</span>
            </div>
            <div class="rv-cell">
              <span class="rv-l">{{ tx('رقم الهاتف', 'Phone') }}</span>
              <span class="rv-v" dir="ltr">{{ review.customerPhone }}</span>
            </div>
            <div class="rv-cell">
              <span class="rv-l">{{ tx('نوع الطلب', 'Order type') }}</span>
              <span class="rv-v">
                {{ review.orderTypeName || (review.orderType === 'delivery' ? tx('توصيل', 'Delivery') : tx('استلام', 'Pickup')) }}
                <span v-if="review.orderTypeName" class="rv-sub">· {{ review.orderType === 'delivery' ? tx('توصيل', 'Delivery') : tx('استلام', 'Pickup') }}</span>
              </span>
            </div>
            <div class="rv-cell">
              <span class="rv-l">{{ tx('الفرع', 'Branch') }}</span>
              <span class="rv-v">{{ review.branchName }}</span>
            </div>
            <div class="rv-cell">
              <span class="rv-l">{{ tx('الدفع', 'Payment') }}</span>
              <span class="rv-v">{{ review.payment }}</span>
            </div>
            <div v-if="review.orderTag" class="rv-cell">
              <span class="rv-l">{{ tx('رقم المنصّة', 'Platform no.') }}</span>
              <span class="rv-v" dir="ltr">{{ review.orderTag }}</span>
            </div>
          </div>

          <div v-if="review.areaName || review.orderType === 'delivery' || review.isReservation" class="rv-rows">
            <div v-if="review.areaName" class="rv-cell">
              <span class="rv-l">{{ tx('المنطقة', 'Area') }}</span>
              <span class="rv-v">{{ review.areaName }}<template v-if="review.sectionName"> — {{ review.sectionName }}</template></span>
            </div>
            <div v-if="review.orderType === 'delivery'" class="rv-cell">
              <span class="rv-l">{{ tx('العنوان', 'Address') }}</span>
              <span class="rv-v">{{ review.address }}</span>
            </div>
            <!-- الحجز: موعدٌ يُقرأ لا سلسلة ISO — كان يُطبع «2026-08-23T13:00» -->
            <div v-if="review.isReservation" class="rv-cell rv-accent">
              <span class="rv-l">{{ tx('حجز — موعد الاستلام', 'Reservation — pickup time') }}</span>
              <span class="rv-v">
                {{ formatDateTimeLocal(review.reservationTime) }}
                <template v-if="review.prepLeadMinutes">
                  <span class="rv-sub">· {{ tx('يبدأ التحضير قبله بـ', 'starts prep') }} {{ review.prepLeadMinutes }} {{ tx('دقيقة', 'min before') }}</span>
                </template>
              </span>
            </div>
          </div>
        </div>

        <!-- ── الأصناف: الإضافات بأسعارها ──────────────────────────────────────
             كانت أسماءً مفصولةً بفواصل بلا أسعار: يُراجع الوكيل إجمالياً لا يعرف من
             أين جاء، ولا يكتشف إضافةً اختيرت بالغلط إلا بعد نزول الطلب.
             والجدول كان عارياً بحوافّ حادّة بين بطاقتين مدوّرتين — فأُطِّر مثلهما. -->
        <div class="rv-items-wrap">
          <table class="orders-table rv-items">
            <thead>
              <tr>
                <th>{{ tx('الصنف', 'Item') }}</th>
                <th class="rv-qty">{{ tx('الكمية', 'Qty') }}</th>
                <th class="rv-num">{{ tx('السعر', 'Price') }}</th>
                <th class="rv-num">{{ tx('الإجمالي', 'Total') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in review.items" :key="i.cartItemId">
                <td>
                  <div class="rv-item-name">
                    {{ nameOf(i) }}
                    <span v-if="i.size" class="rv-size">{{ nameOf({ nameAr: i.sizeAr ?? i.size, nameEn: i.sizeEn }) }}</span>
                  </div>
                  <div v-if="itemMods(i).length" class="rv-mods">
                    <span v-for="(m, k) in itemMods(i)" :key="k" class="rv-mod">
                      {{ m.name }}
                      <b :class="{ free: !m.price }">{{ m.price ? '+' + formatCurrency(m.price) : tx('مجاني', 'Free') }}</b>
                    </span>
                  </div>
                  <div v-if="i.note" class="rv-note">{{ tx('ملاحظة: ', 'Note: ') }}{{ i.note }}</div>
                </td>
                <td class="rv-qty">{{ i.quantity }}</td>
                <td class="rv-num">{{ formatCurrency(i.price) }}</td>
                <td class="rv-num rv-strong">{{ formatCurrency(i.price * i.quantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- الإجماليات — الأرقام على محورٍ واحد بأرقامٍ متساوية العرض، فتُقارَن بالنظر -->
        <div class="rv-totals">
          <div class="rv-total-row">
            <span class="rv-total-l">{{ tx('المجموع', 'Subtotal') }}</span>
            <span class="rv-total-v">{{ formatCurrency(review.subtotal) }}</span>
          </div>
          <div v-if="review.orderType === 'delivery'" class="rv-total-row">
            <span class="rv-total-l">
              {{ tx('رسوم التوصيل', 'Delivery fee') }}
              <span v-if="review.feeIsOpen" class="rv-open-fee">({{ tx('مفتوحة — يحدّدها الفرع', 'open — set by the branch') }})</span>
            </span>
            <span class="rv-total-v">{{ formatCurrency(review.deliveryFee) }}</span>
          </div>
          <div class="rv-total-row rv-grand">
            <span class="rv-total-l">{{ tx('الإجمالي', 'Total') }}</span>
            <span class="rv-total-v">{{ formatCurrency(review.total) }}</span>
          </div>
        </div>

        <div v-if="review.notes" class="rv-notes">
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

<style scoped>
/* ── ترويسة المراجعة: تسميةٌ فوق وقيمةٌ تحت ─────────────────────────────────
   كانت أزواج «تسمية: قيمة» بخطٍّ واحد ولونٍ متقارب في شبكةٍ ضيّقة — تُقرأ
   بالتفتيش لا بالنظرة. والتليفون بلا تسمية معلَّقاً في الجهة المقابلة. */
.rv-head {
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--bg, #f8fafc);
  border: 1px solid var(--border, #e5e7eb);
}
/* خانتان في الصفّ لا ثلاث: بثلاثٍ يبقى ثقبٌ في آخر صفٍّ كلما لم يكن عدد الحقول
   من مضاعفاتها — «الدفع» وحده وسط صفٍّ نصفه فراغ. */
.rv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 18px;
}
/* الوجهة صفوفٌ كاملة تحت خطٍّ فاصل — العنوان طويل فلا يُحشَر في نصف صفّ */
.rv-rows {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border, #e5e7eb);
}
@media (max-width: 430px) { .rv-grid { grid-template-columns: minmax(0, 1fr); } }
.rv-cell { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rv-l { font-size: 11px; font-weight: 600; color: #4b5563; }
.rv-v {
  font-size: 13.5px; font-weight: 700; line-height: 1.55;
  color: var(--text-primary, #0f172a);
  overflow-wrap: anywhere;
}
.rv-accent .rv-v { color: var(--primary, #1a56db); }
.rv-sub { font-size: 11.5px; font-weight: 600; color: #4b5563; }

/* ── الأصناف ── */
/* الجدول داخل إطارٍ مدوّر كبقيّة البطاقات، ورأسه هادئ: كان شريطاً رماديّاً بحروفٍ
   كبيرة ومتباعدة يسحب العين من الأصناف نفسها. */
.rv-items-wrap {
  margin-top: 14px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
}
.rv-items th { padding: 10px 14px; text-transform: none; letter-spacing: 0; font-size: 11.5px; }
.rv-items td { padding: 11px 14px; }
/* صفوف المراجعة لا تُنقَر — مؤشّر اليد والإضاءة عند المرور كانا يَعِدان بفعلٍ لا يقع */
.rv-items tbody tr { cursor: default; }
.rv-items tbody tr:hover { background: transparent; }
/* الأرقام على محورٍ واحد وبعرضٍ ثابت، فتُقارَن بالنظر لا بالقراءة */
.rv-items th.rv-num, .rv-items td.rv-num {
  text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums;
}
.rv-items th.rv-qty, .rv-items td.rv-qty {
  text-align: center; white-space: nowrap; width: 1%; font-variant-numeric: tabular-nums;
}
.rv-items td.rv-strong { font-weight: 800; }
.rv-item-name { font-weight: 700; color: var(--text-primary, #0f172a); }
.rv-size {
  margin-inline-start: 6px; padding: 1px 7px; border-radius: 999px;
  background: var(--primary-light, #dbeafe); color: var(--primary-dark, #1242b0);
  font-size: 10.5px; font-weight: 800;
}
.rv-mods { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
.rv-mod {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 7px;
  background: var(--bg, #f1f5f9); border: 1px solid var(--border-light, #eef1f6);
  font-size: 11px; font-weight: 600; color: #4b5563;
}
.rv-mod b { font-weight: 800; color: var(--text-primary, #0f172a); }
.rv-mod b.free { color: #166534; }
.rv-note { margin-top: 5px; font-size: 11px; font-weight: 700; color: #b45309; }

/* ── الإجماليات ── */
.rv-totals {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg, #f8fafc);
  border: 1px solid var(--border, #e5e7eb);
  font-size: 13px;
}
.rv-total-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 4px 0; }
.rv-total-l { color: var(--text-secondary, #64748b); }
.rv-total-v { font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.rv-open-fee { color: var(--warning, #b45309); font-weight: 700; }
/* الإجمالي هو الرقم الذي يُقرأ للعميل — فله وزنه ولونه وخطُّه الفاصل */
.rv-grand { margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--border, #e5e7eb); font-size: 15px; }
.rv-grand .rv-total-l { color: var(--text-primary, #0f172a); font-weight: 800; }
.rv-grand .rv-total-v { font-weight: 800; color: var(--primary, #1a56db); }

.rv-notes {
  margin-top: 12px; padding: 10px 12px; border-radius: 10px;
  background: var(--warning-light, #fffbeb);
  border: 1px solid var(--warning, #f59e0b);
  font-size: 12px; line-height: 1.6;
}
:global(body.dark-mode) .rv-note { color: #fbbf24; }
:global(body.dark-mode) .rv-l,
:global(body.dark-mode) .rv-sub,
:global(body.dark-mode) .rv-mod { color: #cbd5e1; }
:global(body.dark-mode) .rv-mod b.free { color: #4ade80; }
:global(body.dark-mode) .rv-head,
:global(body.dark-mode) .rv-totals,
:global(body.dark-mode) .rv-mod { background: rgba(255, 255, 255, 0.04); }
:global(body.dark-mode) .rv-total-l { color: #cbd5e1; }
:global(body.dark-mode) .rv-notes { background: rgba(245, 158, 11, 0.12); }
</style>
