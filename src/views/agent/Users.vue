<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { currentCompany, listUsers, createUser, updateUser, setUserPassword, contactRoles } from '../../api'
import { t, isAr } from '../../i18n'
import { PERMS, permLabel, intersect } from '../../perms'
import Icon from '../../components/Icon.vue'

const cur = computed(() => currentCompany())
const canManage = computed(() => !!cur.value?.permissions?.includes('callcenter.users'))
// أقصى ما أقدر أمنحه = صلاحياتي، ومقيّدة بالمتاح للشركة لو مضبوط (فارغ = بلا قيد إضافي)
const grantable = computed(() => {
  const own = cur.value?.permissions || []
  const avail = cur.value?.ceiling || []
  return avail.length ? intersect(avail, own) : own
})
const grantablePerms = computed(() => PERMS.filter((p) => grantable.value.includes(p.key)))

// ── الأدوار ─────────────────────────────────────────────────────────────────
// اختيارُ دورٍ يملأ الحبّات دفعةً واحدة بدل ضغطها واحدةً واحدة. والحبّات تبقى قابلةً
// للتعديل بعده: الدور بدايةٌ لا قفل، ومن ضُبط فوق دوره يظهر «مُعدَّل».
const roles = ref<any[]>([])
async function loadRoles() { try { roles.value = await contactRoles() } catch { roles.value = [] } }
const roleName = (r: any) => (isAr() ? (r.nameAr || r.name) : (r.name || r.nameAr))
function pickRole(id: number | null) {
  form.roleId = id
  if (id == null) return
  const r = roles.value.find((x) => x.id === id)
  if (r) form.permissions = intersect(r.permissions || [], grantable.value)
}
/** ضُبطت صلاحياته فوق دوره؟ — يُقال صراحةً وإلا ظُنّ الاسمُ حقيقةً كاملة. */
const offRole = computed(() => {
  if (!form.roleId) return false
  const r = roles.value.find((x) => x.id === form.roleId)
  if (!r) return false
  const want = intersect(r.permissions || [], grantable.value)
  return want.length !== form.permissions.length || want.some((k: string) => !form.permissions.includes(k))
})

const users = ref<any[]>([])
const loading = ref(true)
const err = ref('')
const show = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const form = reactive<any>({ name: '', email: '', phone: '', password: '', permissions: [] as string[], isActive: true, roleId: null as number | null })

async function load() {
  loading.value = true; err.value = ''
  try { users.value = await listUsers() }
  catch (e: any) { err.value = e?.response?.data?.message || t('تعذّر التحميل', 'Failed to load') }
  finally { loading.value = false }
}
onMounted(() => { if (canManage.value) { load(); void loadRoles() } else loading.value = false })

function openCreate() { editingId.value = null; Object.assign(form, { name: '', email: '', phone: '', password: '', permissions: [], isActive: true, roleId: null }); show.value = true; err.value = '' }
function openEdit(u: any) { editingId.value = u.agentId; Object.assign(form, { name: u.name, email: u.email, phone: u.phone || '', password: '', permissions: [...(u.permissions || [])], isActive: u.isActive, roleId: u.roleId ?? null }); show.value = true; err.value = '' }
function togglePerm(k: string) { const i = form.permissions.indexOf(k); if (i >= 0) form.permissions.splice(i, 1); else form.permissions.push(k) }

async function save() {
  saving.value = true; err.value = ''
  try {
    const perms = intersect(form.permissions, grantable.value)
    if (editingId.value == null) {
      await createUser({ name: form.name, email: form.email, phone: form.phone, password: form.password, permissions: perms, roleId: form.roleId ?? null })
    } else {
      await updateUser(editingId.value, { permissions: perms, isActive: form.isActive, roleId: form.roleId ?? null })
      if (form.password) await setUserPassword(editingId.value, form.password)
    }
    show.value = false; await load()
  } catch (e: any) { err.value = e?.response?.data?.message || t('تعذّر الحفظ', 'Failed to save') }
  finally { saving.value = false }
}
</script>

