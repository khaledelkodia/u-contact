<script setup lang="ts">
import { computed } from 'vue'
import {
  state, availabilityGroups, toggleBranchItemAvailability,
  onAvailabilityBranchChange, onAvailabilityCategoryChange, onAvailabilitySearchChange,
} from '../store'

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
      <h2 class="dashboard-title" style="margin-bottom: 24px;">الإعدادات</h2>

      <div class="settings-card">
        <h3 class="settings-card-title">إدارة الأصناف</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">عرض الأصناف الموقوفة في كل الفروع</p>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn btn-secondary" @click="state.activeView = 'stopped-items'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:6px;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            الأصناف الموقوفة
          </button>
        </div>
      </div>

      <div class="settings-card">
        <h3 class="settings-card-title">إدارة توفر الأصناف بالفروع</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">اختر فرعاً وتصنيف الأصناف لتعطيل أو تنشيط الأصناف لموظفي الكول سنتر. الإيقاف من هنا <strong>لا يصل الفرع</strong> — الكاشير يبيع الصنف عادي. أما الموقوف من مطبخ الفرع فمفتاحه مقفول وتشغيله يكون من الفرع.</p>

        <div class="availability-filters-bar">
          <div class="availability-filter">
            <label class="availability-filter-label" for="settings-availability-branch">
              <i class="fa-solid fa-store"></i> الفرع المستهدف
            </label>
            <div class="availability-filter-input">
              <select id="settings-availability-branch" :value="state.availBranchId" @change="onAvailabilityBranchChange(($event.target as HTMLSelectElement).value)">
                <option v-for="b in state.branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
              </select>
              <i class="fa-solid fa-chevron-down availability-filter-chev"></i>
            </div>
          </div>

          <div class="availability-filter">
            <label class="availability-filter-label" for="settings-availability-category">
              <i class="fa-solid fa-layer-group"></i> التصنيف
            </label>
            <div class="availability-filter-input">
              <select id="settings-availability-category" :value="state.availCategory" @change="onAvailabilityCategoryChange(($event.target as HTMLSelectElement).value)">
                <option value="all">كل التصنيفات</option>
                <option v-for="cat in state.menuCategories.filter((c: any) => c.id !== 'all')" :key="cat.id" :value="cat.id">{{ cat.icon }} {{ cat.name }}</option>
              </select>
              <i class="fa-solid fa-chevron-down availability-filter-chev"></i>
            </div>
          </div>

          <div class="availability-filter availability-filter-search">
            <label class="availability-filter-label" for="settings-availability-search">
              <i class="fa-solid fa-magnifying-glass"></i> بحث
            </label>
            <div class="availability-filter-input">
              <input type="text" id="settings-availability-search" placeholder="ابحث باسم الصنف..." :value="state.availSearch" @input="onAvailabilitySearchChange(($event.target as HTMLInputElement).value)" />
            </div>
          </div>
        </div>

        <div id="settings-branch-items-list" class="settings-branch-items-list">
          <div v-if="totalShown === 0" class="settings-empty">
            <i class="fa-solid fa-magnifying-glass"></i>
            <div>لا توجد أصناف تطابق الفلتر الحالي</div>
          </div>
          <div v-for="group in groups" :key="group.cat.id" class="settings-cat-section">
            <h4 class="settings-cat-title">
              <span>{{ group.cat.icon }}</span>
              <span>{{ group.cat.name }} ({{ group.cat.nameEn }})</span>
              <span class="settings-cat-count">{{ group.items.length }}</span>
            </h4>
            <div class="settings-items-grid">
              <div v-for="row in group.items" :key="row.item.id" class="settings-item-row">
                <div class="settings-item-row-info">
                  <span class="settings-item-row-name">
                    {{ row.item.name }}
                    <span v-if="row.fromPos" style="margin-inline-start:6px; font-size:10px; font-weight:700; color:var(--danger, #b91c1c);">موقوف من المطبخ</span>
                  </span>
                  <span class="settings-item-row-name-en">{{ row.item.nameEn }}</span>
                </div>
                <label class="availability-switch" :title="row.fromPos ? 'موقوف من مطبخ الفرع — تشغيله يكون من الفرع' : ''" :style="row.fromPos ? 'opacity:.45; cursor:not-allowed;' : ''">
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
