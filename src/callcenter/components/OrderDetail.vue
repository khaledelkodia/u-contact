<script setup lang="ts">
import { computed } from 'vue'
import { state, getPaymentLabel, openCancelModal, openTxnModal, openComplaintModal, canManageComplaints, canCancelOrder, canCancelThisOrder, canEditOrder, canEditThisOrder, startEditOrder, phoneShow } from '../store'
import { icon } from '../icons'
import { ORDER_STATUSES } from '../data'
import { formatCurrency, formatDate, formatTransactionTime } from '../utils'
import { tx, nameOf } from '../lang'

const props = defineProps<{ orderId: number }>()

const order = computed<any>(() => state.orders.find((o: any) => o.id === props.orderId) || null)

// سطورُ الخصم: التفصيلُ إن وُجد — سطرٌ لكلّ قاعدةٍ باسمها. والطلباتُ التي سبقت
// حفظَ التفصيل تحمل المبلغَ وحده، فتُعرَض سطراً واحداً باسمها إن كان لها اسم.
const discountLines = computed<any[]>(() => {
  const o = order.value
  if (!o) return []
  const bd = Array.isArray(o.discountBreakdown) ? o.discountBreakdown : []
  if (bd.length) return bd
  const amt = Number(o.discountAmount) || 0
  return amt > 0 ? [{ id: 'sum', name: o.discountName || '', amount: amt }] : []
})

// نقلاً عن getStatusBadge
function statusBadge(status: string): string {
  const s = ORDER_STATUSES.find((x: any) => x.id === status)
  if (!s) return `<span class="status-badge">${tx('غير معروف', 'Unknown')}</span>`
  return `<span class="status-badge status-${status}">${icon(s.icon, { size: 13 })} ${nameOf(s)}</span>`
}
// تفاصيل الصنف (حجم + إضافات) — نقلاً عن detailsStr
/**
 * وصف السطر: الحجم والإضافات — بلغة الواجهة.
 * السلّة تخزّن الاسمين (`sizeAr`/`sizeEn` و`modifiers`)، فلا يتجمّد الوصف على لغة
 * لحظة الاختيار. `extras` (أسماء عربية) تبقى ارتداداً لسطرٍ أُضيف قبل التغيير.
 */
function sizeLabel(item: any): string {
  return nameOf({ nameAr: item.sizeAr ?? item.size, nameEn: item.sizeEn })
}
function extrasLabel(item: any): string {
  const mods = Array.isArray(item.modifiers) && item.modifiers.length ? item.modifiers : null
  if (mods) return mods.map((m: any) => nameOf(m)).join(tx('، ', ', '))
  return Array.isArray(item.extras) ? item.extras.join(tx('، ', ', ')) : ''
}

function itemDetails(item: any): string {
  const sz = sizeLabel(item)
  let detailsStr = sz ? tx('حجم ', 'Size ') + sz : ''
  const ex = extrasLabel(item)
  if (ex) { detailsStr += detailsStr ? ' + ' : ''; detailsStr += ex }
  return detailsStr
}

/**
 * طريقة الدفع كما هي — لا كما نظنّها.
 *
 * كان الافتراض يملأ الفراغ («الهاتف • نقدي») لطلبٍ لم يختر له أحدٌ طريقة، فيقرأ
 * الوكيل تحصيلاً لم يحدث. الفراغ يبقى فراغاً حتى يقفله الفرع بطريقته الحقيقيّة.
 */
/** أسطر الدفع من الفرع: الطرق أوّلاً ثم الإكراميّة — كلٌّ بمبلغه. */
const payLines = computed<any[]>(() => {
  const p = order.value?.posPayments
  if (!Array.isArray(p) || !p.length) return []
  const pay = p.filter((x: any) => x.surplusType !== 'tips')
  const tips = p.filter((x: any) => x.surplusType === 'tips')
  return [...pay, ...tips]
})

/** اسم الطريقة، وإلا نوعها الخام (نقدي/شبكة) — لا «غير مسمّاة» لسطرٍ حقيقيّ. */
function payMethodName(p: any): string {
  if (p.methodName) return p.methodName
  if (p.method === 'card') return tx('شبكة', 'Card')
  if (p.method === 'cash') return tx('نقدي', 'Cash')
  return tx('غير مسمّاة', 'Unnamed')
}