<template>
  <div class="content">
    <div v-if="!canManage" class="empty" style="margin-top:40px;">
      <div class="ic"><Icon name="shield" /></div>
      <div>{{ t('لا تملك صلاحية إدارة المستخدمين', 'You don’t have permission to manage users') }}</div>
    </div>

    <template v-else>
      <div class="page-head">
        <div style="flex:1;"><div class="t">{{ t('المستخدمون', 'Users') }}</div><div class="d">{{ t('يوزرات شركتك — تمنحهم من صلاحياتك أنت فقط', 'Your company’s users — you grant only from your own permissions') }}</div></div>
        <button class="btn" @click="openCreate"><Icon name="plus" /> {{ t('مستخدم جديد', 'New user') }}</button>
      </div>

      <div v-if="err" class="err" style="margin-bottom:14px;"><Icon name="alert" /> {{ err }}</div>

      <div class="card tbl-wrap">
        <table>
          <thead><tr><th>{{ t('المستخدم', 'User') }}</th><th>{{ t('الحالة', 'Status') }}</th><th>{{ t('الصلاحيات', 'Permissions') }}</th><th></th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="4" class="muted" style="text-align:center; padding:30px;">{{ t('جارٍ التحميل…', 'Loading…') }}</td></tr>
            <tr v-else-if="!users.length"><td colspan="4"><div class="empty"><div class="ic"><Icon name="users" /></div><div>{{ t('لا يوجد مستخدمون بعد', 'No users yet') }}</div></div></td></tr>
            <tr v-for="u in users" :key="u.agentId">
              <td><div class="t-strong">{{ u.name }}</div><div class="muted" style="font-size:12.5px;">{{ u.email }}</div></td>
              <td><span class="badge" :class="u.isActive ? 'on' : 'off'">{{ u.isActive ? t('مفعّل', 'Active') : t('موقوف', 'Suspended') }}</span></td>
              <td><span v-for="k in (u.permissions || [])" :key="k" class="chip soft">{{ permLabel(k, isAr()) }}</span><span v-if="!(u.permissions||[]).length" class="muted">—</span></td>
              <td style="text-align:end;"><button class="btn ghost sm" @click="openEdit(u)"><Icon name="edit" /> {{ t('تعديل', 'Edit') }}</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="show" class="modal-bg" @mousedown.self="show = false">
        <div class="modal">
          <div class="m-head">
            <Icon :name="editingId == null ? 'plus' : 'edit'" style="width:19px;height:19px;color:var(--primary);" />
            <h3>{{ editingId == null ? t('مستخدم جديد', 'New user') : t('تعديل المستخدم', 'Edit user') }}</h3>
            <span style="flex:1;"></span>
            <button class="btn icon ghost sm" @click="show = false"><Icon name="x" /></button>
          </div>
          <div class="m-body">
            <div class="field" v-if="editingId != null"><label>{{ t('المستخدم', 'User') }}</label><input class="input" :value="form.name + ' · ' + form.email" disabled /></div>
            <template v-if="editingId == null">
              <div class="field"><label>{{ t('الاسم', 'Name') }}</label><input class="input" v-model="form.name" /></div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                <div class="field"><label>{{ t('البريد الإلكتروني', 'Email') }}</label><input class="input" v-model="form.email" type="email" /></div>
                <div class="field"><label>{{ t('التليفون', 'Phone') }}</label><input class="input" v-model="form.phone" /></div>
              </div>
            </template>
            <div class="field"><label>{{ editingId == null ? t('كلمة المرور', 'Password') : t('كلمة مرور جديدة (اختياري)', 'New password (optional)') }}</label><input class="input" v-model="form.password" type="password" autocomplete="new-password" /></div>
            <div class="field" v-if="editingId != null"><label>{{ t('الحالة', 'Status') }}</label><select v-model="form.isActive"><option :value="true">{{ t('مفعّل', 'Active') }}</option><option :value="false">{{ t('موقوف', 'Suspended') }}</option></select></div>

            <div class="field">
              <label>{{ t('الصلاحيات (من صلاحياتك)', 'Permissions (from yours)') }}</label>
              <!-- الدور يملأ الحبّات بضغطة؛ وتبقى قابلةً للضبط بعده -->
              <div v-if="roles.length" style="margin-bottom:10px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <select class="input" style="max-width:240px;" :value="form.roleId ?? ''"
                  @change="pickRole(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)">
                  <option value="">{{ t('بلا دور — صلاحيات مخصّصة', 'No role — custom permissions') }}</option>
                  <option v-for="r in roles" :key="r.id" :value="r.id">{{ roleName(r) }}</option>
                </select>
                <span v-if="offRole" class="muted" style="font-size:11.5px; font-weight:700; color:#b45309;">
                  {{ t('مُعدَّل فوق الدور', 'Adjusted above the role') }}
                </span>
              </div>
              <div v-if="grantablePerms.length" class="pills">
                <div v-for="p in grantablePerms" :key="p.key" class="pill" :class="{ on: form.permissions.includes(p.key) }" @click="togglePerm(p.key)">
                  <Icon v-if="form.permissions.includes(p.key)" name="check" />{{ permLabel(p.key, isAr()) }}
                </div>
              </div>
              <div v-else class="muted" style="font-size:12.5px;">{{ t('لا صلاحيات متاحة للمنح', 'No permissions available to grant') }}</div>
            </div>

            <div v-if="err" class="err"><Icon name="alert" /> {{ err }}</div>
          </div>
          <div class="m-foot">
            <button class="btn ghost" @click="show = false">{{ t('إلغاء', 'Cancel') }}</button>
            <button class="btn" :disabled="saving" @click="save">{{ saving ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ', 'Save') }}</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
