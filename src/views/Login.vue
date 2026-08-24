<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminLogin, agentLogin, session, setCompany, setFranchise, loadFranchises } from '../api'
import { lang, setLang, t, isAr } from '../i18n'
import Icon from '../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const isAdmin = computed(() => route.meta.admin === true)

const email = ref('')
const password = ref('')
const err = ref('')
const busy = ref(false)
// خطوة واحدة للنطاق: الشركة والفرنشايز في شاشة واحدة (كانتا خطوتين متتاليتين
// ببطاقات — والفرنشايز يتبع الشركة فعرضهما معاً أوضح وأقلّ نقرات).
const step = ref<'login' | 'scope'>('login')

const coName = (c: any) => (isAr() ? (c?.nameAr || c?.name) : (c?.name || c?.nameAr))

const pickedCompany = ref<number | null>(null)
/** الوكيل مقيَّد بفرنشايزات بعينها في الشركة المختارة؟ (فارغ = بلا قيد) */
const restricted = computed(() => {
  const c = session.companies.find((x: any) => x.id === pickedCompany.value)
  return !!(c?.franchiseIds && c.franchiseIds.length)
})
const pickedFranchise = ref<number | null>(null)
const frBusy = ref(false)

/** تغيير الشركة يُعيد تحميل فرنشايزاتها — القائمة الثانية تتفلتر بها دائماً. */
async function onCompanyChange() {
  pickedFranchise.value = null
  if (!pickedCompany.value) { session.franchises = []; return }
  frBusy.value = true
  try {
    setCompany(pickedCompany.value)
    await loadFranchises()
    pickedFranchise.value = session.franchiseId   // يُختار تلقائياً لو فرنشايز واحد
  } finally { frBusy.value = false }
}

function enterApp() {
  if (!pickedCompany.value) return
  setFranchise(pickedFranchise.value)
  router.push('/app/callcenter')   // واجهة الوكيل الموحّدة (الشِل الجديد)
}

// مسارٌ لكلّ دور: `/login` للوكيل و`/admin` للمشرف العام. الجذر يبدأ عند `/login`.
async function submit() {
  err.value = ''; busy.value = true
  try {
    if (isAdmin.value) { await adminLogin(email.value, password.value); router.push('/admin/agents'); return }
    await agentLogin(email.value, password.value)   // يحمّل فرنشايزات الشركة لو واحدة
    if (!session.companies.length) { err.value = t('حسابك غير مربوط بأي شركة', 'Your account isn’t linked to any company'); busy.value = false; return }
    // شركة واحدة بلا فرنشايزات تُذكر ⇒ لا شيء ليُختار: ادخل مباشرةً بدل شاشة بخيار واحد
    if (session.companyId) {
      if (!session.franchises.length) await loadFranchises()
      if (session.franchises.length <= 1) { router.push('/app/callcenter'); return }
    }
    pickedCompany.value = session.companyId
    pickedFranchise.value = session.franchiseId
    step.value = 'scope'
  } catch (e: any) {
    err.value = e?.response?.data?.message || t('فشل الدخول — راجع البيانات', 'Sign-in failed — check your details')
  } finally { busy.value = false }
}
</script>

