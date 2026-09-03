<script setup lang="ts">
// منتقي المدّة: زرٌّ واحد يفتح لوحةً فيها المُدَدُ الجاهزة وشهران للاختيار اليدويّ.
//
// **لماذا لوحةٌ واحدة لا تقويمان**: اختيارُ «من» ثم «إلى» من حقلين منفصلين يجعل
// الوكيل يفتح تقويماً ويغلقه ثم يفتح آخر، وبينهما يرى التقريرَ محسوباً على مدىً
// نصفِ مختار. هنا لا يُطبَّق شيءٌ حتى يضغط «تطبيق» — فالحالةُ المعروضة صحيحةٌ دائماً.
import { computed, ref, watch } from 'vue'
import { PERIOD_KEYS, PERIOD_ALL, periodRange, periodLabel } from '../store'
import { tx, lang } from '../lang'
import { icon } from '../icons'

const props = defineProps<{ from: string; to: string; busy?: boolean }>()
const emit = defineEmits<{ (e: 'apply', v: { from: string; to: string; key: string }): void }>()

const open = ref(false)
const activeKey = ref<string>('')          // المدّةُ الجاهزة المختارة، أو '' لمدىً يدويّ
// مسوّدةٌ داخل اللوحة: لا تمسّ التقرير حتى «تطبيق»
const draft = ref<{ from: string; to: string }>({ from: props.from, to: props.to })
watch(() => [props.from, props.to], () => { draft.value = { from: props.from, to: props.to } })

// ── التقويم ────────────────────────────────────────────────────────────────
const MONTH_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
const DOW_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// الشهر المعروض على اليمين (الأحدث)؛ والأيسر هو الذي قبله
const anchor = ref(new Date())
watch(open, (v) => {
  if (!v) return
  // نفتح على شهر «إلى» إن وُجد — الوكيل يعدّل آخر المدى غالباً لا أوّله
  const base = draft.value.to || draft.value.from
  anchor.value = base ? new Date(base + 'T00:00:00') : new Date()
})

function monthGrid(offset: number) {
  const a = new Date(anchor.value.getFullYear(), anchor.value.getMonth() + offset, 1)
  const y = a.getFullYear(), m = a.getMonth()
  const first = new Date(y, m, 1).getDay()          // 0=الأحد
  const days = new Date(y, m + 1, 0).getDate()
  const cells: Array<{ d: number; iso: string } | null> = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push({ d, iso: iso(y, m, d) })
  return { y, m, title: `${lang.value === 'ar' ? MONTH_AR[m] : MONTH_EN[m]} ${y}`, cells }
}
// الشهرُ الأقدمُ أوّلاً: يُرسَم حيث تبدأ القراءة (يميناً في العربيّة، يساراً في
// الإنجليزيّة) — فلا يُسمّى بجهةٍ تنقلب مع اللغة.
const mOlder = computed(() => monthGrid(-1))
const mNewer = computed(() => monthGrid(0))
const dows = computed(() => (lang.value === 'ar' ? DOW_AR : DOW_EN))
// الرجوعُ في العربيّة يميناً وفي الإنجليزيّة يساراً — والسهمُ يتبع القراءة
const backGlyph = computed(() => (lang.value === 'ar' ? '\u203A' : '\u2039'))
const fwdGlyph = computed(() => (lang.value === 'ar' ? '\u2039' : '\u203A'))

function shift(n: number) {
  anchor.value = new Date(anchor.value.getFullYear(), anchor.value.getMonth() + n, 1)
}

// ── الاختيار: ضغطةٌ تبدأ المدى، والثانية تُنهيه (وتُقلَب إن جاءت قبله) ───────
function pick(d: string) {
  const { from, to } = draft.value
  if (!from || (from && to)) { draft.value = { from: d, to: '' }; activeKey.value = ''; return }
  draft.value = d < from ? { from: d, to: from } : { from, to: d }
  activeKey.value = ''
}
const inRange = (d: string) => {
  const { from, to } = draft.value
  return !!(from && to && d > from && d < to)
}
const isEdge = (d: string) => d === draft.value.from || d === draft.value.to

function choosePreset(k: string) {
  const r = periodRange(k)
  draft.value = { from: r.from, to: r.to }
  activeKey.value = k
  apply()
}
function apply() {
  emit('apply', { from: draft.value.from, to: draft.value.to, key: activeKey.value })
  open.value = false
}
function cancel() {
  draft.value = { from: props.from, to: props.to }
  open.value = false
}

