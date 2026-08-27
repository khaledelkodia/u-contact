<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { session, isAuthed, currentCompany, setCompany, currentFranchise, setFranchise, logout } from './api'
import { lang, setLang, t, isAr } from './i18n'
import Icon from './components/Icon.vue'
import { adminMeta, ensureAdminCounts, resetAdminCounts } from './adminMeta'

const route = useRoute()
const router = useRouter()
const authed = computed(() => isAuthed() && route.path !== '/login')
const initial = computed(() => (session.name || 'U').trim().charAt(0).toUpperCase())
const coName = (c: any) => (isAr() ? (c?.nameAr || c?.name) : (c?.name || c?.nameAr))

const cur = computed(() => currentCompany())
const can = (p: string) => !!cur.value?.permissions?.includes(p)

const curFr = computed(() => currentFranchise())
function pickCompany(e: any) { setCompany(Number(e.target.value)); if (route.path !== '/app') router.push('/app') }
function pickFranchise(e: any) { const v = e.target.value; setFranchise(v ? Number(v) : null) }
function signOut() { logout(); resetAdminCounts(); router.push('/login') }

// عدّادات القائمة تُسحب أوّل ما يصير الوضع «إدارة» — لا عند إقلاع التطبيق، لأن
// الشل يُركَّب قبل تسجيل الدخول ولا صلاحية حينها.
watch(() => session.mode, (m) => { if (m === 'admin') ensureAdminCounts() }, { immediate: true })
</script>

<template>
  <!-- شاشة بـlayout مستقل (الكول‑سنتر) — تتخطّى شل U-Contact بالكامل -->
  <router-view v-if="route.meta.fullLayout" />
  <div v-else-if="authed" class="shell">
    <aside class="side">
      <div class="brand">
        <div class="logo"><Icon name="headset" /></div>
        <div>
          <div class="name">U‑Contact</div>
          <div class="sub">{{ session.mode === 'admin' ? t('لوحة الإدارة', 'Admin Console') : t('منصّة العمل', 'Workspace') }}</div>
        </div>
      </div>

      <!-- Super-admin nav -->
      <template v-if="session.mode === 'admin'">
        <div class="group">{{ t('الإدارة', 'Management') }}</div>
        <router-link to="/admin/agents" class="navlink" :class="{ on: route.path === '/admin/agents' }">
          <Icon name="users" /> {{ t('الوكلاء', 'Agents') }}
          <span v-if="adminMeta.agents !== null" class="n">{{ adminMeta.agents }}</span>
        </router-link>
        <router-link to="/admin/companies" class="navlink" :class="{ on: route.path === '/admin/companies' }">
          <Icon name="building" /> {{ t('الشركات', 'Companies') }}
          <span v-if="adminMeta.companies !== null" class="n">{{ adminMeta.companies }}</span>
        </router-link>
        <router-link to="/admin/reports" class="navlink" :class="{ on: route.path === '/admin/reports' }"><Icon name="chart" /> {{ t('التقارير', 'Reports') }}</router-link>
      </template>

      <!-- Agent nav (permission-gated) -->
      <template v-else>
        <div class="group">{{ t('الشركة', 'Company') }}</div>
        <select v-if="session.companies.length" class="input" style="margin-bottom:12px;" :value="cur?.id || ''" @change="pickCompany">
          <option v-for="c in session.companies" :key="c.id" :value="c.id">{{ coName(c) }}</option>
        </select>
        <template v-if="session.franchises.length > 1">
          <div class="group">{{ t('الامتياز', 'Franchise') }}</div>
          <select class="input" style="margin-bottom:12px;" :value="curFr?.id || ''" @change="pickFranchise">
            <!-- لا «كل الامتيازات»: العمل بلا امتياز يعني نطاقاً بلا فرعٍ ولا منيو -->
            <option value="" disabled>{{ t('اختر الامتياز…', 'Select a franchise…') }}</option>
            <option v-for="f in session.franchises" :key="f.id" :value="f.id">{{ coName(f) }}</option>
          </select>
        </template>

        <div class="group">{{ t('القائمة', 'Menu') }}</div>
        <router-link to="/app" class="navlink" :class="{ on: route.path === '/app' }"><Icon name="dashboard" /> {{ t('الرئيسية', 'Home') }}</router-link>
        <router-link v-if="can('callcenter.users')" to="/app/users" class="navlink" :class="{ on: route.path === '/app/users' }"><Icon name="users" /> {{ t('المستخدمون', 'Users') }}</router-link>
        <router-link v-if="can('callcenter.view') || can('callcenter.create')" to="/app/orders" class="navlink" :class="{ on: route.path === '/app/orders' }"><Icon name="cart" /> {{ t('الطلبات', 'Orders') }}</router-link>
      </template>

      <div class="spacer"></div>

      <div class="langtoggle" style="margin-bottom:12px; align-self:stretch;">
        <button :class="{ on: lang === 'ar' }" @click="setLang('ar')">العربية</button>
        <button :class="{ on: lang === 'en' }" @click="setLang('en')">English</button>
      </div>

      <div class="who">
        <div class="av">{{ initial }}</div>
        <div style="flex:1; min-width:0;">
          <div class="nm">{{ session.name || t('مستخدم', 'User') }}</div>
          <div class="rl">{{ session.mode === 'admin' ? t('مشرف عام', 'Super admin') : t('مستخدم', 'User') }}</div>
        </div>
        <button class="btn icon ghost" :title="t('خروج', 'Sign out')" @click="signOut"><Icon name="logout" /></button>
      </div>
    </aside>

    <main class="main"><router-view /></main>
  </div>

  <router-view v-else />
</template>
