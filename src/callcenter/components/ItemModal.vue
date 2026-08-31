<script setup lang="ts">
import { computed } from 'vue'
import { state, selectItemSize, changeItemModalQty, itemModalUnitPrice, itemModalTotal, itemModalValid,
         closeItemModal, confirmItemModal, itemGroups, groupRule, groupSelectedCount, groupAtMax,
         toggleGroupOption, missingGroups, isModalExtraSelected, toggleModalExtra, isGroupRequired } from '../store'
import { formatCurrency } from '../utils'
import { tx, nameOf } from '../lang'

const item = computed<any>(() => state.selectedMenuItem)
// صنف بسعر مفتوح: لا سعر في الكتالوج — الوكيل يكتب سعر الوحدة هنا (لا يُقبل صفر)
const isOpenPrice = computed(() => !!item.value?.isOpenPrice)
const priceOk = computed(() => itemModalValid())
const groups = computed<any[]>(() => itemGroups(item.value))
// الأحجام: `variants` تحمل الاسمين، و`sizes` أسماءٌ عربية مسطّحة تبقى للمووك
const variants = computed<any[]>(() => {
  const v = item.value?.variants
  if (Array.isArray(v) && v.length) return v
  const s = item.value?.sizes
  if (!Array.isArray(s) || !s.length) return []
  return s.map((nm: string, i: number) => ({ id: null, nameAr: nm, nameEn: null, price: item.value?.sizePrices?.[i] ?? item.value?.price }))
})
/** الحجم يُختار بالاسم العربي — هو ما يخزّنه `state.selectedSize` والسلّة. */
const sizeKey = (v: any) => v.nameAr ?? v.name
// إضافاتٌ خارج أي مجموعة (المووك، أو كتالوج بلا مجموعات) — تبقى تعمل كما كانت
const looseExtras = computed<any[]>(() => {
  if (groups.value.length) return []
  return Array.isArray(item.value?.extras) ? item.value.extras : []
})
const missing = computed<any[]>(() => (state.itemModalOpen ? missingGroups() : []))
const canConfirm = computed(() => priceOk.value && !missing.value.length)
const optSelected = (o: any) => state.selectedExtras.some((e: any) => e.id === o.id)
</script>

