<script setup lang="ts">
import { computed } from 'vue'
import { state, setPaymentChannel, setPaymentMethod, resetPaymentSelection, confirmPaymentSelection, closePaymentModal, getPaymentLabel } from '../store'
import { PAYMENT_CHANNELS, PAYMENT_METHODS } from '../data'
import { icon } from '../icons'

const channel = computed(() => PAYMENT_CHANNELS.find((c: any) => c.id === state.paymentChannel) || null)
const methods = computed<any[]>(() => (channel.value?.methods || []).map((mid: string) => PAYMENT_METHODS.find((x: any) => x.id === mid)).filter(Boolean) as any[])
const canConfirm = computed(() => !!(state.paymentChannel && state.paymentMethod))
const summaryText = computed(() => canConfirm.value ? getPaymentLabel(state.paymentChannel, state.paymentMethod) : '')
</script>

<template>
  <div v-if="state.paymentModalOpen" class="modal-overlay" @click.self="closePaymentModal()">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">طريقة الدفع</h3>
        <button class="modal-close" @click="closePaymentModal()">×</button>
      </div>
      <div class="modal-body" style="padding:18px 22px;">
        <!-- 1) المصدر -->
        <div class="pm-step">
          <div class="pm-step-label"><span class="pm-step-num">1</span> اختر المصدر</div>
          <div class="pm-channels" id="pm-channels">
            <button v-for="ch in PAYMENT_CHANNELS" :key="ch.id" type="button" class="pm-channel" :class="{ active: state.paymentChannel === ch.id }" @click="setPaymentChannel(ch.id)">
              <span v-if="ch.logo" class="pm-channel-logo" v-html="ch.logo"></span>
              <span v-else class="pm-channel-icon"><i :class="ch.icon" :style="{ color: state.paymentChannel === ch.id ? '#fff' : (ch.color || 'var(--primary)') }"></i></span>
              <span class="pm-channel-name">{{ ch.name }}</span>
            </button>
          </div>
        </div>
        <!-- 2) طريقة الدفع -->
        <div class="pm-step pm-step-methods" v-show="channel">
          <div class="pm-step-label"><span class="pm-step-num">2</span> اختر طريقة الدفع</div>
          <div class="pm-methods">
            <button v-for="m in methods" :key="m.id" type="button" class="pm-method" :class="{ active: state.paymentMethod === m.id }" @click="setPaymentMethod(m.id)">
              <span class="pm-method-icon"><i :class="m.icon" :style="{ color: state.paymentMethod === m.id ? '#fff' : (m.color || '#047857') }"></i></span>
              <span class="pm-method-name">{{ m.name }}</span>
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
        <button class="btn btn-secondary" @click="resetPaymentSelection()">إعادة تعيين</button>
        <button class="btn btn-primary" :disabled="!canConfirm" @click="confirmPaymentSelection()">تأكيد</button>
      </div>
    </div>
  </div>
</template>
