<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { state, clearCart, updateCartItemQty, openItemModal, openOrderNotesModal, openPaymentModal, checkout, getResolvedOrderBranchId, getCartSubtotal, getAppliedDeliveryFee, getCartTotal, canSubmitOrder, toggleReservation, earliestReservationTime, openCartItemNote } from '../store'
import { PAYMENT_CHANNELS, PAYMENT_METHODS } from '../data'
import { formatCurrency } from '../utils'
import { tx, nameOf } from '../lang'
import { t } from '../lang'
import { icon } from '../icons'

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
        <span class="cart-header-label">{{ t('order_number_label') }}</span>
        <span class="cart-order-no" id="cart-order-no">#1027935</span>
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
          </div>
          <div class="qty-control">
            <button class="qty-btn" @click="updateCartItemQty(item.cartItemId, -1)">-</button>
            <div class="qty-value">{{ item.quantity }}</div>
            <button class="qty-btn" @click="updateCartItemQty(item.cartItemId, 1)">+</button>
          </div>
        </div>
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
          <span class="ce-txt">{{ state.orderNotes || tx('ملاحظة', 'Note') }}</span>
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

    <div class="cart-summary cart-summary-compact">
      <div class="summary-row">
        <span>{{ t('subtotal') }}</span>
        <span id="cart-subtotal">{{ formatCurrency(getCartSubtotal()) }}</span>
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

      <button class="btn-submit-order" id="btn-submit-order" @click="checkout()" :disabled="!canSubmitOrder()">
        <span>{{ state.isReservation ? tx('تأكيد الحجز', 'Confirm reservation') : t('confirm_order') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
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

:global(body.dark-mode) .ce-chip,
:global(body.dark-mode) .ce-input { background: var(--bg-card, #1e293b); }
</style>
