<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  state, availabilityGroups, toggleBranchItemAvailability,
  onAvailabilityBranchChange, onAvailabilityCategoryChange, onAvailabilitySearchChange,
  canOrderSettings, canManageItemAvailability, canEditStages, canViewStopped, showToast,
} from '../store'
import { contactSetOrderPolicy } from '../../api'
import { tx, lang, nameOf, altNameOf } from '../lang'
import { icon } from '../icons'

// ── سياسة أخذ الطلب: هل طريقة الدفع إلزاميّة قبل نزوله للفرع؟ ─────────────
// الافتراضي **اختياريّة**: كثيرٌ من التشغيل يحصّل على الباب، فتُحدَّد الطريقة عند
// التسليم لا عند أخذ الطلب. والشركة تُلزِم بها إن أرادت — قرارها لا حكمٌ نفرضه.
const paySaving = ref(false)
const payErr = ref('')
async function setPayRequired(v: boolean) {
  if (paySaving.value || v === state.paymentRequired) return
  const prev = state.paymentRequired
  state.paymentRequired = v; paySaving.value = true; payErr.value = ''
  try {
    await contactSetOrderPolicy({ paymentRequired: v })
    showToast(v ? tx('طريقة الدفع صارت إلزاميّة', 'Payment method is now required')
                : tx('طريقة الدفع صارت اختياريّة', 'Payment method is now optional'), 'success')
  } catch (e: any) {
    state.paymentRequired = prev   // الخادم رفض ⇒ الشاشة تعود لما هو محفوظ فعلاً
    payErr.value = e?.response?.data?.message || tx('تعذّر الحفظ', 'Could not save')
  } finally { paySaving.value = false }
}

// ── مراحل السماح بتعديل الطلب ─────────────────────────────────────────────
// كان الحدُّ مثبَّتاً في الكود: التعديل حتى «تحضير». صار قرارَ الشركة — فمن يريد
// المنع بمجرّد نزول الطلب الفرع، ومن يريد السماح حتى وهو جاهز، كلٌّ يضبطه.
const EDIT_STAGES = [
  { id: 'sent',      ar: 'قبل نزوله للفرع', en: 'Before it reaches the branch' },
  { id: 'new',       ar: 'جديد عند الفرع',   en: 'New at the branch' },
  { id: 'preparing', ar: 'جاري التحضير',     en: 'Being prepared' },
  { id: 'ready',     ar: 'جاهز',             en: 'Ready' },
]
const stagesSaving = ref(false)
const stagesErr = ref('')
async function toggleStage(id: string, on: boolean) {
  if (stagesSaving.value) return
  const prev = [...(state.editStages || [])]
  const next = on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
  state.editStages = next; stagesSaving.value = true; stagesErr.value = ''
  try {
    const r = await contactSetOrderPolicy({ editStages: next })
    if (Array.isArray(r?.editStages)) state.editStages = r.editStages.filter((x: any) => x !== 'none')
    showToast(tx('تم حفظ مراحل التعديل', 'Edit stages saved'), 'success')
  } catch (e: any) {
    state.editStages = prev   // الخادم رفض ⇒ الشاشة تعود لما هو محفوظ فعلاً
    stagesErr.value = e?.response?.data?.message || tx('تعذّر الحفظ', 'Could not save')
  } finally { stagesSaving.value = false }
}

const groups = computed<any[]>(() => availabilityGroups())
const totalShown = computed<number>(() => groups.value.reduce((sum, g) => sum + g.items.length, 0))

// الرفض (نقص صلاحية / إيقاف من المطبخ) يترك المفتاح مقلوباً في الـDOM لأن القيمة
// التفاعلية لم تتغيّر فلا يُعيد Vue رسمه — نُعيده بأنفسنا.
function onToggle(row: any, ev: Event) {
  const el = ev.target as HTMLInputElement
  const ok = toggleBranchItemAvailability(state.availBranchId, row.item.id, el.checked)
  if (!ok) el.checked = row.isAvailable
}
</script>

