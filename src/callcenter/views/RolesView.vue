<script setup lang="ts">
/**
 * أدوار الوكلاء — مجموعة صلاحياتٍ باسمٍ واحد.
 *
 * منحُ الصلاحيات واحدةً واحدةً لكل وكيل يعني إعادة العمل مع كل توظيف، واختلافاً صامتاً
 * بين وكيلين يُفترض تشابههما. الدور يجمعها فتُمنَح بضغطة وتُراجَع في مكانٍ واحد.
 *
 * ما يُعرَض للاختيار محكومٌ بسقف الشركة وبما يملكه صانع الدور — فلا يُصنع دورٌ يمنح
 * أكثر مما يملك صاحبه. والخادم يقصّ مرّةً أخرى، فالواجهة راحةٌ لا حارس.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { contactRoles, contactCreateRole, contactUpdateRole, contactDeleteRole, currentCompany } from '../../api'
import { PERMS, PERM_GROUPS, permsOfGroup, intersect } from '../../perms'
import { tx, lang } from '../lang'
import { showToast, askConfirm } from '../store'
import { icon } from '../icons'

const isAr = computed(() => lang.value === 'ar')
const rows = ref<any[]>([])
const loading = ref(true)
const err = ref('')
const show = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const form = reactive<{ name: string; nameAr: string; permissions: string[] }>({ name: '', nameAr: '', permissions: [] })

/** أقصى ما يمكن وضعه في دور: سقف الشركة ∩ صلاحياتي. */
const grantable = computed<string[]>(() => {
  const own = currentCompany()?.permissions || []
  const ceil = currentCompany()?.ceiling || []
  return ceil.length ? intersect(ceil, own) : own
})
const groups = computed(() =>
  PERM_GROUPS.map((g) => ({ ...g, perms: permsOfGroup(g.key).filter((p) => grantable.value.includes(p.key)) }))
    .filter((g) => g.perms.length))

async function load() {
  loading.value = true; err.value = ''
  try { rows.value = await contactRoles() }
  catch (e: any) { err.value = e?.response?.data?.message || tx('تعذّر التحميل', 'Could not load') }
  finally { loading.value = false }
}
onMounted(load)

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', nameAr: '', permissions: [] })
  show.value = true; err.value = ''
}
function openEdit(r: any) {
  editingId.value = r.id
  Object.assign(form, { name: r.name || '', nameAr: r.nameAr || '', permissions: [...(r.permissions || [])] })
  show.value = true; err.value = ''
}
function toggle(k: string) {
  const i = form.permissions.indexOf(k)
  if (i >= 0) form.permissions.splice(i, 1); else form.permissions.push(k)
}
/** تحديد/إلغاء مجموعةٍ كاملة — ثلاث عشرة حبّةً تُضغط واحدةً واحدةً عملٌ لا داعي له. */
function toggleGroup(g: any) {
  const keys = g.perms.map((p: any) => p.key)
  const all = keys.every((k: string) => form.permissions.includes(k))
  form.permissions = all
    ? form.permissions.filter((k) => !keys.includes(k))
    : [...new Set([...form.permissions, ...keys])]
}
const groupAll = (g: any) => g.perms.every((p: any) => form.permissions.includes(p.key))

async function save() {
  if (!form.name.trim()) { err.value = tx('اسم الدور مطلوب', 'Role name is required'); return }
  saving.value = true; err.value = ''
  try {
    const body = { name: form.name.trim(), nameAr: form.nameAr.trim() || null, permissions: form.permissions }
    if (editingId.value) await contactUpdateRole(editingId.value, body)
    else await contactCreateRole(body)
    show.value = false
    showToast(tx('تم الحفظ', 'Saved'), 'success')
    await load()
  } catch (e: any) {
    err.value = e?.response?.data?.message || tx('تعذّر الحفظ', 'Could not save')
  } finally { saving.value = false }
}

async function remove(r: any) {
  if (!(await askConfirm({
    title: tx(`حذف دور «${roleName(r)}»؟`, `Delete the role “${roleName(r)}”?`),
    body: r.agents
      ? tx(`${r.agents} وكيلاً عليه — يبقون بصلاحياتهم الحالية ويُفكّ ارتباطهم بالدور.`,
           `${r.agents} agent(s) hold it — they keep their current permissions and are unlinked from the role.`)
      : tx('لا وكيل على هذا الدور.', 'No agent holds this role.'),
    okLabel: tx('حذف', 'Delete'),
  }))) return
  try { await contactDeleteRole(r.id); showToast(tx('تم الحذف', 'Deleted'), 'success'); await load() }
  catch (e: any) { showToast(e?.response?.data?.message || tx('تعذّر الحذف', 'Could not delete'), 'error') }
}

