<script setup lang="ts">
/**
 * إعدادات يوم العمل — سلوك القفل وفي اليوم أوردراتٌ لم تنزل الفرع بعد.
 *
 * الأوردر الواقف (لم يسحبه الفرع لاختلاف اليوم أو انقطاعه) يضيع بقفل يومه، فالمنع هو
 * الافتراضي. لكن بعض التشغيل يريد أن يمضي اليوم ويُرحَّل الواقف — وهو ما يفعله الفرع
 * بأوردراته غير المدفوعة. الخيار للشركة، لا حكمٌ نفرضه.
 */
import { onMounted, ref } from 'vue'
import { contactDaySettings, contactSetDaySettings } from '../../api'
import { tx } from '../lang'
import { showToast } from '../store'
import { icon } from '../icons'

const value = ref<'block' | 'carry'>('block')
const loading = ref(true)
const saving = ref(false)
const err = ref('')

onMounted(async () => {
  try {
    const s = await contactDaySettings()
    value.value = s?.closeWithOpenOrders === 'carry' ? 'carry' : 'block'
  } catch (e: any) {
    err.value = e?.response?.data?.message || tx('تعذّر تحميل الإعدادات', 'Could not load the settings')
  } finally { loading.value = false }
})

async function pick(v: 'block' | 'carry') {
  if (v === value.value || saving.value) return
  const prev = value.value
  value.value = v; saving.value = true; err.value = ''
  try {
    await contactSetDaySettings(v)
    showToast(tx('تم حفظ الإعداد', 'Setting saved'), 'success')
  } catch (e: any) {
    value.value = prev   // الخادم رفض ⇒ الشاشة تعود لما هو محفوظ فعلاً
    err.value = e?.response?.data?.message || tx('تعذّر الحفظ', 'Could not save')
  } finally { saving.value = false }
}

const OPTS = [
  {
    v: 'block' as const, ico: 'ban',
    ar: 'امنع القفل', en: 'Block closing',
    arSub: 'لا يُقفَل اليوم وفيه أوردر لم ينزل الفرع — الأوردر الواقف يضيع بقفل يومه.',
    enSub: 'The day will not close while an order has not reached the branch — a waiting order is lost with its day.',
  },
  {
    v: 'carry' as const, ico: 'arrow-right',
    ar: 'اقفل ورحّل', en: 'Close and carry over',
    arSub: 'يُقفَل اليوم وتنتقل الأوردرات الواقفة لليوم الجديد — نفس ما يفعله الفرع بأوردراته غير المدفوعة.',
    enSub: 'The day closes and waiting orders move to the new day — the same as the branch does with its unpaid orders.',
  },
]
</script>

<template>
  <div class="tab-panel active">
    <div class="ds-head">
      <h2 class="ds-title">{{ tx('إعدادات يوم العمل', 'Business day settings') }}</h2>
      <p class="ds-lead">{{ tx('عند إنهاء اليوم وفيه أوردرات لم تنزل الفرع بعد:',
                               'When ending the day while some orders have not reached the branch yet:') }}</p>
    </div>

    <p v-if="loading" class="ds-muted">{{ tx('جارٍ التحميل…', 'Loading…') }}</p>

    <div v-else class="ds-opts">
      <button v-for="o in OPTS" :key="o.v" type="button" class="ds-opt"
        :class="{ 'is-on': value === o.v }" :disabled="saving" @click="pick(o.v)">
        <span class="ds-ico" v-html="icon(o.ico, { size: 18 })"></span>
        <span class="ds-txt">
          <span class="ds-name">{{ tx(o.ar, o.en) }}</span>
          <span class="ds-sub">{{ tx(o.arSub, o.enSub) }}</span>
        </span>
        <span class="ds-mark" v-html="value === o.v ? icon('check', { size: 15 }) : ''"></span>
      </button>
    </div>

    <div v-if="err" class="ds-err">
      <span class="inline-ico" v-html="icon('x-circle', { size: 14 })"></span><span>{{ err }}</span>
    </div>
  </div>
</template>

<style scoped>
.ds-head { margin-bottom: 18px; }
.ds-title { margin: 0 0 6px; font-size: 19px; font-weight: 800; color: var(--text-primary, #1f2937); }
.ds-lead { margin: 0; font-size: 13px; color: #4b5563; line-height: 1.7; }
.ds-muted { font-size: 13px; color: #6b7280; }

.ds-opts { display: flex; flex-direction: column; gap: 12px; max-width: 720px; }
.ds-opt {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 16px 18px; border-radius: 14px;
  border: 1.5px solid var(--border, #e5e7eb);
  background: var(--white, #fff);
  cursor: pointer; text-align: start;
  transition: border-color .15s ease, background .15s ease;
}
.ds-opt:hover:not(:disabled) { border-color: var(--primary, #1a56db); }
.ds-opt:disabled { opacity: .65; cursor: default; }
/* المختار يُعرَف بالنظرة لا بقراءة الاثنين ومقارنتهما */
.ds-opt.is-on { border-color: var(--primary, #1a56db); background: var(--primary-light, #dbeafe); }

.ds-ico {
  flex: 0 0 auto; width: 38px; height: 38px;
  display: grid; place-items: center; border-radius: 11px;
  background: var(--bg, #f0f2f5); color: #4b5563;
}
.ds-opt.is-on .ds-ico { background: var(--primary, #1a56db); color: #fff; }
.ds-ico svg { display: block; }

.ds-txt { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ds-name { font-size: 14.5px; font-weight: 800; color: var(--text-primary, #1f2937); }
.ds-sub { font-size: 12.5px; font-weight: 500; color: #4b5563; line-height: 1.75; overflow-wrap: anywhere; }

.ds-mark { flex: 0 0 auto; margin-inline-start: auto; color: var(--primary, #1a56db); }
.ds-mark svg { display: block; }

.ds-err {
  display: flex; align-items: center; gap: 8px; max-width: 720px;
  margin-top: 14px; padding: 9px 11px; border-radius: 9px;
  background: #fee2e2; color: #b91c1c; font-size: 12px; font-weight: 700;
}

:global(body.dark-mode) .ds-opt { background: rgba(255, 255, 255, .04); }
:global(body.dark-mode) .ds-name { color: #e2e8f0; }
</style>
