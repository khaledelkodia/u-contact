<script setup lang="ts">
// تقرير الشكاوى: أعدادٌ مجمَّعة يقرؤها المشرف في نظرة — لا جدولُ صفوفٍ يُعدّ باليد.
// الخادم يجمّع، والشاشة ترسم. الرسمُ بـSVG وCSS بلا مكتبةٍ خارجية: أربعةُ أشكالٍ
// بسيطة لا تستحقّ ٢٠٠ كيلوبايت في الحزمة.
import { computed, onMounted } from 'vue'
import { state, loadComplaintsReport, complaintStatusLabel, complaintCategoryLabel } from '../store'
import { tx, lang } from '../lang'

const rep = computed<any>(() => state.complaintsReport)

// ── مؤشّرات الرأس ───────────────────────────────────────────────────────────
const countOf = (k: string) =>
  (rep.value?.byStatus || []).find((x: any) => x.key === k)?.count ?? 0

const kpis = computed(() => {
  const r = rep.value
  if (!r) return []
  const done = (countOf('resolved') + countOf('closed'))
  // نسبة الحلّ على الإجماليّ — صفرٌ في المقام يعطي NaN تظهر للمستخدم
  const rate = r.total ? Math.round((done / r.total) * 100) : 0
  return [
    { k: 'total', label: tx('إجمالي الشكاوى', 'Total complaints'), value: String(r.total), tone: 'neutral' },
    { k: 'open', label: tx('مفتوحة', 'Open'), value: String(countOf('open') + countOf('in_progress')), tone: 'warn' },
    { k: 'done', label: tx('تم حلّها', 'Resolved'), value: String(done), tone: 'good' },
    { k: 'rate', label: tx('نسبة الحلّ', 'Resolution rate'), value: rate + '%', tone: rate >= 70 ? 'good' : 'warn' },
    {
      k: 'avg',
      label: tx('متوسّط زمن الحلّ', 'Avg. time to resolve'),
      // بلا شكوى محلولةٍ واحدة لا متوسّط — «٠ ساعة» كذبٌ يقرأه المشرف إنجازاً
      value: r.avgResolutionHours == null ? '—' : fmtHours(r.avgResolutionHours),
      tone: 'neutral',
    },
  ]
})

function fmtHours(h: number): string {
  if (h < 1) return tx(`${Math.round(h * 60)} دقيقة`, `${Math.round(h * 60)} min`)
  if (h < 48) return tx(`${Math.round(h * 10) / 10} ساعة`, `${Math.round(h * 10) / 10} h`)
  return tx(`${Math.round(h / 24)} يوم`, `${Math.round(h / 24)} d`)
}

// ── الحالات: حلقةٌ واحدة تقول التوزيع ───────────────────────────────────────
const STATUS_TONE: Record<string, string> = {
  open: '#3b82f6', in_progress: '#f59e0b', resolved: '#16a34a', closed: '#64748b',
}
const donut = computed(() => {
  const rows = (rep.value?.byStatus || []).filter((x: any) => x.count > 0)
  const total = rows.reduce((s: number, x: any) => s + x.count, 0)
  if (!total) return { total: 0, arcs: [] as any[] }
  const C = 2 * Math.PI * 54          // محيط الدائرة (r=54)
  let acc = 0
  const arcs = rows.map((x: any) => {
    const frac = x.count / total
    const arc = { key: x.key, count: x.count, frac, len: frac * C, off: -acc * C, color: STATUS_TONE[x.key] || '#94a3b8' }
    acc += frac
    return arc
  })
  return { total, arcs }
})

// ── السلسلة اليومية: الأيام الفارغة تُملأ فالفجوة تُرى فجوةً لا تُطوى ────────
const series = computed(() => {
  const rows = (rep.value?.daily || []) as any[]
  if (!rows.length) return { days: [] as any[], max: 0 }
  const first = new Date(rows[0].date + 'T00:00:00Z').getTime()
  const last = new Date(rows[rows.length - 1].date + 'T00:00:00Z').getTime()
  const byDate = new Map(rows.map((r: any) => [r.date, r]))
  const days: any[] = []
  // سقفٌ للأعمدة: مدىً طويلٌ جداً يُرسم بأيامه الواردة فقط بدل ألفِ عمودٍ بعرض صفر
  const span = Math.round((last - first) / 864e5) + 1
  if (span > 92) {
    for (const r of rows) days.push({ date: r.date, total: r.total, resolved: r.resolved })
  } else {
    for (let t = first; t <= last; t += 864e5) {
      const k = new Date(t).toISOString().slice(0, 10)
      const r: any = byDate.get(k)
      days.push({ date: k, total: r?.total ?? 0, resolved: r?.resolved ?? 0 })
    }
  }
  return { days, max: Math.max(...days.map((d) => d.total), 1) }
})

