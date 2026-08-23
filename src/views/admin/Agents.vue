<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
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
const form = reactive<any>({ name: '', email: '', phone: '', password: '', isActive: true, links: {} as Record<number, string[]> })

const coName = (c: any) => (isAr() ? (c?.nameAr || c?.name) : (c?.name || c?.nameAr))

async function load() {
  loading.value = true; err.value = ''
  try { const [a, c] = await Promise.all([listAgents(), listCompanies()]); agents.value = a; companies.value = c }
  catch (e: any) { err.value = e?.response?.data?.message || t('تعذّر التحميل', 'Failed to load') }
  finally { loading.value = false }
}
onMounted(load)

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', email: '', phone: '', password: '', isActive: true, links: {} }); show.value = true; err.value = ''
}
function openEdit(a: any) {
  editingId.value = a.id
  const links: Record<number, string[]> = {}
  for (const c of a.companies || []) links[c.id] = [...(c.permissions || [])]
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
    const companiesPayload = Object.entries(form.links).map(([cid, perms]) => ({ companyId: Number(cid), permissions: perms as string[] }))
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

    <div class="card tbl-wrap">
      <table>
        <thead><tr><th>{{ t('الوكيل', 'Agent') }}</th><th>{{ t('الحالة', 'Status') }}</th><th>{{ t('الشركات', 'Companies') }}</th><th></th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="4" class="muted" style="text-align:center; padding:30px;">{{ t('جارٍ التحميل…', 'Loading…') }}</td></tr>
          <tr v-else-if="!agents.length"><td colspan="4"><div class="empty"><div class="ic"><Icon name="users" /></div><div>{{ t('لا يوجد وكلاء بعد', 'No agents yet') }}</div></div></td></tr>
          <tr v-for="a in agents" :key="a.id">
            <td><div class="t-strong">{{ a.name }}</div><div class="muted" style="font-size:12.5px;">{{ a.email }}</div></td>
            <td><span class="badge" :class="a.isActive ? 'on' : 'off'">{{ a.isActive ? t('مفعّل', 'Active') : t('موقوف', 'Suspended') }}</span></td>
            <td>
              <template v-if="a.companies.length">
                <span v-for="c in a.companies" :key="c.id" class="chip">{{ coName(c) }} · {{ (c.permissions || []).length }}</span>
              </template>
              <span v-else class="muted">—</span>
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
