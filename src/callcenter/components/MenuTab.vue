<script setup lang="ts">
import { computed, reactive } from 'vue'
import { state, selectCategory, showAllCategories, filterMenuItems, openItemModal, menuBranchId, isItemDisabledForOrder } from '../store'
import { lang, t } from '../lang'
import { formatCurrency } from '../utils'

const isEn = computed(() => lang.value === 'en')

// صور التصنيفات اللي فشل تحميلها → نعرض الأيقونة بدلها (نقلاً عن onerror الأصلي)
const imgFailed = reactive<Record<string, boolean>>({})

const categoriesVisible = computed(() => state.menuView === 'categories' || !!state.menuSearch)
const itemsVisible = computed(() => state.menuView === 'items' || !!state.menuSearch)

function catImg(cat: any) { return cat.imageUrl || `assets/images/${cat.id}.png` }
function catName(cat: any) { return isEn.value ? (cat.nameEn || cat.name) : cat.name }
function catNameSub(cat: any) { return isEn.value ? cat.name : (cat.nameEn || '') }

// موقوف = إيقاف الكول‑سنتر + إيقاف مطبخ الـPOS. نمرّ على `isItemDisabledForOrder`
// نفسها التي تمنع الإضافة — فلا تنحرف الشاشة عمّا سيحدث عند الضغط (كانت تقرأ
// `getResolvedOrderBranchId()` مباشرةً فتُرجع فراغاً قبل اختيار العميل).
const disabledItems = computed<any[]>(() => {
  void menuBranchId()   // تبعية تفاعلية على الفرع المشتقّ
  return state.menuItems.filter((i: any) => isItemDisabledForOrder(i.id)).map((i: any) => i.id)
})

// عنوان قسم الأصناف (نقلاً عن selectCategory / filterMenuItems)
const itemsTitle = computed(() => {
  if (state.menuSearch) return 'نتائج البحث'
  if (state.activeCategory === 'all' || !state.activeCategory) return isEn.value ? 'All Items' : 'جميع الأصناف'
  const c = state.menuCategories.find((x: any) => x.id === state.activeCategory)
  return c ? (isEn.value ? (c.nameEn || c.name) : c.name) : (isEn.value ? 'Items' : 'الأصناف')
})

const shownItems = computed<any[]>(() => {
  if (state.menuSearch) {
    const q = state.menuSearch.toLowerCase()
    return state.menuItems.filter((i: any) => i.name.toLowerCase().includes(q) || (i.nameEn || '').toLowerCase().includes(q))
  }
  if (state.activeCategory === 'all' || !state.activeCategory) return state.menuItems
  return state.menuItems.filter((i: any) => i.categoryId === state.activeCategory)
})

// عدد أصناف التصنيف — بديل مفيد لمربّع الصورة الفارغ (المشروع بلا صور أصناف)
function catCount(cat: any): number {
  if (cat.id === 'all') return state.menuItems.length
  return state.menuItems.filter((i: any) => i.categoryId === cat.id).length
}

/**
 * هوية لونية لكل تصنيف. الكتالوج الحقيقي يعطي كل التصنيفات اللون الرمادي نفسه
 * (`color: '#6b7280'`)، فلا يميّز شيء تصنيفاً عن آخر إلا قراءة اسمه. نشتقّ اللون
 * من **معرّف التصنيف** بدالة ثابتة: نفس التصنيف يأخذ لونه نفسه في كل جلسة، فتنشأ
 * ذاكرةٌ بصرية للوكيل الذي يستعمل الشاشة طول اليوم.
 */
// أزواج (فاتح، غامق) لتدرّج كل تصنيف — لا لون مسطّح
const CAT_PALETTE: [string, string][] = [
  ['#6366f1', '#4338ca'], ['#0ea5e9', '#0369a1'], ['#10b981', '#047857'], ['#f59e0b', '#b45309'],
  ['#f43f5e', '#be123c'], ['#8b5cf6', '#6d28d9'], ['#14b8a6', '#0f766e'], ['#ec4899', '#be185d'],
]
const CAT_ALL: [string, string] = ['#475569', '#1e293b']
function catAccent(cat: any): [string, string] {
  if (cat.id === 'all') return CAT_ALL
  const key = String(cat.id ?? cat.name ?? '')
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return CAT_PALETTE[h % CAT_PALETTE.length]
}
/** متغيّرات اللون على البطاقة نفسها — فتقرأها كل قواعد CSS بلا تكرار أنماط سطرية. */
function catVars(cat: any): Record<string, string> {
  const [a, b] = catAccent(cat)
  return { '--acc': a, '--acc2': b }
}
/** أول حرف معبّر من الاسم — شارة التصنيف حين لا صورة ولا أيقونة. */
function catInitial(cat: any): string {
  if (cat.id === 'all') return '★'
  const n = (catName(cat) || '').trim()
  return n ? n.charAt(0) : '#'
}
function itemCategory(item: any) { return state.menuCategories.find((c: any) => c.id === item.categoryId) }
function itemCatColor(item: any) { const c = itemCategory(item); return c ? c.color : '#6b7280' }
function itemCatName(item: any) { const c = itemCategory(item); return c ? (isEn.value ? (c.nameEn || c.name) : c.name) : '' }
function itemName(item: any) { return isEn.value ? (item.nameEn || item.name) : item.name }
function itemNameSub(item: any) { return isEn.value ? item.name : (item.nameEn || '') }
function hasSizes(item: any) { return Array.isArray(item.sizes) && item.sizes.length > 0 }
// الإضافات لم يكن لها أي أثر على الكارت: الوكيل لا يعرف أن الصنف يفتح مودالاً حتى يضغطه
function hasExtras(item: any) { return Array.isArray(item.extras) && item.extras.length > 0 }
</script>

