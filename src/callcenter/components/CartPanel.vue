<script setup lang="ts">
import { computed } from 'vue'
import { state, clearCart, updateCartItemQty, openItemModal, openOrderNotesModal, openDeliveryFeeModal, openPaymentModal, checkout, getResolvedOrderBranchId, getCartSubtotal, getAppliedDeliveryFee, getCartTotal, canSubmitOrder, orderNotesPreview } from '../store'
import { PAYMENT_CHANNELS, PAYMENT_METHODS } from '../data'
import { formatCurrency } from '../utils'
import { t } from '../lang'

const disabledItems = computed<any[]>(() => {
  const id = getResolvedOrderBranchId()
  return id ? (state.disabledBranchItems[id] || []) : []
})

function itemDetails(item: any): string {
  let s = ''
  if (item.size) s += `حجم ${item.size}`
  if (item.extras && item.extras.length > 0) {
    if (s) s += ' + '
    s += item.extras.join('، ')
  }
  if (item.note) {
    if (s) s += '<br>'
    s += `<span style="color:var(--danger); font-size:11px;">ملاحظة: ${item.note}</span>`
  }
  return s
}

// زر الدفع — الاختيار الحالي (نقلاً عن updatePaymentButton)
const selectedChannel = computed(() => PAYMENT_CHANNELS.find((c: any) => c.id === state.paymentChannel) || null)
const selectedMethod = computed(() => PAYMENT_METHODS.find((m: any) => m.id === state.paymentMethod) || null)
const paymentSelected = computed(() => !!(state.paymentChannel && state.paymentMethod))
</script>

<template>
  <div id="cart-panel" class="cart-panel">
    <div class="cart-header">
      <div>
        <span class="cart-header-label">{{ t('order_number_label') }}</span>
        <span class="cart-order-no" id="cart-order-no">#1027935</span>
      </div>
      <button class="cart-delete-btn" @click="clearCart()" title="مسح السلة"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg></button>
    </div>

    <div id="cart-items" class="cart-items">
      <div v-if="state.cart.length === 0" class="cart-empty">
        <div class="cart-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>
        <p>{{ t('cart_empty') }}</p>
        <p style="font-size:12px; margin-top:4px;">{{ t('choose_items') }}</p>
      </div>
      <div v-else v-for="item in state.cart" :key="item.cartItemId" class="cart-item" :class="{ 'cart-item-disabled': disabledItems.includes(item.itemId) }">
        <div class="cart-item-top">
          <div class="cart-item-name">{{ item.name }}</div>
          <div class="cart-item-price">{{ formatCurrency(item.price * item.quantity) }}</div>
        </div>
        <div v-if="itemDetails(item)" class="cart-item-details" v-html="itemDetails(item)"></div>
        <div class="cart-item-bottom">
          <button class="cart-item-edit" @click="openItemModal(item.itemId, item.cartItemId)">تعديل</button>
          <div class="qty-control">
            <button class="qty-btn" @click="updateCartItemQty(item.cartItemId, -1)">-</button>
            <div class="qty-value">{{ item.quantity }}</div>
            <button class="qty-btn" @click="updateCartItemQty(item.cartItemId, 1)">+</button>
          </div>
        </div>
      </div>
    </div>

    <div class="cart-notes">
      <label class="cart-notes-label">{{ t('important_order_notes') }}</label>
      <button type="button" class="cart-notes-btn" @click="openOrderNotesModal()"><span>{{ t('write_note') }}</span></button>
      <div class="cart-notes-preview" id="order-notes-preview">{{ orderNotesPreview() }}</div>
    </div>

    <!-- حجز (طلب مجدول) — ينزل الفرع فوراً ويظهر في قائمة الحجوزات بموعده -->
    <div class="cart-reservation">
      <label class="cart-res-toggle">
        <input type="checkbox" v-model="state.isReservation">
        <span>حجز / طلب مجدول</span>
      </label>
      <div v-if="state.isReservation" class="cart-res-fields">
        <label class="cart-res-lbl">موعد الاستلام</label>
        <input type="datetime-local" v-model="state.reservationTime" class="cart-res-input">
        <label class="cart-res-lbl">يبدأ التحضير قبل الموعد بـ (دقيقة)</label>
        <input type="number" min="0" placeholder="افتراضي الفرع" v-model="state.prepLeadMinutes" class="cart-res-input">
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
          <button v-if="state.orderType === 'delivery'" type="button" class="btn-edit-fee" id="btn-edit-delivery-fee" @click="openDeliveryFeeModal()" title="تعديل رسوم التوصيل لهذا الطلب">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <span v-if="state.deliveryFeeOverride !== null && state.deliveryFeeOverride !== undefined" class="fee-override-tag" id="fee-override-tag" title="تم تعديل الرسوم يدوياً لهذا الطلب">يدوي</span>
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
              <i v-else :class="selectedChannel.icon" :style="{ color: selectedChannel.color || 'currentColor' }"></i>
              {{ ' ' + selectedChannel.name }}
            </template>
            <template v-else>طريقة الدفع</template>
          </span>
          <span class="bpp-sub" id="bpp-sub">
            <template v-if="paymentSelected && selectedMethod">
              <i :class="selectedMethod.icon" :style="{ color: selectedMethod.color || 'currentColor' }"></i>
              {{ ' ' + selectedMethod.name }}
            </template>
            <template v-else>اضغط للاختيار</template>
          </span>
        </span>
        <span class="bpp-chevron">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </span>
      </button>

      <button class="btn-submit-order" id="btn-submit-order" @click="checkout()" :disabled="!canSubmitOrder()">
        <span>{{ state.isReservation ? 'تأكيد الحجز' : t('confirm_order') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cart-reservation { padding: 10px 12px; border-top: 1px solid var(--border, #e5e7eb); display: flex; flex-direction: column; gap: 8px; }
.cart-res-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
.cart-res-toggle input { width: 16px; height: 16px; cursor: pointer; }
.cart-res-fields { display: flex; flex-direction: column; gap: 4px; }
.cart-res-lbl { font-size: 11px; font-weight: 600; opacity: 0.7; }
.cart-res-input { width: 100%; padding: 6px 8px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; font-size: 12px; font-weight: 600; }
</style>
