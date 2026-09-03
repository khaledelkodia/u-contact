<script setup lang="ts">
import { computed } from 'vue'
import { state, startNewOrder, viewOrderDetail } from '../store'
import { lang, nameOf } from '../lang'
import { formatCurrency, formatTxnClock } from '../utils'
import { icon } from '../icons'
import { ORDER_STATUSES } from '../data'
import { session, currentCompany, currentFranchise } from '../../api'

const ar = computed(() => lang.value === 'ar')
const cur = computed(() => currentCompany())
const curFr = computed(() => currentFranchise())
const coName = (c: any) => (ar.value ? (c?.nameAr || c?.name) : (c?.name || c?.nameAr))
const can = (p: string) => !!cur.value?.permissions?.includes(p)
const canOrders = computed(() => can('callcenter.view') || can('callcenter.create') || can('callcenter.edit'))

function go(v: string) { if (v === 'new-order') { startNewOrder(); return } state.activeView = v }

// ── ملخص التقارير (من طلبات الفرع) ──
const orders = computed<any[]>(() => state.orders || [])
const STAT = [
  { key: 'delivered', ar: 'مغلق', en: 'Closed', color: '#16a34a' },
  { key: 'onway', ar: 'في الطريق', en: 'On the way', color: '#2563eb' },
  { key: 'preparing', ar: 'قيد التحضير', en: 'Preparing', color: '#d97706' },
  { key: 'ready', ar: 'جاهز', en: 'Ready', color: '#7c3aed' },
]
const kpis = computed(() => {
  const l = orders.value
  return {
    count: l.length,
    sales: l.reduce((s, o) => s + (Number(o.total) || 0), 0),
    delivery: l.filter((o) => o.type === 'delivery').length,
    pickup: l.filter((o) => o.type === 'pickup').length,
  }
})
const byStatus = computed(() => STAT.map((s) => ({ ...s, n: orders.value.filter((o) => o.status === s.key).length })))

/**
 * نصيبُ كل حالة من الإجمالي — شريطٌ يُقرأ بالنظرة بدل رقمٍ مجرّد.
 * محسوبٌ من الطلبات نفسها؛ وبلا طلباتٍ يبقى صفراً فلا يُرسَم شريطٌ كاذب.
 */
const statusShare = (n: number) => {
  const total = orders.value.length
  return total ? Math.round((n / total) * 100) : 0
}

/** متوسّط قيمة الطلب — مشتقٌّ ممّا لدينا، لا بيانٌ جديد يُطلب من الخادم. */
const avgTicket = computed(() => (kpis.value.count ? kpis.value.sales / kpis.value.count : 0))

/**
 * آخر الطلبات — الصفحة كانت تنتهي بعد الحبّات فيبقى ثلثاها فراغاً، والوكيل يفتح
 * شاشةً أخرى ليرى ما جرى للتوّ. هذه من `state.orders` نفسها: بلا نداءٍ إضافيّ.
 */
const latest = computed<any[]>(() => orders.value.slice(0, 8))

const statusOf = (id: string) => ORDER_STATUSES.find((s: any) => s.id === id) || null
const statusName = (id: string) => { const s = statusOf(id); return s ? nameOf(s) : id }
const statusColor = (id: string) => statusOf(id)?.color || '#94a3b8'

function openOrder(o: any) {
  state.activeView = 'orders'
  void viewOrderDetail(o.id)
}

