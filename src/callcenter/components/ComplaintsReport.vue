<script setup lang="ts">
// تقرير الشكاوى: أعدادٌ مجمَّعة يقرؤها المشرف في نظرة — لا جدولُ صفوفٍ يُعدّ باليد.
// الخادم يجمّع، والشاشة ترسم. الرسمُ بـSVG بلا مكتبةٍ خارجية: شكلان لا يستحقّان
// ٢٠٠ كيلوبايت في الحزمة.
//
// **الهيئة تحاكي تقارير داشبورد السوبر أدمن**: رقاقةٌ متدرّجة لكلّ مؤشّر، بطاقاتٌ
// بزوايا ١٦px وظلٍّ ناعم، ومرشّحاتٌ داخل بطاقة — فالشاشتان تُقرآن كنظامٍ واحد.
//
// **لونا السلسلتين (#1f7aa3 الوارد · #16a34a المحلول) مُتحقَّقٌ منهما**: يمرّان فحوص
// نطاق الإضاءة والتشبّع وفصلِ عمى الألوان والتباين على لوحَي النهار والليل معاً — فلا
// يُستبدلان بالتقدير. ولا يُعتمَد اللون وحده: لكلّ سلسلةٍ مفتاحٌ مكتوب.
import { computed, onMounted, ref } from 'vue'
import { state, loadComplaintsReport, complaintStatusLabel, complaintCategoryLabel, periodRange } from '../store'
import { tx, lang } from '../lang'
import { icon } from '../icons'
import DateRangePicker from './DateRangePicker.vue'

const rep = computed<any>(() => state.complaintsReport)

// منتقٍ واحدٌ يجمع المُدَدَ الجاهزة والاختيارَ اليدويّ
function applyRange(v: { from: string; to: string }) {
  state.complaintsReportFrom = v.from
  state.complaintsReportTo = v.to
  void loadComplaintsReport()
}
function applyPeriod(k: string) { applyRange(periodRange(k)) }

// ── مؤشّرات الرأس ───────────────────────────────────────────────────────────
const countOf = (k: string) =>
  (rep.value?.byStatus || []).find((x: any) => x.key === k)?.count ?? 0

function fmtHours(h: number): string {
  if (h < 1) return tx(`${Math.round(h * 60)} دقيقة`, `${Math.round(h * 60)} min`)
  if (h < 48) return tx(`${Math.round(h * 10) / 10} ساعة`, `${Math.round(h * 10) / 10} h`)
  return tx(`${Math.round(h / 24)} يوم`, `${Math.round(h / 24)} d`)
}

// فرقُ المدى السابق: الرقمُ وحده لا يقول أتحسّنّا أم ساءت الحال.
// و«الأفضل» يختلف باختلاف المؤشّر: شكاوى أقلّ خيرٌ، وزمنُ حلٍّ أقصرُ خيرٌ —
// فاللونُ يتبع المعنى لا إشارةَ الرقم.
function delta(now: number | null, before: number | null, lowerIsBetter = true) {
  if (now == null || before == null || !before) return null
  const pct = Math.round(((now - before) / before) * 100)
  if (pct === 0) return { pct, dir: 0, good: true }
  return { pct, dir: pct > 0 ? 1 : -1, good: lowerIsBetter ? pct < 0 : pct > 0 }
}
const dTotal = computed(() => delta(rep.value?.total ?? null, rep.value?.prev?.total ?? null))
const dAvg = computed(() => delta(rep.value?.avgResolutionHours ?? null, rep.value?.prev?.avgResolutionHours ?? null))

const PRIO: Record<string, { ar: string; en: string; c: string }> = {
  urgent: { ar: 'عاجلة', en: 'Urgent', c: '#dc2626' },
  high: { ar: 'عالية', en: 'High', c: '#d97706' },
  normal: { ar: 'عادية', en: 'Normal', c: '#1f7aa3' },
  low: { ar: 'منخفضة', en: 'Low', c: '#64748b' },
}
const prioLabel = (k: string) => (PRIO[k] ? tx(PRIO[k].ar, PRIO[k].en) : k)
const prioColor = (k: string) => PRIO[k]?.c || '#64748b'
const prioRows = computed(() => {
  const order = ['urgent', 'high', 'normal', 'low']
  return (rep.value?.byPriority || []).slice().sort(
    (a: any, b: any) => order.indexOf(a.key) - order.indexOf(b.key))
})

