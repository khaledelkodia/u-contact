<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { state, setOrderType, saveCustomer, cancelCustomerForm, selectAddress, selectNewAddressState, deleteAddress, onAreaChange, selectRegion, selectSection, areaSections, sectionRequired, currentArea , companyDial } from '../store'
import { formatCurrency } from '../utils'
import { t, tx } from '../lang'
import { icon } from '../icons'

// ── كومبو المنطقة (searchable-select) ──
const comboOpen = ref(false)
const comboSearch = ref('')
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
    <div class="order-type-selector">
      <button class="order-type-card btn-type-delivery" :class="{ active: state.orderType === 'delivery' }" @click="setOrderType('delivery')">
        <span class="order-type-icon">
          <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="3" y="9" width="9" height="9" rx="1.5" fill="#fb923c" stroke="#c2410c" stroke-width="1.4"/>
            <line x1="3" y1="13" x2="12" y2="13" stroke="#c2410c" stroke-width="1.4" stroke-linecap="round"/>
            <line x1="7.5" y1="9" x2="7.5" y2="18" stroke="#c2410c" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M12 13h5l2.5-5H24" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <line x1="24" y1="8" x2="24" y2="13" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
            <path d="M12.2 18l3.6 5" stroke="#1e3a8a" stroke-width="2" stroke-linecap="round"/>
            <path d="M19.8 13.5l3.2 7.3" stroke="#1e3a8a" stroke-width="2" stroke-linecap="round"/>
            <circle cx="9" cy="24" r="3.2" fill="#334155" stroke="#0f172a" stroke-width="1.2"/>
            <circle cx="9" cy="24" r="1.1" fill="#22d3ee"/>
            <circle cx="23" cy="24" r="3.2" fill="#334155" stroke="#0f172a" stroke-width="1.2"/>
            <circle cx="23" cy="24" r="1.1" fill="#22d3ee"/>
          </svg>
        </span>
        <span class="order-type-text">
          <strong>{{ t('delivery_order') }}</strong>
          <small>{{ t('delivery_order_desc') }}</small>
        </span>
      </button>
      <button class="order-type-card btn-type-pickup" :class="{ active: state.orderType === 'pickup' }" @click="setOrderType('pickup')">
        <span class="order-type-icon">
          <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="8.5" cy="7" r="2.7" fill="#14b8a6" stroke="#0f766e" stroke-width="1.3"/>
            <path d="M4.7 23v-5.4a3.8 3.8 0 0 1 3.8-3.8h0a3.8 3.8 0 0 1 3.8 3.8V23z" fill="#5eead4" stroke="#0f766e" stroke-width="1.3" stroke-linejoin="round"/>
            <circle cx="23.5" cy="7" r="2.7" fill="#3b82f6" stroke="#1e40af" stroke-width="1.3"/>
            <path d="M27.3 23v-5.4a3.8 3.8 0 0 0-3.8-3.8h0a3.8 3.8 0 0 0-3.8 3.8V23z" fill="#93c5fd" stroke="#1e40af" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M14 17.5v-1.2a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1.2" fill="none" stroke="#92400e" stroke-width="1.4" stroke-linecap="round"/>
            <rect x="12.5" y="17.5" width="7" height="7.5" rx="1.2" fill="#f59e0b" stroke="#92400e" stroke-width="1.3"/>
            <line x1="14" y1="20" x2="18" y2="20" stroke="#92400e" stroke-width="1.1" stroke-linecap="round"/>
          </svg>
        </span>
        <span class="order-type-text">
          <strong>{{ t('pickup_order') }}</strong>
          <small>{{ t('pickup_order_desc') }}</small>
        </span>
      </button>
    </div>
    <form id="customer-form" class="customer-form" @submit.prevent>
      <div class="form-group">
        <label for="cust-name">{{ tx('الاسم', 'Name') }}</label>
        <input type="text" id="cust-name" :placeholder="tx('اسم العميل', 'Customer name')" v-model="state.form.name">
      </div>
      <div class="form-group">
        <label for="cust-phone">{{ tx('رقم الموبايل', 'Mobile no.') }} <span v-if="dial" style="color:var(--primary); font-weight:700;" dir="ltr">+{{ dial }}</span></label>
        <input type="text" id="cust-phone" :placeholder="tx('رقم الموبايل', 'Mobile no.')" maxlength="15" v-model="state.form.phone">
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
            <div class="address-card-header">
              <span class="address-card-title">{{ tx('عنوان', 'Address') }} #{{ idx + 1 }}</span>
              <span v-if="idx === state.selectedAddressIndex" class="address-card-check"><span v-html="icon('check', { size: 12 })"></span> {{ tx('نشط', 'Active') }}</span>
            </div>
            <div class="address-card-details">{{ addressLine(addr) }}</div>
            <button type="button" class="address-card-delete-btn" @click="deleteAddress(idx, $event)" :title="tx('حذف العنوان', 'Delete address')" v-html="icon('trash', { size: 14 })"></button>
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
      <!-- الفرع المشتق ورسومه — أو تحذير صريح بدل أوردر يُحتجَز بصمت -->
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
          <input type="checkbox" id="cust-blacklist" v-model="state.form.blacklist">
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
