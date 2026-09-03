<script setup lang="ts">
// تقارير تشغيل مركز الاتصال: الوكلاء · أوقات الذروة · الفروع.
// تُكمِّل تقريرَ الشكاوى ولا تكرّره: ذاك يقيس ما ساء، وهذا يقيس ما أُنجز.
//
// الأنماط `cr-*` عامّةٌ في `style.css` — تشترك فيها شاشتا التقارير فتُقرآن كنظامٍ واحد،
// ولا تُنسَخ مرّتين فتنحرفا.
import { computed, onMounted } from 'vue'
import { state, loadCcReport, canViewCcReports } from '../store'
import { formatCurrency } from '../utils'
import { tx, lang } from '../lang'
import { icon } from '../icons'

const rep = computed<any>(() => state.ccReport)

// «الأفضل» يتبع المعنى لا إشارةَ الرقم: طلباتٌ أكثر خيرٌ، وإلغاءٌ أقلّ خيرٌ.
function delta(now: number | null, before: number | null, higherIsBetter = true) {
  if (now == null || before == null || !before) return null
  const pct = Math.round(((now - before) / before) * 100)
  if (pct === 0) return { pct, dir: 0, good: true }
  return { pct, dir: pct > 0 ? 1 : -1, good: higherIsBetter ? pct > 0 : pct < 0 }
}
const dOrders = computed(() => delta(rep.value?.total ?? null, rep.value?.prev?.total ?? null))
const dSales = computed(() => delta(rep.value?.sales ?? null, rep.value?.prev?.sales ?? null))

const kpis = computed(() => {
  const r = rep.value
  if (!r) return []
  return [
    { k: 'orders', label: tx('عدد الطلبات', 'Orders'), value: String(r.total), tone: 'brand', ico: 'clipboard-list' },
    { k: 'sales', label: tx('إجمالي المبيعات', 'Total sales'), value: formatCurrency(r.sales), tone: 'green', ico: 'banknote' },
    // متوسّطُ قيمة الطلب على غير الملغيّ — الملغيّ ليس بيعاً
    { k: 'aov', label: tx('متوسّط قيمة الطلب', 'Avg. order value'), value: formatCurrency(r.aov), tone: 'violet', ico: 'shopping-cart' },
    { k: 'cancel', label: tx('نسبة الإلغاء', 'Cancellation rate'), value: r.cancelRate + '%', tone: r.cancelRate > 10 ? 'rose' : 'amber', ico: 'ban' },
    { k: 'edited', label: tx('طلبات عُدِّلت', 'Edited orders'), value: String(r.edited), tone: 'amber', ico: 'edit' },
  ]
})

// ── أوقات الذروة: قرارُ التغطية يُبنى عليها لا على الإجماليّ اليوميّ ─────────
const HW = 760, HH = 190
const HP = { t: 14, r: 12, b: 26, l: 30 }
const hPlotW = HW - HP.l - HP.r, hPlotH = HH - HP.t - HP.b, hBase = HP.t + hPlotH
const hourMax = computed(() => Math.max(...(rep.value?.byHour || []).map((x: any) => x.orders), 1))
const hSlot = hPlotW / 24
const hBarW = Math.min(hSlot - 3, 22)
const hHeight = (v: number) => (v / hourMax.value) * hPlotH
const hX = (h: number) => HP.l + h * hSlot + (hSlot - hBarW) / 2
function hPath(h: number, v: number): string {
  const ht = hHeight(v)
  if (ht <= 0) return ''
  const r = Math.min(4, hBarW / 2, ht), x = hX(h), y = hBase - ht
  return `M${x} ${hBase} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + hBarW - r} Q${x + hBarW} ${y} ${x + hBarW} ${y + r} V${hBase} Z`
}
// ساعةُ الذروة تُسمّى صراحةً: الرسمُ يُري الشكل، والجملةُ تُعطي القرار
const peakHour = computed(() => {
  const rows = rep.value?.byHour || []
  let best = -1, bv = 0
  rows.forEach((x: any) => { if (x.orders > bv) { bv = x.orders; best = x.h } })
  return best < 0 ? null : { h: best, orders: bv }
})
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

