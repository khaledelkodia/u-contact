<script setup lang="ts">
// شاشة الشكاوى: قائمة الشركة + تفاصيل الشكوى وتايم‑لاين متابعتها.
// الشكوى نفسها يراها موظف الشركة من لوحة التحكم U‑Serve — نفس السجلّ لا نسخة أخرى.
import { ref, computed, onMounted, watch } from 'vue'
import {
  state, loadComplaintsList, setComplaintsFilter, openComplaintDetail, closeComplaintDetail,
  addComplaintUpdate, COMPLAINT_STATUSES, complaintStatusLabel, complaintStatusColor,
  complaintCategoryLabel, canManageComplaints, canViewComplaintsReport,
} from '../store'
import ComplaintsReport from '../components/ComplaintsReport.vue'
import { formatDate } from '../utils'
import { tx, labelOf } from '../lang'

const rows = computed<any[]>(() => state.complaintsList || [])
const detail = computed<any>(() => state.openComplaint)

// نموذج المتابعة — يُصفَّر مع كل شكوى تُفتح
const note = ref('')
const nextStatus = ref('')
watch(() => state.openComplaintId, (id) => { note.value = ''; nextStatus.value = '' ; if (!id) return })
watch(detail, (d) => { if (d && !nextStatus.value) nextStatus.value = d.status })

// الحفظ يُقفل الشاشة: المتابعة فعلٌ ينتهي، وبقاؤها مفتوحةً يوهم بأن شيئاً لم يقع
// فيُضغط الزرّ ثانيةً. والملاحظة لا تُمسَح إلا بعد نجاحٍ مؤكَّد — كانت تُمسَح فوراً
// بلا انتظار، فيضيع ما كتبه الوكيل إن فشل الحفظ.
async function submitUpdate() {
  if (await addComplaintUpdate(note.value, nextStatus.value)) {
    note.value = ''
    closeComplaintDetail()
  }
}

onMounted(() => { void loadComplaintsList() })
</script>

