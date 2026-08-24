<script setup lang="ts">
import { computed } from 'vue'
import { tx } from '../lang'
import { state, stoppedItemsGroups } from '../store'
import { formatCurrency } from '../utils'

const groups = computed<any[]>(() => stoppedItemsGroups())
</script>

<template>
  <section id="view-stopped-items" class="view active">
    <div class="settings-section">
      <div class="page-header-with-back">
        <button class="btn-back-page" @click="state.activeView = 'settings'" :title="tx('رجوع للإعدادات', 'Back to settings')">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
        <div class="page-header-text">
          <h2 class="dashboard-title">{{ tx('الأصناف الموقوفة', 'Stopped items') }}</h2>
          <p class="dashboard-subtitle">{{ tx('كل الأصناف الموقوفة مرتبة حسب الفرع — من المطبخ أو من الكول‑سنتر', 'All stopped items grouped by branch — from the kitchen or from the call center') }}</p>
        </div>
      </div>

      <div class="settings-card">
        <div class="stopped-items-view" id="stopped-items-view-list">
          <div v-if="groups.length === 0" class="sidebar-item-empty">{{ tx('لا توجد أصناف موقوفة في أي فرع', 'No stopped items in any branch') }}</div>
          <div v-for="group in groups" :key="group.branch.id" class="branch-section">
            <div class="branch-section-title">
              <span>{{ group.branch.name }}</span>
              <span class="branch-section-count">{{ group.items.length }} {{ tx('صنف', 'items') }}</span>
            </div>
            <div class="item-availability-grid">
              <div v-for="item in group.items" :key="item.id" class="item-availability-card disabled">
                <div class="item-availability-top">
                  <div class="item-availability-name">{{ item.name }}</div>
                  <span class="availability-chip disabled">{{ item.fromPos ? tx('موقوف من المطبخ', 'Stopped by the kitchen') : tx('موقوف — الكول‑سنتر', 'Stopped — call center') }}</span>
                </div>
                <div class="item-availability-meta">
                  <span>{{ tx('السعر:', 'Price:') }} {{ formatCurrency(item.price) }}</span>
                  <span>{{ item.fromPos ? tx('تشغيله من الفرع', 'Resume it from the branch') : tx('موقوف عندنا فقط — الفرع يبيعه عادي', 'Stopped here only — the branch still sells it') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