function paymentText(o: any): string {
  if (o.paymentLabel) return o.paymentLabel
  if (o.paymentMethod || o.paymentChannel) return getPaymentLabel(o.paymentChannel, o.paymentMethod)
  return tx('لم تُحدَّد بعد — يحدّدها الفرع عند القفل', 'Not set yet — the branch sets it on closing')
}

const itemCount = computed(() => (Array.isArray(order.value?.items) ? order.value.items.length : 0))
</script>

<template>
  <div v-if="order" class="order-detail-panel dt-panel">
    <!-- ── الترويسة ──────────────────────────────────────────────────────────
         كانت صفّاً واحداً لا ينكسر: العنوان يميناً وكتلةُ أزرارٍ يساراً. في عمودٍ
         ضيّق (٤٢٠px) كانت الأزرار تخرج عن الإطار ويظهر شريط تمريرٍ أفقيّ ويُقصّ
         آخرها. صارت طبقات: رقمٌ وحالة، ثم تاريخ، ثم أزرارٌ تنكسر أسطراً. -->
    <div class="dt-head">
      <div class="dt-head-top">
        <div class="dt-inv">
          {{ tx('فاتورة', 'Invoice') }} <span class="dt-inv-no">#{{ order.invoiceNo }}</span>
        </div>
        <span class="dt-status" v-html="statusBadge(order.status)"></span>
      </div>

      <div class="dt-meta">{{ tx('تاريخ الإنشاء:', 'Created:') }} {{ formatDate(order.createdAt) }}</div>
      <div v-if="order.scheduledDate" class="dt-meta dt-meta-sched">
        <span v-html="icon('clock', { size: 13 })"></span>
        {{ tx('مجدول إلى:', 'Scheduled for:') }} <strong>{{ formatDate(order.scheduledDate) }}</strong>
      </div>
      <!-- رقم المنصّة الخارجية: الوكيل يقارنه بما يقوله العميل -->
      <div v-if="order.orderTag" class="dt-meta">
        {{ tx('رقم الطلب الخارجي:', 'External order no.:') }}
        <span class="order-tag" dir="ltr">{{ order.orderTag }}</span>
      </div>
      <div v-if="order.status === 'cancelled' && order.cancellationReason" class="order-cancel-reason">
        <span class="inline-ico" v-html="icon('x-circle', { size: 13 })"></span>
        {{ tx('سبب الإلغاء:', 'Cancellation reason:') }} <strong>{{ order.cancellationReason.label }}</strong>
        <template v-if="order.cancellationReason.note && order.cancellationReason.id !== 'other'"> — {{ order.cancellationReason.note }}</template>
      </div>

      <!-- الحالة والسائق يملكهما الفرع: تُحدَّث عنده وتصل هنا لحظياً عبر SSE. -->
      <div class="dt-actions">
        <!-- التعديل قبل «جاهز» فقط — الفرع يستلم الفرق ويطبعه تذكرةَ تعديل -->
        <button v-if="canEditOrder() && canEditThisOrder(order)" class="btn btn-primary btn-sm dt-btn-edit" @click="startEditOrder(order.id)">
          <span v-html="icon('edit', { size: 13 })"></span> {{ tx('تعديل الطلب', 'Edit order') }}
        </button>
        <!-- طلبُ إلغاءٍ في الطريق للفرع: لا زرّ يُضغط مرّتين، ولا صمتٌ يُقلق -->
        <span v-if="order.cancelRequested" class="dt-cancel-pending">
          {{ tx('طلب إلغاء — في انتظار الفرع', 'Cancellation — awaiting the branch') }}
        </span>
        <button v-if="canCancelOrder() && canCancelThisOrder(order)" class="btn btn-danger btn-sm" @click="openCancelModal(order.id)">
          {{ tx('إلغاء الطلب', 'Cancel order') }}
        </button>
        <button v-if="canManageComplaints()" class="btn btn-sm dt-btn-complaint" @click="openComplaintModal(order.id)">
          <span v-html="icon('alert-triangle', { size: 13 })"></span> {{ tx('تقديم شكوى', 'Complaint') }}
        </button>
        <button class="btn-transactions dt-btn-log" @click="openTxnModal(order.id)" :title="tx('سجل العمليات على الطلب', 'Order activity log')">
          <span v-html="icon('clock', { size: 13 })"></span> {{ tx('سجل العمليات', 'Activity log') }}
        </button>
      </div>
    </div>

    <!-- ── الجسم: عمودان على الشاشة العريضة ────────────────────────────────
         كان كلُّ شيءٍ عموداً واحداً ممتدّاً، فعلى شاشةٍ عريضة تتباعد التسميةُ عن
         قيمتها بمئات البكسلات ويصير سطرُ الصنف اسماً في طرفٍ وسعراً في الطرف
         المقابل — يقرأه العين برحلة. صار السياق (العميل/الفرع/السائق) عموداً
         مضبوط العرض، والأصناف والحساب عموداً يتمدّد. -->
    <div class="dt-body">
      <aside class="dt-col dt-col-side">
    <!-- الحقول: عمودٌ واحد في العمود الجانبي، وشبكةٌ حين ينهار الجسم لعمودٍ واحد -->
    <div class="order-detail-grid">
      <div class="order-detail-field">
        <label>{{ tx('العميل', 'Customer') }}</label>
        <span>{{ order.customerName }}</span>
      </div>
      <div class="order-detail-field">
        <label>{{ tx('رقم الهاتف', 'Phone') }}</label>
        <span class="ltr-num">{{ order.customerPhone }}</span>
      </div>
      <div class="order-detail-field">
        <label>{{ tx('الفرع', 'Branch') }}</label>
        <span>{{ order.branchName }}</span>
      </div>
      <div class="order-detail-field">
        <label>{{ tx('الموظف المسؤول', 'Handled by') }}</label>
        <span>{{ order.employeeName }}</span>
      </div>
      <div class="order-detail-field">
        <label>{{ tx('الرقم اليومي', 'Daily no.') }}</label>
        <span class="dt-daily">{{ order.dailyNo }}</span>
      </div>
      <!-- العنوان طويل: صفٌّ كامل فلا يُحشَر في نصف عمود -->
      <div v-if="order.address" class="order-detail-field dt-wide">
        <label>{{ tx('العنوان', 'Address') }}</label>
        <span>{{ order.address }}</span>
      </div>
      <div v-if="order.type === 'delivery'" class="order-detail-field order-detail-field-driver dt-wide">
        <label>{{ tx('السائق', 'Driver') }}</label>
        <div v-if="order.driverId" class="driver-detail-box">
          <div class="driver-detail-name"><span v-html="icon('bike', { size: 14 })"></span> {{ order.driverName }}</div>
          <div class="driver-detail-phone" dir="ltr">{{ phoneShow(order.driverPhone || '') }}</div>
          <div v-if="order.driverAssignedAt" class="driver-detail-time">{{ tx('تم التحميل:', 'Picked up:') }} {{ formatTransactionTime(order.driverAssignedAt) }}</div>
        </div>
        <span v-else style="color:var(--text-muted); font-weight:600;">{{ tx('لم يُعين سائق بعد', 'No driver assigned yet') }}</span>
      </div>
    </div>

    <div v-if="order.notes" class="dt-notes">
      <span class="dt-notes-ico" v-html="icon('alert-triangle', { size: 13 })"></span>
      <div>
        <strong>{{ tx('ملاحظات الطلب', 'Order notes') }}</strong>
        <div>{{ order.notes }}</div>
      </div>
    </div>
      </aside>

      <section class="dt-col dt-col-main">

    <!-- ── الأصناف: أسطر إيصال لا جدولٌ بأربعة أعمدة ─────────────────────────
         الجدول في عمودٍ ضيّق كان يكسر كل سعرٍ سطرين ويضغط اسم الصنف حتى يختفي. -->
    <div class="dt-sec">
      <span class="dt-sec-t">{{ tx('الأصناف', 'Items') }}</span>
      <span v-if="itemCount" class="dt-sec-n">{{ itemCount }}</span>
    </div>
    <div class="dt-list">
      <div v-if="!itemCount" class="dt-empty">
        {{ order.itemsLoaded ? tx('لا توجد أصناف في هذا الطلب', 'This order has no items') : tx('جارٍ تحميل الأصناف…', 'Loading items…') }}
      </div>
      <div v-for="(item, idx) in order.items" :key="idx" class="dt-row">
        <span class="dt-qty">{{ item.quantity }}<small>×</small></span>
        <div class="dt-row-main">
          <div class="dt-name">{{ nameOf(item) }}</div>
          <div v-if="itemDetails(item)" class="dt-sub">{{ itemDetails(item) }}</div>
          <!-- ملاحظة الصنف: يكتبها الوكيل ولم تكن تُعرض هنا إطلاقاً -->
          <div v-if="item.note" class="dt-item-note">{{ tx('ملاحظة: ', 'Note: ') }}{{ item.note }}</div>
        </div>
        <div class="dt-price">
          <span class="dt-total">{{ formatCurrency(item.total || item.price * item.quantity) }}</span>
          <span v-if="item.quantity > 1" class="dt-unit">{{ formatCurrency(item.price) }} {{ tx('للواحدة', 'each') }}</span>
        </div>
      </div>
    </div>

    <!-- ── الإجماليات ───────────────────────────────────────────────────────── -->
    <div class="dt-sum">
      <div class="dt-sum-row">
        <span>{{ tx('المجموع الفرعي', 'Subtotal') }}</span>
        <span class="dt-sum-v">{{ formatCurrency(order.subtotal) }}</span>
      </div>
      <div v-for="(l, k) in discountLines" :key="l.id ?? k" class="dt-sum-row dt-disc">
        <span>{{ tx('خصم', 'Discount') }}<template v-if="l.name"> · {{ l.name }}</template></span>
        <span class="dt-sum-v">− {{ formatCurrency(l.amount) }}</span>
      </div>
      <div class="dt-sum-row">
        <span>{{ tx('رسوم التوصيل', 'Delivery fee') }}
          <!-- رقمٌ حدّده الفرع لا تقديرُ مركز الاتصال — يُقال صراحةً وإلا ظُنّ تقديراً -->
          <em v-if="order.figuresFromBranch" class="dt-src">{{ tx('(من الفرع)', '(from the branch)') }}</em></span>
        <span class="dt-sum-v">{{ formatCurrency(order.deliveryFee) }}</span>
      </div>
      <div class="dt-grand">
        <span class="dt-grand-l">{{ tx('الإجمالي', 'Total') }}</span>
        <strong class="dt-grand-v">{{ formatCurrency(order.total) }}</strong>
      </div>
      <div class="dt-pay">
        <span v-html="icon('wallet', { size: 13 })"></span>
        {{ tx('طريقة الدفع:', 'Payment:') }}
        <template v-if="!payLines.length"><strong>{{ paymentText(order) }}</strong></template>
      </div>
      <!-- أُقفل في الفرع: طرقه كما هي — قد تكون أكثر من واحدة، ومعها الإكراميّة -->
      <div v-if="payLines.length" class="dt-paylines">
        <div v-for="(p, k) in payLines" :key="k" class="dt-payline"
             :class="{ 'is-tip': p.surplusType === 'tips' }">
          <span>{{ p.surplusType === 'tips'
            ? tx('إكراميّة', 'Tip')
            : payMethodName(p) }}</span>
          <span class="dt-payline-v">{{ formatCurrency(p.amount) }}</span>
        </div>
      </div>
    </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* بلون الخصم نفسه في السلّة وشاشة التأكيد — رقمٌ واحدٌ في ثلاث شاشات */
