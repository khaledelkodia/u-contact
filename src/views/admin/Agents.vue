<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { listAgents, createAgent, updateAgent, setAgentPassword, setAgentCompanies, listCompanies } from '../../api'
import { t, isAr } from '../../i18n'
import { PERMS, permLabel } from '../../perms'
import Icon from '../../components/Icon.vue'

const agents = ref<any[]>([])
const companies = ref<any[]>([])       // [{id,name,nameAr,contactAllowedPermissions}]
const loading = ref(true)
const err = ref('')
const show = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)

// form.links: { companyId: string[] }  — الشركات المربوطة وصلاحياتها
const form = reactive<any>({
  name: '', email: '', phone: '', password: '', isActive: true,
  links: {} as Record<number, string[]>,
  // نطاق الفرنشايز لكل شركة — **فارغ = كل فرنشايزات الشركة** (عرف المشروع: غياب القيد
  // يعني عملاً بلا قيد لا شللاً). وكيلٌ يخدم فرنشايزاً بعينه يُحدَّد هنا.
  scopes: {} as Record<number, number[]>,
})

/** فرنشايزات شركةٍ بعينها (تأتي مع قائمة الشركات من الخادم). */
function coFranchises(cid: number): any[] {
  return (companies.value.find((c: any) => c.id === cid)?.franchises) || []
}
function scopeOf(cid: number): number[] { return form.scopes[cid] || [] }
function toggleFranchise(cid: number, fid: number) {
  const cur = scopeOf(cid)
  const i = cur.indexOf(fid)
  form.scopes[cid] = i >= 0 ? cur.filter((x) => x !== fid) : [...cur, fid]
}
function clearScope(cid: number) { form.scopes[cid] = [] }

const coName = (c: any) => (isAr() ? (c?.nameAr || c?.name) : (c?.name || c?.nameAr))

// ── بحث وتصفية ───────────────────────────────────────────────────────────────
// جدولٌ يطول بلا بحثٍ يصير غير قابل للاستعمال؛ والصفحة تُفتح للبحث عن وكيلٍ بعينه
// أكثر مما تُفتح للتصفّح، فالبحث أولُ ما تقع عليه العين لا خيارٌ مدفون.
const q = ref('')
const statusFilter = ref<'all' | 'active' | 'off'>('all')
const shown = computed<any[]>(() => {
  const s = q.value.trim().toLowerCase()
  return agents.value.filter((a: any) => {
    if (statusFilter.value === 'active' && !a.isActive) return false
    if (statusFilter.value === 'off' && a.isActive) return false
    if (!s) return true
    const co = (a.companies || []).map((c: any) => coName(c)).join(' ')
    return `${a.name} ${a.email} ${a.phone || ''} ${co}`.toLowerCase().includes(s)
  })
})

// ملخّصٌ يجيب عن السؤال الأول الذي يُفتح لأجله هذا الجدول: كم وكيلاً يعمل الآن؟
const stats = computed(() => ({
  total: agents.value.length,
  active: agents.value.filter((a: any) => a.isActive).length,
  linked: agents.value.filter((a: any) => (a.companies || []).length > 0).length,
  orphan: agents.value.filter((a: any) => !(a.companies || []).length).length,
}))

/** أوّل حرفٍ للاسم — بديلُ الصورة، ولونه ثابتٌ مشتقٌّ من المعرّف. */
const initial = (n: string) => (n || '?').trim().charAt(0).toUpperCase()
const AV = ['#2563eb', '#0891b2', '#7c3aed', '#c026d3', '#0f766e', '#b45309']
const avColor = (id: number) => AV[Math.abs(Number(id) || 0) % AV.length]

async function load() {
  loading.value = true; err.value = ''
  try { const [a, c] = await Promise.all([listAgents(), listCompanies()]); agents.value = a; companies.value = c }
  catch (e: any) { err.value = e?.response?.data?.message || t('تعذّر التحميل', 'Failed to load') }
  finally { loading.value = false }
}
onMounted(load)