<template>
  <div v-if="state.itemModalOpen && item" class="modal-overlay" @click.self="closeItemModal()">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ state.editingCartItemId ? tx('تعديل الصنف', 'Edit item') : nameOf(item) }}</h3>
        <button class="modal-close" @click="closeItemModal()">×</button>
      </div>
      <div class="modal-body" style="padding:18px 22px;">
        <div class="item-modal-header">
          <div>
            <div class="item-modal-name">{{ nameOf(item) }}</div>
            <div class="item-modal-sub">{{ tx('اختر الإضافات المطلوبة', 'Choose the options you need') }}</div>
          </div>
          <div class="item-modal-price">
            <span v-if="isOpenPrice && !priceOk" style="font-size:13px; color:#b45309;">{{ tx('سعر مفتوح', 'Open price') }}</span>
            <span v-else>{{ formatCurrency(itemModalUnitPrice()) }}</span>
          </div>
        </div>

        <!-- سعر مفتوح: الوكيل يحدّد سعر الوحدة -->
        <template v-if="isOpenPrice">
          <div class="im-grp-head">
            <span class="im-grp-name">{{ tx('سعر الوحدة', 'Unit price') }}</span>
            <span class="im-badge req">{{ tx('مطلوب', 'Required') }}</span>
          </div>
          <input
            v-model="state.itemModalOpenPrice"
            type="number" min="0" step="0.001" inputmode="decimal" placeholder="0.000"
            style="width:100%; padding:12px 14px; border:2px solid #f59e0b; border-radius:10px; outline:none; font-size:18px; font-weight:800; text-align:center;"
          />
          <p style="margin:6px 0 0; font-size:12px; color:#92400e;">
            {{ tx('صنف بسعر مفتوح — لازم تحدّد سعره قبل الإضافة. الإجمالي = السعر × الكمية.', 'Open-price item — set its price before adding. Total = price × quantity.') }}
          </p>
        </template>

        <!-- الأحجام -->
        <template v-if="variants.length">
          <div class="im-grp-head">
            <span class="im-grp-name">{{ tx('الحجم', 'Size') }}</span>
            <span class="im-rule">{{ tx('اختيار واحد', 'Choose one') }}</span>
          </div>
          <div class="im-opts">
            <button v-for="v in variants" :key="sizeKey(v)" type="button" class="im-opt"
              :class="{ on: state.selectedSize === sizeKey(v) }" @click="selectItemSize(sizeKey(v))">
              <span class="im-opt-name">{{ nameOf(v) }}</span>
              <span class="im-opt-price">{{ formatCurrency(v.price) }}</span>
            </button>
          </div>
        </template>

        <!-- ── مجموعات الإضافات: كلٌّ بقاعدتها ────────────────────────────────
             كانت كتلةً واحدة بلا قاعدة، فيختار الوكيل صوصين حيث يُسمح بواحد
             ويُغفل إضافةً إلزامية. المجموعة تحمل قاعدتها ظاهرةً الآن. -->
        <template v-for="g in groups" :key="g.id">
          <div class="im-grp-head">
            <span class="im-grp-name">{{ nameOf(g) }}</span>
            <span v-if="isGroupRequired(g)" class="im-badge req">{{ tx('مطلوب', 'Required') }}</span>
            <span v-if="Number(g.maxSelect || 0) > 1" class="im-badge count">{{ groupSelectedCount(g) }}/{{ g.maxSelect }}</span>
            <span class="im-rule">{{ groupRule(g) }}</span>
          </div>
          <div class="im-opts">
            <button v-for="o in (g.options || [])" :key="o.id" type="button" class="im-opt"
              :class="{ on: optSelected(o), off: !optSelected(o) && groupAtMax(g) }"
              @click="toggleGroupOption(g, o)">
              <span class="im-opt-name">{{ nameOf(o) }}</span>
              <span class="im-opt-price" :class="{ free: !Number(o.price) }">
                {{ Number(o.price) ? '+' + formatCurrency(o.price) : tx('مجاني', 'Free') }}
              </span>
            </button>
          </div>
        </template>

        <!-- إضافات بلا مجموعة (كتالوج قديم/مووك) -->
        <template v-if="looseExtras.length">
          <div class="im-grp-head">
            <span class="im-grp-name">{{ tx('الإضافات', 'Extras') }}</span>
            <span class="im-rule">{{ tx('اختياري', 'Optional') }}</span>
          </div>
          <div class="im-opts">
            <button v-for="ex in looseExtras" :key="ex.id" type="button" class="im-opt"
              :class="{ on: isModalExtraSelected(ex.id) }" @click="toggleModalExtra(ex)">
              <span class="im-opt-name">{{ nameOf(ex) }}</span>
              <span class="im-opt-price" :class="{ free: !Number(ex.price) }">
                {{ Number(ex.price) ? '+' + formatCurrency(ex.price) : tx('مجاني', 'Free') }}
              </span>
            </button>
          </div>
        </template>

        <!-- ملاحظة -->
        <div class="im-grp-head">
          <span class="im-grp-name">{{ tx('ملاحظة على الصنف', 'Note on the item') }}</span>
          <span class="im-rule">{{ tx('اختياري', 'Optional') }}</span>
        </div>
        <textarea v-model="state.itemModalNote" rows="2" class="im-note"
          :placeholder="tx('مثال: بدون بصل، مضبوط جداً…', 'e.g. no onion, well done…')"></textarea>

        <!-- الكمية -->
        <div class="im-grp-head">
          <span class="im-grp-name">{{ tx('الكمية', 'Quantity') }}</span>
        </div>
        <div class="qty-control">
          <button type="button" class="qty-btn" @click="changeItemModalQty(-1)">−</button>
          <span class="qty-value">{{ state.itemModalQty }}</span>
          <button type="button" class="qty-btn" @click="changeItemModalQty(1)">+</button>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn btn-secondary" @click="closeItemModal()">{{ tx('إلغاء', 'Cancel') }}</button>
        <button class="btn btn-primary" :disabled="!canConfirm" :style="!canConfirm ? 'opacity:.5; cursor:not-allowed;' : ''" @click="confirmItemModal()">
          <template v-if="!priceOk">{{ tx('حدّد السعر أولاً', 'Set the price first') }}</template>
          <!-- لا يُترك الزرّ معطّلاً بلا سبب: نُسمّي المجموعة الناقصة -->
          <template v-else-if="missing.length">{{ tx('اختر: ', 'Choose: ') }}{{ missing.map((g) => nameOf(g)).join('، ') }}</template>
          <template v-else>{{ state.editingCartItemId ? tx('حفظ', 'Save') : tx('إضافة', 'Add') }} · {{ formatCurrency(itemModalTotal()) }}</template>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── رأس المجموعة: الاسم، وشارة «مطلوب»، والقاعدة على الحافّة المقابلة ────────
   القاعدة («اختيار واحد» / «حتى ٢») تُقرأ قبل الضغط لا بعد رفضٍ مفاجئ. */