<template>
  <div class="auth">
    <!-- Brand panel -->
    <div class="auth-brand">
      <div class="orb a"></div><div class="orb b"></div>
      <div style="position:relative; z-index:1;">
        <div class="b-logo"><Icon name="headset" /></div>
      </div>
      <div style="position:relative; z-index:1;">
        <div class="big">{{ isAdmin ? t('لوحة إدارة الكول‑سنتر', 'Call-center admin console') : t('منصّة الكول‑سنتر', 'Call-center platform') }}</div>
        <div class="lead">{{ t('إدارة الوكلاء والشركات والصلاحيات في مكان واحد، بواجهة عربية وإنجليزية.', 'Manage agents, companies, and permissions in one place — Arabic & English.') }}</div>
        <div class="pts" style="margin-top:26px;">
          <div class="pt"><div class="d"><Icon name="users" /></div> {{ t('مستخدمون وصلاحيات مرنة', 'Users & flexible permissions') }}</div>
          <div class="pt"><div class="d"><Icon name="building" /></div> {{ t('عدّة شركات لكل مستخدم', 'Multiple companies per user') }}</div>
          <div class="pt"><div class="d"><Icon name="chart" /></div> {{ t('تقارير أداء تفصيلية', 'Detailed performance reports') }}</div>
        </div>
      </div>
      <div class="foot">U‑Contact · {{ new Date().getFullYear() }}</div>
    </div>

    <!-- Form panel -->
    <div class="auth-form">
      <div class="langtoggle" style="position:absolute; top:24px; inset-inline-end:28px;">
        <button :class="{ on: lang === 'ar' }" @click="setLang('ar')">العربية</button>
        <button :class="{ on: lang === 'en' }" @click="setLang('en')">English</button>
      </div>

      <div class="auth-card">
        <!-- خطوة الدخول -->
        <template v-if="step === 'login'">
          <h1 style="font-size:24px;">{{ isAdmin ? t('دخول المشرف العام', 'Super-admin sign in') : t('تسجيل الدخول', 'Sign in') }}</h1>
          <p class="muted" style="margin:7px 0 24px; font-size:14px;">{{ isAdmin ? t('لإدارة الوكلاء والشركات', 'Manage agents & companies') : t('ادخل ببيانات حسابك', 'Enter your account details') }}</p>
          <form @submit.prevent="submit" style="display:flex; flex-direction:column; gap:15px;">
            <div class="field"><label>{{ t('البريد الإلكتروني', 'Email') }}</label><input class="input" v-model="email" type="email" autocomplete="username" placeholder="name@company.com" /></div>
            <div class="field"><label>{{ t('كلمة المرور', 'Password') }}</label><input class="input" v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" /></div>
            <div v-if="err" class="err"><Icon name="alert" /> {{ err }}</div>
            <button class="btn" :disabled="busy" style="margin-top:4px; padding:12px;">{{ busy ? t('جارٍ الدخول…', 'Signing in…') : t('دخول', 'Sign in') }}</button>
          </form>
        </template>

        <!-- خطوة النطاق: الشركة ثم الفرنشايز المفلتر بها — قائمتان في شاشة واحدة -->
        <template v-else>
          <h1 style="font-size:24px;">{{ t('اختر الشركة', 'Choose a company') }}</h1>
          <p class="muted" style="margin:7px 0 22px; font-size:14px;">
            {{ t('مرحباً', 'Welcome') }} {{ session.name }} — {{ t('اختر الشركة والفرنشايز اللي هتشتغل عليهم', 'pick the company and franchise you’ll work on') }}
          </p>

          <div style="display:flex; flex-direction:column; gap:15px;">
            <div class="field">
              <label>{{ t('الشركة', 'Company') }}</label>
              <select v-model.number="pickedCompany" @change="onCompanyChange">
                <option :value="null" disabled>{{ t('اختر الشركة…', 'Select a company…') }}</option>
                <!-- الاسم وحده: عدد الصلاحيات رقم إداريّ لا يعني الوكيل عند اختيار شركته -->
                <option v-for="c in session.companies" :key="c.id" :value="c.id">{{ coName(c) }}</option>
              </select>
            </div>

            <!-- الفرنشايز يتبع الشركة: مقفول قبل اختيارها، ومخفيّ لو ما لهاش فرنشايزات -->
            <div class="field" v-if="pickedCompany && (frBusy || session.franchises.length)">
              <label>{{ t('الفرنشايز', 'Franchise') }}</label>
              <select v-model.number="pickedFranchise" :disabled="frBusy">
                <!-- «كل الفروع» ليست خياراً لوكيلٍ مقيَّد بفرنشايزات بعينها: اختيارها
                     يعني العمل خارج نطاقه والخادم يرفضه — فلا تُعرَض أصلاً. -->
                <option v-if="!restricted" :value="null">{{ t('كل الفروع', 'All branches') }}</option>
                <option v-for="f in session.franchises" :key="f.id" :value="f.id">{{ coName(f) }}</option>
              </select>
              <span v-if="frBusy" class="muted" style="font-size:12px;">{{ t('جارٍ تحميل الفرنشايزات…', 'Loading franchises…') }}</span>
            </div>

            <button class="btn" :disabled="!pickedCompany || frBusy" style="margin-top:4px; padding:12px;" @click="enterApp()">
              {{ t('دخول', 'Continue') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
