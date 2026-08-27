<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import api, { currentCompany } from '../../api'
import { t, isAr } from '../../i18n'
import Icon from '../../components/Icon.vue'

const cur = computed(() => currentCompany())
const can = (p: string) => !!cur.value?.permissions?.includes(p)

const err = ref('')

// ── يوم العمل ──────────────────────────────────────────────────────────────────
const day = ref<any>(null)
const dayBusy = ref(false)
async function loadDay() { try { day.value = (await api.get('/contact/business-day/current')).data } catch { day.value = null } }
async function openDay() {
  dayBusy.value = true; err.value = ''
  try { day.value = (await api.post('/contact/business-day/open', {})).data }
  catch (e: any) { err.value = e?.response?.data?.message || t('تعذّر فتح اليوم', 'Could not open day') }
  finally { dayBusy.value = false }
}
const dayOpen = computed(() => day.value && day.value.status === 'open')

// ── قائمة الطلبات ────────────────────────────────────────────────────────────
const orders = ref<any[]>([])
const loading = ref(false)
async function loadOrders(silent = false) {
  if (!silent) loading.value = true
  try { orders.value = (await api.get('/contact/orders', { params: { limit: 100 } })).data }
  catch (e: any) { if (!silent) err.value = e?.response?.data?.message }
  finally { loading.value = false }
}

// ── lookups (تُحمّل عند فتح الفورم) ──────────────────────────────────────────────
const regions = ref<any[]>([])
const branches = ref<any[]>([])
async function loadLookups() {
  try {
    const [rg, br] = await Promise.all([api.get('/contact/lookup/regions'), api.get('/contact/lookup/branches')])
    regions.value = rg.data; branches.value = br.data
  } catch { /* غير حاسم */ }
}

// ── فورم طلب جديد ──────────────────────────────────────────────────────────────
const show = ref(false)
const saving = ref(false)
const form = reactive<any>({ customerPhone: '', customerName: '', regionId: null, branchId: null, addressText: '', paymentMode: 'cash_on_delivery', notes: '', items: [] })
const custMatches = ref<any[]>([])
const custAddresses = ref<any[]>([])

function openForm() {
  Object.assign(form, { customerPhone: '', customerName: '', regionId: null, branchId: null, addressText: '', paymentMode: 'cash_on_delivery', notes: '', items: [] })
  custMatches.value = []; custAddresses.value = []; prodQuery.value = ''; prodResults.value = []; err.value = ''
  show.value = true; loadLookups()
}

// بحث عميل بالهاتف (debounce)
let custTimer: any
function onPhone() {
  clearTimeout(custTimer)
  custTimer = setTimeout(async () => {
    const p = String(form.customerPhone || '').trim()
    if (p.length < 3) { custMatches.value = []; return }
    try { custMatches.value = (await api.get('/contact/lookup/customers', { params: { phone: p } })).data } catch { custMatches.value = [] }
  }, 300)
}
function pickCustomer(c: any) {
  form.customerName = c.name; form.customerPhone = c.phone
  custAddresses.value = c.addresses || []; custMatches.value = []
  const d = custAddresses.value.find((a: any) => a.isDefault) || custAddresses.value[0]
  if (d) { form.addressText = d.address || ''; if (d.region) matchRegion(d.region) }
}
function matchRegion(name: string) { const r = regions.value.find((x) => x.name === name); if (r) form.regionId = r.id }
function useAddress(a: any) { form.addressText = a.address || ''; if (a.region) matchRegion(a.region) }

// المنطقة → الفرع المشتق + الرسوم
const selectedRegion = computed(() => regions.value.find((r) => r.id === form.regionId))
const targetBranch = computed(() => {
  if (form.branchId) return branches.value.find((b) => b.id === form.branchId)
  const r = selectedRegion.value
  return r?.branchId ? branches.value.find((b) => b.id === r.branchId) : null
})
const deliveryFee = computed(() => selectedRegion.value?.fee || 0)

