<script setup lang="ts">
// مودالات شاشة الطلب الجديد: ملاحظات الطلب · رسوم التوصيل · سجل طلبات العميل ·
// مراجعة الطلب. مُجمَّعة في ملف واحد لأنها كلها تخصّ السلة وتُركَّب مرّة واحدة.
import { ref, watch, computed, nextTick } from 'vue'
import {
  state,
  closeOrderNotesModal, saveOrderNotes,
  closeHistoryModal, reorderItems, toggleHistoryDetail, orderStatusLabel,
  closeReviewModal, confirmReview, reviewSummary,
  closeCartItemNote, saveCartItemNote, cartItemBeingNoted, phoneShow,
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
// الحرف الأوّل لصورة العميل الرمزيّة — اسمٌ فارغ يعطي شرطةً لا مربّعاً فارغاً
const initialOf = (n: string) => (n || '').trim().charAt(0) || '—'

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
            <tr><th>{{ tx('التاريخ', 'Date') }}</th><th>{{ tx('رقم الفاتورة', 'Invoice no.') }}</th><th>{{ tx('الفرع', 'Branch') }}</th><th>{{ tx('الموظف', 'Agent') }}</th><th>{{ tx('الإجمالي', 'Total') }}</th><th>{{ tx('الحالة', 'Status') }}</th><th></th></tr>
          </thead>
          <tbody>
            <!-- الصفّ يفتح تفاصيله: البنود تُجلَب عند أوّل فتح. سطرٌ يقول «٢٢٢٠ دولار»
                 ولا يقول ممّ تكوّن لا يُراجَع، و«إعادة الطلب» تُضغط على غير بصيرة. -->
            <template v-for="o in state.historyOrders" :key="o.id">
            <tr class="hist-row" :class="{ open: state.historyOpenId === o.id }" @click="toggleHistoryDetail(o.id)">
              <td>{{ formatDate(o.businessDate || o.createdAt) }}</td>
              <td style="font-weight:700;">#{{ o.invoiceNo }}</td>
              <td>{{ o.branchName }}</td>
              <!-- مَن ضرب الطلب: السجلّ كان يقول ماذا طُلب ولا يقول مَن أخذه -->
              <td>{{ o.employeeName || '—' }}</td>
              <td style="font-weight:700;">{{ formatCurrency(o.total) }}</td>
              <td>{{ orderStatusLabel(o.status) }}</td>
              <td>
                <button class="btn btn-sm btn-primary" :disabled="state.reorderBusy" @click.stop="reorderItems(o.id)">
                  {{ state.reorderBusy ? '...' : tx('إعادة الطلب', 'Reorder') }}
                </button>
              </td>
            </tr>
            <tr v-if="state.historyOpenId === o.id" class="hist-detail">
              <td colspan="7">
                <div v-if="!o.itemsLoaded" class="hist-empty">{{ tx('جارٍ التحميل…', 'Loading…') }}</div>
                <template v-else>
                  <div v-for="(it, k) in (o.items || [])" :key="it.id ?? k" class="hist-item">
                    <span class="hist-q">{{ it.quantity }}<small>×</small></span>
                    <span class="hist-n">
                      {{ nameOf(it) }}
                      <em v-if="it.size" class="hist-sz">{{ it.size }}</em>
                      <em v-if="it.note" class="hist-note">{{ tx('ملاحظة:', 'Note:') }} {{ it.note }}</em>
                    </span>
                    <span class="hist-p">{{ formatCurrency(it.total || (it.price * it.quantity)) }}</span>
                  </div>
                  <div v-if="!(o.items || []).length" class="hist-empty">{{ tx('لا توجد بنود مسجّلة لهذا الطلب', 'No items recorded for this order') }}</div>
                  <div v-if="o.notes" class="hist-onote">{{ tx('ملاحظات الطلب:', 'Order notes:') }} {{ o.notes }}</div>
                </template>
              </td>
            </tr>
            </template>
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

  <!-- ========== مراجعة الطلب ========== -->
  <div v-if="state.reviewModalOpen && review" class="modal-overlay" @click.self="closeReviewModal()">
    <div class="modal-content rv-modal" @click.stop>
      <div class="modal-header rv-header">
        <div class="rv-title-wrap">
          <h3 class="modal-title">{{ tx('مراجعة الطلب قبل التأكيد', 'Review before confirming') }}</h3>
          <p class="rv-subtitle">{{ tx('بعد التأكيد ينزل الطلب للفرع مباشرةً', 'Once confirmed the order goes straight to the branch') }}</p>
        </div>
        <button class="modal-close" @click="closeReviewModal()">×</button>
      </div>

      <div class="modal-body rv-body">
        <!-- ── العميل: اسمٌ يُقرأ من بعيد، لا خانةٌ في شبكة ──────────────────── -->
        <section class="rv-cust">
          <span class="rv-avatar">{{ initialOf(review.customerName) }}</span>
          <div class="rv-cust-main">
            <div class="rv-cust-name">{{ review.customerName }}</div>
            <div class="rv-cust-phone" dir="ltr">{{ phoneShow(review.customerPhone) }}</div>
          </div>
          <span class="rv-type">
            <span class="rv-type-ico" v-html="icon(review.orderType === 'delivery' ? 'bike' : 'store', { size: 13 })"></span>
            {{ review.orderTypeName || (review.orderType === 'delivery' ? tx('توصيل', 'Delivery') : tx('استلام', 'Pickup')) }}
          </span>
        </section>

        <!-- ── الوجهة والدفع: أيقونةٌ وسطران، لا شبكةُ تسمياتٍ وقيم ─────────── -->
        <section class="rv-facts">
          <div v-if="review.areaName" class="rv-fact rv-fact-wide">
            <span class="rv-fico" v-html="icon('layers', { size: 15 })"></span>
            <div class="rv-ftxt">
              <span class="rv-fl">{{ tx('المنطقة', 'Area') }}</span>
              <span class="rv-fv">{{ review.areaName }}<template v-if="review.sectionName"> — {{ review.sectionName }}</template></span>
            </div>
          </div>
          <div v-if="review.orderType === 'delivery'" class="rv-fact rv-fact-wide">
            <span class="rv-fico" v-html="icon('map-pin', { size: 15 })"></span>
            <div class="rv-ftxt">
              <span class="rv-fl">{{ tx('العنوان', 'Address') }}</span>
              <span class="rv-fv">{{ review.address }}</span>
            </div>
          </div>
          <div class="rv-fact">
            <span class="rv-fico" v-html="icon('store', { size: 15 })"></span>
            <div class="rv-ftxt">
              <span class="rv-fl">{{ tx('الفرع', 'Branch') }}</span>
              <span class="rv-fv">{{ review.branchName }}</span>
            </div>
          </div>
          <div class="rv-fact">
            <span class="rv-fico" v-html="icon('wallet', { size: 15 })"></span>
            <div class="rv-ftxt">
              <span class="rv-fl">{{ tx('الدفع', 'Payment') }}</span>
              <span class="rv-fv">{{ review.payment }}</span>
            </div>
          </div>
          <div v-if="review.orderTag" class="rv-fact">
            <span class="rv-fico" v-html="icon('tag', { size: 15 })"></span>
            <div class="rv-ftxt">
              <span class="rv-fl">{{ tx('رقم المنصّة', 'Platform no.') }}</span>
              <span class="rv-fv" dir="ltr">{{ review.orderTag }}</span>
            </div>
          </div>
          <!-- الحجز: موعدٌ يُقرأ لا سلسلة ISO — كان يُطبع «2026-08-23T13:00» -->
          <div v-if="review.isReservation" class="rv-fact rv-fact-wide rv-fact-accent">
            <span class="rv-fico" v-html="icon('clock', { size: 15 })"></span>
            <div class="rv-ftxt">
              <span class="rv-fl">{{ tx('حجز — موعد الاستلام', 'Reservation — pickup time') }}</span>
              <span class="rv-fv">
                {{ formatDateTimeLocal(review.reservationTime) }}
                <span v-if="review.prepLeadMinutes" class="rv-fsub">· {{ tx('يبدأ التحضير قبله بـ', 'starts prep') }} {{ review.prepLeadMinutes }} {{ tx('دقيقة', 'min before') }}</span>
              </span>
            </div>
          </div>
        </section>

        <!-- ── الأصناف: قائمة إيصال لا جدول بيانات ──────────────────────────
             الكمية شارةٌ قبل الاسم بدل عمودٍ مستقلّ، والسعر على الحافّة المقابلة —
             فيختفي رأس الجدول الثقيل وتُقرأ الأسطر كما تُقرأ الفاتورة. -->
        <div class="rv-sec">
          <span class="rv-sec-t">{{ tx('الأصناف', 'Items') }}</span>
          <span class="rv-sec-n">{{ review.items.length }}</span>
        </div>
        <ul class="rv-list">
          <li v-for="i in review.items" :key="i.cartItemId" class="rv-row">
            <span class="rv-qty">{{ i.quantity }}<small>×</small></span>
            <div class="rv-row-main">
              <div class="rv-name">
                {{ nameOf(i) }}
                <span v-if="i.size" class="rv-size">{{ nameOf({ nameAr: i.sizeAr ?? i.size, nameEn: i.sizeEn }) }}</span>
              </div>
              <div v-if="itemMods(i).length" class="rv-mods">
                <span v-for="(m, k) in itemMods(i)" :key="k" class="rv-mod">
                  {{ m.name }}
                  <b :class="{ free: !m.price }">{{ m.price ? '+' + formatCurrency(m.price) : tx('مجاني', 'Free') }}</b>
                </span>
              </div>
              <div v-if="i.note" class="rv-note">
                <span v-html="icon('alert-circle', { size: 12 })"></span>{{ i.note }}
              </div>
            </div>
            <div class="rv-price">
              <span class="rv-line-total">{{ formatCurrency(i.price * i.quantity) }}</span>
              <span v-if="i.quantity > 1" class="rv-unit">{{ formatCurrency(i.price) }} {{ tx('للواحدة', 'each') }}</span>
            </div>
          </li>
        </ul>

        <div v-if="review.notes" class="rv-notes">
          <span class="rv-notes-ico" v-html="icon('alert-triangle', { size: 14 })"></span>
          <div><strong>{{ tx('ملاحظات الطلب', 'Order notes') }}</strong><div>{{ review.notes }}</div></div>
        </div>

        <!-- ── الإجمالي: الرقم الذي يُقرأ للعميل، في لوحةٍ خاصّةٍ به ─────────── -->
        <section class="rv-sum">
          <div class="rv-sum-row">
            <span>{{ tx('المجموع', 'Subtotal') }}</span>
            <span class="rv-sum-v">{{ formatCurrency(review.subtotal) }}</span>
          </div>
          <div v-for="l in (review.discount?.lines || [])" :key="l.id" class="rv-sum-row rv-disc">
            <span>{{ tx('خصم', 'Discount') }} · {{ l.name }}</span>
            <span class="rv-sum-v">− {{ formatCurrency(l.amount) }}</span>
          </div>
          <div v-if="review.orderType === 'delivery'" class="rv-sum-row">
            <span>
              {{ tx('رسوم التوصيل', 'Delivery fee') }}
              <span v-if="review.feeIsOpen" class="rv-open-fee">{{ tx('مفتوحة — يحدّدها الفرع', 'open — set by the branch') }}</span>
            </span>
            <span class="rv-sum-v">{{ formatCurrency(review.deliveryFee) }}</span>
          </div>
          <div class="rv-grand">
            <span class="rv-grand-l">{{ tx('الإجمالي', 'Total') }}</span>
            <strong class="rv-grand-v">{{ formatCurrency(review.total) }}</strong>
          </div>
        </section>

      </div>

      <div class="modal-footer rv-footer">
        <button class="btn btn-secondary rv-back" @click="closeReviewModal()">{{ tx('رجوع للتعديل', 'Back to edit') }}</button>
        <button class="btn btn-primary rv-confirm" @click="confirmReview()">
          <span v-html="icon('check-circle', { size: 17 })"></span>
          {{ tx('تأكيد وإرسال للفرع', 'Confirm and send') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* سجلّ العميل: الصفّ يُضغَط ليفتح بنودَه */
.hist-row { cursor: pointer; }
.hist-row.open { background: var(--primary-light, #eff6ff); }
.hist-detail > td { padding: 10px 14px; background: var(--bg, #f8fafc); }
.hist-item { display: flex; align-items: flex-start; gap: 10px; padding: 4px 0; font-size: 12.5px; }
.hist-item + .hist-item { border-top: 1px dashed var(--border-light, #eef2f7); }
.hist-q { font-weight: 800; min-width: 30px; }
.hist-q small { font-weight: 600; opacity: 0.6; }
.hist-n { flex: 1; font-weight: 600; }
.hist-sz, .hist-note { display: block; font-style: normal; font-size: 11px; font-weight: 600; opacity: 0.75; }
.hist-p { font-weight: 700; white-space: nowrap; }
.hist-empty, .hist-onote { font-size: 11.5px; font-weight: 600; color: var(--text-muted, #94a3b8); padding: 4px 0; }
.hist-onote { margin-top: 6px; border-top: 1px dashed var(--border-light, #eef2f7); padding-top: 6px; }
/* ── شاشة مراجعة الطلب ───────────────────────────────────────────────────────
   كانت ثلاثَ بطاقاتٍ رماديّة متطابقة فوق بعضها: كلُّ شيءٍ بالوزن نفسه، فلا يقول
   الشكلُ ما المهمّ. صارت تسلسلاً: **مَن** (العميل) ثم **إلى أين** (الوجهة) ثم
   **ماذا** (الأصناف) ثم **بكم** (الإجمالي) — ولكلِّ طبقةٍ لغتُها البصريّة. */
/* التمرير للأصناف وحدها: الجسم كان يمرّر كاملاً، فمع ١٢ صنفاً يختفي الإجمالي
   والأزرار تحت الشاشة — والوكيل يبحث عن «تأكيد» بالتمرير في كل طلب. الترويسة
   والعميل والوجهة والإجمالي والأزرار تبقى ثابتةً في العين. */
.rv-modal {
  max-width: 620px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;   /* بدل تمرير البطاقة كلها (.modal-content) */
}
.rv-header, .rv-footer { flex: 0 0 auto; }
.rv-header { align-items: flex-start; gap: 12px; padding: 14px 20px; }
.rv-title-wrap { min-width: 0; }
.rv-subtitle {
  margin: 3px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
}
.rv-body {
  padding: 16px 20px 18px;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;   /* احتياطٌ لشاشةٍ قصيرة جداً لا يكفيها الثابتُ نفسه */
}
.rv-body > * { flex: 0 0 auto; }

/* ── العميل ── */
.rv-cust {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: var(--radius-lg, 14px);
  background: var(--primary-lighter, #eff6ff);
  border: 1px solid rgba(26, 86, 219, 0.14);
}
.rv-avatar {
  flex: 0 0 auto;
  width: 40px; height: 40px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--primary, #1a56db);
  color: #fff;
  font-size: 17px; font-weight: 800;
}
.rv-cust-main { flex: 1 1 auto; min-width: 0; }
.rv-cust-name {
  font-size: 15.5px; font-weight: 800; line-height: 1.3;
  color: var(--text-primary, #0f172a);
  overflow-wrap: anywhere;
}
.rv-cust-phone {
  font-size: 12.5px; font-weight: 700; line-height: 1.3;
  color: var(--text-secondary, #64748b);
  font-variant-numeric: tabular-nums;
}
.rv-type {
  flex: 0 0 auto;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px;
  border-radius: var(--radius-full, 999px);
  background: var(--white, #fff);
  border: 1px solid rgba(26, 86, 219, 0.2);
  color: var(--primary, #1a56db);
  font-size: 12px; font-weight: 800;
  white-space: nowrap;
}
.rv-type-ico { display: inline-flex; }

/* ── الوجهة والدفع ── */
.rv-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 0;
  margin-top: 12px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-lg, 14px);
  overflow: hidden;
}
.rv-fact {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 9px 11px;
  background: var(--white, #fff);
  box-shadow: 0 0 0 1px var(--border-light, #f3f4f6);
  min-width: 0;
}
.rv-fact-wide { grid-column: 1 / -1; }
.rv-fico {
  flex: 0 0 auto;
  width: 26px; height: 26px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg, #f0f2f5);
  color: var(--primary, #1a56db);
}
.rv-ftxt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rv-fl { font-size: 10.5px; font-weight: 700; line-height: 1.3; color: var(--text-secondary, #64748b); }
.rv-fv {
  font-size: 13px; font-weight: 700; line-height: 1.35;
  color: var(--text-primary, #0f172a);
  overflow-wrap: anywhere;
}
.rv-fsub { font-size: 11.5px; font-weight: 600; color: var(--text-secondary, #64748b); }
.rv-fact-accent { background: var(--primary-lighter, #eff6ff); }
.rv-fact-accent .rv-fv { color: var(--primary-darker, #1e40af); }
.rv-fact-accent .rv-fico { background: var(--white, #fff); }

/* ── عنوان القسم ── */
.rv-sec {
  display: flex; align-items: center; gap: 8px;
  margin: 14px 0 7px;
}
.rv-sec-t { font-size: 12px; font-weight: 800; color: var(--text-secondary, #64748b); }
.rv-sec-n {
  min-width: 20px; padding: 1px 6px;
  border-radius: var(--radius-full, 999px);
  background: var(--bg, #f0f2f5);
  color: var(--text-secondary, #64748b);
  font-size: 11px; font-weight: 800; text-align: center;
  font-variant-numeric: tabular-nums;
}
.rv-sec::after {
  content: ''; flex: 1 1 auto; height: 1px;
  background: var(--border-light, #f3f4f6);
}

/* ── الأصناف: أسطر إيصال ── */
.rv-list {
  list-style: none; margin: 0; padding: 0;
  /* الارتفاع مثبَّت: تُظهر القائمة ما يسعها وتمرّر داخلها، فلا تدفع ما تحتها */
  flex: 0 1 auto;
  /* لا ارتفاعَ أدنى: صنفان لا يملآن ١٣٢px فتظهر فجوةٌ فارغة تحتهما توحي بأن
     شيئاً نقص. تلتصق القائمة بمحتواها إن قلّ، ويحكمها السقفُ والتمرير إن كثر. */
  min-height: 0;
  max-height: 44vh;
  /* الاختصار overflow كان بعدها فيدهس overflow-y ويعيدها hidden — فالقائمة
     لا تمرّر إطلاقاً وباقي الأصناف لا سبيل إليه. المحور الأفقيّ وحده يُقصّ. */
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-lg, 14px);
}
.rv-row {
  display: flex; align-items: flex-start; gap: 11px;
  padding: 10px 12px;
  background: var(--white, #fff);
}
.rv-row + .rv-row { border-top: 1px solid var(--border-light, #f3f4f6); }
/* الكمية شارةٌ قبل الاسم: عمودٌ كامل لرقمٍ من خانةٍ واحدة كان إسرافاً في العرض */
.rv-qty {
  flex: 0 0 auto;
  min-width: 30px; height: 26px; padding: 0 6px;
  border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center; gap: 1px;
  background: var(--primary-lighter, #eff6ff);
  color: var(--primary, #1a56db);
  font-size: 13px; font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.rv-qty small { font-size: 10px; font-weight: 700; opacity: 0.75; }
.rv-row-main { flex: 1 1 auto; min-width: 0; }
.rv-name {
  font-size: 13.5px; font-weight: 700; line-height: 1.35;
  color: var(--text-primary, #0f172a);
}
.rv-size {
  margin-inline-start: 6px; padding: 1px 7px;
  border-radius: var(--radius-full, 999px);
  background: var(--primary-light, #dbeafe);
  color: var(--primary-dark, #1242b0);
  font-size: 10.5px; font-weight: 800;
}
.rv-mods { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.rv-mod {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 7px;
  background: var(--bg, #f0f2f5);
  font-size: 11px; font-weight: 600; color: var(--text-secondary, #64748b);
}
.rv-mod b { font-weight: 800; color: var(--text-primary, #0f172a); }
.rv-mod b.free { color: #166534; }
.rv-note {
  display: flex; align-items: center; gap: 5px;
  margin-top: 6px;
  font-size: 11.5px; font-weight: 700; color: #b45309;
}
.rv-price {
  flex: 0 0 auto;
  display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
  text-align: end;
}
.rv-line-total {
  font-size: 13.5px; font-weight: 800; white-space: nowrap;
  color: var(--text-primary, #0f172a);
  font-variant-numeric: tabular-nums;
}
.rv-unit {
  font-size: 11px; font-weight: 600; white-space: nowrap;
  color: var(--text-muted, #94a3b8);
  font-variant-numeric: tabular-nums;
}

/* ── الإجماليات ── */
/* الإجمالي ملتصقٌ بأسفل الجسم: مهما طالت الأصناف يبقى الرقم في العين، والأزرار
   في التذييل خارج المنطقة الممرَّرة أصلاً. */
.rv-sum {
  position: sticky;
  bottom: 0;
  z-index: 1;
  background: var(--white, #fff);
  box-shadow: 0 -6px 14px -8px rgba(15, 23, 42, 0.25);
  margin-top: 12px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-lg, 14px);
  overflow: hidden;
}
.rv-sum-row {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  padding: 7px 13px;
  font-size: 13px; font-weight: 600; line-height: 1.4;
  color: var(--text-secondary, #64748b);
  background: var(--white, #fff);
}
.rv-sum-v {
  font-weight: 700; white-space: nowrap;
  color: var(--text-primary, #0f172a);
  font-variant-numeric: tabular-nums;
}
.rv-open-fee {
  margin-inline-start: 6px; padding: 1px 7px;
  border-radius: var(--radius-full, 999px);
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
  font-size: 10.5px; font-weight: 800;
}
/* الرقم الذي يُقرأ للعميل — لوحةٌ ملوّنة لا سطرٌ أثقل قليلاً */
/* بلون الخصم نفسه في السلّة — الوكيل يرى الرقمَ ذاته في الشاشتين */
.rv-disc { color: var(--success, #16a34a); font-weight: 700; }
.rv-disc .rv-sum-v { color: var(--success, #16a34a); }
.rv-grand {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 11px 13px;
  background: var(--primary, #1a56db);
  color: #fff;
}
.rv-grand-l { font-size: 13.5px; font-weight: 700; opacity: 0.92; }
.rv-grand-v {
  font-size: 20px; font-weight: 800; white-space: nowrap; letter-spacing: -0.3px;
  font-variant-numeric: tabular-nums;
}

/* ── ملاحظات الطلب ── */
.rv-notes {
  display: flex; align-items: flex-start; gap: 9px;
  margin-top: 12px; padding: 9px 11px;
  border-radius: var(--radius, 10px);
  background: var(--warning-light, #fffbeb);
  border: 1px solid rgba(245, 158, 11, 0.45);
  font-size: 12px; line-height: 1.65;
  color: var(--text-primary, #0f172a);
}
.rv-notes-ico { flex: 0 0 auto; color: #b45309; display: inline-flex; }
.rv-notes strong { display: block; font-size: 11.5px; color: #b45309; }

/* ── الأزرار: التأكيد فعلٌ لا رجعة فيه، فله الوزن والمساحة ── */
.rv-footer { justify-content: space-between; gap: 12px; }
.rv-back { flex: 0 0 auto; }
.rv-confirm { flex: 1 1 auto; max-width: 320px; gap: 8px; font-weight: 700; }

/* ── الوضع الليلي ── */
body.dark-mode .rv-cust {
  background: rgba(96, 165, 250, 0.12);
  border-color: rgba(96, 165, 250, 0.28);
}
body.dark-mode .rv-type {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(96, 165, 250, 0.3);
  color: #93c5fd;
}
body.dark-mode .rv-fact,
body.dark-mode .rv-row,
body.dark-mode .rv-sum-row { background: var(--bg-card, #1e293b); }
body.dark-mode .rv-fact { box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.18); }
body.dark-mode .rv-fico,
body.dark-mode .rv-mod,
body.dark-mode .rv-sec-n { background: rgba(255, 255, 255, 0.07); }
body.dark-mode .rv-fact-accent { background: rgba(96, 165, 250, 0.14); }
body.dark-mode .rv-fact-accent .rv-fv { color: #bfdbfe; }
body.dark-mode .rv-qty { background: rgba(96, 165, 250, 0.16); color: #93c5fd; }
body.dark-mode .rv-size { color: #bfdbfe; }
body.dark-mode .rv-mod b.free { color: #4ade80; }
body.dark-mode .rv-note { color: #fbbf24; }
body.dark-mode .rv-notes {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.4);
  color: #e2e8f0;
}
body.dark-mode .rv-notes strong,
body.dark-mode .rv-notes-ico { color: #fbbf24; }
body.dark-mode .rv-grand { background: var(--primary-darker, #2563eb); }
body.dark-mode .rv-sum { background: var(--bg-card, #1e293b); }
</style>