// نصُّ الزرّ: اسمُ المدّة إن كانت جاهزة، وإلا المدى بأسماء الشهور لا بتواريخ خامّة.
//
// **لماذا لا `2026-08-01 — 2026-08-27`**: نصٌّ كلُّه أرقامٌ وشَرطة في فقرةٍ عربيّة
// يقلبه المحرّكُ ثنائيُّ الاتجاه فيظهر آخرُ المدى في موضع أوّله — والقارئ لا يرى
// أنّ شيئاً انقلب، فيقرأ مدىً غيرَ المحسوب. اسمُ الشهر يجعل كلَّ تاريخٍ مقطعاً
// عربيّاً قائماً بذاته، فيأخذ ترتيبَه الصحيح من اتجاه الفقرة.
const dayText = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return `${d} ${lang.value === 'ar' ? MONTH_AR[m - 1] : MONTH_EN[m - 1]} ${y}`
}
const label = computed(() => {
  if (activeKey.value) return periodLabel(activeKey.value)
  const { from, to } = props
  if (!from && !to) return periodLabel(PERIOD_ALL)
  if (!from || !to) return dayText(from || to)
  if (from === to) return dayText(from)
  // شهرٌ واحد: «١ – ٢٧ أغسطس ٢٠٢٦» أقصرُ من تكرار الشهر والسنة مرّتين
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))} – ${dayText(to)}`
  return `${dayText(from)} – ${dayText(to)}`
})
</script>

<template>
  <div class="dr">
    <button class="dr-btn" :class="{ on: open }" :disabled="busy" @click="open = !open">
      <span class="dr-ico" v-html="icon('calendar', { size: 15 })"></span>
      <span>{{ label }}</span>
    </button>

    <!-- طبقةٌ تلتقط الضغط خارج اللوحة فتُغلقها بلا «إلغاء» -->
    <div v-if="open" class="dr-scrim" @click="cancel()"></div>

    <div v-if="open" class="dr-pop">
      <div class="dr-body">
        <div class="dr-cals">
          <div class="dr-nav">
            <button class="dr-arrow" @click="shift(-1)" :aria-label="tx('الشهر السابق', 'Previous month')">{{ backGlyph }}</button>
            <span class="dr-mt">{{ mOlder.title }}</span>
            <span class="dr-mt">{{ mNewer.title }}</span>
            <button class="dr-arrow" @click="shift(1)" :aria-label="tx('الشهر التالي', 'Next month')">{{ fwdGlyph }}</button>
          </div>
          <div class="dr-two">
            <div v-for="(mm, k) in [mOlder, mNewer]" :key="k" class="dr-cal">
              <div class="dr-dow"><span v-for="(w, i) in dows" :key="i">{{ w }}</span></div>
              <div class="dr-grid">
                <button v-for="(c, i) in mm.cells" :key="i" type="button" class="dr-cell"
                        :class="{ empty: !c, edge: c && isEdge(c.iso), mid: c && inRange(c.iso) }"
                        :disabled="!c" :aria-pressed="!!(c && isEdge(c.iso))"
                        @click="c && pick(c.iso)">{{ c ? c.d : '' }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- المُدَدُ الجاهزة: ما يُختار في تسعٍ من كلّ عشر مرّات -->
        <div class="dr-presets">
          <button v-for="k in PERIOD_KEYS" :key="k" :class="{ on: activeKey === k }"
            @click="choosePreset(k)">{{ periodLabel(k) }}</button>
          <button class="dr-all" :class="{ on: activeKey === PERIOD_ALL }"
            @click="choosePreset(PERIOD_ALL)">{{ periodLabel(PERIOD_ALL) }}</button>
        </div>
      </div>

      <div class="dr-foot">
        <button class="dr-apply" :disabled="!draft.from" @click="apply()">{{ tx('تطبيق', 'Apply') }}</button>
        <button class="dr-cancel" @click="cancel()">{{ tx('إلغاء', 'Cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dr { position: relative; display: inline-block; }

.dr-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 14px; border-radius: 12px; cursor: pointer;
  border: 1px solid rgba(226, 232, 240, .9); background: var(--bg-card, #fff);
  color: var(--text-primary, #1f2937); font-family: inherit; font-size: 12.5px; font-weight: 700;
}
.dr-btn:hover, .dr-btn.on { border-color: #648cbd; color: #305584; }
.dr-ico { display: inline-flex; color: var(--text-muted, #94a3b8); }

/* الطبقة تلتقط الضغط خارج اللوحة — لوحةٌ تبقى مفتوحةً خلف المؤشّر تُربك */
.dr-scrim { position: fixed; inset: 0; z-index: 40; }

.dr-pop {
  position: absolute; z-index: 41; inset-block-start: calc(100% + 8px); inset-inline-start: 0;
  border-radius: 16px; border: 1px solid rgba(226, 232, 240, .9);
  background: var(--bg-card, #fff); box-shadow: 0 18px 44px rgba(16, 24, 40, .18);
  min-inline-size: 620px;
}
.dr-body { display: flex; }
.dr-cals { flex: 1; padding: 14px 16px; min-inline-size: 0; }
.dr-nav { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.dr-mt { flex: 1; text-align: center; font-size: 12.5px; font-weight: 800; color: var(--text-primary, #1f2937); }
.dr-arrow {
  inline-size: 26px; block-size: 26px; flex: 0 0 auto; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(226, 232, 240, .9); background: transparent;
  color: var(--text-secondary, #64748b); font-size: 15px; line-height: 1; font-family: inherit;
}
.dr-arrow:hover { border-color: #648cbd; color: #305584; }
.dr-two { display: flex; gap: 18px; }
.dr-cal { flex: 1; min-inline-size: 0; }
.dr-dow, .dr-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.dr-dow span { text-align: center; font-size: 10px; font-weight: 700; color: var(--text-muted, #94a3b8); padding-block-end: 4px; }
.dr-cell {
  block-size: 28px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600;
  color: var(--text-primary, #1f2937); font-variant-numeric: tabular-nums;
  border: 0; background: none; padding: 0; font-family: inherit;
}
.dr-cell:hover:not(.empty) { background: rgba(100, 140, 189, .16); }
.dr-cell:focus-visible { outline: 2px solid #648cbd; outline-offset: 1px; }
.dr-cell.empty { cursor: default; }
/* طرفا المدى مملوءان، وما بينهما مظلَّلٌ خفيف — الشكل يقول «مدى» لا «يومين» */
.dr-cell.mid { background: rgba(100, 140, 189, .16); border-radius: 0; }
.dr-cell.edge { background: #305584; color: #fff; }

.dr-presets {
  inline-size: 150px; flex: 0 0 auto; display: flex; flex-direction: column; gap: 2px;
  padding: 14px 12px; border-inline-start: 1px solid rgba(226, 232, 240, .9);
}
.dr-presets button {
  padding: 8px 12px; border-radius: 9px; cursor: pointer; text-align: start;
  border: none; background: transparent; color: var(--text-secondary, #64748b);
  font-family: inherit; font-size: 12.5px; font-weight: 700;
}
.dr-presets button:hover { background: rgba(100, 140, 189, .14); color: #305584; }
.dr-presets button.on { background: #305584; color: #fff; }
.dr-all { margin-block-start: auto; color: var(--warning, #b45309) !important; }
.dr-all.on { background: #305584 !important; color: #fff !important; }

.dr-foot {
  display: flex; gap: 8px; padding: 12px 16px;
  border-block-start: 1px solid rgba(226, 232, 240, .9);
}
.dr-apply, .dr-cancel {
  padding: 9px 20px; border-radius: 10px; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 700;
}
.dr-apply { border: none; background: #305584; color: #fff; }
.dr-apply:disabled { opacity: .5; cursor: not-allowed; }
.dr-cancel { border: 1px solid rgba(226, 232, 240, .9); background: transparent; color: var(--text-secondary, #64748b); }

/* شاشةٌ ضيّقة: شهرٌ واحد ولوحةٌ تملأ العرض */
@media (max-width: 720px) {
  .dr-pop { min-inline-size: 0; inline-size: min(92vw, 420px); }
  .dr-body { flex-direction: column; }
  .dr-two > .dr-cal:first-child { display: none; }
  .dr-nav .dr-mt:first-of-type { display: none; }
  .dr-presets { inline-size: auto; flex-direction: row; flex-wrap: wrap; border-inline-start: none; border-block-start: 1px solid rgba(226, 232, 240, .9); }
  .dr-all { margin-block-start: 0; }
}
</style>