// منتقي الأصناف (debounce)
const prodQuery = ref('')
const prodResults = ref<any[]>([])
let prodTimer: any
function onProdSearch() {
  clearTimeout(prodTimer)
  prodTimer = setTimeout(async () => {
    const q = String(prodQuery.value || '').trim()
    if (!q) { prodResults.value = []; return }
    try { prodResults.value = (await api.get('/contact/lookup/products', { params: { q } })).data } catch { prodResults.value = [] }
  }, 300)
}
function addItem(p: any) {
  const ex = form.items.find((i: any) => i.productId === p.id)
  if (ex) ex.quantity++
  else form.items.push({ productId: p.id, productName: p.nameAr, productNameEn: p.nameEn, unitPrice: p.price, quantity: 1 })
  prodQuery.value = ''; prodResults.value = []
}
function removeItem(i: number) { form.items.splice(i, 1) }
const itemsTotal = computed(() => form.items.reduce((s: number, i: any) => s + Number(i.unitPrice) * i.quantity, 0))
const grandTotal = computed(() => itemsTotal.value + Number(deliveryFee.value))

async function submit() {
  if (!String(form.customerPhone).trim()) { err.value = t('هاتف العميل مطلوب', 'Customer phone required'); return }
  if (!form.items.length) { err.value = t('أضف صنف واحد على الأقل', 'Add at least one item'); return }
  saving.value = true; err.value = ''
  try {
    await api.post('/contact/orders', {
      customerPhone: String(form.customerPhone).trim(),
      customerName: String(form.customerName).trim() || String(form.customerPhone).trim(),
      regionId: form.regionId || null, regionName: selectedRegion.value?.name || null,
      branchId: form.branchId || null, addressText: form.addressText || null,
      orderTypeCode: 5, paymentMode: form.paymentMode, notes: form.notes || null,
      items: form.items.map((i: any) => ({ productId: i.productId, productName: i.productName, productNameEn: i.productNameEn, quantity: i.quantity, unitPrice: i.unitPrice })),
    })
    show.value = false; await loadOrders()
  } catch (e: any) { err.value = e?.response?.data?.message || t('فشل إنشاء الطلب', 'Failed to create order') }
  finally { saving.value = false }
}

