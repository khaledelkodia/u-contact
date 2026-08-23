<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { agentReports, listCompanies } from '../../api'
import { t, isAr } from '../../i18n'
import Icon from '../../components/Icon.vue'

const rows = ref<any[]>([])
const companies = ref<any[]>([])
const loading = ref(true)
const err = ref('')
const filter = reactive<any>({ companyId: '', from: '', to: '' })

const money = (n: any) => Number(n || 0).toLocaleString(isAr() ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 })
const coName = (c: any) => (isAr() ? (c?.nameAr || c?.name) : (c?.name || c?.nameAr))

const totals = computed(() => ({
  agents: rows.value.length,
  orders: rows.value.reduce((s, r) => s + (r.orders || 0), 0),
  revenue: rows.value.reduce((s, r) => s + (r.revenue || 0), 0),
  complaints: rows.value.reduce((s, r) => s + (r.complaints || 0), 0),
}))

async function load() {
  loading.value = true; err.value = ''
  try { rows.value = await agentReports({ companyId: filter.companyId || undefined, from: filter.from || undefined, to: filter.to || undefined }) }
  catch (e: any) { err.value = e?.response?.data?.message || t('تعذّر التحميل', 'Failed to load') }
  finally { loading.value = false }
}
onMounted(async () => { companies.value = await listCompanies().catch(() => []); await load() })
</script>

<template>
  <div class="content">
    <div class="page-head">
      <div style="flex:1;"><div class="t">{{ t('تقارير الوكلاء', 'Agent reports') }}</div><div class="d">{{ t('أداء كل وكيل عبر كل الشركات', 'Each agent’s performance across all companies') }}</div></div>
    </div>

    <div class="stats">
      <div class="card stat"><div class="lbl"><Icon name="users" /> {{ t('الوكلاء', 'Agents') }}</div><div class="val">{{ totals.agents }}</div></div>
      <div class="card stat"><div class="lbl"><Icon name="ticket" /> {{ t('الأوردرات', 'Orders') }}</div><div class="val">{{ totals.orders }}</div></div>
      <div class="card stat"><div class="lbl"><Icon name="chart" /> {{ t('الإيراد', 'Revenue') }}</div><div class="val">{{ money(totals.revenue) }}</div></div>
      <div class="card stat"><div class="lbl"><Icon name="alert" /> {{ t('الشكاوى', 'Complaints') }}</div><div class="val">{{ totals.complaints }}</div></div>
    </div>

    <div class="card pad" style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-bottom:16px;">
      <div class="field" style="min-width:200px;"><label>{{ t('الشركة', 'Company') }}</label><select v-model="filter.companyId"><option value="">{{ t('كل الشركات', 'All companies') }}</option><option v-for="c in companies" :key="c.id" :value="c.id">{{ coName(c) }}</option></select></div>
      <div class="field"><label>{{ t('من', 'From') }}</label><input class="input" v-model="filter.from" type="date" /></div>
      <div class="field"><label>{{ t('إلى', 'To') }}</label><input class="input" v-model="filter.to" type="date" /></div>
      <button class="btn subtle" @click="load">{{ t('عرض', 'Apply') }}</button>
    </div>

    <div v-if="err" class="err" style="margin-bottom:14px;"><Icon name="alert" /> {{ err }}</div>

    <div class="card tbl-wrap">
      <table>
        <thead><tr><th>{{ t('الوكيل', 'Agent') }}</th><th>{{ t('الأوردرات', 'Orders') }}</th><th>{{ t('الإيراد', 'Revenue') }}</th><th>{{ t('نزل الفرع', 'Delivered') }}</th><th>{{ t('واقف', 'Pending') }}</th><th>{{ t('ملغي', 'Cancelled') }}</th><th>{{ t('الشكاوى', 'Complaints') }}</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="muted" style="text-align:center; padding:30px;">{{ t('جارٍ التحميل…', 'Loading…') }}</td></tr>
          <tr v-else-if="!rows.length"><td colspan="7"><div class="empty"><div class="ic"><Icon name="chart" /></div><div>{{ t('لا توجد بيانات بعد', 'No data yet') }}</div><div style="font-size:12.5px; margin-top:4px;">{{ t('تظهر بعد تشغيل منصّة الأوردرات', 'Appears once the orders platform is live') }}</div></div></td></tr>
          <tr v-for="r in rows" :key="r.agentId">
            <td><div class="t-strong">{{ r.agentName }}</div><div class="muted" style="font-size:12.5px;">{{ r.agentEmail }}</div></td>
            <td class="t-strong">{{ r.orders }}</td>
            <td class="t-strong">{{ money(r.revenue) }}</td>
            <td>{{ r.byStatus?.delivered || 0 }}</td>
            <td>{{ (r.byStatus?.pending || 0) + (r.byStatus?.held || 0) }}</td>
            <td>{{ r.byStatus?.cancelled || 0 }}</td>
            <td>{{ r.complaints }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