// عمرُ المفتوحة — ما يُعمَل به اليوم
const aging = computed<any>(() => rep.value?.aging || { d0: 0, d1: 0, d3: 0 })
const openTotal = computed(() => aging.value.d0 + aging.value.d1 + aging.value.d3)
const oldest = computed<any[]>(() => rep.value?.oldestOpen || [])
const ageText = (h: number) => (h < 48 ? tx(`${h} ساعة`, `${h}h`) : tx(`${Math.round(h / 24)} يوم`, `${Math.round(h / 24)}d`))

const kpis = computed(() => {
  const r = rep.value
  if (!r) return []
  const done = countOf('resolved') + countOf('closed')
  // صفرٌ في المقام يعطي NaN تظهر للمستخدم
  const rate = r.total ? Math.round((done / r.total) * 100) : 0
  return [
    { k: 'total', label: tx('إجمالي الشكاوى', 'Total complaints'), value: String(r.total), tone: 'brand', ico: 'clipboard-list' },
    { k: 'open', label: tx('مفتوحة', 'Open'), value: String(countOf('open') + countOf('in_progress')), tone: 'amber', ico: 'alert-circle' },
    { k: 'done', label: tx('تم حلّها', 'Resolved'), value: String(done), tone: 'green', ico: 'check-circle' },
    { k: 'rate', label: tx('نسبة الحلّ', 'Resolution rate'), value: rate + '%', tone: rate >= 70 ? 'green' : 'rose', ico: 'sparkles' },
    {
      k: 'avg',
      label: tx('متوسّط زمن الحلّ', 'Avg. time to resolve'),
      // بلا شكوى محلولةٍ واحدة لا متوسّط — «٠ ساعة» كذبٌ يقرأه المشرف إنجازاً
      value: r.avgResolutionHours == null ? '—' : fmtHours(r.avgResolutionHours),
      tone: 'sky', ico: 'clock',
    },
  ]
})

// ── الحالات: حلقةٌ واحدة تقول التوزيع ───────────────────────────────────────
// ألوانُ حالةٍ محجوزة (لا تُعاد استعمالاً لسلسلةٍ عادية)، ومعها الاسمُ مكتوباً.
const STATUS_TONE: Record<string, string> = {
  open: '#1f7aa3', in_progress: '#d97706', resolved: '#16a34a', closed: '#64748b',
}
const R = 52, CIRC = 2 * Math.PI * R
const donut = computed(() => {
  const rows = (rep.value?.byStatus || []).filter((x: any) => x.count > 0)
  const total = rows.reduce((s: number, x: any) => s + x.count, 0)
  if (!total) return { total: 0, arcs: [] as any[] }
  let acc = 0
  const arcs = rows.map((x: any) => {
    const frac = x.count / total
    // فجوةُ سطحٍ ٢px بين القطاعات — الحدُّ يُرى بلا خطٍّ إضافيّ
    const gap = rows.length > 1 ? 2 : 0
    const arc = {
      key: x.key, count: x.count, frac,
      len: Math.max(0, frac * CIRC - gap), off: -acc * CIRC,
      color: STATUS_TONE[x.key] || '#64748b',
    }
    acc += frac
    return arc
  })
  return { total, arcs }
})