const roleName = (r: any) => (isAr.value ? (r.nameAr || r.name) : (r.name || r.nameAr))
const permLabelOf = (k: string) => {
  const p = PERMS.find((x) => x.key === k)
  return p ? (isAr.value ? p.ar : p.en) : k
}
</script>

<template>
  <div class="tab-panel active">
    <div class="rv-head">
      <div>
        <h2 class="rv-title">{{ tx('أدوار الوكلاء', 'Agent roles') }}</h2>
        <p class="rv-lead">{{ tx('مجموعة صلاحياتٍ باسمٍ واحد — تُمنَح للوكيل بضغطة وتُعدَّل في مكانٍ واحد.',
                                 'A named set of permissions — granted to an agent in one click and edited in one place.') }}</p>
      </div>
      <button class="btn btn-primary" @click="openCreate()">
        <span class="inline-ico" v-html="icon('plus', { size: 14 })"></span> {{ tx('دور جديد', 'New role') }}
      </button>
    </div>

    <p v-if="loading" class="rv-muted">{{ tx('جارٍ التحميل…', 'Loading…') }}</p>
    <p v-else-if="!rows.length" class="rv-muted">{{ tx('لا توجد أدوار بعد.', 'No roles yet.') }}</p>

    <div v-else class="rv-list">
      <div v-for="r in rows" :key="r.id" class="rv-card">
        <div class="rv-card-top">
          <span class="rv-name">{{ roleName(r) }}</span>
          <!-- قالبٌ عامّ يصنعه المشرف العام: يُستعمَل ولا يُعدَّل من داخل الشركة -->
          <span v-if="r.isTemplate" class="rv-tag">{{ tx('قالب عامّ', 'Shared template') }}</span>
          <span class="rv-agents">{{ r.agents }} {{ tx('وكيل', 'agents') }}</span>
          <span v-if="!r.isTemplate" class="rv-actions">
            <button class="rv-btn" @click="openEdit(r)">{{ tx('تعديل', 'Edit') }}</button>
            <button class="rv-btn rv-danger" @click="remove(r)">{{ tx('حذف', 'Delete') }}</button>
          </span>
        </div>
        <div class="rv-perms">
          <span v-if="!r.permissions.length" class="rv-none">{{ tx('بلا صلاحيات', 'No permissions') }}</span>
          <span v-for="k in r.permissions" :key="k" class="rv-chip">{{ permLabelOf(k) }}</span>
        </div>
      </div>
    </div>

    <!-- ── محرّر الدور ──────────────────────────────────────────────────────── -->
    <div v-if="show" class="modal-overlay" @click.self="show = false">
      <div class="modal-content rv-box" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">{{ editingId ? tx('تعديل الدور', 'Edit role') : tx('دور جديد', 'New role') }}</h3>
          <button class="modal-close" @click="show = false">×</button>
        </div>
        <div class="modal-body">
          <div class="rv-fields">
            <div>
              <label class="rv-lbl">{{ tx('الاسم (إنجليزي)', 'Name (English)') }}</label>
              <input v-model="form.name" class="ce-input" placeholder="Supervisor">
            </div>
            <div>
              <label class="rv-lbl">{{ tx('الاسم بالعربية', 'Arabic name') }}</label>
              <input v-model="form.nameAr" class="ce-input" :placeholder="tx('مشرف', 'Supervisor')">
            </div>
          </div>

          <!-- التعديل يسري على من هم على الدور: يُقال قبل الحفظ لا بعده -->
          <div v-if="editingId" class="rv-note">
            <span class="inline-ico" v-html="icon('info', { size: 13 })"></span>
            <span>{{ tx('التعديل يسري على كل وكيلٍ على هذا الدور.', 'The change applies to every agent holding this role.') }}</span>
          </div>

          <div v-for="g in groups" :key="g.key" class="rv-group">
            <div class="rv-group-head">
              <span class="rv-group-name">{{ isAr ? g.ar : g.en }}</span>
              <button type="button" class="rv-all" @click="toggleGroup(g)">
                {{ groupAll(g) ? tx('إلغاء الكل', 'Clear all') : tx('تحديد الكل', 'Select all') }}
              </button>
            </div>
            <div class="rv-opts">
              <button v-for="p in g.perms" :key="p.key" type="button" class="rv-opt"
                :class="{ 'is-on': form.permissions.includes(p.key) }" @click="toggle(p.key)">
                <span class="rv-check" v-html="form.permissions.includes(p.key) ? icon('check', { size: 11 }) : ''"></span>
                {{ isAr ? p.ar : p.en }}
              </button>
            </div>
          </div>

          <div v-if="err" class="rv-err">
            <span class="inline-ico" v-html="icon('x-circle', { size: 14 })"></span><span>{{ err }}</span>
          </div>
        </div>
        <div class="modal-footer" style="justify-content:flex-end; gap:8px;">
          <button class="btn btn-secondary" @click="show = false">{{ tx('إلغاء', 'Cancel') }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="save()">
            {{ saving ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ', 'Save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rv-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.rv-title { margin: 0 0 6px; font-size: 19px; font-weight: 800; color: var(--text-primary, #1f2937); }
.rv-lead { margin: 0; font-size: 13px; color: #4b5563; line-height: 1.7; }
.rv-muted { font-size: 13px; color: #6b7280; }

.rv-list { display: flex; flex-direction: column; gap: 10px; }
.rv-card { padding: 14px 16px; border: 1px solid var(--border, #e5e7eb); border-radius: 12px; background: var(--white, #fff); }
.rv-card-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.rv-name { font-size: 14.5px; font-weight: 800; color: var(--text-primary, #1f2937); }
.rv-tag { padding: 2px 8px; border-radius: 999px; background: var(--bg, #f0f2f5); color: #4b5563; font-size: 10.5px; font-weight: 800; }
.rv-agents { padding: 2px 8px; border-radius: 999px; background: #dbeafe; color: #1242b0; font-size: 10.5px; font-weight: 800; }
.rv-actions { margin-inline-start: auto; display: flex; gap: 10px; }
.rv-btn { background: none; border: none; padding: 0; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--primary, #1a56db); }
.rv-btn:hover { text-decoration: underline; }
.rv-danger { color: #b91c1c; }

.rv-perms { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.rv-chip { padding: 2px 9px; border-radius: 7px; background: var(--bg, #f0f2f5); color: #4b5563; font-size: 11px; font-weight: 700; }
.rv-none { font-size: 11.5px; color: #9ca3af; font-weight: 600; }

.rv-box { max-width: 640px; }
.rv-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.rv-lbl { display: block; font-size: 12px; font-weight: 700; color: #4b5563; margin-bottom: 6px; }
.rv-note {
  display: flex; align-items: center; gap: 8px; margin-top: 12px;
  padding: 8px 11px; border-radius: 9px; background: #dbeafe; color: #1242b0;
  font-size: 12px; font-weight: 700;
}

.rv-group { margin-top: 16px; }
.rv-group-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.rv-group-name { font-size: 12.5px; font-weight: 800; color: var(--text-primary, #1f2937); }
.rv-all { background: none; border: none; padding: 0; cursor: pointer; font-size: 11.5px; font-weight: 700; color: var(--primary, #1a56db); }
.rv-all:hover { text-decoration: underline; }
.rv-opts { display: flex; flex-wrap: wrap; gap: 7px; }
.rv-opt {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 11px; border-radius: 9px;
  border: 1.5px solid var(--border, #e5e7eb); background: transparent;
  color: #4b5563; font-size: 12px; font-weight: 700; cursor: pointer;
}
.rv-opt.is-on { border-color: var(--primary, #1a56db); background: var(--primary-light, #dbeafe); color: #1242b0; }
.rv-check { display: inline-flex; width: 11px; }
.rv-check svg { display: block; }

.rv-err {
  display: flex; align-items: center; gap: 8px; margin-top: 14px;
  padding: 9px 11px; border-radius: 9px; background: #fee2e2; color: #b91c1c;
  font-size: 12px; font-weight: 700;
}

body.dark-mode .rv-card { background: rgba(255, 255, 255, .04); }
body.dark-mode .rv-name { color: #e2e8f0; }
</style>