const W = 720, H = 180, PAD = 8
const barW = computed(() => Math.max(2, (W - PAD * 2) / Math.max(series.value.days.length, 1) - 2))
const xAt = (i: number) => PAD + i * ((W - PAD * 2) / Math.max(series.value.days.length, 1))
const yAt = (v: number) => H - (v / series.value.max) * (H - 24)

// تسميةُ محورٍ خفيفة: أوّلُ يومٍ وآخره ووسطُه — لا ثلاثون تاريخاً متراكبة
const axisDays = computed(() => {
  const d = series.value.days
  if (d.length < 2) return d.map((x: any, i: number) => ({ ...x, i }))
  const mid = Math.floor(d.length / 2)
  return [{ ...d[0], i: 0 }, { ...d[mid], i: mid }, { ...d[d.length - 1], i: d.length - 1 }]
})
const shortDate = (s: string) => s.slice(5).replace('-', '/')

// ── قوائم مرتَّبة: الفئة والفرع ─────────────────────────────────────────────
const maxOf = (rows: any[]) => Math.max(...(rows || []).map((r: any) => r.count), 1)
const catRows = computed(() => (rep.value?.byCategory || []).slice(0, 8))
const branchRows = computed(() => (rep.value?.byBranch || []).slice(0, 8))
const branchName = (r: any) =>
  (lang.value === 'en' ? (r.nameEn || r.name) : (r.name || r.nameEn)) || tx('بلا فرع', 'No branch')

onMounted(() => { if (!rep.value) void loadComplaintsReport() })
</script>