function openCreate() {
  editingId.value = null
  // النطاق يُصفَّر مع الروابط — وإلا ورث الوكيلُ الجديد تقييدَ الذي قبله
  Object.assign(form, { name: '', email: '', phone: '', password: '', isActive: true, links: {}, scopes: {} }); show.value = true; err.value = ''
}
function openEdit(a: any) {
  editingId.value = a.id
  const links: Record<number, string[]> = {}
  for (const c of a.companies || []) links[c.id] = [...(c.permissions || [])]
  const scopes: Record<number, number[]> = {}
  for (const c of a.companies || []) scopes[c.id] = [...(c.franchiseIds || [])]
  form.scopes = scopes
  Object.assign(form, { name: a.name, email: a.email, phone: a.phone || '', password: '', isActive: a.isActive, links }); show.value = true; err.value = ''
}
const linked = (cid: number) => form.links[cid] !== undefined
function toggleCompany(cid: number) {
  if (linked(cid)) delete form.links[cid]; else form.links[cid] = []
}
function togglePerm(cid: number, key: string) {
  const arr = form.links[cid]; if (!arr) return
  const i = arr.indexOf(key); if (i >= 0) arr.splice(i, 1); else arr.push(key)
}

async function save() {
  saving.value = true; err.value = ''
  try {
    const companiesPayload = Object.entries(form.links).map(([cid, perms]) => ({
      companyId: Number(cid), permissions: perms as string[], franchiseIds: form.scopes[Number(cid)] || [],
    }))
    if (editingId.value == null) {
      await createAgent({ name: form.name, email: form.email, phone: form.phone, password: form.password, companies: companiesPayload })
    } else {
      await updateAgent(editingId.value, { name: form.name, phone: form.phone, isActive: form.isActive })
      await setAgentCompanies(editingId.value, companiesPayload)
      if (form.password) await setAgentPassword(editingId.value, form.password)
    }
    show.value = false; await load()
  } catch (e: any) { err.value = e?.response?.data?.message || t('تعذّر الحفظ', 'Failed to save') }
  finally { saving.value = false }
}
</script>

