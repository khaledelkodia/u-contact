<script setup lang="ts">
/**
 * صندوق التأكيد — بديل `confirm()` المتصفّح.
 *
 * ذاك يكتب فوقه اسم النطاق («u-contact.vercel.app says»)، ولا يتبع لغة التطبيق ولا
 * اتجاهه ولا تصميمه، ويُجمّد الصفحة. وهذا مودالٌ كبقيّة المودالات: أزراره بلغة
 * الواجهة، والخطر أحمرُ صريح، والمفاتيح تعمل (Esc = إلغاء · Enter = تأكيد).
 */
import { watch, nextTick, ref } from 'vue'
import { state, answerConfirm } from '../store'
import { icon } from '../icons'

const okBtn = ref<HTMLButtonElement | null>(null)

// التركيز على «إلغاء» لا على «تأكيد»: الزرّ الخطر لا يُضغط بمسافةٍ سهواً.
const cancelBtn = ref<HTMLButtonElement | null>(null)
watch(() => state.confirmBox.open, (open) => {
  if (open) void nextTick(() => cancelBtn.value?.focus())
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); answerConfirm(false) }
  else if (e.key === 'Enter') { e.preventDefault(); answerConfirm(true) }
}
</script>

<template>
  <div v-if="state.confirmBox.open" class="modal-overlay cb-overlay" @click.self="answerConfirm(false)" @keydown="onKey" tabindex="-1">
    <div class="modal-content cb-box" :class="`cb-${state.confirmBox.kind}`" @click.stop @keydown="onKey">
      <div class="cb-body">
        <div class="cb-ico" v-html="icon(state.confirmBox.kind === 'danger' ? 'alert-triangle' : 'alert-circle', { size: 22 })"></div>
        <div class="cb-text">
          <p class="cb-title">{{ state.confirmBox.title }}</p>
          <p v-if="state.confirmBox.body" class="cb-sub">{{ state.confirmBox.body }}</p>
        </div>
      </div>
      <div class="cb-actions">
        <button ref="cancelBtn" type="button" class="btn btn-secondary cb-btn" @click="answerConfirm(false)">
          {{ state.confirmBox.cancelLabel }}
        </button>
        <button ref="okBtn" type="button" class="btn cb-btn cb-ok" @click="answerConfirm(true)">
          {{ state.confirmBox.okLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* فوق كل المودالات: قد يُسأل عن تأكيدٍ ومودالٌ آخر مفتوح */
.cb-overlay { z-index: 9000; }

.cb-box {
  max-width: 420px;
  padding: 22px 22px 18px;
  border-start-start-radius: 16px;
  border-start-end-radius: 16px;
  border-end-start-radius: 16px;
  border-end-end-radius: 16px;
}

.cb-body { display: flex; gap: 14px; align-items: flex-start; }

.cb-ico {
  flex: 0 0 auto;
  width: 42px; height: 42px;
  display: grid; place-items: center;
  border-radius: 12px;
}
.cb-ico svg { display: block; }
.cb-danger  .cb-ico { background: #fee2e2; color: #b91c1c; }
.cb-warning .cb-ico { background: #fef3c7; color: #b45309; }

.cb-text { min-width: 0; }
.cb-title {
  margin: 2px 0 0;
  font-size: 15.5px; font-weight: 800; line-height: 1.55;
  color: var(--text-primary, #1f2937);
  overflow-wrap: anywhere;
}
.cb-sub {
  margin: 6px 0 0;
  font-size: 13px; font-weight: 500; line-height: 1.7;
  color: var(--text-secondary, #6b7280);
  overflow-wrap: anywhere;
}

.cb-actions {
  display: flex; gap: 10px; justify-content: flex-end;
  margin-top: 20px;
}
.cb-btn { min-width: 104px; padding: 10px 18px; font-weight: 700; }

/* زرّ الفعل بلون الخطر — يُقرأ قبل الضغط لا بعده */
.cb-danger  .cb-ok { background: #dc2626; color: #fff; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.28); }
.cb-danger  .cb-ok:hover { background: #b91c1c; }
.cb-warning .cb-ok { background: #d97706; color: #fff; box-shadow: 0 2px 6px rgba(217, 119, 6, 0.28); }
.cb-warning .cb-ok:hover { background: #b45309; }

:global(body.dark-mode) .cb-danger  .cb-ico { background: rgba(220, 38, 38, 0.18); color: #fca5a5; }
:global(body.dark-mode) .cb-warning .cb-ico { background: rgba(217, 119, 6, 0.18); color: #fcd34d; }
</style>