.item-modal-sub { font-size: 12.5px; color: var(--text-secondary, #64748b); margin-top: 2px; }

.im-grp-head {
  display: flex; align-items: center; gap: 8px;
  margin: 18px 0 8px;
}
.im-grp-name { font-size: 14px; font-weight: 800; color: var(--primary, #1a56db); }
.im-badge {
  padding: 2px 8px; border-radius: 999px;
  font-size: 10.5px; font-weight: 800; letter-spacing: .1px;
}
.im-badge.req { background: var(--danger-light, #fee2e2); color: var(--danger, #dc2626); }
.im-badge.count {
  background: var(--primary-light, #dbeafe); color: var(--primary-dark, #1242b0);
  font-variant-numeric: tabular-nums;
}
/* القاعدة على الحافّة المقابلة — منطقيّة فتنعكس مع اتجاه الواجهة */
.im-rule { margin-inline-start: auto; font-size: 11.5px; font-weight: 600; color: var(--text-muted, #94a3b8); }

.im-opts { display: flex; flex-wrap: wrap; gap: 8px; }
.im-opt {
  flex: 1 1 190px; min-width: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 11px 14px;
  border: 1.5px solid var(--border, #e5e7eb); border-radius: 12px;
  background: var(--white, #fff);
  font-family: inherit; font-size: 13.5px; font-weight: 700;
  color: var(--text-primary, #0f172a);
  cursor: pointer;
  transition: border-color .14s, background .14s, color .14s;
}
.im-opt:hover { border-color: var(--primary, #1a56db); }
.im-opt.on {
  border-color: var(--primary, #1a56db);
  background: var(--primary-lighter, #eff6ff);
  color: var(--primary-dark, #1242b0);
}
/* بلغت المجموعة حدَّها ⇒ الباقي باهتٌ ظاهراً: يُفهم المنع قبل الضغط */
.im-opt.off { opacity: .45; }
.im-opt-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.im-opt-price { flex-shrink: 0; font-size: 12.5px; font-weight: 800; color: var(--text-secondary, #64748b); }
.im-opt-price.free { color: var(--success, #16a34a); }
.im-opt.on .im-opt-price { color: inherit; }

.im-note {
  width: 100%; padding: 10px 12px;
  border: 1px solid var(--border, #e2e8f0); border-radius: 10px;
  background: var(--white, #fff); color: var(--text-primary, #0f172a);
  font-family: inherit; font-size: 13px;
  resize: none; outline: none;
}
.im-note:focus { border-color: var(--primary, #1a56db); }

body.dark-mode .im-opt,
body.dark-mode .im-note { background: var(--bg-card, #1e293b); }
</style>