// ── السلسلة اليومية ─────────────────────────────────────────────────────────
const series = computed(() => {
  const rows = (rep.value?.daily || []) as any[]
  if (!rows.length) return { days: [] as any[], max: 0 }
  const first = new Date(rows[0].date + 'T00:00:00Z').getTime()
  const last = new Date(rows[rows.length - 1].date + 'T00:00:00Z').getTime()
  const byDate = new Map(rows.map((r: any) => [r.date, r]))
  const days: any[] = []
  // الأيامُ الفارغة تُملأ فتُرى الفجوة فجوةً لا تُطوى. ومدىً أطول من ثلاثة أشهر
  // يُرسَم بأيامه الواردة فقط بدل مئاتِ الأعمدة بعرضٍ لا يُرى.
  const span = Math.round((last - first) / 864e5) + 1
  if (span > 92) rows.forEach((r: any) => days.push({ date: r.date, total: r.total, resolved: r.resolved }))
  else for (let t = first; t <= last; t += 864e5) {
    const k = new Date(t).toISOString().slice(0, 10)
    const r: any = byDate.get(k)
    days.push({ date: k, total: r?.total ?? 0, resolved: r?.resolved ?? 0 })
  }
  return { days, max: Math.max(...days.map((d) => d.total), 1) }
})

// إحداثيّاتٌ حقيقية: `preserveAspectRatio` يبقى على أصله فلا تُمطّ الأعمدة عرضاً.
const W = 760, H = 230
const PAD = { t: 14, r: 12, b: 30, l: 34 }
const plotW = W - PAD.l - PAD.r
const plotH = H - PAD.t - PAD.b
const baseY = PAD.t + plotH

// سقفٌ للمحور يصعد لأرقامٍ مستديرة، **ومعه متّسعٌ ١٥٪**: بلا المتّسع يلامس أطولُ
// عمودٍ حافّةَ الرسم وتُقصّ تسميتُه فوقه — وهو أوّلُ رقمٍ تقع عليه العين.
const yMax = computed(() => {
  const m = series.value.max
  const step = m <= 5 ? 1 : m <= 20 ? 5 : m <= 100 ? 10 : 50
  return Math.max(step, Math.ceil((m * 1.15) / step) * step)
})
const ticks = computed(() => {
  const m = yMax.value
  const raw = [0, m / 2, m].map((v) => Math.round(v))
  return Array.from(new Set(raw)).map((v) => ({ v, y: baseY - (v / m) * plotH }))
})

// عرضُ الخانة مسقوف: يومان لا يعنيان عمودين بعرض نصف الرسم.
// والعمودان **يسعان خانتَهما دائماً**: حدٌّ أدنى ثابت للعرض مع مدىً طويل يجعل
// الزوجَ أعرضَ من خانته، فيتداخل اليومان ويفيض آخرُهما عن حدّ الرسم.
const lay = computed(() => {
  const n = series.value.days.length || 1
  const slot = Math.min(plotW / n, 68)
  const gap = slot < 8 ? 1 : 2
  const x0 = PAD.l + (plotW - slot * n) / 2
  const barW = Math.max(1.5, Math.min(slot * 0.36, 18, (slot - gap) / 2))
  return { slot, x0, barW, gap }
})
const hAt = (v: number) => (v / yMax.value) * plotH
// طرفٌ مستديرٌ أعلى العمود وحده — القاعدة تبقى مستقيمةً على المحور
function barPath(x: number, v: number, w: number): string {
  const h = hAt(v)
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  const y = baseY - h
  return `M${x} ${baseY} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${baseY} Z`
}
const slotX = (i: number) => lay.value.x0 + i * lay.value.slot
const barsOf = (i: number) => {
  const { slot, barW, gap } = lay.value
  const pairW = barW * 2 + gap
  const s = slotX(i) + (slot - pairW) / 2
  return { xTotal: s, xRes: s + barW + gap, w: barW }
}

