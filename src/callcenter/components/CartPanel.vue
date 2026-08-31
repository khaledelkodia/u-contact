<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { state, clearCart, removeCartItem, updateCartItemQty, openItemModal, openOrderNotesModal, openPaymentModal, checkout, getResolvedOrderBranchId, getCartSubtotal, getAppliedDeliveryFee, getCartTotal, computeDiscount, discountsForOrder, toggleDiscount, discountAppliesNow, discountScopeText, canSubmitOrder, toggleReservation, earliestReservationTime, openCartItemNote, saveOrderEdit, cancelOrderEdit } from '../store'
import { PAYMENT_CHANNELS, PAYMENT_METHODS } from '../data'
import { formatCurrency } from '../utils'
import { tx, nameOf } from '../lang'
import { t } from '../lang'
import { icon } from '../icons'

// الخصومات: المطبَّق فعلاً (تلقائيّ + ما اختاره الوكيل) وقائمةُ اليدويّ المتاح.
// تُحسَب من السلّة نفسها فتتغيّر معها بلا زرّ «أعد الحساب».
const dsc = computed<any>(() => computeDiscount())
const manualRules = computed<any[]>(() => discountsForOrder().filter((d: any) => !d.isAuto))
const pickedIds = computed<number[]>(() => (state.pickedDiscountIds || []).map(Number))

const disabledItems = computed<any[]>(() => {
  const id = getResolvedOrderBranchId()
  return id ? (state.disabledBranchItems[id] || []) : []
})

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
  let s = ''
  const sz = sizeLabel(item)
  if (sz) s += tx('حجم ', 'Size ') + sz
  const ex = extrasLabel(item)
  if (ex) { if (s) s += ' + '; s += ex }
  if (item.note) {
    if (s) s += '<br>'
    s += `<span style="color:var(--danger); font-size:11px;">${tx('ملاحظة: ', 'Note: ')}${item.note}</span>`
  }
  return s
}

// زر الدفع — الاختيار الحالي (نقلاً عن updatePaymentButton)
const selectedChannel = computed(() => PAYMENT_CHANNELS.find((c: any) => c.id === state.paymentChannel) || null)
const selectedMethod = computed(() => PAYMENT_METHODS.find((m: any) => m.id === state.paymentMethod) || null)
// المصدر اختياريّ ⇒ الطريقة وحدها تُعلن أن الدفع «مُختار»
const paymentSelected = computed(() => !!state.paymentMethod)

// ── تفاصيل الطلب (رقم المنصّة · ملاحظة · حجز) ────────────────────────────────
// الثلاثة اختيارية ونادرة، وكانت تشغل ثلث اللوحة **دائماً**: عنوانان أحمران وزرٌّ
// بعرض اللوحة وحقلٌ ظاهر ولو لم يُملأ قطّ — فتضيق قائمة الأصناف، وهي ما ينظر إليه
// الوكيل وهو يتكلّم. صارت شريطاً من ثلاث حبّات تُظهر قيمتها إن وُجدت وتفتح محرّرها
// عند الطلب؛ والحمرة لِما كُتب فعلاً لا لِما هو فارغ.
const tagOpen = ref(false)
const tagInput = ref<HTMLInputElement | null>(null)
function toggleTag() {
  tagOpen.value = !tagOpen.value
  if (tagOpen.value) nextTick(() => tagInput.value?.focus())
}

/**
 * رقمُ الطلب — أو لا شيء.
 *
 * لا يوجد رقمٌ قبل أن يُنشئه الفرع، فالطلب الجديد يُعرَض «طلب جديد» لا برقمٍ
 * مختلَق. وفي التعديل يُعرَض رقمُ الفاتورة الحقيقيّ — نفس ما تعرضه لوحة التفاصيل.
 */
const cartOrderNo = computed<string>(() => {
  const id = state.editingOrderId
  if (!id) return ''
  const o = (state.orders || []).find((x: any) => x.id === id)
  return o && o.invoiceNo ? `#${o.invoiceNo}` : ''
})