.dt-disc { color: var(--success, #16a34a); font-weight: 700; }
.dt-disc .dt-sum-v { color: var(--success, #16a34a); }
.dt-src { font-style: normal; font-size: 10.5px; font-weight: 700; color: var(--success, #16a34a); margin-inline-start: 5px; }
/* ── الترويسة ── */
.dt-head {
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 2px solid var(--border-light, #f3f4f6);
}
.dt-head-top {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
}
.dt-inv { font-size: 19px; font-weight: 800; color: var(--text-primary, #0f172a); }
.dt-inv-no { color: var(--primary, #1a56db); }
.dt-status { display: inline-flex; flex: 0 0 auto; }
.dt-meta {
  margin-top: 5px;
  font-size: 12px; font-weight: 600; line-height: 1.6;
  color: var(--text-secondary, #64748b);
}
.dt-meta-sched { display: flex; align-items: center; gap: 5px; color: var(--danger, #dc2626); }
.dt-meta-sched strong { color: var(--danger, #dc2626); }
/* أزرارٌ تنكسر أسطراً بدل أن تخرج عن الإطار */
.dt-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.dt-actions .btn, .dt-actions .btn-transactions {
  padding: 7px 12px; font-size: 12.5px; gap: 6px; white-space: nowrap;
}
.dt-btn-complaint {
  background: var(--danger-light, #fee2e2);
  color: var(--danger, #dc2626);
  border: 1px solid rgba(220, 38, 38, 0.25);
  display: inline-flex; align-items: center;
}
.dt-btn-log { display: inline-flex; align-items: center; }
.dt-btn-edit { display: inline-flex; align-items: center; }
.dt-daily { font-size: 17px; font-weight: 800; color: var(--primary, #1a56db); }
.dt-wide { grid-column: 1 / -1; }

/* ── الجسم: عمودان ── */
.dt-panel { container: dt / inline-size; }
.dt-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
.dt-col { min-width: 0; }
/* الاستعلام على **عرض اللوحة نفسها** لا عرض الشاشة: اللوحة قد تُعرض في عمودٍ ضيّق
   على شاشةٍ عريضة، فاستعلامُ الشاشة كان سيفرض عليها عمودين مخنوقين. */
@container dt (min-width: 1024px) {
  .dt-body { grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 22px; align-items: start; }
  /* السياق عمودٌ واحد: التسمية فوق قيمتها لا على بُعد نصف شاشة منها */
  .dt-col-side :deep(.order-detail-grid) { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .dt-col-side :deep(.dt-wide) { grid-column: auto; }
  .dt-col-side .dt-notes { margin-bottom: 0; }
}

/* ── ملاحظات الطلب ── */
.dt-notes {
  display: flex; align-items: flex-start; gap: 8px;
  margin-bottom: 16px; padding: 10px 12px;
  border-radius: var(--radius, 10px);
  background: var(--warning-light, #fffbeb);
  border: 1px solid rgba(245, 158, 11, 0.45);
  font-size: 12.5px; line-height: 1.6;
}
.dt-notes-ico { flex: 0 0 auto; color: #b45309; display: inline-flex; }
.dt-notes strong { display: block; font-size: 11.5px; color: #b45309; }

/* ── عنوان القسم ── */
.dt-sec { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
.dt-sec-t { font-size: 12px; font-weight: 800; color: var(--text-secondary, #64748b); }
.dt-sec-n {
  min-width: 20px; padding: 1px 6px; border-radius: var(--radius-full, 999px);
  background: var(--bg, #f0f2f5); color: var(--text-secondary, #64748b);
  font-size: 11px; font-weight: 800; text-align: center;
  font-variant-numeric: tabular-nums;
}
.dt-sec::after { content: ''; flex: 1 1 auto; height: 1px; background: var(--border-light, #f3f4f6); }

/* ── الأصناف ── */
/* سقفٌ للأصناف: طلبٌ بثلاثين صنفاً كان يفرد اللوحة حتى يختفي الإجمالي تحت
   الطيّة، فيمرّر الوكيل الصفحة كلّها ليرى رقماً واحداً. التمرير هنا داخليّ،
   و`overflow-x: hidden` لا `overflow: hidden` — الاختصار يُلغي التمرير الرأسيّ. */
.dt-list {
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-lg, 14px);
  overflow-x: hidden;
  overflow-y: auto;
  max-height: min(46vh, 380px);
  overscroll-behavior: contain;   /* لا يُمرّر الصفحة خلفه عند بلوغ آخره */
}
.dt-list::-webkit-scrollbar { width: 8px; }
.dt-list::-webkit-scrollbar-thumb {
  background: var(--border, #e5e7eb); border-radius: 99px;
  border: 2px solid var(--white, #fff);
}
body.dark-mode .dt-list::-webkit-scrollbar-thumb { background: #334155; border-color: #1e293b; }
.dt-empty { padding: 18px; text-align: center; font-size: 12.5px; color: var(--text-muted, #94a3b8); }
.dt-row { display: flex; align-items: flex-start; gap: 10px; padding: 11px 12px; }
.dt-row + .dt-row { border-top: 1px solid var(--border-light, #f3f4f6); }
.dt-qty {
  flex: 0 0 auto; min-width: 30px; height: 25px; padding: 0 6px;
  border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center; gap: 1px;
  background: var(--primary-lighter, #eff6ff); color: var(--primary, #1a56db);
  font-size: 12.5px; font-weight: 800; font-variant-numeric: tabular-nums;
}
.dt-qty small { font-size: 10px; font-weight: 700; opacity: 0.75; }
.dt-row-main { flex: 1 1 auto; min-width: 0; }
.dt-name { font-size: 13px; font-weight: 700; line-height: 1.45; color: var(--text-primary, #0f172a); }
.dt-sub { margin-top: 2px; font-size: 11px; font-weight: 600; color: var(--text-muted, #94a3b8); }
.dt-item-note { margin-top: 3px; font-size: 11px; font-weight: 700; color: #b45309; }
.dt-price { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; text-align: end; }
.dt-total {
  font-size: 13px; font-weight: 800; white-space: nowrap;
  color: var(--text-primary, #0f172a); font-variant-numeric: tabular-nums;
}
.dt-unit {
  font-size: 10.5px; font-weight: 600; white-space: nowrap;
  color: var(--text-muted, #94a3b8); font-variant-numeric: tabular-nums;
}

/* ── الإجماليات: عرضٌ كامل — الصندوق الثابت ٣٠٠px كان يفيض في اللوحة الضيّقة ── */
.dt-sum {
  margin-top: 14px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-lg, 14px);
  overflow: hidden;
}
.dt-sum-row {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  padding: 8px 13px;
  font-size: 12.5px; font-weight: 600; color: var(--text-secondary, #64748b);
}
.dt-sum-v {
  font-weight: 700; white-space: nowrap;
  color: var(--text-primary, #0f172a); font-variant-numeric: tabular-nums;
}
.dt-grand {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 12px 13px;
  background: var(--primary, #1a56db); color: #fff;
}
.dt-grand-l { font-size: 13px; font-weight: 700; opacity: 0.92; }
.dt-grand-v {
  font-size: 18px; font-weight: 800; white-space: nowrap; letter-spacing: -0.3px;
  font-variant-numeric: tabular-nums;
}
.dt-pay {
  display: flex; align-items: center; gap: 6px;
  padding: 9px 13px;
  font-size: 12px; font-weight: 600; color: var(--text-secondary, #64748b);
}
.dt-pay strong { color: var(--text-primary, #0f172a); font-weight: 800; }
/* طلب إلغاءٍ معلّق — لونُ تحذيرٍ لا خطر: لم يُرفَض ولم يُقبَل بعد */
.dt-cancel-pending {
  display: inline-flex; align-items: center; padding: 4px 10px;
  border-radius: 999px; font-size: 11px; font-weight: 800;
  color: #b45309; background: #fef3c7; border: 1px solid #fde68a;
}
body.dark-mode .dt-cancel-pending { color: #fbbf24; background: #451a03; border-color: #78350f; }
/* أسطر الدفع: مبلغٌ لكل طريقة على محورٍ واحد، والإكراميّة مميَّزة فلا تُحسَب ثمناً */
.dt-paylines { padding: 0 13px 10px; display: flex; flex-direction: column; gap: 4px; }
.dt-payline {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  font-size: 12px; font-weight: 700; color: var(--text-primary, #0f172a);
}
.dt-payline-v { white-space: nowrap; font-variant-numeric: tabular-nums; }
.dt-payline.is-tip { color: #b45309; }
body.dark-mode .dt-payline.is-tip { color: #fbbf24; }

/* ── الوضع الليلي ── */
body.dark-mode .dt-sec-n,
body.dark-mode .dt-qty { background: rgba(255, 255, 255, 0.07); }
body.dark-mode .dt-qty { color: #93c5fd; }
body.dark-mode .dt-notes {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.4);
  color: #e2e8f0;
}
body.dark-mode .dt-notes strong,
body.dark-mode .dt-notes-ico,
body.dark-mode .dt-item-note { color: #fbbf24; }
body.dark-mode .dt-grand { background: var(--primary-darker, #2563eb); }
</style>
