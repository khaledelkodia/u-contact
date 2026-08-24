<script setup lang="ts">
import { computed } from 'vue'
import { tx, nameOf } from '../lang'
import { state, setPaymentChannel, setPaymentMethod, resetPaymentSelection, confirmPaymentSelection, closePaymentModal, getPaymentLabel, companyPaymentMethods } from '../store'
import { PAYMENT_CHANNELS } from '../data'
import { icon } from '../icons'

const channel = computed(() => PAYMENT_CHANNELS.find((c: any) => c.id === state.paymentChannel) || null)
// طرق الدفع **من الشركة**: كانت ثلاثاً مكتوبةً في `data.ts` (كاش/كي‑نت/لينك)، فشركةٌ
// تحصّل بـ«مدى» أو «STC Pay» لا تجدهما ويُسجَّل طلبها بطريقةٍ لا وجود لها عندها.
// المصدر (الفون/طلبات/كاري…) يبقى من `data.ts` — هو صفةُ قناةٍ لا إعدادَ شركة.
const methods = computed<any[]>(() => companyPaymentMethods())
const canConfirm = computed(() => !!(state.paymentChannel && state.paymentMethod))
const summaryText = computed(() => canConfirm.value ? getPaymentLabel(state.paymentChannel, state.paymentMethod) : '')
</script>

<template>
  <div v-if="state.paymentModalOpen" class="modal-overlay" @click.self="closePaymentModal()">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ tx('طريقة الدفع', 'Payment method') }}</h3>
        <button class="modal-close" @click="closePaymentModal()">×</button>
      </div>
      <div class="modal-body" style="padding:18px 22px;">
        <!-- 1) المصدر -->
        <div class="pm-step">
          <div class="pm-step-label"><span class="pm-step-num">1</span> {{ tx('اختر المصدر', 'Choose the source') }}</div>
          <div class="pm-channels" id="pm-channels">
            <button v-for="ch in PAYMENT_CHANNELS" :key="ch.id" type="button" class="pm-channel" :class="{ active: state.paymentChannel === ch.id }" @click="setPaymentChannel(ch.id)">
              <span v-if="ch.logo" class="pm-channel-logo" v-html="ch.logo"></span>
              <span v-else class="pm-channel-icon"><i :class="ch.icon" :style="{ color: state.paymentChannel === ch.id ? '#fff' : (ch.color || 'var(--primary)') }"></i></span>
              <span class="pm-channel-name">{{ ch.name }}</span>
            </button>
          </div>
        </div>
        <!-- 2) طريقة الدفع -->
        <div class="pm-step pm-step-methods">
          <div class="pm-step-label"><span class="pm-step-num">2</span> {{ tx('اختر طريقة الدفع', 'Choose the payment method') }}</div>
          <div class="pm-methods">
            <p v-if="!methods.length" class="pm-empty">
              {{ tx('لا توجد طرق دفع مفعّلة لهذه الشركة — عرّفها من داشبورد U‑Serve.', 'No active payment methods for this company — define them in the U-Serve dashboard.') }}
            </p>
            <button v-for="m in methods" :key="m.id" type="button" class="pm-method" :class="{ active: String(state.paymentMethod) === String(m.id) }" @click="setPaymentMethod(m.id)">
              <span class="pm-method-icon"><i :class="m.icon || (m.isCash ? 'fa-solid fa-money-bill-wave' : 'fa-solid fa-credit-card')" :style="{ color: String(state.paymentMethod) === String(m.id) ? '#fff' : (m.color || (m.isCash ? '#16a34a' : '#2563eb')) }"></i></span>
              <span class="pm-method-name">{{ nameOf(m) }}</span>
            </button>
          </div>
        </div>
        <!-- الملخص -->
        <div class="pm-summary" :class="{ hidden: !canConfirm }">
          <span class="pm-summary-icon" v-html="icon('check', { size: 14 })"></span>
          <span class="pm-summary-text">{{ summaryText }}</span>
        </div>
      </div>
      <div class="modal-footer" style="justify-content: space-between;">
        <button class="btn btn-secondary" @click="resetPaymentSelection()">{{ tx('إعادة تعيين', 'Reset') }}</button>
        <button class="btn btn-primary" :disabled="!canConfirm" @click="confirmPaymentSelection()">{{ tx('تأكيد', 'Confirm') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pm-empty {
  margin: 0; padding: 12px 14px;
  border: 1px dashed var(--border, #e5e7eb); border-radius: 10px;
  font-size: 12.5px; font-weight: 600; line-height: 1.7;
  color: var(--text-muted, #94a3b8);
}
</style>