<template>
  <div id="panel-menu" class="tab-panel" :class="{ active: state.activeTab === 'menu' }">
    <div class="menu-search-bar">
      <input type="text" id="menu-search-input" :placeholder="t('menu_search_placeholder')" :value="state.menuSearch" @input="filterMenuItems(($event.target as HTMLInputElement).value)">
    </div>
    <div id="menu-categories" class="menu-categories" :class="{ hidden: !categoriesVisible }">
      <!-- بلا صورة ولا أيقونة (وهو الحال في البيانات الحقيقية: الكتالوج بلا صور أصناف)
           يصير الكارت مضغوطاً بلا مربّع رمادي فارغ، ويحمل عدد الأصناف بدلاً منه. -->
      <div v-for="cat in state.menuCategories" :key="cat.id" class="category-card"
        :class="{ active: state.activeCategory === cat.id, compact: !cat.imageUrl && !cat.icon }"
        :style="catVars(cat)" :data-id="cat.id" @click="selectCategory(cat.id)">
        <div v-if="cat.id !== 'all' && !imgFailed[cat.id] && cat.imageUrl" class="category-card-img">
          <img :src="catImg(cat)" :alt="cat.name" loading="lazy" @error="imgFailed[cat.id] = true">
        </div>
        <div v-else-if="cat.icon" class="category-card-icon" :style="{ color: cat.color }">{{ cat.icon }}</div>
        <!-- شارة الحرف بلون التصنيف: هوية بصرية تُغني عن الصورة الغائبة -->
        <div v-if="!cat.imageUrl && !cat.icon" class="cat-avatar">{{ catInitial(cat) }}</div>
        <div class="category-card-info">
          <div class="category-card-name">{{ catName(cat) }}</div>
          <div class="category-card-meta">
            <span v-if="catNameSub(cat)" class="cat-sub">{{ catNameSub(cat) }}</span>
            <span v-if="!cat.imageUrl && !cat.icon" class="cat-count">{{ catCount(cat) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div id="menu-items-section" :class="{ hidden: !itemsVisible }">
      <div class="menu-items-header">
        <h3 class="menu-items-title" id="menu-items-title">{{ itemsTitle }}</h3>
        <button class="menu-items-back menu-items-back-floating" @click="showAllCategories()">
          <span class="menu-items-back-icon">{{ isEn ? '←' : '→' }}</span>
          <span>{{ t('back_to_categories') }}</span>
        </button>
      </div>
      <div id="menu-items" class="menu-items">
        <div v-if="shownItems.length === 0" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">{{ isEn ? 'No items in this category' : 'لا توجد أصناف في هذا التصنيف' }}</div>
        <div v-for="item in shownItems" :key="item.id" class="menu-item-card" :class="{ 'menu-item-disabled': disabledItems.includes(item.id) }" @click="openItemModal(item.id)" :style="{ '--cat-color': itemCatColor(item) }">
          <div class="menu-item-cat-tag">{{ itemCatName(item) }}</div>
          <div class="menu-item-name">{{ itemName(item) }}</div>
          <div class="menu-item-name-en">{{ itemNameSub(item) }}</div>
          <!-- ما الذي يحدث عند الضغط: أحجام تُختار، إضافات تُضاف، أو إضافةٌ مباشرة -->
          <div v-if="hasSizes(item) || hasExtras(item)" class="menu-item-flags">
            <span v-if="hasSizes(item)" class="mi-flag mi-flag-size">
              <i class="fa-solid fa-layer-group"></i> {{ isEn ? `${item.sizes.length} sizes` : `${item.sizes.length} أحجام` }}
            </span>
            <span v-if="hasExtras(item)" class="mi-flag mi-flag-extra">
              <i class="fa-solid fa-plus"></i> {{ isEn ? `${item.extras.length} extras` : `${item.extras.length} إضافات` }}
            </span>
          </div>
          <!-- سعر مفتوح: لا سعر ثابت يُعرض — الوكيل يحدّده في مودال الصنف -->
          <div v-if="item.isOpenPrice" class="menu-item-price menu-item-price-sized"><i class="fa-solid fa-tag"></i> {{ isEn ? 'Open price' : 'سعر مفتوح' }}</div>
          <div v-else-if="hasSizes(item)" class="menu-item-price menu-item-price-sized"><i class="fa-solid fa-layer-group"></i> {{ isEn ? 'Choose size' : 'حسب الحجم' }}</div>
          <div v-else class="menu-item-price">{{ formatCurrency(item.price) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