// ── الوكلاء ─────────────────────────────────────────────────────────────────
const agents = computed<any[]>(() => (rep.value?.byAgent || []).filter((a: any) => a.orders > 0))
const maxAgentOrders = computed(() => Math.max(...agents.value.map((a) => a.orders), 1))
const agentName = (a: any) => a.name || tx('غير منسوب', 'Unattributed')

// ── خريطة الضغط: يومُ الأسبوع × الساعة ─────────────────────────────────────
// الذروةُ اليوميّة متوسّطٌ يخفي أن ضغط الخميس ليس كضغط الاثنين في الساعة نفسها،
// والتغطية تُجدوَل بالاثنين لا بالمتوسّط.
const DOW_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const heat = computed<number[][]>(() => (rep.value?.heat || []))
const heatMax = computed(() => Math.max(1, ...heat.value.flat()))
// تدرّجٌ بلونٍ واحد (لا قوس قزح): الشدّة تقول المقدار، والصفرُ يبقى سطحاً فارغاً
const heatBg = (v: number) => (v ? `rgba(99, 102, 241, ${0.12 + 0.88 * (v / heatMax.value)})` : 'transparent')
const heatFg = (v: number) => (v / heatMax.value > 0.55 ? '#fff' : 'var(--text-secondary, #64748b)')
const heatPeak = computed(() => {
  let best: any = null
  heat.value.forEach((row, d) => row.forEach((v, h) => { if (!best || v > best.v) best = { d, h, v } }))
  return best && best.v ? best : null
})

// ── الإلغاءات: النسبةُ تُنبّه، والسببُ يُدار ────────────────────────────────
const reasons = computed<any[]>(() => (rep.value?.cancelReasons || []).slice(0, 8))
const reasonMax = computed(() => Math.max(1, ...reasons.value.map((r: any) => r.count)))
const reasonLabel = (r: any) => (r.reason || tx('(بلا سبب مكتوب)', '(no reason given)'))
const cancelPeak = computed(() => {
  const rows = rep.value?.cancelByHour || []
  let best: any = null
  rows.forEach((x: any) => { if (!best || x.orders > best.orders) best = x })
  return best && best.orders ? best : null
})

const branches = computed<any[]>(() => (rep.value?.byBranch || []).slice(0, 8))
const maxBranch = computed(() => Math.max(...branches.value.map((b) => b.orders), 1))
const branchName = (r: any) =>
  (lang.value === 'en' ? (r.nameEn || r.name) : (r.name || r.nameEn)) || tx('بلا فرع', 'No branch')

onMounted(() => { if (!rep.value) void loadCcReport() })
</script>

