<script setup lang="ts">
import { computed } from 'vue'
import { tx, nameOf } from '../lang'
import { state, setPaymentMethod, resetPaymentSelection, confirmPaymentSelection, closePaymentModal, getPaymentLabel, companyPaymentMethods } from '../store'
import { icon } from '../icons'

// طرق الدفع **من الشركة**: كانت ثلاثاً مكتوبةً في `data.ts` (كاش/كي‑نت/رابط)، فشركةٌ
// تحصّل بـ«مدى» أو «STC Pay» لا تجدهما ويُسجَّل طلبها بطريقةٍ لا وجود لها عندها.
//
// **والمصدر أُزيل**: «الهاتف/طلبات/جاهز/كاري/ديليفرو» كانت قائمةً ثابتةً في الكود،
// وهي نفسُها معنى «الطلب الخارجي» الذي تعرّفه الشركة بمنصّاتها من لوحة التحكّم.
// سؤالان عن شيءٍ واحد: الوكيل يختار المنصّة مرّةً في نوع الطلب ثم يُسأل عنها ثانيةً
// هنا بأسماءٍ قد لا تطابقها. والقائمةُ الثابتة لا تعرف منصّةَ شركةٍ أضافتها اليوم.
// (`state.paymentChannel` يبقى في المخزن: طلباتٌ قديمة سجّلته وتُقرأ به.)
const methods = computed<any[]>(() => companyPaymentMethods())
const canConfirm = computed(() => !!state.paymentMethod)
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
        <!-- طريقة الدفع وحدها: المصدر يُعرَّف بمنصّات الشركة في «الطلب الخارجي» -->
        <div class="pm-step pm-step-methods">
          <div class="pm-step-label">
            {{ tx('اختر طريقة الدفع', 'Choose the payment method') }}
            <span class="pm-req">{{ tx('مطلوب', 'Required') }}</span>
          </div>
          <div class="pm-methods">
            <p v-if="!methods.length" class="pm-empty">
              {{ tx('لا توجد طرق دفع مفعّلة لهذه الشركة — عرّفها من لوحة التحكم U‑Serve.', 'No active payment methods for this company — define them in the U-Serve dashboard.') }}
            </p>
            <button v-for="m in methods" :key="m.id" type="button" class="pm-method" :class="{ active: String(state.paymentMethod) === String(m.id) }" @click="setPaymentMethod(m.id)">
              <span class="pm-method-icon" :style="{ color: String(state.paymentMethod) === String(m.id) ? '#fff' : (m.color || (m.isCash ? '#16a34a' : '#2563eb')) }" v-html="icon(m.icon || (m.isCash ? 'banknote' : 'credit-card'), { size: 18 })"></span>
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
/* الإلزام يُقرأ قبل الضغط لا بعد رفضٍ مفاجئ */
.pm-req {
  margin-inline-start: auto;
  padding: 2px 8px; border-radius: 999px;
  font-size: 10.5px; font-weight: 800;
  background: var(--danger-light, #fee2e2); color: var(--danger, #dc2626);
}
.pm-step-label { display: flex; align-items: center; gap: 8px; }

.pm-empty {
  margin: 0; padding: 12px 14px;
  border: 1px dashed var(--border, #e5e7eb); border-radius: 10px;
  font-size: 12.5px; font-weight: 600; line-height: 1.7;
  color: var(--text-muted, #94a3b8);
}
</style>