// تسميةُ محورٍ خفيفة: أوّلُ يومٍ ووسطُه وآخره — لا ثلاثون تاريخاً متراكبة
const axisDays = computed(() => {
  const d = series.value.days
  if (d.length <= 3) return d.map((x: any, i: number) => ({ ...x, i }))
  const mid = Math.floor(d.length / 2)
  return [{ ...d[0], i: 0 }, { ...d[mid], i: mid }, { ...d[d.length - 1], i: d.length - 1 }]
})
const shortDate = (s: string) => s.slice(5).replace('-', '/')
// تسميةٌ مباشرة على القمّة وحدها — رقمٌ فوق كلّ عمودٍ ضجيج
const peakIdx = computed(() => {
  const d = series.value.days
  let bi = -1, bv = 0
  d.forEach((x: any, i: number) => { if (x.total > bv) { bv = x.total; bi = i } })
  return bi
})

// ── قوائم مرتَّبة ───────────────────────────────────────────────────────────
const maxOf = (rows: any[]) => Math.max(...(rows || []).map((r: any) => r.count), 1)
const catRows = computed(() => (rep.value?.byCategory || []).slice(0, 8))
const branchRows = computed(() => (rep.value?.byBranch || []).slice(0, 8))
const branchName = (r: any) =>
  (lang.value === 'en' ? (r.nameEn || r.name) : (r.name || r.nameEn)) || tx('بلا فرع', 'No branch')

onMounted(() => { if (!rep.value) applyPeriod('d30') })   // الشكاوى أبطأُ إيقاعاً من الطلبات
</script>