// ── عرض الحالة ───────────────────────────────────────────────────────────────────
function posLabel(s: string) {
  const m: Record<string, string> = { new: t('جديد', 'New'), preparing: t('بيتجهّز', 'Preparing'), ready: t('جاهز', 'Ready'), delivered: t('اتسلّم', 'Delivered'), completed: t('مكتمل', 'Completed'), closed: t('مقفول', 'Closed'), cancelled: t('ملغي', 'Cancelled') }
  return m[s] || s
}
function statusText(o: any) {
  if (o.status === 'held') return t('محتاج فرع', 'Needs branch')
  if (o.status === 'pending') return t('بانتظار نزول الفرع', 'Pending')
  if (o.status === 'cancelled') return t('ملغي', 'Cancelled')
  return o.posStatus ? posLabel(o.posStatus) : t('نزل الفرع', 'At branch')
}
function statusTone(o: any) {
  if (o.status === 'held' || o.status === 'cancelled') return 'off'
  if (o.status === 'pending') return 'wait'
  if (['delivered', 'completed', 'closed'].includes(o.posStatus)) return 'on'
  return 'go'
}
function money(v: any) { return Number(v || 0).toLocaleString(isAr() ? 'ar-EG' : 'en-US') }
function fmtTime(d: any) { return d ? new Date(d).toLocaleTimeString(isAr() ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '—' }

let poll: any
onMounted(() => { loadDay(); loadOrders(); poll = setInterval(() => loadOrders(true), 15000) })
onBeforeUnmount(() => { if (poll) clearInterval(poll) })
</script>

<template>
  <div class="content">
    <div class="page-head">
      <div>
        <div class="t"><Icon name="cart" /> {{ t('الطلبات', 'Orders') }}</div>
        <div class="d">{{ t('استقبل الطلب وابعته للفرع، وتابع حالته والسائق لحظياً', 'Take orders, send to the branch, track status & driver live') }}</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center">
        <button class="btn ghost sm" @click="loadOrders()"><Icon name="clock" /> {{ t('تحديث', 'Refresh') }}</button>
        <button v-if="can('callcenter.create')" class="btn" :disabled="!dayOpen" @click="openForm"><Icon name="plus" /> {{ t('طلب جديد', 'New order') }}</button>
      </div>
    </div>

    <p v-if="err" class="err">{{ err }}</p>

    <!-- بانر يوم العمل -->
    <div v-if="!dayOpen" class="card pad" style="margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:12px">
      <div class="muted">{{ t('يوم الكول‑سنتر مقفول — افتحه عشان تبدأ تستقبل طلبات.', 'Call-center day is closed — open it to start taking orders.') }}</div>
      <button v-if="can('callcenter.open')" class="btn" :disabled="dayBusy" @click="openDay">{{ t('افتح يوم العمل', 'Open day') }}</button>
    </div>
    <div v-else class="chip soft" style="margin-bottom:14px"><Icon name="check" /> {{ t('يوم مفتوح', 'Day open') }} · {{ String(day.businessDate).slice(0, 10) }}</div>

    <!-- قائمة الطلبات -->
    <div class="card">
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{{ t('العميل', 'Customer') }}</th>
              <th>{{ t('الفرع', 'Branch') }}</th>
              <th>{{ t('الإجمالي', 'Total') }}</th>
              <th>{{ t('الحالة', 'Status') }}</th>
              <th>{{ t('السائق', 'Driver') }}</th>
              <th>{{ t('الوقت', 'Time') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="muted" style="text-align:center; padding:22px">{{ t('جارٍ التحميل…', 'Loading…') }}</td></tr>
            <tr v-else-if="!orders.length"><td colspan="7"><div class="empty"><div class="ic"><Icon name="cart" /></div>{{ t('مفيش طلبات لسه', 'No orders yet') }}</div></td></tr>
            <tr v-for="o in orders" :key="o.id">
              <td class="t-strong">{{ o.posOrderId || o.id }}</td>
              <td>
                <div class="t-strong">{{ o.customerName }}</div>
                <div class="muted" style="font-size:12px" dir="ltr">{{ o.customerPhone }}</div>
              </td>
              <td>{{ o.branchName || '—' }}</td>
              <td class="t-strong" dir="ltr">{{ money(o.total) }}</td>
              <td><span class="badge" :class="statusTone(o)">{{ statusText(o) }}</span></td>
              <td>
                <span v-if="o.driverName" class="chip soft"><Icon name="bike" /> {{ o.driverName }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="muted" style="font-size:12px">{{ fmtTime(o.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- مودال طلب جديد -->
    <div v-if="show" class="modal-bg" @click.self="show = false">
      <div class="modal" style="max-width:760px">
        <div class="m-head">
          <span><Icon name="cart" /> {{ t('طلب جديد', 'New order') }}</span>
          <button class="btn icon subtle" @click="show = false"><Icon name="x" /></button>
        </div>
        <div class="m-body">
          <!-- العميل -->
          <div class="field">
            <label><Icon name="phone" /> {{ t('هاتف العميل', 'Customer phone') }}</label>
            <input class="input" dir="ltr" v-model="form.customerPhone" @input="onPhone" :placeholder="t('اكتب الرقم للبحث…', 'Type phone to search…')" />
            <div v-if="custMatches.length" class="pills" style="margin-top:6px">
              <button v-for="c in custMatches" :key="c.id" class="pill" @click="pickCustomer(c)"><Icon name="user" /> {{ c.name }} · {{ c.phone }}</button>
            </div>
          </div>
          <div class="field">
            <label>{{ t('اسم العميل', 'Customer name') }}</label>
            <input class="input" v-model="form.customerName" :placeholder="t('الاسم', 'Name')" />
          </div>

          <!-- عناوين محفوظة -->
          <div v-if="custAddresses.length" class="pills" style="margin-bottom:10px">
            <button v-for="a in custAddresses" :key="a.id" class="pill soft" @click="useAddress(a)"><Icon name="pin" /> {{ a.address || a.region }}</button>
          </div>

          <!-- المنطقة → الفرع -->
          <div class="field">
            <label><Icon name="pin" /> {{ t('منطقة التوصيل', 'Delivery region') }}</label>
            <select class="input" v-model="form.regionId">
              <option :value="null">{{ t('— اختر منطقة —', '— Select region —') }}</option>
              <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>{{ t('العنوان', 'Address') }}</label>
            <input class="input" v-model="form.addressText" :placeholder="t('العنوان بالتفصيل', 'Full address')" />
          </div>
          <div class="chip" :class="targetBranch ? 'soft' : ''" style="margin-bottom:12px">
            <Icon name="building" />
            {{ targetBranch ? t('الفرع: ', 'Branch: ') + targetBranch.name : t('لم يُحدَّد فرع — سيحتاج تعييناً يدوياً', 'No branch — needs manual assignment') }}
            <template v-if="deliveryFee"> · {{ t('رسوم', 'Fee') }} {{ money(deliveryFee) }}</template>
          </div>

          <!-- الأصناف -->
          <div class="field">
            <label><Icon name="search" /> {{ t('إضافة صنف', 'Add item') }}</label>
            <input class="input" v-model="prodQuery" @input="onProdSearch" :placeholder="t('ابحث في المنتجات…', 'Search products…')" />
            <div v-if="prodResults.length" class="pills" style="margin-top:6px">
              <button v-for="p in prodResults" :key="p.id" class="pill" @click="addItem(p)"><Icon name="plus" /> {{ p.nameAr }} · {{ money(p.price) }}</button>
            </div>
          </div>

          <div v-if="form.items.length" class="tbl-wrap" style="margin-bottom:12px">
            <table>
              <tbody>
                <tr v-for="(i, idx) in form.items" :key="idx">
                  <td class="t-strong">{{ i.productName }}</td>
                  <td dir="ltr">{{ money(i.unitPrice) }}</td>
                  <td style="width:120px">
                    <input class="input sm" type="number" min="1" v-model.number="i.quantity" dir="ltr" style="width:70px" />
                  </td>
                  <td class="t-strong" dir="ltr">{{ money(i.unitPrice * i.quantity) }}</td>
                  <td style="width:44px"><button class="btn icon subtle" @click="removeItem(idx)"><Icon name="trash" /></button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="muted" style="margin-bottom:12px">{{ t('لسه مفيش أصناف', 'No items yet') }}</p>

          <!-- الدفع -->
          <div class="field">
            <label>{{ t('الدفع', 'Payment') }}</label>
            <div class="pills">
              <button class="pill" :class="form.paymentMode === 'cash_on_delivery' ? 'on' : ''" @click="form.paymentMode = 'cash_on_delivery'">{{ t('كاش عند التسليم', 'Cash on delivery') }}</button>
              <button class="pill" :class="form.paymentMode === 'prepaid_online' ? 'on' : ''" @click="form.paymentMode = 'prepaid_online'">{{ t('مدفوع أونلاين', 'Prepaid online') }}</button>
            </div>
          </div>
          <div class="field">
            <label>{{ t('ملاحظات', 'Notes') }}</label>
            <input class="input" v-model="form.notes" :placeholder="t('اختياري', 'Optional')" />
          </div>

          <div class="stat" style="justify-content:space-between; display:flex; font-weight:800; font-size:16px">
            <span>{{ t('الإجمالي', 'Total') }}</span>
            <span dir="ltr">{{ money(grandTotal) }}</span>
          </div>
          <p v-if="err" class="err">{{ err }}</p>
        </div>
        <div class="m-foot">
          <button class="btn ghost" @click="show = false">{{ t('إلغاء', 'Cancel') }}</button>
          <button class="btn" :disabled="saving" @click="submit"><Icon name="check" /> {{ saving ? t('جارٍ الإرسال…', 'Sending…') : t('إنشاء وإرسال للفرع', 'Create & send') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
