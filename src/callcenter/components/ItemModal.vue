<script setup lang="ts">
import { computed } from 'vue'
import { state, selectItemSize, toggleModalExtra, isModalExtraSelected, changeItemModalQty, itemModalUnitPrice, itemModalTotal, itemModalValid, closeItemModal, confirmItemModal } from '../store'
import { formatCurrency } from '../utils'
import { tx } from '../lang'

const item = computed<any>(() => state.selectedMenuItem)
// صنف بسعر مفتوح: لا سعر في الكتالوج — الوكيل يكتب سعر الوحدة هنا (لا يُقبل صفر)
const isOpenPrice = computed(() => !!item.value?.isOpenPrice)
const priceOk = computed(() => itemModalValid())
const hasSizes = computed(() => Array.isArray(item.value?.sizes) && item.value.sizes.length > 0)
const hasExtras = computed(() => Array.isArray(item.value?.extras) && item.value.extras.length > 0)
function sizePrice(i: number): number { return Array.isArray(item.value?.sizePrices) ? item.value.sizePrices[i] : item.value?.price }
</script>

<template>
  <div v-if="state.itemModalOpen && item" class="modal-overlay" @click.self="closeItemModal()">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ state.editingCartItemId ? tx('تعديل الصنف', 'Edit item') : item.name }}</h3>
        <button class="modal-close" @click="closeItemModal()">×</button>
      </div>
      <div class="modal-body" style="padding:18px 22px;">
        <div class="item-modal-header">
          <div>
            <div class="item-modal-name">{{ item.name }}</div>
            <div v-if="item.nameEn" class="item-modal-name-en">{{ item.nameEn }}</div>
          </div>
          <div class="item-modal-price">
            <span v-if="isOpenPrice && !priceOk" style="font-size:13px; color:#b45309;">{{ tx('سعر مفتوح', 'Open price') }}</span>
            <span v-else>{{ formatCurrency(itemModalUnitPrice()) }}</span>
          </div>
        </div>

        <!-- سعر مفتوح: الوكيل يحدّد سعر الوحدة -->
        <template v-if="isOpenPrice">
          <h4 style="margin:16px 0 10px; font-size:14px;">{{ tx('سعر الوحدة', 'Unit price') }} <span style="color:#dc2626;">*</span></h4>
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
        <template v-if="hasSizes">
          <h4 style="margin:16px 0 10px; font-size:14px;">{{ tx('اختر الحجم', 'Choose a size') }}</h4>
          <div class="size-options">
            <button v-for="(sz, i) in item.sizes" :key="sz" type="button" class="size-option" :class="{ selected: state.selectedSize === sz }" @click="selectItemSize(sz)">
              <span class="size-option-name">{{ sz }}</span>
              <span class="size-option-price">{{ formatCurrency(sizePrice(i)) }}</span>
            </button>
          </div>
        </template>

        <!-- الإضافات -->
        <template v-if="hasExtras">
          <h4 style="margin:16px 0 10px; font-size:14px;">{{ tx('الإضافات', 'Extras') }}</h4>
          <div class="extras-list">
            <button v-for="ex in item.extras" :key="ex.id" type="button" class="extra-item" :class="{ selected: isModalExtraSelected(ex.id) }" @click="toggleModalExtra(ex)">
              <span class="extra-item-info">
                <span class="extra-checkbox"></span>
                <span class="extra-item-name">{{ ex.name }}</span>
              </span>
              <span class="extra-item-price">{{ ex.price > 0 ? '+ ' + formatCurrency(ex.price) : tx('مجاناً', 'Free') }}</span>
            </button>
          </div>
        </template>

        <!-- ملاحظة -->
        <h4 style="margin:16px 0 10px; font-size:14px;">{{ tx('ملاحظة (اختياري)', 'Note (optional)') }}</h4>
        <textarea v-model="state.itemModalNote" rows="2" :placeholder="tx('ملاحظة على الصنف...', 'Note on the item…')" style="width:100%; padding:10px 12px; border:1px solid var(--border,#e2e8f0); border-radius:10px; resize:none; outline:none;"></textarea>

        <!-- الكمية -->
        <h4 style="margin:16px 0 10px; font-size:14px;">{{ tx('الكمية', 'Quantity') }}</h4>
        <div class="qty-control">
          <button type="button" class="qty-btn" @click="changeItemModalQty(-1)">−</button>
          <span class="qty-value">{{ state.itemModalQty }}</span>
          <button type="button" class="qty-btn" @click="changeItemModalQty(1)">+</button>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn btn-secondary" @click="closeItemModal()">{{ tx('إلغاء', 'Cancel') }}</button>
        <button class="btn btn-primary" :disabled="!priceOk" :style="!priceOk ? 'opacity:.5; cursor:not-allowed;' : ''" @click="confirmItemModal()">
          <template v-if="!priceOk">{{ tx('حدّد السعر أولاً', 'Set the price first') }}</template>
          <template v-else>{{ state.editingCartItemId ? tx('حفظ', 'Save') : tx('إضافة', 'Add') }} · {{ formatCurrency(itemModalTotal()) }}</template>
        </button>
      </div>
    </div>
  </div>
</template>