<template>
  <div class="cr">
    <!-- المرشّحات داخل بطاقة — نفس شريط تقارير الداشبورد -->
    <div class="cr-bar">
      <DateRangePicker :from="state.complaintsReportFrom" :to="state.complaintsReportTo"
        :busy="state.complaintsReportBusy" @apply="applyRange" />
      <span v-if="state.complaintsReportBusy" class="cr-warn">{{ tx('جارٍ التحميل…', 'Loading…') }}</span>
      <span v-if="rep?.sampled" class="cr-warn">
        {{ tx('المدى كبير — السلسلة والمتوسّط على أحدث ٥٠٠٠ شكوى', 'Wide range — series and average use the latest 5,000 complaints') }}
      </span>
    </div>

    <p v-if="!rep && !state.complaintsReportBusy" class="cr-empty">
      {{ tx('اختر مدىً واضغط «تطبيق»', 'Pick a range and press “Apply”') }}
    </p>

    <template v-else-if="rep">
      <p v-if="!rep.total" class="cr-empty">{{ tx('لا شكاوى في هذا المدى', 'No complaints in this range') }}</p>

      <template v-else>
        <div class="cr-kpis">
          <div v-for="k in kpis" :key="k.k" class="cr-kpi">
            <span class="cr-chip" :class="'g-' + k.tone" v-html="icon(k.ico, { size: 22 })"></span>
            <span class="cr-kpi-b">
              <span class="cr-kpi-l">{{ k.label }}</span>
              <span class="cr-kpi-v">{{ k.value }}</span>
              <span v-if="k.k === 'total' && dTotal" class="cr-dlt" :class="dTotal.good ? 'up' : 'dn'">
                {{ dTotal.dir > 0 ? '▲' : dTotal.dir < 0 ? '▼' : '=' }} {{ Math.abs(dTotal.pct) }}% {{ tx('عن السابق', 'vs prev.') }}
              </span>
              <span v-else-if="k.k === 'avg' && dAvg" class="cr-dlt" :class="dAvg.good ? 'up' : 'dn'">
                {{ dAvg.dir > 0 ? '▲' : dAvg.dir < 0 ? '▼' : '=' }} {{ Math.abs(dAvg.pct) }}% {{ tx('عن السابق', 'vs prev.') }}
              </span>
            </span>
          </div>
        </div>

        <!-- ما يُعمَل به اليوم يسبق ما يُقرأ: المفتوحة بعمرها ثم أقدمُها بأسمائها -->
        <section v-if="openTotal" class="cr-card cr-act" :class="{ hot: aging.d3 > 0 }">
          <div class="cr-head">
            <h3 class="cr-h">{{ tx('مفتوحة بانتظار إجراء', 'Open — awaiting action') }}</h3>
            <div class="cr-ages">
              <span class="cr-age a0">{{ aging.d0 }} <em>{{ tx('أقل من يوم', 'under 1d') }}</em></span>
              <span class="cr-age a1">{{ aging.d1 }} <em>{{ tx('١–٣ أيام', '1–3d') }}</em></span>
              <span class="cr-age a3">{{ aging.d3 }} <em>{{ tx('أكثر من ٣ أيام', 'over 3d') }}</em></span>
            </div>
          </div>
          <div v-for="o in oldest" :key="o.id" class="cr-row cr-old">
            <span class="cr-dot" :style="{ background: prioColor(o.priority) }"></span>
            <span class="cr-row-l">{{ complaintCategoryLabel(o.category) }}</span>
            <span class="cr-old-b">{{ (lang === 'en' ? (o.branchNameEn || o.branchName) : (o.branchName || o.branchNameEn)) || '—' }}</span>
            <span class="cr-old-a" :class="{ hot: o.hours >= 72 }">{{ tx('مفتوحة منذ', 'open for') }} {{ ageText(o.hours) }}</span>
          </div>
        </section>

        <div class="cr-grid">
          <section class="cr-card">
            <div class="cr-head">
              <h3 class="cr-h">{{ tx('الشكاوى يوماً بيوم', 'Complaints per day') }}</h3>
              <div class="cr-legend">
                <span><i class="sw sw-t"></i>{{ tx('الواردة', 'Received') }}</span>
                <span><i class="sw sw-r"></i>{{ tx('المحلولة', 'Resolved') }}</span>
              </div>
            </div>
            <svg class="cr-svg" :viewBox="`0 0 ${W} ${H}`" role="img"
                 :aria-label="tx('الشكاوى الواردة والمحلولة يوماً بيوم', 'Received and resolved complaints per day')">
              <!-- شبكةٌ خافتة خلف المعطى لا فوقه -->
              <g class="cr-grid-g">
                <line v-for="t in ticks" :key="'g' + t.v" :x1="PAD.l" :y1="t.y" :x2="W - PAD.r" :y2="t.y" />
              </g>
              <g class="cr-tick">
                <text v-for="t in ticks" :key="'t' + t.v" :x="PAD.l - 7" :y="t.y + 3.5">{{ t.v }}</text>
              </g>
              <g v-for="(d, i) in series.days" :key="d.date">
                <title>{{ d.date }} — {{ tx('واردة', 'received') }} {{ d.total }} · {{ tx('محلولة', 'resolved') }} {{ d.resolved }}</title>
                <path :d="barPath(barsOf(i).xTotal, d.total, barsOf(i).w)" class="cr-b-t" />
                <path :d="barPath(barsOf(i).xRes, d.resolved, barsOf(i).w)" class="cr-b-r" />
                <text v-if="i === peakIdx && d.total" class="cr-peak-l"
                      :x="barsOf(i).xTotal + barsOf(i).w / 2" :y="baseY - hAt(d.total) - 6">{{ d.total }}</text>
              </g>
              <line :x1="PAD.l" :y1="baseY" :x2="W - PAD.r" :y2="baseY" class="cr-axis" />
              <g class="cr-xlab">
                <text v-for="a in axisDays" :key="'x' + a.i"
                      :x="slotX(a.i) + lay.slot / 2" :y="baseY + 18">{{ shortDate(a.date) }}</text>
              </g>
            </svg>
          </section>

          <section class="cr-card">
            <h3 class="cr-h">{{ tx('توزيع الحالات', 'By status') }}</h3>
            <div class="cr-donut-wrap">
              <svg class="cr-donut" viewBox="0 0 130 130" role="img"
                   :aria-label="tx('توزيع الشكاوى حسب الحالة', 'Complaints by status')">
                <g transform="rotate(-90 65 65)">
                  <circle cx="65" cy="65" r="52" class="cr-ring" />
                  <circle v-for="a in donut.arcs" :key="a.key" cx="65" cy="65" :r="R"
                          :stroke="a.color" :stroke-dasharray="`${a.len} ${CIRC}`"
                          :stroke-dashoffset="a.off" class="cr-arc" />
                </g>
                <text x="65" y="62" class="cr-donut-n">{{ donut.total }}</text>
                <text x="65" y="80" class="cr-donut-c">{{ tx('شكوى', 'total') }}</text>
              </svg>
              <ul class="cr-slist">
                <li v-for="a in donut.arcs" :key="a.key">
                  <i class="sw" :style="{ background: a.color }"></i>
                  <span class="cr-sname">{{ complaintStatusLabel(a.key) }}</span>
                  <span class="cr-sval">{{ a.count }}</span>
                  <span class="cr-spct">{{ Math.round(a.frac * 100) }}%</span>
                </li>
              </ul>
            </div>
            <div v-if="prioRows.length" class="cr-prio">
              <span class="cr-prio-h">{{ tx('الأولويّة', 'Priority') }}</span>
              <span v-for="p in prioRows" :key="p.key" class="cr-prio-c">
                <i class="sw" :style="{ background: prioColor(p.key) }"></i>{{ prioLabel(p.key) }} · {{ p.count }}
              </span>
            </div>
          </section>
        </div>

        <div class="cr-grid">
          <section class="cr-card">
            <h3 class="cr-h">{{ tx('أكثر أنواع الشكاوى', 'Top complaint types') }}</h3>
            <div v-for="r in catRows" :key="r.key" class="cr-row">
              <span class="cr-row-l">{{ complaintCategoryLabel(r.key) }}</span>
              <span class="cr-row-t"><i :style="{ inlineSize: (r.count / maxOf(catRows)) * 100 + '%' }"></i></span>
              <span class="cr-row-v">{{ r.count }}</span>
            </div>
          </section>

          <section class="cr-card">
            <h3 class="cr-h">{{ tx('الشكاوى حسب الفرع', 'By branch') }}</h3>
            <div v-for="r in branchRows" :key="String(r.branchId)" class="cr-row">
              <span class="cr-row-l">{{ branchName(r) }}</span>
              <span class="cr-row-t"><i :style="{ inlineSize: (r.count / maxOf(branchRows)) * 100 + '%' }"></i></span>
              <span class="cr-row-v">{{ r.count }}</span>
              <!-- سرعةُ الفرع لا عددُه وحده: ثلاثٌ تُحلّ في ساعة ليست كثلاثٍ تأخذ خمسة أيام -->
              <span class="cr-row-x">{{ r.avgHours == null ? '—' : fmtHours(r.avgHours) }}</span>
            </div>
            <p class="cr-foot">{{ tx('العمود الأخير: متوسّط زمن الحلّ في الفرع', 'Last column: average time to resolve at the branch') }}</p>
          </section>
        </div>

        <p v-if="rep.repeatCustomers" class="cr-note">
          <b>{{ rep.repeatCustomers }}</b>
          {{ tx('عميلاً اشتكى أكثر من مرّة في هذا المدى — تكرارُ الشكوى من العميل نفسه إشارةُ فقدِه لا شكوى عابرة.', 'customers complained more than once in this range — a repeat complaint signals a customer about to be lost, not a one-off.') }}
        </p>
      </template>
    </template>
  </div>