<template>
  <section id="view-settings" class="view active">
    <div class="settings-section">
      <h2 class="dashboard-title" style="margin-bottom: 24px;">{{ tx('الإعدادات', 'Settings') }}</h2>
      <!-- شاشةٌ بلا بطاقةٍ واحدة: تُقال صراحةً بدل بياضٍ يُقرأ خطأً -->
      <p v-if="!canOrderSettings() && !canEditStages() && !canViewStopped() && !canManageItemAvailability()"
        class="settings-none">
        {{ tx('لا تملك صلاحية أيٍّ من إعدادات مركز الاتصال.', 'You have no permission for any call-center setting.') }}
      </p>

      <!-- سياسة أخذ الطلب — بمفتاحها المستقلّ: من يفتح اليوم لا يغيّر سياسة التحصيل -->
      <div v-if="canOrderSettings() || canEditStages()" class="settings-card">
        <h3 class="settings-card-title">{{ tx('سياسة أخذ الطلب', 'Order-taking policy') }}</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">
          {{ tx('طريقة الدفع اختياريّة افتراضياً — الوكيل يبعت الطلب للفرع ويُحدَّد التحصيل عند التسليم. فعّل الإلزام لو شركتك تريد الطريقة محدَّدةً قبل نزول الطلب.', 'The payment method is optional by default — the agent sends the order and collection is decided on delivery. Turn on the requirement if your company wants it set before the order reaches the branch.') }}
        </p>
        <div class="pay-req-row">
          <label class="availability-switch" :style="paySaving ? 'opacity:.5; cursor:progress;' : ''">
            <input type="checkbox" :checked="state.paymentRequired" :disabled="paySaving"
                   @change="setPayRequired(($event.target as HTMLInputElement).checked)">
            <span class="availability-slider"></span>
          </label>
          <div class="pay-req-txt">
            <strong>{{ tx('إلزام اختيار طريقة الدفع', 'Require a payment method') }}</strong>
            <span>{{ state.paymentRequired
              ? tx('الطلب لا ينزل للفرع بلا طريقة دفع.', 'The order will not reach the branch without a payment method.')
              : tx('الوكيل يقدر يبعت الطلب بلا طريقة دفع.', 'The agent may send the order without a payment method.') }}</span>
          </div>
        </div>
        <p v-if="payErr" class="pay-req-err">{{ payErr }}</p>

        <!-- مراحل التعديل: أسطرٌ لا حبّات — كلُّ سطرٍ قرارٌ مستقلّ يُقرأ وحده -->
        <template v-if="canEditStages()">
        <h4 class="stages-title">{{ tx('مراحل السماح بتعديل الطلب', 'Stages where editing is allowed') }}</h4>
        <p class="stages-hint">
          {{ tx('الوكيل يقدر يعدّل الطلب في المراحل المختارة فقط. وما بعد التسليم أو الإقفال لا يُعدَّل مهما اخترت.', 'Agents can edit an order only in the selected stages. After delivery or closing it cannot be edited whatever you pick.') }}
        </p>
        <div class="stages-list">
          <label v-for="s in EDIT_STAGES" :key="s.id" class="stage-row" :style="stagesSaving ? 'opacity:.5; cursor:progress;' : ''">
            <input type="checkbox" :checked="(state.editStages || []).includes(s.id)" :disabled="stagesSaving"
                   @change="toggleStage(s.id, ($event.target as HTMLInputElement).checked)">
            <span>{{ lang === 'ar' ? s.ar : s.en }}</span>
          </label>
        </div>
        <p v-if="!(state.editStages || []).length" class="stages-none">{{ tx('لا تعديل بعد إرسال الطلب إطلاقاً.', 'No editing at all once the order is sent.') }}</p>
        <p v-if="stagesErr" class="pay-req-err">{{ stagesErr }}</p>
        </template>
      </div>

      <div v-if="canViewStopped()" class="settings-card">
        <h3 class="settings-card-title">{{ tx('إدارة الأصناف', 'Item management') }}</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">{{ tx('عرض الأصناف الموقوفة في كل الفروع', 'View stopped items across all branches') }}</p>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn btn-secondary" @click="state.activeView = 'stopped-items'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-inline-end:6px;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            {{ tx('الأصناف الموقوفة', 'Stopped items') }}
          </button>
        </div>
      </div>

      <div v-if="canManageItemAvailability()" class="settings-card">
        <h3 class="settings-card-title">{{ tx('إدارة توفر الأصناف بالفروع', 'Item availability per branch') }}</h3>
        <p v-if="lang === 'ar'" style="color: var(--text-secondary); margin-bottom: 16px;">اختر فرعاً وتصنيف الأصناف لتعطيل أو تنشيط الأصناف لموظفي مركز الاتصال. الإيقاف من هنا <strong>لا يصل الفرع</strong> — الكاشير يبيع الصنف عادي. أما الموقوف من مطبخ الفرع فمفتاحه مقفول وتشغيله يكون من الفرع.</p>
          <p v-else style="color: var(--text-secondary); margin-bottom: 16px;">Pick a branch and a category to stop or resume items for call-center agents. Stopping here <strong>never reaches the branch</strong> — the cashier still sells the item. Items stopped by the branch kitchen are locked here and can only be resumed at the branch.</p>

        <div class="availability-filters-bar">
          <div class="availability-filter">
            <label class="availability-filter-label" for="settings-availability-branch">
              <span class="inline-ico" v-html="icon('store', { size: 13 })"></span> {{ tx('الفرع المستهدف', 'Target branch') }}
            </label>
            <div class="availability-filter-input">
              <select id="settings-availability-branch" :value="state.availBranchId" @change="onAvailabilityBranchChange(($event.target as HTMLSelectElement).value)">
                <option v-for="b in state.branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>   <!-- الاسم مُنتقًى باللغة في المتجر -->
              </select>
              <span class="availability-filter-chev inline-ico" v-html="icon('chevron-down', { size: 13 })"></span>
            </div>
          </div>

          <div class="availability-filter">
            <label class="availability-filter-label" for="settings-availability-category">
              <span class="inline-ico" v-html="icon('layers', { size: 13 })"></span> {{ tx('التصنيف', 'Category') }}
            </label>
            <div class="availability-filter-input">
              <select id="settings-availability-category" :value="state.availCategory" @change="onAvailabilityCategoryChange(($event.target as HTMLSelectElement).value)">
                <option value="all">{{ tx('كل التصنيفات', 'All categories') }}</option>
                <option v-for="cat in state.menuCategories.filter((c: any) => c.id !== 'all')" :key="cat.id" :value="cat.id">{{ cat.icon }} {{ nameOf(cat) }}</option>
              </select>
              <span class="availability-filter-chev inline-ico" v-html="icon('chevron-down', { size: 13 })"></span>
            </div>
          </div>

          <div class="availability-filter availability-filter-search">
            <label class="availability-filter-label" for="settings-availability-search">
              <span class="inline-ico" v-html="icon('search', { size: 13 })"></span> {{ tx('بحث', 'Search') }}
            </label>
            <div class="availability-filter-input">
              <input type="text" id="settings-availability-search" :placeholder="tx('ابحث باسم الصنف...', 'Search by item name…')" :value="state.availSearch" @input="onAvailabilitySearchChange(($event.target as HTMLInputElement).value)" />
            </div>
          </div>
        </div>

        <div id="settings-branch-items-list" class="settings-branch-items-list">
          <div v-if="totalShown === 0" class="settings-empty">
            <span class="inline-ico" v-html="icon('search', { size: 14 })"></span>
            <div>{{ tx('لا توجد أصناف تطابق الفلتر الحالي', 'No items match the current filter') }}</div>
          </div>
          <div v-for="group in groups" :key="group.cat.id" class="settings-cat-section">
            <h4 class="settings-cat-title">
              <span>{{ group.cat.icon }}</span>
              <!-- الاسم الأوّل بلغة الواجهة والثاني بين قوسين — كان العربيُّ أوّلاً دائماً -->
              <span>{{ nameOf(group.cat) }}<template v-if="altNameOf(group.cat)"> ({{ altNameOf(group.cat) }})</template></span>
              <span class="settings-cat-count">{{ group.items.length }}</span>
            </h4>
            <div class="settings-items-grid">
              <div v-for="row in group.items" :key="row.item.id" class="settings-item-row">
                <div class="settings-item-row-info">
                  <span class="settings-item-row-name">
                    {{ nameOf(row.item) }}
                    <span v-if="row.fromPos" style="margin-inline-start:6px; font-size:10px; font-weight:700; color:var(--danger, #b91c1c);">{{ tx('موقوف من المطبخ', 'Stopped by the kitchen') }}</span>
                  </span>
                  <span class="settings-item-row-name-en">{{ altNameOf(row.item) }}</span>
                </div>
                <label class="availability-switch" :title="row.fromPos ? tx('موقوف من مطبخ الفرع — تشغيله يكون من الفرع', 'Stopped by the branch kitchen — it can only be resumed at the branch') : ''" :style="row.fromPos ? 'opacity:.45; cursor:not-allowed;' : ''">
                  <input type="checkbox" :checked="row.isAvailable" :disabled="row.fromPos" @change="onToggle(row, $event)">
                  <span class="availability-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stages-title { margin: 18px 0 4px; font-size: 13.5px; font-weight: 800; color: var(--text-primary, #0f172a); }
.stages-hint { color: var(--text-secondary, #64748b); font-size: 12.5px; margin-bottom: 10px; line-height: 1.6; }
.stages-list { display: flex; flex-direction: column; gap: 8px; }
.stage-row { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.stage-row input { width: 16px; height: 16px; cursor: inherit; }
.stages-none { margin-top: 8px; font-size: 12.5px; font-weight: 700; color: #b45309; }
.pay-req-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pay-req-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pay-req-txt strong { font-size: 13.5px; font-weight: 800; line-height: 1.35; }
.pay-req-txt span { font-size: 12px; font-weight: 600; line-height: 1.4; color: var(--text-secondary); }
.pay-req-err {
  margin: 10px 0 0; padding: 8px 11px;
  border-radius: var(--radius-sm);
  background: var(--danger-light); color: var(--danger);
  font-size: 12px; font-weight: 700;
}

.settings-none { font-size: 13px; font-weight: 700; color: var(--text-muted, #94a3b8); }
</style>
