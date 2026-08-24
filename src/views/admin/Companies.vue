<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listCompanies, setCompanyCeiling } from '../../api'
import { t, isAr } from '../../i18n'
import { PERMS, permLabel } from '../../perms'
import { adminMeta } from '../../adminMeta'
import Icon from '../../components/Icon.vue'

const companies = ref<any[]>([])
const loading = ref(true)
/**
 * الكول‑سنتر يُفعَّل **لكل فرع** (`Branch.callCenterEnabled`، مقفول افتراضياً) من
 * داشبورد U‑Serve. شركةٌ بلا فرع مفعّل يستطيع وكيلها الدخول وضربَ أوردر يبقى في
 * الكلاود بلا أن يسحبه فرع — فنُظهر الحالة، ونفتح على المفعّلة وحدها لأنها ما يعني
 * المشرف عادةً. ولا نُخفي غيرها: تجهيز الشركة قبل تفعيل فروعها مسار مشروع.
 */
const activeOnly = ref(true)
const ccOn = (c: any) => Number(c?.branchesCallCenter || 0)
const q = ref('')
const err = ref('')
const show = ref(false)
const saving = ref(false)
const editing = ref<any>(null)
const selected = ref<string[]>([])

const coName = (c: any) => (isAr() ? (c?.nameAr || c?.name) : (c?.name || c?.nameAr))

const shown = computed<any[]>(() => {
  const s = q.value.trim().toLowerCase()
  return companies.value.filter((c: any) => {
    if (activeOnly.value && !ccOn(c)) return false
    if (!s) return true
    return `${c.name || ''} ${c.nameAr || ''}`.toLowerCase().includes(s)
  })
})

// ملخّصٌ يقول أين تقف الشركات من الكول‑سنتر قبل قراءة الجدول
const stats = computed(() => ({
  total: companies.value.length,
  on: companies.value.filter((c) => ccOn(c) > 0).length,
  off: companies.value.filter((c) => !ccOn(c)).length,
  branches: companies.value.reduce((s, c) => s + ccOn(c), 0),
}))

async function load() {
  loading.value = true; err.value = ''
  try { companies.value = await listCompanies(); adminMeta.companies = companies.value.length }
  catch (e: any) { err.value = e?.response?.data?.message || t('تعذّر التحميل', 'Failed to load') }
  finally { loading.value = false }
}
onMounted(load)

function open(c: any) { editing.value = c; selected.value = [...(c.contactAllowedPermissions || [])]; show.value = true; err.value = '' }
function toggle(k: string) { const i = selected.value.indexOf(k); if (i >= 0) selected.value.splice(i, 1); else selected.value.push(k) }
async function save() {
  saving.value = true; err.value = ''
  try { await setCompanyCeiling(editing.value.id, selected.value); show.value = false; await load() }
  catch (e: any) { err.value = e?.response?.data?.message || t('تعذّر الحفظ', 'Failed to save') }
  finally { saving.value = false }
}
</script>