/** نصٌّ مختصر داخل الحبّة: القيمة إن وُجدت وإلا الاسم. */
const resLabel = computed(() => {
  const v = String(state.reservationTime || '')
  if (!v) return tx('حجز', 'Reservation')
  return v.replace('T', ' ').slice(5)   // MM-DD HH:mm — اليوم والساعة يكفيان هنا
})
</script>

<template>
  <div id="cart-panel" class="cart-panel">
    <div class="cart-header">
      <div>
        <!-- الطلب الجديد بلا رقم: الفرع هو من يُنشئه عند نزوله. والرقم هنا كان
             ثابتاً مكتوباً في القالب — يقرؤه الوكيل رقماً حقيقيّاً وهو ليس كذلك. -->
        <span v-if="cartOrderNo" class="cart-header-label">{{ t('order_number_label') }}</span>
        <span class="cart-order-no" id="cart-order-no" :class="{ 'is-draft': !cartOrderNo }">
          {{ cartOrderNo || tx('طلب جديد', 'New order') }}
        </span>
      </div>
      <button class="cart-delete-btn" @click="clearCart()" :title="tx('مسح السلة', 'Clear cart')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg></button>
    </div>

    <div id="cart-items" class="cart-items">
      <div v-if="state.cart.length === 0" class="cart-empty">
        <div class="cart-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>
        <p>{{ t('cart_empty') }}</p>
        <p style="font-size:12px; margin-top:4px;">{{ t('choose_items') }}</p>
      </div>
      <div v-else v-for="item in state.cart" :key="item.cartItemId" class="cart-item" :class="{ 'cart-item-disabled': disabledItems.includes(item.itemId) }">
        <div class="cart-item-top">
          <div class="cart-item-name">{{ nameOf(item) }}</div>
          <div class="cart-item-price">{{ formatCurrency(item.price * item.quantity) }}</div>
        </div>
        <div v-if="itemDetails(item)" class="cart-item-details" v-html="itemDetails(item)"></div>
        <div class="cart-item-bottom">
          <div class="cart-item-actions">
            <button class="cart-item-edit" @click="openItemModal(item.itemId, item.cartItemId)">{{ tx('تعديل', 'Edit') }}</button>
            <!-- الملاحظة بزرٍّ يقول ما يفعل: الصنف البسيط لا يفتح مودالاً عند الإضافة،
                 فكان «تعديل» طريقَها الوحيد ولا يخطر ببال أحد. -->
            <button class="cart-item-note" :class="{ 'has-note': !!item.note }"
              @click="openCartItemNote(item.cartItemId)"
              :title="item.note || tx('أضف ملاحظة على الصنف', 'Add a note on the item')">
              <span class="cart-item-note-ico" v-html="icon('message-square', { size: 13 })"></span>
              {{ tx('ملاحظة', 'Note') }}
            </button>
            <!-- الحذف كان يحتاج ضغطاً على «−» حتى الصفر، ولا شيء يدلّ عليه -->
            <button class="cart-item-del" @click="removeCartItem(item.cartItemId)"
              :title="tx('حذف الصنف من الطلب', 'Remove the item from the order')">
              <span class="cart-item-del-ico" v-html="icon('trash', { size: 13 })"></span>
              {{ tx('حذف', 'Remove') }}
            </button>
          </div>
          <div class="qty-control">
            <button class="qty-btn" @click="updateCartItemQty(item.cartItemId, -1)">-</button>
            <div class="qty-value">{{ item.quantity }}</div>
            <button class="qty-btn" @click="updateCartItemQty(item.cartItemId, 1)">+</button>
          </div>
        </div>
      </div>

      <!-- ملاحظة الطلب: آخرَ ما يقرؤه المطبخ، فآخرُ ما يُعرَض — تحت الأصناف كلّها.
           نصٌّ حرّ قد يطول، فيُعرَض كاملاً ويلتفّ، ويُنقَر ليُعدَّل. -->
      <div v-if="state.orderNotes" class="cart-note-row" @click="openOrderNotesModal()"
        :title="tx('تعديل ملاحظة الطلب', 'Edit the order note')">
        <div class="cart-note-head">
          <span class="cart-note-ico" v-html="icon('message-square', { size: 13 })"></span>
          <span>{{ tx('ملاحظة الطلب', 'Order note') }}</span>
        </div>
        <div class="cart-note-body">{{ state.orderNotes }}</div>
      </div>
    </div>

    <!-- ── تفاصيل الطلب: رقم المنصّة · ملاحظة · حجز ────────────────────────────
         ثلاثتها صفةُ طلبٍ لا صفةُ عميل، فمكانها السلّة. وثلاثتها اختيارية ⇒ حبّةٌ
         صغيرة لكلٍّ تقول حالتها بنظرة، ولا تأخذ مساحةً إلا حين تُستعمل. -->
    <div class="cart-extras">
      <div class="ce-chips">
        <button type="button" class="ce-chip" :class="{ 'is-set': !!state.orderTag, 'is-open': tagOpen }"
          @click="toggleTag()" :title="tx('رقم الطلب على منصّة خارجية (طلبات · جاهز · كاريدج)', 'Order no. on an external platform (Talabat · Jahez · Carriage)')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
          <span class="ce-txt" :dir="state.orderTag ? 'ltr' : undefined">{{ state.orderTag || tx('رقم خارجي', 'External no.') }}</span>
        </button>

        <button type="button" class="ce-chip ce-chip-note" :class="{ 'is-set': !!state.orderNotes }"
          @click="openOrderNotesModal()" :title="state.orderNotes || tx('ملاحظة تظهر للفرع مع الطلب', 'A note shown to the branch with the order')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          <!-- عنوانٌ ثابت لا نصُّ الملاحظة: جملةٌ من سطرين تُقَصّ عند أوّل كلمتين في
               حبّةٍ عرضُها ثلث العمود. النصّ كاملاً تحت الأصناف، واللون هنا يقول إنّها مكتوبة. -->
          <span class="ce-txt">{{ tx('ملاحظة', 'Note') }}</span>
        </button>

        <button type="button" class="ce-chip" :class="{ 'is-set': state.isReservation }"
          @click="toggleReservation()" :title="tx('حجز / طلب مجدول — ينزل الفرع بموعده', 'Reservation / scheduled order — reaches the branch at its time')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span class="ce-txt">{{ state.isReservation ? resLabel : tx('حجز', 'Reservation') }}</span>
        </button>
      </div>

      <!-- محرّر الرقم الخارجي — يظهر عند الطلب لا دائماً -->
      <div v-if="tagOpen" class="ce-panel">
        <input ref="tagInput" type="text" id="order-tag" class="ce-input" dir="ltr" maxlength="64"
          :placeholder="tx('رقم الطلب على المنصّة', 'Order no. on the platform')"
          v-model="state.orderTag" @keyup.enter="tagOpen = false">
        <span class="ce-hint">{{ tx('طلبات · جاهز · كاريدج', 'Talabat · Jahez · Carriage') }}</span>
      </div>

      <!-- حقول الحجز — تظهر ما دام الحجز مفعّلاً (فالموعد إلزاميّ حينها) -->
      <div v-if="state.isReservation" class="ce-panel ce-panel-res">
        <label class="ce-lbl">{{ tx('موعد الاستلام', 'Pickup time') }}</label>
        <input type="datetime-local" v-model="state.reservationTime" class="ce-input"
          :min="earliestReservationTime()">
        <label class="ce-lbl">{{ tx('يبدأ التحضير قبل الموعد بـ (دقيقة)', 'Start preparing before the time by (minutes)') }}</label>
        <input type="number" min="0" :placeholder="tx('افتراضي الفرع', 'Branch default')" v-model="state.prepLeadMinutes" class="ce-input">
      </div>
    </div>

    <!-- خصوماتٌ يختارها الوكيل: التلقائيّ يُطبَّق وحده ولا يظهر هنا — قرارُ الشركة
         لا قرارُ الوكيل، وعرضُه كخيارٍ يوحي بأنه يُطفأ. -->
    <div v-if="manualRules.length && state.cart.length" class="cart-discounts">
      <div class="cart-disc-h">{{ tx('خصومات متاحة', 'Available discounts') }}</div>
      <div class="cart-disc-list">
        <button v-for="d in manualRules" :key="d.id" type="button"
          class="cart-disc-chip"
          :class="{ on: pickedIds.includes(Number(d.id)), na: !discountAppliesNow(d) }"
          :disabled="!discountAppliesNow(d)"
          :title="discountAppliesNow(d) ? '' : tx('لا ينطبق على أصناف السلّة الحالية', 'Does not apply to the items in the cart')"
          @click="toggleDiscount(d.id)">
          <span class="cd-t">{{ d.name }} · {{ d.type === 'percent' ? d.value + '%' : formatCurrency(d.value) }}</span>
          <span v-if="discountScopeText(d)" class="cd-c">{{ discountScopeText(d) }}</span>
        </button>
      </div>
      <!-- سببٌ مكتوب لا تلميحةَ مرور: الوكيل على الهاتف لا يقف ليحوم بالفأرة -->
      <div v-if="manualRules.some((d: any) => !discountAppliesNow(d))" class="cart-disc-na">
        {{ tx('الشريحة الباهتة لا تنطبق على أصناف السلّة الحالية', 'A dimmed chip does not apply to the items in the cart') }}
      </div>
    </div>
    <div class="cart-summary cart-summary-compact">
      <div class="summary-row">
        <span>{{ t('subtotal') }}</span>
        <span id="cart-subtotal">{{ formatCurrency(getCartSubtotal()) }}</span>
      </div>
      <!-- الخصم: سطرٌ لكلّ قاعدةٍ طُبِّقت باسمها ومبلغها — رقمٌ مجمَّع بلا أسماء
           لا يُراجَع، والوكيل يُسأل «الخصم ده منين؟» فلا يعرف. -->
      <div v-for="l in dsc.lines" :key="l.id" class="summary-row cart-disc-row">
        <span class="cart-disc-n">{{ tx('خصم', 'Discount') }} · {{ l.name }}</span>
        <span class="cart-disc-v">− {{ formatCurrency(l.amount) }}</span>
      </div>
      <div class="summary-row summary-row-delivery">
        <span class="summary-row-label">
          <span>{{ t('delivery_fee') }}</span>
        </span>
        <span id="cart-delivery-fee">{{ formatCurrency(getAppliedDeliveryFee()) }}</span>
      </div>
      <div class="summary-row total">
        <span>{{ t('total') }}</span>
        <span id="cart-total">{{ formatCurrency(getCartTotal()) }}</span>
      </div>
    </div>

    <!-- شريطٌ يقول إنك تعدّل لا تنشئ — وإلا حُفظ التعديل ظنّاً أنه طلب جديد -->
    <div v-if="state.editingOrderId" class="cart-edit-bar">
      <span>{{ tx('تعديل طلب قائم — العنوان والفرع لا يتغيّران', 'Editing an existing order — address and branch stay as they are') }}</span>
      <button type="button" class="cart-edit-cancel" @click="cancelOrderEdit()">{{ tx('إلغاء التعديل', 'Cancel edit') }}</button>
    </div>
    <div class="cart-actions">
      <button type="button" class="btn-payment-picker" :class="{ 'is-selected': paymentSelected }" id="btn-payment-picker" @click="openPaymentModal()">
        <span class="bpp-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></span>
        <span class="bpp-content">
          <span class="bpp-title" id="bpp-title">
            <template v-if="paymentSelected && selectedChannel">
              <span v-if="selectedChannel.logo" class="bpp-channel-mini-logo" v-html="selectedChannel.logo"></span>
              <span v-else class="pay-ico" :style="{ color: selectedChannel.color || 'currentColor' }" v-html="icon(selectedChannel.icon, { size: 14 })"></span>
              {{ ' ' + selectedChannel.name }}
            </template>
            <template v-else>{{ tx('طريقة الدفع', 'Payment method') }}</template>
          </span>
          <span class="bpp-sub" id="bpp-sub">
            <template v-if="paymentSelected && selectedMethod">
              <span class="pay-ico" :style="{ color: selectedMethod.color || 'currentColor' }" v-html="icon(selectedMethod.icon, { size: 14 })"></span>
              {{ ' ' + selectedMethod.name }}
            </template>
            <template v-else>{{ tx('اضغط للاختيار', 'Click to choose') }}</template>
          </span>
        </span>
        <span class="bpp-chevron">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </span>
      </button>

      <!-- وضع التعديل: الزرّ يحفظ على الطلب القائم لا ينشئ جديداً -->
      <button v-if="state.editingOrderId" class="btn-submit-order" @click="saveOrderEdit()" :disabled="!state.cart.length">
        <span>{{ tx('حفظ التعديل', 'Save changes') }}</span>
      </button>
      <button v-else class="btn-submit-order" id="btn-submit-order" @click="checkout()" :disabled="!canSubmitOrder()">
        <span>{{ state.isReservation ? tx('تأكيد الحجز', 'Confirm reservation') : t('confirm_order') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cart-discounts { padding: 8px 14px 0; }
.cart-disc-h { font-size: 11px; font-weight: 800; color: var(--text-muted, #94a3b8); margin-bottom: 6px; }
.cart-disc-list { display: flex; flex-wrap: wrap; gap: 6px; }
/* سطران: الاسم والقيمة، ثم الشرط — فالحُقّ لم يعد قرصاً بسطرٍ واحد */
.cart-disc-chip {
  display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px;
  padding: 5px 11px; border-radius: 13px; cursor: pointer; text-align: start;
  border: 1px solid var(--border, #e5e7eb); background: var(--white, #fff);
  color: var(--text-secondary, #64748b); font-family: inherit; font-size: 11.5px; font-weight: 700;
  transition: border-color .14s, background .14s, color .14s;
}
.cart-disc-chip:hover { border-color: var(--success, #16a34a); color: var(--success, #16a34a); }
/* المختار بلون الخصم نفسه في الملخّص — فيُربَط الزرّ بأثره */
.cart-disc-chip.on { border-color: var(--success, #16a34a); background: var(--success-light, #dcfce7); color: #14532d; }
/* المعطَّلة: باهتةٌ وغيرُ قابلةٍ للضغط — لا تخضرّ فتوهم بأن شيئاً طُبِّق */
.cart-disc-chip.na { opacity: 0.45; cursor: not-allowed; }
.cart-disc-chip.na:hover { border-color: var(--border, #e5e7eb); color: var(--text-secondary, #64748b); }
.cart-disc-na { margin-top: 6px; font-size: 10.5px; color: var(--text-muted, #94a3b8); }
.cd-t { font-size: 11.5px; font-weight: 700; }
/* الشرط أخفُّ من الاسم: يُقرأ عند الحاجة ولا يزاحمه */
.cd-c { font-size: 10px; font-weight: 600; opacity: 0.8; }
.cart-disc-row { color: var(--success, #16a34a); font-weight: 700; }
.cart-disc-n { font-size: 11.5px; }
.cart-disc-v { white-space: nowrap; }
/* وضع التعديل: لونٌ تحذيريّ هادئ — الوكيل لازم يعرف أنه لا ينشئ طلباً جديداً */
.cart-edit-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;
  margin: 0 12px 10px; padding: 8px 11px;
  border-radius: var(--radius, 10px);
  background: var(--warning-light, #fffbeb);
  border: 1px solid rgba(245, 158, 11, 0.45);
  font-size: 11.5px; font-weight: 700; line-height: 1.5; color: #b45309;
}
.cart-edit-cancel {
  padding: 4px 9px; border-radius: 999px;
  border: 1px solid rgba(245, 158, 11, 0.55);
  background: transparent; color: #b45309;
  font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap;
}
body.dark-mode .cart-edit-bar { background: rgba(245, 158, 11, 0.12); color: #fbbf24; }
body.dark-mode .cart-edit-cancel { color: #fbbf24; }

/* ── تفاصيل الطلب ────────────────────────────────────────────────────────────
   كانت ثلاث كتل ثابتة تلتهم ~١٩٠px من اللوحة ولو لم يُستعمل منها شيء. صارت شريطاً
   بارتفاع صفٍّ واحد (~٤٤px)، وما زاد عليه يظهر عند الاستعمال وحده. */
.cart-extras {
  padding: 9px clamp(12px, 1.2vw, 18px);
  border-top: 1px solid var(--border-light, #eef1f6);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}
.ce-chips { display: flex; gap: 6px; }

.ce-chip {
  flex: 1 1 0;
  min-width: 0;                       /* وإلا منع النصّ الطويل الحبّة من الانكماش */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 9px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 9px;
  background: var(--white, #fff);
  color: var(--text-secondary, #64748b);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color .14s, background .14s, color .14s;
}
.ce-chip svg { flex-shrink: 0; }
.ce-txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ce-chip:hover { border-color: var(--primary, #1a56db); color: var(--primary, #1a56db); }

/* مضبوطة: الحبّة تحمل قيمتها فيُعرَف الحال بلا فتحِ شيء */
.ce-chip.is-set {
  border-color: var(--primary, #1a56db);
  background: var(--primary-light, #dbeafe);
  color: var(--primary-dark, #1242b0);
}
/* الملاحظة وحدها تُلوَّن تنبيهاً — لأن الفرع يقرؤها ويجب ألّا تُنسى. والعنوان
   الأحمر القديم كان يصرخ على حقلٍ فارغ: الحمرة لِما كُتب لا لِما لم يُكتب. */
.ce-chip-note.is-set {
  border-color: var(--warning, #f59e0b);
  background: var(--warning-light, #fef3c7);
  color: #b45309;
}
.ce-chip.is-open { border-color: var(--primary, #1a56db); color: var(--primary, #1a56db); }

.ce-panel { display: flex; flex-direction: column; gap: 5px; }
.ce-lbl { font-size: 11px; font-weight: 600; color: var(--text-muted, #94a3b8); }
.ce-hint { font-size: 10.5px; color: var(--text-muted, #94a3b8); font-weight: 600; }
.ce-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  background: var(--white, #fff);
  color: var(--text-primary, #0f172a);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  outline: none;
  transition: border-color .14s, box-shadow .14s;
}
.ce-input:focus { border-color: var(--primary, #1a56db); box-shadow: 0 0 0 3px rgba(26, 86, 219, .1); }
.ce-input::placeholder { color: var(--text-muted, #94a3b8); font-weight: 500; }

body.dark-mode .ce-chip,
body.dark-mode .ce-input { background: var(--bg-card, #1e293b); }
/* ملاحظة الطلب تحت الأصناف: بلونِ الحبّة نفسه فيُعرَف أنّهما شيءٌ واحد، وبعرضِ
   العمود كاملاً فتُقرأ الجملة كما كُتبت — أسطرُها كما أدخلها الوكيل. */
.cart-note-row {
  margin-top: 10px;
  padding: 9px 11px;
  border: 1px solid var(--warning, #f59e0b);
  border-radius: 10px;
  background: var(--warning-light, #fef3c7);
  cursor: pointer;
}
.cart-note-head {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 800; color: #b45309; margin-bottom: 3px;
}
.cart-note-head svg { flex-shrink: 0; }
.cart-note-body {
  font-size: 12.5px; font-weight: 600; color: #7c2d12; line-height: 1.55;
  white-space: pre-wrap;      /* الأسطر كما كتبها الوكيل لا سطرٌ واحد ملتحم */
  overflow-wrap: anywhere;    /* كلمةٌ طويلة بلا مسافات لا تدفع عرض العمود */
}
body.dark-mode .cart-note-row { background: rgba(245, 158, 11, .12); }
body.dark-mode .cart-note-body { color: #fcd34d; }

/* «طلب جديد» نصٌّ لا رقم — أخفُّ وزناً وأصغرُ حجماً فلا يُقرأ رقمَ فاتورة */
.cart-order-no.is-draft { font-size: 14px; font-weight: 700; opacity: .75; }
</style>