</template>

<style scoped>
/* الوضع الليليّ لهذه الشاشة في `style.css` العامّ لا هنا: `:global(X) Y` في هذا
   البناء يُترجَم إلى `X` **عارياً** — أي `body.dark-mode { … }` فيُطلى لوحُ الصفحة. */
.cr { padding: 2px 0 14px; }

/* ── سطحٌ واحد لكلّ البطاقات: زوايا ١٦px وحدٌّ خافت وظلٌّ ناعم ── */
.cr-bar, .cr-kpi, .cr-card {
  border-radius: 16px;
  border: 1px solid rgba(226, 232, 240, .7);
  background: var(--bg-card, #fff);
  box-shadow: 0 1px 2px rgba(16, 24, 40, .06), 0 1px 3px rgba(16, 24, 40, .1);
}

/* ── شريط المرشّحات ── */
.cr-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-bottom: 16px; padding: 14px 16px; }
.cr-f { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--text-secondary, #64748b); }
.cr-f input {
  padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 12px;
  background: var(--bg-card, #fff); color: var(--text-primary, #1f2937);
  font-family: inherit; font-size: 12.5px; font-weight: 600; min-inline-size: 150px;
}
.cr-go { align-self: flex-end; }
.cr-warn { font-size: 11.5px; font-weight: 700; color: var(--warning, #b45309); align-self: center; }
.cr-empty { text-align: center; padding: 44px; font-weight: 600; color: var(--text-muted, #94a3b8); }

/* ── المؤشّرات: رقاقةٌ متدرّجة ثم تسمية ورقم — تشريحُ `StatCard` نفسه ── */
.cr-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin-bottom: 16px; }
.cr-kpi { display: flex; align-items: center; gap: 13px; padding: 17px 18px; transition: transform .16s, box-shadow .16s; }
.cr-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(48, 85, 132, .16); }
.cr-chip {
  inline-size: 46px; block-size: 46px; flex: 0 0 auto; border-radius: 15px;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; box-shadow: 0 4px 10px rgba(16, 24, 40, .14);
}
.g-brand  { background: linear-gradient(135deg, #648cbd, #305584); }
.g-green  { background: linear-gradient(135deg, #34d399, #14b8a6); }
.g-amber  { background: linear-gradient(135deg, #fbbf24, #f97316); }
.g-rose   { background: linear-gradient(135deg, #fb7185, #db2777); }
.g-sky { background: linear-gradient(135deg, #56b6d8, #305584); }
.cr-kpi-b { min-inline-size: 0; display: flex; flex-direction: column; }
.cr-kpi-l { font-size: 12.5px; font-weight: 600; color: var(--text-secondary, #64748b); }
.cr-kpi-v { font-size: 22px; font-weight: 800; line-height: 1.25; color: var(--text-primary, #1f2937); font-variant-numeric: tabular-nums; }

/* شارةُ الفرق: اللون يتبع المعنى لا إشارة الرقم */
.cr-dlt { margin-top: 3px; font-size: 11px; font-weight: 700; }
.cr-dlt.up { color: #16a34a; }
.cr-dlt.dn { color: #dc2626; }

/* شريط العمل */
.cr-act { margin-bottom: 14px; }
.cr-act.hot { border-color: rgba(220, 38, 38, .35); }
.cr-ages { display: flex; gap: 8px; flex-wrap: wrap; }
.cr-age { font-size: 12px; font-weight: 800; padding: 5px 11px; border-radius: 999px; background: rgba(148, 163, 184, .16); color: var(--text-primary, #1f2937); }
.cr-age em { font-style: normal; font-weight: 600; font-size: 11px; opacity: .75; }
.cr-age.a1 { background: rgba(217, 119, 6, .14); color: #b45309; }
.cr-age.a3 { background: rgba(220, 38, 38, .14); color: #b91c1c; }
.cr-old { gap: 10px; }
.cr-dot { inline-size: 8px; block-size: 8px; border-radius: 999px; flex: 0 0 auto; }
.cr-old-b { flex: 1; font-size: 11.5px; font-weight: 600; color: var(--text-muted, #94a3b8); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cr-old-a { font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #64748b); white-space: nowrap; }
.cr-old-a.hot { color: #b91c1c; }

/* الأولويّة */
.cr-prio { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(226, 232, 240, .7); }
.cr-prio-h { font-size: 11px; font-weight: 800; color: var(--text-muted, #94a3b8); }
.cr-prio-c { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #64748b); }

.cr-row-x { inline-size: 74px; text-align: end; font-size: 11.5px; font-weight: 700; color: var(--text-muted, #94a3b8); white-space: nowrap; }
.cr-foot { margin: 9px 2px 0; font-size: 10.5px; font-weight: 600; color: var(--text-muted, #94a3b8); }
.cr-note { margin: 0 2px 8px; font-size: 12px; font-weight: 600; line-height: 1.7; color: var(--text-secondary, #64748b); }
.cr-note b { color: var(--text-primary, #1f2937); font-weight: 800; }

/* ── البطاقات ── */
.cr-grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin-bottom: 14px; }
@media (min-width: 940px) { .cr-grid { grid-template-columns: 1.7fr 1fr; } }
.cr-card { padding: 18px 20px; min-width: 0; }
.cr-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.cr-h { margin: 0 0 14px; font-size: 14px; font-weight: 700; color: var(--text-primary, #1f2937); }
.cr-head .cr-h { margin: 0; }
.cr-legend { display: flex; gap: 12px; font-size: 11.5px; font-weight: 600; color: var(--text-secondary, #64748b); }
.cr-legend span { display: inline-flex; align-items: center; gap: 5px; }
.sw { inline-size: 9px; block-size: 9px; border-radius: 2px; display: inline-block; flex: 0 0 auto; }
.sw-t { background: #1f7aa3; }
.sw-r { background: #16a34a; }

/* ── الرسم اليوميّ ── */
.cr-svg { inline-size: 100%; block-size: auto; display: block; }
.cr-grid-g line { stroke: var(--border-light, #f1f5f9); stroke-width: 1; }
.cr-axis { stroke: var(--border, #e5e7eb); stroke-width: 1; }
.cr-tick text { font-size: 10px; font-weight: 700; fill: var(--text-muted, #94a3b8); text-anchor: end; }
.cr-xlab text { font-size: 10px; font-weight: 700; fill: var(--text-muted, #94a3b8); text-anchor: middle; }
.cr-b-t { fill: #1f7aa3; }
.cr-b-r { fill: #16a34a; }
.cr-peak-l { font-size: 10.5px; font-weight: 800; fill: var(--text-secondary, #64748b); text-anchor: middle; }

/* ── الحلقة ── */
.cr-donut-wrap { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.cr-donut { inline-size: 130px; block-size: 130px; flex: 0 0 auto; }
.cr-ring { fill: none; stroke: var(--border-light, #f1f5f9); stroke-width: 14; }
.cr-arc { fill: none; stroke-width: 14; stroke-linecap: butt; }
.cr-donut-n { text-anchor: middle; font-size: 21px; font-weight: 800; fill: var(--text-primary, #1f2937); }
.cr-donut-c { text-anchor: middle; font-size: 9.5px; font-weight: 700; fill: var(--text-muted, #94a3b8); }
.cr-slist { list-style: none; margin: 0; padding: 0; flex: 1; min-inline-size: 150px; }
.cr-slist li { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 12.5px; font-weight: 600; }
.cr-slist li + li { border-top: 1px solid rgba(226, 232, 240, .7); }
.cr-sname { flex: 1; color: var(--text-secondary, #64748b); }
.cr-sval { color: var(--text-primary, #1f2937); font-weight: 700; font-variant-numeric: tabular-nums; }
.cr-spct { inline-size: 40px; text-align: end; font-size: 11.5px; color: var(--text-muted, #94a3b8); font-variant-numeric: tabular-nums; }

/* ── الصفوف المرتَّبة: خلفيةٌ خفيفة كصفوف الداشبورد ── */
.cr-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; font-size: 12.5px; border-radius: 12px; background: var(--bg, #f8fafc); }
.cr-row + .cr-row { margin-top: 6px; }
.cr-row-l { inline-size: 36%; font-weight: 600; color: var(--text-secondary, #64748b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cr-row-t { flex: 1; block-size: 8px; border-radius: 4px; background: rgba(148, 163, 184, .22); overflow: hidden; }
.cr-row-t i { display: block; block-size: 100%; background: linear-gradient(90deg, #648cbd, #305584); border-radius: 4px; }
.cr-row-v { inline-size: 40px; text-align: end; font-weight: 800; color: var(--text-primary, #1f2937); font-variant-numeric: tabular-nums; }
</style>
