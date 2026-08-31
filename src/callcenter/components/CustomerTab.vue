<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { state, setOrderType, orderTypeBlocker, saveCustomer, cancelCustomerForm, selectAddress, selectNewAddressState, deleteAddress, canDeleteAddress, toggleBlacklist, canBlockCustomer, onAreaChange, selectRegion, selectSection, areaSections, sectionRequired, currentArea , companyDial } from '../store'
import { formatCurrency } from '../utils'
import { t, tx } from '../lang'
import { icon } from '../icons'

// ── كومبو المنطقة (searchable-select) ──
const comboOpen = ref(false)
const comboSearch = ref('')
// أنواع الطلب من الشركة (فارغة = ارتدادٌ لبطاقتَي توصيل/استلام)
// تحذيرُ نوع الطلب — نصٌّ جاهزٌ من المتجر (نفس نصّ حارس الإرسال، فلا يختلفان)
const typeWarn = computed<string | null>(() => orderTypeBlocker())

const comboRoot = ref<HTMLElement | null>(null)

interface AreaOpt { name: string; branchId: number; branchName: string }
const allAreas = computed<AreaOpt[]>(() => {
  const list: AreaOpt[] = []
  state.branches.forEach((b: any) => b.areas.forEach((a: string) => list.push({ name: a, branchId: b.id, branchName: b.name })))
  list.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  return list
})
const comboList = computed<AreaOpt[]>(() => {
  const q = comboSearch.value.trim().toLowerCase()
  if (!q) return allAreas.value
  return allAreas.value.filter(a => a.name.toLowerCase().includes(q))
})
function highlight(name: string): string {
  const q = comboSearch.value.trim().toLowerCase()
  if (!q) return name
  const idx = name.toLowerCase().indexOf(q)
  if (idx < 0) return name
  return name.slice(0, idx) + '<mark>' + name.slice(idx, idx + q.length) + '</mark>' + name.slice(idx + q.length)
}
function openCombo() { comboOpen.value = true; comboSearch.value = '' }
function closeCombo() { comboOpen.value = false }
function toggleAreaCombo() { comboOpen.value ? closeCombo() : openCombo() }
function selectAreaCombo(areaName: string) {
  state.form.area = areaName
  onAreaChange()
  closeCombo()
}
function handleOutside(e: MouseEvent) {
  if (comboOpen.value && comboRoot.value && !comboRoot.value.contains(e.target as Node)) closeCombo()
}
onMounted(() => document.addEventListener('click', handleOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleOutside))

// عناوين العميل (نقلاً عن renderCustomerAddresses)
const showAddressSelector = computed(() =>
  state.orderType === 'delivery' && state.currentCustomer && state.currentCustomer.addresses && state.currentCustomer.addresses.length > 0
)
const isDelivery = computed(() => state.orderType === 'delivery')
// كود اتصال دولة الشركة — يُضاف للرقم تلقائياً عند الإرسال
const dial = computed(() => companyDial())

// أحياء المدينة المختارة + خلاصة ما سيشتقّه الخادم (فرع + رسوم) لتظهر للوكيل
// قبل التأكيد بدل أن يكتشف بعد الإرسال أن الطلب لم ينزل أي فرع.
const sections = computed<any[]>(() => areaSections())
const placeInfo = computed<any>(() => {
  if (!state.live || !state.form.regionId) return null
  if (!state.selectedRegionBranchId) return { ok: false }
  const area = currentArea()
  const sec = (area?.sections || []).find((x: any) => x.id === state.form.sectionId) || null
  const link = sec || area
  const b = state.branches.find((x: any) => x.id === state.selectedRegionBranchId)
  return { ok: true, branch: b ? b.name : '—', fee: Number(link?.fee || 0), isFree: !!link?.isFree }
})

