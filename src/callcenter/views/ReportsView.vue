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
                <span class="ag-x" :class="{ bad: a.complaints > 0 }">{{ a.complaints }}</span>
              </div>
              <p class="cr-foot">
                {{ tx('الشكاوى محسوبة على طلبات الوكيل نفسه لا على من كتب الشكوى.', 'Complaints are counted against the agent who took the order, not whoever logged the complaint.') }}
              </p>
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
.cr-peak-note { font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #64748b); }
.cr-htick { font-size: 10px; font-weight: 700; fill: var(--text-muted, #94a3b8); text-anchor: end; }
.cr-b-t.pk { fill: #7c3aed; }
</style>