<template>
  <div class="content">
    <div class="page-head">
      <div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <div class="t">{{ t('الشركات', 'Companies') }}</div>
          <span v-if="!loading" class="n">{{ t(`${stats.on} مفعّلة من ${stats.total}`, `${stats.on} of ${stats.total} enabled`) }}</span>
        </div>
        <div class="d">{{ t('حدّد الصلاحيات المتاحة لكل شركة — تقيّد ما يمنحه يوزراتها لبعض (اختياري)', 'Set what each company may use — limits what its users can grant each other (optional)') }}</div>
      </div>
    </div>

    <div v-if="err" class="err" style="margin-bottom:14px;"><Icon name="alert" /> {{ err }}</div>

    <div class="stats">
      <div class="stat">
        <div class="lbl"><span>{{ t('إجمالي الشركات', 'Total companies') }}</span><span class="ic"><Icon name="building" /></span></div>
        <div class="val">{{ stats.total }}<i>{{ t('شركة', 'companies') }}</i></div>
      </div>
      <div class="stat">
        <div class="lbl"><span>{{ t('الكول‑سنتر مفعّل', 'Call center on') }}</span><span class="ic green"><Icon name="headset" /></span></div>
        <div class="val green">{{ stats.on }}<i>{{ t('جاهزة للعمل', 'ready') }}</i></div>
      </div>
      <div class="stat">
        <div class="lbl"><span>{{ t('فروع الكول‑سنتر', 'Enabled branches') }}</span><span class="ic violet"><Icon name="pin" /></span></div>
        <div class="val violet">{{ stats.branches }}<i>{{ t('فرع يستقبل', 'receiving') }}</i></div>
      </div>
      <div class="stat">
        <div class="lbl"><span>{{ t('غير مفعّلة', 'Not enabled') }}</span><span class="ic amber"><Icon name="alert" /></span></div>
        <!-- الصفر يبقى حِبريّاً: لا شيء يُعالَج فلا داعي لإنذارٍ ملوّن -->
        <div class="val" :class="stats.off ? 'amber' : 'plain'">{{ stats.off }}<i>{{ t('بحاجة لتفعيل', 'need enabling') }}</i></div>
      </div>
    </div>

    <div class="card tbl-wrap">
      <div class="tbl-head">
        <div class="tb-search">
          <Icon name="search" />
          <input class="input" v-model="q" :placeholder="t('ابحث باسم الشركة…', 'Search company name…')" />
        </div>
        <div class="seg">
          <button :class="{ on: activeOnly }" @click="activeOnly = true">{{ t('المفعّلة', 'Enabled') }}</button>
          <button :class="{ on: !activeOnly }" @click="activeOnly = false">{{ t('الكل', 'All') }}</button>
        </div>
        <span class="muted" style="font-size:13px; font-variant-numeric:tabular-nums;">{{ t(`${shown.length} من ${companies.length}`, `${shown.length} of ${companies.length}`) }}</span>
      </div>

      <table>
        <thead><tr><th>{{ t('الشركة', 'Company') }}</th><th>{{ t('الكول‑سنتر', 'Call center') }}</th><th>{{ t('الصلاحيات المتاحة', 'Available permissions') }}</th><th></th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="4" class="muted" style="text-align:center; padding:34px;">{{ t('جارٍ التحميل…', 'Loading…') }}</td></tr>
          <tr v-else-if="!shown.length"><td colspan="4"><div class="empty"><div class="ic"><Icon name="building" /></div><div>{{ q ? t('لا توجد نتائج مطابقة للبحث', 'No matches') : (activeOnly ? t('لا شركة مفعّل فيها الكول‑سنتر بعد', 'No company has the call center enabled yet') : t('لا توجد شركات', 'No companies')) }}</div></div></td></tr>
          <tr v-for="c in shown" :key="c.id">
            <td class="t-strong">{{ coName(c) }}</td>
            <td>
              <span v-if="ccOn(c)" class="badge on">
                {{ t(`${ccOn(c)} من ${c.branchesTotal} فرع`, `${ccOn(c)} of ${c.branchesTotal} branches`) }}
              </span>
              <span v-else class="badge off">{{ t('غير مفعّلة', 'Not enabled') }}</span>
            </td>
            <td>
              <template v-if="(c.contactAllowedPermissions || []).length">
                <span v-for="k in c.contactAllowedPermissions" :key="k" class="chip soft">{{ permLabel(k, isAr()) }}</span>
              </template>
              <span v-else class="muted">{{ t('الكل متاح (بلا قيد)', 'All available (no limit)') }}</span>
            </td>
            <td style="text-align:end;"><button class="btn ghost sm" @click="open(c)"><Icon name="shield" /> {{ t('تعديل المتاح', 'Edit available') }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="show" class="modal-bg" @mousedown.self="show = false">
      <div class="modal">
        <div class="m-head">
          <Icon name="shield" style="width:19px;height:19px;color:var(--primary);" />
          <h3>{{ t('الصلاحيات المتاحة', 'Available permissions') }} · {{ coName(editing) }}</h3>
          <span style="flex:1;"></span>
          <button class="btn icon ghost sm" @click="show = false"><Icon name="x" /></button>
        </div>
        <div class="m-body">
          <div class="field">
            <label>{{ t('اختر الصلاحيات المتاحة (اتركها فاضية = الكل متاح)', 'Pick available permissions (leave empty = all available)') }}</label>
            <div class="pills">
              <div v-for="p in PERMS" :key="p.key" class="pill" :class="{ on: selected.includes(p.key) }" @click="toggle(p.key)">
                <Icon v-if="selected.includes(p.key)" name="check" />{{ permLabel(p.key, isAr()) }}
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
