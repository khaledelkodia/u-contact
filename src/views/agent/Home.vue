<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { session, currentCompany, setCompany, setFranchise } from '../../api'
import { t, isAr } from '../../i18n'
import { permLabel } from '../../perms'
import Icon from '../../components/Icon.vue'

const router = useRouter()
const cur = computed(() => currentCompany())
const coName = (c: any) => (isAr() ? (c?.nameAr || c?.name) : (c?.name || c?.nameAr))
const can = (p: string) => !!cur.value?.permissions?.includes(p)
// بوابة الفرنشايز: الشركة فيها أكتر من فرنشايز ولسه ماتحدّدش
const needFranchise = computed(() => !!cur.value && session.franchises.length > 1 && !session.franchiseId)
function choose(id: number) { setCompany(id) }
function chooseFr(id: number | null) { setFranchise(id) }
</script>

<template>
  <div class="content">
    <!-- لا شركات -->
    <div v-if="!session.companies.length" class="empty" style="margin-top:40px;">
      <div class="ic"><Icon name="building" /></div>
      <div>{{ t('لست مربوطاً بأي شركة بعد', 'You’re not linked to any company yet') }}</div>
    </div>

    <!-- اختيار شركة (متعدد) -->
    <template v-else-if="!cur">
      <div class="page-head"><div><div class="t">{{ t('اختر الشركة', 'Choose a company') }}</div><div class="d">{{ t('اختر الشركة اللي هتشتغل عليها', 'Pick the company you’ll work on') }}</div></div></div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px;">
        <button v-for="c in session.companies" :key="c.id" class="card pad" style="text-align:start; cursor:pointer; display:flex; align-items:center; gap:12px;" @click="choose(c.id)">
          <div class="logo" style="width:40px;height:40px;border-radius:11px;background:var(--primary-soft);color:var(--primary-ink);display:grid;place-items:center;"><Icon name="building" /></div>
          <div><div class="t-strong">{{ coName(c) }}</div><div class="muted" style="font-size:12.5px;">{{ (c.permissions || []).length }} {{ t('صلاحية', 'permissions') }}</div></div>
        </button>
      </div>
    </template>

    <!-- اختيار الفرنشايز (لو الشركة فيها أكتر من فرنشايز) -->
    <template v-else-if="needFranchise">
      <div class="page-head"><div><div class="t">{{ t('اختر الامتياز', 'Choose a franchise') }}</div><div class="d">{{ coName(cur) }} — {{ t('اختر الامتياز اللي هتشتغل عليه', 'pick the franchise you’ll work on') }}</div></div></div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px;">
        <button v-for="f in session.franchises" :key="f.id" class="card pad" style="text-align:start; cursor:pointer; display:flex; align-items:center; gap:12px;" @click="chooseFr(f.id)">
          <div class="logo" style="width:40px;height:40px;border-radius:11px;background:var(--primary-soft);color:var(--primary-ink);display:grid;place-items:center;"><Icon name="building" /></div>
          <div><div class="t-strong">{{ coName(f) }}</div></div>
        </button>
        <button class="card pad" style="text-align:start; cursor:pointer;" @click="chooseFr(null)">
          <div class="muted">{{ t('كل الامتيازات', 'All franchises') }}</div>
        </button>
      </div>
    </template>

    <!-- لوحة حسب الصلاحيات -->
    <template v-else>
      <div class="page-head"><div><div class="t">{{ t('مرحباً،', 'Welcome,') }} {{ session.name }}</div><div class="d">{{ coName(cur) }}</div></div></div>

      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px;">
        <div v-if="can('callcenter.users')" class="card pad" style="cursor:pointer;" @click="router.push('/app/users')">
          <div class="logo" style="width:40px;height:40px;border-radius:11px;background:var(--primary-soft);color:var(--primary-ink);display:grid;place-items:center;margin-bottom:12px;"><Icon name="users" /></div>
          <div class="t-strong">{{ t('المستخدمون', 'Users') }}</div>
          <div class="muted" style="font-size:13px; margin-top:3px;">{{ t('إنشاء وإدارة مستخدمي شركتك', 'Create & manage your company’s users') }}</div>
        </div>

        <div v-if="can('callcenter.view') || can('callcenter.create')" class="card pad" style="cursor:pointer;" @click="router.push('/app/orders')">
          <div class="logo" style="width:40px;height:40px;border-radius:11px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center;margin-bottom:12px;"><Icon name="cart" /></div>
          <div class="t-strong">{{ t('منصّة الطلبات', 'Orders platform') }}</div>
          <div class="muted" style="font-size:13px; margin-top:3px;">{{ t('ضرب الطلبات ومتابعتها', 'Take & track orders') }}</div>
        </div>

        <div v-if="can('complaints.view') || can('complaints.manage')" class="card pad" style="opacity:.7;">
          <div class="logo" style="width:40px;height:40px;border-radius:11px;background:var(--surface-2);color:var(--muted);display:grid;place-items:center;margin-bottom:12px;"><Icon name="alert" /></div>
          <div class="t-strong">{{ t('الشكاوى', 'Complaints') }} <span class="chip soft" style="font-size:10px;">{{ t('قريباً', 'Soon') }}</span></div>
          <div class="muted" style="font-size:13px; margin-top:3px;">{{ t('استقبال ومتابعة الشكاوى', 'Handle & track complaints') }}</div>
        </div>
      </div>

      <div class="card pad" style="margin-top:18px;">
        <label style="margin-bottom:8px;">{{ t('صلاحياتك في هذه الشركة', 'Your permissions in this company') }}</label>
        <div v-if="cur.permissions.length"><span v-for="k in cur.permissions" :key="k" class="chip soft">{{ permLabel(k, isAr()) }}</span></div>
        <div v-else class="muted">{{ t('لا صلاحيات', 'No permissions') }}</div>
      </div>
    </template>
  </div>
</template>
