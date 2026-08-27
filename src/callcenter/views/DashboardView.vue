<script setup lang="ts">
import { computed } from 'vue'
import { state, startNewOrder } from '../store'
import { lang } from '../lang'
import { formatCurrency } from '../utils'
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
  { key: 'delivered', ar: 'تم التوصيل', en: 'Delivered', color: '#16a34a' },
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

// اختصارات صغيرة (حسب الصلاحية)
const shortcuts = computed(() => [
  { show: canOrders.value, view: 'new-order', label: ar.value ? 'طلب جديد' : 'New order', svg: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>' },
  { show: can('callcenter.view'), view: 'orders', label: ar.value ? 'طلبات التوصيل' : 'Delivery', svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
  { show: can('callcenter.users'), view: 'users', label: ar.value ? 'المستخدمون' : 'Users', svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { show: can('callcenter.manage') || can('callcenter.open') || can('callcenter.close'), view: 'settings', label: ar.value ? 'الإعدادات' : 'Settings', svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
].filter((s) => s.show))
</script>

<template>
  <div class="cc-dash">
    <!-- ترويسة -->
    <div class="dash-head">
      <div>
        <div class="dash-title">{{ ar ? 'مرحباً،' : 'Welcome,' }} {{ session.name }}</div>
        <div class="dash-sub">{{ coName(cur) }}<template v-if="curFr"> — {{ coName(curFr) }}</template></div>
      </div>
    </div>

    <!-- اختصارات صغيرة -->
    <div v-if="shortcuts.length" class="sc-row">
      <button v-for="s in shortcuts" :key="s.view" class="sc" @click="go(s.view)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="s.svg" />
        <span>{{ s.label }}</span>
      </button>
    </div>

    <!-- ملخص التقارير -->
    <div class="sec-label">{{ ar ? 'ملخص التقارير' : 'Reports summary' }}</div>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-n">{{ kpis.count }}</div>
        <div class="kpi-l">{{ ar ? 'إجمالي الطلبات' : 'Total orders' }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-n">{{ formatCurrency(kpis.sales) }}</div>
        <div class="kpi-l">{{ ar ? 'إجمالي المبيعات' : 'Total sales' }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-n">{{ kpis.delivery }}</div>
        <div class="kpi-l">{{ ar ? 'طلبات توصيل' : 'Delivery orders' }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-n">{{ kpis.pickup }}</div>
        <div class="kpi-l">{{ ar ? 'طلبات استلام' : 'Pickup orders' }}</div>
      </div>
    </div>

    <!-- حسب الحالة -->
    <div class="sec-label">{{ ar ? 'الطلبات حسب الحالة' : 'Orders by status' }}</div>
    <div class="status-row">
      <div v-for="s in byStatus" :key="s.key" class="st">
        <span class="st-dot" :style="{ background: s.color }"></span>
        <span class="st-n">{{ s.n }}</span>
        <span class="st-l">{{ ar ? s.ar : s.en }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc-dash { padding: 22px 26px; max-width: 1100px; }
.dash-head { margin-bottom: 18px; }
.dash-title { font-size: 20px; font-weight: 800; color: var(--text-primary, #0f172a); letter-spacing: -0.3px; }
.dash-sub { font-size: 13px; color: var(--text-secondary, #64748b); margin-top: 3px; }

/* اختصارات صغيرة */
.sc-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
.sc {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 13px; border-radius: 10px;
  background: var(--surface, #fff); border: 1px solid var(--border, #e2e8f0);
  color: var(--text-primary, #0f172a); font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.15s ease;
}
.sc:hover { border-color: var(--primary, #4f46e5); color: var(--primary, #4f46e5); transform: translateY(-1px); }
.sc svg { flex-shrink: 0; }

.sec-label { font-size: 12.5px; font-weight: 700; color: var(--text-secondary, #64748b); margin: 0 0 10px; text-transform: none; }

/* KPIs */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
.kpi {
  background: var(--surface, #fff); border: 1px solid var(--border, #e2e8f0);
  border-radius: 14px; padding: 16px 18px;
}
.kpi-n { font-size: 22px; font-weight: 800; color: var(--primary, #4f46e5); letter-spacing: -0.5px; }
.kpi-l { font-size: 12.5px; color: var(--text-secondary, #64748b); margin-top: 4px; }

/* الحالة */
.status-row { display: flex; flex-wrap: wrap; gap: 10px; }
.st {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--surface, #fff); border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px; padding: 10px 14px;
}
.st-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.st-n { font-size: 16px; font-weight: 800; color: var(--text-primary, #0f172a); }
.st-l { font-size: 12.5px; color: var(--text-secondary, #64748b); }

:global(body.dark-mode) .kpi,
:global(body.dark-mode) .sc,
:global(body.dark-mode) .st { background: rgba(255,255,255,0.04); }
</style>