<template>
  <div class="cr">
    <!-- المدى: التقرير بلا مدىً يقرأ كلَّ تاريخ الشركة، وهو نادراً ما يُراد -->
    <div class="cr-bar">
      <label class="cr-f">
        <span>{{ tx('من', 'From') }}</span>
        <input type="date" v-model="state.complaintsReportFrom">
      </label>
      <label class="cr-f">
        <span>{{ tx('إلى', 'To') }}</span>
        <input type="date" v-model="state.complaintsReportTo">
      </label>
      <button class="btn btn-primary btn-sm" :disabled="state.complaintsReportBusy" @click="loadComplaintsReport()">
        {{ state.complaintsReportBusy ? tx('جارٍ التحميل…', 'Loading…') : tx('عرض', 'Show') }}
      </button>
      <span v-if="rep?.sampled" class="cr-warn">
        {{ tx('المدى كبير — السلسلة والمتوسّط على أحدث ٥٠٠٠ شكوى', 'Wide range — series and average are based on the latest 5,000 complaints') }}
      </span>
    </div>

    <p v-if="!rep && !state.complaintsReportBusy" class="cr-empty">
      {{ tx('اختر مدىً واضغط «عرض»', 'Pick a range and press “Show”') }}
    </p>

    <template v-else-if="rep">
      <p v-if="!rep.total" class="cr-empty">{{ tx('لا شكاوى في هذا المدى', 'No complaints in this range') }}</p>

      <template v-else>
        <!-- المؤشّرات -->
        <div class="cr-kpis">
          <div v-for="k in kpis" :key="k.k" class="cr-kpi" :class="'t-' + k.tone">
            <div class="cr-kpi-v">{{ k.value }}</div>
            <div class="cr-kpi-l">{{ k.label }}</div>
          </div>
        </div>

        <!-- المنحنى اليوميّ + توزيع الحالات -->
        <div class="cr-grid">
          <section class="cr-card cr-card-wide">
            <h4 class="cr-h">{{ tx('الشكاوى يوماً بيوم', 'Complaints per day') }}</h4>
            <svg class="cr-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img">
              <line :x1="PAD" :y1="H - 0.5" :x2="W - PAD" :y2="H - 0.5" class="cr-axis" />
              <g v-for="(d, i) in series.days" :key="d.date">
                <title>{{ d.date }} — {{ d.total }}</title>
                <rect :x="xAt(i)" :y="yAt(d.total)" :width="barW" :height="Math.max(0, H - yAt(d.total))" class="cr-bar-t" rx="2" />
                <!-- المحلولة داخل العمود نفسه: مقارنةٌ في مكانها لا رسمٌ ثانٍ -->
                <rect v-if="d.resolved" :x="xAt(i)" :y="yAt(d.resolved)" :width="barW"
                      :height="Math.max(0, H - yAt(d.resolved))" class="cr-bar-r" rx="2" />
              </g>
            </svg>
            <div class="cr-axis-x">
              <span v-for="a in axisDays" :key="a.i">{{ shortDate(a.date) }}</span>
            </div>
            <div class="cr-legend">
              <span><i class="sw sw-t"></i>{{ tx('الواردة', 'Received') }}</span>
              <span><i class="sw sw-r"></i>{{ tx('المحلولة', 'Resolved') }}</span>
              <span class="cr-peak">{{ tx('الأعلى في يوم', 'Peak day') }}: {{ series.max }}</span>
            </div>
          </section>

          <section class="cr-card">
            <h4 class="cr-h">{{ tx('توزيع الحالات', 'By status') }}</h4>
            <div class="cr-donut-wrap">
              <svg class="cr-donut" viewBox="0 0 140 140" role="img">
                <circle cx="70" cy="70" r="54" class="cr-ring" />
                <circle v-for="a in donut.arcs" :key="a.key" cx="70" cy="70" r="54"
                        :stroke="a.color" :stroke-dasharray="`${a.len} ${2 * Math.PI * 54}`"
                        :stroke-dashoffset="a.off" class="cr-arc" />
                <text x="70" y="66" class="cr-donut-n">{{ donut.total }}</text>
                <text x="70" y="86" class="cr-donut-c">{{ tx('شكوى', 'total') }}</text>
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
          </section>
        </div>

        <!-- الفئة والفرع: ما الذي يتكرّر، وأين -->
        <div class="cr-grid">
          <section class="cr-card">
            <h4 class="cr-h">{{ tx('أكثر أنواع الشكاوى', 'Top complaint types') }}</h4>
            <div v-for="r in catRows" :key="r.key" class="cr-row">
              <span class="cr-row-l">{{ complaintCategoryLabel(r.key) }}</span>
              <span class="cr-row-t"><i :style="{ inlineSize: (r.count / maxOf(catRows)) * 100 + '%' }"></i></span>
              <span class="cr-row-v">{{ r.count }}</span>
            </div>
          </section>

          <section class="cr-card">
            <h4 class="cr-h">{{ tx('الشكاوى حسب الفرع', 'By branch') }}</h4>
            <div v-for="r in branchRows" :key="String(r.branchId)" class="cr-row">
              <span class="cr-row-l">{{ branchName(r) }}</span>
              <span class="cr-row-t"><i :style="{ inlineSize: (r.count / maxOf(branchRows)) * 100 + '%' }"></i></span>
              <span class="cr-row-v">{{ r.count }}</span>
            </div>
          </section>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.cr { padding: 4px 0 12px; }

