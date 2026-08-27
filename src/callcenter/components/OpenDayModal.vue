<script setup lang="ts">
/**
 * فتح يوم عمل مركز الاتصال — التاريخ قرارُ الوكيل، وأمامه أيام فروعه.
 *
 * كان الزرّ يفتح فوراً بتاريخٍ يشتقّه الخادم من أيام الفروع؛ فإن كان قد فُتح وأُقفل
 * جاء الرفض بلا مخرج إلا أن يُقفَل يومُ فرعٍ ليتحرّك المشتقّ.
 *
 * وشرطُ نزول الطلب لم يتغيّر: الفرع يسحب طلبات **يومه** وحدها. فعرضُ أيام الفروع
 * هنا ليس زينةً — هو ما يجعل الاختيار مبنيّاً على علم.
 */
import { computed } from 'vue'
import { state, closeDayModal, confirmOpenDay, suggestedDay } from '../store'
import { tx } from '../lang'
import { formatBusinessDate } from '../utils'
import { icon } from '../icons'

const isFix = computed(() => state.dayModal.mode === 'fix')
const suggested = computed(() => suggestedDay())
const branches = computed<any[]>(() => state.dayModal.branches || [])
/** فروعٌ يومها = التاريخ المختار ⇒ طلباتها ستنزل. */
const matching = computed(() => branches.value.filter((b) => b.businessDate === state.dayModal.date).length)
</script>