// اختصارات صغيرة (حسب الصلاحية)
const shortcuts = computed(() => [
  { show: canOrders.value, view: 'new-order', label: ar.value ? 'طلب جديد' : 'New order', primary: true, svg: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>' },
  { show: can('callcenter.view'), view: 'orders', label: ar.value ? 'طلبات التوصيل' : 'Delivery', primary: false, svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
  { show: can('callcenter.users'), view: 'users', label: ar.value ? 'المستخدمون' : 'Users', primary: false, svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { show: can('callcenter.settings') || can('callcenter.manage') || can('callcenter.open') || can('callcenter.close'), view: 'settings', label: ar.value ? 'الإعدادات' : 'Settings', primary: false, svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
].filter((s) => s.show))
</script>

<template>
  <!-- ── لوحة الوكيل ──────────────────────────────────────────────────────────
       كانت محبوسةً في 1100px فتترك ثلث الشاشة العريضة بياضاً، وتنتهي بعد أربع
       حبّاتٍ صغيرة فيبقى أسفلها فراغٌ كامل. صارت تملأ العرض بشبكةٍ تتنفّس، وتنتهي
       بآخر الطلبات — ممّا في المتجر أصلاً، بلا نداءٍ إضافيّ ولا رقمٍ مُختلَق. -->
  <div class="cc-dash">
    <!-- الترويسة: تحيّةٌ وهويّةٌ ثم الأفعال — في صفٍّ واحدٍ على العريض -->
    <header class="dash-hero">
      <div class="hero-id">
        <div class="hero-avatar">{{ (session.name || '?').trim().charAt(0) }}</div>
        <div class="hero-txt">
          <h1 class="dash-title">{{ ar ? 'مرحباً،' : 'Welcome,' }} {{ session.name }}</h1>
          <div class="dash-sub">
            <span>{{ coName(cur) }}</span>
            <template v-if="curFr"><span class="hero-dot">·</span><span>{{ coName(curFr) }}</span></template>
          </div>
        </div>
      </div>

      <div v-if="shortcuts.length" class="sc-row">
        <button v-for="s in shortcuts" :key="s.view" class="sc" :class="{ 'sc-primary': s.primary }" @click="go(s.view)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="s.svg" />
          <span>{{ s.label }}</span>
        </button>
      </div>
    </header>

    <!-- ملخص التقارير: المبيعات هي العنوان فتأخذ بطاقةً أوسع وأبرز -->
    <div class="sec-label">{{ ar ? 'ملخص التقارير' : 'Reports summary' }}</div>
    <div class="kpi-grid">
      <div class="kpi kpi-hero">
        <div class="kpi-top">
          <span class="kpi-ico" v-html="icon('banknote', { size: 18 })"></span>
          <span class="kpi-l">{{ ar ? 'إجمالي المبيعات' : 'Total sales' }}</span>
        </div>
        <div class="kpi-n">{{ formatCurrency(kpis.sales) }}</div>
        <!-- متوسّط الطلب: مشتقٌّ ممّا فوقه، فيقرأ الرقم الكبير معناه لا حجمه -->
        <div v-if="kpis.count" class="kpi-foot">
          {{ ar ? 'متوسّط الطلب' : 'Avg. order' }} <strong>{{ formatCurrency(avgTicket) }}</strong>
        </div>
      </div>

      <div class="kpi" style="--accent:#2563eb">
        <div class="kpi-top">
          <span class="kpi-ico" v-html="icon('clipboard-list', { size: 18 })"></span>
          <span class="kpi-l">{{ ar ? 'إجمالي الطلبات' : 'Total orders' }}</span>
        </div>
        <div class="kpi-n">{{ kpis.count }}</div>
      </div>

      <div class="kpi" style="--accent:#0ea5e9">
        <div class="kpi-top">
          <span class="kpi-ico" v-html="icon('bike', { size: 18 })"></span>
          <span class="kpi-l">{{ ar ? 'طلبات توصيل' : 'Delivery orders' }}</span>
        </div>
        <div class="kpi-n">{{ kpis.delivery }}</div>
      </div>

      <div class="kpi" style="--accent:#f59e0b">
        <div class="kpi-top">
          <span class="kpi-ico" v-html="icon('store', { size: 18 })"></span>
          <span class="kpi-l">{{ ar ? 'طلبات استلام' : 'Pickup orders' }}</span>
        </div>
        <div class="kpi-n">{{ kpis.pickup }}</div>
      </div>
    </div>

    <!-- الجسم: الحالات عمودٌ جانبيّ وآخر الطلبات عمودٌ يتمدّد -->
    <div class="dash-body">
      <section class="panel">
        <div class="panel-head">
          <span class="sec-label">{{ ar ? 'الطلبات حسب الحالة' : 'Orders by status' }}</span>
        </div>
        <div class="status-list">
          <div v-for="s in byStatus" :key="s.key" class="st">
            <div class="st-row">
              <span class="st-dot" :style="{ background: s.color }"></span>
              <span class="st-l">{{ ar ? s.ar : s.en }}</span>
              <span class="st-n">{{ s.n }}</span>
            </div>
            <!-- الشريط نصيبُ الحالة من الإجمالي — لا مقياسَ مطلقاً يوهم بحجم -->
            <div class="st-bar"><i :style="{ width: statusShare(s.n) + '%', background: s.color }"></i></div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <span class="sec-label">{{ ar ? 'آخر الطلبات' : 'Latest orders' }}</span>
          <button v-if="can('callcenter.view') && latest.length" class="panel-more" @click="go('orders')">
            {{ ar ? 'الكل' : 'All' }}
          </button>
        </div>

        <div v-if="!latest.length" class="dash-empty">
          <span v-html="icon('clipboard-list', { size: 26 })"></span>
          <p>{{ ar ? 'لا توجد طلبات بعد' : 'No orders yet' }}</p>
        </div>

        <ul v-else class="lo-list">
          <li v-for="o in latest" :key="o.id" class="lo" @click="openOrder(o)">
            <span class="lo-no">#{{ o.dailyNo }}</span>
            <span class="lo-main">
              <span class="lo-name">{{ o.customerName || (ar ? 'عميل' : 'Customer') }}</span>
              <span class="lo-meta">
                <span v-html="icon(o.type === 'pickup' ? 'store' : 'bike', { size: 12 })"></span>
                <span>{{ o.branchName || '—' }}</span>
                <template v-if="o.createdAt"><span class="lo-sep">·</span><span>{{ formatTxnClock(o.createdAt) }}</span></template>
              </span>
            </span>
            <span class="lo-status" :style="{ color: statusColor(o.status), background: statusColor(o.status) + '1f' }">
              {{ statusName(o.status) }}
            </span>
            <span class="lo-total">{{ formatCurrency(o.total) }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* العرض كلّه: سقفٌ سخيٌّ يمنع امتداد السطر بلا حدٍّ على شاشةٍ فائقة، ولا يترك
   ثلث الشاشة بياضاً كما كان سقفُ 1100px. */
.cc-dash {
  padding: 22px 26px 32px; max-width: 1720px; margin-inline: auto;
  /* القياس على عرض اللوحة لا الشاشة: الشريط الجانبيّ يأكل جزءاً منها، فاستعلامُ
     الشاشة يَعِد بعرضٍ ليس للمحتوى. */
  container: dash / inline-size;
}

/* ── الترويسة ── */
.dash-hero {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 16px; margin-bottom: 22px; padding: 18px 20px;
  border-radius: 18px;
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%);
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.22);
  color: #fff;
}
.hero-id { display: flex; align-items: center; gap: 14px; min-width: 0; }
.hero-avatar {
  width: 46px; height: 46px; border-radius: 14px; flex-shrink: 0;
  display: grid; place-items: center;
  background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.28);
  font-size: 20px; font-weight: 800; color: #fff;
}
.hero-txt { min-width: 0; }
.dash-title { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -0.3px; color: #fff; }
.dash-sub { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 13px; margin-top: 3px; color: rgba(255, 255, 255, 0.85); }
.hero-dot { opacity: 0.6; }

/* أزرار الترويسة: بيضاء على الأزرق — والأوّل ممتلئٌ فيُقرأ الفعل الأساسيّ أوّلاً */
.sc-row { display: flex; flex-wrap: wrap; gap: 8px; }
.sc {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 14px; border-radius: 11px;
  background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.28);
  color: #fff; font-size: 13px; font-weight: 700; font-family: inherit;
  cursor: pointer; transition: background 0.15s ease, transform 0.15s ease;
}
.sc:hover { background: rgba(255, 255, 255, 0.24); transform: translateY(-1px); }
.sc-primary { background: #fff; color: #1d4ed8; border-color: #fff; }
.sc-primary:hover { background: #eff6ff; }
.sc svg { flex-shrink: 0; }

.sec-label { font-size: 12.5px; font-weight: 700; color: var(--text-secondary, #64748b); }

/* ── الحبّات ── */
.kpi-grid {
  display: grid; gap: 14px; margin: 10px 0 22px;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
}
/* أربع بطاقاتٍ إحداها مزدوجة = خمس خانات: خمسةُ أعمدةٍ تعطي صفّاً واحداً بلا خانةٍ
   فارغة في آخره (auto-fit كانت تفتح ستّة على الشاشة العريضة). */
@container dash (min-width: 1200px) {
  .kpi-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}
.kpi {
  --accent: var(--primary, #1a56db);
  position: relative; overflow: hidden;
  background: var(--white, #fff); border: 1px solid var(--border, #e2e8f0);
  border-radius: 16px; padding: 16px 18px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.kpi:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }
/* شريطٌ علويٌّ بلون الحبّة — تمييزٌ بلا تلوين الخلفية كلّها */
.kpi::before { content: ''; position: absolute; inset-block-start: 0; inset-inline: 0; height: 3px; background: var(--accent); }
.kpi-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.kpi-ico { display: inline-flex; color: var(--accent); }
.kpi-l { font-size: 12.5px; font-weight: 600; color: var(--text-secondary, #64748b); }
.kpi-n { font-size: 26px; font-weight: 800; color: var(--text-primary, #0f172a); letter-spacing: -0.6px; line-height: 1.15; }

/* المبيعات: بطاقةٌ أوسع وأبرز — الرقم الذي يُسأل عنه أوّلاً */
.kpi-hero {
  --accent: #16a34a;
  grid-column: span 2;
  background: linear-gradient(135deg, #f0fdf4 0%, var(--white, #fff) 62%);
  border-color: #bbf7d0;
}
.kpi-hero .kpi-n { font-size: 32px; color: #15803d; }
.kpi-foot { margin-top: 8px; font-size: 12px; color: var(--text-secondary, #64748b); }
.kpi-foot strong { color: var(--text-primary, #0f172a); font-weight: 800; }

/* ── الجسم: عمودان ── */
.dash-body { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); align-items: start; }
@container dash (min-width: 1100px) {
  .dash-body { grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); }
}
.panel {
  background: var(--white, #fff); border: 1px solid var(--border, #e2e8f0);
  border-radius: 16px; padding: 16px 18px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.panel-more {
  background: none; border: none; padding: 0; cursor: pointer; font-family: inherit;
  font-size: 12.5px; font-weight: 700; color: var(--primary, #1a56db);
}
.panel-more:hover { text-decoration: underline; }

/* الحالات */
.status-list { display: flex; flex-direction: column; gap: 13px; }
.st-row { display: flex; align-items: center; gap: 8px; }
.st-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.st-l { font-size: 12.5px; color: var(--text-secondary, #64748b); flex: 1; min-width: 0; }
.st-n { font-size: 15px; font-weight: 800; color: var(--text-primary, #0f172a); font-variant-numeric: tabular-nums; }
.st-bar { margin-top: 6px; height: 6px; border-radius: 99px; background: var(--border-light, #f1f5f9); overflow: hidden; }
.st-bar i { display: block; height: 100%; border-radius: 99px; transition: width 0.35s ease; }

/* آخر الطلبات */
.lo-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.lo {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 6px; cursor: pointer; border-radius: 10px;
  transition: background 0.14s ease;
}
.lo + .lo { border-top: 1px solid var(--border-light, #f1f5f9); }
.lo:hover { background: var(--bg-soft, #f8fafc); }
.lo-no { font-size: 13px; font-weight: 800; color: var(--primary, #1a56db); min-width: 46px; font-variant-numeric: tabular-nums; }
.lo-main { flex: 1; min-width: 0; }
.lo-name { display: block; font-size: 13.5px; font-weight: 700; color: var(--text-primary, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lo-meta { display: flex; align-items: center; gap: 5px; margin-top: 2px; font-size: 11.5px; color: var(--text-muted, #94a3b8); }
.lo-meta :deep(svg) { width: 12px; height: 12px; }
.lo-sep { opacity: 0.6; }
.lo-status { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; white-space: nowrap; }
.lo-total { font-size: 13px; font-weight: 800; color: var(--text-primary, #0f172a); white-space: nowrap; font-variant-numeric: tabular-nums; }

.dash-empty { padding: 34px 10px; text-align: center; color: var(--text-muted, #94a3b8); }
.dash-empty p { margin: 8px 0 0; font-size: 13px; }

/* ── الوضع الليلي ── */
body.dark-mode .kpi,
body.dark-mode .panel { background: #1e293b; border-color: #334155; }
body.dark-mode .kpi-n,
body.dark-mode .st-n,
body.dark-mode .lo-name,
body.dark-mode .lo-total,
body.dark-mode .kpi-foot strong { color: #e2e8f0; }
body.dark-mode .kpi-hero { background: linear-gradient(135deg, #052e16 0%, #1e293b 62%); border-color: #166534; }
body.dark-mode .kpi-hero .kpi-n { color: #4ade80; }
body.dark-mode .st-bar { background: #334155; }
body.dark-mode .lo + .lo { border-top-color: #334155; }
body.dark-mode .lo:hover { background: rgba(255, 255, 255, 0.04); }
</style>