<template>
  <section id="view-complaints" class="view active">
    <div class="orders-section">
      <div class="orders-header">
        <div>
          <h2 class="orders-title">{{ tx('الشكاوى', 'Complaints') }}</h2>
          <p class="dashboard-subtitle">{{ tx('شكاوى العملاء على الطلبات — ومتابعتها حتى الإغلاق', 'Customer complaints on orders — tracked through to closure') }}</p>
        </div>
        <!-- فلتر الحالة — للقائمة وحدها؛ التقرير له مداه الزمنيّ -->
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <template v-if="state.complaintsTab === 'list'">
            <button class="btn btn-sm" :class="state.complaintsFilter === '' ? 'btn-primary' : 'btn-outline'"
              @click="setComplaintsFilter('')">{{ tx('الكل', 'All') }}</button>
            <button v-for="s in COMPLAINT_STATUSES" :key="s.id" class="btn btn-sm"
              :class="state.complaintsFilter === s.id ? 'btn-primary' : 'btn-outline'"
              @click="setComplaintsFilter(s.id)">{{ labelOf(s) }}</button>
          </template>
        </div>
      </div>

      <!-- تبويبان: القائمة تُتابَع فيها شكوى، والتقرير يُقرأ فيه الاتّجاه. والتقرير
           بمفتاحٍ مستقلّ فلا يظهر لمن لا يملكه. -->
      <div v-if="canViewComplaintsReport()" class="cx-tabs">
        <button class="cx-tab" :class="{ on: state.complaintsTab === 'list' }"
          @click="state.complaintsTab = 'list'">{{ tx('القائمة', 'List') }}</button>
        <button class="cx-tab" :class="{ on: state.complaintsTab === 'report' }"
          @click="state.complaintsTab = 'report'">{{ tx('التقرير', 'Report') }}</button>
      </div>

      <ComplaintsReport v-if="state.complaintsTab === 'report' && canViewComplaintsReport()" />

      <div v-else class="orders-table-wrapper">
        <table class="orders-table">
          <thead>
            <tr>
              <th>{{ tx('التاريخ', 'Date') }}</th><th>{{ tx('رقم الطلب', 'Order no.') }}</th><th>{{ tx('العميل', 'Customer') }}</th><th>{{ tx('الفرع', 'Branch') }}</th>
              <th>{{ tx('النوع', 'Type') }}</th><th>{{ tx('الحالة', 'Status') }}</th><th>{{ tx('متابعات', 'Updates') }}</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="state.complaintsLoading"><td colspan="8" style="text-align:center; padding:26px;">{{ tx('جارٍ التحميل…', 'Loading…') }}</td></tr>
            <tr v-else-if="!rows.length"><td colspan="8" style="text-align:center; padding:26px;">{{ tx('لا توجد شكاوى', 'No complaints') }}</td></tr>
            <tr v-for="c in rows" :key="c.id" @click="openComplaintDetail(c.id)" style="cursor:pointer;">
              <td>{{ formatDate(c.createdAt) }}</td>
              <td style="font-weight:700;">{{ c.onlineOrderId ? '#' + c.onlineOrderId : '—' }}</td>
              <td>
                <div style="font-weight:600;">{{ c.customer?.name || '—' }}</div>
                <div style="font-size:11px; color:var(--text-muted);" dir="ltr">{{ c.customer?.phone || '' }}</div>
              </td>
              <td>{{ c.branch ? (c.branch.nameAr || c.branch.name) : '—' }}</td>
              <td>{{ complaintCategoryLabel(c.category) }}</td>
              <td>
                <span class="availability-chip" :style="{ background: complaintStatusColor(c.status) + '22', color: complaintStatusColor(c.status), fontWeight: 700 }">
                  {{ complaintStatusLabel(c.status) }}
                </span>
              </td>
              <td>{{ c._count?.updates ?? 0 }}</td>
              <td><button class="btn btn-sm btn-outline" @click.stop="openComplaintDetail(c.id)">{{ tx('تفاصيل', 'Details') }}</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── تفاصيل الشكوى + المتابعة ── -->
    <div v-if="state.openComplaintId" class="modal-overlay" @click.self="closeComplaintDetail()">
      <div class="modal-content" style="max-width:680px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">
            {{ tx('شكوى', 'Complaint') }} #{{ state.openComplaintId }}
            <span v-if="detail" class="availability-chip" :style="{ background: complaintStatusColor(detail.status) + '22', color: complaintStatusColor(detail.status), marginInlineStart: '8px' }">
              {{ complaintStatusLabel(detail.status) }}
            </span>
          </h3>
          <button class="modal-close" @click="closeComplaintDetail()">×</button>
        </div>

        <div class="modal-body" style="max-height:62vh; overflow-y:auto;">
          <p v-if="!detail" style="text-align:center; padding:24px; color:var(--text-muted);">{{ tx('جارٍ التحميل…', 'Loading…') }}</p>
          <template v-else>
            <!-- البيانات -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px 16px; padding:12px; border-radius:8px; background:var(--bg); border:1px solid var(--border); font-size:13px;">
              <div><span style="color:var(--text-secondary);">{{ tx('العميل:', 'Customer:') }}</span> <strong>{{ detail.customer?.name || '—' }}</strong></div>
              <div dir="ltr" style="text-align:end;"><strong>{{ detail.customer?.phone || '' }}</strong></div>
              <div><span style="color:var(--text-secondary);">{{ tx('النوع:', 'Type:') }}</span> <strong>{{ complaintCategoryLabel(detail.category) }}</strong></div>
              <div><span style="color:var(--text-secondary);">{{ tx('الفرع:', 'Branch:') }}</span> <strong>{{ detail.branch ? (detail.branch.nameAr || detail.branch.name) : '—' }}</strong></div>
              <div v-if="detail.onlineOrder" style="grid-column:1 / -1;">
                <span style="color:var(--text-secondary);">{{ tx('الطلب:', 'Order:') }}</span> <strong>#{{ detail.onlineOrder.id }}</strong>
              </div>
            </div>

            <div style="margin-top:12px; padding:12px; border-radius:8px; background:var(--danger-light, #fef2f2); border:1px solid var(--danger, #ef4444); font-size:13px; line-height:1.8;">
              {{ detail.description }}
            </div>

            <!-- تايم‑لاين المتابعة -->
            <h4 style="margin:16px 0 8px; font-size:13px; font-weight:800;">{{ tx('المتابعة', 'Follow-ups') }}</h4>
            <p v-if="!detail.updates?.length" style="font-size:12px; color:var(--text-muted);">{{ tx('لا توجد متابعات بعد', 'No follow-ups yet') }}</p>
            <div v-for="u in detail.updates" :key="u.id"
              style="padding:8px 12px; border-inline-start:3px solid var(--primary); background:var(--bg); border-radius:6px; margin-bottom:6px; font-size:12px;">
              <div style="color:var(--text-muted); font-size:11px;">{{ formatDate(u.createdAt) }}</div>
              <div v-if="u.statusTo" style="font-weight:700;">
                {{ tx('الحالة:', 'Status:') }} {{ complaintStatusLabel(u.statusFrom) }} ← {{ complaintStatusLabel(u.statusTo) }}
              </div>
              <div v-if="u.note" style="line-height:1.7;">{{ u.note }}</div>
            </div>

            <!-- إضافة متابعة -->
            <template v-if="canManageComplaints()">
              <h4 style="margin:16px 0 8px; font-size:13px; font-weight:800;">{{ tx('إضافة متابعة', 'Add a follow-up') }}</h4>
              <div class="form-group" style="margin-bottom:8px;">
                <label style="font-weight:700;">{{ tx('الحالة', 'Status') }}</label>
                <select v-model="nextStatus" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:6px; font-family:inherit;">
                  <option v-for="s in COMPLAINT_STATUSES" :key="s.id" :value="s.id">{{ labelOf(s) }}</option>
                </select>
              </div>
              <div class="form-group">
                <label style="font-weight:700;">{{ tx('ملاحظة / إجراء', 'Note / action') }}</label>
                <textarea v-model="note" :placeholder="tx('اكتب ما تمّ...', 'Write what was done…')" rows="3"
                  style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px; resize:vertical; font-family:inherit;"></textarea>
              </div>
            </template>
          </template>
        </div>

        <div class="modal-footer" style="justify-content:space-between;">
          <button class="btn btn-secondary" @click="closeComplaintDetail()">{{ tx('إغلاق', 'Close') }}</button>
          <button v-if="detail && canManageComplaints()" class="btn btn-primary" :disabled="state.complaintBusy" @click="submitUpdate()">
            {{ state.complaintBusy ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ المتابعة', 'Save follow-up') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cx-tabs { display: flex; gap: 6px; margin: 0 0 12px; }
.cx-tab {
  padding: 7px 16px; border-radius: var(--radius-sm, 6px); cursor: pointer;
  border: 1px solid var(--border, #e5e7eb); background: var(--bg-card, #fff);
  color: var(--text-secondary, #64748b); font-family: inherit; font-size: 12.5px; font-weight: 700;
}
.cx-tab.on { background: var(--primary, #2563eb); border-color: var(--primary, #2563eb); color: #fff; }
</style>