// سطر العنوان في بطاقات العناوين المسجّلة — يدعم شكل الـAPI (label/region/address) والمووك (area/block/…)
/** سطر المكان: «المدينة — الحيّ». هو عنوانُ البطاقة الحقيقيّ. */
function addressPlace(addr: any): string {
  if (!state.live) return String(addr.area || tx('عنوان محفوظ', 'Saved address'))
  const parts = [addr.region, addr.section].filter(Boolean).map(String)
  return parts.join(' — ') || String(addr.label || tx('عنوان محفوظ', 'Saved address'))
}

/**
 * سطر التفصيل: النصّ الحرّ ثم القطعة والشارع والمبنى والدور والشقّة.
 *
 * كانت البطاقة تُبنى بـ`addressLine` فتعرض الاسمَ والمدينةَ والنصّ الحرّ فقط —
 * والحقولُ الخمسة محفوظةٌ في القاعدة ولا تُعرَض، فيبدو العنوان كلمةً واحدة.
 */
function addressDetail(addr: any): string {
  if (!state.live) return addressLine(addr)
  const p: string[] = []
  if (addr.address) p.push(String(addr.address))
  if (addr.block) p.push(tx('ق ', 'Block ') + addr.block)
  if (addr.street) p.push(tx('ش ', 'St. ') + addr.street)
  if (addr.building) p.push(tx('مبنى ', 'Bldg ') + addr.building)
  if (addr.floor) p.push(tx('ط ', 'Floor ') + addr.floor)
  if (addr.apartment) p.push(tx('شقة ', 'Apt ') + addr.apartment)
  return p.join('، ')
}

function addressLine(addr: any): string {
  if (state.live) {
    const parts: string[] = []
    if (addr.label) parts.push(addr.label)
    if (addr.region) parts.push(addr.region)
    if (addr.address) parts.push(addr.address)
    return parts.join('، ') || '—'
  }
  let s = `${addr.area}، ق ${addr.block}، ش ${addr.street}، مبنى ${addr.building}`
  if (addr.floor) s += `، ط ${addr.floor}`
  if (addr.apartment) s += `، شقة ${addr.apartment}`
  return s
}
</script>