<template>
  <div v-if="state.dayModal.open" class="modal-overlay" @click.self="closeDayModal()">
    <div class="modal-content od-box" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ isFix ? tx('إصلاح يوم', 'Fix a day') : tx('فتح يوم العمل', 'Open the business day') }}</h3>
        <button class="modal-close" @click="closeDayModal()">×</button>
      </div>

      <div class="modal-body">
        <!-- يومُ الإصلاح ليس يومَ تشغيل: يُفتح لمراجعة تاريخٍ بعينه ولا تُقبَل عليه
             طلبات. اللافتة تسبق كل شيء فلا يُخلَط الأمران. -->
        <div v-if="isFix" class="od-fix">
          <span class="inline-ico" v-html="icon('alert-circle', { size: 14 })"></span>
          <span>{{ tx('يُفتح هذا اليوم للمراجعة والتصحيح فقط — لا يمكن ضرب طلبات عليه.', 'This day opens for review and corrections only — no orders can be placed on it.') }}</span>
        </div>
        <label class="od-lbl">{{ tx('تاريخ يوم العمل', 'Business day date') }}</label>
        <input type="date" v-model="state.dayModal.date" class="ce-input od-date">

        <!-- الاقتراح بنقرة: أكثر أيام الفروع شيوعاً -->
        <button v-if="suggested && suggested !== state.dayModal.date" type="button" class="od-suggest"
          @click="state.dayModal.date = suggested!">
          <span class="inline-ico" v-html="icon('info', { size: 13 })"></span>
          {{ tx('أغلب فروعك على', 'Most of your branches are on') }} {{ formatBusinessDate(suggested) }}
          — {{ tx('اختره', 'use it') }}
        </button>

        <!-- ── أيام الفروع ────────────────────────────────────────────────────
             الطلب لا ينزل إلا لفرعٍ يومُه = هذا التاريخ. -->
        <div v-if="!isFix" class="od-head">
          <span class="od-lbl">{{ tx('فروعك الآن', 'Your branches now') }}</span>
          <span v-if="!state.dayModal.loading && branches.length" class="od-count"
            :class="{ 'is-zero': matching === 0 }">
            {{ matching }} / {{ branches.length }} {{ tx('سيستقبل', 'will receive') }}
          </span>
        </div>

        <p v-if="!isFix && state.dayModal.loading" class="od-muted">{{ tx('جارٍ التحميل…', 'Loading…') }}</p>
        <p v-else-if="!isFix && !branches.length" class="od-muted">{{ tx('لا توجد فروع مفعّلة لمركز الاتصال في هذا النطاق.', 'No call-center-enabled branches in this scope.') }}</p>
        <div v-else-if="!isFix" class="od-list">
          <div v-for="b in branches" :key="b.id" class="od-row"
            :class="{ 'is-match': b.businessDate && b.businessDate === state.dayModal.date }">
            <span class="od-branch">{{ b.name }}</span>
            <span v-if="!b.dayKnown" class="od-day od-unknown">{{ tx('يومه غير معروف', 'day unknown') }}</span>
            <span v-else-if="!b.businessDate" class="od-day od-unknown">{{ tx('بلا يوم مفتوح', 'no open day') }}</span>
            <span v-else class="od-day">{{ formatBusinessDate(b.businessDate) }}</span>
          </div>
        </div>

        <!-- تحذيرٌ صريح: اختيارٌ لا يطابق أحداً يعني طلباتٍ تقف ولا تنزل -->
        <div v-if="!isFix && !state.dayModal.loading && branches.length && matching === 0" class="od-warn">
          <span class="inline-ico" v-html="icon('alert-triangle', { size: 14 })"></span>
          <span>{{ tx('مفيش فرع على التاريخ ده — الطلبات هتقف ولا تنزل حتى يتطابق اليومان.',
                      'No branch is on this date — orders will wait and will not go through until the two days match.') }}</span>
        </div>

        <div v-if="state.dayModal.error" class="od-err">
          <span class="inline-ico" v-html="icon('x-circle', { size: 14 })"></span>
          <span>{{ state.dayModal.error }}</span>
        </div>
      </div>

      <div class="modal-footer" style="justify-content:flex-end; gap:8px;">
        <button class="btn btn-secondary" @click="closeDayModal()">{{ tx('إلغاء', 'Cancel') }}</button>
        <button class="btn btn-primary" :disabled="state.dayLoading" @click="confirmOpenDay()">
          {{ state.dayLoading ? tx('جارٍ الفتح…', 'Opening…') : (isFix ? tx('افتح للإصلاح', 'Open for fixing') : tx('افتح اليوم', 'Open the day')) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.od-box { max-width: 480px; }
.od-lbl { display: block; font-size: 12px; font-weight: 700; color: #4b5563; margin-bottom: 6px; }
.od-date { width: 100%; }

.od-suggest {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 8px; padding: 6px 10px;
  border: 1px dashed var(--primary, #1a56db); border-radius: 8px;
  background: transparent; color: var(--primary, #1a56db);
  font-size: 12px; font-weight: 700; cursor: pointer;
}
.od-suggest:hover { background: var(--primary-light, #dbeafe); }

.od-head { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; }
.od-count {
  padding: 2px 9px; border-radius: 999px;
  background: #dcfce7; color: #166534;
  font-size: 11px; font-weight: 800;
}
.od-count.is-zero { background: #fee2e2; color: #b91c1c; }

.od-list { border: 1px solid var(--border, #e5e7eb); border-radius: 10px; overflow: hidden; }
.od-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 12px; font-size: 12.5px;
  border-bottom: 1px solid var(--border-light, #f3f4f6);
}
.od-row:last-child { border-bottom: none; }
/* الفرع الذي سيستقبل — يُعرَف بالنظرة لا بمقارنة التواريخ بالعين */
.od-row.is-match { background: #f0fdf4; }
.od-branch { font-weight: 700; color: var(--text-primary, #1f2937); min-width: 0; overflow-wrap: anywhere; }
.od-day { font-weight: 700; color: #4b5563; white-space: nowrap; }
.od-unknown { color: #9ca3af; font-weight: 600; }
.od-muted { font-size: 12.5px; color: #6b7280; margin: 0; }

.od-fix {
  display: flex; align-items: flex-start; gap: 8px;
  margin-bottom: 14px; padding: 9px 11px; border-radius: 9px;
  background: #fef3c7; color: #92400e;
  font-size: 12px; font-weight: 700; line-height: 1.7;
}

.od-warn, .od-err {
  display: flex; align-items: flex-start; gap: 8px;
  margin-top: 12px; padding: 9px 11px; border-radius: 9px;
  font-size: 12px; font-weight: 700; line-height: 1.7;
}
.od-warn { background: #fef3c7; color: #92400e; }
.od-err  { background: #fee2e2; color: #b91c1c; }

:global(body.dark-mode) .od-row.is-match { background: rgba(22, 163, 74, 0.12); }
:global(body.dark-mode) .od-branch { color: #e2e8f0; }
</style>