/* ── شريط المدى ── */
.cr-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 14px; }
.cr-f { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #64748b); }
.cr-f input {
  padding: 7px 10px; border: 1px solid var(--border, #e5e7eb); border-radius: var(--radius-sm, 6px);
  background: var(--bg-card, #fff); color: var(--text-primary, #1f2937); font-family: inherit; font-size: 12.5px;
}
.cr-warn { font-size: 11px; font-weight: 700; color: var(--warning, #b45309); align-self: center; }
.cr-empty { text-align: center; padding: 34px; font-weight: 600; color: var(--text-muted, #94a3b8); }

/* ── المؤشّرات ── */
.cr-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px; }
.cr-kpi {
  padding: 12px 14px; border-radius: var(--radius, 10px);
  border: 1px solid var(--border, #e5e7eb); background: var(--bg-card, #fff);
  /* الشريط الجانبيّ منطقيّ فينقلب مع الاتجاه */
  border-inline-start: 3px solid var(--text-muted, #94a3b8);
}
.cr-kpi.t-good { border-inline-start-color: var(--success, #16a34a); }
.cr-kpi.t-warn { border-inline-start-color: var(--warning, #f59e0b); }
.cr-kpi-v { font-size: 22px; font-weight: 800; line-height: 1.15; color: var(--text-primary, #1f2937); }
.cr-kpi-l { margin-top: 2px; font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #64748b); }

/* ── البطاقات ── */
.cr-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px; }
@media (min-width: 900px) { .cr-grid { grid-template-columns: 1.6fr 1fr; } }
.cr-card { padding: 14px; border: 1px solid var(--border, #e5e7eb); border-radius: var(--radius, 10px); background: var(--bg-card, #fff); min-width: 0; }
.cr-h { margin: 0 0 12px; font-size: 13px; font-weight: 800; color: var(--text-primary, #1f2937); }

/* ── المنحنى اليوميّ ── */
.cr-svg { inline-size: 100%; block-size: 180px; display: block; overflow: visible; }
.cr-axis { stroke: var(--border, #e5e7eb); stroke-width: 1; }
.cr-bar-t { fill: var(--primary, #2563eb); opacity: 0.28; }
.cr-bar-r { fill: var(--success, #16a34a); opacity: 0.85; }
.cr-axis-x { display: flex; justify-content: space-between; margin-top: 4px; font-size: 10.5px; font-weight: 700; color: var(--text-muted, #94a3b8); }
.cr-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 11px; font-weight: 700; color: var(--text-secondary, #64748b); }
.cr-legend span { display: inline-flex; align-items: center; gap: 5px; }
.cr-peak { margin-inline-start: auto; }
.sw { inline-size: 10px; block-size: 10px; border-radius: 3px; display: inline-block; flex: 0 0 auto; }
.sw-t { background: var(--primary, #2563eb); opacity: 0.35; }
.sw-r { background: var(--success, #16a34a); }

/* ── الحلقة ── */
.cr-donut-wrap { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.cr-donut { inline-size: 140px; block-size: 140px; flex: 0 0 auto; transform: rotate(-90deg); }
.cr-ring { fill: none; stroke: var(--border-light, #f3f4f6); stroke-width: 16; }
.cr-arc { fill: none; stroke-width: 16; }
/* النصّ يعود لوضعه: الحلقة مُدارةٌ ٩٠° لتبدأ من الأعلى، والرقم لا يُدار معها */
.cr-donut-n, .cr-donut-c { text-anchor: middle; transform: rotate(90deg); transform-origin: 70px 70px; }
.cr-donut-n { font-size: 22px; font-weight: 800; fill: var(--text-primary, #1f2937); }
.cr-donut-c { font-size: 10px; font-weight: 700; fill: var(--text-muted, #94a3b8); }
.cr-slist { list-style: none; margin: 0; padding: 0; flex: 1; min-inline-size: 150px; }
.cr-slist li { display: flex; align-items: center; gap: 7px; padding: 4px 0; font-size: 12px; font-weight: 700; }
.cr-sname { flex: 1; color: var(--text-secondary, #64748b); }
.cr-sval { color: var(--text-primary, #1f2937); }
.cr-spct { inline-size: 38px; text-align: end; font-size: 11px; color: var(--text-muted, #94a3b8); }

/* ── الصفوف المرتَّبة ── */
.cr-row { display: flex; align-items: center; gap: 9px; padding: 5px 0; font-size: 12.5px; }
.cr-row-l { inline-size: 34%; font-weight: 700; color: var(--text-secondary, #64748b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cr-row-t { flex: 1; block-size: 9px; border-radius: 999px; background: var(--border-light, #f3f4f6); overflow: hidden; }
.cr-row-t i { display: block; block-size: 100%; background: var(--primary, #2563eb); border-radius: 999px; }
.cr-row-v { inline-size: 42px; text-align: end; font-weight: 800; color: var(--text-primary, #1f2937); }

/* الوضع الليليّ لهذه الشاشة في `style.css` العامّ لا هنا: `:global(X) Y` في هذا
   البناء يُترجَم إلى `X` **عارياً** — أي `body.dark-mode { background: … }`،
   فيُطلى لوحُ الصفحة كلِّه بلون البطاقة. القاعدة تُكتَب هناك مرّةً وتعمل. */
</style>