<template>
  <div class="content">
    <div class="page-head">
      <div style="flex:1;">
        <div class="t">{{ t('الوكلاء', 'Agents') }}</div>
        <div class="d">{{ t('أنشئ الوكلاء واربطهم بالشركات بصلاحيات لكل شركة', 'Create agents and link them to companies with per-company permissions') }}</div>
      </div>
      <button class="btn" @click="openCreate"><Icon name="plus" /> {{ t('وكيل جديد', 'New agent') }}</button>
    </div>

    <div v-if="err" class="err" style="margin-bottom:14px;"><Icon name="alert" /> {{ err }}</div>

    <!-- ملخّص: الأرقام التي تُفتح الصفحة لأجلها قبل الجدول -->
    <div class="stats">
      <div class="stat"><div class="lbl"><Icon name="users" /> {{ t('الوكلاء', 'Agents') }}</div><div class="val">{{ stats.total }}</div></div>
      <div class="stat"><div class="lbl"><Icon name="check" /> {{ t('مفعّلون', 'Active') }}</div><div class="val" style="color:var(--green);">{{ stats.active }}</div></div>
      <div class="stat"><div class="lbl"><Icon name="building" /> {{ t('مربوطون بشركات', 'Linked') }}</div><div class="val">{{ stats.linked }}</div></div>
      <div class="stat">
        <div class="lbl"><Icon name="alert" /> {{ t('بلا شركة', 'Unlinked') }}</div>
        <!-- الوكيل بلا شركة لا يستطيع فعل شيء — يُبرز أحمرَ ليُعالَج لا ليُعَدّ -->
        <div class="val" :style="{ color: stats.orphan ? 'var(--rose)' : undefined }">{{ stats.orphan }}</div>
      </div>
    </div>

    <div class="toolbar">
      <div class="tb-search">
        <Icon name="search" />
        <input class="input" v-model="q" :placeholder="t('ابحث بالاسم أو البريد أو الشركة…', 'Search name, email or company…')" />
      </div>
      <div class="seg">
        <button :class="{ on: statusFilter === 'all' }" @click="statusFilter = 'all'">{{ t('الكل', 'All') }}</button>
        <button :class="{ on: statusFilter === 'active' }" @click="statusFilter = 'active'">{{ t('مفعّل', 'Active') }}</button>
        <button :class="{ on: statusFilter === 'off' }" @click="statusFilter = 'off'">{{ t('موقوف', 'Suspended') }}</button>
      </div>
      <span class="muted" style="font-size:12.5px; margin-inline-start:auto;">{{ shown.length }} / {{ agents.length }}</span>
    </div>

    <div class="card tbl-wrap">
      <table>
        <thead><tr><th>{{ t('الوكيل', 'Agent') }}</th><th>{{ t('الحالة', 'Status') }}</th><th>{{ t('الشركات والصلاحيات', 'Companies & permissions') }}</th><th></th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="4" class="muted" style="text-align:center; padding:30px;">{{ t('جارٍ التحميل…', 'Loading…') }}</td></tr>
          <tr v-else-if="!shown.length"><td colspan="4"><div class="empty"><div class="ic"><Icon name="users" /></div><div>{{ agents.length ? t('لا نتائج مطابقة', 'No matches') : t('لا يوجد وكلاء بعد', 'No agents yet') }}</div></div></td></tr>
          <tr v-for="a in shown" :key="a.id">
            <td>
              <div class="idcell">
                <div class="av-sm" :style="{ background: avColor(a.id) }">{{ initial(a.name) }}</div>
                <div style="min-width:0;">
                  <div class="t-strong">{{ a.name }}</div>
                  <div class="muted" style="font-size:12px;">{{ a.email }}</div>
                </div>
              </div>
            </td>
            <td><span class="badge" :class="a.isActive ? 'on' : 'off'">{{ a.isActive ? t('مفعّل', 'Active') : t('موقوف', 'Suspended') }}</span></td>
            <td>
              <template v-if="a.companies.length">
                <span v-for="c in a.companies" :key="c.id" class="chip">
                  {{ coName(c) }}<b class="chip-n">{{ (c.permissions || []).length }}</b>
                </span>
              </template>
              <!-- ليست خانةً فارغة: وكيلٌ بلا شركة لا يدخل شيئاً — نقولها لا نتركها شرطة -->
              <span v-else class="chip" style="background:var(--rose-soft); border-color:transparent; color:var(--rose);">
                {{ t('غير مربوط بأي شركة', 'Not linked to any company') }}
              </span>
            </td>
            <td style="text-align:end;"><button class="btn ghost sm" @click="openEdit(a)"><Icon name="edit" /> {{ t('تعديل', 'Edit') }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="show" class="modal-bg" @mousedown.self="show = false">
      <div class="modal" style="max-width:620px;">
        <div class="m-head">
          <Icon :name="editingId == null ? 'plus' : 'edit'" style="width:19px;height:19px;color:var(--primary);" />
          <h3>{{ editingId == null ? t('وكيل جديد', 'New agent') : t('تعديل الوكيل', 'Edit agent') }}</h3>
          <span style="flex:1;"></span>
          <button class="btn icon ghost sm" @click="show = false"><Icon name="x" /></button>
        </div>
        <div class="m-body">
          <div class="field"><label>{{ t('الاسم', 'Name') }}</label><input class="input" v-model="form.name" /></div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
            <div class="field" v-if="editingId == null"><label>{{ t('البريد الإلكتروني', 'Email') }}</label><input class="input" v-model="form.email" type="email" /></div>
            <div class="field"><label>{{ t('التليفون', 'Phone') }}</label><input class="input" v-model="form.phone" /></div>
            <div class="field"><label>{{ editingId == null ? t('كلمة المرور', 'Password') : t('كلمة مرور جديدة (اختياري)', 'New password (optional)') }}</label><input class="input" v-model="form.password" type="password" autocomplete="new-password" /></div>
            <div class="field" v-if="editingId != null"><label>{{ t('الحالة', 'Status') }}</label><select v-model="form.isActive"><option :value="true">{{ t('مفعّل', 'Active') }}</option><option :value="false">{{ t('موقوف', 'Suspended') }}</option></select></div>
          </div>

          <div class="field">
            <label>{{ t('الشركات والصلاحيات', 'Companies & permissions') }}</label>
            <div style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow:auto;">
              <div v-for="c in companies" :key="c.id" class="card" style="padding:11px 13px; border-radius:11px;">
                <label style="display:flex; align-items:center; gap:9px; cursor:pointer; margin:0;">
                  <input type="checkbox" :checked="linked(c.id)" @change="toggleCompany(c.id)" style="width:16px; height:16px;" />
                  <span class="t-strong">{{ coName(c) }}</span>
                  <!-- شركة بلا فرع مفعّل: الوكيل يدخل ويضرب أوردراً يبقى في الكلاود
                       بلا أن يسحبه فرع. نقولها هنا قبل الربط لا بعد أول طلب ضائع. -->
                  <span v-if="!Number(c.branchesCallCenter || 0)" class="chip soft"
                    style="background:#fee2e2; color:#b91c1c; margin-inline-start:auto;">
                    <Icon name="alert" />{{ t('الكول‑سنتر غير مفعّل', 'Call center not enabled') }}
                  </span>
                </label>
                <p v-if="linked(c.id) && !Number(c.branchesCallCenter || 0)" class="muted"
                  style="margin:7px 0 0; padding-inline-start:25px; font-size:11.5px; color:#b91c1c;">
                  {{ t('لا فرع في هذه الشركة مفعّل عليه الكول‑سنتر — أي أوردر يضربه الوكيل لن ينزل أي فرع. فعّله من داشبورد U‑Serve › الشركة › الفروع.',
                        'No branch in this company has the call center enabled — orders this agent takes will never reach a branch. Enable it from the U-Serve dashboard › company › branches.') }}
                </p>
                <div v-if="linked(c.id)" style="margin-top:9px; padding-inline-start:25px;">
                  <div class="pills">
                    <div v-for="p in PERMS" :key="p.key" class="pill" :class="{ on: form.links[c.id].includes(p.key) }" @click="togglePerm(c.id, p.key)">
                      <Icon v-if="form.links[c.id].includes(p.key)" name="check" />{{ permLabel(p.key, isAr()) }}
                    </div>
                  </div>

                  <!-- نطاق الفرنشايز: لا يظهر لشركةٍ بلا فرنشايزات — لا معنى لقيدٍ على لا شيء -->
                  <template v-if="coFranchises(c.id).length">
                    <div style="display:flex; align-items:center; gap:8px; margin:12px 0 6px;">
                      <label style="margin:0;">{{ t('نطاق الفرنشايز', 'Franchise scope') }}</label>
                      <span class="muted" style="font-size:11px; font-weight:500; text-transform:none; letter-spacing:0;">
                        {{ scopeOf(c.id).length ? t('مقيَّد', 'Restricted') : t('كل الفرنشايزات', 'All franchises') }}
                      </span>
                      <button v-if="scopeOf(c.id).length" type="button" class="btn ghost sm" style="margin-inline-start:auto;" @click="clearScope(c.id)">
                        {{ t('إلغاء التقييد', 'Clear') }}
                      </button>
                    </div>
                    <div class="pills">
                      <div v-for="f in coFranchises(c.id)" :key="f.id" class="pill" :class="{ on: scopeOf(c.id).includes(f.id) }" @click="toggleFranchise(c.id, f.id)">
                        <Icon v-if="scopeOf(c.id).includes(f.id)" name="check" />{{ coName(f) }}
                      </div>
                    </div>
                    <p class="muted" style="font-size:11.5px; margin:7px 0 0;">
                      {{ t('اترك الاختيار فارغاً ليعمل على كل فرنشايزات الشركة.', 'Leave empty to let the agent work on all franchises of the company.') }}
                    </p>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <div v-if="err" class="err"><Icon name="alert" /> {{ err }}</div>
        </div>
        <div class="m-foot">
          <button class="btn ghost" @click="show = false">{{ t('إلغاء', 'Cancel') }}</button>
          <button class="btn" :disabled="saving" @click="save">{{ saving ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ', 'Save') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
