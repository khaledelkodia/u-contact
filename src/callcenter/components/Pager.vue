<script setup lang="ts">
/**
 * شريط تصفّح الصفحات — لجداول الطلبات.
 *
 * الجداول كانت تُصيّر كل صفوفها دفعةً واحدة: مئات الطلبات في DOM واحد، والوكيل
 * يبحث بالتمرير. الصفحات تحدّ ما يُرسم وتعطي موضعاً معلوماً («٢٥ من ٣٤٠»).
 */
import { computed } from 'vue'
import { tx } from '../lang'

const props = defineProps<{ page: number; total: number; pageSize: number }>()
const emit = defineEmits<{ (e: 'update:page', v: number): void; (e: 'update:pageSize', v: number): void }>()

const SIZES = [10, 25, 50, 100]
const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const to = computed(() => Math.min(props.total, props.page * props.pageSize))

function go(p: number) { emit('update:page', Math.min(Math.max(1, p), pageCount.value)) }
function setSize(e: Event) { emit('update:pageSize', Number((e.target as HTMLSelectElement).value) || 25) }
</script>

<template>
  <div v-if="total > 0" class="uc-pager">
    <span class="uc-pager-info">
      {{ tx('عرض', 'Showing') }} <b>{{ from }}–{{ to }}</b> {{ tx('من', 'of') }} <b>{{ total }}</b>
    </span>

    <div class="uc-pager-ctl">
      <label class="uc-pager-size">
        <span>{{ tx('لكل صفحة', 'Per page') }}</span>
        <select :value="pageSize" @change="setSize">
          <option v-for="n in SIZES" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>

      <div class="uc-pager-nav">
        <button type="button" class="uc-pager-btn" :disabled="page <= 1" @click="go(page - 1)">
          {{ tx('السابق', 'Previous') }}
        </button>
        <span class="uc-pager-pos">{{ page }} / {{ pageCount }}</span>
        <button type="button" class="uc-pager-btn" :disabled="page >= pageCount" @click="go(page + 1)">
          {{ tx('التالي', 'Next') }}
        </button>
      </div>
    </div>
  </div>
</template>