<template>
  <section id="view-cc-reports" class="view active">
    <div class="orders-section">
      <div class="orders-header">
        <div>
          <h2 class="orders-title">{{ tx('تقارير مركز الاتصال', 'Call-center reports') }}</h2>
          <p class="dashboard-subtitle">
            {{ tx('أداء الوكلاء وأوقات الذروة والفروع', 'Agent performance, peak hours and branches') }}
          </p>
        </div>
      </div>

      <div v-if="!canViewCcReports()" class="cr-empty">
        {{ tx('لا تملك صلاحية عرض تقارير مركز الاتصال', 'You do not have permission to view call-center reports') }}
      </div>

      <div v-else class="cr">
        <div class="cr-bar">
          <label class="cr-f">
            <span>{{ tx('من', 'From') }}</span>
            <input type="date" v-model="state.ccReportFrom">
          </label>
          <label class="cr-f">
            <span>{{ tx('إلى', 'To') }}</span>
            <input type="date" v-model="state.ccReportTo">
          </label>
          <button class="btn btn-primary cr-go" :disabled="state.ccReportBusy" @click="loadCcReport()">
            {{ state.ccReportBusy ? tx('جارٍ التحميل…', 'Loading…') : tx('تطبيق', 'Apply') }}
          </button>
          <span v-if="rep?.sampled" class="cr-warn">
            {{ tx('المدى كبير — السلاسل على أحدث ٥٠٠٠ طلب', 'Wide range — series use the latest 5,000 orders') }}
          </span>
        </div>

        <p v-if="!rep && !state.ccReportBusy" class="cr-empty">{{ tx('اختر مدىً واضغط «تطبيق»', 'Pick a range and press “Apply”') }}</p>

        <template v-else-if="rep">
          <p v-if="!rep.total" class="cr-empty">{{ tx('لا طلبات في هذا المدى', 'No orders in this range') }}</p>

          <template v-else>
            <div class="cr-kpis">
              <div v-for="k in kpis" :key="k.k" class="cr-kpi">
                <span class="cr-chip" :class="'g-' + k.tone" v-html="icon(k.ico, { size: 22 })"></span>
                <span class="cr-kpi-b">
                  <span class="cr-kpi-l">{{ k.label }}</span>
                  <span class="cr-kpi-v">{{ k.value }}</span>
                  <span v-if="k.k === 'orders' && dOrders" class="cr-dlt" :class="dOrders.good ? 'up' : 'dn'">
                    {{ dOrders.dir > 0 ? '▲' : dOrders.dir < 0 ? '▼' : '=' }} {{ Math.abs(dOrders.pct) }}% {{ tx('عن السابق', 'vs prev.') }}
                  </span>
                  <span v-else-if="k.k === 'sales' && dSales" class="cr-dlt" :class="dSales.good ? 'up' : 'dn'">
                    {{ dSales.dir > 0 ? '▲' : dSales.dir < 0 ? '▼' : '=' }} {{ Math.abs(dSales.pct) }}% {{ tx('عن السابق', 'vs prev.') }}
                  </span>
                </span>
              </div>
            </div>

            <!-- أوقات الذروة: الرقم الذي تُبنى عليه التغطية -->
            <section class="cr-card">
              <div class="cr-head">
                <h3 class="cr-h">{{ tx('الطلبات على مدار اليوم', 'Orders through the day') }}</h3>
                <span v-if="peakHour" class="cr-peak-note">
                  {{ tx('الذروة', 'Peak') }} {{ hourLabel(peakHour.h) }} — {{ peakHour.orders }} {{ tx('طلب', 'orders') }}
                </span>
              </div>
              <svg class="cr-svg" :viewBox="`0 0 ${HW} ${HH}`" role="img"
                   :aria-label="tx('عدد الطلبات لكل ساعة من اليوم', 'Orders per hour of day')">
                <line :x1="HP.l" :y1="hBase" :x2="HW - HP.r" :y2="hBase" class="cr-axis" />
                <text :x="HP.l - 6" :y="HP.t + 4" class="cr-htick">{{ hourMax }}</text>
                <g v-for="x in (rep.byHour || [])" :key="x.h">
                  <title>{{ hourLabel(x.h) }} — {{ x.orders }}</title>
                  <path :d="hPath(x.h, x.orders)" class="cr-b-t" :class="{ pk: peakHour && x.h === peakHour.h }" />
                </g>
                <g class="cr-xlab">
                  <text v-for="h in [0, 6, 12, 18, 23]" :key="'h' + h" :x="hX(h) + hBarW / 2" :y="hBase + 16">{{ hourLabel(h) }}</text>
                </g>
              </svg>
            </section>

            <!-- الوكلاء: العدد والمبيعات والجودة في صفٍّ واحد -->
            <section class="cr-card">
              <h3 class="cr-h">{{ tx('أداء الوكلاء', 'Agent performance') }}</h3>
              <div class="cr-th">
                <span class="ag-n">{{ tx('الوكيل', 'Agent') }}</span>
                <span class="ag-bar"></span>
                <span class="ag-c">{{ tx('طلبات', 'Orders') }}</span>
                <span class="ag-s">{{ tx('مبيعات', 'Sales') }}</span>
                <span class="ag-a">{{ tx('متوسّط الطلب', 'AOV') }}</span>
                <span class="ag-x">{{ tx('إلغاء', 'Cancels') }}</span>
                <span class="ag-x">{{ tx('تعديل', 'Edits') }}</span>
                <span class="ag-x">{{ tx('بلا فرع', 'Held') }}</span>
                <span class="ag-s">{{ tx('خصومات', 'Discounts') }}</span>
                <span class="ag-x">{{ tx('شكاوى', 'Complaints') }}</span>
              </div>
              <div v-for="a in agents" :key="String(a.agentId)" class="cr-row ag-row">
                <span class="ag-n">{{ agentName(a) }}</span>
                <span class="ag-bar"><i :style="{ inlineSize: (a.orders / maxAgentOrders) * 100 + '%' }"></i></span>
                <span class="ag-c">{{ a.orders }}</span>
                <span class="ag-s">{{ formatCurrency(a.sales) }}</span>
                <span class="ag-a">{{ formatCurrency(a.aov) }}</span>
                <!-- الإلغاء بالنسبة لا بالعدد: وكيلٌ بمئة طلبٍ وخمسِ إلغاءات أفضل من وكيلٍ بعشرةٍ وثلاث -->
                <span class="ag-x" :class="{ bad: a.cancelRate > 10 }">{{ a.cancelled }} <em>({{ a.cancelRate }}%)</em></span>
                <!-- رَجْعُ العمل: تعديلٌ بعد الإرسال، وطلبٌ وقف بلا فرع. عددٌ صغيرٌ
                     طبيعيّ، وكثرتُه عند وكيلٍ بعينه تدريبٌ لا عقوبة. -->
                <span class="ag-x">{{ a.edited || 0 }}</span>
                <span class="ag-x" :class="{ bad: (a.held || 0) > 0 }">{{ a.held || 0 }}</span>
                <span class="ag-s">{{ formatCurrency(a.discount || 0) }}</span>
                <span class="ag-x" :class="{ bad: a.complaints > 0 }">{{ a.complaints }}</span>
              </div>
              <p class="cr-foot">
                {{ tx('الشكاوى محسوبة على طلبات الوكيل نفسه لا على من كتب الشكوى. و«بلا فرع» طلبٌ لم يصل أيَّ فرع فوقف — أخطرُ من الإلغاء لأن أحداً لا يعلم به.', 'Complaints are counted against the agent who took the order, not whoever logged it. “Held” means the order reached no branch at all — worse than a cancellation, because nobody knows about it.') }}
              </p>
            </section>

            <!-- خريطة الضغط: الجدولةُ تُبنى عليها لا على المتوسّط -->
            <section class="cr-card">
              <div class="cr-head">
                <h3 class="cr-h">{{ tx('خريطة الضغط — اليوم × الساعة', 'Pressure map — day × hour') }}</h3>
                <span v-if="heatPeak" class="cr-peak-note">
                  {{ tx('الأشدّ', 'Busiest') }}: {{ tx(DOW_AR[heatPeak.d], DOW_EN[heatPeak.d]) }} {{ hourLabel(heatPeak.h) }} — {{ heatPeak.v }}
                </span>
              </div>
              <div class="hm">
                <div class="hm-row hm-head">
                  <span class="hm-d"></span>
                  <span v-for="h in 24" :key="'hh' + h" class="hm-c hm-lab">{{ (h - 1) % 3 === 0 ? (h - 1) : '' }}</span>
                </div>
                <div v-for="(row, d) in heat" :key="'d' + d" class="hm-row">
                  <span class="hm-d">{{ tx(DOW_AR[d], DOW_EN[d]) }}</span>
                  <span v-for="(v, h) in row" :key="'c' + d + '-' + h" class="hm-c"
                        :style="{ background: heatBg(v), color: heatFg(v) }"
                        :title="`${tx(DOW_AR[d], DOW_EN[d])} ${hourLabel(h)} — ${v}`">{{ v || '' }}</span>
                </div>
              </div>
            </section>

            <!-- الإلغاءات: النسبةُ تُنبّه، والسببُ يُدار -->
            <section class="cr-card">
              <div class="cr-head">
                <h3 class="cr-h">{{ tx('الإلغاءات وأسبابها', 'Cancellations and reasons') }}</h3>
                <span v-if="cancelPeak" class="cr-peak-note">
                  {{ tx('أكثرها في', 'Most at') }} {{ hourLabel(cancelPeak.h) }} — {{ cancelPeak.orders }}
                </span>
              </div>
              <p v-if="!reasons.length" class="cr-foot">{{ tx('لا إلغاءات في هذا المدى', 'No cancellations in this range') }}</p>
              <div v-for="(r, k) in reasons" :key="k" class="cr-row">
                <span class="cr-row-l">{{ reasonLabel(r) }}</span>
                <span class="cr-row-t"><i :style="{ inlineSize: (r.count / reasonMax) * 100 + '%' }"></i></span>
                <span class="cr-row-v">{{ r.count }}</span>
              </div>
              <p v-if="reasons.length" class="cr-foot">{{ tx('«بلا سبب مكتوب» معلومةٌ بذاتها: إلغاءٌ لا يُدرَس، وكثرتُه مسألةُ انضباطٍ لا تشغيل.', '“No reason given” is itself a finding: such cancellations cannot be studied, and many of them is a discipline issue, not an operations one.') }}</p>
            </section>

            <section class="cr-card">
              <h3 class="cr-h">{{ tx('الطلبات حسب الفرع', 'Orders by branch') }}</h3>
              <div v-for="b in branches" :key="String(b.branchId)" class="cr-row">
                <span class="cr-row-l">{{ branchName(b) }}</span>
                <span class="cr-row-t"><i :style="{ inlineSize: (b.orders / maxBranch) * 100 + '%' }"></i></span>
                <span class="cr-row-v">{{ b.orders }}</span>
                <span class="cr-row-x">{{ formatCurrency(b.sales) }}</span>
              </div>
            </section>
          </template>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* جدول الوكلاء وحده يخصّ هذه الشاشة — باقي الأنماط `cr-*` عامّة في `style.css` */
