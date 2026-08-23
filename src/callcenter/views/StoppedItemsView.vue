<script setup lang="ts">
import { computed } from 'vue'
import { state, stoppedItemsGroups } from '../store'
import { formatCurrency } from '../utils'

const groups = computed<any[]>(() => stoppedItemsGroups())
</script>

<template>
  <section id="view-stopped-items" class="view active">
    <div class="settings-section">
      <div class="page-header-with-back">
        <button class="btn-back-page" @click="state.activeView = 'settings'" title="رجوع للإعدادات">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
        <div class="page-header-text">
          <h2 class="dashboard-title">الأصناف الموقوفة</h2>
          <p class="dashboard-subtitle">كل الأصناف الموقوفة مرتبة حسب الفرع — من المطبخ أو من الكول‑سنتر</p>
        </div>
      </div>

      <div class="settings-card">
        <div class="stopped-items-view" id="stopped-items-view-list">
          <div v-if="groups.length === 0" class="sidebar-item-empty">لا توجد أصناف موقوفة في أي فرع</div>
          <div v-for="group in groups" :key="group.branch.id" class="branch-section">
            <div class="branch-section-title">
              <span>{{ group.branch.name }}</span>
              <span class="branch-section-count">{{ group.items.length }} صنف</span>
            </div>
            <div class="item-availability-grid">
              <div v-for="item in group.items" :key="item.id" class="item-availability-card disabled">
                <div class="item-availability-top">
                  <div class="item-availability-name">{{ item.name }}</div>
                  <span class="availability-chip disabled">{{ item.fromPos ? 'موقوف من المطبخ' : 'موقوف — الكول‑سنتر' }}</span>
                </div>
                <div class="item-availability-meta">
                  <span>السعر: {{ formatCurrency(item.price) }}</span>
                  <span>{{ item.fromPos ? 'تشغيله من الفرع' : 'موقوف عندنا فقط — الفرع يبيعه عادي' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