<template>
  <div id="panel-customer-data" class="tab-panel" :class="{ active: state.activeTab === 'customer-data' }">
    <!-- ── نوع الطلب: توصيل أو استلام — لا ثالث ────────────────────────────
         كان شريطُ أنواع الشركة يُعرض كما هي («صالة» · «عربية» · «طلبات»…)، وهي
         أنواعُ كاشيرٍ داخل الفرع لا يأخذها أحدٌ بالهاتف. الوكيل يختار الشكل،
         والنظام ينزّله بنوعه المعروف للفرع (توصيل=٥ · استلام=٦). -->
    <div class="order-type-selector">
      <button class="order-type-card btn-type-delivery" :class="{ active: state.orderType === 'delivery' }" @click="setOrderType('delivery')">
        <span class="order-type-icon" v-html="icon('bike', { size: 30 })"></span>
        <span class="order-type-text">
          <strong>{{ t('delivery_order') }}</strong>
          <small>{{ t('delivery_order_desc') }}</small>
        </span>
      </button>
      <button class="order-type-card btn-type-pickup" :class="{ active: state.orderType === 'pickup' }" @click="setOrderType('pickup')">
        <span class="order-type-icon" v-html="icon('store', { size: 30 })"></span>
        <span class="order-type-text">
          <strong>{{ t('pickup_order') }}</strong>
          <small>{{ t('pickup_order_desc') }}</small>
        </span>
      </button>
    </div>

    <!-- المنع يُقال هنا لا عند الإرسال: الوكيل يعرف قبل أن يبني الطلب كلّه -->
    <div v-if="typeWarn" class="ot-warn">
      <span v-html="icon('alert-triangle', { size: 14 })"></span>
      <span>{{ typeWarn }}</span>
    </div>
    <form id="customer-form" class="customer-form" @submit.prevent>
      <div class="form-group">
        <label for="cust-name">{{ tx('الاسم', 'Name') }}</label>
        <input type="text" id="cust-name" :placeholder="tx('اسم العميل', 'Customer name')" v-model="state.form.name">
      </div>
      <div class="form-group">
        <label for="cust-phone">{{ tx('رقم الهاتف', 'Mobile no.') }} <span v-if="dial" style="color:var(--primary); font-weight:700;" dir="ltr">+{{ dial }}</span></label>
        <input type="text" id="cust-phone" :placeholder="tx('رقم الهاتف', 'Mobile no.')" maxlength="15" v-model="state.form.phone">
      </div>
      <div class="form-group">
        <label for="cust-phone2">{{ tx('رقم آخر', 'Another number') }}</label>
        <input type="text" id="cust-phone2" :placeholder="tx('رقم إضافي (اختياري)', 'Additional number (optional)')" maxlength="15" v-model="state.form.phone2">
      </div>
      <div class="form-group" id="pickup-branch-group" v-show="state.orderType === 'pickup'" style="grid-column: 1 / -1;">
        <label for="cust-pickup-branch">{{ tx('فرع الاستلام', 'Pickup branch') }}</label>
        <select id="cust-pickup-branch" v-model="state.form.pickupBranch">
          <option value="">{{ tx('اختر فرع الاستلام', 'Choose a pickup branch') }}</option>
          <option v-for="b in state.branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>
      <div class="form-group full-width" id="address-selector-group" v-show="showAddressSelector" style="grid-column: 1 / -1;">
        <label>{{ tx('عناوين العميل المسجلة (اضغط للتحديد أو التعديل)', 'Saved customer addresses (click to select or edit)') }}</label>
        <div id="customer-addresses-list" class="customer-addresses-list">
          <div v-for="(addr, idx) in (state.currentCustomer?.addresses || [])" :key="idx" class="address-card" :class="{ selected: idx === state.selectedAddressIndex }" @click="selectAddress(idx)">
            <!-- رأسُ البطاقة صفٌّ واحد: الرقمُ والشارةُ في أوّله والحذفُ في آخره.
                 كان الحذف `position:absolute` في الزاوية نفسها التي تقف فيها شارة
                 «نشط» — فيركب أحدهما الآخر: «✔Acti🗑». الصفُّ العاديّ لا يتصادم. -->
            <div class="address-card-header">
              <span class="address-card-title">{{ tx('عنوان', 'Address') }} #{{ idx + 1 }}</span>
              <span v-if="idx === state.selectedAddressIndex" class="address-card-check">
                <span v-html="icon('check', { size: 11 })"></span>{{ tx('نشط', 'Active') }}
              </span>
              <span class="address-card-spacer"></span>
              <button v-if="canDeleteAddress()" type="button" class="address-card-delete-btn" @click="deleteAddress(idx, $event)" :title="tx('حذف العنوان', 'Delete address')" v-html="icon('trash', { size: 14 })"></button>
            </div>
            <!-- المكان أوّلاً وبأكبر خطٍّ في البطاقة: هو ما يميّز عنواناً عن آخر.
                 وكانت البطاقة تعرض «المدينة» وحدها فتظهر بكلمةٍ واحدة بلا معنى. -->
            <div class="address-card-place">{{ addressPlace(addr) }}</div>
            <div v-if="addressDetail(addr)" class="address-card-details">{{ addressDetail(addr) }}</div>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-new-address" @click="selectNewAddressState()" style="margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; width: auto; align-self: flex-start; background: var(--bg); color: var(--text-primary); border: 1.5px dashed var(--border);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="margin-inline-end:6px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>{{ t('add_new_address') }}</span>
        </button>
      </div>
      <!-- ── العنوان الحقيقي (contact API): مدينة ← حيّ يُشتقّ منهما الفرع والرسوم ── -->
      <div class="form-group" v-show="isDelivery && state.live">
        <label for="cust-region">{{ tx('المدينة', 'City') }}</label>
        <select id="cust-region" :value="state.form.regionId ?? ''" @change="selectRegion(($event.target as HTMLSelectElement).value)">
          <option value="">{{ tx('اختر المدينة', 'Choose a city') }}</option>
          <option v-for="r in state.regions" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </div>
      <!-- الحيّ: يتقدّم على المدينة في اشتقاق الفرع والرسوم، وإلزاميّ لمدينة غير مربوطة -->
      <div class="form-group" v-show="isDelivery && state.live && sections.length">
        <label for="cust-section">{{ tx('الحيّ', 'District') }} <span v-if="sectionRequired()" style="color:var(--danger);">*</span></label>
        <select id="cust-section" :value="state.form.sectionId ?? ''" @change="selectSection(($event.target as HTMLSelectElement).value)">
          <option value="">{{ sectionRequired() ? tx('اختر الحيّ (إلزامي)', 'Choose a district (required)') : tx('كل المدينة', 'Whole city') }}</option>
          <option v-for="sec in sections" :key="sec.id" :value="sec.id">{{ sec.name }}</option>
        </select>
      </div>
      <!-- الفرع المشتق ورسومه — أو تحذير صريح بدل طلب يُحتجَز بصمت -->
      <div class="form-group full-width" v-if="placeInfo" style="grid-column: 1 / -1;">
        <div v-if="placeInfo.ok" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:8px 12px; border-radius:8px; background:var(--success-light, #ecfdf5); border:1px solid var(--success, #10b981); font-size:13px;">
          <span style="font-weight:700; color:var(--success, #047857);">{{ tx('الفرع:', 'Branch:') }} {{ placeInfo.branch }}</span>
          <span style="color:var(--text-secondary);">·</span>
          <span style="font-weight:700;">
            {{ placeInfo.isFree ? tx('توصيل مجاني', 'Free delivery') : (placeInfo.fee > 0 ? `${tx('رسوم التوصيل:', 'Delivery fee:')} ${formatCurrency(placeInfo.fee)}` : tx('رسوم مفتوحة — يحدّدها الفرع', 'Open fee — set by the branch')) }}
          </span>
        </div>
        <div v-else style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; background:var(--danger-light, #fef2f2); border:1px solid var(--danger, #ef4444); font-size:13px; font-weight:700; color:var(--danger, #b91c1c);">
          {{ sectionRequired() && !state.form.sectionId ? tx('اختر الحيّ — الفرع بيتحدد منه', 'Choose the district — the branch is derived from it') : tx('مفيش فرع بيخدم المكان ده — اختر مكان تاني أو حدّد الفرع يدوياً', 'No branch serves this location — pick another place or set the branch manually') }}
        </div>
      </div>
      <div class="form-group full-width" v-show="isDelivery && state.live" style="grid-column: 1 / -1;">
        <label for="cust-address-text">{{ tx('العنوان بالتفصيل', 'Full address') }}</label>
        <textarea id="cust-address-text" :placeholder="tx('اكتب العنوان بالتفصيل (المبنى، الشارع، علامة مميزة...)', 'Write the full address (building, street, landmark…)')" rows="3" v-model="state.form.addressText"></textarea>
      </div>

      <!-- ── العنوان التجريبي (المووك): منطقة من الفروع + حقول تفصيلية ── -->
      <div class="form-group" v-show="isDelivery && !state.live">
        <label for="cust-area">{{ t('area_label') }}</label>
        <div class="searchable-select" :class="{ open: comboOpen }" id="area-combo" ref="comboRoot">
          <button type="button" class="searchable-select-trigger" id="area-combo-trigger" @click="toggleAreaCombo()">
            <span class="searchable-select-value" :class="{ placeholder: !state.form.area }" id="area-combo-value">{{ state.form.area || tx('اختر المنطقة', 'Choose an area') }}</span>
            <svg class="searchable-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="searchable-select-popup" :class="{ hidden: !comboOpen }" id="area-combo-popup">
            <div class="searchable-select-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="area-combo-search" :placeholder="tx('ابحث عن منطقة...', 'Search for an area…')" autocomplete="off" v-model="comboSearch">
            </div>
            <div class="searchable-select-list" id="area-combo-list">
              <button v-for="opt in comboList" :key="opt.name" type="button" class="searchable-select-option" :class="{ selected: opt.name === state.form.area }" @click="selectAreaCombo(opt.name)">
                <span v-html="highlight(opt.name)"></span>
                <span class="opt-branch">{{ opt.branchName }}</span>
              </button>
            </div>
            <div class="searchable-select-empty" :class="{ hidden: comboList.length !== 0 }" id="area-combo-empty">{{ tx('لا توجد منطقة بهذا الاسم', 'No area with that name') }}</div>
          </div>
        </div>
      </div>
      <div class="form-group" v-show="isDelivery">
        <label for="cust-block">{{ t('block_label') }}</label>
        <input type="text" id="cust-block" :placeholder="tx('رقم القطعة', 'Block no.')" v-model="state.form.block">
      </div>
      <div class="form-group" v-show="isDelivery">
        <label for="cust-street">{{ t('street_label') }}</label>
        <input type="text" id="cust-street" :placeholder="tx('رقم أو اسم الشارع', 'Street no. or name')" v-model="state.form.street">
      </div>
      <div class="form-group" v-show="isDelivery">
        <label for="cust-building">{{ t('building_label') }}</label>
        <input type="text" id="cust-building" :placeholder="tx('رقم المبنى', 'Building no.')" v-model="state.form.building">
      </div>
      <div class="form-group" v-show="isDelivery">
        <label for="cust-floor">{{ t('floor_label') }}</label>
        <input type="text" id="cust-floor" :placeholder="tx('الطابق', 'Floor')" v-model="state.form.floor">
      </div>
      <div class="form-group" v-show="isDelivery">
        <label for="cust-apartment">{{ t('apartment_label') }}</label>
        <input type="text" id="cust-apartment" :placeholder="tx('رقم الشقة', 'Apartment no.')" v-model="state.form.apartment">
      </div>
      <div class="form-group full-width">
        <label for="cust-notes">{{ t('customer_notes_label') }}</label>
        <textarea id="cust-notes" :placeholder="t('customer_notes_placeholder')" rows="3" v-model="state.form.notes"></textarea>
      </div>
      <div class="form-group">
        <div class="checkbox-group">
          <!-- الخانة قرارٌ على الخادم لا علامةٌ محلّية: تُكتب فوراً، وتختفي لمن لا يملك مفتاحها -->
          <input type="checkbox" id="cust-blacklist" :checked="state.form.blacklist" :disabled="!canBlockCustomer()"
            @change="toggleBlacklist(($event.target as HTMLInputElement).checked)">
          <label for="cust-blacklist">{{ t('blacklist_label') }}</label>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-lg" @click="saveCustomer()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-inline-end:6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>{{ t('save_data') }}</span>
        </button>
        <button type="button" class="btn btn-secondary btn-lg" @click="cancelCustomerForm()">
          <span>{{ t('cancel') }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* شريط أنواع الطلب — بديلُ البطاقتين حين تُعرِّف الشركة أنواعها */
/* تحذير نوع الطلب: تنبيهٌ لا خطأ — الطلب لم يُرسَل بعد */
.ot-warn {
  display: flex; align-items: center; gap: 8px;
  margin: 10px 0 0; padding: 10px 12px;
  border-radius: 10px; font-size: 12.5px; font-weight: 700;
  color: #b45309; background: #fef3c7; border: 1px solid #fde68a;
}
body.dark-mode .ot-warn { color: #fbbf24; background: #451a03; border-color: #78350f; }
</style>