.cr-th {
  display: flex; align-items: center; gap: 10px; padding: 0 12px 8px;
  font-size: 10.5px; font-weight: 800; color: var(--text-muted, #94a3b8);
}
.ag-row { gap: 10px; }
.ag-n { inline-size: 21%; font-weight: 700; color: var(--text-primary, #1f2937); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ag-bar { flex: 1; block-size: 8px; border-radius: 4px; background: rgba(148, 163, 184, .22); overflow: hidden; min-inline-size: 40px; }
.ag-bar i { display: block; block-size: 100%; background: linear-gradient(90deg, #6366f1, #7c3aed); border-radius: 4px; }
.ag-c { inline-size: 52px; text-align: end; font-weight: 800; font-variant-numeric: tabular-nums; }
.ag-s, .ag-a { inline-size: 92px; text-align: end; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-secondary, #64748b); }
.ag-x { inline-size: 78px; text-align: end; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-secondary, #64748b); }
.ag-x em { font-style: normal; font-size: 10.5px; opacity: .8; }
.ag-x.bad { color: #b91c1c; }
/* خريطة الضغط: شبكةٌ تمرّر أفقيّاً على الشاشات الضيّقة بدل أن تنكمش خلاياها */
.hm { overflow-x: auto; padding-block-end: 4px; }
.hm-row { display: flex; gap: 2px; margin-bottom: 2px; align-items: center; }
.hm-d { inline-size: 62px; flex: 0 0 auto; font-size: 11px; font-weight: 700; color: var(--text-secondary, #64748b); }
.hm-c {
  inline-size: 26px; block-size: 22px; flex: 0 0 auto; border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums;
  background: rgba(148, 163, 184, .1);
}
.hm-head .hm-c { background: transparent; }
.hm-lab { color: var(--text-muted, #94a3b8); font-size: 9.5px; }

.cr-peak-note { font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #64748b); }
.cr-htick { font-size: 10px; font-weight: 700; fill: var(--text-muted, #94a3b8); text-anchor: end; }
.cr-b-t.pk { fill: #7c3aed; }
</style>
